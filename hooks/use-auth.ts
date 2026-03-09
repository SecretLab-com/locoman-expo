/**
 * useAuth hook — Supabase Auth integration.
 *
 * Listens for Supabase auth state changes and fetches the full app-level
 * user profile (public.users) from the tRPC `auth.me` endpoint.
 */
import * as Auth from "@/lib/_core/auth";
import { supabase } from "@/lib/supabase-client";
import { logError, logEvent } from "@/lib/logger";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const VALID_ROLES: Auth.UserRole[] = ["shopper", "client", "trainer", "manager", "coordinator"];

function hasValidRole(user: Auth.User | null | undefined): user is Auth.User {
  return Boolean(user?.role && VALID_ROLES.includes(user.role));
}

function normalizeRole(value: unknown): Auth.UserRole {
  if (typeof value !== "string") return "shopper";
  const role = value.trim().toLowerCase();
  return VALID_ROLES.includes(role as Auth.UserRole) ? (role as Auth.UserRole) : "shopper";
}

function inferFallbackRoleFromSession(sessionUser: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): Auth.UserRole {
  const metadata = sessionUser.user_metadata ?? {};
  const appMetadata = sessionUser.app_metadata ?? {};
  const roleCandidates = [
    metadata.role,
    metadata.user_role,
    appMetadata.role,
    appMetadata.user_role,
  ];

  for (const candidate of roleCandidates) {
    const normalized = normalizeRole(candidate);
    if (normalized !== "shopper") {
      return normalized;
    }
  }

  const email = (sessionUser.email || "").toLowerCase().trim();
  if (email === "trainer@secretlab.com" || email.startsWith("trainer+")) return "trainer";
  if (email === "client@secretlab.com" || email.startsWith("client+")) return "client";
  if (email === "manager@secretlab.com" || email.startsWith("manager+")) return "manager";
  if (email === "coordinator@secretlab.com" || email.startsWith("coordinator+")) return "coordinator";
  if (email === "jason@secretlab.com") return "coordinator";

  return "shopper";
}

