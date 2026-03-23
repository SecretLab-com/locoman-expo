import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { CLIENT_STATUS_VALUES } from "../shared/client-status.js";
import {
  COOKIE_NAME,
  LOCO_ASSISTANT_NAME,
  LOCO_ASSISTANT_USER_ID,
} from "../shared/const.js";
import { isSupportedCountry } from "../shared/countries.js";
import {
  canEditPayoutKycIntake,
  getPayoutKycStatusLabel,
  getPayoutKycTrainerMessage,
  isPayoutKycPaymentEnabled,
  normalizePayoutKycStatus,
  PAYOUT_KYC_ACCOUNT_HOLDER_TYPES,
  PAYOUT_KYC_STATUSES,
  type PayoutKycStatus,
} from "../shared/payout-kyc.js";
import {
  decodeRescheduleRequest,
  encodeRescheduleRequest,
  normalizeRescheduleDate as normalizeIsoDate,
  type RescheduleRequestPayload,
} from "../shared/reschedule-request.js";
import {
  buildSavedCartProposalSnapshot,
  cadenceToSessionsPerWeek,
  countProjectedSessions,
  diffProposalSnapshots,
  mergeSavedCartProposalPlanMetadata,
  normalizeCadenceCode,
  type ProposalCadenceCode,
  type ProposalItemInput,
  type SavedCartProposalSnapshot,
} from "../shared/saved-cart-proposal.js";
import { getSessionCookieOptions } from "./_core/cookies";
import {
  getInviteEmailFailureUserMessage,
  sendInviteEmail,
  sendSocialProgramInviteEmail,
} from "./_core/email";
import { ENV, getConfiguredPhylloEnvironment } from "./_core/env";
import { logError, logEvent, logWarn } from "./_core/logger";
import {
  createPhylloSdkToken,
  createPhylloUser,
  decodePhylloSdkTokenClaims,
  getBootstrapPhylloUserFromEnv,
  getBootstrapSdkTokenFromEnv,
  getPhylloAccounts,
  getPhylloProfiles,
  inferPhylloTokenEnvironment,
} from "./_core/phyllo";
import { generateImage } from "./_core/imageGeneration";
import {
  processPhylloWebhookPayload,
  syncTrainerCampaignPostAttributions,
  syncTrainerSocialFromPhylloPull,
} from "./_core/phyllo-webhook";
import {
  findTrainerSocialIdentityConflict,
  formatTrainerSocialIdentityConflictMessage,
  notifyTrainerSocialIdentityConflict,
} from "./_core/social-account-ownership";
import { sendPushToUsers } from "./_core/push";
import { systemRouter } from "./_core/systemRouter";
import { runTrainerAssistant } from "./_core/trainerAssistant";
import { transcribeAudio } from "./_core/voiceTranscription";
import {
  coordinatorProcedure,
  managerProcedure,
  protectedProcedure,
  publicProcedure,
  router,
  trainerProcedure,
} from "./_core/trpc";
import {
  isUserOnline,
  notifyBadgeCounts,
  notifyNewMessage,
  notifySocialAlert,
  sendToUser,
} from "./_core/websocket";
import * as adyen from "./adyen";
import * as db from "./db";
import {
  mapPaymentSessionForView,
  mapPaymentState,
  summarizePaymentSessions,
} from "./domains/payments";
import * as googleCalendar from "./google-calendar";
import * as shopify from "./shopify";
import { storagePut } from "./storage";

const SERVER_USER_ID = LOCO_ASSISTANT_USER_ID;

function toMessagePushBody(
  content: string,
  messageType: "text" | "image" | "file" = "text",
): string {
  const trimmed = content.trim();
  if (trimmed.length > 0) {
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
  }
  if (messageType === "image") return "Sent you an image";
  if (messageType === "file") return "Sent you a file";
  return "Sent you a message";
}

function isManagerLikeRole(role: string): boolean {
  return role === "manager" || role === "coordinator";
}

function getBundleReviewLinks(bundleId: string) {
  const webBase = String(process.env.EXPO_PUBLIC_APP_URL || "https://locomotivate.app")
    .trim()
    .replace(/\/+$/g, "");
  const webUrl = `${webBase}/bundle-editor/${bundleId}`;
  const deepLink = `locomotivate://bundle-editor/${bundleId}`;
  return { webUrl, deepLink };
}

function getPublicAppBaseUrl() {
  return String(process.env.EXPO_PUBLIC_APP_URL || "https://bright.coach")
    .trim()
    .replace(/\/+$/g, "");
}

function slugifyForUrl(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function buildCampaignShareUrl(slug: string) {
  return `${getPublicAppBaseUrl()}/campaign/${slug}`;
}

const PHYLLO_CONNECT_SDK_URL = "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js";

function getPhylloConnectEnvironment(): "sandbox" | "staging" | "production" {
  return getConfiguredPhylloEnvironment();
}

async function ensureSocialCommitmentProgress(trainerId: string) {
  let commitment = await db.getActiveTrainerSocialCommitment(trainerId);
  if (!commitment) {
    await db.upsertTrainerSocialCommitment({
      trainerId,
      minimumFollowers: 10000,
      minimumPosts: 4,
      minimumOnTimePct: 95,
      minimumTagPct: 98,
      minimumApprovedCreativePct: 98,
      minimumAvgViews: 1000,
      minimumEngagementRate: 0.03,
      minimumCtr: 0.008,
      minimumShareSaveRate: 0.007,
      active: true,
      effectiveFrom: new Date().toISOString(),
    });
    commitment = await db.getActiveTrainerSocialCommitment(trainerId);
  }

  const fromDate = new Date();
  fromDate.setDate(1);
  const toDate = new Date(fromDate);
  toDate.setMonth(toDate.getMonth() + 1);
  toDate.setDate(0);

  await db.upsertTrainerSocialCommitmentProgress({
    trainerId,
    commitmentId: commitment?.id || null,
    periodStart: fromDate.toISOString(),
    periodEnd: toDate.toISOString(),
    status: "on_track",
    postsDelivered: 0,
    postsRequired: commitment?.minimumPosts || 4,
  });
}

async function ensureActiveSocialMembershipForConnect(params: {
  trainerId: string;
}): Promise<{ membership: db.TrainerSocialMembership; pendingInviteAccepted: boolean }> {
  let membership = await db.getTrainerSocialMembership(params.trainerId);
  const invites = await db.getTrainerSocialInvitesByTrainer(params.trainerId);
  const pendingInvite = invites
    .filter((row) => row.status === "pending")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  if (membership?.status === "banned" && !pendingInvite) {
    forbidden("Your social membership is banned");
  }
  if (membership?.status === "paused") {
    forbidden("Your social membership is paused");
  }

  const pendingInviteAccepted = false;

  if (!membership || membership.status === "invited") {
    const existingProfile = await db.getTrainerSocialProfile(params.trainerId);
    if (existingProfile?.phylloUserId) {
      membership = await db.upsertTrainerSocialMembership({
        trainerId: params.trainerId,
        status: "active",
        acceptedAt:
          membership?.acceptedAt ||
          existingProfile.lastSyncedAt ||
          new Date().toISOString(),
        invitedBy: membership?.invitedBy || null,
        reason: null,
      });
    }
  }

  if (!membership || membership.status !== "active") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: pendingInvite
        ? "Please accept your exclusive social program invite to connect."
        : "The Social Posts program is invite-only. Please wait for a coordinator invitation.",
    });
  }

  await ensureSocialCommitmentProgress(params.trainerId);
  return { membership, pendingInviteAccepted };
}

async function reconcileTrainerSocialMembershipState(params: {
  trainerId: string;
  membership?: db.TrainerSocialMembership;
  profile?: db.TrainerSocialProfile;
  pendingInvite?: db.TrainerSocialInvite;
}): Promise<{
  membership?: db.TrainerSocialMembership;
  pendingInvite?: db.TrainerSocialInvite;
}> {
  let membership = params.membership;
  let pendingInvite = params.pendingInvite;
  const profile = params.profile;

  if ((membership?.status === "banned" || membership?.status === "paused") && !pendingInvite) {
    return { membership, pendingInvite };
  }

  if (
    pendingInvite &&
    (!membership ||
      membership.status === "banned" ||
      membership.status === "uninvited" ||
      membership.status === "declined")
  ) {
    membership = await db.upsertTrainerSocialMembership({
      trainerId: params.trainerId,
      status: "invited",
      invitedBy: pendingInvite.invitedBy,
      invitedAt: membership?.invitedAt || pendingInvite.createdAt,
      acceptedAt: null,
      pausedAt: null,
      bannedAt: null,
      declinedAt: null,
      reason: null,
    });
  }

  if (profile?.phylloUserId && !pendingInvite) {
    if (!membership || membership.status === "invited") {
      membership = await db.upsertTrainerSocialMembership({
        trainerId: params.trainerId,
        status: "active",
        invitedBy: membership?.invitedBy || null,
        acceptedAt:
          membership?.acceptedAt ||
          profile.lastSyncedAt ||
          new Date().toISOString(),
        declinedAt: null,
        pausedAt: null,
        bannedAt: null,
        reason: null,
      });
    }
    return { membership, pendingInvite };
  }

  return { membership, pendingInvite };
}

function getTrainerVisibleSocialMembership(params: {
  membership?: db.TrainerSocialMembership;
  pendingInvite?: db.TrainerSocialInvite;
}): db.TrainerSocialMembership | undefined {
  const { membership, pendingInvite } = params;
  if (!membership) return undefined;
  if (membership.status === "banned" && !pendingInvite?.id) {
    return {
      ...membership,
      status: "uninvited",
      reason: null,
    };
  }
  return membership;
}

function shouldRedactTrainerSocialProgramDetails(params: {
  membership?: db.TrainerSocialMembership;
  pendingInvite?: db.TrainerSocialInvite;
}) {
  const status = params.membership?.status || "not_enrolled";
  return (
    Boolean(params.pendingInvite?.id) ||
    status === "invited" ||
    status === "uninvited" ||
    status === "declined" ||
    status === "not_enrolled"
  );
}

async function preparePhylloConnectSession(params: {
  trainerId: string;
  trainerName: string | null;
  forceNewUser?: boolean;
}) {
  const { membership, pendingInviteAccepted } = await ensureActiveSocialMembershipForConnect({
    trainerId: params.trainerId,
  });

  const profile = await db.getTrainerSocialProfile(params.trainerId);
  let phylloUserId = profile?.phylloUserId || null;
  const bootstrapUser = getBootstrapPhylloUserFromEnv();
  const sdkTokenFromEnv = getBootstrapSdkTokenFromEnv();
  const hasPhylloAuthBasic = Boolean(ENV.phylloAuthBasic);
  const canUseBootstrap = Boolean(bootstrapUser?.id && sdkTokenFromEnv?.sdkToken);
  const connectEnvironment = getPhylloConnectEnvironment();
  const createFreshPhylloUser = async () => {
    const created = await createPhylloUser({
      name: params.trainerName || ENV.phylloName || "LocoMotivate Trainer",
      externalId:
        `${params.trainerId}-${Date.now()}` || ENV.phylloExternalId || "trainer",
    });
    return created.id;
  };

  if (!phylloUserId || params.forceNewUser) {
    // Prefer trainer-specific Phyllo users when API credentials are available.
    if (hasPhylloAuthBasic) {
      phylloUserId = await createFreshPhylloUser();
    } else if (canUseBootstrap) {
      // Fallback mode: shared bootstrap identity when direct Phyllo API auth is unavailable.
      phylloUserId = bootstrapUser!.id;
    } else {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          "Phyllo API credentials are missing. Set PHYLLO_AUTH_BASIC or provide PHYLLO_ID + PHYLLO_SDK_TOKEN bootstrap values.",
      });
    }
  }

  const phylloIdentityConflict = await findTrainerSocialIdentityConflict({
    trainerId: params.trainerId,
    phylloUserId,
  });
  if (phylloIdentityConflict) {
    await notifyTrainerSocialIdentityConflict({
      trainerId: params.trainerId,
      source: "prepare_connect_session",
      conflict: phylloIdentityConflict,
    }).catch((error) => {
      logWarn("social.account_conflict_notification_failed", {
        trainerId: params.trainerId,
        source: "prepare_connect_session",
        error: String((error as any)?.message || error),
      });
    });
    throw new TRPCError({
      code: "CONFLICT",
      message: formatTrainerSocialIdentityConflictMessage(phylloIdentityConflict),
    });
  }

  const tokenMode = hasPhylloAuthBasic ? "dynamic" : "bootstrap";
  const sdkTokenPayload = hasPhylloAuthBasic
    ? await (async () => {
        try {
          return await createPhylloSdkToken({ userId: phylloUserId });
        } catch (tokenError: any) {
          const tokenMessage = String(tokenError?.message || "").toLowerCase();
          const isIncorrectUser =
            tokenMessage.includes("incorrect_user_id") ||
            tokenMessage.includes("requested user id does not exist");
          if (!isIncorrectUser || params.forceNewUser) throw tokenError;
          // Recover stale/removed sandbox users by minting a fresh user id.
          phylloUserId = await createFreshPhylloUser();
          return await createPhylloSdkToken({ userId: phylloUserId });
        }
      })()
    : (() => {
        if (!sdkTokenFromEnv) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Phyllo SDK token generation requires PHYLLO_AUTH_BASIC. Add PHYLLO_SDK_TOKEN for bootstrap mode or configure PHYLLO_AUTH_BASIC.",
          });
        }
        return {
          sdk_token: sdkTokenFromEnv.sdkToken,
          expires_at: sdkTokenFromEnv.expiresAt || "",
        };
      })();

  // Persist whichever Phyllo user id was used for this session so
  // completeConnect and subsequent reconnect attempts stay in sync.
  if (phylloUserId && phylloUserId !== profile?.phylloUserId) {
    try {
      await db.upsertTrainerSocialProfile({
        trainerId: params.trainerId,
        phylloUserId,
      });
    } catch (error) {
      logWarn("phyllo.persist_user_id_failed", {
        trainerId: params.trainerId,
        error: String((error as any)?.message || error),
      });
    }
  }

  const tokenClaims = decodePhylloSdkTokenClaims(sdkTokenPayload.sdk_token);
  const tokenEnvironment = inferPhylloTokenEnvironment(tokenClaims);
  if (tokenEnvironment !== "unknown" && tokenEnvironment !== connectEnvironment) {
    logWarn("phyllo.sdk_token_environment_mismatch", {
      trainerId: params.trainerId,
      tokenMode,
      connectEnvironment,
      tokenEnvironment,
    });
    // Do not hard-fail on claim/env mismatch. Staging-issued tokens can
    // present claims that look production-like while still requiring sandbox connect.
  }

  const tokenExpMs = tokenClaims?.exp ? Number(tokenClaims.exp) * 1000 : null;
  if (tokenExpMs && tokenExpMs <= Date.now() + 60_000) {
    logWarn("phyllo.sdk_token_expiring_too_soon", {
      trainerId: params.trainerId,
      tokenMode,
      connectEnvironment,
      tokenExpMs,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Phyllo connect session expired. Refresh PHYLLO credentials or configure PHYLLO_AUTH_BASIC for dynamic token generation.",
    });
  }

  logEvent("phyllo.connect_session_prepared", {
    trainerId: params.trainerId,
    tokenMode,
    connectEnvironment,
    tokenEnvironment,
    hasPhylloAuthBasic,
  });

  return {
    membership,
    pendingInviteAccepted,
    phylloUserId,
    sdkToken: sdkTokenPayload.sdk_token,
    sdkTokenExpiresAt: sdkTokenPayload.expires_at,
    hasPhylloAuthBasic,
    connectEnvironment,
  };
}

async function syncPhylloProfileForTrainer(params: {
  trainerId: string;
  membership: db.TrainerSocialMembership;
  phylloUserId: string;
  hasPhylloAuthBasic: boolean;
  source: string;
}) {
  const [accountsRaw, profilesRaw] = params.hasPhylloAuthBasic
    ? await Promise.all([
        getPhylloAccounts(params.phylloUserId).catch(() => []),
        getPhylloProfiles(params.phylloUserId).catch(() => []),
      ])
    : [[], []];

  const normalizeRows = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.items)) return value.items;
    return [];
  };

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
      source: params.source,
      conflict: socialIdentityConflict,
    }).catch((error) => {
      logWarn("social.account_conflict_notification_failed", {
        trainerId: params.trainerId,
        source: params.source,
        error: String((error as any)?.message || error),
      });
    });
    throw new TRPCError({
      code: "CONFLICT",
      message: formatTrainerSocialIdentityConflictMessage(socialIdentityConflict),
    });
  }

  const normalizePlatformName = (value: unknown): string => {
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
  };

  const resolvePlatform = (row: any): string =>
    normalizePlatformName(
      row?.platform ||
        row?.platform_name ||
        row?.work_platform?.name ||
        row?.workPlatform?.name ||
        row?.work_platform_name ||
        row?.network ||
        row?.name ||
        "",
    );

  const platformNames = Array.from(
    new Set(
      [...profiles, ...accounts].map((row: any) => resolvePlatform(row)).filter(Boolean),
    ),
  );
  const normalizedPlatformNames =
    platformNames.length === 1 && platformNames[0] === "unknown"
      ? ["youtube"]
      : platformNames;

  const followerCount = profiles.reduce(
    (sum: number, row: any) =>
      sum +
      Number(
        row?.audience?.follower_count ||
          row?.audience?.followers_count ||
          row?.audience?.subscriber_count ||
          row?.followers ||
          row?.followers_count ||
          row?.subscriber_count ||
          row?.subscribers ||
          row?.reputation?.subscriber_count ||
          row?.reputation?.follower_count ||
          0,
      ),
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

  const savedProfile = await db.upsertTrainerSocialProfile({
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
    },
    lastSyncedAt: new Date().toISOString(),
  });

  await db.upsertTrainerSocialMembership({
    trainerId: params.trainerId,
    status: "active",
    acceptedAt: params.membership.acceptedAt || new Date().toISOString(),
    invitedBy: params.membership.invitedBy,
    reason: null,
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
    metadata: { source: params.source },
  });

  return savedProfile;
}

async function sendBundleReviewThreadMessage(params: {
  senderId: string;
  senderName: string;
  receiverIds: string[];
  bundleId: string;
  content: string;
}) {
  const uniqueReceiverIds = Array.from(
    new Set(
      params.receiverIds.filter(
        (receiverId) => receiverId && receiverId !== params.senderId,
      ),
    ),
  );
  if (uniqueReceiverIds.length === 0) return;

  for (const receiverId of uniqueReceiverIds) {
    const conversationId = [params.senderId, receiverId].sort().join("-");
    const messageId = await db.createMessage({
      senderId: params.senderId,
      receiverId,
      conversationId,
      content: params.content,
    });

    notifyNewMessage(
      conversationId,
      {
        id: messageId,
        senderId: params.senderId,
        senderName: params.senderName,
        receiverId,
        content: params.content,
        conversationId,
      },
      [receiverId, params.senderId],
      params.senderId,
    );

    notifyBadgeCounts([receiverId]);

    if (!isUserOnline(receiverId)) {
      await sendPushToUsers([receiverId], {
        title: params.senderName,
        body: toMessagePushBody(params.content, "text"),
        data: {
          type: "message",
          conversationId,
          senderId: params.senderId,
          senderName: params.senderName,
          bundleId: params.bundleId,
        },
      });
    }
  }
}

function toAbsoluteRequestUrl(
  req: {
    protocol?: string;
    get?: (name: string) => string | undefined;
    headers?: Record<string, unknown>;
  },
  value: string,
): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) return value;

  const forwardedProtoRaw = String(req.headers?.["x-forwarded-proto"] || "");
  const forwardedProto = forwardedProtoRaw.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = req.get?.("host") || String(req.headers?.host || "");
  if (!host) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot resolve absolute URL for transcription",
    });
  }
  return `${protocol}://${host}${value}`;
}

function extractBearerTokenFromRequest(req: {
  headers?: Record<string, unknown>;
}): string | null {
  const rawAuthorization =
    req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof rawAuthorization !== "string") return null;
  const [scheme, token] = rawAuthorization.trim().split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const json = Buffer.from(payloadPart, "base64url").toString("utf8");
    const payload = JSON.parse(json);
    if (!payload || typeof payload !== "object") return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeJwtExpiryIso(token: string): string | null {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  return new Date(exp * 1000).toISOString();
}

function getSupabaseMcpTokenEnv() {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    ""
  ).replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  return { supabaseUrl, serviceRoleKey, anonKey };
}

function extractTokenHashFromSupabaseActionLink(
  actionLink: unknown,
): string | null {
  if (!actionLink || typeof actionLink !== "string") return null;
  try {
    const url = new URL(actionLink);
    return (
      url.searchParams.get("token_hash") ||
      url.hash?.match(/token_hash=([^&]+)/)?.[1] ||
      null
    );
  } catch {
    return null;
  }
}

export async function mintSupabaseAccessTokenForEmail(email: string): Promise<string> {
  const { supabaseUrl, serviceRoleKey, anonKey } = getSupabaseMcpTokenEnv();
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error(
      "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY",
    );
  }

  const linkResponse = await fetch(
    `${supabaseUrl}/auth/v1/admin/generate_link`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "magiclink",
        email,
      }),
    },
  );

  if (!linkResponse.ok) {
    const body = await linkResponse.text();
    throw new Error(`generate_link failed (${linkResponse.status}): ${body}`);
  }

  const linkPayload = (await linkResponse.json()) as {
    properties?: { hashed_token?: string | null };
    hashed_token?: string | null;
    action_link?: string | null;
  };
  const tokenHash =
    linkPayload.properties?.hashed_token ||
    linkPayload.hashed_token ||
    extractTokenHashFromSupabaseActionLink(linkPayload.action_link);
  if (!tokenHash) {
    throw new Error("Could not extract token hash from generate_link response");
  }

  const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      token_hash: tokenHash,
    }),
  });
  if (!verifyResponse.ok) {
    const body = await verifyResponse.text();
    throw new Error(`verify failed (${verifyResponse.status}): ${body}`);
  }

  const verifyPayload = (await verifyResponse.json()) as {
    access_token?: string | null;
  };
  const accessToken = verifyPayload.access_token || "";
  if (!accessToken) {
    throw new Error("No access_token in verify response");
  }
  return accessToken;
}

async function notifyInviteFailureByMessage(
  user: { id: string; name?: string | null },
  email: string,
  errorMessage: string,
) {
  const conversationId = `server-alert-${user.id}`;
  const content = `Server notice: We could not send an invite email to ${email}.\n\n${getInviteEmailFailureUserMessage(errorMessage)}`;
  try {
    const messageId = await db.createMessage({
      senderId: SERVER_USER_ID,
      receiverId: user.id,
      conversationId,
      content,
      messageType: "system",
    });

    notifyNewMessage(
      conversationId,
      {
        id: messageId,
        senderId: SERVER_USER_ID,
        senderName: "Server",
        receiverId: user.id,
        content,
        conversationId,
      },
      [user.id],
    );
    notifyBadgeCounts([user.id]);
    await sendPushToUsers([user.id], {
      title: "Server notice",
      body: "Invite email failed. Open messages for details.",
      data: {
        type: "message",
        conversationId,
        senderId: SERVER_USER_ID,
        senderName: "Server",
      },
    });
  } catch (notifyError) {
    console.error(
      "[Invite] Failed to send server failure message",
      notifyError,
    );
  }
}

async function createSponsoredProductBonuses(params: {
  trainerId: string;
  orderId: string;
  bundleDraftId: string | null;
  productsJson: unknown;
}) {
  try {
    const items = parseBundleProducts(params.productsJson);
    if (!items.length) return;
    const productIds = items
      .map((i) => i.productId)
      .filter(Boolean) as string[];
    if (!productIds.length) return;

    const allProducts = await db.getProducts();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    for (const item of items) {
      if (!item.productId) continue;
      const product = productMap.get(item.productId);
      if (!product?.isSponsored || !product.trainerBonus) continue;

      const bonus = Number.parseFloat(product.trainerBonus);
      if (!Number.isFinite(bonus) || bonus <= 0) continue;

      if (
        product.bonusExpiresAt &&
        new Date(product.bonusExpiresAt).getTime() < Date.now()
      )
        continue;

      const totalBonus = bonus * (item.quantity || 1);
      await db.createEarning({
        trainerId: params.trainerId,
        orderId: params.orderId,
        bundleDraftId: params.bundleDraftId,
        earningType: "bonus",
        amount: totalBonus.toFixed(2),
        status: "pending",
        notes: `Sponsored product bonus: ${product.name} (${product.sponsoredBy || "brand"}) x${item.quantity || 1}`,
      });
    }
  } catch (error) {
    logError("sponsored_bonus.creation_failed", error, {
      trainerId: params.trainerId,
      orderId: params.orderId,
    });
  }
}

function queueTrainerAssistantReply(params: {
  user: db.User;
  conversationId: string;
  prompt: string;
}) {
  const { user, conversationId, prompt } = params;
  const userId = user.id;

  setTimeout(async () => {
    const startTyping = () => {
      sendToUser(userId, {
        type: "typing_start",
        conversationId,
        userId: LOCO_ASSISTANT_USER_ID,
        userName: LOCO_ASSISTANT_NAME,
      });
    };
    const stopTyping = () => {
      sendToUser(userId, {
        type: "typing_stop",
        conversationId,
        userId: LOCO_ASSISTANT_USER_ID,
      });
    };

    startTyping();
    const keepAlive = setInterval(startTyping, 2500);

    try {
      if (!["trainer", "manager", "coordinator"].includes(user.role)) {
        const unsupportedMessage =
          "I can automate trainer workflows right now. Switch to a trainer account to use invite and analytics tools.";
        const botMsgId = await db.createMessage({
          senderId: LOCO_ASSISTANT_USER_ID,
          receiverId: userId,
          conversationId,
          content: unsupportedMessage,
          messageType: "system",
        });
        notifyNewMessage(
          conversationId,
          {
            id: botMsgId,
            senderId: LOCO_ASSISTANT_USER_ID,
            senderName: LOCO_ASSISTANT_NAME,
            receiverId: userId,
            content: unsupportedMessage,
            conversationId,
          },
          [userId],
        );
        notifyBadgeCounts([userId]);
        return;
      }

      const history = await db.getMessagesByConversation(conversationId);
      const assistant = await runTrainerAssistant({
        trainer: user,
        prompt,
        allowMutations: true,
        conversationMessages: history,
      });

      const assistantContent =
        assistant.reply.trim() || "I’m ready to help with trainer workflows.";
      const botMsgId = await db.createMessage({
        senderId: LOCO_ASSISTANT_USER_ID,
        receiverId: userId,
        conversationId,
        content: assistantContent,
        messageType: "system",
      });

      notifyNewMessage(
        conversationId,
        {
          id: botMsgId,
          senderId: LOCO_ASSISTANT_USER_ID,
          senderName: LOCO_ASSISTANT_NAME,
          receiverId: userId,
          content: assistantContent,
          conversationId,
        },
        [userId],
      );
      notifyBadgeCounts([userId]);

      if (!isUserOnline(userId)) {
        await sendPushToUsers([userId], {
          title: LOCO_ASSISTANT_NAME,
          body: toMessagePushBody(assistantContent, "text"),
          data: {
            type: "message",
            conversationId,
            senderId: LOCO_ASSISTANT_USER_ID,
            senderName: LOCO_ASSISTANT_NAME,
          },
        });
      }
    } catch (error) {
      logError("assistant.reply_failed", error, {
        userId,
        conversationId,
      });

      const errorContent =
        "Sorry, I wasn't able to process that request. " +
        (error instanceof Error
          ? error.message
          : "An unexpected error occurred.") +
        " Please try again.";
      try {
        const errorMsgId = await db.createMessage({
          senderId: LOCO_ASSISTANT_USER_ID,
          receiverId: userId,
          conversationId,
          content: errorContent,
          messageType: "system",
        });
        notifyNewMessage(
          conversationId,
          {
            id: errorMsgId,
            senderId: LOCO_ASSISTANT_USER_ID,
            senderName: LOCO_ASSISTANT_NAME,
            receiverId: userId,
            content: errorContent,
            conversationId,
          },
          [userId],
        );
        notifyBadgeCounts([userId]);
      } catch (notifyError) {
        logError("assistant.error_reply_failed", notifyError, {
          userId,
          conversationId,
        });
      }
    } finally {
      clearInterval(keepAlive);
      stopTyping();
    }
  }, 200);
}

