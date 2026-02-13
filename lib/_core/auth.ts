/**
 * Auth module — Supabase Auth integration.
 *
 * Session tokens are managed entirely by the Supabase client library.
 * We only cache the app-level user profile (from public.users) locally
 * for fast initial renders.
 */
import { supabase } from "@/lib/supabase-client";
import { Platform } from "react-native";

const USER_INFO_KEY = "loco-runtime-user-info";
const TOKEN_FALLBACK_TTL_MS = 30_000;
const TOKEN_REFRESH_DEBOUNCE_MS = 15_000;
let lastKnownSessionToken: string | null = null;
let lastKnownSessionTokenExpiresAt = 0;
let lastKnownSessionTokenSeenAt = 0;
let sessionTokenInFlight: Promise<string | null> | null = null;

export type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";

export type User = {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  loginMethod: string | null;
  role: UserRole;
  username: string | null;
  bio: string | null;
  specialties: unknown;
  socialLinks: unknown;
  trainerId: string | null;
  active: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
};

// ---------------------------------------------------------------------------
// Supabase session helpers
// ---------------------------------------------------------------------------

/** Get the current Supabase access token (JWT). Null if not signed in. */
export async function getSessionToken(): Promise<string | null> {
  const now = Date.now();
  const tokenStillValid = lastKnownSessionTokenExpiresAt === 0 || now < lastKnownSessionTokenExpiresAt;
  const recentlySeen = now - lastKnownSessionTokenSeenAt < TOKEN_FALLBACK_TTL_MS;
  const canReuseWithoutRefresh = now - lastKnownSessionTokenSeenAt < TOKEN_REFRESH_DEBOUNCE_MS;

  // Debounce hot-path token reads (e.g. many tRPC headers in parallel on web startup)
  // to avoid auth lock contention inside supabase.auth.getSession().
  if (lastKnownSessionToken && tokenStillValid && recentlySeen && canReuseWithoutRefresh) {
    return lastKnownSessionToken;
  }

  if (sessionTokenInFlight) {
    return sessionTokenInFlight;
  }

  const tokenRequest = (async () => {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token ?? null;
    if (token) {
      const expiresAtSec = data.session?.expires_at ?? 0;
      lastKnownSessionToken = token;
      lastKnownSessionTokenSeenAt = Date.now();
      lastKnownSessionTokenExpiresAt = expiresAtSec > 0 ? expiresAtSec * 1000 : 0;
      return token;
    }
    // Avoid transient unauth races during token refresh/hydration.
    const fallbackNow = Date.now();
    const fallbackTokenStillValid =
      lastKnownSessionTokenExpiresAt === 0 || fallbackNow < lastKnownSessionTokenExpiresAt;
    const fallbackRecentlySeen = fallbackNow - lastKnownSessionTokenSeenAt < TOKEN_FALLBACK_TTL_MS;
    if (lastKnownSessionToken && fallbackTokenStillValid && fallbackRecentlySeen) {
      return lastKnownSessionToken;
    }
    return null;
  } catch (error) {
    console.error("[Auth] Failed to get session token:", error);
    const fallbackNow = Date.now();
    const fallbackTokenStillValid =
      lastKnownSessionTokenExpiresAt === 0 || fallbackNow < lastKnownSessionTokenExpiresAt;
    const fallbackRecentlySeen = fallbackNow - lastKnownSessionTokenSeenAt < TOKEN_FALLBACK_TTL_MS;
    if (lastKnownSessionToken && fallbackTokenStillValid && fallbackRecentlySeen) {
      return lastKnownSessionToken;
    }
    return null;
  }
  })();

  sessionTokenInFlight = tokenRequest;
  try {
    return await tokenRequest;
  } finally {
    if (sessionTokenInFlight === tokenRequest) {
      sessionTokenInFlight = null;
    }
  }
}

/** Sign out from Supabase. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  lastKnownSessionToken = null;
  lastKnownSessionTokenExpiresAt = 0;
  lastKnownSessionTokenSeenAt = 0;
  await clearUserInfo();
}

/** @deprecated Use signOut() instead. Kept for backward compatibility. */
export const removeSessionToken = signOut;

// ---------------------------------------------------------------------------
// Cached user profile (public.users)
// ---------------------------------------------------------------------------

export async function getUserInfo(): Promise<User | null> {
  try {
    let info: string | null = null;
    if (Platform.OS === "web") {
      info = window.localStorage.getItem(USER_INFO_KEY);
    } else {
      const SecureStore = await import("expo-secure-store");
      info = await SecureStore.getItemAsync(USER_INFO_KEY);
    }
    if (!info) return null;
    return JSON.parse(info);
  } catch (error) {
    console.error("[Auth] Failed to get user info:", error);
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
    } else {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
    }
  } catch (error) {
    console.error("[Auth] Failed to set user info:", error);
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(USER_INFO_KEY);
    } else {
      const SecureStore = await import("expo-secure-store");
      await SecureStore.deleteItemAsync(USER_INFO_KEY);
    }
  } catch (error) {
    console.error("[Auth] Failed to clear user info:", error);
  }
}
