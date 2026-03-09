import AsyncStorage from "@react-native-async-storage/async-storage";

const SOCIAL_STATUS_CACHE_VERSION = 1;
const SOCIAL_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
const SOCIAL_STATUS_CACHE_KEY_PREFIX = "trainer_social_status_snapshot";

type SocialStatusCacheEntry = {
  data: any;
  timestamp: number;
  version: number;
};

function getSocialStatusCacheKey(userId: string) {
  return `${SOCIAL_STATUS_CACHE_KEY_PREFIX}:${userId}`;
}

export function getSocialStatusCacheTtlMs() {
  return SOCIAL_STATUS_CACHE_TTL_MS;
}

export function isFreshSocialStatusCache(
  timestamp: number | null | undefined,
  ttlMs = SOCIAL_STATUS_CACHE_TTL_MS,
) {
  if (!timestamp || !Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= ttlMs;
}

export async function getCachedTrainerSocialStatus(userId: string): Promise<{
  data: any;
  timestamp: number;
} | null> {
  try {
    const cached = await AsyncStorage.getItem(getSocialStatusCacheKey(userId));
    if (!cached) return null;
    const entry = JSON.parse(cached) as SocialStatusCacheEntry;
    if (
      !entry ||
      entry.version !== SOCIAL_STATUS_CACHE_VERSION ||
      typeof entry.timestamp !== "number"
    ) {
      await AsyncStorage.removeItem(getSocialStatusCacheKey(userId));
      return null;
    }
    return {
      data: entry.data,
      timestamp: entry.timestamp,
    };
  } catch {
    return null;
  }
}

export async function setCachedTrainerSocialStatus(userId: string, data: any) {
  try {
    const entry: SocialStatusCacheEntry = {
      data,
      timestamp: Date.now(),
      version: SOCIAL_STATUS_CACHE_VERSION,
    };
    await AsyncStorage.setItem(
      getSocialStatusCacheKey(userId),
      JSON.stringify(entry),
    );
  } catch {
    // Best-effort cache only.
  }
}