function notFound(resource: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${resource} not found` });
}

function forbidden(message: string): never {
  throw new TRPCError({ code: "FORBIDDEN", message });
}

function assertTrainerOwned(
  user: { id: string; role: string },
  trainerId: string | null | undefined,
  resource: string,
) {
  if (!trainerId) notFound(resource);
  if (trainerId !== user.id && !isManagerLikeRole(user.role)) {
    forbidden(`You do not have access to this ${resource}`);
  }
}

function assertSubscriptionAccess(
  user: { id: string; role: string },
  subscription: { trainerId: string; clientId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (subscription.trainerId === user.id || subscription.clientId === user.id)
    return;
  forbidden("You do not have access to this subscription");
}

function assertOrderAccess(
  user: { id: string; role: string },
  order: { trainerId: string | null; clientId: string | null },
) {
  if (isManagerLikeRole(user.role)) return;
  if (order.trainerId === user.id || order.clientId === user.id) return;
  forbidden("You do not have access to this order");
}

function assertOrderManageAccess(
  user: { id: string; role: string },
  order: { trainerId: string | null },
) {
  if (isManagerLikeRole(user.role)) return;
  if (order.trainerId === user.id) return;
  forbidden("You do not have permission to modify this order");
}

function assertDeliveryAccess(
  user: { id: string; role: string },
  delivery: { trainerId: string; clientId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (delivery.trainerId === user.id || delivery.clientId === user.id) return;
  forbidden("You do not have access to this delivery");
}

function assertDeliveryManageAccess(
  user: { id: string; role: string },
  delivery: { trainerId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (delivery.trainerId === user.id) return;
  forbidden("You do not have permission to modify this delivery");
}

function assertDeliveryClientAccess(
  user: { id: string; role: string },
  delivery: { clientId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (delivery.clientId === user.id) return;
  forbidden("You do not have permission to modify this delivery");
}

function assertMessageAccess(
  user: { id: string; role: string },
  message: { senderId: string; receiverId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (message.senderId === user.id || message.receiverId === user.id) return;
  forbidden("You do not have access to this message");
}

function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === "object") {
    const maybeItems = (value as { items?: unknown }).items;
    return Array.isArray(maybeItems) ? (maybeItems as T[]) : [];
  }
  return [];
}

function parseBundleProducts(productsJson: unknown) {
  const parsed = toArray<Record<string, any>>(productsJson)
    .map((product, index) => {
      const name = String(
        product.name ||
          product.title ||
          product.productName ||
          product.label ||
          "",
      ).trim();
      const quantityRaw = Number(product.quantity ?? product.qty ?? 1);
      const quantity =
        Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      const source = String(product.source || "").trim() === "custom" ||
        Boolean(product.customProductId)
        ? "custom"
        : "catalog";
      const productId = product.productId
        ? String(product.productId)
        : undefined;
      const customProductId = product.customProductId
        ? String(product.customProductId)
        : undefined;
      const price = String(product.price || "0").trim() || "0";
      const imageUrl = typeof product.imageUrl === "string" ? product.imageUrl : null;
      const fulfillmentMethod = String(
        product.fulfillmentMethod ||
          (source === "custom" ? "trainer_delivery" : ""),
      ).trim() || null;
      if (!name) return null;
      return {
        id: String(product.id ?? productId ?? index),
        source,
        productId,
        customProductId,
        name,
        price,
        imageUrl,
        fulfillmentMethod,
        quantity,
      };
    })
    .filter((item) => item !== null) as Array<{
      id: string;
      source: "catalog" | "custom";
      productId?: string;
      customProductId?: string;
      name: string;
      price: string;
      imageUrl: string | null;
      fulfillmentMethod: string | null;
      quantity: number;
    }>;
  return parsed;
}

function parseBundleServices(servicesJson: unknown) {
  return toArray<Record<string, any>>(servicesJson)
    .map((service, index) => {
      const name = String(
        service.name || service.title || service.serviceName || "",
      ).trim();
      const sessionsRaw = Number(
        service.sessions ?? service.quantity ?? service.count ?? 1,
      );
      const sessions =
        Number.isFinite(sessionsRaw) && sessionsRaw > 0 ? sessionsRaw : 1;
      if (!name) return null;
      return {
        id: String(service.id ?? index),
        name,
        sessions,
      };
    })
    .filter((item): item is { id: string; name: string; sessions: number } =>
      Boolean(item),
    );
}

type TrainerPayoutBankDetails = {
  accountHolderName: string;
  bankName: string;
  sortCode: string;
  accountNumber: string;
  accountNumberLast4: string;
  connectedAt: string;
  updatedAt: string;
};

type TrainerGoogleCalendarIntegration = {
  connected: boolean;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
};

function toObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function toSanitizedDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getTrainerPayoutBankDetails(
  metadataRaw: unknown,
): TrainerPayoutBankDetails | null {
  const metadata = toObjectRecord(metadataRaw);
  const payout = toObjectRecord(metadata.payout);
  const bank = toObjectRecord(payout.bank);

  const accountHolderName = String(bank.accountHolderName || "").trim();
  const bankName = String(bank.bankName || "").trim();
  const sortCode = toSanitizedDigits(String(bank.sortCode || ""));
  const accountNumber = toSanitizedDigits(String(bank.accountNumber || ""));
  const accountNumberLast4 = String(
    bank.accountNumberLast4 || accountNumber.slice(-4) || "",
  ).trim();
  const connectedAt = String(bank.connectedAt || "").trim();
  const updatedAt = String(bank.updatedAt || "").trim();

  if (
    !accountHolderName ||
    !bankName ||
    sortCode.length !== 6 ||
    accountNumber.length < 6 ||
    !connectedAt
  ) {
    return null;
  }

  return {
    accountHolderName,
    bankName,
    sortCode,
    accountNumber,
    accountNumberLast4: accountNumberLast4 || accountNumber.slice(-4),
    connectedAt,
    updatedAt: updatedAt || connectedAt,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function applyPayoutKycStatusTimestamps(
  current: db.TrainerPayoutOnboarding | undefined,
  status: PayoutKycStatus,
  nowIso: string,
) {
  const next: Partial<db.InsertTrainerPayoutOnboarding> = {};
  if (status === "details_submitted") {
    next.submittedAt = current?.submittedAt || nowIso;
  }
  if (status === "verification_required") {
    next.kycLinkSentAt = current?.kycLinkSentAt || nowIso;
  }
  if (
    status === "under_review" ||
    status === "active" ||
    status === "more_information_required" ||
    status === "verification_failed" ||
    status === "account_rejected"
  ) {
    next.kycSubmittedAt = current?.kycSubmittedAt || nowIso;
  }
  if (status === "under_review") {
    next.underReviewAt = current?.underReviewAt || nowIso;
  }
  if (status === "active") {
    next.approvedAt = current?.approvedAt || nowIso;
    next.activeAt = current?.activeAt || nowIso;
  }
  if (status === "more_information_required") {
    next.additionalInfoRequiredAt = current?.additionalInfoRequiredAt || nowIso;
  }
  if (status === "verification_failed" || status === "account_rejected") {
    next.rejectedAt = current?.rejectedAt || nowIso;
  }
  return next;
}

async function ensureTrainerPayoutOnboardingRecord(
  trainer: db.User,
): Promise<db.TrainerPayoutOnboarding | undefined> {
  const existing = await db.getTrainerPayoutOnboarding(trainer.id);
  if (existing) return existing;
  const payoutBank = getTrainerPayoutBankDetails(trainer.metadata);
  if (!payoutBank) return undefined;
  const nowIso =
    payoutBank.connectedAt || payoutBank.updatedAt || new Date().toISOString();
  const onboarding = await db.upsertTrainerPayoutOnboarding({
    trainerId: trainer.id,
    status: "active",
    approvedAt: nowIso,
    activeAt: nowIso,
    currentStepNote: "Migrated from legacy payout setup.",
    blockingReason: null,
  });
  if (onboarding) {
    await db.createTrainerPayoutOnboardingEvent({
      onboardingId: onboarding.id,
      trainerId: trainer.id,
      eventType: "legacy_migrated",
      previousStatus: null,
      nextStatus: "active",
      note: "Migrated from legacy payout setup.",
      createdBy: trainer.id,
    });
  }
  return onboarding;
}

async function getTrainerPayoutOnboardingBundle(trainerId: string) {
  const trainer = await db.getUserById(trainerId);
  if (!trainer) notFound("Trainer");
  const payoutBank = getTrainerPayoutBankDetails(trainer.metadata);
  const onboarding = await ensureTrainerPayoutOnboardingRecord(trainer);
  const details = onboarding
    ? await db.getTrainerPayoutOnboardingDetails(trainerId)
    : undefined;
  const events = onboarding
    ? await db.listTrainerPayoutOnboardingEvents({
        trainerId,
        onboardingId: onboarding.id,
        limit: 50,
      })
    : [];
  const status = normalizePayoutKycStatus(onboarding?.status || "start_setup");
  return {
    trainer,
    payoutBank,
    onboarding: onboarding || null,
    details: details || null,
    events,
    status,
    statusLabel: getPayoutKycStatusLabel(status),
    canEditIntake: canEditPayoutKycIntake(status),
    canRequestPayments: isPayoutKycPaymentEnabled(status) || Boolean(payoutBank),
  };
}

const payoutOnboardingIntakeSchema = z
  .object({
    accountHolderType: z.enum(PAYOUT_KYC_ACCOUNT_HOLDER_TYPES),
    organizationName: z.string().trim().max(120).optional().nullable(),
    countryOfRegistration: z.string().trim().max(120).optional().nullable(),
    firstName: z.string().trim().max(120).optional().nullable(),
    lastName: z.string().trim().max(120).optional().nullable(),
    country: z.string().trim().max(120).optional().nullable(),
    contactEmail: z.string().trim().max(160).optional().nullable(),
    contactPhone: z.string().trim().max(40).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const contactEmail = normalizeOptionalText(value.contactEmail);
    if (!contactEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactEmail"],
        message: "Email address is required.",
      });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contactEmail"],
        message: "Enter a valid email address.",
      });
    }
    if (value.accountHolderType === "organization") {
      if (!normalizeOptionalText(value.organizationName)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["organizationName"],
          message: "Organization name is required.",
        });
      }
      if (!isSupportedCountry(value.countryOfRegistration || "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["countryOfRegistration"],
          message: "Select a valid country or region of registration.",
        });
      }
      return;
    }
    if (!normalizeOptionalText(value.firstName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["firstName"],
        message: "First name is required.",
      });
    }
    if (!normalizeOptionalText(value.lastName)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lastName"],
        message: "Last name is required.",
      });
    }
    if (!isSupportedCountry(value.country || "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["country"],
        message: "Select a valid country or region.",
      });
    }
  });

async function saveTrainerPayoutOnboardingIntake(params: {
  trainerId: string;
  performedBy: string;
  input: z.infer<typeof payoutOnboardingIntakeSchema>;
  resetStatusToSubmitted: boolean;
  eventType: db.TrainerPayoutOnboardingEventType;
}) {
  const trainer = await db.getUserById(params.trainerId);
  if (!trainer) notFound("Trainer");
  const current = await db.getTrainerPayoutOnboarding(params.trainerId);
  const nowIso = new Date().toISOString();
  const nextStatus: PayoutKycStatus =
    params.resetStatusToSubmitted || !current
      ? "details_submitted"
      : normalizePayoutKycStatus(current.status);
  const currentStepNote =
    nextStatus === "details_submitted"
      ? "Submitted to Bright.Blue for manual Adyen setup."
      : current?.currentStepNote || "Payout onboarding details updated.";
  const onboarding = await db.upsertTrainerPayoutOnboarding({
    trainerId: params.trainerId,
    accountHolderType: params.input.accountHolderType,
    status: nextStatus,
    currentStepNote,
    blockingReason:
      nextStatus === "details_submitted" ? null : current?.blockingReason || null,
    createdBy: current?.createdBy || params.performedBy,
    updatedBy: params.performedBy,
    ...applyPayoutKycStatusTimestamps(current, nextStatus, nowIso),
  });
  if (!onboarding) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Unable to save payout onboarding.",
    });
  }
  await db.upsertTrainerPayoutOnboardingDetails({
    onboardingId: onboarding.id,
    trainerId: params.trainerId,
    organizationName:
      params.input.accountHolderType === "organization"
        ? normalizeOptionalText(params.input.organizationName)
        : null,
    countryOfRegistration:
      params.input.accountHolderType === "organization"
        ? normalizeOptionalText(params.input.countryOfRegistration)
        : null,
    firstName:
      params.input.accountHolderType === "individual"
        ? normalizeOptionalText(params.input.firstName)
        : null,
    lastName:
      params.input.accountHolderType === "individual"
        ? normalizeOptionalText(params.input.lastName)
        : null,
    country:
      params.input.accountHolderType === "individual"
        ? normalizeOptionalText(params.input.country)
        : null,
    contactEmail: normalizeOptionalText(params.input.contactEmail),
    contactPhone: normalizeOptionalText(params.input.contactPhone),
  });
  await db.createTrainerPayoutOnboardingEvent({
    onboardingId: onboarding.id,
    trainerId: params.trainerId,
    eventType: params.eventType,
    previousStatus: current?.status || null,
    nextStatus,
    note: currentStepNote,
    metadata: {
      accountHolderType: params.input.accountHolderType,
    },
    createdBy: params.performedBy,
  });
  await db.logUserActivity({
    targetUserId: params.trainerId,
    performedBy: params.performedBy,
    action:
      params.eventType === "submitted"
        ? "payout_kyc_submitted"
        : "payout_kyc_details_updated",
    previousValue: current?.status || "none",
    newValue: nextStatus,
    notes: `account_holder_type:${params.input.accountHolderType}`,
  });
  const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
  if (managerIds.length > 0) {
    await sendPushToUsers(managerIds, {
      title:
        params.eventType === "submitted"
          ? "New payout onboarding"
          : "Payout onboarding updated",
      body:
        params.eventType === "submitted"
          ? `${trainer.name || trainer.email || "A trainer"} submitted payout onboarding details.`
          : `${trainer.name || trainer.email || "A trainer"} updated payout onboarding details.`,
      data: {
        type: "payout_kyc_submission",
        trainerId: params.trainerId,
        status: nextStatus,
      },
    });
  }
  return getTrainerPayoutOnboardingBundle(params.trainerId);
}

function getGoogleCalendarIntegration(
  metadataRaw: unknown,
): TrainerGoogleCalendarIntegration | null {
  const metadata = toObjectRecord(metadataRaw);
  const google = toObjectRecord(metadata.googleCalendar);
  const accessToken = String(google.accessToken || "").trim();
  const refreshTokenRaw = String(google.refreshToken || "").trim();
  const expiresAtRaw = String(google.expiresAt || "").trim();
  const selectedCalendarIdRaw = String(google.selectedCalendarId || "").trim();
  const selectedCalendarNameRaw = String(
    google.selectedCalendarName || "",
  ).trim();
  if (!accessToken) return null;
  return {
    connected: true,
    accessToken,
    refreshToken: refreshTokenRaw || null,
    expiresAt: expiresAtRaw || null,
    selectedCalendarId: selectedCalendarIdRaw || null,
    selectedCalendarName: selectedCalendarNameRaw || null,
  };
}

function isIsoExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return false;
  return expiresMs <= Date.now() + 30_000;
}

async function ensureGoogleCalendarAccessToken(user: db.User): Promise<{
  token: string;
  metadata: Record<string, unknown>;
  integration: TrainerGoogleCalendarIntegration;
}> {
  const metadata = toObjectRecord(user.metadata);
  const integration = getGoogleCalendarIntegration(metadata);
  if (!integration) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Google Calendar is not connected.",
    });
  }

  if (!isIsoExpired(integration.expiresAt)) {
    return { token: integration.accessToken, metadata, integration };
  }

  if (!integration.refreshToken) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Google Calendar token expired. Reconnect your Google account.",
    });
  }

  const refreshed = await googleCalendar.refreshGoogleCalendarAccessToken(
    integration.refreshToken,
  );
  const nextMetadata = {
    ...metadata,
    googleCalendar: {
      ...toObjectRecord(metadata.googleCalendar),
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || integration.refreshToken,
      expiresAt: refreshed.expiresAt,
      updatedAt: new Date().toISOString(),
      selectedCalendarId: integration.selectedCalendarId,
      selectedCalendarName: integration.selectedCalendarName,
    },
  };
  await db.updateUser(user.id, { metadata: nextMetadata });
  return {
    token: refreshed.accessToken,
    metadata: nextMetadata,
    integration: {
      ...integration,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || integration.refreshToken,
      expiresAt: refreshed.expiresAt,
    },
  };
}

type OrderPaymentProvision = {
  required: boolean;
  configured: boolean;
  provisioned: boolean;
  paymentLink: string | null;
  merchantReference: string | null;
  expiresAt: string | null;
};

async function provisionOrderPaymentLink(input: {
  orderId: string;
  requestedBy: string;
  payerId: string | null;
  amountMinor: number;
  shopperEmail?: string | null;
  description?: string | null;
}): Promise<OrderPaymentProvision> {
  if (input.amountMinor <= 0) {
    return {
      required: false,
      configured: adyen.isAdyenConfigured(),
      provisioned: false,
      paymentLink: null,
      merchantReference: null,
      expiresAt: null,
    };
  }

  if (!adyen.isAdyenConfigured()) {
    return {
      required: true,
      configured: false,
      provisioned: false,
      paymentLink: null,
      merchantReference: null,
      expiresAt: null,
    };
  }

  try {
    const merchantReference = adyen.generateMerchantReference("ORD");
    const link = await adyen.createPaymentLink({
      amountMinor: input.amountMinor,
      currency: "GBP",
      merchantReference,
      description: input.description || `Order ${input.orderId}`,
      shopperEmail: input.shopperEmail || undefined,
      expiresInMinutes: 60,
    });

    await db.createPaymentSession({
      adyenSessionId: link.id,
      merchantReference,
      requestedBy: input.requestedBy,
      payerId: input.payerId,
      amountMinor: input.amountMinor,
      currency: "GBP",
      description: input.description || `Order ${input.orderId}`,
      method: "link",
      status: "created",
      orderId: input.orderId,
      paymentLink: link.url,
      expiresAt: link.expiresAt
        ? new Date(link.expiresAt).toISOString()
        : undefined,
      metadata: {
        source: "order_checkout",
      },
    });

    return {
      required: true,
      configured: true,
      provisioned: true,
      paymentLink: link.url || null,
      merchantReference,
      expiresAt: link.expiresAt ? String(link.expiresAt) : null,
    };
  } catch (error) {
    console.error("[Payments] Failed to provision order payment link:", error);
    return {
      required: true,
      configured: true,
      provisioned: false,
      paymentLink: null,
      merchantReference: null,
      expiresAt: null,
    };
  }
}

function parseBundleGoals(goalsJson: unknown): string[] {
  return toArray<any>(goalsJson)
    .map((goal) => {
      if (typeof goal === "string") return goal.trim();
      if (goal && typeof goal === "object") {
        return String(
          (goal as Record<string, any>).name ||
            (goal as Record<string, any>).title ||
            "",
        ).trim();
      }
      return "";
    })
    .filter((goal) => goal.length > 0);
}

function normalizeLookupKey(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function safePositiveInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function computeBundleProgress(
  subscription: db.Subscription,
  bundle: db.BundleDraft | undefined,
  deliveredQtyByProductName?: Map<string, number>,
) {
  const sessionsFromSubscription = safePositiveInt(
    subscription.sessionsIncluded,
  );
  const sessionsFromServices = parseBundleServices(bundle?.servicesJson).reduce(
    (sum, service) => sum + safePositiveInt(service.sessions),
    0,
  );
  const sessionsFromGoals = safePositiveInt(
    bundle && bundle.goalsJson && typeof bundle.goalsJson === "object"
      ? (bundle.goalsJson as Record<string, unknown>).sessionCount
      : 0,
  );
  const sessionsIncluded =
    sessionsFromSubscription || sessionsFromServices || sessionsFromGoals;
  const sessionsUsed = Math.max(0, safePositiveInt(subscription.sessionsUsed));

  const plannedProducts = parseBundleProducts(bundle?.productsJson);
  const productsIncluded = plannedProducts.reduce(
    (sum, product) => sum + safePositiveInt(product.quantity || 1),
    0,
  );
  const productsUsed = plannedProducts.reduce((sum, product) => {
    const key = normalizeLookupKey(product.name);
    const deliveredQty = deliveredQtyByProductName?.get(key) || 0;
    return sum + Math.max(0, deliveredQty);
  }, 0);

  const sessionsProgressPct =
    sessionsIncluded > 0
      ? Math.min(100, Math.round((sessionsUsed / sessionsIncluded) * 100))
      : 0;
  const productsProgressPct =
    productsIncluded > 0
      ? Math.min(100, Math.round((productsUsed / productsIncluded) * 100))
      : 0;
  const sessionsRemaining = Math.max(sessionsIncluded - sessionsUsed, 0);
  const productsRemaining = Math.max(productsIncluded - productsUsed, 0);
  const alerts: string[] = [];

  if (sessionsIncluded > 0) {
    if (sessionsUsed >= sessionsIncluded) alerts.push("Sessions exhausted");
    else if (sessionsUsed / sessionsIncluded >= 0.8)
      alerts.push("Sessions are running low");
  }
  if (productsIncluded > 0) {
    if (productsUsed >= productsIncluded) alerts.push("Products exhausted");
    else if (productsUsed / productsIncluded >= 0.8)
      alerts.push("Products are running low");
  }
  if (sessionsUsed > 0 && productsUsed > sessionsUsed + 1) {
    alerts.push("Product usage is outpacing sessions");
  }

  return {
    subscriptionId: subscription.id,
    bundleDraftId: subscription.bundleDraftId || null,
    bundleTitle: bundle?.title || "Current bundle",
    status: subscription.status || "active",
    sessionsUsed,
    sessionsIncluded,
    sessionsRemaining,
    sessionsProgressPct,
    productsUsed,
    productsIncluded,
    productsRemaining,
    productsProgressPct,
    alerts,
  };
}

function toDeliveryMethod(
  fulfillment?: "home_ship" | "trainer_delivery" | "vending" | "cafeteria",
): "in_person" | "locker" | "front_desk" | "shipped" {
  switch (fulfillment) {
    case "home_ship":
      return "shipped";
    case "vending":
      return "locker";
    case "cafeteria":
      return "front_desk";
    default:
      return "in_person";
  }
}

async function resolveCatalogProductReference(id: string) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return undefined;
  const direct = await db.getProductById(normalizedId);
  if (direct) return direct;
  if (/^\d+$/.test(normalizedId)) {
    return db.getProductByShopifyProductId(Number(normalizedId));
  }
  return undefined;
}

const PROPOSAL_CADENCE_CODES = ["weekly", "2x_week", "3x_week", "daily"] as const;

const proposalCadenceSchema = z.enum(PROPOSAL_CADENCE_CODES);

const proposalItemInputSchema = z.object({
  itemType: z.enum(["bundle", "product", "custom_product", "service"]),
  title: z.string().min(1),
  description: z.string().optional(),
  bundleDraftId: z.string().optional(),
  productId: z.string().optional(),
  customProductId: z.string().optional(),
  imageUrl: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0).default(0),
  fulfillmentMethod: z
    .enum(["home_ship", "trainer_delivery", "vending", "cafeteria"])
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

type ProposalItemInputRecord = z.infer<typeof proposalItemInputSchema>;

function toMoneyNumber(value: string | number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toProposalItemInput(
  item: db.SavedCartProposalItem,
): ProposalItemInput {
  return {
    itemType: item.itemType as ProposalItemInput["itemType"],
    title: item.title,
    description: item.description,
    bundleDraftId: item.bundleDraftId,
    productId: item.productId,
    customProductId: item.customProductId,
    imageUrl: item.imageUrl,
    quantity: item.quantity,
    unitPrice: toMoneyNumber(item.unitPrice),
    fulfillmentMethod: item.fulfillmentMethod,
    metadata:
      item.metadata && typeof item.metadata === "object"
        ? (item.metadata as Record<string, unknown>)
        : null,
  };
}

function toProposalDbItem(
  proposalId: string,
  item: ProposalItemInput,
  index: number,
): db.InsertSavedCartProposalItem {
  return {
    proposalId,
    sortOrder: index,
    itemType: item.itemType,
    bundleDraftId: item.bundleDraftId || null,
    productId: item.productId || null,
    customProductId: item.customProductId || null,
    title: item.title,
    description: item.description || null,
    imageUrl: item.imageUrl || null,
    quantity: item.quantity,
    unitPrice: toMoneyNumber(item.unitPrice).toFixed(2),
    fulfillmentMethod:
      item.itemType === "service" ? null : item.fulfillmentMethod || "trainer_delivery",
    metadata: item.metadata || null,
  };
}

async function normalizeProposalItemsForTrainer(
  trainerId: string,
  items: ProposalItemInputRecord[],
): Promise<ProposalItemInput[]> {
  return Promise.all(
    items.map(async (item) => {
      if (item.itemType === "bundle") {
        const bundle = item.bundleDraftId
          ? await db.getBundleDraftById(item.bundleDraftId)
          : null;
        if (!bundle) notFound("Bundle");
        if (!bundle.trainerId || bundle.trainerId !== trainerId) {
          forbidden("You can only use your own published bundles in proposals");
        }
        if (bundle.status !== "published") {
          forbidden("Only published bundles can be used as proposal bases");
        }
        return {
          itemType: "bundle",
          title: bundle.title,
          description: bundle.description,
          bundleDraftId: bundle.id,
          imageUrl: bundle.imageUrl,
          quantity: 1,
          unitPrice: toMoneyNumber(bundle.price),
          fulfillmentMethod: "trainer_delivery",
          metadata: {
            ...(item.metadata || {}),
            cadence: bundle.cadence,
            includedProducts: parseBundleProducts(bundle.productsJson),
            includedServices: parseBundleServices(bundle.servicesJson),
            includedGoals: parseBundleGoals(bundle.goalsJson),
            discountType: bundle.discountType,
            discountValue: bundle.discountValue,
          },
        };
      }

      if (item.itemType === "product") {
        const product = item.productId
          ? await resolveCatalogProductReference(item.productId)
          : null;
        if (!product) notFound("Product");
        return {
          itemType: "product",
          title: product.name,
          description: product.description,
          productId: product.id,
          imageUrl: product.imageUrl,
          quantity: item.quantity,
          unitPrice: toMoneyNumber(product.price),
          fulfillmentMethod: item.fulfillmentMethod || "home_ship",
          metadata: {
            ...(item.metadata || {}),
            shopifyProductId: product.shopifyProductId,
            shopifyVariantId: product.shopifyVariantId,
            brand: product.brand,
            category: product.category,
          },
        };
      }

      if (item.itemType === "custom_product") {
        const customProduct = item.customProductId
          ? await db.getTrainerCustomProductById(item.customProductId)
          : null;
        if (!customProduct) notFound("Custom product");
        if (customProduct.trainerId !== trainerId) {
          forbidden("You can only use your own custom products in proposals");
        }
        return {
          itemType: "custom_product",
          title: customProduct.name,
          description: customProduct.description,
          customProductId: customProduct.id,
          imageUrl: customProduct.imageUrl,
          quantity: item.quantity,
          unitPrice: toMoneyNumber(customProduct.price),
          fulfillmentMethod: item.fulfillmentMethod || customProduct.fulfillmentMethod,
          metadata: item.metadata || null,
        };
      }

      return {
        itemType: "service",
        title: item.title,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: toMoneyNumber(item.unitPrice),
        fulfillmentMethod: null,
        metadata: {
          ...(item.metadata || {}),
          sessions:
            Number(
              (item.metadata as Record<string, unknown> | undefined)?.sessions ??
                item.quantity,
            ) || item.quantity,
        },
      };
    }),
  );
}

function readPlanFieldsFromProposalMetadata(metadata: unknown): {
  programWeeks: number | null;
  sessionCost: number | null;
  sessionDurationMinutes: number | null;
} {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const programWeeks =
    typeof meta.programWeeks === "number" && meta.programWeeks > 0
      ? Math.floor(meta.programWeeks)
      : null;
  const sessionCost =
    typeof meta.sessionCost === "number" &&
    Number.isFinite(meta.sessionCost) &&
    meta.sessionCost >= 0
      ? meta.sessionCost
      : null;
  const sessionDurationMinutes =
    typeof meta.sessionDurationMinutes === "number" && meta.sessionDurationMinutes > 0
      ? Math.floor(meta.sessionDurationMinutes)
      : null;
  return { programWeeks, sessionCost, sessionDurationMinutes };
}

async function buildSavedCartSnapshotFromRecord(
  proposal: db.SavedCartProposal,
  items?: db.SavedCartProposalItem[],
): Promise<SavedCartProposalSnapshot> {
  const proposalItems =
    items ?? (await db.getSavedCartProposalItems(proposal.id));
  const normalizedItems = proposalItems.map((item) => toProposalItemInput(item));
  const planFields = readPlanFieldsFromProposalMetadata(proposal.metadata);
  return buildSavedCartProposalSnapshot({
    title: proposal.title,
    notes: proposal.notes,
    baseBundleDraftId: proposal.baseBundleDraftId,
    startDate: proposal.startDate,
    cadenceCode: proposal.cadenceCode as ProposalCadenceCode,
    sessionsPerWeek: proposal.sessionsPerWeek,
    timePreference: proposal.timePreference,
    programWeeks: planFields.programWeeks,
    sessionCost: planFields.sessionCost,
    sessionDurationMinutes: planFields.sessionDurationMinutes,
    items: normalizedItems,
  });
}

async function ensureBaseBundleProposalItem(
  baseBundleDraftId: string | null | undefined,
  items: ProposalItemInputRecord[],
): Promise<ProposalItemInputRecord[]> {
  if (!baseBundleDraftId) return items;
  const hasBundleItem = items.some(
    (item) => item.itemType === "bundle" && item.bundleDraftId === baseBundleDraftId,
  );
  if (hasBundleItem) return items;
  return [
    {
      itemType: "bundle",
      title: "Selected Bundle",
      bundleDraftId: baseBundleDraftId,
      quantity: 1,
      unitPrice: 0,
    },
    ...items,
  ];
}

function toSubscriptionTypeFromCadenceCode(
  cadenceCode: string | null | undefined,
): "weekly" | "monthly" | "yearly" {
  const normalized = normalizeCadenceCode(cadenceCode);
  if (normalized === "daily" || normalized === "2x_week" || normalized === "3x_week") {
    return "weekly";
  }
  return "weekly";
}

async function ensureTrainerClientRecord(params: {
  trainerId: string;
  user: db.User;
  invitation: db.Invitation;
}): Promise<db.Client> {
  const { trainerId, user, invitation } = params;
  let clientRecord = await db.getClientByTrainerAndUser(trainerId, user.id);
  if (!clientRecord) {
    const clientId = await db.createClient({
      trainerId,
      userId: user.id,
      name: user.name || invitation.name || "Client",
      email: user.email || invitation.email,
      phone: user.phone,
      photoUrl: user.photoUrl,
      status: "active",
      invitedAt: invitation.createdAt,
      acceptedAt: new Date().toISOString(),
    });
    clientRecord = await db.getClientById(clientId);
  } else if (clientRecord.status !== "active") {
    await db.updateClient(clientRecord.id, {
      status: "active",
      acceptedAt: new Date().toISOString(),
    });
    clientRecord = await db.getClientById(clientRecord.id);
  }
  if (!clientRecord) notFound("Client relationship");
  return clientRecord;
}

async function createOrderFromProposalSnapshot(params: {
  user: db.User;
  invitation: db.Invitation;
  proposal: db.SavedCartProposal | null;
  snapshot: SavedCartProposalSnapshot;
  trainerId: string;
  clientRecord: db.Client;
  attributionId?: string | null;
  shippingAmount?: number;
  taxAmount?: number;
  cartDiff?: ReturnType<typeof diffProposalSnapshots>;
}): Promise<{
  orderId: string;
  deliveryIds: string[];
  subscriptionId: string | null;
  payment: OrderPaymentProvision;
}> {
  const {
    user,
    invitation,
    proposal,
    snapshot,
    trainerId,
    clientRecord,
    attributionId = null,
    shippingAmount = 0,
    taxAmount = 0,
    cartDiff,
  } = params;

  const subtotalAmount = snapshot.pricing.subtotalAmount;
  const totalAmount = subtotalAmount + shippingAmount + taxAmount;
  const paymentStatus = totalAmount > 0 ? "pending" : "paid";

  const orderId = await db.createOrder({
    clientId: user.id,
    trainerId,
    customerEmail: user.email || invitation.email,
    customerName: user.name || invitation.name || clientRecord.name,
    totalAmount: totalAmount.toFixed(2),
    subtotalAmount: subtotalAmount.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    shippingAmount: shippingAmount.toFixed(2),
    status: "pending",
    paymentStatus,
    fulfillmentStatus: "unfulfilled",
    fulfillmentMethod: "trainer_delivery",
    attributionId,
    savedCartProposalId: proposal?.id || null,
    proposalSnapshotJson: snapshot,
    cartDiffJson: cartDiff || null,
    orderData: {
      source: "saved_cart_proposal_checkout",
      invitationId: invitation.id,
      bundleDraftId: snapshot.baseBundleDraftId,
      paymentRequired: totalAmount > 0,
      cadenceCode: snapshot.cadenceCode,
      sessionsPerWeek: snapshot.sessionsPerWeek,
      timePreference: snapshot.timePreference,
    },
  });

  const deliveryIds: string[] = [];
  for (const item of snapshot.items) {
    const lineTotal = item.unitPrice * item.quantity;
    const orderItemId = await db.createOrderItem({
      orderId,
      productId: item.productId || null,
      bundleDraftId: item.bundleDraftId || null,
      customProductId: item.customProductId || null,
      itemType: item.itemType,
      name: item.title,
      imageUrl: item.imageUrl || null,
      quantity: item.quantity,
      price: item.unitPrice.toFixed(2),
      totalPrice: lineTotal.toFixed(2),
      fulfillmentStatus: "unfulfilled",
      metadata: item.metadata || null,
    });

    if (item.itemType === "bundle") {
      const includedProducts = Array.isArray(
        (item.metadata as Record<string, unknown> | null)?.includedProducts,
      )
        ? ((item.metadata as Record<string, unknown>).includedProducts as Array<Record<string, unknown>>)
        : [];

      for (const includedProduct of includedProducts) {
        const lineQuantityRaw = Number(includedProduct.quantity ?? 1);
        const lineQuantity =
          Number.isFinite(lineQuantityRaw) && lineQuantityRaw > 0
            ? Math.floor(lineQuantityRaw) * Math.max(1, item.quantity)
            : Math.max(1, item.quantity);
        const lineUnitPrice = toMoneyNumber(String(includedProduct.price || "0"));
        const deliveryId = await db.createDelivery({
          orderId,
          orderItemId,
          trainerId,
          clientId: user.id,
          productId:
            typeof includedProduct.productId === "string"
              ? includedProduct.productId
              : null,
          customProductId:
            typeof includedProduct.customProductId === "string"
              ? includedProduct.customProductId
              : null,
          productName: String(includedProduct.name || item.title),
          productImageUrl:
            typeof includedProduct.imageUrl === "string"
              ? includedProduct.imageUrl
              : null,
          unitPrice: lineUnitPrice.toFixed(2),
          quantity: lineQuantity,
          status: "pending",
          deliveryMethod: toDeliveryMethod(
            ((includedProduct.fulfillmentMethod as
              | "home_ship"
              | "trainer_delivery"
              | "vending"
              | "cafeteria"
              | undefined) || "trainer_delivery"),
          ),
        });
        deliveryIds.push(deliveryId);
      }
      continue;
    }

    if (item.itemType === "service") {
      continue;
    }

    const deliveryId = await db.createDelivery({
      orderId,
      orderItemId,
      trainerId,
      clientId: user.id,
      productId: item.productId || null,
      customProductId: item.customProductId || null,
      productName: item.title,
      productImageUrl: item.imageUrl || null,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity,
      status: "pending",
      deliveryMethod: toDeliveryMethod(
        (item.fulfillmentMethod as
          | "home_ship"
          | "trainer_delivery"
          | "vending"
          | "cafeteria"
          | undefined) || "trainer_delivery",
      ),
    });
    deliveryIds.push(deliveryId);
  }

  let subscriptionId: string | null = null;
  if (snapshot.projectedSchedule.length > 0) {
    subscriptionId = await db.createSubscription({
      clientId: clientRecord.id,
      trainerId,
      bundleDraftId: snapshot.baseBundleDraftId,
      price: subtotalAmount.toFixed(2),
      subscriptionType: toSubscriptionTypeFromCadenceCode(snapshot.cadenceCode),
      sessionsIncluded: snapshot.projectedSchedule.length,
      sessionsUsed: 0,
      startDate:
        snapshot.startDate || snapshot.projectedSchedule[0]?.startsAt || new Date().toISOString(),
    });

    for (const session of snapshot.projectedSchedule) {
      await db.createSession({
        clientId: clientRecord.id,
        trainerId,
        subscriptionId,
        sessionDate: session.startsAt,
        sessionType: "training",
        status: "scheduled",
        notes: session.timePreference
          ? `Projected session (${session.timePreference})`
          : "Projected session",
      });
    }
  }

  const payment = await provisionOrderPaymentLink({
    orderId,
    requestedBy: user.id,
    payerId: user.id,
    amountMinor: Math.round(totalAmount * 100),
    shopperEmail: user.email,
    description: `Saved cart order ${orderId}`,
  });

  if (snapshot.baseBundleDraftId) {
    const baseBundle = await db.getBundleDraftById(snapshot.baseBundleDraftId);
    if (baseBundle) {
      await createSponsoredProductBonuses({
        trainerId,
        orderId,
        bundleDraftId: baseBundle.id,
        productsJson: baseBundle.productsJson,
      });
    }
  }

  if (proposal?.id) {
    await db.updateSavedCartProposal(proposal.id, {
      status: "purchased",
      purchasedAt: new Date().toISOString(),
      acceptedOrderId: orderId,
    });
  }

  return { orderId, deliveryIds, subscriptionId, payment };
}

export const appRouter = router({
  system: systemRouter,

  // ============================================================================
  // AUTH
  // ============================================================================
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    inviteRegistrationContext: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const token = String(input.token || "").trim();
        if (!token) return null;

        const userInvitation = await db.getUserInvitationByToken(token);
        if (userInvitation) {
          const expiresAtMs = new Date(userInvitation.expiresAt).getTime();
          const isExpired =
            Number.isFinite(expiresAtMs) && expiresAtMs < Date.now();
          const status =
            isExpired && userInvitation.status === "pending"
              ? "expired"
              : userInvitation.status;
          return {
            source: "user_invitation" as const,
            email: userInvitation.email || null,
            name: userInvitation.name || null,
            role: userInvitation.role || null,
            status,
            expiresAt: userInvitation.expiresAt || null,
          };
        }

        const trainerInvitation = await db.getInvitationByToken(token);
        if (!trainerInvitation) return null;
        const expiresAtMs = new Date(trainerInvitation.expiresAt).getTime();
        const isExpired =
          Number.isFinite(expiresAtMs) && expiresAtMs < Date.now();
        const status =
          isExpired && trainerInvitation.status === "pending"
            ? "expired"
            : trainerInvitation.status;
        return {
          source: "trainer_invitation" as const,
          email: trainerInvitation.email || null,
          name: trainerInvitation.name || null,
          role: null,
          status,
          expiresAt: trainerInvitation.expiresAt || null,
        };
      }),
    acceptUserInvitation: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const invitation = await db.getUserInvitationByToken(input.token);
        if (!invitation) {
          return { matched: false, applied: false } as const;
        }

        const now = Date.now();
        const expiresAtMs = new Date(invitation.expiresAt).getTime();
        if (Number.isFinite(expiresAtMs) && expiresAtMs < now) {
          if (invitation.status === "pending") {
            await db.updateUserInvitation(invitation.id, { status: "expired" });
          }
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invitation has expired. Ask for a new invite.",
          });
        }

        if (
          invitation.status === "revoked" ||
          invitation.status === "expired"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `This invitation is ${invitation.status}.`,
          });
        }

        if (invitation.status === "accepted") {
          if (
            invitation.acceptedByUserId &&
            invitation.acceptedByUserId !== ctx.user.id
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message:
                "This invitation has already been accepted by another user.",
            });
          }
          await db.updateUserRole(ctx.user.id, invitation.role);
          return {
            matched: true,
            applied: true,
            alreadyAccepted: true,
            role: invitation.role,
          } as const;
        }

        // Token possession is sufficient proof — no strict email match required.
        // The user arrived through the invite link itself.
        await db.updateUserRole(ctx.user.id, invitation.role);
        await db.updateUserInvitation(invitation.id, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          acceptedByUserId: ctx.user.id,
        });
        await db.revokeOtherPendingUserInvitationsByEmail(
          invitation.email,
          invitation.id,
        );
        await db.logUserActivity({
          targetUserId: ctx.user.id,
          performedBy: invitation.invitedBy,
          action: "role_changed",
          previousValue: ctx.user.role || "shopper",
          newValue: invitation.role,
          notes: `Applied invited role via token for ${ctx.user.email || "unknown email"}`,
        });

        return {
          matched: true,
          applied: true,
          alreadyAccepted: false,
          role: invitation.role,
        } as const;
      }),
  }),

  // ============================================================================
  // MCP (OpenClaw / remote tool connection bootstrap)
  // ============================================================================
  mcp: router({
    createOpenClawConnection: trainerProcedure.mutation(async ({ ctx }) => {
      const requestToken = extractBearerTokenFromRequest(ctx.req);
      if (!requestToken) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Missing bearer token in the current session.",
        });
      }

      const mcpUrl = toAbsoluteRequestUrl(ctx.req, "/mcp");
      const serverName = "locomotivate-trainer";
      const endpointKeyRequired = Boolean(
        String(process.env.LOCO_MCP_AUTH_TOKEN || "").trim(),
      );
      const endpointKeyPlaceholder = "${LOCO_MCP_AUTH_TOKEN}";

      let userAccessToken = requestToken;
      let tokenSource: "session" | "minted" = "session";

      const userEmail = String(ctx.user.email || "").trim();
      if (userEmail) {
        try {
          userAccessToken = await mintSupabaseAccessTokenForEmail(userEmail);
          tokenSource = "minted";
        } catch (error) {
          logError("mcp.openclaw.token_mint_failed", error, {
            userId: ctx.user.id,
            userEmail,
          });
        }
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${userAccessToken}`,
      };
      if (endpointKeyRequired) {
        headers["X-LOCO-MCP-KEY"] = endpointKeyPlaceholder;
      }

      const mcporterCommandParts = [
        `mcporter config add ${serverName} ${mcpUrl}`,
        "--scope home",
      ];
      if (endpointKeyRequired) {
        mcporterCommandParts.push(
          `--header X-LOCO-MCP-KEY='${endpointKeyPlaceholder}'`,
        );
      }
      mcporterCommandParts.push(
        `--header Authorization='Bearer ${userAccessToken}'`,
      );
      mcporterCommandParts.push('--description "Locomotivate trainer MCP"');

      const mcporterConfigJson = JSON.stringify(
        {
          mcpServers: {
            [serverName]: {
              description: "Locomotivate trainer MCP",
              baseUrl: mcpUrl,
              headers,
            },
          },
        },
        null,
        2,
      );

      return {
        serverName,
        mcpUrl,
        endpointKeyRequired,
        endpointKeyHeader: "X-LOCO-MCP-KEY",
        endpointKeyPlaceholder,
        userBearerHeader: "Authorization",
        userEmail: userEmail || null,
        userAccessToken,
        userAccessTokenExpiresAt: decodeJwtExpiryIso(userAccessToken),
        tokenSource,
        generatedAt: new Date().toISOString(),
        mcporterCommandTemplate: mcporterCommandParts.join(" "),
        mcporterConfigJsonTemplate: mcporterConfigJson,
      };
    }),
  }),

  // ============================================================================
  // CATALOG (Public bundle browsing)
  // ============================================================================
  catalog: router({
    bundles: publicProcedure.query(async () => {
      return db.getPublishedBundles();
    }),

    bundleDetail: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return db.getBundleDraftById(input.id);
      }),

    campaignByShareSlug: publicProcedure
      .input(z.object({ slug: z.string().min(3).max(160) }))
      .query(async ({ input }) => {
        const bundle = await db.getTemplateBundleByPublicShareSlug(input.slug);
        if (!bundle) return null;
        const links = await db.getCampaignAccountsForTemplate(bundle.id);
        const accountIds = Array.from(
          new Set(links.map((link) => link.campaignAccountId).filter(Boolean)),
        );
        const accounts = await db.getCampaignAccountsByIds(accountIds);
        const accountById = new Map(accounts.map((account) => [account.id, account]));
        const brands = links
          .filter((link) => link.relationType === "brand")
          .map((link) => accountById.get(link.campaignAccountId)?.name)
          .filter((name): name is string => Boolean(name));
        const customers = links
          .filter((link) => link.relationType !== "brand")
          .map((link) => accountById.get(link.campaignAccountId)?.name)
          .filter((name): name is string => Boolean(name));
        return {
          id: bundle.id,
          title: bundle.title,
          description: bundle.description,
          imageUrl: bundle.imageUrl,
          price: bundle.price,
          publicShareSlug: bundle.publicShareSlug,
          publicShareEnabled: bundle.publicShareEnabled,
          brands,
          customers,
          updatedAt: bundle.updatedAt,
        };
      }),

    /** All bundles including archived/draft - coordinator/manager only */
    allBundles: managerProcedure.query(async () => {
      return db.getAllBundles();
    }),

    /** Change bundle status - coordinator/manager only */
    setBundleStatus: managerProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(["published", "archived", "draft"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateBundleDraft(input.id, { status: input.status });
        return { success: true };
      }),

    trainers: publicProcedure.query(async () => {
      return db.getTrainers();
    }),

    trainerProfile: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return db.getUserById(input.id);
      }),

    trainerBySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(async ({ input }) => {
        const trainer = await db.getTrainerByUsername(input.slug);
        if (!trainer) return null;
        return {
          id: trainer.id,
          name: trainer.name,
          username: trainer.username,
          photoUrl: trainer.photoUrl,
          bio: trainer.bio,
          specialties: trainer.specialties,
          socialLinks: trainer.socialLinks,
        };
      }),

    products: publicProcedure.query(async () => {
      // Always serve from local database. Shopify sync happens separately.
      return db.getProducts();
    }),

    collections: publicProcedure.query(async () => {
      const collections = await db.getCollections(true);
      return collections.map((c) => ({
        id: c.shopifyCollectionId,
        title: c.title,
        handle: c.handle,
        imageUrl: c.imageUrl,
        channels: c.channels || [],
        updatedAt: c.syncedAt || null,
        productIds: c.productIds || [],
      }));
    }),

    searchProducts: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return db.searchProducts(input.query);
      }),

    invitation: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const invitation = await db.getInvitationByToken(input.token);
        if (!invitation) return null;

        const trainer = invitation.trainerId
          ? await db.getUserById(invitation.trainerId)
          : undefined;
        const bundle = invitation.bundleDraftId
          ? await db.getBundleDraftById(invitation.bundleDraftId)
          : undefined;

        const products = parseBundleProducts(bundle?.productsJson);
        const services = parseBundleServices(bundle?.servicesJson);
        const goals = parseBundleGoals(bundle?.goalsJson);
        const bundlePrice = Number.parseFloat(String(bundle?.price ?? "0"));

        const expiresAt = invitation.expiresAt
          ? new Date(invitation.expiresAt)
          : null;
        const isExpired = Boolean(
          expiresAt && expiresAt.getTime() < Date.now(),
        );

        const proposalSnapshot =
          invitation.proposalSnapshotJson &&
          typeof invitation.proposalSnapshotJson === "object"
            ? (invitation.proposalSnapshotJson as SavedCartProposalSnapshot)
            : null;

        if (proposalSnapshot) {
          const baseBundle = proposalSnapshot.baseBundleDraftId
            ? await db.getBundleDraftById(proposalSnapshot.baseBundleDraftId)
            : null;

          const baseBundleItem = proposalSnapshot.items.find(
            (item) => item.itemType === "bundle",
          );

          const derivedProducts = proposalSnapshot.items
            .filter(
              (item) =>
                item.itemType === "product" || item.itemType === "custom_product",
            )
            .map((item, index) => ({
              id: `${item.itemType}-${index}`,
              name: item.title,
              quantity: item.quantity,
              productId: item.productId || item.customProductId || undefined,
              imageUrl: item.imageUrl || null,
            }));

          const derivedServices = proposalSnapshot.items
            .filter((item) => item.itemType === "service")
            .map((item, index) => ({
              id: `${item.itemType}-${index}`,
              name: item.title,
              sessions: Number(
                (item.metadata as Record<string, unknown> | null)?.sessions ??
                  item.quantity,
              ) || item.quantity,
            }));

          const derivedGoals = Array.isArray(
            (baseBundleItem?.metadata as Record<string, unknown> | null)
              ?.includedGoals,
          )
            ? (
                (baseBundleItem?.metadata as Record<string, unknown>)
                  .includedGoals as unknown[]
              )
                .map((goal) => String(goal || "").trim())
                .filter(Boolean)
            : [];

          return {
            id: invitation.id,
            token: invitation.token,
            trainerId: invitation.trainerId,
            trainerName: trainer?.name || "Trainer",
            trainerAvatar: trainer?.photoUrl || null,
            invitationType: "saved_cart_proposal" as const,
            savedCartProposalId: invitation.savedCartProposalId,
            bundleId: proposalSnapshot.baseBundleDraftId || null,
            bundleTitle:
              baseBundle?.title ||
              proposalSnapshot.title ||
              "Saved Cart Proposal",
            bundleDescription:
              baseBundle?.description ||
              proposalSnapshot.notes ||
              "",
            bundlePrice: proposalSnapshot.pricing.totalAmount,
            bundleDuration: proposalSnapshot.cadenceCode || "program",
            products: derivedProducts,
            services: derivedServices,
            goals: derivedGoals,
            personalMessage: invitation.personalMessage || null,
            proposalSnapshot,
            status:
              isExpired && invitation.status === "pending"
                ? "expired"
                : invitation.status || "pending",
            expiresAt: invitation.expiresAt,
            email: invitation.email,
          };
        }

        return {
          id: invitation.id,
          token: invitation.token,
          trainerId: invitation.trainerId,
          trainerName: trainer?.name || "Trainer",
          trainerAvatar: trainer?.photoUrl || null,
          bundleId: bundle?.id || null,
          bundleTitle: bundle?.title || "Bundle Invitation",
          bundleDescription: bundle?.description || "",
          bundlePrice: Number.isFinite(bundlePrice) ? bundlePrice : 0,
          bundleDuration: bundle?.cadence || "program",
          products,
          services,
          goals,
          personalMessage: invitation.personalMessage || null,
          invitationType: "bundle" as const,
          savedCartProposalId: invitation.savedCartProposalId || null,
          proposalSnapshot: null,
          status:
            isExpired && invitation.status === "pending"
              ? "expired"
              : invitation.status || "pending",
          expiresAt: invitation.expiresAt,
          email: invitation.email,
        };
      }),

    acceptInvitation: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (isManagerLikeRole(ctx.user.role) || ctx.user.role === "trainer") {
          forbidden("Only shoppers and clients can accept invitations");
        }

        const invitation = await db.getInvitationByToken(input.token);
        if (!invitation) notFound("Invitation");
        if (invitation.status && invitation.status !== "pending") {
          forbidden(`Invitation has already been ${invitation.status}`);
        }

        const expiresAt = new Date(invitation.expiresAt);
        if (expiresAt.getTime() < Date.now()) {
          await db.updateInvitation(invitation.id, { status: "expired" });
          forbidden("Invitation has expired");
        }

        if (ctx.user.email && invitation.email) {
          const invitedEmail = invitation.email.trim().toLowerCase();
          const signedInEmail = ctx.user.email.trim().toLowerCase();
          if (invitedEmail !== signedInEmail) {
            forbidden("Signed-in account does not match the invited email");
          }
        }

        const bundle = invitation.bundleDraftId
          ? await db.getBundleDraftById(invitation.bundleDraftId)
          : undefined;
        if (!bundle) notFound("Bundle");
        if (bundle.status !== "published") {
          forbidden("This bundle is not currently available for purchase");
        }
        const trainerId = invitation.trainerId || bundle.trainerId;
        if (!trainerId) notFound("Trainer");

        let clientRecord = await db.getClientByTrainerAndUser(
          trainerId,
          ctx.user.id,
        );
        if (!clientRecord) {
          const clientId = await db.createClient({
            trainerId,
            userId: ctx.user.id,
            name: ctx.user.name || invitation.name || "Client",
            email: ctx.user.email || invitation.email,
            phone: ctx.user.phone,
            photoUrl: ctx.user.photoUrl,
            status: "active",
            invitedAt: invitation.createdAt,
            acceptedAt: new Date().toISOString(),
          });
          clientRecord = await db.getClientById(clientId);
        } else if (clientRecord.status !== "active") {
          await db.updateClient(clientRecord.id, {
            status: "active",
            acceptedAt: new Date().toISOString(),
          });
          clientRecord = await db.getClientById(clientRecord.id);
        }
        if (!clientRecord) notFound("Client relationship");

        let attributionId: string | null = null;
        try {
          attributionId = await db.upsertAttribution({
            customerId: ctx.user.id,
            trainerId,
            source: "invitation_acceptance",
            metadata: { invitationId: invitation.id, bundleDraftId: bundle?.id },
          });
        } catch { /* attribution is best-effort */ }

        const amount = Number.parseFloat(String(bundle.price || "0"));
        const safeAmount = Number.isFinite(amount) ? amount : 0;
        const subtotal = safeAmount;
        const tax = 0;
        const shipping = 0;
        const total = subtotal + tax + shipping;
        const paymentStatus = total > 0 ? "pending" : "paid";

        const orderId = await db.createOrder({
          clientId: ctx.user.id,
          trainerId,
          customerEmail: ctx.user.email || invitation.email,
          customerName: ctx.user.name || invitation.name || "Client",
          totalAmount: total.toFixed(2),
          subtotalAmount: subtotal.toFixed(2),
          taxAmount: tax.toFixed(2),
          shippingAmount: shipping.toFixed(2),
          status: "pending",
          paymentStatus,
          fulfillmentStatus: "unfulfilled",
          fulfillmentMethod: "trainer_delivery",
          attributionId,
          orderData: {
            source: "invitation_acceptance",
            invitationId: invitation.id,
            bundleDraftId: bundle.id,
            paymentRequired: total > 0,
          },
        });

        const bundleProducts = parseBundleProducts(bundle.productsJson);
        const orderLineItems: Array<{
          id: string;
          name: string;
          quantity: number;
          price?: string;
          productId?: string;
          customProductId?: string;
          imageUrl?: string | null;
          fulfillmentMethod?: string | null;
        }> =
          bundleProducts.length > 0
            ? bundleProducts
            : [
                {
                  id: "bundle",
                  name: bundle.title,
                  quantity: 1,
                  productId: undefined,
                },
              ];

        const deliveryIds: string[] = [];
        for (const lineItem of orderLineItems) {
          const lineUnitPriceRaw = Number.parseFloat(
            String((lineItem as any).price || safeAmount),
          );
          const lineUnitPrice =
            Number.isFinite(lineUnitPriceRaw) && lineUnitPriceRaw >= 0
              ? lineUnitPriceRaw
              : safeAmount;
          const lineTotal = lineUnitPrice * lineItem.quantity;
          await db.createOrderItem({
            orderId,
            productId: lineItem.productId,
            name: lineItem.name,
            quantity: lineItem.quantity,
            price: lineUnitPrice.toFixed(2),
            totalPrice: lineTotal.toFixed(2),
            fulfillmentStatus: "unfulfilled",
          });

          if (lineItem.productId || bundleProducts.length > 0) {
            const deliveryId = await db.createDelivery({
              orderId,
              trainerId,
              clientId: ctx.user.id,
              productId: lineItem.productId,
              customProductId: (lineItem as any).customProductId || null,
              productName: lineItem.name,
              productImageUrl: (lineItem as any).imageUrl || null,
              unitPrice: lineUnitPrice.toFixed(2),
              quantity: lineItem.quantity,
              status: "pending",
              deliveryMethod: toDeliveryMethod(
                ((lineItem as any).fulfillmentMethod as any) || "trainer_delivery",
              ),
            });
            deliveryIds.push(deliveryId);
          }
        }

        let subscriptionId: string | null = null;
        if (bundle.cadence && bundle.cadence !== "one_time") {
          const sessionsFromServices = parseBundleServices(
            bundle.servicesJson,
          ).reduce((sum, service) => sum + service.sessions, 0);
          const goals =
            bundle.goalsJson && typeof bundle.goalsJson === "object"
              ? (bundle.goalsJson as Record<string, unknown>)
              : {};
          const sessionsFromGoalRaw = Number(goals.sessionCount ?? 0);
          const sessionsFromGoal =
            Number.isFinite(sessionsFromGoalRaw) && sessionsFromGoalRaw > 0
              ? Math.floor(sessionsFromGoalRaw)
              : 0;
          const sessionsIncluded =
            sessionsFromGoal || sessionsFromServices || 0;
          subscriptionId = await db.createSubscription({
            clientId: clientRecord.id,
            trainerId,
            bundleDraftId: bundle.id,
            price: safeAmount.toFixed(2),
            subscriptionType: bundle.cadence,
            sessionsIncluded,
            sessionsUsed: 0,
            startDate: new Date().toISOString(),
          });
        }

        await db.updateInvitation(invitation.id, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          acceptedByUserId: ctx.user.id,
        });

        const payment = await provisionOrderPaymentLink({
          orderId,
          requestedBy: ctx.user.id,
          payerId: ctx.user.id,
          amountMinor: Math.round(total * 100),
          shopperEmail: ctx.user.email,
          description: `Invitation order ${orderId}`,
        });

        await createSponsoredProductBonuses({
          trainerId,
          orderId,
          bundleDraftId: bundle.id,
          productsJson: bundle.productsJson,
        });

        notifyBadgeCounts([ctx.user.id, trainerId]);
        return { success: true, orderId, deliveryIds, subscriptionId, payment };
      }),

    declineInvitation: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const invitation = await db.getInvitationByToken(input.token);
        if (!invitation) {
          return { success: true };
        }

        if (invitation.status === "accepted") {
          forbidden("Accepted invitations cannot be declined");
        }

        if (invitation.status === "pending") {
          await db.updateInvitation(invitation.id, { status: "declined" });
        }

        return { success: true };
      }),
  }),

  // ============================================================================
  // BUNDLES (Trainer bundle management)
  // ============================================================================
  bundles: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getBundleDraftsByTrainer(ctx.user.id);
    }),

    get: trainerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) return undefined;
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        return bundle;
      }),

    create: trainerProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          templateId: z.string().optional(),
          price: z.string().optional(),
          cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
          goalsJson: z.any().optional(),
          servicesJson: z.any().optional(),
          productsJson: z.any().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        let productsJson = input.productsJson;
        let servicesJson = input.servicesJson;
        let goalsJson = input.goalsJson;
        let price = input.price;
        let description = input.description;
        let persistedTemplateId: string | undefined;

        if (input.templateId) {
          const promotedTemplate = await db.getBundleDraftById(input.templateId);
          if (promotedTemplate) {
            persistedTemplateId = input.templateId;
            // Copy template data if trainer didn't provide their own
            if (!productsJson) productsJson = promotedTemplate.productsJson;
            if (!servicesJson) servicesJson = promotedTemplate.servicesJson;
            if (!goalsJson) goalsJson = promotedTemplate.goalsJson;
            if (!price) price = promotedTemplate.price ?? undefined;
            if (!description) description = promotedTemplate.description ?? undefined;
          } else {
            const legacyTemplate = await db.getBundleTemplateById(input.templateId);
            if (legacyTemplate) {
              if (!productsJson) productsJson = legacyTemplate.defaultProducts;
              if (!servicesJson) servicesJson = legacyTemplate.defaultServices;
              if (!goalsJson) goalsJson = legacyTemplate.goalsJson;
              if (!price) price = legacyTemplate.basePrice ?? legacyTemplate.minPrice ?? undefined;
              if (!description) description = legacyTemplate.description ?? undefined;
            }
          }

          if (persistedTemplateId) {
            await db.incrementTemplateUsage(persistedTemplateId);
          }
        }

        const bundleId = await db.createBundleDraft({
          trainerId: ctx.user.id,
          title: input.title,
          description,
          templateId: persistedTemplateId,
          price,
          cadence: input.cadence,
          goalsJson,
          servicesJson,
          productsJson,
        });
        if (persistedTemplateId) {
          await db.copyCampaignAccountsFromTemplateToBundle({
            templateBundleId: persistedTemplateId,
            bundleDraftId: bundleId,
          });
        }
        return bundleId;
      }),

    update: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          price: z.string().optional(),
          cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
          imageUrl: z.string().optional(),
          goalsJson: z.any().optional(),
          servicesJson: z.any().optional(),
          productsJson: z.any().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        const { id, ...data } = input;
        await db.updateBundleDraft(id, data);
        return { success: true };
      }),

    submitForReview: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        await db.updateBundleDraft(input.id, {
          status: "pending_review",
          submittedForReviewAt: new Date().toISOString(),
        });
        const managerIds = await db.getUserIdsByRoles([
          "manager",
          "coordinator",
        ]);
        const links = getBundleReviewLinks(input.id);
        const message = [
          `Review requested for bundle "${bundle.title || "Untitled Bundle"}".`,
          "Please review content, pricing, and included items.",
          `Bundle: ${links.webUrl}`,
          `App: ${links.deepLink}`,
        ].join("\n");
        await sendBundleReviewThreadMessage({
          senderId: ctx.user.id,
          senderName: ctx.user.name || "Trainer",
          receiverIds: managerIds,
          bundleId: input.id,
          content: message,
        });
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    respondToReview: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          response: z.string().min(1),
          resubmit: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        if (
          bundle.status !== "changes_requested" &&
          bundle.status !== "pending_review"
        ) {
          forbidden("Bundle is not in an active review state");
        }

        const managerIds = await db.getUserIdsByRoles([
          "manager",
          "coordinator",
        ]);
        const reviewReceivers =
          bundle.reviewedBy && bundle.reviewedBy.length > 0
            ? [bundle.reviewedBy]
            : managerIds;

        const links = getBundleReviewLinks(input.id);
        const message = [
          `Trainer response for "${bundle.title || "Untitled Bundle"}":`,
          input.response.trim(),
          `Bundle: ${links.webUrl}`,
          `App: ${links.deepLink}`,
        ].join("\n\n");

        await sendBundleReviewThreadMessage({
          senderId: ctx.user.id,
          senderName: ctx.user.name || "Trainer",
          receiverIds: reviewReceivers,
          bundleId: input.id,
          content: message,
        });

        if (input.resubmit) {
          await db.updateBundleDraft(input.id, {
            status: "pending_review",
            submittedForReviewAt: new Date().toISOString(),
          });
        }

        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    templates: trainerProcedure.query(async () => {
      const [legacyTemplates, promotedBundles] = await Promise.all([
        db.getBundleTemplates(),
        db.getPromotedTemplates(),
      ]);

      const allProducts = await db.getProducts();
      const productBonusMap = new Map<
        string,
        { bonus: number; sponsoredBy: string | null; expiresAt: string | null }
      >();
      for (const p of allProducts) {
        if (p.isSponsored && p.trainerBonus) {
          const bonus = Number.parseFloat(p.trainerBonus);
          if (bonus > 0) {
            const expired =
              p.bonusExpiresAt &&
              new Date(p.bonusExpiresAt).getTime() < Date.now();
            if (!expired) {
              productBonusMap.set(p.id, {
                bonus,
                sponsoredBy: p.sponsoredBy,
                expiresAt: p.bonusExpiresAt,
              });
            }
          }
        }
      }

      function calcTotalBonus(productsJson: unknown): number {
        const items = parseBundleProducts(productsJson);
        let total = 0;
        for (const item of items) {
          if (item.productId && productBonusMap.has(item.productId)) {
            total +=
              productBonusMap.get(item.productId)!.bonus * (item.quantity || 1);
          }
        }
        return total;
      }

      const promotedAsTpl = promotedBundles.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        goalType: null as string | null,
        goalsJson: b.goalsJson,
        imageUrl: b.imageUrl,
        basePrice: b.price,
        minPrice: null as string | null,
        maxPrice: null as string | null,
        rulesJson: null,
        defaultServices: b.servicesJson,
        defaultProducts: b.productsJson,
        active: b.templateActive,
        usageCount: 0,
        createdBy: b.trainerId,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        discountType: b.discountType,
        discountValue: b.discountValue,
        availabilityStart: b.availabilityStart,
        availabilityEnd: b.availabilityEnd,
        templateVisibility: b.templateVisibility,
        isPromoted: true,
        totalTrainerBonus: calcTotalBonus(b.productsJson),
      }));

      return [
        ...legacyTemplates.map((t) => ({ ...t, isPromoted: false })),
        ...promotedAsTpl,
      ];
    }),

    delete: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        if (
          bundle.status === "pending_review" ||
          bundle.status === "publishing"
        ) {
          forbidden(
            "Cannot delete a bundle while it is under review or publishing",
          );
        }
        await db.deleteBundleDraft(input.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // SAVED CART PROPOSALS
  // ============================================================================
  savedCartProposals: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      const proposals = await db.listSavedCartProposalsByTrainer(ctx.user.id);
      return Promise.all(
        proposals.map(async (proposal) => {
          const items = await db.getSavedCartProposalItems(proposal.id);
          const snapshot = await buildSavedCartSnapshotFromRecord(proposal, items);
          return {
            ...proposal,
            itemCount: items.length,
            snapshot,
          };
        }),
      );
    }),

    get: trainerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const proposal = await db.getSavedCartProposalById(input.id);
        if (!proposal) notFound("Saved cart proposal");
        if (proposal.trainerId !== ctx.user.id) {
          forbidden("You do not have access to this saved cart proposal");
        }
        const items = await db.getSavedCartProposalItems(proposal.id);
        const snapshot = await buildSavedCartSnapshotFromRecord(proposal, items);
        return {
          ...proposal,
          items,
          snapshot,
        };
      }),

    create: trainerProcedure
      .input(
        z.object({
          clientRecordId: z.string().optional(),
          baseBundleDraftId: z.string().optional(),
          title: z.string().optional(),
          notes: z.string().optional(),
          assistantPrompt: z.string().optional(),
          source: z.enum(["manual", "assistant"]).optional(),
          startDate: z.string().optional(),
          cadenceCode: proposalCadenceSchema.optional(),
          sessionsPerWeek: z.number().int().min(1).max(7).optional(),
          timePreference: z.string().optional(),
          programWeeks: z.number().int().min(1).max(104).optional(),
          sessionCost: z.number().min(0).optional().nullable(),
          sessionDurationMinutes: z.number().int().min(15).max(480).optional(),
          items: z.array(proposalItemInputSchema).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const clientRecord = input.clientRecordId
          ? await db.getClientById(input.clientRecordId)
          : null;
        if (input.clientRecordId && !clientRecord) {
          notFound("Client");
        }
        if (clientRecord && clientRecord.trainerId !== ctx.user.id) {
          forbidden("You can only build proposals for your own clients");
        }

        const rawItems = await ensureBaseBundleProposalItem(
          input.baseBundleDraftId,
          input.items,
        );
        const items = await normalizeProposalItemsForTrainer(ctx.user.id, rawItems);
        const programWeeks = input.programWeeks ?? 12;
        const sessionDurationMinutes = input.sessionDurationMinutes ?? 60;
        const sessionCost =
          input.sessionCost != null &&
          Number.isFinite(input.sessionCost) &&
          input.sessionCost >= 0
            ? input.sessionCost
            : null;
        const snapshot = buildSavedCartProposalSnapshot({
          title: input.title || clientRecord?.name || null,
          notes: input.notes || null,
          baseBundleDraftId: input.baseBundleDraftId || null,
          startDate: input.startDate || null,
          cadenceCode: input.cadenceCode || "weekly",
          sessionsPerWeek:
            input.sessionsPerWeek ??
            cadenceToSessionsPerWeek(input.cadenceCode || "weekly"),
          timePreference: input.timePreference || null,
          programWeeks,
          sessionCost,
          sessionDurationMinutes,
          items,
        });

        const proposalId = await db.createSavedCartProposal({
          trainerId: ctx.user.id,
          clientRecordId: clientRecord?.id || null,
          clientUserId: clientRecord?.userId || null,
          clientEmail: clientRecord?.email || null,
          clientName: clientRecord?.name || null,
          baseBundleDraftId: input.baseBundleDraftId || null,
          title: input.title || clientRecord?.name || "Saved Cart",
          notes: input.notes || null,
          assistantPrompt: input.assistantPrompt || null,
          source: input.source || "manual",
          status: "draft",
          startDate: snapshot.startDate,
          cadenceCode: snapshot.cadenceCode,
          sessionsPerWeek: snapshot.sessionsPerWeek,
          timePreference: snapshot.timePreference,
          projectedScheduleJson: snapshot.projectedSchedule,
          projectedDeliveryJson: snapshot.projectedDeliveries,
          subtotalAmount: snapshot.pricing.subtotalAmount.toFixed(2),
          discountAmount: snapshot.pricing.discountAmount.toFixed(2),
          totalAmount: snapshot.pricing.totalAmount.toFixed(2),
          currency: snapshot.pricing.currency,
          metadata: mergeSavedCartProposalPlanMetadata(null, {
            programWeeks: snapshot.programWeeks ?? programWeeks,
            sessionCost: snapshot.sessionCost ?? sessionCost,
            sessionDurationMinutes:
              snapshot.sessionDurationMinutes ?? sessionDurationMinutes,
          }),
        });

        await db.replaceSavedCartProposalItems(
          proposalId,
          items.map((item, index) => toProposalDbItem(proposalId, item, index)),
        );

        return { proposalId, snapshot };
      }),

    update: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          clientRecordId: z.string().optional(),
          baseBundleDraftId: z.string().optional(),
          title: z.string().optional(),
          notes: z.string().optional(),
          assistantPrompt: z.string().optional(),
          source: z.enum(["manual", "assistant"]).optional(),
          startDate: z.string().optional(),
          cadenceCode: proposalCadenceSchema.optional(),
          sessionsPerWeek: z.number().int().min(1).max(7).optional(),
          timePreference: z.string().optional(),
          programWeeks: z.number().int().min(1).max(104).optional(),
          sessionCost: z.number().min(0).optional().nullable(),
          sessionDurationMinutes: z.number().int().min(15).max(480).optional(),
          items: z.array(proposalItemInputSchema).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const proposal = await db.getSavedCartProposalById(input.id);
        if (!proposal) notFound("Saved cart proposal");
        if (proposal.trainerId !== ctx.user.id) {
          forbidden("You do not have access to this saved cart proposal");
        }

        const clientRecord = input.clientRecordId
          ? await db.getClientById(input.clientRecordId)
          : proposal.clientRecordId
            ? await db.getClientById(proposal.clientRecordId)
            : null;
        if (input.clientRecordId && !clientRecord) notFound("Client");
        if (clientRecord && clientRecord.trainerId !== ctx.user.id) {
          forbidden("You can only build proposals for your own clients");
        }

        const rawItems = await ensureBaseBundleProposalItem(
          input.baseBundleDraftId ?? proposal.baseBundleDraftId,
          input.items,
        );
        const items = await normalizeProposalItemsForTrainer(ctx.user.id, rawItems);
        const prevPlan = readPlanFieldsFromProposalMetadata(proposal.metadata);
        const programWeeks =
          input.programWeeks !== undefined ? input.programWeeks : prevPlan.programWeeks ?? 12;
        const sessionDurationMinutes =
          input.sessionDurationMinutes !== undefined
            ? input.sessionDurationMinutes
            : prevPlan.sessionDurationMinutes ?? 60;
        const sessionCost =
          input.sessionCost !== undefined
            ? input.sessionCost
            : prevPlan.sessionCost ?? null;
        const snapshot = buildSavedCartProposalSnapshot({
          title: input.title ?? proposal.title,
          notes: input.notes ?? proposal.notes,
          baseBundleDraftId:
            input.baseBundleDraftId ?? proposal.baseBundleDraftId,
          startDate: input.startDate ?? proposal.startDate,
          cadenceCode:
            input.cadenceCode ??
            (proposal.cadenceCode as ProposalCadenceCode),
          sessionsPerWeek:
            input.sessionsPerWeek ?? proposal.sessionsPerWeek,
          timePreference: input.timePreference ?? proposal.timePreference,
          programWeeks,
          sessionCost:
            sessionCost != null && Number.isFinite(sessionCost) && sessionCost >= 0
              ? sessionCost
              : null,
          sessionDurationMinutes,
          items,
        });

        await db.updateSavedCartProposal(input.id, {
          clientRecordId: clientRecord?.id || null,
          clientUserId: clientRecord?.userId || null,
          clientEmail: clientRecord?.email || null,
          clientName: clientRecord?.name || null,
          baseBundleDraftId:
            input.baseBundleDraftId ?? proposal.baseBundleDraftId,
          title: input.title ?? proposal.title,
          notes: input.notes ?? proposal.notes,
          assistantPrompt: input.assistantPrompt ?? proposal.assistantPrompt,
          source: input.source ?? proposal.source,
          startDate: snapshot.startDate,
          cadenceCode: snapshot.cadenceCode,
          sessionsPerWeek: snapshot.sessionsPerWeek,
          timePreference: snapshot.timePreference,
          projectedScheduleJson: snapshot.projectedSchedule,
          projectedDeliveryJson: snapshot.projectedDeliveries,
          subtotalAmount: snapshot.pricing.subtotalAmount.toFixed(2),
          discountAmount: snapshot.pricing.discountAmount.toFixed(2),
          totalAmount: snapshot.pricing.totalAmount.toFixed(2),
          currency: snapshot.pricing.currency,
          metadata: mergeSavedCartProposalPlanMetadata(proposal.metadata, {
            programWeeks: snapshot.programWeeks ?? programWeeks,
            sessionCost: snapshot.sessionCost ?? sessionCost ?? null,
            sessionDurationMinutes:
              snapshot.sessionDurationMinutes ?? sessionDurationMinutes,
          }),
        });

        await db.replaceSavedCartProposalItems(
          input.id,
          items.map((item, index) => toProposalDbItem(input.id, item, index)),
        );

        return { proposalId: input.id, snapshot };
      }),

    sendInvite: trainerProcedure
      .input(
        z.object({
          proposalId: z.string(),
          email: z.string().email().optional(),
          name: z.string().optional(),
          message: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const proposal = await db.getSavedCartProposalById(input.proposalId);
        if (!proposal) notFound("Saved cart proposal");
        if (proposal.trainerId !== ctx.user.id) {
          forbidden("You do not have access to this saved cart proposal");
        }

        const items = await db.getSavedCartProposalItems(proposal.id);
        const snapshot = await buildSavedCartSnapshotFromRecord(proposal, items);
        const recipientEmail = input.email || proposal.clientEmail;
        if (!recipientEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A client email is required before sending this proposal",
          });
        }

        const token = crypto.randomUUID();
        const expiresAt = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString();

        await db.createInvitation({
          trainerId: ctx.user.id,
          email: recipientEmail,
          name: input.name || proposal.clientName || null,
          token,
          bundleDraftId: proposal.baseBundleDraftId,
          savedCartProposalId: proposal.id,
          personalMessage: input.message || proposal.notes || null,
          proposalSnapshotJson: snapshot,
          expiresAt,
        });

        await db.updateSavedCartProposal(proposal.id, {
          clientEmail: recipientEmail,
          clientName: input.name || proposal.clientName || null,
          status: "invited",
          invitedAt: new Date().toISOString(),
        });

        try {
          await sendInviteEmail({
            to: recipientEmail,
            token,
            recipientName: input.name || proposal.clientName || undefined,
            trainerName: ctx.user.name || ctx.user.email || "Your trainer",
            expiresAtIso: expiresAt,
            personalMessage: input.message || proposal.notes || undefined,
          });
        } catch (error: any) {
          await notifyInviteFailureByMessage(
            ctx.user,
            recipientEmail,
            error?.message || "unknown error",
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: getInviteEmailFailureUserMessage(error),
          });
        }

        return {
          token,
          expiresAt,
          proposalId: proposal.id,
          snapshot,
        };
      }),
  }),

  // ============================================================================
  // CLIENTS (Trainer's client management)
  // ============================================================================
  clients: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      const [trainerClients, trainerSubscriptions, trainerDeliveries] =
        await Promise.all([
          db.getClientsByTrainer(ctx.user.id),
          db.getSubscriptionsByTrainer(ctx.user.id),
          db.getDeliveriesByTrainer(ctx.user.id),
        ]);

      const activeBundleCountsByClient = new Map<string, number>();
      const activeSubscriptionByClient = new Map<string, db.Subscription>();
      for (const subscription of trainerSubscriptions) {
        if (subscription.status !== "active") continue;
        activeBundleCountsByClient.set(
          subscription.clientId,
          (activeBundleCountsByClient.get(subscription.clientId) || 0) + 1,
        );
        if (!activeSubscriptionByClient.has(subscription.clientId)) {
          activeSubscriptionByClient.set(subscription.clientId, subscription);
        }
      }

      const activeBundleIds = Array.from(
        new Set(
          Array.from(activeSubscriptionByClient.values())
            .map((subscription) => subscription.bundleDraftId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const bundleById = new Map<string, db.BundleDraft>();
      if (activeBundleIds.length > 0) {
        const bundles = await Promise.all(
          activeBundleIds.map((id) => db.getBundleDraftById(id)),
        );
        for (const bundle of bundles) {
          if (bundle?.id) bundleById.set(bundle.id, bundle);
        }
      }

      const consumedDeliveriesByClientAndProduct = new Map<
        string,
        Map<string, number>
      >();
      for (const delivery of trainerDeliveries) {
        const status = String(delivery.status || "").toLowerCase();
        if (status !== "delivered" && status !== "confirmed") continue;
        const clientId = delivery.clientId;
        const productKey = normalizeLookupKey(delivery.productName);
        if (!clientId || !productKey) continue;
        const perClient =
          consumedDeliveriesByClientAndProduct.get(clientId) ||
          new Map<string, number>();
        perClient.set(
          productKey,
          (perClient.get(productKey) || 0) +
            Math.max(1, Number(delivery.quantity || 1)),
        );
        consumedDeliveriesByClientAndProduct.set(clientId, perClient);
      }

      return Promise.all(
        trainerClients.map(async (client) => {
          const [totalSpent, linkedUser] = await Promise.all([
            db.getTotalSpentByClient(client.id),
            client.userId
              ? db.getUserById(client.userId)
              : Promise.resolve(undefined),
          ]);
          const resolvedPhotoUrl =
            client.photoUrl || linkedUser?.photoUrl || null;
          const currentSubscription = activeSubscriptionByClient.get(client.id);
          const currentBundle = currentSubscription
            ? computeBundleProgress(
                currentSubscription,
                currentSubscription.bundleDraftId
                  ? bundleById.get(currentSubscription.bundleDraftId)
                  : undefined,
                consumedDeliveriesByClientAndProduct.get(client.id),
              )
            : null;
          return {
            ...client,
            photoUrl: resolvedPhotoUrl,
            activeBundles: activeBundleCountsByClient.get(client.id) || 0,
            totalSpent,
            currentBundle,
          };
        }),
      );
    }),

    get: trainerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) return undefined;
        assertTrainerOwned(ctx.user, client.trainerId, "client");
        return client;
      }),

    detail: trainerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) return undefined;
        assertTrainerOwned(ctx.user, client.trainerId, "client");

        const linkedUser = client.userId
          ? await db.getUserById(client.userId)
          : undefined;
        const resolvedPhotoUrl =
          client.photoUrl || linkedUser?.photoUrl || null;

        const [subscriptions, trainerOrders, deliveriesByClient] =
          await Promise.all([
            db.getSubscriptionsByClient(client.id),
            db.getOrdersByTrainer(ctx.user.id),
            db.getDeliveriesByClient(client.id),
          ]);

        const consumedDeliveriesByProduct = new Map<string, number>();
        for (const delivery of deliveriesByClient) {
          const status = String(delivery.status || "").toLowerCase();
          if (status !== "delivered" && status !== "confirmed") continue;
          const productKey = normalizeLookupKey(delivery.productName);
          if (!productKey) continue;
          consumedDeliveriesByProduct.set(
            productKey,
            (consumedDeliveriesByProduct.get(productKey) || 0) +
              Math.max(1, Number(delivery.quantity || 1)),
          );
        }

        const activeOffers = await Promise.all(
          subscriptions
            .filter((sub) => sub.status === "active")
            .map(async (sub) => {
              const bundle = sub.bundleDraftId
                ? await db.getBundleDraftById(sub.bundleDraftId)
                : undefined;
              const progress = computeBundleProgress(
                sub,
                bundle,
                consumedDeliveriesByProduct,
              );
              return {
                id: sub.id,
                bundleDraftId: sub.bundleDraftId || null,
                title: bundle?.title || "Bundle",
                price: sub.price,
                cadence: sub.subscriptionType || "monthly",
                status: sub.status || "active",
                sessionsUsed: progress.sessionsUsed,
                sessionsIncluded: progress.sessionsIncluded,
                sessionsRemaining: progress.sessionsRemaining,
                sessionsProgressPct: progress.sessionsProgressPct,
                productsUsed: progress.productsUsed,
                productsIncluded: progress.productsIncluded,
                productsRemaining: progress.productsRemaining,
                productsProgressPct: progress.productsProgressPct,
                alerts: progress.alerts,
              };
            }),
        );

        const paymentHistory = trainerOrders
          .filter((order) => {
            if (client.email && order.customerEmail) {
              return (
                order.customerEmail.trim().toLowerCase() ===
                client.email.trim().toLowerCase()
              );
            }
            return Boolean(
              order.customerName &&
              client.name &&
              order.customerName === client.name,
            );
          })
          .map((order) => ({
            id: order.id,
            amount: parseFloat(order.totalAmount || "0"),
            status: order.paymentStatus || "pending",
            createdAt: order.createdAt,
          }))
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );

        return {
          ...client,
          photoUrl: resolvedPhotoUrl,
          currentBundle: activeOffers[0] || null,
          activeOffers,
          paymentHistory,
        };
      }),

    create: trainerProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          goals: z.any().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return db.createClient({
          trainerId: ctx.user.id,
          name: input.name,
          email: input.email,
          phone: input.phone,
          goals: input.goals,
          notes: input.notes,
        });
      }),

    update: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().min(1).max(255).optional(),
          email: z.union([z.string().email(), z.null()]).optional(),
          phone: z.union([z.string(), z.null()]).optional(),
          goals: z.any().optional(),
          notes: z.union([z.string(), z.null()]).optional(),
          /** Includes `hidden` (see `025_client_status_hidden.sql` + `shared/client-status.ts`). */
          status: z.enum(CLIENT_STATUS_VALUES).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) notFound("Client");
        assertTrainerOwned(ctx.user, client.trainerId, "client");
        const { id, name, email, phone, goals, notes, status } = input;
        const patch: Partial<db.InsertClient> = {};
        if (name !== undefined) patch.name = name;
        if (email !== undefined) patch.email = email;
        if (phone !== undefined) patch.phone = phone;
        if (goals !== undefined) patch.goals = goals;
        if (notes !== undefined) patch.notes = notes;
        if (status !== undefined) patch.status = status;
        await db.updateClient(id, patch);
        return { success: true };
      }),

    invite: trainerProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().optional(),
          bundleDraftId: z.string().optional(),
          message: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.bundleDraftId) {
          const bundle = await db.getBundleDraftById(input.bundleDraftId);
          if (!bundle) notFound("Bundle");
          assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
          if (bundle.status !== "published") {
            forbidden(
              "Only published bundles can be included in invitations",
            );
          }
        }
        const token = crypto.randomUUID();
        const expiresAt = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(); // 7 days
        await db.createInvitation({
          trainerId: ctx.user.id,
          email: input.email,
          name: input.name,
          token,
          bundleDraftId: input.bundleDraftId,
          expiresAt,
        });
        try {
          const emailMessageId = await sendInviteEmail({
            to: input.email,
            token,
            recipientName: input.name,
            trainerName: ctx.user.name || ctx.user.email || "Your trainer",
            expiresAtIso: expiresAt,
            personalMessage: input.message,
          });
          console.log("[Invite] trainer invite email queued", {
            trainerId: ctx.user.id,
            recipient: input.email,
            emailMessageId,
          });
        } catch (error: any) {
          logError("invite.email_failed", error, {
            trainerId: ctx.user.id,
            trainerRole: ctx.user.role,
            recipient: input.email,
            flow: "single",
          });
          await notifyInviteFailureByMessage(
            ctx.user,
            input.email,
            error?.message || "unknown error",
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: getInviteEmailFailureUserMessage(error),
          });
        }
        return { token, expiresAt };
      }),

    invitations: trainerProcedure.query(async ({ ctx }) => {
      return db.getInvitationsByTrainer(ctx.user.id);
    }),

    bulkInvite: trainerProcedure
      .input(
        z.object({
          invitations: z.array(
            z.object({
              email: z.string().email(),
              name: z.string().optional(),
            }),
          ),
          bundleDraftId: z.string().optional(),
          message: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.bundleDraftId) {
          const bundle = await db.getBundleDraftById(input.bundleDraftId);
          if (!bundle) notFound("Bundle");
          assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
          if (bundle.status !== "published") {
            forbidden(
              "Only published bundles can be included in invitations",
            );
          }
        }
        const results = [];
        for (const invite of input.invitations) {
          const token = crypto.randomUUID();
          const expiresAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(); // 7 days
          await db.createInvitation({
            trainerId: ctx.user.id,
            email: invite.email,
            name: invite.name,
            token,
            bundleDraftId: input.bundleDraftId,
            expiresAt,
          });
          try {
            const emailMessageId = await sendInviteEmail({
              to: invite.email,
              token,
              recipientName: invite.name,
              trainerName: ctx.user.name || ctx.user.email || "Your trainer",
              expiresAtIso: expiresAt,
              personalMessage: input.message,
            });
            console.log("[Invite] trainer bulk invite email queued", {
              trainerId: ctx.user.id,
              recipient: invite.email,
              emailMessageId,
            });
          } catch (error: any) {
            logError("invite.email_failed", error, {
              trainerId: ctx.user.id,
              trainerRole: ctx.user.role,
              recipient: invite.email,
              flow: "bulk",
            });
            await notifyInviteFailureByMessage(
              ctx.user,
              invite.email,
              error?.message || "unknown error",
            );
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Invite email to ${invite.email} failed. ${getInviteEmailFailureUserMessage(error)}`,
            });
          }
          results.push({ email: invite.email, token, success: true });
        }
        return { sent: results.length, results };
      }),
  }),

  // ============================================================================
  // SUBSCRIPTIONS (with session tracking)
  // ============================================================================
  subscriptions: router({
    // Client gets their subscriptions (finds client records linked to this user)
    mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
      const myTrainers = await db.getMyTrainers(ctx.user.id);
      if (myTrainers.length === 0) return [];
      const allSubs = [];
      for (const trainer of myTrainers) {
        if (trainer.relationshipId) {
          const subs = await db.getSubscriptionsByClient(
            trainer.relationshipId,
          );
          allSubs.push(...subs);
        }
      }
      return allSubs;
    }),

    // Trainer gets subscriptions for their clients
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getSubscriptionsByTrainer(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        let subscription = await db.getSubscriptionById(input.id);
        if (!subscription) {
          const subs = await db.getSubscriptionsByClient(input.id);
          subscription = subs[0];
        }
        if (!subscription) return undefined;
        assertSubscriptionAccess(ctx.user, subscription);
        return subscription;
      }),

    create: trainerProcedure
      .input(
        z.object({
          clientId: z.string(),
          bundleDraftId: z.string().optional(),
          price: z.string(),
          subscriptionType: z.enum(["weekly", "monthly", "yearly"]).optional(),
          sessionsIncluded: z.number().default(0),
          startDate: z.date().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) notFound("Client");
        assertTrainerOwned(ctx.user, client.trainerId, "client");
        if (input.bundleDraftId) {
          const bundle = await db.getBundleDraftById(input.bundleDraftId);
          if (!bundle) notFound("Bundle");
          assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
          if (bundle.status !== "published") {
            forbidden(
              "Only published bundles can be used for subscriptions",
            );
          }
        }
        return db.createSubscription({
          clientId: input.clientId,
          trainerId: client.trainerId,
          bundleDraftId: input.bundleDraftId,
          price: input.price,
          subscriptionType: input.subscriptionType,
          sessionsIncluded: input.sessionsIncluded,
          sessionsUsed: 0,
          startDate: input.startDate
            ? input.startDate.toISOString()
            : new Date().toISOString(),
        });
      }),

    // Get session usage stats for a subscription
    sessionStats: protectedProcedure
      .input(z.object({ subscriptionId: z.string() }))
      .query(async ({ ctx, input }) => {
        let sub = await db.getSubscriptionById(input.subscriptionId);
        if (!sub) {
          sub = await db.getActiveSubscription(input.subscriptionId);
        }
        if (!sub) return { included: 0, used: 0, remaining: 0 };
        assertSubscriptionAccess(ctx.user, sub);
        const included = sub.sessionsIncluded || 0;
        const used = sub.sessionsUsed || 0;
        return { included, used, remaining: Math.max(0, included - used) };
      }),

    // Pause a subscription
    pause: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubscriptionById(input.id);
        if (!sub) notFound("Subscription");
        assertSubscriptionAccess(ctx.user, sub);
        await db.updateSubscription(input.id, {
          status: "paused",
          pausedAt: new Date().toISOString(),
        });
        return { success: true };
      }),

    // Resume a paused subscription
    resume: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubscriptionById(input.id);
        if (!sub) notFound("Subscription");
        assertSubscriptionAccess(ctx.user, sub);
        await db.updateSubscription(input.id, {
          status: "active",
          pausedAt: null,
        });
        return { success: true };
      }),

    // Cancel a subscription
    cancel: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubscriptionById(input.id);
        if (!sub) notFound("Subscription");
        assertSubscriptionAccess(ctx.user, sub);
        await db.updateSubscription(input.id, {
          status: "cancelled",
          cancelledAt: new Date().toISOString(),
        });
        return { success: true };
      }),
  }),

  // ============================================================================
  // SESSIONS (Training sessions with usage tracking)
  // ============================================================================
  sessions: router({
    // Trainer gets their sessions
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getSessionsByTrainer(ctx.user.id);
    }),

    upcoming: trainerProcedure.query(async ({ ctx }) => {
      return db.getUpcomingSessions(ctx.user.id);
    }),

    // Client gets their sessions
    mySessions: protectedProcedure.query(async ({ ctx }) => {
      const myTrainers = await db.getMyTrainers(ctx.user.id);
      if (myTrainers.length === 0) return [];

      const allSessions = [];
      for (const trainer of myTrainers) {
        if (trainer.relationshipId) {
          const sessions = await db.getSessionsByClient(trainer.relationshipId);
          allSessions.push(...sessions);
        }
      }

      return allSessions.sort(
        (a, b) =>
          new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime(),
      );
    }),

    create: trainerProcedure
      .input(
        z.object({
          clientId: z.string(),
          subscriptionId: z.string().optional(),
          sessionDate: z.date(),
          durationMinutes: z.number().default(60),
          sessionType: z
            .enum(["training", "check_in", "call", "plan_review"])
            .optional(),
          location: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) notFound("Client");
        assertTrainerOwned(ctx.user, client.trainerId, "client");
        const sessionId = await db.createSession({
          clientId: input.clientId,
          trainerId: client.trainerId,
          subscriptionId: input.subscriptionId,
          sessionDate: input.sessionDate.toISOString(),
          durationMinutes: input.durationMinutes,
          sessionType: input.sessionType,
          location: input.location,
          notes: input.notes,
        });

        // Best-effort sync to connected Google Calendar.
        try {
          const trainer = await db.getUserById(client.trainerId);
          if (trainer) {
            const ensured = await ensureGoogleCalendarAccessToken(trainer);
            const calendarId =
              ensured.integration.selectedCalendarId || "primary";
            const eventEnd = new Date(
              input.sessionDate.getTime() + input.durationMinutes * 60_000,
            ).toISOString();
            const gcEvent = await googleCalendar.createGoogleCalendarEvent({
              accessToken: ensured.token,
              calendarId,
              summary: `${input.sessionType || "Training"} with ${client.name || "Client"}`,
              description:
                input.notes || "Scheduled from LocoMotivate trainer calendar.",
              location: input.location || undefined,
              startTimeIso: input.sessionDate.toISOString(),
              endTimeIso: eventEnd,
              attendeeEmails: client.email ? [client.email] : [],
            });
            if (gcEvent.id) {
              await db.updateSession(sessionId, {
                googleCalendarEventId: gcEvent.id,
              });
            }
          }
        } catch (error) {
          console.warn("[GoogleCalendar] Session sync failed:", error);
        }

        return sessionId;
      }),

    // Mark session as completed - this increments the usage count
    complete: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) notFound("Session");
        assertTrainerOwned(ctx.user, session.trainerId, "session");
        await db.completeSession(input.id);
        return { success: true };
      }),

    cancel: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) notFound("Session");
        assertTrainerOwned(ctx.user, session.trainerId, "session");
        await db.updateSession(input.id, { status: "cancelled" });

        if (session.googleCalendarEventId) {
          try {
            const trainer = await db.getUserById(session.trainerId);
            if (trainer) {
              const ensured = await ensureGoogleCalendarAccessToken(trainer);
              const calendarId =
                ensured.integration.selectedCalendarId || "primary";
              await googleCalendar.deleteGoogleCalendarEvent({
                accessToken: ensured.token,
                calendarId,
                eventId: session.googleCalendarEventId,
              });
            }
          } catch (error) {
            console.warn(
              "[GoogleCalendar] Failed to delete event on cancel:",
              error,
            );
          }
        }

        return { success: true };
      }),

    markNoShow: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) notFound("Session");
        assertTrainerOwned(ctx.user, session.trainerId, "session");
        await db.updateSession(input.id, { status: "no_show" });
        return { success: true };
      }),

    suggestReschedule: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          proposedStartTime: z.date(),
          durationMinutes: z.number().int().min(15).max(480),
          note: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) notFound("Session");
        if (
          !(
            isManagerLikeRole(ctx.user.role) ||
            session.trainerId === ctx.user.id ||
            session.clientId === ctx.user.id
          )
        ) {
          forbidden("You do not have access to this session");
        }

        const proposer =
          session.trainerId === ctx.user.id
            ? "trainer"
            : session.clientId === ctx.user.id
              ? "client"
              : "manager";
        const proposedEnd = new Date(
          input.proposedStartTime.getTime() + input.durationMinutes * 60_000,
        );
        const noteLine = input.note?.trim()
          ? ` Note: ${input.note.trim()}`
          : "";
        const suggestionLine = `\n[Reschedule suggestion by ${proposer}] ${input.proposedStartTime.toISOString()} (${input.durationMinutes}m).${noteLine}`;
        const nextNotes = `${session.notes || ""}${suggestionLine}`.trim();

        await db.updateSession(input.id, { notes: nextNotes });

        // Best-effort Google Calendar suggestion event.
        try {
          const trainer = await db.getUserById(session.trainerId);
          const client = await db.getClientById(session.clientId);
          if (trainer) {
            const ensured = await ensureGoogleCalendarAccessToken(trainer);
            const calendarId =
              ensured.integration.selectedCalendarId || "primary";
            await googleCalendar.createGoogleCalendarEvent({
              accessToken: ensured.token,
              calendarId,
              summary: `Reschedule suggestion: ${client?.name || "Client"}`,
              description:
                `Suggested move from LocoMotivate by ${proposer}.${noteLine || ""}`.trim(),
              startTimeIso: input.proposedStartTime.toISOString(),
              endTimeIso: proposedEnd.toISOString(),
              attendeeEmails: client?.email ? [client.email] : [],
            });
          }
        } catch (error) {
          console.warn(
            "[GoogleCalendar] Reschedule suggestion sync failed:",
            error,
          );
        }

        return { success: true };
      }),
  }),

  // ============================================================================
  // RESCHEDULE REQUESTS
  // ============================================================================
  reschedule: router({
    pending: trainerProcedure.query(async ({ ctx }) => {
      return db.getPendingRescheduleRequests(ctx.user.id);
    }),

    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getRescheduleRequestsByTrainer(ctx.user.id);
    }),

    approve: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const request = await db.getRescheduleRequestById(input.id);
        if (!request) notFound("Reschedule request");
        if (
          request.trainerId !== ctx.user.id &&
          !isManagerLikeRole(ctx.user.role)
        ) {
          forbidden("You do not have access to this request");
        }

        await db.updateSession(request.sessionId, {
          sessionDate: request.proposedDate,
          location: request.proposedLocation || undefined,
        });
        await db.updateRescheduleRequest(input.id, {
          status: "approved",
          respondedAt: new Date().toISOString(),
        } as any);

        const conversationId = [request.trainerId, request.clientId]
          .sort()
          .join("-");
        const newTime = new Date(request.proposedDate).toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        const msgContent = `✅ Reschedule approved! Your session has been moved to ${newTime}.`;
        await db.createMessage({
          senderId: request.trainerId,
          receiverId: request.clientId,
          conversationId,
          content: msgContent,
          messageType: "system",
        });
        notifyNewMessage(
          conversationId,
          {
            id: "reschedule-approved-" + input.id,
            senderId: request.trainerId,
            senderName: "Calendar",
            receiverId: request.clientId,
            content: msgContent,
            conversationId,
          },
          [request.clientId],
        );
        notifyBadgeCounts([request.clientId]);

        return { success: true };
      }),

    reject: trainerProcedure
      .input(z.object({ id: z.string(), note: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const request = await db.getRescheduleRequestById(input.id);
        if (!request) notFound("Reschedule request");
        if (
          request.trainerId !== ctx.user.id &&
          !isManagerLikeRole(ctx.user.role)
        ) {
          forbidden("You do not have access to this request");
        }

        await db.updateRescheduleRequest(input.id, {
          status: "rejected",
          responseNote: input.note || null,
          respondedAt: new Date().toISOString(),
        } as any);

        // Revert Google Calendar event to original time
        try {
          const trainer = await db.getUserById(request.trainerId);
          if (trainer) {
            const session = await db.getSessionById(request.sessionId);
            if (session?.googleCalendarEventId) {
              const ensured = await ensureGoogleCalendarAccessToken(trainer);
              const calendarId =
                ensured.integration.selectedCalendarId || "primary";
              const endTime = new Date(
                new Date(request.originalDate).getTime() +
                  (session.durationMinutes || 60) * 60_000,
              ).toISOString();
              await googleCalendar.updateGoogleCalendarEvent({
                accessToken: ensured.token,
                calendarId,
                eventId: session.googleCalendarEventId,
                startTimeIso: request.originalDate,
                endTimeIso: endTime,
              });
            }
          }
        } catch {
          // Best effort revert
        }

        const conversationId = [request.trainerId, request.clientId]
          .sort()
          .join("-");
        const msgContent = `❌ Reschedule declined. Your session stays at the original time.${input.note ? ` Note: ${input.note}` : ""}`;
        await db.createMessage({
          senderId: request.trainerId,
          receiverId: request.clientId,
          conversationId,
          content: msgContent,
          messageType: "system",
        });
        notifyNewMessage(
          conversationId,
          {
            id: "reschedule-rejected-" + input.id,
            senderId: request.trainerId,
            senderName: "Calendar",
            receiverId: request.clientId,
            content: msgContent,
            conversationId,
          },
          [request.clientId],
        );
        notifyBadgeCounts([request.clientId]);

        return { success: true };
      }),

    counterPropose: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          counterDate: z.date(),
          note: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const request = await db.getRescheduleRequestById(input.id);
        if (!request) notFound("Reschedule request");
        if (
          request.trainerId !== ctx.user.id &&
          !isManagerLikeRole(ctx.user.role)
        ) {
          forbidden("You do not have access to this request");
        }

        await db.updateRescheduleRequest(input.id, {
          status: "counter_proposed",
          counterDate: input.counterDate.toISOString(),
          responseNote: input.note || null,
          respondedAt: new Date().toISOString(),
        } as any);

        const conversationId = [request.trainerId, request.clientId]
          .sort()
          .join("-");
        const counterTime = input.counterDate.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        const msgContent = `🔄 Counter-proposal: How about ${counterTime} instead?${input.note ? ` ${input.note}` : ""}`;
        await db.createMessage({
          senderId: request.trainerId,
          receiverId: request.clientId,
          conversationId,
          content: msgContent,
          messageType: "system",
        });
        notifyNewMessage(
          conversationId,
          {
            id: "reschedule-counter-" + input.id,
            senderId: request.trainerId,
            senderName: "Calendar",
            receiverId: request.clientId,
            content: msgContent,
            conversationId,
          },
          [request.clientId],
        );
        notifyBadgeCounts([request.clientId]);

        return { success: true };
      }),
  }),

  // ============================================================================
  // ORDERS
  // ============================================================================
  orders: router({
    // Client gets their orders
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrdersByClient(ctx.user.id);
    }),

    // Trainer gets orders attributed to them
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getOrdersByTrainer(ctx.user.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          items: z
            .array(
              z.object({
                title: z.string().min(1),
                quantity: z.number().int().min(1),
                bundleId: z.string().optional(),
                productId: z.string().optional(),
                customProductId: z.string().optional(),
                trainerId: z.string().optional(),
                unitPrice: z.number().min(0),
                fulfillment: z
                  .enum([
                    "home_ship",
                    "trainer_delivery",
                    "vending",
                    "cafeteria",
                  ])
                  .optional(),
              }),
            )
            .min(1),
          subtotalAmount: z.number().min(0).optional(),
          taxAmount: z.number().min(0).optional(),
          shippingAmount: z.number().min(0).optional(),
          totalAmount: z.number().min(0).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "trainer" || isManagerLikeRole(ctx.user.role)) {
          forbidden("Only shoppers and clients can place orders");
        }

        const resolvedItems = await Promise.all(
          input.items.map(async (item) => {
            let name = item.title;
            let unitPrice = item.unitPrice;
            let trainerId = item.trainerId;
            let productId = item.productId;
            let customProductId = item.customProductId;
            let productImageUrl: string | null = null;
            let bundleProducts: ReturnType<typeof parseBundleProducts> = [];
            let bundleCadence: string | null = null;
            let bundleServicesJson: unknown = null;
            let bundleGoalsJson: unknown = null;

            if (item.bundleId) {
              const bundle = await db.getBundleDraftById(item.bundleId);
              if (bundle) {
                if (bundle.status !== "published") {
                  forbidden(
                    `Bundle "${bundle.title || item.title || "selected bundle"}" is not available for sale`,
                  );
                }
                name = bundle.title || name;
                const price = Number.parseFloat(
                  String(bundle.price || unitPrice),
                );
                unitPrice = Number.isFinite(price) ? price : unitPrice;
                trainerId = trainerId || bundle.trainerId || undefined;
                bundleProducts = parseBundleProducts(bundle.productsJson);
                bundleCadence = bundle.cadence || null;
                bundleServicesJson = bundle.servicesJson;
                bundleGoalsJson = bundle.goalsJson;
              } else {
                notFound("Bundle");
              }
            } else if (item.productId) {
              const product = await resolveCatalogProductReference(item.productId);
              if (product) {
                name = product.name || name;
                const price = Number.parseFloat(
                  String(product.price || unitPrice),
                );
                unitPrice = Number.isFinite(price) ? price : unitPrice;
                productId = product.id;
                productImageUrl = product.imageUrl || null;
              }
            } else if (item.customProductId) {
              const customProduct = await db.getTrainerCustomProductById(item.customProductId);
              if (customProduct) {
                name = customProduct.name || name;
                const price = Number.parseFloat(
                  String(customProduct.price || unitPrice),
                );
                unitPrice = Number.isFinite(price) ? price : unitPrice;
                customProductId = customProduct.id;
                trainerId = trainerId || customProduct.trainerId;
                productImageUrl = customProduct.imageUrl || null;
              }
            }

            return {
              ...item,
              name,
              unitPrice,
              trainerId,
              productId,
              customProductId,
              productImageUrl,
              bundleProducts,
              bundleCadence,
              bundleServicesJson,
              bundleGoalsJson,
            };
          }),
        );

        const trainerIds = Array.from(
          new Set(
            resolvedItems
              .map((item) => item.trainerId)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        if (trainerIds.length > 1) {
          forbidden("Mixed-trainer carts are not supported yet");
        }

        let orderAttributionId: string | null = null;
        let attributedTrainerId = trainerIds[0] || null;
        if (!attributedTrainerId) {
          const attribution = await db.getAttributionForCustomer(ctx.user.id);
          if (attribution) {
            attributedTrainerId = attribution.trainerId;
            orderAttributionId = attribution.id;
          }
        }

        const subtotalComputed = resolvedItems.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0,
        );
        const subtotalAmount = input.subtotalAmount ?? subtotalComputed;
        const shippingAmount = input.shippingAmount ?? 0;
        const taxAmount = input.taxAmount ?? 0;
        const totalAmount =
          input.totalAmount ?? subtotalAmount + shippingAmount + taxAmount;
        const paymentStatus = totalAmount > 0 ? "pending" : "paid";

        const orderId = await db.createOrder({
          clientId: ctx.user.id,
          trainerId: attributedTrainerId,
          attributionId: orderAttributionId,
          customerEmail: ctx.user.email,
          customerName: ctx.user.name,
          totalAmount: totalAmount.toFixed(2),
          subtotalAmount: subtotalAmount.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          shippingAmount: shippingAmount.toFixed(2),
          status: "pending",
          paymentStatus,
          fulfillmentStatus: "unfulfilled",
          fulfillmentMethod:
            resolvedItems[0]?.fulfillment || "trainer_delivery",
          orderData: {
            source: "checkout",
            itemCount: resolvedItems.length,
            paymentRequired: totalAmount > 0,
          },
        });

        const deliveryIds: string[] = [];
        for (const item of resolvedItems) {
          const expandedBundleProducts =
            item.bundleId && item.bundleProducts.length > 0
              ? item.bundleProducts
              : null;

          if (expandedBundleProducts) {
            for (const bundleProduct of expandedBundleProducts) {
              const lineUnitPrice = Number.parseFloat(String(bundleProduct.price || "0"));
              const safeLineUnitPrice =
                Number.isFinite(lineUnitPrice) && lineUnitPrice >= 0
                  ? lineUnitPrice
                  : 0;
              const lineTotal = safeLineUnitPrice * bundleProduct.quantity;
              await db.createOrderItem({
                orderId,
                productId: bundleProduct.productId || null,
                name: bundleProduct.name,
                quantity: bundleProduct.quantity,
                price: safeLineUnitPrice.toFixed(2),
                totalPrice: lineTotal.toFixed(2),
                fulfillmentStatus: "unfulfilled",
              });
              if (item.trainerId) {
                const deliveryId = await db.createDelivery({
                  orderId,
                  trainerId: item.trainerId,
                  clientId: ctx.user.id,
                  productId: bundleProduct.productId || null,
                  customProductId: bundleProduct.customProductId || null,
                  productName: bundleProduct.name,
                  productImageUrl: bundleProduct.imageUrl || null,
                  unitPrice: safeLineUnitPrice.toFixed(2),
                  quantity: bundleProduct.quantity,
                  status: "pending",
                  deliveryMethod: toDeliveryMethod(
                    (bundleProduct.fulfillmentMethod as any) ||
                      item.fulfillment ||
                      "trainer_delivery",
                  ),
                });
                deliveryIds.push(deliveryId);
              }
            }
          } else {
            const lineTotal = item.unitPrice * item.quantity;
            await db.createOrderItem({
              orderId,
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              price: item.unitPrice.toFixed(2),
              totalPrice: lineTotal.toFixed(2),
              fulfillmentStatus: "unfulfilled",
            });

            if (item.trainerId) {
              const deliveryId = await db.createDelivery({
                orderId,
                trainerId: item.trainerId,
                clientId: ctx.user.id,
                productId: item.productId,
                customProductId: item.customProductId || null,
                productName: item.name,
                productImageUrl: item.productImageUrl || null,
                unitPrice: item.unitPrice.toFixed(2),
                quantity: item.quantity,
                status: "pending",
                deliveryMethod: toDeliveryMethod(item.fulfillment),
              });
              deliveryIds.push(deliveryId);
            }
          }
        }

        notifyBadgeCounts([ctx.user.id, ...trainerIds]);
        const payment = await provisionOrderPaymentLink({
          orderId,
          requestedBy: ctx.user.id,
          payerId: ctx.user.id,
          amountMinor: Math.round(totalAmount * 100),
          shopperEmail: ctx.user.email,
          description: `Checkout order ${orderId}`,
        });

        return { success: true, orderId, deliveryIds, payment };
      }),

    createFromProposal: protectedProcedure
      .input(
        z.object({
          invitationToken: z.string().min(1),
          title: z.string().optional(),
          notes: z.string().optional(),
          baseBundleDraftId: z.string().nullable().optional(),
          startDate: z.string().optional(),
          cadenceCode: proposalCadenceSchema.optional(),
          sessionsPerWeek: z.number().int().min(1).max(7).optional(),
          timePreference: z.string().optional(),
          items: z.array(proposalItemInputSchema).min(1),
          shippingAmount: z.number().min(0).optional(),
          taxAmount: z.number().min(0).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "trainer" || isManagerLikeRole(ctx.user.role)) {
          forbidden("Only shoppers and clients can place proposal orders");
        }

        const invitation = await db.getInvitationByToken(input.invitationToken);
        if (!invitation) notFound("Invitation");
        if (!invitation.savedCartProposalId) {
          forbidden("This invitation is not tied to a saved cart proposal");
        }
        if (invitation.status && invitation.status !== "pending") {
          forbidden(`Invitation has already been ${invitation.status}`);
        }

        const expiresAt = new Date(invitation.expiresAt);
        if (expiresAt.getTime() < Date.now()) {
          await db.updateInvitation(invitation.id, { status: "expired" });
          forbidden("Invitation has expired");
        }

        if (ctx.user.email && invitation.email) {
          const invitedEmail = invitation.email.trim().toLowerCase();
          const signedInEmail = ctx.user.email.trim().toLowerCase();
          if (invitedEmail !== signedInEmail) {
            forbidden("Signed-in account does not match the invited email");
          }
        }

        const proposal = await db.getSavedCartProposalById(
          invitation.savedCartProposalId,
        );
        if (!proposal) notFound("Saved cart proposal");
        const originalSnapshot =
          invitation.proposalSnapshotJson &&
          typeof invitation.proposalSnapshotJson === "object"
            ? (invitation.proposalSnapshotJson as SavedCartProposalSnapshot)
            : await buildSavedCartSnapshotFromRecord(proposal);

        const normalizedItems = await normalizeProposalItemsForTrainer(
          proposal.trainerId,
          input.items,
        );
        const finalSnapshot = buildSavedCartProposalSnapshot({
          title: input.title ?? proposal.title ?? originalSnapshot.title,
          notes: input.notes ?? proposal.notes ?? originalSnapshot.notes,
          baseBundleDraftId:
            input.baseBundleDraftId === undefined
              ? originalSnapshot.baseBundleDraftId
              : input.baseBundleDraftId,
          startDate:
            input.startDate ??
            proposal.startDate ??
            originalSnapshot.startDate,
          cadenceCode:
            input.cadenceCode ??
            (proposal.cadenceCode as ProposalCadenceCode) ??
            originalSnapshot.cadenceCode,
          sessionsPerWeek:
            input.sessionsPerWeek ??
            proposal.sessionsPerWeek ??
            originalSnapshot.sessionsPerWeek,
          timePreference:
            input.timePreference ??
            proposal.timePreference ??
            originalSnapshot.timePreference,
          programWeeks: originalSnapshot.programWeeks ?? null,
          sessionCost: originalSnapshot.sessionCost ?? null,
          sessionDurationMinutes: originalSnapshot.sessionDurationMinutes ?? null,
          items: normalizedItems,
        });

        const cartDiff = diffProposalSnapshots(originalSnapshot, finalSnapshot);
        const trainerId =
          proposal.trainerId || invitation.trainerId || originalSnapshot.baseBundleDraftId;
        if (!trainerId || typeof trainerId !== "string") {
          notFound("Trainer");
        }

        const clientRecord = await ensureTrainerClientRecord({
          trainerId: proposal.trainerId,
          user: ctx.user,
          invitation,
        });

        let proposalAttributionId: string | null = null;
        try {
          proposalAttributionId = await db.upsertAttribution({
            customerId: ctx.user.id,
            trainerId: proposal.trainerId,
            source: "invitation_acceptance",
            metadata: { invitationId: invitation.id, savedCartProposalId: proposal.id },
          });
        } catch { /* attribution is best-effort */ }

        const result = await createOrderFromProposalSnapshot({
          user: ctx.user,
          invitation,
          proposal,
          snapshot: finalSnapshot,
          trainerId: proposal.trainerId,
          clientRecord,
          attributionId: proposalAttributionId,
          shippingAmount: input.shippingAmount ?? 0,
          taxAmount: input.taxAmount ?? 0,
          cartDiff,
        });

        await db.updateInvitation(invitation.id, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          acceptedByUserId: ctx.user.id,
        });

        notifyBadgeCounts([ctx.user.id, proposal.trainerId]);
        return {
          success: true,
          orderId: result.orderId,
          deliveryIds: result.deliveryIds,
          subscriptionId: result.subscriptionId,
          payment: result.payment,
          cartDiff,
          finalSnapshot,
        };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) return undefined;
        assertOrderAccess(ctx.user, order);
        const items = await db.getOrderItems(input.id);
        return { ...order, items };
      }),

    createPaymentLink: protectedProcedure
      .input(z.object({ orderId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) notFound("Order");
        assertOrderAccess(ctx.user, order);

        if (order.paymentStatus === "paid") {
          return {
            success: true,
            payment: {
              required: false,
              configured: adyen.isAdyenConfigured(),
              provisioned: false,
              paymentLink: null,
              merchantReference: null,
              expiresAt: null,
            } as OrderPaymentProvision,
          };
        }

        const amountMinor = Math.round(
          Number.parseFloat(String(order.totalAmount || "0")) * 100,
        );
        const payment = await provisionOrderPaymentLink({
          orderId: order.id,
          requestedBy: ctx.user.id,
          payerId: order.clientId ?? ctx.user.id,
          amountMinor: Number.isFinite(amountMinor) ? amountMinor : 0,
          shopperEmail: order.customerEmail,
          description: `Order ${order.id}`,
        });

        return { success: true, payment };
      }),

    // Update order status
    updateStatus: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          status: z.enum([
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
            "refunded",
          ]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) notFound("Order");
        assertOrderManageAccess(ctx.user, order);
        await db.updateOrder(input.id, { status: input.status });
        return { success: true };
      }),

    // Update fulfillment status
    updateFulfillment: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          fulfillmentStatus: z.enum([
            "unfulfilled",
            "partial",
            "fulfilled",
            "restocked",
          ]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) notFound("Order");
        assertOrderManageAccess(ctx.user, order);
        await db.updateOrder(input.id, {
          fulfillmentStatus: input.fulfillmentStatus,
        });
        return { success: true };
      }),
  }),

  // ============================================================================
  // DELIVERIES (Product deliveries)
  // ============================================================================
  deliveries: router({
    // Client gets their deliveries
    myDeliveries: protectedProcedure.query(async ({ ctx }) => {
      // Get client ID from user (client's trainerId links to their trainer)
      // For clients, we query by clientId which is the user's ID
      return db.getDeliveriesByClient(ctx.user.id);
    }),

    // Trainer gets deliveries they need to fulfill
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getDeliveriesByTrainer(ctx.user.id);
    }),

    pending: trainerProcedure.query(async ({ ctx }) => {
      return db.getPendingDeliveries(ctx.user.id);
    }),

    markReady: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryManageAccess(ctx.user, delivery);
        await db.markDeliveryReady(input.id);
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    markDelivered: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryManageAccess(ctx.user, delivery);
        await db.markDeliveryDelivered(input.id);
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Client confirms receipt
    confirmReceipt: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryClientAccess(ctx.user, delivery);
        await db.confirmDeliveryReceipt(input.id);
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Client reports issue
    reportIssue: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          reason: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryClientAccess(ctx.user, delivery);
        await db.updateDelivery(input.id, {
          status: "disputed",
          disputeReason: input.reason,
        });
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Client requests reschedule
    requestReschedule: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          requestedDate: z.string(),
          reason: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryClientAccess(ctx.user, delivery);
        const requestedDate = normalizeIsoDate(input.requestedDate);
        if (!requestedDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid requestedDate",
          });
        }
        await db.updateDelivery(input.id, {
          clientNotes: encodeRescheduleRequest({
            requestedDate,
            reason: input.reason?.trim() ? input.reason.trim() : null,
            requestedAt: new Date().toISOString(),
          }),
        });
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Trainer approves reschedule
    approveReschedule: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          newDate: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryManageAccess(ctx.user, delivery);
        const normalizedNewDate = normalizeIsoDate(input.newDate);
        if (!normalizedNewDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid newDate",
          });
        }
        const request = decodeRescheduleRequest(delivery.clientNotes);
        const priorDate = normalizeIsoDate(delivery.scheduledDate);
        const transition = [
          "Reschedule approved",
          priorDate ? `from ${priorDate}` : null,
          `to ${normalizedNewDate}`,
          request?.reason ? `(reason: ${request.reason})` : null,
        ]
          .filter(Boolean)
          .join(" ");
        const updatedNotes = [delivery.notes?.trim(), transition]
          .filter(Boolean)
          .join("\n");
        await db.updateDelivery(input.id, {
          scheduledDate: normalizedNewDate,
          notes: updatedNotes,
          clientNotes: null,
        });
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Trainer rejects reschedule
    rejectReschedule: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          reason: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryManageAccess(ctx.user, delivery);
        const request = decodeRescheduleRequest(delivery.clientNotes);
        const rejectionReason =
          input.reason?.trim() || request?.reason || "No reason provided";
        const updatedNotes = [
          delivery.notes?.trim(),
          `Reschedule rejected: ${rejectionReason}`,
        ]
          .filter(Boolean)
          .join("\n");
        await db.updateDelivery(input.id, {
          notes: updatedNotes,
          clientNotes: null,
        });
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Create delivery records for an order (called after order is placed)
    createForOrder: trainerProcedure
      .input(
        z.object({
          orderId: z.string(),
          clientId: z.string(),
          products: z.array(
            z.object({
              productId: z.string().optional(),
              productName: z.string(),
              quantity: z.number(),
            }),
          ),
          scheduledDate: z.string().optional(),
          deliveryMethod: z
            .enum(["in_person", "locker", "front_desk", "shipped"])
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) notFound("Order");
        assertOrderManageAccess(ctx.user, order);
        if (!order.trainerId) {
          forbidden("Order is missing a trainer");
        }
        if (order.clientId && order.clientId !== input.clientId) {
          forbidden("Order does not belong to the provided client");
        }
        const deliveryIds: string[] = [];
        for (const product of input.products) {
          const id = await db.createDelivery({
            orderId: input.orderId,
            trainerId: order.trainerId,
            clientId: input.clientId,
            productId: product.productId,
            productName: product.productName,
            quantity: product.quantity,
            status: "pending",
            scheduledDate: input.scheduledDate || undefined,
            deliveryMethod: input.deliveryMethod || "in_person",
          });
          deliveryIds.push(id);
        }
        notifyBadgeCounts([ctx.user.id, input.clientId]);
        return { success: true, deliveryIds };
      }),
  }),

  // ============================================================================
  // MESSAGES
  // ============================================================================
  messages: router({
    conversations: protectedProcedure.query(async ({ ctx }) => {
      const summaries = await db.getConversationSummaries(ctx.user.id);
      return summaries.map((s) => {
        const isAssistantConversation =
          s.conversationId === `bot-${ctx.user.id}`;
        const participants =
          isAssistantConversation && s.participants.length === 0
            ? [
                {
                  id: LOCO_ASSISTANT_USER_ID,
                  name: LOCO_ASSISTANT_NAME,
                  photoUrl: null,
                  role: "assistant",
                },
              ]
            : s.participants;
        const otherUser = participants[0];
        const isGroup =
          !isAssistantConversation &&
          (s.conversationId.startsWith("group-") || participants.length > 1);
        const participantNames = participants
          .map((p) => p.name)
          .filter(Boolean);
        return {
          id: s.conversationId,
          conversationId: s.conversationId,
          otherUserId: otherUser?.id,
          otherUserName: otherUser?.name,
          otherUserAvatar: otherUser?.photoUrl,
          otherUserRole: otherUser?.role,
          lastMessageContent: s.lastMessage?.content,
          lastMessageSenderId: s.lastMessage?.senderId,
          unreadCount: s.unreadCount,
          updatedAt: s.lastMessage?.createdAt,
          currentUserId: ctx.user.id,
          isGroup,
          participantCount: s.participants.length,
          participantNames,
        };
      });
    }),

    thread: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ ctx, input }) => {
        const isParticipant = await db.isConversationParticipant(
          input.conversationId,
          ctx.user.id,
        );
        if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
          forbidden("You do not have access to this conversation");
        }
        return db.getMessagesByConversation(input.conversationId);
      }),

    send: protectedProcedure
      .input(
        z.object({
          receiverId: z.string(),
          content: z.string().min(1),
          conversationId: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(
            input.conversationId,
            ctx.user.id,
          );
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
        }
        const conversationId =
          input.conversationId ||
          [ctx.user.id, input.receiverId].sort().join("-");

        const messageId = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          conversationId,
          content: input.content,
        });

        const isAssistantReceiver = input.receiverId === LOCO_ASSISTANT_USER_ID;

        notifyNewMessage(
          conversationId,
          {
            id: messageId,
            senderId: ctx.user.id,
            senderName: ctx.user.name ?? "Someone",
            receiverId: input.receiverId,
            content: input.content,
            conversationId,
          },
          isAssistantReceiver ? [ctx.user.id] : [input.receiverId, ctx.user.id],
          ctx.user.id,
        );

        if (isAssistantReceiver) {
          queueTrainerAssistantReply({
            user: ctx.user,
            conversationId,
            prompt: input.content,
          });
          return messageId;
        }

        notifyBadgeCounts([input.receiverId]);
        if (!isUserOnline(input.receiverId)) {
          await sendPushToUsers([input.receiverId], {
            title: ctx.user.name ?? "New message",
            body: toMessagePushBody(input.content, "text"),
            data: {
              type: "message",
              conversationId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
            },
          });
        }

        return messageId;
      }),

    sendGroup: protectedProcedure
      .input(
        z.object({
          receiverIds: z.array(z.string()).min(1),
          content: z.string().min(1),
          conversationId: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(
            input.conversationId,
            ctx.user.id,
          );
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
        }
        const conversationId =
          input.conversationId || `group-${ctx.user.id}-${Date.now()}`;
        const recipients = input.receiverIds.filter((id) => id !== ctx.user.id);
        const allParticipantIds = [...recipients, ctx.user.id];
        let firstMessageId: string | null = null;
        for (const receiverId of recipients) {
          const messageId = await db.createMessage({
            senderId: ctx.user.id,
            receiverId,
            conversationId,
            content: input.content,
          });
          if (!firstMessageId) firstMessageId = messageId;
        }
        if (firstMessageId) {
          notifyNewMessage(
            conversationId,
            {
              id: firstMessageId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
              content: input.content,
              conversationId,
            },
            allParticipantIds,
            ctx.user.id,
          );
          notifyBadgeCounts(recipients);
        }
        const pushRecipients = recipients.filter((id) => !isUserOnline(id));
        if (pushRecipients.length > 0) {
          await sendPushToUsers(pushRecipients, {
            title: ctx.user.name ?? "New message",
            body: toMessagePushBody(input.content, "text"),
            data: {
              type: "message",
              conversationId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
            },
          });
        }
        return { conversationId };
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.id);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        if (
          !isManagerLikeRole(ctx.user.role) &&
          message.receiverId !== ctx.user.id
        ) {
          forbidden("Only the recipient can mark this message as read");
        }
        await db.markMessageRead(input.id);
        return { success: true };
      }),

    edit: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          content: z.string().min(1).max(4000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.id);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        if (
          !isManagerLikeRole(ctx.user.role) &&
          message.senderId !== ctx.user.id
        ) {
          forbidden("Only the sender can edit this message");
        }
        if (message.messageType && message.messageType !== "text") {
          forbidden("Only text messages can be edited");
        }

        await db.updateMessageContent(input.id, input.content.trim());
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.id);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        if (
          !isManagerLikeRole(ctx.user.role) &&
          message.senderId !== ctx.user.id
        ) {
          forbidden("Only the sender can delete this message");
        }

        await db.deleteMessage(input.id);
        return { success: true };
      }),

    deleteConversation: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isParticipant = await db.isConversationParticipant(
          input.conversationId,
          ctx.user.id,
        );
        if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
          forbidden("You do not have access to this conversation");
        }

        await db.deleteConversation(input.conversationId);
        return { success: true };
      }),

    // Send message with attachment
    sendWithAttachment: protectedProcedure
      .input(
        z.object({
          receiverId: z.string(),
          content: z.string(),
          conversationId: z.string().optional(),
          messageType: z.enum(["text", "image", "file"]).default("text"),
          attachmentUrl: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentSize: z.number().optional(),
          attachmentMimeType: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(
            input.conversationId,
            ctx.user.id,
          );
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
        }
        const conversationId =
          input.conversationId ||
          [ctx.user.id, input.receiverId].sort().join("-");

        const messageId = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          conversationId,
          content: input.content,
          messageType: input.messageType,
          attachmentUrl: input.attachmentUrl,
          attachmentName: input.attachmentName,
          attachmentSize: input.attachmentSize,
          attachmentMimeType: input.attachmentMimeType,
        });

        const isAssistantReceiver = input.receiverId === LOCO_ASSISTANT_USER_ID;

        notifyNewMessage(
          conversationId,
          {
            id: messageId,
            senderId: ctx.user.id,
            senderName: ctx.user.name ?? "Someone",
            receiverId: input.receiverId,
            content: input.content,
            conversationId,
          },
          isAssistantReceiver ? [ctx.user.id] : [input.receiverId, ctx.user.id],
          ctx.user.id,
        );

        if (isAssistantReceiver) {
          queueTrainerAssistantReply({
            user: ctx.user,
            conversationId,
            prompt: input.content,
          });
          return messageId;
        }

        notifyBadgeCounts([input.receiverId]);
        if (!isUserOnline(input.receiverId)) {
          await sendPushToUsers([input.receiverId], {
            title: ctx.user.name ?? "New message",
            body: toMessagePushBody(input.content, input.messageType),
            data: {
              type: "message",
              conversationId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
            },
          });
        }

        return messageId;
      }),

    sendGroupWithAttachment: protectedProcedure
      .input(
        z.object({
          receiverIds: z.array(z.string()).min(1),
          content: z.string(),
          conversationId: z.string().optional(),
          messageType: z.enum(["text", "image", "file"]).default("text"),
          attachmentUrl: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentSize: z.number().optional(),
          attachmentMimeType: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(
            input.conversationId,
            ctx.user.id,
          );
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
        }
        const conversationId =
          input.conversationId || `group-${ctx.user.id}-${Date.now()}`;
        const recipients = input.receiverIds.filter((id) => id !== ctx.user.id);
        const allParticipantIds = [...recipients, ctx.user.id];
        let firstMessageId: string | null = null;
        for (const receiverId of recipients) {
          const messageId = await db.createMessage({
            senderId: ctx.user.id,
            receiverId,
            conversationId,
            content: input.content,
            messageType: input.messageType,
            attachmentUrl: input.attachmentUrl,
            attachmentName: input.attachmentName,
            attachmentSize: input.attachmentSize,
            attachmentMimeType: input.attachmentMimeType,
          });
          if (!firstMessageId) firstMessageId = messageId;
        }
        if (firstMessageId) {
          notifyNewMessage(
            conversationId,
            {
              id: firstMessageId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
              content: input.content,
              conversationId,
            },
            allParticipantIds,
            ctx.user.id,
          );
          notifyBadgeCounts(recipients);
        }
        const pushRecipients = recipients.filter((id) => !isUserOnline(id));
        if (pushRecipients.length > 0) {
          await sendPushToUsers(pushRecipients, {
            title: ctx.user.name ?? "New message",
            body: toMessagePushBody(input.content, input.messageType),
            data: {
              type: "message",
              conversationId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
            },
          });
        }
        return { conversationId };
      }),

    // Get reactions for a message
    getReactions: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .query(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.messageId);
        if (!message) return [];
        assertMessageAccess(ctx.user, message);
        return db.getMessageReactions(input.messageId);
      }),

    // Add reaction to a message
    addReaction: protectedProcedure
      .input(
        z.object({
          messageId: z.string(),
          reaction: z.string().max(32),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.messageId);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        return db.addMessageReaction({
          messageId: input.messageId,
          userId: ctx.user.id,
          reaction: input.reaction,
        });
      }),

    // Remove reaction from a message
    removeReaction: protectedProcedure
      .input(
        z.object({
          messageId: z.string(),
          reaction: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.messageId);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        await db.removeMessageReaction(
          input.messageId,
          ctx.user.id,
          input.reaction,
        );
        return { success: true };
      }),

    // Get all reactions for messages in a conversation
    getConversationReactions: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ ctx, input }) => {
        const isParticipant = await db.isConversationParticipant(
          input.conversationId,
          ctx.user.id,
        );
        if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
          forbidden("You do not have access to this conversation");
        }
        return db.getConversationReactions(input.conversationId);
      }),

    // Upload attachment for message
    uploadAttachment: protectedProcedure
      .input(
        z.object({
          fileName: z.string().min(1).max(255),
          fileData: z.string(), // Base64 encoded
          mimeType: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB decoded size
        const allowedMimePrefixes = ["image/", "video/", "audio/", "text/"];
        const allowedMimeExact = new Set([
          "application/pdf",
          "application/zip",
          "application/json",
          "application/octet-stream",
        ]);

        const mimeType = input.mimeType.trim().toLowerCase();
        const mimeAllowed =
          allowedMimeExact.has(mimeType) ||
          allowedMimePrefixes.some((prefix) => mimeType.startsWith(prefix)) ||
          mimeType.startsWith("application/vnd.");
        if (!mimeAllowed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unsupported attachment type",
          });
        }

        // Quick guard against obviously oversized payloads before decoding.
        const estimatedBytes = Math.ceil((input.fileData.length * 3) / 4);
        if (estimatedBytes > MAX_ATTACHMENT_BYTES) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: "Attachment exceeds 8 MB limit",
          });
        }

        let buffer: Buffer;
        try {
          buffer = Buffer.from(input.fileData, "base64");
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid attachment payload",
          });
        }
        if (buffer.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Attachment payload is empty",
          });
        }
        if (buffer.length > MAX_ATTACHMENT_BYTES) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: "Attachment exceeds 8 MB limit",
          });
        }

        // Generate unique key with user ID and timestamp
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const extCandidate = input.fileName.split(".").pop() || "bin";
        const ext =
          extCandidate.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
        const key = `messages/${ctx.user.id}/${timestamp}-${randomSuffix}.${ext}`;

        const { url } = await storagePut(key, buffer, mimeType);

        return { url, key };
      }),

    // Send a message to Loco Assistant
    sendToBot: protectedProcedure
      .input(
        z.object({
          content: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const conversationId = `bot-${ctx.user.id}`;

        // Save user's message
        const userMsgId = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: LOCO_ASSISTANT_USER_ID,
          conversationId,
          content: input.content,
        });

        notifyNewMessage(
          conversationId,
          {
            id: userMsgId,
            senderId: ctx.user.id,
            senderName: ctx.user.name ?? "You",
            receiverId: LOCO_ASSISTANT_USER_ID,
            content: input.content,
            conversationId,
          },
          [ctx.user.id],
        );

        queueTrainerAssistantReply({
          user: ctx.user,
          conversationId,
          prompt: input.content,
        });

        return { conversationId, messageId: userMsgId };
      }),
  }),

  // ============================================================================
  // EARNINGS (Trainer earnings)
  // ============================================================================
  earnings: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getEarningsByTrainer(ctx.user.id);
    }),

    summary: trainerProcedure.query(async ({ ctx }) => {
      return db.getEarningsSummary(ctx.user.id);
    }),
  }),

  // ============================================================================
  // CALENDAR
  // ============================================================================
  calendar: router({
    events: protectedProcedure.query(async ({ ctx }) => {
      return db.getCalendarEvents(ctx.user.id);
    }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          location: z.string().optional(),
          startTime: z.date(),
          endTime: z.date(),
          eventType: z
            .enum(["session", "delivery", "appointment", "other"])
            .optional(),
          relatedClientId: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return db.createCalendarEvent({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          location: input.location,
          startTime: input.startTime.toISOString(),
          endTime: input.endTime.toISOString(),
          eventType: input.eventType,
          relatedClientId: input.relatedClientId,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          location: z.string().optional(),
          startTime: z.date().optional(),
          endTime: z.date().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { id, startTime, endTime, ...rest } = input;
        await db.updateCalendarEvent(id, {
          ...rest,
          ...(startTime && { startTime: startTime.toISOString() }),
          ...(endTime && { endTime: endTime.toISOString() }),
        });
        return { success: true };
      }),
  }),

  googleCalendar: router({
    status: trainerProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) notFound("Trainer");
      const integration = getGoogleCalendarIntegration(user.metadata);
      return {
        connected: Boolean(integration),
        selectedCalendarId: integration?.selectedCalendarId || null,
        selectedCalendarName: integration?.selectedCalendarName || null,
      };
    }),

    getAuthUrl: trainerProcedure
      .input(
        z.object({
          redirectUri: z.string().url(),
        }),
      )
      .mutation(async ({ input }) => {
        const authUrl = googleCalendar.buildGoogleCalendarAuthUrl(
          input.redirectUri,
        );
        return { authUrl };
      }),

    connectWithCode: trainerProcedure
      .input(
        z.object({
          code: z.string().min(1),
          redirectUri: z.string().url(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) notFound("Trainer");

        const token = await googleCalendar.exchangeGoogleCalendarCode({
          code: input.code,
          redirectUri: input.redirectUri,
        });
        const calendars = await googleCalendar.listGoogleCalendars(
          token.accessToken,
        );

        const locoCalendar = calendars.find(
          (calendar) =>
            String(calendar.summary || "")
              .trim()
              .toLowerCase() === "locomotivate",
        );

        let selected: { id: string; summary: string } | null = locoCalendar
          ? { id: locoCalendar.id, summary: locoCalendar.summary }
          : null;

        if (!selected) {
          try {
            const created = await googleCalendar.createGoogleCalendar({
              accessToken: token.accessToken,
              summary: "Locomotivate",
              description:
                "Training sessions and client appointments from Locomotivate",
            });
            selected = { id: created.id, summary: created.summary };
          } catch {
            const primaryCalendar = calendars.find(
              (calendar) => calendar.primary,
            );
            const fallback = primaryCalendar || calendars[0] || null;
            selected = fallback
              ? { id: fallback.id, summary: fallback.summary }
              : null;
          }
        }

        const metadata = toObjectRecord(user.metadata);
        const nextMetadata = {
          ...metadata,
          googleCalendar: {
            ...toObjectRecord(metadata.googleCalendar),
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: token.expiresAt,
            scope: token.scope,
            tokenType: token.tokenType,
            selectedCalendarId: selected?.id || null,
            selectedCalendarName: selected?.summary || null,
            connectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
        await db.updateUser(ctx.user.id, { metadata: nextMetadata });

        return {
          success: true,
          selectedCalendarId: selected?.id || null,
          selectedCalendarName: selected?.summary || null,
          calendarsCount: calendars.length,
        };
      }),

    calendars: trainerProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) notFound("Trainer");
      const ensured = await ensureGoogleCalendarAccessToken(user);
      const calendars = await googleCalendar.listGoogleCalendars(ensured.token);
      const selectedId = ensured.integration.selectedCalendarId;
      const selectedName = ensured.integration.selectedCalendarName;
      if (selectedId && !calendars.some((c) => c.id === selectedId)) {
        calendars.unshift({
          id: selectedId,
          summary: selectedName || "Locomotivate",
          primary: false,
          accessRole: "owner",
        });
      }
      return {
        selectedCalendarId: selectedId,
        selectedCalendarName: selectedName,
        calendars,
      };
    }),

    selectCalendar: trainerProcedure
      .input(
        z.object({
          calendarId: z.string().min(1),
          calendarName: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) notFound("Trainer");
        const metadata = toObjectRecord(user.metadata);
        const nextMetadata = {
          ...metadata,
          googleCalendar: {
            ...toObjectRecord(metadata.googleCalendar),
            selectedCalendarId: input.calendarId,
            selectedCalendarName: input.calendarName,
            updatedAt: new Date().toISOString(),
          },
        };
        await db.updateUser(ctx.user.id, { metadata: nextMetadata });
        return { success: true };
      }),

    disconnect: trainerProcedure.mutation(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) notFound("Trainer");
      const metadata = toObjectRecord(user.metadata);
      const nextMetadata = { ...metadata };
      delete (nextMetadata as any).googleCalendar;
      await db.updateUser(ctx.user.id, { metadata: nextMetadata });
      return { success: true };
    }),

    syncFromGoogle: trainerProcedure.mutation(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) notFound("Trainer");
      const ensured = await ensureGoogleCalendarAccessToken(user);
      const calendarId = ensured.integration.selectedCalendarId || "primary";

      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const twoWeeksAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const gcEvents = await googleCalendar.listGoogleCalendarEvents({
        accessToken: ensured.token,
        calendarId,
        timeMin: twoWeeksAgo.toISOString(),
        timeMax: twoWeeksAhead.toISOString(),
      });

      const sessions = await db.getSessionsByTrainer(ctx.user.id);
      const sessionsByGcId = new Map<string, db.Session>();
      for (const s of sessions) {
        if (s.googleCalendarEventId)
          sessionsByGcId.set(s.googleCalendarEventId, s);
      }

      let updated = 0;
      let cancelled = 0;

      for (const gcEvent of gcEvents) {
        if (!gcEvent.id) continue;
        const session = sessionsByGcId.get(gcEvent.id);
        if (!session) continue;

        if (gcEvent.status === "cancelled" && session.status !== "cancelled") {
          await db.updateSession(session.id, { status: "cancelled" });
          cancelled++;
          continue;
        }

        const gcStartMs = gcEvent.start ? new Date(gcEvent.start).getTime() : 0;
        const sessionMs = new Date(session.sessionDate).getTime();
        const timeDiffMs = Math.abs(gcStartMs - sessionMs);

        if (gcEvent.start && timeDiffMs > 60_000) {
          // Check if a pending request already exists for this session
          const existingRequests = await db.getPendingRescheduleRequests(session.trainerId);
          const alreadyRequested = existingRequests.some((r) => r.sessionId === session.id);
          if (alreadyRequested) continue;

          const client = await db.getClientById(session.clientId);
          const clientUserId = client?.userId || session.clientId;
          try {
            await db.createRescheduleRequest({
              sessionId: session.id,
              trainerId: session.trainerId,
              clientId: clientUserId,
              originalDate: session.sessionDate,
              proposedDate: gcEvent.start,
              proposedDuration: null,
              proposedLocation: gcEvent.location || null,
              source: "google_calendar",
              note: "Session was moved in Google Calendar",
            });
            updated++;

            const conversationId = [session.trainerId, clientUserId]
              .sort()
              .join("-");
            const clientName = client?.name || "your client";
            const oldTime = new Date(session.sessionDate).toLocaleString(
              "en-US",
              {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              },
            );
            const newTime = new Date(gcEvent.start).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const msgContent = `📅 Reschedule request: Your session has been proposed to move from ${oldTime} to ${newTime}. Please check your calendar for details.`;
            await db.createMessage({
              senderId: session.trainerId,
              receiverId: clientUserId,
              conversationId,
              content: msgContent,
              messageType: "system",
            });
            notifyNewMessage(
              conversationId,
              {
                id: "reschedule-" + session.id,
                senderId: session.trainerId,
                senderName: "Calendar",
                receiverId: clientUserId,
                content: msgContent,
                conversationId,
              },
              [clientUserId],
            );
          } catch {
            // Reschedule request creation failed, fall back to direct update
            await db.updateSession(session.id, { sessionDate: gcEvent.start });
            updated++;
          }
        } else {
          const changes: Partial<db.InsertSession> = {};
          if (gcEvent.location && gcEvent.location !== session.location) {
            changes.location = gcEvent.location;
          }
          if (Object.keys(changes).length > 0) {
            await db.updateSession(session.id, changes);
            updated++;
          }
        }
      }

      // Check for sessions whose Google Calendar events were deleted
      for (const [gcId, session] of sessionsByGcId) {
        if (session.status === "cancelled") continue;
        const stillExists = gcEvents.some((e) => e.id === gcId);
        if (!stillExists) {
          const gcEvent = await googleCalendar.getGoogleCalendarEvent({
            accessToken: ensured.token,
            calendarId,
            eventId: gcId,
          });
          if (!gcEvent || gcEvent.status === "cancelled") {
            await db.updateSession(session.id, { status: "cancelled" });
            cancelled++;
          }
        }
      }

      return { synced: true, updated, cancelled, checked: gcEvents.length };
    }),
  }),

  // ============================================================================
  // PROFILE (User profile management)
  // ============================================================================
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserById(ctx.user.id);
    }),

    update: protectedProcedure
      .input(
        z.object({
          name: z.string().optional(),
          phone: z.string().optional(),
          bio: z.string().optional(),
          username: z.string().optional(),
          photoUrl: z.string().optional(),
          specialties: z.any().optional(),
          socialLinks: z.any().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateUser(ctx.user.id, input);
        return { success: true };
      }),
  }),

  notifications: router({
    registerPushToken: protectedProcedure
      .input(
        z.object({
          token: z.string().min(10),
          platform: z.enum(["ios", "android", "unknown"]).default("unknown"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserPushToken(ctx.user.id, input.token, input.platform);
        return { success: true };
      }),
  }),

  customProducts: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.listTrainerCustomProducts(ctx.user.id, { activeOnly: true });
    }),

    create: trainerProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(255),
          description: z.string().trim().max(2000).optional(),
          imageUrl: z.string().trim().max(2000).optional(),
          price: z.string().trim().min(1).max(32),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const numericPrice = Number.parseFloat(input.price);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Enter a valid custom product price greater than 0.",
          });
        }
        const created = await db.createTrainerCustomProduct({
          trainerId: ctx.user.id,
          name: input.name,
          description: input.description?.trim() || null,
          imageUrl: input.imageUrl?.trim() || null,
          price: numericPrice.toFixed(2),
          fulfillmentMethod: "trainer_delivery",
          active: true,
        });
        if (!created) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to create custom product.",
          });
        }
        return created;
      }),

    update: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().trim().min(1).max(255),
          description: z.string().trim().max(2000).optional(),
          imageUrl: z.string().trim().max(2000).optional(),
          price: z.string().trim().min(1).max(32),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getTrainerCustomProductById(input.id);
        if (!existing || existing.trainerId !== ctx.user.id || !existing.active) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Custom product not found.",
          });
        }
        const numericPrice = Number.parseFloat(input.price);
        if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Enter a valid custom product price greater than 0.",
          });
        }
        const updated = await db.updateTrainerCustomProduct(input.id, {
          name: input.name,
          description: input.description?.trim() || null,
          imageUrl: input.imageUrl?.trim() || null,
          price: numericPrice.toFixed(2),
        });
        if (!updated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to update custom product.",
          });
        }
        return updated;
      }),

    delete: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getTrainerCustomProductById(input.id);
        if (!existing || existing.trainerId !== ctx.user.id || !existing.active) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Custom product not found.",
          });
        }
        await db.deleteTrainerCustomProduct(input.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // MY TRAINERS (Client's trainer relationships)
  // ============================================================================
  myTrainers: router({
    // Get all trainers the current user is working with
    list: protectedProcedure.query(async ({ ctx }) => {
      const trainers = await db.getMyTrainers(ctx.user.id);

      // Enrich with active bundles count
      const enrichedTrainers = await Promise.all(
        trainers.map(async (trainer) => {
          const activeBundles = await db.getActiveBundlesCount(
            trainer.id,
            ctx.user.id,
          );
          return {
            ...trainer,
            activeBundles,
          };
        }),
      );

      return enrichedTrainers;
    }),

    // Remove a trainer from the client's roster
    remove: protectedProcedure
      .input(z.object({ trainerId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.removeTrainerFromClient(input.trainerId, ctx.user.id);
        return { success: true };
      }),

    // Get available trainers for discovery (not already connected)
    discover: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            specialty: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const trainers = await db.getAvailableTrainers(
          ctx.user.id,
          input?.search,
          input?.specialty,
        );

        // Enrich with bundle count
        const enrichedTrainers = await Promise.all(
          trainers.map(async (trainer) => {
            const bundleCount = await db.getTrainerBundleCount(trainer.id);
            const bundles = await db.getPublishedBundlesPreviewByTrainer(
              trainer.id,
              2,
            );
            let presentationHtml: string | null = null;
            if (trainer.metadata) {
              try {
                const metadata =
                  typeof trainer.metadata === "string"
                    ? JSON.parse(trainer.metadata)
                    : trainer.metadata;
                presentationHtml =
                  metadata && typeof metadata === "object"
                    ? ((metadata as { presentationHtml?: string })
                        .presentationHtml ?? null)
                    : null;
              } catch (error) {
                console.warn(
                  "[Trainers] Failed to parse trainer metadata:",
                  error,
                );
              }
            }
            return {
              ...trainer,
              bundleCount,
              bundles,
              presentationHtml,
            };
          }),
        );

        return enrichedTrainers;
      }),

    // Send a join request to a trainer
    requestToJoin: protectedProcedure
      .input(
        z.object({
          trainerId: z.string(),
          message: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const requestId = await db.createJoinRequest(
          input.trainerId,
          ctx.user.id,
          input.message,
        );
        notifyBadgeCounts([ctx.user.id, input.trainerId]);
        return { success: true, requestId };
      }),

    // Get pending join requests (requests the user has sent)
    pendingRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.getPendingJoinRequests(ctx.user.id);
    }),

    // Cancel a pending join request
    cancelRequest: protectedProcedure
      .input(z.object({ requestId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.cancelJoinRequest(input.requestId, ctx.user.id);
        notifyBadgeCounts([ctx.user.id]);
        return { success: true };
      }),

    // Trainer-side moderation
    forTrainerPendingRequests: trainerProcedure.query(async ({ ctx }) => {
      return db.getPendingJoinRequestsForTrainer(ctx.user.id);
    }),

    approveRequest: trainerProcedure
      .input(z.object({ requestId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const approved = await db.approveJoinRequest(
          input.requestId,
          ctx.user.id,
        );
        notifyBadgeCounts([ctx.user.id, approved.userId || ctx.user.id]);
        return { success: true };
      }),

    rejectRequest: trainerProcedure
      .input(z.object({ requestId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const rejected = await db.rejectJoinRequest(
          input.requestId,
          ctx.user.id,
        );
        notifyBadgeCounts([ctx.user.id, rejected.userId || ctx.user.id]);
        return { success: true };
      }),
  }),

  // ============================================================================
  // PARTNERSHIPS (Trainer ad/affiliate partnerships)
  // ============================================================================
  partnerships: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerPartnerships(ctx.user.id);
    }),

    availableBusinesses: trainerProcedure.query(async () => {
      return db.getAvailablePartnershipBusinesses();
    }),

    request: trainerProcedure
      .input(z.object({ businessId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const business = await db.getPartnershipBusinessById(input.businessId);
        if (!business) notFound("Business");

        if (business.isAvailable === false || business.status === "inactive") {
          forbidden(
            "This business is not currently accepting partnership requests",
          );
        }

        const commissionRate = Number.parseFloat(
          String(business.commissionRate ?? 0),
        );
        const partnershipId = await db.createTrainerPartnership({
          trainerId: ctx.user.id,
          businessId: input.businessId,
          status: "pending",
          commissionRate: Number.isFinite(commissionRate) ? commissionRate : 0,
          totalEarnings: "0",
          clickCount: 0,
          conversionCount: 0,
        });

        await db.logActivity({
          userId: ctx.user.id,
          action: "partnership_requested",
          entityType: "partnership_business",
          entityId: input.businessId,
          details: {
            partnershipId,
            businessName: business.name,
          },
        });

        return { success: true, id: partnershipId };
      }),

    submitBusiness: trainerProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(255),
          type: z.string().trim().min(1).max(100),
          description: z.string().trim().max(2000).optional(),
          website: z.string().trim().max(512).optional(),
          contactEmail: z.string().trim().email(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const businessId = await db.createPartnershipBusiness({
          name: input.name,
          type: input.type,
          description: input.description || undefined,
          website: input.website || undefined,
          contactEmail: input.contactEmail,
          commissionRate: 0,
          isAvailable: false,
          status: "submitted",
          submittedBy: ctx.user.id,
        });

        await db.logActivity({
          userId: ctx.user.id,
          action: "partnership_business_submitted",
          entityType: "partnership_business",
          entityId: businessId,
          details: {
            businessName: input.name,
            contactEmail: input.contactEmail,
          },
        });

        return { success: true, id: businessId };
      }),
  }),

  // ============================================================================
  // ADMIN (Manager/Coordinator features)
  // ============================================================================
  admin: router({
    users: managerProcedure.query(async () => {
      return db.getAllUsers();
    }),

    usersWithFilters: managerProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
          role: z.string().optional(),
          status: z.enum(["active", "inactive"]).optional(),
          search: z.string().optional(),
          joinedAfter: z.string().optional(),
          joinedBefore: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        return db.getUsersWithFilters({
          limit: input.limit,
          offset: input.offset,
          role: input.role,
          status: input.status,
          search: input.search,
          joinedAfter: input.joinedAfter
            ? new Date(input.joinedAfter)
            : undefined,
          joinedBefore: input.joinedBefore
            ? new Date(input.joinedBefore)
            : undefined,
        });
      }),

    searchUsers: managerProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return db.searchUsers(input.query);
      }),

    deliveries: managerProcedure
      .input(
        z
          .object({
            limit: z.number().min(1).max(200).default(100),
            offset: z.number().min(0).default(0),
            status: z.string().optional(),
            search: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        return db.getAllDeliveries({
          limit: input?.limit,
          offset: input?.offset,
          status: input?.status,
          search: input?.search,
        });
      }),

    lowInventory: managerProcedure
      .input(
        z
          .object({
            threshold: z.number().int().min(0).max(100).default(5),
            limit: z.number().int().min(1).max(100).default(20),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        return db.getLowInventoryProducts({
          threshold: input?.threshold,
          limit: input?.limit,
        });
      }),

    revenueSummary: managerProcedure.query(async () => {
      return db.getRevenueSummary();
    }),

    revenueTrend: managerProcedure
      .input(
        z
          .object({ months: z.number().int().min(1).max(24).default(6) })
          .optional(),
      )
      .query(async ({ input }) => {
        return db.getRevenueTrend({ months: input?.months });
      }),

    updateUserRole: managerProcedure
      .input(
        z.object({
          userId: z.string(),
          role: z.enum([
            "shopper",
            "client",
            "trainer",
            "manager",
            "coordinator",
          ]),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    updateUserStatus: managerProcedure
      .input(
        z.object({
          userId: z.string(),
          active: z.boolean(),
        }),
      )
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.userId, input.active);
        return { success: true };
      }),

    bulkUpdateRole: managerProcedure
      .input(
        z.object({
          userIds: z.array(z.string()).min(1),
          role: z.enum([
            "shopper",
            "client",
            "trainer",
            "manager",
            "coordinator",
          ]),
        }),
      )
      .mutation(async ({ input }) => {
        await db.bulkUpdateUserRole(input.userIds, input.role);
        return { success: true, count: input.userIds.length };
      }),

    bulkUpdateStatus: managerProcedure
      .input(
        z.object({
          userIds: z.array(z.string()).min(1),
          active: z.boolean(),
        }),
      )
      .mutation(async ({ input }) => {
        await db.bulkUpdateUserStatus(input.userIds, input.active);
        return { success: true, count: input.userIds.length };
      }),

    pendingBundles: managerProcedure.query(async () => {
      return db.getPendingReviewBundles();
    }),

    approveBundle: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        await db.updateBundleDraft(input.id, {
          status: "published",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_approved",
          entityType: "bundle_draft",
          entityId: input.id,
          details: { bundleTitle: bundle?.title },
        });
        if (bundle?.trainerId) {
          await sendPushToUsers([bundle.trainerId], {
            title: "Bundle approved",
            body: `Your bundle "${bundle.title}" is now live.`,
            data: {
              type: "bundle_approval",
              bundleId: input.id,
              status: "approved",
            },
          });
        }
        const managerIds = await db.getUserIdsByRoles([
          "manager",
          "coordinator",
        ]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    rejectBundle: managerProcedure
      .input(
        z.object({
          id: z.string(),
          reason: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        await db.updateBundleDraft(input.id, {
          status: "rejected",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
          rejectionReason: input.reason,
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_rejected",
          entityType: "bundle_draft",
          entityId: input.id,
          details: { bundleTitle: bundle?.title, reason: input.reason },
        });
        if (bundle?.trainerId) {
          await sendPushToUsers([bundle.trainerId], {
            title: "Bundle needs revision",
            body: `Your bundle "${bundle.title}" was rejected: ${input.reason}`,
            data: {
              type: "bundle_approval",
              bundleId: input.id,
              status: "rejected",
            },
          });
        }
        const managerIds = await db.getUserIdsByRoles([
          "manager",
          "coordinator",
        ]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    requestChanges: managerProcedure
      .input(
        z.object({
          id: z.string(),
          comments: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        await db.updateBundleDraft(input.id, {
          status: "changes_requested",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
          reviewComments: input.comments,
        });
        if (bundle?.trainerId) {
          const links = getBundleReviewLinks(input.id);
          const message = [
            `Changes requested for "${bundle.title || "Untitled Bundle"}":`,
            input.comments,
            `Bundle: ${links.webUrl}`,
            `App: ${links.deepLink}`,
          ].join("\n\n");
          await sendBundleReviewThreadMessage({
            senderId: ctx.user.id,
            senderName: ctx.user.name || "Coordinator",
            receiverIds: [bundle.trainerId],
            bundleId: input.id,
            content: message,
          });
          await sendPushToUsers([bundle.trainerId], {
            title: "Changes requested",
            body: `Review feedback for "${bundle.title}": ${input.comments}`,
            data: {
              type: "bundle_approval",
              bundleId: input.id,
              status: "changes_requested",
            },
          });
        }
        const managerIds = await db.getUserIdsByRoles([
          "manager",
          "coordinator",
        ]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    // Template management
    templates: managerProcedure.query(async () => {
      return db.getAllBundleTemplates();
    }),

    template: managerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const template = await db.getBundleTemplateById(input.id);
        if (!template) notFound("Template");
        return template;
      }),

    createTemplate: managerProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          goalType: z
            .enum(["weight_loss", "strength", "longevity", "power"])
            .optional(),
          goalsJson: z.any().optional(),
          imageUrl: z.string().optional(),
          basePrice: z.string().optional(),
          defaultServices: z.any().optional(),
          defaultProducts: z.any().optional(),
          active: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return db.createBundleTemplate({
          ...input,
          createdBy: ctx.user.id,
        });
      }),

    updateTemplate: managerProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          goalType: z
            .enum(["weight_loss", "strength", "longevity", "power"])
            .optional(),
          goalsJson: z.any().optional(),
          imageUrl: z.string().optional(),
          basePrice: z.string().optional(),
          defaultServices: z.any().optional(),
          defaultProducts: z.any().optional(),
          active: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const template = await db.getBundleTemplateById(input.id);
        if (!template) notFound("Template");
        const { id, ...data } = input;
        await db.updateBundleTemplate(id, data);
        return { success: true };
      }),

    deleteTemplate: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const template = await db.getBundleTemplateById(input.id);
        if (!template) notFound("Template");
        await db.deleteBundleTemplate(input.id);
        return { success: true };
      }),

    // Bundle management (coordinator/manager-created bundles)
    myBundles: managerProcedure.query(async () => {
      return db.getAdminBundles();
    }),

    nonTemplateBundles: managerProcedure.query(async () => {
      return db.getNonTemplateBundles();
    }),

    createBundle: managerProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          price: z.string().optional(),
          cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
          goalsJson: z.any().optional(),
          servicesJson: z.any().optional(),
          productsJson: z.any().optional(),
          imageUrl: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        return db.createBundleDraft({
          trainerId: null,
          title: input.title,
          description: input.description,
          price: input.price,
          cadence: input.cadence,
          goalsJson: input.goalsJson,
          servicesJson: input.servicesJson,
          productsJson: input.productsJson,
          imageUrl: input.imageUrl,
          status: "published", // Managers/coordinators skip review
        });
      }),

    updateBundle: managerProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          price: z.string().optional(),
          cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
          goalsJson: z.any().optional(),
          servicesJson: z.any().optional(),
          productsJson: z.any().optional(),
          imageUrl: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        const { id, ...data } = input;
        await db.updateBundleDraft(id, data);
        return { success: true };
      }),

    getBundle: managerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) return undefined;
        return bundle;
      }),

    publishedBundlesWithMeta: managerProcedure.query(async () => {
      const bundles = await db.getPublishedBundles();
      const trainerIds = Array.from(
        new Set(bundles.map((bundle) => bundle.trainerId).filter(Boolean) as string[]),
      );
      const trainers = await db.getUsersByIds(trainerIds);
      const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));

      const linksByBundleId = new Map<
        string,
        Awaited<ReturnType<typeof db.getCampaignAccountsForBundle>>
      >();
      for (const bundle of bundles) {
        if (!bundle.id) continue;
        linksByBundleId.set(bundle.id, await db.getCampaignAccountsForBundle(bundle.id));
      }
      const accountIds = Array.from(
        new Set(
          Array.from(linksByBundleId.values()).flatMap((links) =>
            links.map((link) => link.campaignAccountId),
          ),
        ),
      ).filter(Boolean);
      const accounts = await db.getCampaignAccountsByIds(accountIds);
      const accountById = new Map(accounts.map((account) => [account.id, account]));

      return bundles.map((bundle) => {
        const links = linksByBundleId.get(bundle.id) || [];
        const primaryBrandLink =
          links.find((link) => link.relationType === "brand") || links[0] || null;
        const primaryBrand = primaryBrandLink
          ? accountById.get(primaryBrandLink.campaignAccountId)
          : null;
        return {
          ...bundle,
          trainerName: bundle.trainerId
            ? trainerById.get(bundle.trainerId)?.name || "Trainer"
            : "Trainer",
          trainerPhotoUrl: bundle.trainerId
            ? trainerById.get(bundle.trainerId)?.photoUrl || null
            : null,
          brandName: primaryBrand?.name || null,
        };
      });
    }),

    promotedTemplates: managerProcedure.query(async () => {
      return db.getAllPromotedTemplates();
    }),

    listCampaignTemplates: managerProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            campaignAccountId: z.string().optional(),
            activeOnly: z.boolean().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const templates = await db.getAllPromotedTemplates();
        const templateLinks = await Promise.all(
          templates.map(async (template) => ({
            templateId: template.id,
            links: await db.getCampaignAccountsForTemplate(template.id),
          })),
        );
        const accountIds = Array.from(
          new Set(
            templateLinks.flatMap((entry) =>
              entry.links.map((link) => link.campaignAccountId),
            ),
          ),
        ).filter(Boolean);
        const accounts = await db.getCampaignAccountsByIds(accountIds);
        const accountById = new Map(accounts.map((account) => [account.id, account]));
        const searchTerm = String(input?.search || "").trim().toLowerCase();
        return templates
          .map((template) => {
            const entry = templateLinks.find((row) => row.templateId === template.id);
            const links = entry?.links || [];
            const linkedAccounts = links
              .map((link) => accountById.get(link.campaignAccountId))
              .filter(Boolean);
            const brandAccounts = links
              .filter((link) => link.relationType === "brand")
              .map((link) => accountById.get(link.campaignAccountId))
              .filter(Boolean);
            const primaryBrand = brandAccounts[0] || linkedAccounts[0] || null;
            return {
              ...template,
              linkedAccounts,
              primaryBrandName: primaryBrand?.name || null,
              publicShareUrl: template.publicShareSlug
                ? buildCampaignShareUrl(template.publicShareSlug)
                : null,
            };
          })
          .filter((template) => {
            if (input?.activeOnly && !template.templateActive) return false;
            if (
              input?.campaignAccountId &&
              !template.linkedAccounts.some(
                (account: any) => account.id === input.campaignAccountId,
              )
            ) {
              return false;
            }
            if (!searchTerm) return true;
            const haystack = [
              template.title,
              template.description,
              template.primaryBrandName,
              ...(template.linkedAccounts || []).map((account: any) => account.name),
              template.publicShareSlug,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return haystack.includes(searchTerm);
          });
      }),

    listCampaignAccounts: managerProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            accountType: z.enum(["brand", "customer", "all"]).optional(),
            activeOnly: z.boolean().optional(),
            limit: z.number().min(1).max(500).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        return db.listCampaignAccounts({
          search: input?.search,
          accountType: input?.accountType,
          activeOnly: input?.activeOnly,
          limit: input?.limit,
        });
      }),

    createCampaignAccount: managerProcedure
      .input(
        z.object({
          name: z.string().min(1).max(255),
          accountType: z.enum(["brand", "customer"]),
          slug: z.string().max(255).optional(),
          websiteUrl: z.string().optional(),
          contactName: z.string().max(255).optional(),
          contactEmail: z.string().email().optional(),
          notes: z.string().optional(),
          active: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const created = await db.createCampaignAccount({
          name: input.name,
          accountType: input.accountType,
          slug: input.slug || null,
          websiteUrl: input.websiteUrl || null,
          contactName: input.contactName || null,
          contactEmail: input.contactEmail || null,
          notes: input.notes || null,
          active: input.active ?? true,
          createdBy: ctx.user.id,
        });
        return { success: true, account: created || null };
      }),

    getTemplateCampaignAccounts: managerProcedure
      .input(z.object({ bundleId: z.string() }))
      .query(async ({ input }) => {
        const links = await db.getCampaignAccountsForTemplate(input.bundleId);
        const accountIds = Array.from(
          new Set(links.map((link) => link.campaignAccountId).filter(Boolean)),
        );
        const accounts = await db.getCampaignAccountsByIds(accountIds);
        const accountById = new Map(accounts.map((account) => [account.id, account]));
        return links.map((link) => ({
          ...link,
          account: accountById.get(link.campaignAccountId) || null,
        }));
      }),

    setTemplateCampaignAccounts: managerProcedure
      .input(
        z.object({
          bundleId: z.string(),
          links: z.array(
            z.object({
              campaignAccountId: z.string(),
              relationType: z.enum(["brand", "customer", "partner"]).optional(),
              allocationPct: z.string().optional(),
              metadata: z
                .object({
                  postingRules: z
                    .object({
                      requiredHashtags: z.array(z.string()).optional(),
                      requiredMentions: z.array(z.string()).optional(),
                      allowedPlatforms: z.array(z.string()).optional(),
                      postingWindowStart: z.string().nullable().optional(),
                      postingWindowEnd: z.string().nullable().optional(),
                      requiredLinkSlug: z.string().nullable().optional(),
                      requiredPosts: z.number().int().min(1).nullable().optional(),
                    })
                    .optional(),
                })
                .nullable()
                .optional(),
            }),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        if (!bundle.isTemplate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This bundle is not a template.",
          });
        }
        await db.setCampaignAccountsForTemplate(
          input.bundleId,
          input.links.map((link) => ({
            campaignAccountId: link.campaignAccountId,
            relationType: link.relationType || "brand",
            allocationPct: link.allocationPct || null,
            metadata: link.metadata || null,
          })),
        );
        return { success: true };
      }),

    generateCampaignShareLink: managerProcedure
      .input(z.object({ bundleId: z.string() }))
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        if (!bundle.isTemplate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This bundle is not a campaign template.",
          });
        }

        const base = slugifyForUrl(bundle.title || "campaign");
        const attempts = 8;
        let lastError: unknown = null;
        for (let i = 0; i < attempts; i += 1) {
          const suffix = randomBytes(3).toString("hex");
          const slug = `${base}-${suffix}`;
          try {
            await db.updateTemplateSettings(input.bundleId, {
              publicShareSlug: slug,
              publicShareEnabled: true,
            });
            return {
              success: true,
              slug,
              enabled: true,
              url: buildCampaignShareUrl(slug),
            };
          } catch (error: any) {
            lastError = error;
            const msg = String(error?.message || "").toLowerCase();
            if (msg.includes("duplicate") || msg.includes("unique")) continue;
            throw error;
          }
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            (lastError as any)?.message ||
            "Unable to generate a unique campaign share link.",
        });
      }),

    setCampaignShareEnabled: managerProcedure
      .input(z.object({ bundleId: z.string(), enabled: z.boolean() }))
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        if (!bundle.isTemplate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This bundle is not a campaign template.",
          });
        }
        let slug = bundle.publicShareSlug;
        if (input.enabled && !slug) {
          const base = slugifyForUrl(bundle.title || "campaign");
          const generated = `${base}-${randomBytes(3).toString("hex")}`;
          slug = generated;
        }
        await db.updateTemplateSettings(input.bundleId, {
          publicShareEnabled: input.enabled,
          publicShareSlug: slug || null,
        });
        return {
          success: true,
          enabled: input.enabled,
          slug: slug || null,
          url: slug ? buildCampaignShareUrl(slug) : null,
        };
      }),

    promoteBundleToTemplate: managerProcedure
      .input(
        z.object({
          bundleId: z.string(),
          templateVisibility: z.array(z.string()).optional(),
          discountType: z.enum(["percentage", "fixed"]).nullable().optional(),
          discountValue: z.string().nullable().optional(),
          availabilityStart: z.string().nullable().optional(),
          availabilityEnd: z.string().nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        await db.promoteBundleToTemplate(input.bundleId, {
          templateVisibility: input.templateVisibility,
          discountType: input.discountType,
          discountValue: input.discountValue,
          availabilityStart: input.availabilityStart,
          availabilityEnd: input.availabilityEnd,
        });
        const existingBundleLinks = await db.getCampaignAccountsForBundle(
          input.bundleId,
        );
        if (existingBundleLinks.length > 0) {
          await db.setCampaignAccountsForTemplate(
            input.bundleId,
            existingBundleLinks.map((link) => ({
              campaignAccountId: link.campaignAccountId,
              relationType: link.relationType,
              allocationPct: link.allocationPct,
              metadata: link.metadata || null,
            })),
          );
        }
        return { success: true };
      }),

    updateTemplateSettings: managerProcedure
      .input(
        z.object({
          bundleId: z.string(),
          templateVisibility: z.array(z.string()).optional(),
          discountType: z.enum(["percentage", "fixed"]).nullable().optional(),
          discountValue: z.string().nullable().optional(),
          availabilityStart: z.string().nullable().optional(),
          availabilityEnd: z.string().nullable().optional(),
          templateActive: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        if (!bundle.isTemplate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This bundle is not a template.",
          });
        }
        const { bundleId, ...settings } = input;
        await db.updateTemplateSettings(bundleId, settings);
        return { success: true };
      }),

    demoteTemplate: managerProcedure
      .input(z.object({ bundleId: z.string() }))
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        if (!bundle.isTemplate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This bundle is not a template.",
          });
        }
        await db.demoteTemplate(input.bundleId);
        await db.setCampaignAccountsForTemplate(input.bundleId, []);
        return { success: true };
      }),

    campaignMetricsSummary: managerProcedure
      .input(
        z
          .object({
            campaignAccountId: z.string().optional(),
            bundleDraftId: z.string().optional(),
            fromDate: z.string().optional(),
            toDate: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const rowsRaw = await db.getCampaignAccountMetricsSummary({
          campaignAccountId: input?.campaignAccountId,
          fromDate: input?.fromDate,
          toDate: input?.toDate,
        });
        const rows = input?.bundleDraftId
          ? rowsRaw.filter((row) => row.bundleDraftId === input.bundleDraftId)
          : rowsRaw;
        const trainerIds = Array.from(
          new Set(rows.map((row) => row.trainerId).filter(Boolean)),
        );
        const accountIds = Array.from(
          new Set(rows.map((row) => row.campaignAccountId).filter(Boolean)),
        );
        const bundleIds = Array.from(
          new Set(rows.map((row) => row.bundleDraftId).filter(Boolean)),
        );
        const [trainers, accounts, bundles] = await Promise.all([
          db.getUsersByIds(trainerIds),
          db.getCampaignAccountsByIds(accountIds),
          Promise.all(bundleIds.map((id) => db.getBundleDraftById(id))),
        ]);
        const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));
        const accountById = new Map(accounts.map((account) => [account.id, account]));
        const bundleById = new Map(
          bundles.filter(Boolean).map((bundle) => [String(bundle!.id), bundle!]),
        );
        return rows.map((row) => ({
          ...row,
          trainerName: trainerById.get(row.trainerId)?.name || "Trainer",
          campaignAccountName:
            accountById.get(row.campaignAccountId)?.name || "Campaign Account",
          bundleTitle: bundleById.get(row.bundleDraftId)?.title || "Campaign bundle",
        }));
      }),

    campaignDashboardSummary: managerProcedure
      .input(
        z.object({
          bundleId: z.string(),
          fromDate: z.string().optional(),
          toDate: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (bundle?.trainerId) {
          await syncTrainerCampaignPostAttributions({
            trainerId: bundle.trainerId,
            bundleDraftId: bundle.id,
          });
        }
        const [rowsRaw, signupStats] = await Promise.all([
          db.getCampaignAccountMetricsSummary({
            fromDate: input?.fromDate,
            toDate: input?.toDate,
          }),
          db.getCampaignSignupStats(input.bundleId),
        ]);
        const rows = rowsRaw.filter((row) => row.bundleDraftId === input.bundleId);
        const trainerIds = Array.from(
          new Set(rows.map((row) => row.trainerId).filter(Boolean)),
        );
        const accountIds = Array.from(
          new Set(rows.map((row) => row.campaignAccountId).filter(Boolean)),
        );
        const [trainers, accounts] = await Promise.all([
          db.getUsersByIds(trainerIds),
          db.getCampaignAccountsByIds(accountIds),
        ]);
        const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));
        const accountById = new Map(accounts.map((account) => [account.id, account]));
        const enrichedRows = rows.map((row) => ({
          ...row,
          trainerName: trainerById.get(row.trainerId)?.name || "Trainer",
          campaignAccountName:
            accountById.get(row.campaignAccountId)?.name || "Campaign Account",
          bundleTitle: bundle?.title || "Campaign",
        }));
        return {
          bundleId: input.bundleId,
          bundleTitle: bundle?.title || "Campaign",
          signupStats,
          rows: enrichedRows,
        };
      }),

    campaignReportCsv: managerProcedure
      .input(
        z
          .object({
            campaignAccountId: z.string().optional(),
            fromDate: z.string().optional(),
            toDate: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const rows = await db.getCampaignAccountMetricsSummary({
          campaignAccountId: input?.campaignAccountId,
          fromDate: input?.fromDate,
          toDate: input?.toDate,
        });
        const trainerIds = Array.from(
          new Set(rows.map((row) => row.trainerId).filter(Boolean)),
        );
        const accountIds = Array.from(
          new Set(rows.map((row) => row.campaignAccountId).filter(Boolean)),
        );
        const bundleIds = Array.from(
          new Set(rows.map((row) => row.bundleDraftId).filter(Boolean)),
        );
        const [trainers, accounts, bundles] = await Promise.all([
          db.getUsersByIds(trainerIds),
          db.getCampaignAccountsByIds(accountIds),
          Promise.all(bundleIds.map((id) => db.getBundleDraftById(id))),
        ]);
        const trainerById = new Map(trainers.map((trainer) => [trainer.id, trainer]));
        const accountById = new Map(accounts.map((account) => [account.id, account]));
        const bundleById = new Map(
          bundles.filter(Boolean).map((bundle) => [String(bundle!.id), bundle!]),
        );
        const toCell = (value: unknown) => {
          const text = String(value ?? "");
          if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
            return `"${text.replace(/"/g, "\"\"")}"`;
          }
          return text;
        };
        const header = [
          "campaign_account",
          "campaign_offer",
          "trainer",
          "views",
          "engagements",
          "clicks",
          "ctr_pct",
          "delivery_pct",
          "on_time_pct",
          "followers",
          "latest_metric_date",
        ];
        const lines = [header.join(",")];
        for (const row of rows) {
          const ctrPct =
            Number(row.views || 0) > 0
              ? (Number(row.clicks || 0) / Number(row.views || 1)) * 100
              : 0;
          const deliveryPct =
            Number(row.requiredPosts || 0) > 0
              ? (Number(row.postsDelivered || 0) / Number(row.requiredPosts || 1)) *
                100
              : 0;
          const onTimePct =
            Number(row.postsDelivered || 0) > 0
              ? (Number(row.postsOnTime || 0) / Number(row.postsDelivered || 1)) *
                100
              : 0;
          lines.push(
            [
              accountById.get(row.campaignAccountId)?.name || "Campaign Account",
              bundleById.get(row.bundleDraftId)?.title || "Campaign bundle",
              trainerById.get(row.trainerId)?.name || "Trainer",
              Number(row.views || 0),
              Number(row.engagements || 0),
              Number(row.clicks || 0),
              ctrPct.toFixed(2),
              deliveryPct.toFixed(2),
              onTimePct.toFixed(2),
              Number(row.followers || 0),
              row.latestMetricDate || "",
            ]
              .map(toCell)
              .join(","),
          );
        }
        const csv = `${lines.join("\n")}\n`;
        return {
          fileName: `campaign-report-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: csv,
        };
      }),

    campaignReportPdf: managerProcedure
      .input(
        z
          .object({
            campaignAccountId: z.string().optional(),
            fromDate: z.string().optional(),
            toDate: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const rows = await db.getCampaignAccountMetricsSummary({
          campaignAccountId: input?.campaignAccountId,
          fromDate: input?.fromDate,
          toDate: input?.toDate,
        });
        const totals = rows.reduce(
          (acc, row) => {
            acc.views += Number(row.views || 0);
            acc.engagements += Number(row.engagements || 0);
            acc.clicks += Number(row.clicks || 0);
            acc.postsDelivered += Number(row.postsDelivered || 0);
            acc.requiredPosts += Number(row.requiredPosts || 0);
            return acc;
          },
          {
            views: 0,
            engagements: 0,
            clicks: 0,
            postsDelivered: 0,
            requiredPosts: 0,
          },
        );
        const ctr =
          totals.views > 0 ? (totals.clicks / Math.max(1, totals.views)) * 100 : 0;
        const deliveryPct =
          totals.requiredPosts > 0
            ? (totals.postsDelivered / Math.max(1, totals.requiredPosts)) * 100
            : 0;
        const lines = [
          "Campaign Performance Report",
          `Generated: ${new Date().toISOString()}`,
          "",
          "Delivery",
          `- Posts Delivered: ${totals.postsDelivered.toLocaleString()}`,
          `- Required Posts: ${totals.requiredPosts.toLocaleString()}`,
          `- Delivery %: ${deliveryPct.toFixed(2)}%`,
          "",
          "Performance",
          `- Views: ${totals.views.toLocaleString()}`,
          `- Engagements: ${totals.engagements.toLocaleString()}`,
          `- Clicks: ${totals.clicks.toLocaleString()}`,
          `- CTR: ${ctr.toFixed(2)}%`,
          "",
          "Business Outcomes",
          "- Use trainer modeled assumptions for intent/conversion projections.",
          "",
          "Finance",
          "- Export CSV for line-level campaign offer facts.",
        ];
        return {
          fileName: `campaign-report-${new Date().toISOString().slice(0, 10)}.pdf.txt`,
          mimeType: "text/plain",
          content: lines.join("\n"),
        };
      }),

    // User Activity Logs
    getUserActivityLogs: managerProcedure
      .input(z.object({ userId: z.string(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getUserActivityLogs(input.userId, input.limit);
      }),

    getRecentActivityLogs: managerProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ input }) => {
        return db.getRecentActivityLogs(input.limit);
      }),

    replayFailedPhylloEvents: managerProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(200).default(50),
          })
          .optional(),
      )
      .mutation(async ({ input }) => {
        const failedRows = await db.listPhylloWebhookEvents({
          status: "failed",
          limit: input?.limit,
        });
        let replayed = 0;
        for (const row of failedRows) {
          try {
            const count = await processPhylloWebhookPayload(row.payload);
            if (count > 0) replayed += count;
          } catch (error) {
            logWarn("phyllo.webhook.replay_failed", {
              eventId: row.providerEventId,
              message: String((error as any)?.message || "Unknown replay error"),
            });
          }
        }
        return { success: true, replayed, attempted: failedRows.length };
      }),

    phylloWebhookHealth: managerProcedure.query(async () => {
      return db.getPhylloWebhookStats();
    }),

    /** Unified activity feed — combines user actions, system logs, and payment events */
    activityFeed: managerProcedure
      .input(
        z.object({
          limit: z.number().default(50),
          category: z
            .enum(["all", "auth", "admin", "payments", "shopify"])
            .default("all"),
        }),
      )
      .query(async ({ input }) => {
        const items: Array<{
          id: string;
          category: string;
          action: string;
          description: string;
          userId: string | null;
          userName: string | null;
          metadata: any;
          createdAt: string;
        }> = [];

        // 1. User activity logs (admin actions)
        if (
          input.category === "all" ||
          input.category === "admin" ||
          input.category === "auth"
        ) {
          const userLogs = await db.getRecentActivityLogs(input.limit);
          // Resolve user names for the logs
          const userIds = new Set<string>();
          userLogs.forEach((log) => {
            if (log.performedBy) userIds.add(log.performedBy);
            if (log.targetUserId) userIds.add(log.targetUserId);
          });
          const userMap = new Map<string, string>();
          for (const uid of userIds) {
            const u = await db.getUserById(uid);
            if (u?.name) userMap.set(uid, u.name);
          }

          for (const log of userLogs) {
            const performer = userMap.get(log.performedBy) || "Unknown";
            const target = userMap.get(log.targetUserId) || "Unknown user";
            let description = "";
            const cat = log.action.includes("impersonation") ? "auth" : "admin";

            switch (log.action) {
              case "role_changed":
                description = `${performer} changed ${target}'s role: ${log.previousValue || "?"} → ${log.newValue || "?"}`;
                break;
              case "status_changed":
                if (String(log.notes || "").startsWith("social_program_invite_accepted:")) {
                  description = `${performer} accepted the exclusive Social Posts invitation.`;
                } else if (String(log.notes || "").startsWith("social_program_invite_declined:")) {
                  description = `${performer} declined the exclusive Social Posts invitation and reset to uninvited.`;
                } else if (String(log.notes || "").startsWith("social_program_paused:")) {
                  description = `${performer} paused ${target}'s Social Posts access.`;
                } else if (String(log.notes || "").startsWith("social_program_activated:")) {
                  description = `${performer} activated ${target}'s Social Posts access.`;
                } else if (String(log.notes || "").startsWith("social_program_banned_reset:")) {
                  description = `${performer} removed ${target} from Social Posts and reset access to uninvited.`;
                } else {
                  description = `${performer} ${log.newValue === "true" ? "activated" : "deactivated"} ${target}`;
                }
                break;
              case "impersonation_started":
                description = `${performer} started impersonating ${target}`;
                break;
              case "impersonation_ended":
                description = `${performer} stopped impersonating ${target}`;
                break;
              case "profile_updated":
                description = `${performer} updated ${target}'s profile`;
                break;
              case "invited":
                if (String(log.notes || "").startsWith("social_program_invited:")) {
                  description = `${performer} invited ${target} to Social Posts.`;
                } else {
                  description = `${performer} invited ${log.notes || target}`;
                }
                break;
              case "deleted":
                description = `${performer} deleted ${target}`;
                break;
              default:
                description = `${performer}: ${log.action}${log.notes ? ` — ${log.notes}` : ""}`;
            }

            if (input.category === "all" || input.category === cat) {
              items.push({
                id: log.id,
                category: cat,
                action: log.action,
                description,
                userId: log.performedBy,
                userName: performer,
                metadata: {
                  targetUserId: log.targetUserId,
                  previousValue: log.previousValue,
                  newValue: log.newValue,
                },
                createdAt: log.createdAt,
              });
            }
          }
        }

        // 2. Payment events
        if (input.category === "all" || input.category === "payments") {
          const paymentLogs = await db.getPaymentLogsByReference("%"); // we need a new function
          // Actually, let's query payment_sessions directly for a feed
          const { getServerSupabase } = await import("../lib/supabase");
          const sb = getServerSupabase();
          const { data: recentPayments } = await sb
            .from("payment_sessions")
            .select(
              "id, merchant_reference, requested_by, amount_minor, currency, status, description, method, created_at, updated_at",
            )
            .order("updated_at", { ascending: false })
            .limit(input.limit);

          for (const ps of recentPayments || []) {
            const requester = await db.getUserById(ps.requested_by);
            const amount = (ps.amount_minor / 100).toFixed(2);
            items.push({
              id: `pay-${ps.id}`,
              category: "payments",
              action: ps.status,
              description: `${requester?.name || "Unknown"} — ${ps.currency} ${amount} ${ps.description || ""} (${ps.status})`,
              userId: ps.requested_by,
              userName: requester?.name || null,
              metadata: {
                merchantReference: ps.merchant_reference,
                method: ps.method,
                amountMinor: ps.amount_minor,
              },
              createdAt: ps.updated_at || ps.created_at,
            });
          }
        }

        // 3. Shopify product sync — check activity_logs for shopify events
        if (input.category === "all" || input.category === "shopify") {
          const { getServerSupabase: getSb } = await import("../lib/supabase");
          const sb2 = getSb();
          const { data: actLogs } = await sb2
            .from("activity_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(input.limit);

          for (const al of actLogs || []) {
            items.push({
              id: `act-${al.id}`,
              category: al.action?.includes("shopify") ? "shopify" : "admin",
              action: al.action,
              description: `${al.action}${al.entity_type ? ` (${al.entity_type})` : ""}`,
              userId: al.user_id,
              userName: null,
              metadata: al.details,
              createdAt: al.created_at,
            });
          }
        }

        // Sort by createdAt descending and limit
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        return items.slice(0, input.limit);
      }),

    logUserAction: managerProcedure
      .input(
        z.object({
          targetUserId: z.string(),
          action: z.enum([
            "role_changed",
            "status_changed",
            "impersonation_started",
            "impersonation_ended",
            "profile_updated",
            "invited",
            "deleted",
          ]),
          previousValue: z.string().optional(),
          newValue: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await db.logUserActivity({
          targetUserId: input.targetUserId,
          performedBy: ctx.user.id,
          action: input.action,
          previousValue: input.previousValue,
          newValue: input.newValue,
          notes: input.notes,
        });
        return { success: true };
      }),

    // User Impersonation
    getUserForImpersonation: managerProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        return db.getUserById(input.userId);
      }),

    // User Invitations
    createUserInvitation: managerProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().optional(),
          role: z.enum([
            "shopper",
            "client",
            "trainer",
            "manager",
            "coordinator",
          ]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const token = crypto.randomUUID().replace(/-/g, "");
        const expiresAtDate = new Date();
        expiresAtDate.setDate(expiresAtDate.getDate() + 7); // Expires in 7 days
        const expiresAtIso = expiresAtDate.toISOString();

        const id = await db.createUserInvitation({
          invitedBy: ctx.user.id,
          email: input.email,
          name: input.name,
          role: input.role,
          token,
          expiresAt: expiresAtIso,
        });

        let emailMessageId: string;
        try {
          emailMessageId = await sendInviteEmail({
            to: input.email,
            token,
            recipientName: input.name,
            trainerName: ctx.user.name || ctx.user.email || "Bright Coach",
            expiresAtIso,
          });
        } catch (error) {
          // Keep manager/coordinator invite flow fail-closed: no "sent" success when email fails.
          try {
            await db.revokeUserInvitation(id);
          } catch (revokeError) {
            console.error(
              "[Invite] Failed to revoke user invitation after email failure",
              revokeError,
            );
          }
          logError("invite.user.email_failed", error, {
            inviterId: ctx.user.id,
            inviterRole: ctx.user.role,
            recipient: input.email,
            inviteRole: input.role,
          });
          const message =
            error instanceof Error
              ? error.message
              : String(error || "Invite email failed");
          await notifyInviteFailureByMessage(ctx.user, input.email, message);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: getInviteEmailFailureUserMessage(error),
          });
        }

        // Log the invitation
        await db.logUserActivity({
          targetUserId: ctx.user.id, // No target user yet — log under inviter
          performedBy: ctx.user.id,
          action: "invited",
          newValue: input.role,
          notes: `Invited ${input.email} as ${input.role} (emailMessageId: ${emailMessageId})`,
        });

        return { success: true, id, token, emailMessageId };
      }),

    getUserInvitations: managerProcedure
      .input(
        z.object({
          limit: z.number().default(20),
          offset: z.number().default(0),
          status: z
            .enum(["pending", "accepted", "expired", "revoked"])
            .optional(),
        }),
      )
      .query(async ({ input }) => {
        return db.getUserInvitations(input);
      }),

    revokeUserInvitation: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.revokeUserInvitation(input.id);
        return { success: true };
      }),

    resendUserInvitation: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const invitation = await db.getUserInvitationById(input.id);
        if (!invitation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invitation not found",
          });
        }
        if (invitation.status === "accepted") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invitation has already been accepted.",
          });
        }
        if (invitation.status === "revoked") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invitation has been revoked.",
          });
        }

        // Rotate token and extend expiry whenever invite is resent.
        const refreshedToken = crypto.randomUUID().replace(/-/g, "");
        const refreshedExpiry = new Date();
        refreshedExpiry.setDate(refreshedExpiry.getDate() + 7);
        await db.updateUserInvitation(invitation.id, {
          token: refreshedToken,
          expiresAt: refreshedExpiry.toISOString(),
          status: "pending",
        });

        let emailMessageId: string;
        try {
          emailMessageId = await sendInviteEmail({
            to: invitation.email,
            token: refreshedToken,
            recipientName: invitation.name || undefined,
            trainerName: ctx.user.name || "Bright Coach",
            expiresAtIso: refreshedExpiry.toISOString(),
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : String(error || "Invite email failed");
          await notifyInviteFailureByMessage(
            ctx.user,
            invitation.email,
            message,
          );
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getInviteEmailFailureUserMessage(error),
          });
        }

        return { success: true, emailMessageId };
      }),
  }),

  // ============================================================================
  // TRAINER DASHBOARD
  // ============================================================================
  trainerDashboard: router({
    stats: trainerProcedure.query(async ({ ctx }) => {
      const clients = await db.getClientsByTrainer(ctx.user.id);
      const bundles = await db.getBundleDraftsByTrainer(ctx.user.id);
      const orders = await db.getOrdersByTrainer(ctx.user.id);
      const earnings = await db.getEarningsByTrainer(ctx.user.id);

      const totalEarnings = earnings.reduce(
        (sum, e) => sum + parseFloat(e.amount || "0"),
        0,
      );
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyEarnings = earnings
        .filter((e) => new Date(e.createdAt) >= startOfMonth)
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

      return {
        totalEarnings,
        monthlyEarnings,
        activeClients: clients.filter((c) => c.status === "active").length,
        activeBundles: bundles.filter((b) => b.status === "published").length,
        pendingOrders: orders.filter((o) => o.status === "pending").length,
        completedDeliveries: 0, // Would need delivery query
      };
    }),

    recentOrders: trainerProcedure.query(async ({ ctx }) => {
      const orders = await db.getOrdersByTrainer(ctx.user.id);
      return orders.slice(0, 5);
    }),

    todaySessions: trainerProcedure.query(async ({ ctx }) => {
      const sessions = await db.getUpcomingSessions(ctx.user.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return sessions.filter((s) => {
        const sessionDate = new Date(s.sessionDate);
        return sessionDate >= today && sessionDate < tomorrow;
      });
    }),

    points: trainerProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      const totalPoints = (user as any)?.totalPoints || 0;

      let statusTier = "Getting Started";
      if (totalPoints >= 5000) statusTier = "Elite";
      else if (totalPoints >= 2000) statusTier = "Pro";
      else if (totalPoints >= 1000) statusTier = "Growing";

      return { totalPoints, statusTier };
    }),

    pointHistory: trainerProcedure
      .input(
        z
          .object({ limit: z.number().int().min(1).max(100).default(20) })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const limit = input?.limit ?? 20;

        const [clients, sessions, orders] = await Promise.all([
          db.getClientsByTrainer(ctx.user.id),
          db.getSessionsByTrainer(ctx.user.id),
          db.getOrdersByTrainer(ctx.user.id),
        ]);

        const clientNameById = new Map<string, string>();
        clients.forEach((client) => {
          clientNameById.set(client.id, client.name || "Client");
        });

        const entries: Array<{
          id: string;
          activity: string;
          points: number;
          date: string;
          clientName?: string;
        }> = [];

        sessions
          .filter((session) => session.status === "completed")
          .forEach((session) => {
            const date =
              session.completedAt || session.sessionDate || session.createdAt;
            if (!date) return;
            entries.push({
              id: `session-${session.id}`,
              activity: "Completed a session",
              points: 10,
              date,
              clientName: session.clientId
                ? clientNameById.get(session.clientId)
                : undefined,
            });
          });

        orders
          .filter((order) =>
            ["paid", "completed", "delivered"].includes(
              String(order.paymentStatus || order.status || ""),
            ),
          )
          .forEach((order) => {
            const date =
              order.deliveredAt || order.updatedAt || order.createdAt;
            if (!date) return;
            entries.push({
              id: `order-${order.id}`,
              activity: "Client completed an order",
              points: 5,
              date,
              clientName: order.customerName || undefined,
            });
          });

        clients.forEach((client) => {
          const date = client.acceptedAt || client.createdAt;
          if (!date) return;
          entries.push({
            id: `client-${client.id}`,
            activity: "New client joined",
            points: 50,
            date,
            clientName: client.name || undefined,
          });
        });

        return entries
          .filter((entry) => !Number.isNaN(new Date(entry.date).getTime()))
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
          .slice(0, limit);
      }),
  }),

  // ============================================================================
  // AI (Image generation and LLM features)
  // ============================================================================
  ai: router({
    trainerAssistant: trainerProcedure
      .input(
        z.object({
          message: z.string().min(1).max(4000),
          provider: z.enum(["auto", "chatgpt", "claude", "gemini"]).optional(),
          allowMutations: z.boolean().optional(),
          conversationId: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        let conversationMessages: db.Message[] | undefined;
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(
            input.conversationId,
            ctx.user.id,
          );
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
          conversationMessages = await db.getMessagesByConversation(
            input.conversationId,
          );
        }

        return runTrainerAssistant({
          trainer: ctx.user,
          prompt: input.message,
          provider: input.provider || "auto",
          allowMutations: input.allowMutations !== false,
          conversationMessages,
        });
      }),

    generateImage: protectedProcedure
      .input(
        z.object({
          prompt: z.string().min(1).max(1000),
          style: z
            .enum(["modern", "fitness", "wellness", "professional"])
            .optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const result = await generateImage({
          prompt: input.prompt,
        });
        return { url: result.url };
      }),

    generateBundleImage: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          goals: z.array(z.string()).optional(),
          style: z
            .enum(["modern", "fitness", "wellness", "professional"])
            .optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const goalsText = input.goals?.length
          ? `focusing on ${input.goals.join(", ")}`
          : "";
        const styleDescriptions: Record<string, string> = {
          modern:
            "clean, minimalist, modern design with geometric shapes and gradients",
          fitness: "energetic, dynamic fitness imagery with athletic elements",
          wellness:
            "calm, serene wellness imagery with natural elements and soft colors",
          professional:
            "professional, corporate style with clean lines and business aesthetics",
        };
        const styleDesc = styleDescriptions[input.style || "fitness"];

        const prompt = `Create a professional fitness bundle cover image for "${input.title}". ${input.description ? `The bundle is about: ${input.description}.` : ""} ${goalsText}. Style: ${styleDesc}. The image should be suitable as a product thumbnail, with no text overlays, high quality, and visually appealing for a fitness/wellness mobile app.`;

        const result = await generateImage({ prompt });
        return { url: result.url };
      }),
  }),

  // ============================================================================
  // VOICE (Speech-to-text)
  // ============================================================================
  voice: router({
    transcribe: protectedProcedure
      .input(
        z.object({
          audioUrl: z.string().min(1).max(2048),
          language: z.string().min(2).max(16).optional(),
          prompt: z.string().min(1).max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const audioUrl = toAbsoluteRequestUrl(ctx.req, input.audioUrl.trim());
        const result = await transcribeAudio({
          audioUrl,
          language: input.language?.trim(),
          prompt: input.prompt?.trim(),
        });

        if ("error" in result) {
          const code =
            result.code === "FILE_TOO_LARGE"
              ? "PAYLOAD_TOO_LARGE"
              : result.code === "INVALID_FORMAT" ||
                  result.code === "TRANSCRIPTION_FAILED"
                ? "BAD_REQUEST"
                : "INTERNAL_SERVER_ERROR";

          throw new TRPCError({
            code,
            message: result.details
              ? `${result.error}: ${result.details}`
              : result.error,
          });
        }

        return result;
      }),
  }),

  // ============================================================================
  // COORDINATOR (Impersonation and system config)
  // ============================================================================
  coordinator: router({
    stats: coordinatorProcedure.query(async () => {
      return db.getCoordinatorStats();
    }),

    topTrainers: coordinatorProcedure.query(async () => {
      return db.getTopTrainers(5);
    }),

    topBundles: coordinatorProcedure.query(async () => {
      return db.getTopBundles(5);
    }),

    impersonate: coordinatorProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser) {
          throw new Error("User not found");
        }
        // Log the impersonation
        await db.logActivity({
          userId: ctx.user.id,
          action: "impersonate",
          entityType: "user",
          entityId: input.userId as string,
          details: { targetUserName: targetUser.name },
        });
        // Return target user info for client to use
        return { targetUser };
      }),
  }),

  // ============================================================================
  // PAYMENTS (Adyen integration)
  // ============================================================================
  socialProgram: router({
    myStatus: trainerProcedure.query(async ({ ctx }) => {
      const [membershipRaw, profile, pendingInviteRaw, commitment, progress, violations] =
        await Promise.all([
          db.getTrainerSocialMembership(ctx.user.id),
          db.getTrainerSocialProfile(ctx.user.id),
          db.getPendingTrainerSocialInvite(ctx.user.id),
          db.getActiveTrainerSocialCommitment(ctx.user.id),
          db.getLatestTrainerSocialProgress(ctx.user.id),
          db.listTrainerSocialViolations({
            trainerId: ctx.user.id,
            status: "open",
            limit: 25,
          }),
        ]);

      const { membership, pendingInvite } =
        await reconcileTrainerSocialMembershipState({
          trainerId: ctx.user.id,
          membership: membershipRaw,
          profile,
          pendingInvite: pendingInviteRaw,
        });

      const inviteBy =
        pendingInvite?.invitedBy &&
        (await db.getUserById(pendingInvite.invitedBy));
      const visibleMembership = getTrainerVisibleSocialMembership({
        membership,
        pendingInvite,
      });
      const shouldRedactDetails = shouldRedactTrainerSocialProgramDetails({
        membership: visibleMembership,
        pendingInvite,
      });

      return {
        membership: visibleMembership,
        profile: shouldRedactDetails ? null : profile,
        pendingInvite,
        invitedBy: inviteBy
          ? {
              id: inviteBy.id,
              name: inviteBy.name,
              role: inviteBy.role,
            }
          : null,
        commitment: shouldRedactDetails ? null : commitment,
        progress: shouldRedactDetails ? null : progress,
        openViolations: shouldRedactDetails ? [] : violations,
      };
    }),

    acceptInvite: trainerProcedure
      .input(z.object({ inviteId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const invites = await db.getTrainerSocialInvitesByTrainer(ctx.user.id);
        const invite = invites.find((row) => row.id === input.inviteId);
        if (!invite) notFound("Social invite");
        if (invite.status !== "pending") {
          forbidden(`Invite is ${invite.status}`);
        }
        const previousMembership = await db.getTrainerSocialMembership(ctx.user.id);
        const nowIso = new Date().toISOString();
        const otherPendingInvites = invites.filter(
          (row) => row.status === "pending" && row.id !== invite.id,
        );
        if (otherPendingInvites.length > 0) {
          await Promise.all(
            otherPendingInvites.map((row) =>
              db.updateTrainerSocialInvite(row.id, {
                status: "revoked",
              }),
            ),
          );
        }
        await db.updateTrainerSocialInvite(invite.id, {
          status: "accepted",
          acceptedAt: nowIso,
        });
        const membership = await db.upsertTrainerSocialMembership({
          trainerId: ctx.user.id,
          status: "active",
          invitedAt: previousMembership?.invitedAt || invite.createdAt,
          acceptedAt: nowIso,
          invitedBy: invite.invitedBy,
          pausedAt: null,
          bannedAt: null,
          declinedAt: null,
          reason: null,
        });
        if (!membership) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to activate social membership",
          });
        }

        let commitment = await db.getActiveTrainerSocialCommitment(ctx.user.id);
        if (!commitment) {
          await db.upsertTrainerSocialCommitment({
            trainerId: ctx.user.id,
            minimumFollowers: 10000,
            minimumPosts: 4,
            minimumOnTimePct: 95,
            minimumTagPct: 98,
            minimumApprovedCreativePct: 98,
            minimumAvgViews: 1000,
            minimumEngagementRate: 0.03,
            minimumCtr: 0.008,
            minimumShareSaveRate: 0.007,
            active: true,
            effectiveFrom: nowIso,
          });
          commitment = await db.getActiveTrainerSocialCommitment(ctx.user.id);
        }

        const fromDate = new Date();
        fromDate.setDate(1);
        const toDate = new Date(fromDate);
        toDate.setMonth(toDate.getMonth() + 1);
        toDate.setDate(0);

        await db.upsertTrainerSocialCommitmentProgress({
          trainerId: ctx.user.id,
          commitmentId: commitment?.id || null,
          periodStart: fromDate.toISOString(),
          periodEnd: toDate.toISOString(),
          status: "on_track",
          postsDelivered: 0,
          postsRequired: commitment?.minimumPosts || 4,
        });

        const coordinator = invite.invitedBy
          ? await db.getUserById(invite.invitedBy)
          : null;
        if (coordinator?.id) {
          const acceptedBody = `${
            ctx.user.name || "Trainer"
          } accepted the Social Posts invitation.`;
          await db.createSocialEventNotification({
            recipientUserId: coordinator.id,
            trainerId: ctx.user.id,
            severity: "info",
            category: "social_event",
            title: "Social invite accepted",
            body: acceptedBody,
            metadata: {
              inviteId: invite.id,
              eventType: "social_program.accepted",
            },
          });
          notifySocialAlert([coordinator.id], {
            severity: "info",
            title: "Social invite accepted",
            body: acceptedBody,
            trainerId: ctx.user.id,
            eventType: "social_program.accepted",
          });
          await sendPushToUsers([coordinator.id], {
            title: "Social invite accepted",
            body: acceptedBody,
            data: {
              type: "social_program_accepted",
              trainerId: ctx.user.id,
              inviteId: invite.id,
            },
          });
        }
        await db.logUserActivity({
          targetUserId: ctx.user.id,
          performedBy: ctx.user.id,
          action: "status_changed",
          previousValue: previousMembership?.status || "none",
          newValue: "active",
          notes: `social_program_invite_accepted:${invite.id}`,
        });
        notifyBadgeCounts(await db.getUserIdsByRoles(["manager", "coordinator"]));
        return { success: true, membership };
      }),

    declineInvite: trainerProcedure
      .input(z.object({ inviteId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const invites = await db.getTrainerSocialInvitesByTrainer(ctx.user.id);
        const invite = invites.find((row) => row.id === input.inviteId);
        if (!invite) notFound("Social invite");
        const previousMembership = await db.getTrainerSocialMembership(ctx.user.id);
        await db.updateTrainerSocialInvite(invite.id, {
          status: "declined",
          declinedAt: new Date().toISOString(),
        });
        await db.upsertTrainerSocialMembership({
          trainerId: ctx.user.id,
          status: "uninvited",
          declinedAt: new Date().toISOString(),
          invitedBy: invite.invitedBy,
          reason: "Trainer declined exclusive social invite",
        });
        const coordinator = invite.invitedBy
          ? await db.getUserById(invite.invitedBy)
          : null;
        if (coordinator?.id) {
          await db.createSocialEventNotification({
            recipientUserId: coordinator.id,
            trainerId: ctx.user.id,
            severity: "warning",
            category: "social_event",
            title: "Social invite declined",
            body: `${ctx.user.name || "Trainer"} declined the Social Posts invitation.`,
            metadata: {
              inviteId: invite.id,
              eventType: "social_program.declined",
            },
          });
          notifySocialAlert([coordinator.id], {
            severity: "warning",
            title: "Social invite declined",
            body: `${ctx.user.name || "Trainer"} declined the Social Posts invitation.`,
            trainerId: ctx.user.id,
            eventType: "social_program.declined",
          });
          await sendPushToUsers([coordinator.id], {
            title: "Social invite declined",
            body: `${ctx.user.name || "Trainer"} declined the Social Posts invitation.`,
            data: {
              type: "social_program_declined",
              inviteId: invite.id,
              trainerId: ctx.user.id,
            },
          });
        }
        await db.logUserActivity({
          targetUserId: ctx.user.id,
          performedBy: ctx.user.id,
          action: "status_changed",
          previousValue: previousMembership?.status || "none",
          newValue: "uninvited",
          notes: `social_program_invite_declined:${invite.id}`,
        });
        notifyBadgeCounts(await db.getUserIdsByRoles(["manager", "coordinator"]));
        return { success: true };
      }),

    startConnect: trainerProcedure
      .input(z.object({ forceNewUser: z.boolean().optional() }).optional())
      .mutation(async ({ ctx, input }) => {
        const session = await preparePhylloConnectSession({
          trainerId: ctx.user.id,
          trainerName: ctx.user.name || null,
          forceNewUser: input?.forceNewUser,
        });
        return {
          success: true,
          pendingInviteAccepted: session.pendingInviteAccepted,
          phylloUserId: session.phylloUserId,
          sdkToken: session.sdkToken,
          sdkTokenExpiresAt: session.sdkTokenExpiresAt,
          connectConfig: {
            environment: session.connectEnvironment,
            scriptUrl: PHYLLO_CONNECT_SDK_URL,
            clientDisplayName: "LocoMotivate",
          },
        };
      }),

    completeConnect: trainerProcedure
      .input(
        z
          .object({
            status: z.enum(["connected", "cancelled", "failed"]).optional(),
            reason: z.string().optional(),
          })
          .optional(),
      )
      .mutation(async ({ ctx, input }) => {
        const status = input?.status || "connected";
        if (status !== "connected") {
          await ensureActiveSocialMembershipForConnect({ trainerId: ctx.user.id });
          return {
            success: true,
            status,
            reason: input?.reason || null,
            profile: await db.getTrainerSocialProfile(ctx.user.id),
          };
        }
        const session = await preparePhylloConnectSession({
          trainerId: ctx.user.id,
          trainerName: ctx.user.name || null,
        });
        const savedProfile = await syncPhylloProfileForTrainer({
          trainerId: ctx.user.id,
          membership: session.membership,
          phylloUserId: session.phylloUserId,
          hasPhylloAuthBasic: session.hasPhylloAuthBasic,
          source: "complete_connect",
        });
        const pullResult = session.hasPhylloAuthBasic
          ? await syncTrainerSocialFromPhylloPull({
              trainerId: ctx.user.id,
              phylloUserId: session.phylloUserId,
              source: "complete_connect_pull",
            })
          : null;
        return {
          success: true,
          status,
          reason: input?.reason || null,
          profile: pullResult ? await db.getTrainerSocialProfile(ctx.user.id) : savedProfile,
          pulledContentRows: pullResult?.pulledRows || 0,
        };
      }),

    connectPhyllo: trainerProcedure
      .input(z.object({ forceNewUser: z.boolean().optional() }).optional())
      .mutation(async ({ ctx, input }) => {
        const session = await preparePhylloConnectSession({
          trainerId: ctx.user.id,
          trainerName: ctx.user.name || null,
          forceNewUser: input?.forceNewUser,
        });
        const savedProfile = await syncPhylloProfileForTrainer({
          trainerId: ctx.user.id,
          membership: session.membership,
          phylloUserId: session.phylloUserId,
          hasPhylloAuthBasic: session.hasPhylloAuthBasic,
          source: "connect_phyllo",
        });
        const pullResult = session.hasPhylloAuthBasic
          ? await syncTrainerSocialFromPhylloPull({
              trainerId: ctx.user.id,
              phylloUserId: session.phylloUserId,
              source: "connect_phyllo_pull",
            })
          : null;
        return {
          success: true,
          pendingInviteAccepted: session.pendingInviteAccepted,
          profile: pullResult ? await db.getTrainerSocialProfile(ctx.user.id) : savedProfile,
          pulledContentRows: pullResult?.pulledRows || 0,
          sdkTokenExpiresAt: session.sdkTokenExpiresAt,
        };
      }),

    syncNow: trainerProcedure.mutation(async ({ ctx }) => {
      const session = await preparePhylloConnectSession({
        trainerId: ctx.user.id,
        trainerName: ctx.user.name || null,
      });
      const savedProfile = await syncPhylloProfileForTrainer({
        trainerId: ctx.user.id,
        membership: session.membership,
        phylloUserId: session.phylloUserId,
        hasPhylloAuthBasic: session.hasPhylloAuthBasic,
        source: "manual_sync",
      });
      const pullResult = session.hasPhylloAuthBasic
        ? await syncTrainerSocialFromPhylloPull({
            trainerId: ctx.user.id,
            phylloUserId: session.phylloUserId,
            source: "manual_sync_pull",
          })
        : null;
      const attributionResult = await syncTrainerCampaignPostAttributions({
        trainerId: ctx.user.id,
      });
      return {
        success: true,
        profile: pullResult ? await db.getTrainerSocialProfile(ctx.user.id) : savedProfile,
        pulledContentRows: pullResult?.pulledRows || 0,
        syncedContentRows: pullResult?.savedRows || 0,
        evaluatedCampaignPosts: attributionResult.evaluatedPosts,
        updatedCampaignBundles: attributionResult.updatedBundles,
        syncedAt: new Date().toISOString(),
      };
    }),

    myProgramDashboard: trainerProcedure.query(async ({ ctx }) => {
      const [membershipRaw, profile, pendingInviteRaw, progress, commitment, violations, recentMetrics] =
        await Promise.all([
          db.getTrainerSocialMembership(ctx.user.id),
          db.getTrainerSocialProfile(ctx.user.id),
          db.getPendingTrainerSocialInvite(ctx.user.id),
          db.getLatestTrainerSocialProgress(ctx.user.id),
          db.getActiveTrainerSocialCommitment(ctx.user.id),
          db.listTrainerSocialViolations({
            trainerId: ctx.user.id,
            limit: 20,
          }),
          db.getTrainerSocialMetricsRange(ctx.user.id, { limit: 30 }),
        ]);
      const { membership, pendingInvite } =
        await reconcileTrainerSocialMembershipState({
          trainerId: ctx.user.id,
          membership: membershipRaw,
          profile,
          pendingInvite: pendingInviteRaw,
        });
      const inviteBy =
        pendingInvite?.invitedBy &&
        (await db.getUserById(pendingInvite.invitedBy));
      const visibleMembership = getTrainerVisibleSocialMembership({
        membership,
        pendingInvite,
      });
      const shouldRedactDetails = shouldRedactTrainerSocialProgramDetails({
        membership: visibleMembership,
        pendingInvite,
      });
      return {
        membership: visibleMembership,
        profile: shouldRedactDetails ? null : profile,
        pendingInvite,
        invitedBy: inviteBy
          ? {
              id: inviteBy.id,
              name: inviteBy.name,
              role: inviteBy.role,
            }
          : null,
        progress: shouldRedactDetails ? null : progress,
        commitment: shouldRedactDetails ? null : commitment,
        violations: shouldRedactDetails ? [] : violations,
        recentMetrics: shouldRedactDetails ? [] : recentMetrics,
      };
    }),

    campaignMetrics: trainerProcedure
      .input(
        z
          .object({
            bundleId: z.string().optional(),
            fromDate: z.string().optional(),
            toDate: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const bundleIds: string[] = [];
        if (input?.bundleId) {
          const bundle = await db.getBundleDraftById(input.bundleId);
          if (!bundle) notFound("Bundle");
          assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
          bundleIds.push(bundle.id);
        } else {
          const bundles = await db.getBundleDraftsByTrainer(ctx.user.id);
          for (const bundle of bundles) {
            if (!bundle.id) continue;
            bundleIds.push(bundle.id);
          }
        }
        for (const bundleId of bundleIds) {
          await syncTrainerCampaignPostAttributions({
            trainerId: ctx.user.id,
            bundleDraftId: bundleId,
          });
        }
        const rows = await db.getTrainerCampaignMetricsRange({
          trainerId: ctx.user.id,
          bundleDraftId: input?.bundleId,
          fromDate: input?.fromDate,
          toDate: input?.toDate,
          limit: 365,
        });
        const accountIds = Array.from(
          new Set(rows.map((row) => row.campaignAccountId).filter(Boolean)),
        );
        const accounts = await db.getCampaignAccountsByIds(accountIds);
        const accountById = new Map(accounts.map((account) => [account.id, account]));
        return rows.map((row) => ({
          ...row,
          campaignAccountName:
            accountById.get(row.campaignAccountId)?.name || "Campaign Account",
        }));
      }),

    recentPosts: trainerProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(40).optional(),
            sparklineDays: z.number().int().min(3).max(30).optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        const loadPosts = () =>
          db.getTrainerRecentSocialPosts(ctx.user.id, {
            limit: input?.limit,
            sparklineDays: input?.sparklineDays,
          });

        let posts = await loadPosts();
        if (posts.length > 0) return posts;

        const profile = await db.getTrainerSocialProfile(ctx.user.id);
        const phylloUserId = String(profile?.phylloUserId || "").trim();
        if (!phylloUserId || !String(ENV.phylloAuthBasic || "").trim()) {
          return posts;
        }

        try {
          await syncTrainerSocialFromPhylloPull({
            trainerId: ctx.user.id,
            phylloUserId,
            source: "recent_posts_autofill",
          });
          posts = await loadPosts();
        } catch (error) {
          logWarn("social_program.recent_posts_autofill_failed", {
            trainerId: ctx.user.id,
            phylloUserId,
            error: error instanceof Error ? error.message : String(error || "unknown_error"),
          });
        }

        return posts;
      }),

    myNotifications: protectedProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(200).optional(),
            unreadOnly: z.boolean().optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        return db.listSocialEventNotificationsForUser({
          userId: ctx.user.id,
          limit: input?.limit,
          unreadOnly: input?.unreadOnly,
        });
      }),

    markNotificationRead: protectedProcedure
      .input(z.object({ notificationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.markSocialEventNotificationRead(input.notificationId, ctx.user.id);
        notifyBadgeCounts([ctx.user.id]);
        return { success: true };
      }),

    managementSummary: protectedProcedure.query(async ({ ctx }) => {
      if (!isManagerLikeRole(ctx.user.role)) {
        forbidden("Only coordinator/manager can access social management");
      }
      const [summary, topPerformers, openViolations] = await Promise.all([
        db.getSocialManagementSummary(),
        db.getTopSocialPerformerRows(10),
        db.listTrainerSocialViolations({ status: "open", limit: 25 }),
      ]);
      const violationUsers = await db.getUsersByIds(
        Array.from(new Set(openViolations.map((row) => row.trainerId))),
      );
      const userById = new Map(violationUsers.map((user) => [user.id, user]));
      return {
        summary,
        topPerformers,
        openViolations: openViolations.map((row) => ({
          ...row,
          trainerName: userById.get(row.trainerId)?.name || "Trainer",
        })),
      };
    }),

    listMembers: protectedProcedure
      .input(
        z
          .object({
            status: z
              .enum(["all", "invited", "active", "paused", "banned", "declined"])
              .optional(),
            search: z.string().optional(),
            limit: z.number().int().min(1).max(500).optional(),
            offset: z.number().int().min(0).optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        if (!isManagerLikeRole(ctx.user.role)) {
          forbidden("Only coordinator/manager can access social members");
        }
        return db.listSocialMembers({
          status: input?.status,
          search: input?.search,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),

    listEligibleTrainers: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            limit: z.number().int().min(1).max(500).optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => {
        if (!isManagerLikeRole(ctx.user.role)) {
          forbidden("Only coordinator/manager can invite trainers");
        }
        const trainers = await db.listEligibleSocialTrainers({
          search: input?.search,
          limit: input?.limit,
        });
        const memberships = await db.getSocialMembershipByTrainerIds(
          trainers.map((trainer) => trainer.id),
        );
        const membershipByTrainerId = new Map(
          memberships.map((membership) => [membership.trainerId, membership]),
        );
        return trainers.map((trainer) => ({
          ...trainer,
          socialMembership: membershipByTrainerId.get(trainer.id) || null,
        }));
      }),

    inviteTrainer: protectedProcedure
      .input(
        z.object({
          trainerId: z.string(),
          summary: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!isManagerLikeRole(ctx.user.role)) {
          forbidden("Only coordinator/manager can invite trainers");
        }
        const trainer = await db.getUserById(input.trainerId);
        if (!trainer || trainer.role !== "trainer") {
          notFound("Trainer");
        }
        const previousMembership = await db.getTrainerSocialMembership(trainer.id);
        const existingInvites = await db.getTrainerSocialInvitesByTrainer(trainer.id);
        const pendingInvites = existingInvites.filter((row) => row.status === "pending");
        if (pendingInvites.length > 0) {
          await Promise.all(
            pendingInvites.map((invite) =>
              db.updateTrainerSocialInvite(invite.id, {
                status: "revoked",
              }),
            ),
          );
        }

        const membership = await db.upsertTrainerSocialMembership({
          trainerId: trainer.id,
          status: "invited",
          invitedBy: ctx.user.id,
          invitedAt: new Date().toISOString(),
          acceptedAt: null,
          pausedAt: null,
          bannedAt: null,
          declinedAt: null,
          reason: null,
        });
        if (!membership) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create membership",
          });
        }

        const summary =
          input.summary?.trim() ||
          "You are invited to earn by posting approved social campaign content.";
        const appLink = "locomotivate://(trainer)/social-progress";
        const webBase = String(
          process.env.EXPO_PUBLIC_APP_URL || "https://locomotivate.app",
        )
          .trim()
          .replace(/\/+$/g, "");
        const webLink = `${webBase}/(trainer)/social-progress`;
        const content = [
          `You have been invited to the LocoMotivate Social Program.`,
          summary,
          `Open in app: ${appLink}`,
          `Open on web: ${webLink}`,
        ].join("\n\n");

        const conversationId = [ctx.user.id, trainer.id].sort().join("-");
        const messageId = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: trainer.id,
          conversationId,
          content,
          messageType: "system",
        });
        notifyNewMessage(
          conversationId,
          {
            id: messageId,
            senderId: ctx.user.id,
            senderName: ctx.user.name || "Coordinator",
            receiverId: trainer.id,
            content,
            conversationId,
          },
          [trainer.id, ctx.user.id],
          ctx.user.id,
        );

        let emailMessageId: string | null = null;
        if (trainer.email) {
          try {
            emailMessageId = await sendSocialProgramInviteEmail({
              to: trainer.email,
              trainerName: trainer.name || "Trainer",
              coordinatorName: ctx.user.name || "Coordinator",
              appLink: webLink,
              summary,
            });
          } catch (error) {
            logError("social.invite.email_failed", error, {
              trainerId: trainer.id,
              coordinatorId: ctx.user.id,
              email: trainer.email,
            });
          }
        }

        const inviteId = await db.createTrainerSocialInvite({
          trainerId: trainer.id,
          invitedBy: ctx.user.id,
          membershipId: membership.id,
          status: "pending",
          summary,
          sentInApp: true,
          sentMessage: true,
          sentEmail: Boolean(emailMessageId),
          messageConversationId: conversationId,
          messageId,
          emailMessageId,
          expiresAt: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

        await db.createSocialEventNotification({
          recipientUserId: trainer.id,
          trainerId: trainer.id,
          severity: "info",
          category: "social_event",
          title: "You're invited to Social Posts",
          body: `Congratulations! ${ctx.user.name || "Your coordinator"} invited you to join the exclusive Social Posts program.`,
          metadata: {
            inviteId,
            eventType: "social_program.invited",
            showInApp: true,
            deepLink: "social-program",
          },
        });
        notifySocialAlert([trainer.id], {
          severity: "info",
          title: "You're invited to Social Posts",
          body: `Congratulations! ${ctx.user.name || "Your coordinator"} invited you to join the exclusive Social Posts program.`,
          trainerId: trainer.id,
          eventType: "social_program.invited",
          showInApp: true,
        });

        await sendPushToUsers([trainer.id], {
          title: "Social program invitation",
          body: "You have a new invitation to earn from social campaign posts.",
          data: {
            type: "social_program_invite",
            inviteId,
            conversationId,
            deepLink: "social-program",
          },
        });
        await db.logUserActivity({
          targetUserId: trainer.id,
          performedBy: ctx.user.id,
          action: "invited",
          previousValue: previousMembership?.status || "none",
          newValue: "invited",
          notes: `social_program_invited:${inviteId}`,
        });
        notifyBadgeCounts([trainer.id]);
        return { success: true, inviteId, membershipId: membership.id };
      }),

    setMemberStatus: protectedProcedure
      .input(
        z.object({
          trainerId: z.string(),
          status: z.enum(["active", "paused", "banned"]),
          reason: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!isManagerLikeRole(ctx.user.role)) {
          forbidden("Only coordinator/manager can manage social members");
        }
        const trainer = await db.getUserById(input.trainerId);
        if (!trainer || trainer.role !== "trainer") notFound("Trainer");
        const previousMembership = await db.getTrainerSocialMembership(trainer.id);
        const previousStatus = previousMembership?.status || "none";
        const normalizedReason = input.reason?.trim() || null;
        const nowIso = new Date().toISOString();
        const invites = await db.getTrainerSocialInvitesByTrainer(trainer.id);
        const pendingInvites = invites.filter((row) => row.status === "pending");
        if (input.status === "active" && pendingInvites.length > 0) {
          await Promise.all(
            pendingInvites.map((invite) =>
              db.updateTrainerSocialInvite(invite.id, {
                status: "accepted",
                acceptedAt: nowIso,
              }),
            ),
          );
        }
        if ((input.status === "paused" || input.status === "banned") && pendingInvites.length > 0) {
          await Promise.all(
            pendingInvites.map((invite) =>
              db.updateTrainerSocialInvite(invite.id, {
                status: "revoked",
              }),
            ),
          );
        }
        const nextData: db.InsertTrainerSocialMembership =
          input.status === "banned"
            ? {
                trainerId: trainer.id,
                status: "banned",
                invitedBy: previousMembership?.invitedBy || null,
                invitedAt: previousMembership?.invitedAt || nowIso,
                acceptedAt: previousMembership?.acceptedAt || null,
                pausedAt: null,
                declinedAt: null,
                bannedAt: nowIso,
                reason: normalizedReason || "Removed from Social Posts by management",
              }
            : input.status === "paused"
              ? {
                  trainerId: trainer.id,
                  status: "paused",
                  invitedBy: previousMembership?.invitedBy || null,
                  invitedAt: previousMembership?.invitedAt || nowIso,
                  acceptedAt: previousMembership?.acceptedAt || nowIso,
                  pausedAt: nowIso,
                  declinedAt: null,
                  bannedAt: null,
                  reason: normalizedReason || "Paused by management",
                }
              : {
                  trainerId: trainer.id,
                  status: "active",
                  invitedBy: previousMembership?.invitedBy || ctx.user.id,
                  invitedAt: previousMembership?.invitedAt || nowIso,
                  acceptedAt: previousMembership?.acceptedAt || nowIso,
                  pausedAt: null,
                  declinedAt: null,
                  bannedAt: null,
                  reason: null,
                };
        const membership = await db.upsertTrainerSocialMembership(nextData);
        if (!membership) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update membership",
          });
        }
        if (input.status === "paused" || input.status === "banned") {
          await db.upsertTrainerSocialCommitmentProgress({
            trainerId: trainer.id,
            periodStart: nowIso,
            periodEnd: nowIso,
            status: input.status,
            postsDelivered: 0,
            postsRequired: 0,
            notes: input.reason || null,
          });
        }
        const trainerAlert =
          input.status === "paused"
            ? {
                severity: "warning" as const,
                title: "Social access paused",
                body:
                  normalizedReason ||
                  "Your coordinator paused your Social Posts access. You can reconnect when they reactivate you.",
                eventType: "social_program.paused",
              }
            : input.status === "banned"
              ? {
                  severity: "warning" as const,
                  title: "Social access removed",
                  body:
                    normalizedReason ||
                    "Your coordinator removed your Social Posts access. You are no longer invited to the program.",
                  eventType: "social_program.removed",
                }
              : {
                  severity: "info" as const,
                  title: "Social access active",
                  body:
                    previousStatus === "paused"
                      ? "Your coordinator restored your Social Posts access."
                      : "Your Social Posts access is active.",
                  eventType: "social_program.activated",
                };

        await db.createSocialEventNotification({
          recipientUserId: trainer.id,
          trainerId: trainer.id,
          severity: trainerAlert.severity,
          category: "social_event",
          title: trainerAlert.title,
          body: trainerAlert.body,
          metadata: {
            eventType: trainerAlert.eventType,
            status: membership.status,
            showInApp: true,
            deepLink: "social-program",
          },
        });
        notifySocialAlert([trainer.id], {
          severity: trainerAlert.severity,
          title: trainerAlert.title,
          body: trainerAlert.body,
          trainerId: trainer.id,
          eventType: trainerAlert.eventType,
          showInApp: true,
        });
        await sendPushToUsers([trainer.id], {
          title: trainerAlert.title,
          body: trainerAlert.body,
          data: {
            type: "social_program_status",
            trainerId: trainer.id,
            status: membership.status,
            deepLink: "social-program",
          },
        });
        await db.logUserActivity({
          targetUserId: trainer.id,
          performedBy: ctx.user.id,
          action: "status_changed",
          previousValue: previousStatus,
          newValue: membership.status,
          notes:
            input.status === "paused"
              ? `social_program_paused:${normalizedReason || ""}`
              : input.status === "banned"
                ? `social_program_banned_reset:${previousStatus}`
                : `social_program_activated:${previousStatus}`,
        });
        notifyBadgeCounts([trainer.id]);
        return {
          success: true,
          membership,
          effectiveStatus: input.status === "banned" ? "uninvited" : membership.status,
        };
      }),

    membershipByTrainerIds: protectedProcedure
      .input(z.object({ trainerIds: z.array(z.string()).min(1) }))
      .query(async ({ ctx, input }) => {
        if (!isManagerLikeRole(ctx.user.role)) {
          forbidden("Only coordinator/manager can view social membership data");
        }
        const rows = await db.getSocialMembershipByTrainerIds(input.trainerIds);
        const map: Record<string, db.TrainerSocialMembership> = {};
        for (const row of rows) {
          map[row.trainerId] = row;
        }
        return map;
      }),
  }),

  payments: router({
    /** Get Adyen client config (safe for frontend) */
    config: protectedProcedure.query(() => {
      return {
        clientKey: adyen.getClientKey(),
        environment: adyen.getEnvironment(),
        configured: adyen.isAdyenConfigured(),
        onboardingUrl: adyen.getOnboardingUrl(),
      };
    }),

    /** Create a checkout session for card/Apple Pay */
    createSession: trainerProcedure
      .input(
        z.object({
          amountMinor: z.number().min(1),
          currency: z.string().default("GBP"),
          description: z.string().optional(),
          payerId: z.string().optional(),
          method: z.enum(["card", "apple_pay", "tap"]).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const ref = adyen.generateMerchantReference("PAY");
        const session = await adyen.createCheckoutSession({
          amountMinor: input.amountMinor,
          currency: input.currency,
          merchantReference: ref,
          shopperEmail: ctx.user.email || undefined,
        });

        await db.createPaymentSession({
          adyenSessionId: session.id,
          adyenSessionData: session.sessionData,
          merchantReference: ref,
          requestedBy: ctx.user.id,
          payerId: input.payerId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          description: input.description,
          method: input.method || "card",
          status: "created",
          expiresAt: session.expiresAt
            ? new Date(session.expiresAt).toISOString()
            : undefined,
        });

        return {
          sessionId: session.id,
          sessionData: session.sessionData,
          merchantReference: ref,
          clientKey: adyen.getClientKey(),
          environment: adyen.getEnvironment(),
        };
      }),

    /** Create a payment link (for QR codes and shareable URLs) */
    createLink: trainerProcedure
      .input(
        z.object({
          amountMinor: z.number().min(1),
          currency: z.string().default("GBP"),
          description: z.string().optional(),
          payerId: z.string().optional(),
          expiresInMinutes: z.number().default(60),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const ref = adyen.generateMerchantReference("LINK");
        const link = await adyen.createPaymentLink({
          amountMinor: input.amountMinor,
          currency: input.currency,
          merchantReference: ref,
          description: input.description || "Payment request",
          expiresInMinutes: input.expiresInMinutes,
        });

        await db.createPaymentSession({
          adyenSessionId: link.id,
          merchantReference: ref,
          requestedBy: ctx.user.id,
          payerId: input.payerId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          description: input.description,
          method: "link",
          status: "created",
          paymentLink: link.url,
          expiresAt: link.expiresAt
            ? new Date(link.expiresAt).toISOString()
            : undefined,
        });

        return {
          linkUrl: link.url,
          merchantReference: ref,
          expiresAt: link.expiresAt ? String(link.expiresAt) : null,
        };
      }),

    /** Cancel a pending payment request */
    cancelLink: trainerProcedure
      .input(
        z.object({
          merchantReference: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const session = await db.getPaymentSessionByReference(
          input.merchantReference,
        );
        if (!session) notFound("Payment request");
        if (session.requestedBy !== ctx.user.id) {
          forbidden("You do not have access to this payment request");
        }

        const rawStatus = (session.status || "").toLowerCase();
        const isSettled =
          rawStatus === "authorised" ||
          rawStatus === "captured" ||
          rawStatus === "paid_out";
        if (isSettled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Paid links cannot be cancelled",
          });
        }
        if (rawStatus === "cancelled") {
          return { success: true, cancelled: false };
        }

        await db.updatePaymentSessionByReference(input.merchantReference, {
          status: "cancelled",
        });
        return { success: true, cancelled: true };
      }),

    /** Record that a payment reminder was sent */
    recordReminder: trainerProcedure
      .input(z.object({ merchantReference: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getPaymentSessionByReference(input.merchantReference);
        if (!session) notFound("Payment request");
        if (session.requestedBy !== ctx.user.id) forbidden("You do not have access to this payment request");
        await db.updatePaymentSessionByReference(input.merchantReference, {
          lastReminderSentAt: new Date().toISOString(),
        });
        return { success: true };
      }),

    /** Get payment history for the current trainer */
    history: trainerProcedure
      .input(
        z.object({
          limit: z.number().default(50),
          offset: z.number().default(0),
          status: z.enum(["awaiting_payment", "paid", "paid_out", "cancelled"]).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const allSessions = await db.getPaymentSessionsByTrainer(ctx.user.id);
        const filtered = input.status
          ? allSessions.filter(
              (session) => mapPaymentState(session.status) === input.status,
            )
          : allSessions;
        const page = filtered.slice(input.offset, input.offset + input.limit);
        return page.map(mapPaymentSessionForView);
      }),

    /** Get payment stats for the current trainer */
    stats: trainerProcedure.query(async ({ ctx }) => {
      const allSessions = await db.getPaymentSessionsByTrainer(ctx.user.id);
      const summary = summarizePaymentSessions(allSessions);
      return {
        ...summary,
        // Compatibility fields for existing clients during migration.
        pending: summary.awaitingPayment,
        captured: summary.paid,
        totalAmount: summary.totalPaidMinor,
      };
    }),

    trainerServices: trainerProcedure.query(async ({ ctx }) => {
      const bundles = await db.getBundleDraftsByTrainer(ctx.user.id);
      const seen = new Map<
        string,
        { id: string; name: string; sessions: number }
      >();
      for (const bundle of bundles) {
        const services = parseBundleServices(bundle.servicesJson);
        for (const s of services) {
          const key = s.name.toLowerCase();
          if (!seen.has(key)) seen.set(key, s);
        }
      }
      return Array.from(seen.values());
    }),

    getOnboardingStatus: trainerProcedure.query(async ({ ctx }) => {
      const bundle = await getTrainerPayoutOnboardingBundle(ctx.user.id);
      return {
        trainer: {
          id: bundle.trainer.id,
          name: bundle.trainer.name,
          email: bundle.trainer.email,
          phone: bundle.trainer.phone,
        },
        payoutBank: bundle.payoutBank,
        onboarding: bundle.onboarding,
        details: bundle.details,
        events: bundle.events,
        status: bundle.status,
        statusLabel: bundle.statusLabel,
        statusMessage: getPayoutKycTrainerMessage(bundle.status),
        canEditIntake: bundle.canEditIntake,
        canRequestPayments: bundle.canRequestPayments,
      };
    }),

    submitOnboardingIntake: trainerProcedure
      .input(payoutOnboardingIntakeSchema)
      .mutation(async ({ ctx, input }) => {
        const current = await db.getTrainerPayoutOnboarding(ctx.user.id);
        if (current && !canEditPayoutKycIntake(current.status)) {
          forbidden("This onboarding request can no longer be edited by the trainer.");
        }
        return saveTrainerPayoutOnboardingIntake({
          trainerId: ctx.user.id,
          performedBy: ctx.user.id,
          input,
          resetStatusToSubmitted: true,
          eventType: "submitted",
        });
      }),

    updateOnboardingIntake: trainerProcedure
      .input(payoutOnboardingIntakeSchema)
      .mutation(async ({ ctx, input }) => {
        const current = await db.getTrainerPayoutOnboarding(ctx.user.id);
        if (current && !canEditPayoutKycIntake(current.status)) {
          forbidden("This onboarding request can no longer be edited by the trainer.");
        }
        const shouldReset =
          !current ||
          normalizePayoutKycStatus(current.status) === "start_setup" ||
          normalizePayoutKycStatus(current.status) === "more_information_required" ||
          normalizePayoutKycStatus(current.status) === "verification_failed";
        return saveTrainerPayoutOnboardingIntake({
          trainerId: ctx.user.id,
          performedBy: ctx.user.id,
          input,
          resetStatusToSubmitted: shouldReset,
          eventType: shouldReset ? "submitted" : "details_updated",
        });
      }),

    kycSummary: managerProcedure.query(async () => {
      return db.getTrainerPayoutOnboardingSummary();
    }),

    listOnboardingRequests: managerProcedure
      .input(
        z
          .object({
            status: z
              .union([z.literal("all"), z.enum(PAYOUT_KYC_STATUSES)])
              .optional(),
            search: z.string().optional(),
            limit: z.number().int().min(1).max(500).optional(),
            offset: z.number().int().min(0).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        return db.listTrainerPayoutOnboardings({
          status: input?.status,
          search: input?.search,
          limit: input?.limit,
          offset: input?.offset,
        });
      }),

    getOnboardingRequest: managerProcedure
      .input(z.object({ trainerId: z.string() }))
      .query(async ({ input }) => {
        return getTrainerPayoutOnboardingBundle(input.trainerId);
      }),

    updateOnboardingStatus: managerProcedure
      .input(
        z.object({
          trainerId: z.string(),
          status: z.enum(PAYOUT_KYC_STATUSES),
          note: z.string().optional(),
          blockingReason: z.string().optional(),
          adyenAccountHolderId: z.string().optional(),
          adyenLegalEntityId: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const trainer = await db.getUserById(input.trainerId);
        if (!trainer || trainer.role !== "trainer") notFound("Trainer");
        const current = await ensureTrainerPayoutOnboardingRecord(trainer);
        const nowIso = new Date().toISOString();
        const onboarding = await db.upsertTrainerPayoutOnboarding({
          trainerId: trainer.id,
          accountHolderType:
            (current?.accountHolderType as any) || null,
          status: input.status,
          currentStepNote:
            normalizeOptionalText(input.note) ||
            current?.currentStepNote ||
            getPayoutKycTrainerMessage(input.status),
          blockingReason:
            input.status === "more_information_required" ||
            input.status === "verification_failed" ||
            input.status === "account_rejected"
              ? normalizeOptionalText(input.blockingReason)
              : null,
          adyenAccountHolderId:
            normalizeOptionalText(input.adyenAccountHolderId) ||
            current?.adyenAccountHolderId ||
            null,
          adyenLegalEntityId:
            normalizeOptionalText(input.adyenLegalEntityId) ||
            current?.adyenLegalEntityId ||
            null,
          createdBy: current?.createdBy || ctx.user.id,
          updatedBy: ctx.user.id,
          ...applyPayoutKycStatusTimestamps(current, input.status, nowIso),
        });
        if (!onboarding) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to update onboarding status.",
          });
        }
        await db.createTrainerPayoutOnboardingEvent({
          onboardingId: onboarding.id,
          trainerId: trainer.id,
          eventType: "status_changed",
          previousStatus: current?.status || null,
          nextStatus: input.status,
          note:
            normalizeOptionalText(input.note) ||
            `Status changed to ${getPayoutKycStatusLabel(input.status)}.`,
          metadata: {
            blockingReason: normalizeOptionalText(input.blockingReason),
          },
          createdBy: ctx.user.id,
        });
        await db.logUserActivity({
          targetUserId: trainer.id,
          performedBy: ctx.user.id,
          action: "payout_kyc_status_changed",
          previousValue: current?.status || "none",
          newValue: input.status,
          notes: normalizeOptionalText(input.note),
        });
        await sendPushToUsers([trainer.id], {
          title: "Payout onboarding update",
          body: `Your payout setup status is now ${getPayoutKycStatusLabel(input.status)}.`,
          data: {
            type: "payout_kyc_status",
            trainerId: trainer.id,
            status: input.status,
          },
        });
        return getTrainerPayoutOnboardingBundle(trainer.id);
      }),

    addOnboardingNote: managerProcedure
      .input(
        z.object({
          trainerId: z.string(),
          note: z.string().min(1).max(500),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const trainer = await db.getUserById(input.trainerId);
        if (!trainer || trainer.role !== "trainer") notFound("Trainer");
        const current = await ensureTrainerPayoutOnboardingRecord(trainer);
        if (!current) {
          forbidden("The trainer has not submitted a payout onboarding request yet.");
        }
        const onboarding = await db.upsertTrainerPayoutOnboarding({
          trainerId: trainer.id,
          accountHolderType: current.accountHolderType,
          status: current.status,
          currentStepNote: input.note.trim(),
          blockingReason: current.blockingReason,
          adyenAccountHolderId: current.adyenAccountHolderId,
          adyenLegalEntityId: current.adyenLegalEntityId,
          createdBy: current.createdBy,
          updatedBy: ctx.user.id,
        });
        if (!onboarding) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to save onboarding note.",
          });
        }
        await db.createTrainerPayoutOnboardingEvent({
          onboardingId: onboarding.id,
          trainerId: trainer.id,
          eventType: "note",
          previousStatus: current.status,
          nextStatus: current.status,
          note: input.note.trim(),
          createdBy: ctx.user.id,
        });
        await db.logUserActivity({
          targetUserId: trainer.id,
          performedBy: ctx.user.id,
          action: "payout_kyc_note_added",
          previousValue: current.status,
          newValue: current.status,
          notes: input.note.trim(),
        });
        return getTrainerPayoutOnboardingBundle(trainer.id);
      }),

    payoutSummary: trainerProcedure.query(async ({ ctx }) => {
      const earnings = await db.getEarningsSummary(ctx.user.id);
      const available = Math.max(
        (earnings.total || 0) - (earnings.pending || 0),
        0,
      );
      const bundle = await getTrainerPayoutOnboardingBundle(ctx.user.id);
      const destination = bundle.payoutBank
        ? `${bundle.payoutBank.bankName} ••••${bundle.payoutBank.accountNumberLast4}`
        : null;
      const canRequestPayments = bundle.canRequestPayments;
      return {
        available,
        pending: earnings.pending || 0,
        nextPayoutDate: null as string | null,
        automatic: canRequestPayments,
        destination,
        bankConnected: canRequestPayments,
        status: bundle.status,
        statusLabel: bundle.statusLabel,
        canRequestPayments,
        canEditIntake: bundle.canEditIntake,
        currentStepNote: bundle.onboarding?.currentStepNote || null,
        blockingReason: bundle.onboarding?.blockingReason || null,
        message:
          canRequestPayments && destination
            ? `Payouts are enabled to ${destination}.`
            : getPayoutKycTrainerMessage(bundle.status),
      };
    }),

    payoutSetup: trainerProcedure.query(async ({ ctx }) => {
      const bundle = await getTrainerPayoutOnboardingBundle(ctx.user.id);
      const payoutBank = bundle.payoutBank;
      return {
        connected: bundle.canRequestPayments,
        status: bundle.status,
        statusLabel: bundle.statusLabel,
        canEditIntake: bundle.canEditIntake,
        currentStepNote: bundle.onboarding?.currentStepNote || null,
        blockingReason: bundle.onboarding?.blockingReason || null,
        accountHolderType: bundle.onboarding?.accountHolderType || null,
        accountHolderName:
          payoutBank?.accountHolderName ||
          bundle.details?.organizationName ||
          [bundle.details?.firstName, bundle.details?.lastName]
            .filter(Boolean)
            .join(" ") ||
          null,
        bankName: payoutBank?.bankName || null,
        sortCode: payoutBank?.sortCode || null,
        accountNumberLast4: payoutBank?.accountNumberLast4 || null,
        connectedAt: payoutBank?.connectedAt || bundle.onboarding?.activeAt || null,
        updatedAt: payoutBank?.updatedAt || bundle.onboarding?.updatedAt || null,
      };
    }),

    connectPayoutBank: trainerProcedure
      .input(
        z.object({
          accountHolderName: z.string().min(2).max(120),
          bankName: z.string().min(2).max(120),
          sortCode: z.string().min(6).max(12),
          accountNumber: z.string().min(6).max(20),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const trainer = await db.getUserById(ctx.user.id);
        if (!trainer) notFound("Trainer");

        const sortCode = toSanitizedDigits(input.sortCode);
        if (sortCode.length !== 6) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sort code must be 6 digits.",
          });
        }

        const accountNumber = toSanitizedDigits(input.accountNumber);
        if (accountNumber.length < 6 || accountNumber.length > 10) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Account number must be between 6 and 10 digits.",
          });
        }

        const nowIso = new Date().toISOString();
        const existingMetadata = toObjectRecord(trainer.metadata);
        const existingPayout = toObjectRecord(existingMetadata.payout);
        const existingBank = toObjectRecord(existingPayout.bank);
        const connectedAt =
          typeof existingBank.connectedAt === "string" &&
          existingBank.connectedAt.trim().length > 0
            ? existingBank.connectedAt
            : nowIso;

        const nextMetadata = {
          ...existingMetadata,
          payout: {
            ...existingPayout,
            bank: {
              accountHolderName: input.accountHolderName.trim(),
              bankName: input.bankName.trim(),
              sortCode,
              accountNumber,
              accountNumberLast4: accountNumber.slice(-4),
              connectedAt,
              updatedAt: nowIso,
            },
          },
        };

        await db.updateUser(ctx.user.id, { metadata: nextMetadata });
        return { success: true };
      }),
  }),

  // ============================================================================
  // SHOPIFY (Product sync and bundle publishing)
  // ============================================================================
  shopify: router({
    products: trainerProcedure.query(async () => {
      const products = await db.getProducts();
      return products.map((p) => ({
        id: p.shopifyProductId || 0,
        title: p.name,
        description: p.description,
        vendor: p.brand,
        productType: p.category,
        status: p.availability === "available" ? "active" : "draft",
        price: p.price || "0.00",
        inventory: p.inventoryQuantity || 0,
        sku: "",
        imageUrl: p.imageUrl,
      }));
    }),

    product: managerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductByShopifyProductId(input.id);
        if (!product) return null;
        return {
          id: product.shopifyProductId || input.id,
          title: product.name,
          description: product.description,
          vendor: product.brand,
          productType: product.category,
          status: product.availability === "available" ? "active" : "draft",
          price: product.price || "0.00",
          inventory: product.inventoryQuantity || 0,
          sku: "",
          imageUrl: product.imageUrl,
        };
      }),

    sync: managerProcedure.mutation(async () => {
      return shopify.syncProductsFromShopify();
    }),

    publishBundle: trainerProcedure
      .input(
        z.object({
          bundleId: z.string(),
          title: z.string(),
          description: z.string(),
          price: z.string(),
          imageUrl: z.string().optional(),
          products: z.array(
            z.object({
              name: z.string(),
              quantity: z.number(),
            }),
          ),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const result = await shopify.publishBundle({
          ...input,
          trainerId: ctx.user.id,
          trainerName: ctx.user.name || "Trainer",
        });

        // Update bundle with Shopify IDs
        await db.updateBundleDraft(input.bundleId, {
          shopifyProductId: result.productId,
          shopifyVariantId: result.variantId,
        });

        return result;
      }),
  }),

  // ============================================================================
  // TRAINER ATTRIBUTION
  // ============================================================================
  attribution: router({
    setAttribution: protectedProcedure
      .input(
        z.object({
          trainerId: z.string().min(1),
          source: z.enum(["store_link", "invitation_acceptance", "bundle_purchase", "manual"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const trainer = await db.getUserById(input.trainerId);
        if (!trainer || trainer.role !== "trainer" || !trainer.active) {
          notFound("Trainer");
        }
        const attributionId = await db.upsertAttribution({
          customerId: ctx.user.id,
          trainerId: input.trainerId,
          source: input.source as db.AttributionSource,
          metadata: { setBy: ctx.user.id },
        });
        return { attributionId, trainerId: input.trainerId };
      }),

    myAttribution: protectedProcedure.query(async ({ ctx }) => {
      const attribution = await db.getAttributionForCustomer(ctx.user.id);
      if (!attribution) return null;
      const trainer = await db.getUserById(attribution.trainerId);
      return {
        ...attribution,
        trainerName: trainer?.name || null,
        trainerUsername: trainer?.username || null,
        trainerPhotoUrl: trainer?.photoUrl || null,
      };
    }),

    myClients: trainerProcedure.query(async ({ ctx }) => {
      const attributions = await db.getAttributionsByTrainer(ctx.user.id);
      const enriched = await Promise.all(
        attributions.map(async (attr) => {
          const customer = await db.getUserById(attr.customerId);
          return {
            ...attr,
            customerName: customer?.name || customer?.email || null,
            customerEmail: customer?.email || null,
            customerPhotoUrl: customer?.photoUrl || null,
          };
        }),
      );
      return enriched;
    }),
  }),
});

export type AppRouter = typeof appRouter;
