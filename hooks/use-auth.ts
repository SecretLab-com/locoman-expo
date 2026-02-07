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
    role: (apiUser.role as Auth.UserRole) ?? "shopper",
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

// Global refresh callback so the login screen can trigger a re-fetch
let globalRefreshCallback: (() => void) | null = null;

export function triggerAuthRefresh() {
  console.log("[useAuth] triggerAuthRefresh called, callback exists:", !!globalRefreshCallback);
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  /**
   * Fetch the app-level user profile from the backend.
   * Relies on the Supabase access token being sent automatically
   * via the tRPC link's Authorization header.
   */
  const fetchUser = useCallback(async (opts?: { suppressLoading?: boolean }) => {
    console.log("[useAuth] fetchUser called");
    try {
      if (!opts?.suppressLoading) setLoading(true);
      setError(null);

      // Check if we have a Supabase session
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        console.log("[useAuth] No Supabase session, clearing user");
        setUser(null);
        await Auth.clearUserInfo();
        return;
      }

      // Show cached user immediately while we fetch from API
      const cachedUser = await Auth.getUserInfo();
      if (cachedUser && !opts?.suppressLoading) {
        setUser(cachedUser);
        setLoading(false);
      }

      // Fetch full user profile from backend (tRPC auth.me)
      const { getApiBaseUrl } = await import("@/lib/api-config");
      const apiBase = getApiBaseUrl();
      const token = sessionData.session.access_token;

      const resp = await fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.user) {
          const userInfo = normalizeUser(data.user as Record<string, unknown>);
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
          console.log("[useAuth] User set from API:", userInfo.email, userInfo.role);
        } else {
          console.log("[useAuth] No user returned from API");
          setUser(cachedUser); // keep cached if API returns no user
        }
      } else {
        console.warn("[useAuth] API returned", resp.status);
        // Keep cached user if API fails temporarily
        if (!cachedUser) setUser(null);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", e);
      logError("auth.fetch_failed", e);
      setError(e);
      setUser(null);
    } finally {
      if (!opts?.suppressLoading) setLoading(false);
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

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[useAuth] Auth state changed:", event, session ? "session present" : "no session");
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          await fetchUser({ suppressLoading: true });
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          await Auth.clearUserInfo();
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [autoFetch, fetchUser]);

  // Log sign-in / sign-out transitions
  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    if (user && user.id !== prevUserId) {
      logEvent("auth.signed_in", { userId: user.id, role: user.role });
    } else if (!user && prevUserId !== null) {
      logEvent("auth.signed_out");
    }
    prevUserIdRef.current = user?.id ?? null;
  }, [user]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
