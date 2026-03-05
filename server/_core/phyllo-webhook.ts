import * as db from "../db";
import { getConfiguredPhylloEnvironment } from "./env";
import { logError, logEvent, logWarn } from "./logger";
import {
  getPhylloAccounts,
  getPhylloProfiles,
  normalizePhylloWebhookEvents,
  type PhylloWebhookEvent,
} from "./phyllo";
import { notifySocialAlert } from "./websocket";

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

function normalizeContentRows(value: any): any[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value;
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
  const platformNames = Array.from(
    new Set([...profiles, ...accounts].map((row: any) => resolvePlatform(row)).filter(Boolean)),
  );
  const normalizedPlatformNames =
    platformNames.length === 1 && platformNames[0] === "unknown"
      ? ["youtube"]
      : platformNames;
  const followerCount = profiles.reduce(
    (sum: number, row: any) =>
      sum + Number(row?.audience?.follower_count || row?.followers || 0),
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
    phylloAccountIds: accounts.map((a: any) => String(a?.id)).filter(Boolean),
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
  const bundles = await db.getBundleDraftsByTrainer(params.trainerId);
  for (const bundle of bundles) {
    if (!bundle?.id || !bundle?.templateId) continue;
    await db
      .syncTrainerCampaignMetricsFromLatestSocialSnapshot({
        trainerId: params.trainerId,
        bundleDraftId: bundle.id,
      })
      .catch(() => 0);
  }
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
  environment: "sandbox" | "production",
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

    await refreshTrainerSnapshotFromPhyllo({
      trainerId,
      phylloUserId: event.phylloUserId || linkedProfile?.phylloUserId || "",
      eventType: event.eventType,
    });

    const extractedContentRows = extractPhylloContentRows(event.payload);
    for (const contentRow of extractedContentRows) {
      const savedContent = await db.upsertTrainerSocialContent({
        trainerId,
        phylloUserId: event.phylloUserId || linkedProfile?.phylloUserId || null,
        phylloAccountId: event.phylloAccountId || null,
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
          sourceEventType: event.eventType,
          providerEventId: event.providerEventId,
        },
        rawPayload: contentRow.rawPayload,
      });
      if (!savedContent) continue;
      await db.upsertTrainerSocialContentActivityDaily({
        trainerSocialContentId: savedContent.id,
        trainerId,
        metricDate: contentRow.publishedAt || new Date().toISOString(),
        views: contentRow.views,
        likes: contentRow.likes,
        comments: contentRow.comments,
        engagements: contentRow.engagements,
        metadata: {
          sourceEventType: event.eventType,
          providerEventId: event.providerEventId,
        },
      });
    }

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
