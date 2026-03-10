import * as db from "../db";
import { getConfiguredPhylloEnvironment } from "./env";
import { logError, logEvent, logWarn } from "./logger";
import {
  getPhylloAccounts,
  getPhylloContents,
  getPhylloProfiles,
  normalizePhylloWebhookEvents,
  type PhylloWebhookEvent,
} from "./phyllo";
import {
  findTrainerSocialIdentityConflict,
  formatTrainerSocialIdentityConflictMessage,
  notifyTrainerSocialIdentityConflict,
} from "./social-account-ownership";
import { notifySocialAlert } from "./websocket";

const PHYLLO_CONTENT_PULL_LIMIT = 25;

type ParsedContentRow = {
  phylloContentId: string;
  platform: string | null;
  postUrl: string | null;
  profileUrl: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  caption: string | null;
  publishedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  engagements: number;
  rawPayload: any;
};

function normalizePlatformName(value: unknown): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw || raw === "unknown" || raw === "n/a" || raw === "na") return "";
  if (
    raw.includes("youtube") ||
    raw.includes("yt ") ||
    raw.includes("yt_") ||
    (raw.includes("google") && raw.includes("video")) ||
    (raw.includes("google") && raw.includes("channel"))
  ) {
    return "youtube";
  }
  if (raw.includes("instagram")) return "instagram";
  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("facebook")) return "facebook";
  if (raw === "x" || raw.includes("twitter")) return raw === "x" ? "x" : "twitter";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("twitch")) return "twitch";
  if (raw.includes("snapchat")) return "snapchat";
  if (raw.includes("pinterest")) return "pinterest";
  return raw.replace(/\s+/g, "_");
}

function resolvePlatform(row: any): string {
  return normalizePlatformName(
    row?.platform ||
      row?.platform_name ||
      row?.work_platform?.name ||
      row?.workPlatform?.name ||
      row?.work_platform_name ||
      row?.network ||
      row?.name ||
      "",
  );
}

function normalizeRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function normalizeUrl(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw;
}

function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  const dt = new Date(String(value));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function toNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function readFollowerLikeCount(row: any): number {
  return toNumber(
    row?.audience?.follower_count ||
      row?.audience?.followers_count ||
      row?.audience?.subscriber_count ||
      row?.followers ||
      row?.followers_count ||
      row?.subscriber_count ||
      row?.subscribers ||
      row?.reputation?.subscriber_count ||
      row?.reputation?.follower_count,
  );
}

function normalizeContentRows(value: any): any[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.contents)) return value.contents;
  if (Array.isArray(value.content)) return value.content;
  if (Array.isArray(value.data?.contents)) return value.data.contents;
  if (Array.isArray(value.data?.content)) return value.data.content;
  if (value.content && typeof value.content === "object") return [value.content];
  if (value.contents && typeof value.contents === "object") return [value.contents];
  if (value.data && typeof value.data === "object") {
    const maybeContentId = String(
      value.data.id || value.data.content_id || value.data.post_id || "",
    ).trim();
    if (maybeContentId) return [value.data];
  }
  const directContentId = String(
    value.id || value.content_id || value.post_id || value.media_id || "",
  ).trim();
  if (directContentId) return [value];
  return [];
}