// Helper to convert API response to full User type with defaults
function normalizeUser(apiUser: Record<string, unknown>): Auth.User {
  return {
    id: apiUser.id as string,
    openId: apiUser.openId as string,
    name: (apiUser.name as string | null) ?? null,
    email: (apiUser.email as string | null) ?? null,
    phone: (apiUser.phone as string | null) ?? null,
    photoUrl: (apiUser.photoUrl as string | null) ?? null,
    loginMethod: (apiUser.loginMethod as string | null) ?? null,
    role: normalizeRole(apiUser.role),
    username: (apiUser.username as string | null) ?? null,
    bio: (apiUser.bio as string | null) ?? null,
    specialties: apiUser.specialties ?? null,
    socialLinks: apiUser.socialLinks ?? null,
    trainerId: (apiUser.trainerId as string | null) ?? null,
    active: (apiUser.active as boolean) ?? true,
    metadata: apiUser.metadata ?? null,
    createdAt: (apiUser.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (apiUser.updatedAt as string) ?? new Date().toISOString(),
    lastSignedIn: (apiUser.lastSignedIn as string) ?? new Date().toISOString(),
  };
}

function buildFallbackUserFromSession(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): Auth.User {
  const now = new Date().toISOString();
  const metadata = sessionUser.user_metadata ?? {};
  const name =
    (metadata.full_name as string | undefined) ||
    (metadata.name as string | undefined) ||
    sessionUser.email?.split("@")[0] ||
    "User";
  const photoUrl = (metadata.avatar_url as string | undefined) ?? null;
  // Use best-effort role inference so role dashboards remain stable when profile
  // hydration is temporarily unavailable (for example, CORS/network during web dev).
  const resolvedRole: Auth.UserRole = inferFallbackRoleFromSession(sessionUser);

  return {
    id: sessionUser.id,
    openId: sessionUser.id,
    name,
    email: sessionUser.email ?? null,
    phone: null,
    photoUrl,
    loginMethod: "oauth",
    role: resolvedRole,
    username: null,
    bio: null,
    specialties: null,
    socialLinks: null,
    trainerId: null,
    active: true,
    metadata,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

// Global refresh callback so the login screen can trigger a re-fetch
let globalRefreshCallback: (() => void) | null = null;

export function triggerAuthRefresh() {
  if (globalRefreshCallback) {
    globalRefreshCallback();
  }
}

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const prevUserIdRef = useRef<string | null>(null);
  const fetchUserInFlightRef = useRef<Promise<void> | null>(null);
  const lastSessionSeenAtRef = useRef(0);

  /**
   * Fetch the app-level user profile from the backend.
   * Relies on the Supabase access token being sent automatically
   * via the tRPC link's Authorization header.
   */
  const fetchUser = useCallback(async (opts?: { suppressLoading?: boolean }) => {
    if (fetchUserInFlightRef.current) {
      return fetchUserInFlightRef.current;
    }

    const inFlight = (async () => {
      try {
        if (!opts?.suppressLoading) setLoading(true);
        setError(null);

      // Check if we have a Supabase session
      let { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        // Guard against transient auth-lock races on web: briefly re-check before
        // treating the user as signed out.
        await new Promise((resolve) => setTimeout(resolve, 250));
        const retry = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        sessionData = retry.data as typeof sessionData;
      }

      if (!sessionData.session) {
        const fallbackToken = await Auth.getSessionToken().catch(() => null);
        const recentlyHadSession = Date.now() - lastSessionSeenAtRef.current < 20_000;
        if (fallbackToken && recentlyHadSession) {
          setHasSession(true);
          setProfileHydrated(true);
          return;
        }
        setHasSession(false);
        setProfileHydrated(true);
        setUser(null);
        await Auth.clearUserInfo();
        return;
      }
      lastSessionSeenAtRef.current = Date.now();
      setHasSession(true);
      setProfileHydrated(false);

      // Show cached user immediately while we fetch from API
      const cachedUser = await Auth.getUserInfo();
      const fallbackUser = buildFallbackUserFromSession(sessionData.session.user);
      const sessionEmailLower = sessionData.session.user.email?.toLowerCase() ?? "";
      const cachedEmailLower = cachedUser?.email?.toLowerCase() ?? "";
      const cacheMatchesSession = Boolean(cachedUser) && (
        !sessionEmailLower || cachedEmailLower === sessionEmailLower
      );
      const shouldPromoteFromFallback =
        cacheMatchesSession &&
        cachedUser?.role === "shopper" &&
        fallbackUser.role !== "shopper";
      const hasTrustedCachedUser = cacheMatchesSession && hasValidRole(cachedUser);
      const seedUser =
        hasTrustedCachedUser && cachedUser && !shouldPromoteFromFallback ? cachedUser : fallbackUser;

      if (!opts?.suppressLoading) {
        setUser(seedUser);
      } else {
        // During OAuth/native auth state transitions, we may fetch with suppressLoading.
        // Ensure a session-backed user exists so hydration gates do not stall indefinitely.
        setUser((prev) => {
          if (!prev) return seedUser;
          const prevEmailLower = prev.email?.toLowerCase() ?? "";
          const sessionMatchesPrev = !sessionEmailLower || prevEmailLower === sessionEmailLower;
          if (!sessionMatchesPrev) return seedUser;
          if (prev.role === "shopper" && seedUser.role !== "shopper") return seedUser;
          return prev;
        });
      }
      await Auth.setUserInfo(seedUser);

      // Fetch full user profile from backend (tRPC auth.me)
      const { getApiBaseUrl } = await import("@/lib/api-config");
      const apiBase = getApiBaseUrl();
      const token = sessionData.session.access_token;
      const controller = new AbortController();
      const timeoutMs = 8000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let resp: Response;
      try {
        resp = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (resp.ok) {
        const data = await resp.json();
        if (data.user) {
          const userInfo = normalizeUser(data.user as Record<string, unknown>);
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
        } else {
          setError(new Error("Authenticated session has no app user profile"));
          // Keep deterministic fallback identity for known mapped accounts.
          // This prevents transient /api/auth/me null responses from corrupting role to shopper.
          setUser(seedUser);
          await Auth.setUserInfo(seedUser);
        }
      } else {
        if (resp.status === 401) {
          await Auth.handleAuthDesync("auth_me_401");
          setHasSession(false);
          setProfileHydrated(true);
          setUser(null);
          setError(new Error("Session expired. Please sign in again."));
          return;
        }
        setError(new Error(`Auth profile request failed with status ${resp.status}`));
        // Preserve deterministic fallback role while backend recovers.
        setUser(seedUser);
        await Auth.setUserInfo(seedUser);
      }
      setProfileHydrated(true);
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to fetch user");
      const isAbort = e.name === "AbortError" || /abort(ed|error)/i.test(e.message);
      if (isAbort) {
        // Request aborts happen during auth transitions and timeout races; avoid redbox-level noise.
        logEvent("auth.fetch_aborted");
      } else {
        logError("auth.fetch_failed", e);
        setError(e);
      }
      const activeSession =
        (await supabase.auth.getSession().catch(() => ({ data: { session: null } }))).data.session;
      if (!activeSession) {
        const fallbackToken = await Auth.getSessionToken().catch(() => null);
        const recentlyHadSession = Date.now() - lastSessionSeenAtRef.current < 20_000;
        if (fallbackToken && recentlyHadSession) {
          // Keep current auth state instead of bouncing to guest during lock/contention races.
          setHasSession(true);
          setProfileHydrated(true);
          return;
        }
        setHasSession(false);
        setProfileHydrated(true);
        setUser(null);
      } else {
        lastSessionSeenAtRef.current = Date.now();
        setHasSession(true);
        setProfileHydrated(true);
        const fallbackUser = buildFallbackUserFromSession(activeSession.user);
        setUser((prev) => prev ?? fallbackUser);
      }
    } finally {
        if (!opts?.suppressLoading) setLoading(false);
      }
    })();

    fetchUserInFlightRef.current = inFlight;
    try {
      await inFlight;
    } finally {
      if (fetchUserInFlightRef.current === inFlight) {
        fetchUserInFlightRef.current = null;
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      logEvent("auth.logout");
      await Auth.signOut();
    } catch (err) {
      console.error("[Auth] Logout error:", err);
      logError("auth.logout_failed", err);
    } finally {
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user) || hasSession, [user, hasSession]);

  // Register global refresh callback
  useEffect(() => {
    const refresh = () => fetchUser();
    globalRefreshCallback = refresh;
    return () => {
      if (globalRefreshCallback === refresh) globalRefreshCallback = null;
    };
  }, [fetchUser]);

  // Listen for Supabase auth state changes
  useEffect(() => {
    if (!autoFetch) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchUser();

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setHasSession(Boolean(session));

      if (
        (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
        session
      ) {
        lastSessionSeenAtRef.current = Date.now();
        setLoading(true);
        setProfileHydrated(false);
        // Seed user synchronously from callback session to unblock hydration gates.
        const seeded = buildFallbackUserFromSession(session.user);
        setUser((prev) => {
          if (!prev) return seeded;
          const prevEmailLower = prev.email?.toLowerCase() ?? "";
          const sessionEmailLower = session.user.email?.toLowerCase() ?? "";
          const sessionMatchesPrev = !sessionEmailLower || prevEmailLower === sessionEmailLower;
          if (!sessionMatchesPrev) return seeded;
          if (prev.role === "shopper" && seeded.role !== "shopper") return seeded;
          return prev;
        });
        void Auth.setUserInfo(seeded);

        // Run full profile fetch asynchronously; avoid awaiting inside auth callback.
        // Do NOT suppress loading here: role-based navigation should wait until
        // profile hydration settles to prevent routing to the wrong dashboard.
        setTimeout(() => {
          void fetchUser();
        }, 0);
        return;
      }

      if (event === "TOKEN_REFRESHED" && session) {
        lastSessionSeenAtRef.current = Date.now();
        setHasSession(true);
        // No profile fetch needed on token refresh; avoids auth lock contention.
        return;
      }

      if (event === "SIGNED_OUT") {
        setHasSession(false);
        setProfileHydrated(true);
        setUser(null);
        void Auth.clearUserInfo();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [autoFetch, fetchUser]);

  // Log sign-in / sign-out transitions
  useEffect(() => {
    if (!profileHydrated) return;
    const prevUserId = prevUserIdRef.current;
    if (user && user.id !== prevUserId) {
      logEvent("auth.signed_in", { userId: user.id, role: user.role });
    } else if (!user && prevUserId !== null) {
      logEvent("auth.signed_out");
    }
    prevUserIdRef.current = user?.id ?? null;
  }, [user, profileHydrated]);

  return {
    user,
    hasSession,
    profileHydrated,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
