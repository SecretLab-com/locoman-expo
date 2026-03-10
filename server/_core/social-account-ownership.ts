import * as db from "../db";

const SOCIAL_ACCOUNT_CONFLICT_EVENT_TYPE = "social_program.account_conflict";
const SOCIAL_ACCOUNT_CONFLICT_DEDUPE_WINDOW_MS = 12 * 60 * 60 * 1000;

export type TrainerSocialIdentity = {
  platform: string;
  identityType:
    | "phyllo_user_id"
    | "phyllo_account_id"
    | "platform_profile_id"
    | "platform_username"
    | "username"
    | "handle"
    | "email"
    | "profile_url"
    | "account_url";
  rawValue: string;
  normalizedValue: string;
};

export type TrainerSocialIdentityConflict = {
  conflictingTrainerId: string;
  conflictingTrainerName: string | null;
  conflictingTrainerEmail: string | null;
  incoming: TrainerSocialIdentity;
  existing: TrainerSocialIdentity;
};

type ExtractTrainerSocialIdentityParams = {
  phylloUserId?: string | null;
  phylloAccountIds?: string[] | null;
  profiles?: any[];
  accounts?: any[];
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

function normalizeRows(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function resolvePlatform(row: any): string {
  const direct = normalizePlatformName(
    row?.platform ||
      row?.platform_name ||
      row?.work_platform?.name ||
      row?.workPlatform?.name ||
      row?.work_platform_name ||
      row?.network ||
      row?.name ||
      "",
  );
  if (direct) return direct;
  return normalizePlatformName(
    [
      row?.url,
      row?.profile_url,
      row?.account_url,
      row?.profileUrl,
      row?.accountUrl,
      row?.platform_username,
      row?.username,
      row?.handle,
      row?.email,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function normalizeIdentityValue(value: unknown): string | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, " ");
  return normalized || null;
}

function normalizeUrlIdentity(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/g, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return raw.toLowerCase().replace(/\/+$/g, "");
  }
}

function pushIdentity(
  identities: TrainerSocialIdentity[],
  seen: Set<string>,
  platform: string,
  identityType: TrainerSocialIdentity["identityType"],
  rawValue: unknown,
  normalizedValue: string | null,
) {
  const raw = String(rawValue || "").trim();
  if (!raw || !normalizedValue) return;
  const key = `${platform}::${identityType}::${normalizedValue}`;
  if (seen.has(key)) return;
  seen.add(key);
  identities.push({
    platform,
    identityType,
    rawValue: raw,
    normalizedValue,
  });
}

function addRowIdentities(
  identities: TrainerSocialIdentity[],
  seen: Set<string>,
  row: any,
  fallbackPlatform = "",
) {
  const platform = resolvePlatform(row) || fallbackPlatform || "unknown";
  pushIdentity(
    identities,
    seen,
    platform,
    "phyllo_account_id",
    row?.id,
    normalizeIdentityValue(row?.id),
  );
  pushIdentity(
    identities,
    seen,
    platform,
    "platform_profile_id",
    row?.platform_profile_id,
    normalizeIdentityValue(row?.platform_profile_id),
  );
  pushIdentity(
    identities,
    seen,
    platform,
    "platform_username",
    row?.platform_username,
    normalizeIdentityValue(row?.platform_username),
  );
  pushIdentity(
    identities,
    seen,
    platform,
    "username",
    row?.username,
    normalizeIdentityValue(row?.username),
  );
  pushIdentity(
    identities,
    seen,
    platform,
    "handle",
    row?.handle,
    normalizeIdentityValue(row?.handle),
  );
  pushIdentity(
    identities,
    seen,
    platform,
    "email",
    row?.email,
    normalizeIdentityValue(row?.email),
  );
  pushIdentity(
    identities,
    seen,
    platform,
    "email",
    row?.user?.email,
    normalizeIdentityValue(row?.user?.email),
  );
  pushIdentity(
    identities,
    seen,
    platform,
    "profile_url",
    row?.profile_url || row?.profileUrl || row?.url,
    normalizeUrlIdentity(row?.profile_url || row?.profileUrl || row?.url),
  );
  pushIdentity(
    identities,
    seen,
    platform,
    "account_url",
    row?.account_url || row?.accountUrl,
    normalizeUrlIdentity(row?.account_url || row?.accountUrl),
  );
}

export function extractTrainerSocialIdentities(
  params: ExtractTrainerSocialIdentityParams,
): TrainerSocialIdentity[] {
  const identities: TrainerSocialIdentity[] = [];
  const seen = new Set<string>();

  pushIdentity(
    identities,
    seen,
    "global",
    "phyllo_user_id",
    params.phylloUserId,
    normalizeIdentityValue(params.phylloUserId),
  );

  for (const phylloAccountId of Array.isArray(params.phylloAccountIds) ? params.phylloAccountIds : []) {
    pushIdentity(
      identities,
      seen,
      "global",
      "phyllo_account_id",
      phylloAccountId,
      normalizeIdentityValue(phylloAccountId),
    );
  }

  for (const row of normalizeRows(params.profiles)) {
    addRowIdentities(identities, seen, row);
  }
  for (const row of normalizeRows(params.accounts)) {
    addRowIdentities(identities, seen, row);
  }

  return identities;
}

function getProfileRawProfiles(profile: db.TrainerSocialProfile): any[] {
  return Array.isArray(profile?.metadata?.rawProfiles) ? profile.metadata.rawProfiles : [];
}

function getProfileRawAccounts(profile: db.TrainerSocialProfile): any[] {
  return Array.isArray(profile?.metadata?.rawAccounts) ? profile.metadata.rawAccounts : [];
}

function formatPlatformLabel(platform: string) {
  if (!platform || platform === "global" || platform === "unknown") return "social";
  if (platform === "x") return "X";
  return platform
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function shouldDisplayRawValue(identityType: TrainerSocialIdentity["identityType"]) {
  return !["phyllo_user_id", "phyllo_account_id", "platform_profile_id"].includes(identityType);
}

export function formatTrainerSocialIdentityConflictMessage(
  conflict: TrainerSocialIdentityConflict,
): string {
  const owner =
    conflict.conflictingTrainerName ||
    conflict.conflictingTrainerEmail ||
    "another trainer";
  const platformLabel = formatPlatformLabel(conflict.incoming.platform);
  const suffix = shouldDisplayRawValue(conflict.incoming.identityType)
    ? ` (${conflict.incoming.rawValue})`
    : "";
  return `This ${platformLabel} account${suffix} is already connected to ${owner}. Each social account can only belong to one trainer.`;
}

function buildConflictIdentityKey(conflict: TrainerSocialIdentityConflict): string {
  return [
    conflict.incoming.platform,
    conflict.incoming.identityType,
    conflict.incoming.normalizedValue,
    conflict.conflictingTrainerId,
  ].join("::");
}

export async function notifyTrainerSocialIdentityConflict(params: {
  trainerId: string;
  source: string;
  conflict: TrainerSocialIdentityConflict;
}) {
  const recipientUserIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
  if (!recipientUserIds.length) return;
  const title = "Duplicate social account blocked";
  const body = formatTrainerSocialIdentityConflictMessage(params.conflict);
  const identityKey = buildConflictIdentityKey(params.conflict);
  const nowMs = Date.now();

  for (const recipientUserId of recipientUserIds) {
    const existingNotifications = await db.listSocialEventNotificationsForUser({
      userId: recipientUserId,
      limit: 50,
    });
    const alreadyLoggedRecently = existingNotifications.some((notification) => {
      const metadata = notification.metadata || {};
      const createdAtMs = new Date(notification.createdAt).getTime();
      if (!Number.isFinite(createdAtMs)) return false;
      return (
        notification.trainerId === params.trainerId &&
        metadata?.eventType === SOCIAL_ACCOUNT_CONFLICT_EVENT_TYPE &&
        metadata?.identityKey === identityKey &&
        nowMs - createdAtMs < SOCIAL_ACCOUNT_CONFLICT_DEDUPE_WINDOW_MS
      );
    });
    if (alreadyLoggedRecently) continue;

    await db.createSocialEventNotification({
      recipientUserId,
      trainerId: params.trainerId,
      severity: "warning",
      category: "social_event",
      title,
      body,
      metadata: {
        eventType: SOCIAL_ACCOUNT_CONFLICT_EVENT_TYPE,
        conflictingTrainerId: params.conflict.conflictingTrainerId,
        conflictingTrainerName: params.conflict.conflictingTrainerName,
        conflictingTrainerEmail: params.conflict.conflictingTrainerEmail,
        platform: params.conflict.incoming.platform,
        identityType: params.conflict.incoming.identityType,
        identityValue: params.conflict.incoming.rawValue,
        identityKey,
        source: params.source,
        showInApp: true,
      },
    });
  }
}

export async function findTrainerSocialIdentityConflict(params: {
  trainerId: string;
  phylloUserId?: string | null;
  phylloAccountIds?: string[] | null;
  profiles?: any[];
  accounts?: any[];
}): Promise<TrainerSocialIdentityConflict | null> {
  const incomingIdentities = extractTrainerSocialIdentities(params);
  if (!incomingIdentities.length) return null;

  const incomingByKey = new Map(
    incomingIdentities.map((identity) => [
      `${identity.platform}::${identity.identityType}::${identity.normalizedValue}`,
      identity,
    ]),
  );

  const otherProfiles = await db.listOtherTrainerSocialProfiles(params.trainerId);
  for (const profile of otherProfiles) {
    const existingIdentities = extractTrainerSocialIdentities({
      phylloUserId: profile.phylloUserId,
      phylloAccountIds: profile.phylloAccountIds,
      profiles: getProfileRawProfiles(profile),
      accounts: getProfileRawAccounts(profile),
    });
    for (const existingIdentity of existingIdentities) {
      const key = `${existingIdentity.platform}::${existingIdentity.identityType}::${existingIdentity.normalizedValue}`;
      const incoming = incomingByKey.get(key);
      if (!incoming) continue;
      const conflictingTrainer = await db.getUserById(profile.trainerId);
      return {
        conflictingTrainerId: profile.trainerId,
        conflictingTrainerName: conflictingTrainer?.name || null,
        conflictingTrainerEmail: conflictingTrainer?.email || null,
        incoming,
        existing: existingIdentity,
      };
    }
  }

  return null;
}