export function extractPhylloContentRows(payload: any): ParsedContentRow[] {
  const rows = normalizeContentRows(payload);
  return rows
    .map((row: any): ParsedContentRow | null => {
      const stats = row?.stats || row?.engagement || row?.metrics || {};
      const phylloContentId = String(
        row?.id || row?.content_id || row?.post_id || row?.media_id || "",
      ).trim();
      if (!phylloContentId) return null;
      const likes = toNumber(
        row?.likes || stats?.likes || stats?.like_count || row?.like_count,
      );
      const comments = toNumber(
        row?.comments || stats?.comments || stats?.comment_count || row?.comment_count,
      );
      const views = toNumber(
        row?.views ||
          row?.impressions ||
          stats?.views ||
          stats?.view_count ||
          stats?.impressions ||
          stats?.play_count,
      );
      const engagements = toNumber(
        row?.engagements ||
          stats?.engagements ||
          stats?.engagement_count ||
          likes + comments,
      );
      return {
        phylloContentId,
        platform: resolvePlatform(row) || null,
        postUrl:
          normalizeUrl(row?.post_url) ||
          normalizeUrl(row?.permalink) ||
          normalizeUrl(row?.url) ||
          normalizeUrl(row?.share_url) ||
          null,
        profileUrl:
          normalizeUrl(row?.profile_url) ||
          normalizeUrl(row?.account_url) ||
          normalizeUrl(row?.creator?.url) ||
          normalizeUrl(row?.author?.url) ||
          null,
        thumbnailUrl:
          normalizeUrl(row?.thumbnail_url) ||
          normalizeUrl(row?.cover_url) ||
          normalizeUrl(row?.image_url) ||
          null,
        title: String(row?.title || row?.name || "").trim() || null,
        caption:
          String(row?.caption || row?.description || row?.text || "").trim() || null,
        publishedAt:
          toIsoOrNull(row?.published_at) ||
          toIsoOrNull(row?.created_at) ||
          toIsoOrNull(row?.timestamp) ||
          null,
        views,
        likes,
        comments,
        engagements,
        rawPayload: row,
      };
    })
    .filter((row): row is ParsedContentRow => Boolean(row));
}

function deriveSeverity(eventType: string): "info" | "warning" | "critical" {
  const type = String(eventType || "").toLowerCase();
  if (
    type.includes("disconnected") ||
    type.includes("connection.failure") ||
    type.includes("token.expired") ||
    type.includes("permission") ||
    type.includes("reauth") ||
    type.includes("revoked")
  ) {
    return "critical";
  }
  if (type.includes("failed") || type.includes("error") || type.includes("warning")) {
    return "warning";
  }
  return "info";
}

function buildNotificationCopy(eventType: string): { title: string; body: string } {
  const type = String(eventType || "").toLowerCase();
  if (type.includes("account.connected")) {
    return {
      title: "Social account connected",
      body: "A social account was connected and your campaign metrics are refreshing.",
    };
  }
  if (type.includes("account.disconnected")) {
    return {
      title: "Social account disconnected",
      body: "A connected social account was disconnected. Reconnect it to continue campaign tracking.",
    };
  }
  if (type.includes("profiles.audience.updated") || type.includes("profiles.updated")) {
    return {
      title: "Audience metrics updated",
      body: "Your latest audience and profile metrics were synced from connected platforms.",
    };
  }
  if (type.includes("contents.added") || type.includes("contents.updated")) {
    return {
      title: "Content metrics updated",
      body: "New content activity has been synced into campaign performance metrics.",
    };
  }
  if (type.includes("comments")) {
    return {
      title: "Comment activity updated",
      body: "Recent comment activity was received and synced for campaign reporting.",
    };
  }
  if (type.includes("activity")) {
    return {
      title: "Activity update received",
      body: "Engagement activity has been refreshed from connected social platforms.",
    };
  }
  return {
    title: "Social integration update",
    body: `New social integration event received (${eventType}).`,
  };
}

function buildCelebrationCopy(params: {
  eventType: string;
  followerDelta: number;
  newFollowerCount: number;
  contentCount: number;
}): { title: string; body: string } | null {
  const type = String(params.eventType || "").toLowerCase();
  if (params.followerDelta > 0) {
    const followerLabel = params.followerDelta === 1 ? "follower" : "followers";
    return {
      title: `Congrats on ${params.followerDelta} new ${followerLabel}!`,
      body: `Your connected audience now shows ${params.newFollowerCount.toLocaleString()} total followers.`,
    };
  }
  if (type.includes("contents.added") && params.contentCount > 0) {
    return {
      title: "Nice work, your post is live!",
      body:
        params.contentCount === 1
          ? "We picked up your latest post and synced it into your campaign metrics."
          : `We picked up ${params.contentCount} new posts and synced them into your campaign metrics.`,
    };
  }
  return null;
}

type CampaignPostingTarget = {
  bundleDraftId: string;
  campaignAccountId: string;
  metadata: any;
  rules: db.CampaignPostingRules;
};

function extractNormalizedTags(text: string, prefix: "#" | "@"): string[] {
  const pattern =
    prefix === "#"
      ? /#[A-Za-z0-9_]+/g
      : /@[A-Za-z0-9_.]+/g;
  return Array.from(
    new Set(
      (text.match(pattern) || [])
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function extractUrls(text: string): string[] {
  return Array.from(
    new Set(
      (text.match(/https?:\/\/[^\s"'<>]+/gi) || [])
        .map((value) => value.replace(/[),.!?]+$/g, "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function collectPayloadStrings(
  value: unknown,
  results: Set<string>,
  depth = 0,
) {
  if (depth > 5 || results.size >= 250 || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) results.add(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectPayloadStrings(entry, results, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectPayloadStrings(entry, results, depth + 1);
    }
  }
}

function buildAttributionEvidence(
  content: db.TrainerSocialContent,
  rules: db.CampaignPostingRules,
) {
  const platform = normalizePlatformName(content.platform || "");
  const publishedAt = toIsoOrNull(content.publishedAt) || content.publishedAt || null;
  const searchStrings = new Set<string>();
  collectPayloadStrings(content.rawPayload, searchStrings);
  if (content.caption) searchStrings.add(content.caption);
  if (content.title) searchStrings.add(content.title);
  if (content.postUrl) searchStrings.add(content.postUrl);
  if (content.profileUrl) searchStrings.add(content.profileUrl);

  const combinedText = Array.from(searchStrings).join("\n");
  const hashtags = new Set(extractNormalizedTags(combinedText, "#"));
  const mentions = new Set(extractNormalizedTags(combinedText, "@"));
  const urls = new Set<string>(extractUrls(combinedText));
  for (const directUrl of [content.postUrl, content.profileUrl]) {
    const normalized = normalizeUrl(directUrl);
    if (normalized) urls.add(normalized.toLowerCase());
  }

  const matchedHashtags = rules.requiredHashtags.filter((tag) => hashtags.has(tag));
  const matchedMentions = rules.requiredMentions.filter((tag) => mentions.has(tag));
  const matchedLinkSlug =
    rules.requiredLinkSlug &&
    Array.from(urls).some((url) =>
      url.includes(String(rules.requiredLinkSlug || "").trim().toLowerCase()),
    )
      ? String(rules.requiredLinkSlug || "").trim()
      : null;

  const platformMatched =
    !rules.allowedPlatforms.length || rules.allowedPlatforms.includes(platform);
  const withinPostingWindow =
    !rules.postingWindowStart && !rules.postingWindowEnd
      ? true
      : Boolean(
          publishedAt &&
            (!rules.postingWindowStart || publishedAt >= rules.postingWindowStart) &&
            (!rules.postingWindowEnd || publishedAt <= rules.postingWindowEnd),
        );

  const hasProofRules =
    rules.requiredHashtags.length > 0 ||
    rules.requiredMentions.length > 0 ||
    Boolean(rules.requiredLinkSlug);
  const hashtagRequirementMet =
    rules.requiredHashtags.length === 0 || matchedHashtags.length > 0;
  const mentionRequirementMet =
    rules.requiredMentions.length === 0 || matchedMentions.length > 0;
  const linkRequirementMet = !rules.requiredLinkSlug || Boolean(matchedLinkSlug);
  const proofRequirementMet =
    hasProofRules &&
    hashtagRequirementMet &&
    mentionRequirementMet &&
    linkRequirementMet;
  const partialProofSignal =
    matchedHashtags.length > 0 || matchedMentions.length > 0 || Boolean(matchedLinkSlug);

  return {
    platform,
    publishedAt,
    caption: content.caption || null,
    postUrl: content.postUrl || null,
    matchedHashtags,
    matchedMentions,
    matchedLinkSlug,
    platformMatched,
    withinPostingWindow,
    missingHashtag: rules.requiredHashtags.length > 0 && matchedHashtags.length === 0,
    missingMention: rules.requiredMentions.length > 0 && matchedMentions.length === 0,
    missingLink: Boolean(rules.requiredLinkSlug) && !matchedLinkSlug,
    outsidePostingWindow: !withinPostingWindow,
    platformMismatch: !platformMatched,
    proofRequirementMet,
    partialProofSignal,
    hasProofRules,
  };
}

async function loadCampaignPostingTargets(params: {
  trainerId: string;
  bundleDraftId?: string;
}): Promise<CampaignPostingTarget[]> {
  const bundles = params.bundleDraftId
    ? [await db.getBundleDraftById(params.bundleDraftId)].filter(
        (bundle): bundle is db.BundleDraft =>
          Boolean(bundle && bundle.trainerId === params.trainerId),
      )
    : await db.getBundleDraftsByTrainer(params.trainerId);
  const bundleLinks = await Promise.all(
    bundles.map(async (bundle) => ({
      bundleDraftId: bundle.id,
      links: await db.getCampaignAccountsForBundle(bundle.id),
    })),
  );
  return bundleLinks.flatMap((bundle) =>
    bundle.links.map((link) => ({
      bundleDraftId: bundle.bundleDraftId,
      campaignAccountId: link.campaignAccountId,
      metadata: link.metadata || null,
      rules: db.normalizeCampaignPostingRules(link.metadata),
    })),
  );
}

export async function syncTrainerCampaignPostAttributions(params: {
  trainerId: string;
  bundleDraftId?: string;
  contentIds?: string[];
}) {
  const targets = await loadCampaignPostingTargets({
    trainerId: params.trainerId,
    bundleDraftId: params.bundleDraftId,
  });
  const bundleIds = Array.from(new Set(targets.map((target) => target.bundleDraftId)));
  if (!bundleIds.length) {
    return {
      evaluatedPosts: 0,
      updatedBundles: 0,
    };
  }

  const contentRows = params.contentIds?.length
    ? (await db.getTrainerSocialContentByIds(params.contentIds)).filter(
        (row) => row.trainerId === params.trainerId,
      )
    : await db.listTrainerSocialContents({
        trainerId: params.trainerId,
        limit: 5000,
      });

  for (const target of targets) {
    if (!target.rules.requiredHashtags.length &&
        !target.rules.requiredMentions.length &&
        !target.rules.requiredLinkSlug) {
      const targetContentIds = contentRows.map((row) => row.id);
      if (!targetContentIds.length) continue;
      await db.deleteTrainerSocialContentCampaignAttributions({
        trainerId: params.trainerId,
        bundleDraftId: target.bundleDraftId,
        campaignAccountId: target.campaignAccountId,
        trainerSocialContentIds: targetContentIds,
      });
      continue;
    }
    for (const content of contentRows) {
      const evidence = buildAttributionEvidence(content, target.rules);
      let status: db.TrainerSocialContentCampaignAttributionStatus = "rejected";
      if (!evidence.platformMatched || !evidence.withinPostingWindow) {
        status = "rejected";
      } else if (evidence.proofRequirementMet) {
        status = "matched";
      } else if (evidence.partialProofSignal) {
        status = "needs_review";
      }
      await db.upsertTrainerSocialContentCampaignAttribution({
        trainerSocialContentId: content.id,
        trainerId: params.trainerId,
        bundleDraftId: target.bundleDraftId,
        campaignAccountId: target.campaignAccountId,
        matchedAt: status === "matched" ? publishedAtOrNow(content.publishedAt) : null,
        status,
        evidence,
      });
    }
  }

  for (const bundleDraftId of bundleIds) {
    await db.syncTrainerCampaignMetricsFromAttributions({
      trainerId: params.trainerId,
      bundleDraftId,
    });
  }

  return {
    evaluatedPosts: contentRows.length,
    updatedBundles: bundleIds.length,
  };
}

function publishedAtOrNow(value: string | null | undefined): string {
  return toIsoOrNull(value) || new Date().toISOString();
}

export async function ingestTrainerSocialContentRows(params: {
  trainerId: string;
  phylloUserId: string | null;
  phylloAccountId: string | null;
  source: string;
  providerEventId?: string | null;
  contentRows: ParsedContentRow[];
}) {
  const savedContentIds: string[] = [];
  for (const contentRow of params.contentRows) {
    const savedContent = await db.upsertTrainerSocialContent({
      trainerId: params.trainerId,
      phylloUserId: params.phylloUserId,
      phylloAccountId: params.phylloAccountId,
      phylloContentId: contentRow.phylloContentId,
      platform: contentRow.platform,
      postUrl: contentRow.postUrl,
      profileUrl: contentRow.profileUrl,
      thumbnailUrl: contentRow.thumbnailUrl,
      title: contentRow.title,
      caption: contentRow.caption,
      publishedAt: contentRow.publishedAt,
      latestViews: contentRow.views,
      latestLikes: contentRow.likes,
      latestComments: contentRow.comments,
      latestEngagements: contentRow.engagements,
      metadata: {
        sourceEventType: params.source,
        providerEventId: params.providerEventId || null,
      },
      rawPayload: contentRow.rawPayload,
    });
    if (!savedContent) continue;
    savedContentIds.push(savedContent.id);
    await db.upsertTrainerSocialContentActivityDaily({
      trainerSocialContentId: savedContent.id,
      trainerId: params.trainerId,
      metricDate: contentRow.publishedAt || new Date().toISOString(),
      views: contentRow.views,
      likes: contentRow.likes,
      comments: contentRow.comments,
      engagements: contentRow.engagements,
      metadata: {
        sourceEventType: params.source,
        providerEventId: params.providerEventId || null,
      },
    });
  }
  if (savedContentIds.length > 0) {
    await syncTrainerCampaignPostAttributions({
      trainerId: params.trainerId,
      contentIds: savedContentIds,
    });
  }
  return {
    savedContentIds,
  };
}

async function refreshTrainerSnapshotFromPhyllo(params: {
  trainerId: string;
  phylloUserId: string;
  eventType: string;
}) {
  const [accountsRaw, profilesRaw] = await Promise.all([
    getPhylloAccounts(params.phylloUserId).catch(() => []),
    getPhylloProfiles(params.phylloUserId).catch(() => []),
  ]);
  const accounts = normalizeRows(accountsRaw);
  const profiles = normalizeRows(profilesRaw);
  const phylloAccountIds = accounts.map((a: any) => String(a?.id)).filter(Boolean);
  const socialIdentityConflict = await findTrainerSocialIdentityConflict({
    trainerId: params.trainerId,
    phylloUserId: params.phylloUserId,
    phylloAccountIds,
    profiles,
    accounts,
  });
  if (socialIdentityConflict) {
    await notifyTrainerSocialIdentityConflict({
      trainerId: params.trainerId,
      source: params.eventType,
      conflict: socialIdentityConflict,
    }).catch((error) => {
      logWarn("social.account_conflict_notification_failed", {
        trainerId: params.trainerId,
        source: params.eventType,
        error: error instanceof Error ? error.message : String(error || "unknown_error"),
      });
    });
    throw new Error(formatTrainerSocialIdentityConflictMessage(socialIdentityConflict));
  }
  const platformNames = Array.from(
    new Set([...profiles, ...accounts].map((row: any) => resolvePlatform(row)).filter(Boolean)),
  );
  const normalizedPlatformNames =
    platformNames.length === 1 && platformNames[0] === "unknown"
      ? ["youtube"]
      : platformNames;
  const followerCount = profiles.reduce(
    (sum: number, row: any) => sum + readFollowerLikeCount(row),
    0,
  );
  const avgViewsPerMonth = Math.round(
    profiles.reduce(
      (sum: number, row: any) =>
        sum + Number(row?.engagement?.avg_views_per_month || row?.avg_views_per_month || 0),
      0,
    ),
  );
  const avgEngagementRate =
    profiles.length > 0
      ? profiles.reduce(
          (sum: number, row: any) =>
            sum + Number(row?.engagement?.engagement_rate || row?.engagement_rate || 0),
          0,
        ) / profiles.length
      : 0;
  const avgCtr =
    profiles.length > 0
      ? profiles.reduce(
          (sum: number, row: any) =>
            sum + Number(row?.engagement?.ctr || row?.ctr || 0),
          0,
        ) / profiles.length
      : 0;
  await db.upsertTrainerSocialProfile({
    trainerId: params.trainerId,
    phylloUserId: params.phylloUserId,
    phylloAccountIds,
    platforms: normalizedPlatformNames,
    followerCount,
    avgViewsPerMonth,
    avgEngagementRate,
    avgCtr,
    metadata: {
      rawProfiles: profiles,
      rawAccounts: accounts,
      sourceEventType: params.eventType,
    },
    lastSyncedAt: new Date().toISOString(),
  });
  await db.upsertTrainerSocialMetricDaily({
    trainerId: params.trainerId,
    metricDate: new Date().toISOString(),
    platform: "all",
    followers: followerCount,
    views: avgViewsPerMonth,
    engagements: Math.round(avgViewsPerMonth * avgEngagementRate),
    clicks: Math.round(avgViewsPerMonth * avgCtr),
    shareSaves: Math.round(avgViewsPerMonth * 0.01),
    postsDelivered: 0,
    postsOnTime: 0,
    requiredPosts: 4,
    requiredTagPosts: 4,
    approvedCreativePosts: 0,
    metadata: { source: "phyllo_webhook", eventType: params.eventType },
  });
  return {
    followerCount,
    avgViewsPerMonth,
    avgEngagementRate,
    avgCtr,
    platforms: normalizedPlatformNames,
    accounts,
  };
}

export async function syncTrainerSocialFromPhylloPull(params: {
  trainerId: string;
  phylloUserId: string;
  source: string;
  limitPerAccount?: number;
}) {
  const refreshedSnapshot = await refreshTrainerSnapshotFromPhyllo({
    trainerId: params.trainerId,
    phylloUserId: params.phylloUserId,
    eventType: params.source,
  });

  const limitPerAccount = Math.max(
    1,
    Math.min(params.limitPerAccount || PHYLLO_CONTENT_PULL_LIMIT, 100),
  );
  const accountIds = Array.from(
    new Set(
      (refreshedSnapshot.accounts || [])
        .filter((row: any) => {
          const status = String(row?.status || "").trim().toUpperCase();
          return !status || status === "CONNECTED";
        })
        .map((row: any) => String(row?.id || "").trim())
        .filter(Boolean),
    ),
  );

  let pulledRows = 0;
  let savedRows = 0;
  let pulledViewsTotal = 0;
  let pulledEngagementsTotal = 0;
  for (const accountId of accountIds) {
    const rawContents = await getPhylloContents({
      accountId,
      limit: limitPerAccount,
    }).catch((error) => {
      logWarn("phyllo.pull.contents_failed", {
        trainerId: params.trainerId,
        phylloUserId: params.phylloUserId,
        accountId,
        source: params.source,
        error: error instanceof Error ? error.message : String(error || "unknown_error"),
      });
      return [];
    });
    const extractedContentRows = extractPhylloContentRows(rawContents);
    pulledRows += extractedContentRows.length;
    pulledViewsTotal += extractedContentRows.reduce(
      (sum, row) => sum + Number(row.views || 0),
      0,
    );
    pulledEngagementsTotal += extractedContentRows.reduce(
      (sum, row) => sum + Number(row.engagements || 0),
      0,
    );
    const ingestResult = await ingestTrainerSocialContentRows({
      trainerId: params.trainerId,
      phylloUserId: params.phylloUserId,
      phylloAccountId: accountId,
      source: params.source,
      contentRows: extractedContentRows,
    });
    savedRows += ingestResult.savedContentIds.length;
  }

  const derivedViewsPerMonth = Math.max(
    Number(refreshedSnapshot.avgViewsPerMonth || 0),
    pulledViewsTotal,
  );
  const derivedEngagementRate =
    Number(refreshedSnapshot.avgEngagementRate || 0) > 0
      ? Number(refreshedSnapshot.avgEngagementRate || 0)
      : derivedViewsPerMonth > 0
        ? pulledEngagementsTotal / derivedViewsPerMonth
        : 0;

  if (
    derivedViewsPerMonth !== Number(refreshedSnapshot.avgViewsPerMonth || 0) ||
    derivedEngagementRate !== Number(refreshedSnapshot.avgEngagementRate || 0)
  ) {
    await db.upsertTrainerSocialProfile({
      trainerId: params.trainerId,
      phylloUserId: params.phylloUserId,
      phylloAccountIds: accountIds,
      platforms: refreshedSnapshot.platforms,
      followerCount: Number(refreshedSnapshot.followerCount || 0),
      avgViewsPerMonth: derivedViewsPerMonth,
      avgEngagementRate: derivedEngagementRate,
      avgCtr: Number(refreshedSnapshot.avgCtr || 0),
      metadata: {
        rawProfiles: [],
        rawAccounts: refreshedSnapshot.accounts || [],
        sourceEventType: params.source,
        contentPullViewFallback: true,
        pulledViewsTotal,
        pulledEngagementsTotal,
      },
      lastSyncedAt: new Date().toISOString(),
    });
    await db.upsertTrainerSocialMetricDaily({
      trainerId: params.trainerId,
      metricDate: new Date().toISOString(),
      platform: "all",
      followers: Number(refreshedSnapshot.followerCount || 0),
      views: derivedViewsPerMonth,
      engagements: Math.round(derivedViewsPerMonth * derivedEngagementRate),
      clicks: Math.round(derivedViewsPerMonth * Number(refreshedSnapshot.avgCtr || 0)),
      shareSaves: Math.round(derivedViewsPerMonth * 0.01),
      postsDelivered: 0,
      postsOnTime: 0,
      requiredPosts: 4,
      requiredTagPosts: 4,
      approvedCreativePosts: 0,
      metadata: {
        source: params.source,
        contentPullViewFallback: true,
        pulledViewsTotal,
        pulledEngagementsTotal,
      },
    });
  }

  return {
    ...refreshedSnapshot,
    avgViewsPerMonth: derivedViewsPerMonth,
    avgEngagementRate: derivedEngagementRate,
    accountIds,
    pulledRows,
    savedRows,
    pulledViewsTotal,
  };
}

export async function processPhylloWebhookPayload(payload: any) {
  const normalizedEvents = normalizePhylloWebhookEvents(payload);
  const managerLikeIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
  const environment = getConfiguredPhylloEnvironment();

  for (const event of normalizedEvents) {
    await processSinglePhylloEvent(event, managerLikeIds, environment);
  }

  return normalizedEvents.length;
}

async function processSinglePhylloEvent(
  event: PhylloWebhookEvent,
  managerLikeIds: string[],
  environment: "sandbox" | "staging" | "production",
) {
  const linkedProfile = event.phylloUserId
    ? await db.getTrainerSocialProfileByPhylloUserId(event.phylloUserId)
    : undefined;
  const trainerId = linkedProfile?.trainerId || null;
  const ingest = await db.insertPhylloWebhookEventIfNew({
    providerEventId: event.providerEventId,
    eventType: event.eventType,
    trainerId,
    phylloUserId: event.phylloUserId,
    phylloAccountId: event.phylloAccountId,
    occurredAt: event.occurredAt,
    payload: event.payload,
    status: "received",
  });

  if (!ingest.isNew && ingest.event.status !== "failed") return;

  try {
    const severity = deriveSeverity(event.eventType);
    const previousFollowerCount = Number(linkedProfile?.followerCount || 0);
    if (!trainerId) {
      await db.markPhylloWebhookEventStatus(ingest.event.id, {
        status: "ignored",
        lastError: "No trainer mapping for social identity",
      });
      logWarn("phyllo.webhook.unmapped_user", {
        eventType: event.eventType,
        eventId: event.providerEventId,
        phylloUserId: event.phylloUserId,
        environment,
      });
      return;
    }

    const refreshedSnapshot = await refreshTrainerSnapshotFromPhyllo({
      trainerId,
      phylloUserId: event.phylloUserId || linkedProfile?.phylloUserId || "",
      eventType: event.eventType,
    });

    const extractedContentRows = extractPhylloContentRows(event.payload);
    const ingestResult = await ingestTrainerSocialContentRows({
      trainerId,
      phylloUserId: event.phylloUserId || linkedProfile?.phylloUserId || null,
      phylloAccountId: event.phylloAccountId || null,
      source: event.eventType,
      providerEventId: event.providerEventId,
      contentRows: extractedContentRows,
    });

    const copy = buildNotificationCopy(event.eventType);
    const recipients =
      severity === "info"
        ? [trainerId]
        : Array.from(new Set([trainerId, ...managerLikeIds]));

    for (const recipientUserId of recipients) {
      await db.createSocialEventNotification({
        recipientUserId,
        trainerId,
        eventId: ingest.event.id,
        severity,
        category: "social_event",
        title: copy.title,
        body: copy.body,
        metadata: {
          eventType: event.eventType,
          providerEventId: event.providerEventId,
          phylloUserId: event.phylloUserId,
          phylloAccountId: event.phylloAccountId,
          environment,
        },
      });
    }

    const celebration = buildCelebrationCopy({
      eventType: event.eventType,
      followerDelta: Math.max(0, Number(refreshedSnapshot?.followerCount || 0) - previousFollowerCount),
      newFollowerCount: Number(refreshedSnapshot?.followerCount || 0),
      contentCount: ingestResult.savedContentIds.length,
    });
    if (celebration) {
      await db.createSocialEventNotification({
        recipientUserId: trainerId,
        trainerId,
        eventId: ingest.event.id,
        severity: "info",
        category: "social_event",
        title: celebration.title,
        body: celebration.body,
        metadata: {
          eventType: event.eventType,
          providerEventId: event.providerEventId,
          celebration: true,
          environment,
        },
      });
      notifySocialAlert([trainerId], {
        severity: "info",
        title: celebration.title,
        body: celebration.body,
        trainerId,
        eventType: event.eventType,
        celebratory: true,
      });
    }

    if (severity === "critical") {
      notifySocialAlert(recipients, {
        severity,
        title: copy.title,
        body: copy.body,
        trainerId,
        eventType: event.eventType,
      });
    }

    await db.markPhylloWebhookEventStatus(ingest.event.id, { status: "processed" });
    logEvent("phyllo.webhook.processed", {
      eventId: event.providerEventId,
      eventType: event.eventType,
      trainerId,
      severity,
      environment,
    });
  } catch (error: any) {
    await db.markPhylloWebhookEventStatus(ingest.event.id, {
      status: "failed",
      lastError: String(error?.message || "unknown_error"),
      incrementAttemptCount: true,
    });
    logError("phyllo.webhook.process_failed", error, {
      eventId: event.providerEventId,
      eventType: event.eventType,
      trainerId,
      environment,
    });
  }
}
