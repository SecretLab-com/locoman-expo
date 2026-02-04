import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { logError, logEvent } from "@/lib/logger";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

// Helper to convert API response to full User type with defaults
function normalizeUser(apiUser: Record<string, unknown>): Auth.User {
  return {
    id: apiUser.id as number,
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
    trainerId: (apiUser.trainerId as number | null) ?? null,
    active: (apiUser.active as boolean) ?? true,
    metadata: apiUser.metadata ?? null,
    createdAt: apiUser.createdAt ? new Date(apiUser.createdAt as string) : new Date(),
    updatedAt: apiUser.updatedAt ? new Date(apiUser.updatedAt as string) : new Date(),
    lastSignedIn: apiUser.lastSignedIn ? new Date(apiUser.lastSignedIn as string) : new Date(),
  };
}

// Global state to allow login screen to trigger auth refresh
let globalRefreshCallback: (() => void) | null = null;

export function triggerAuthRefresh() {
  console.log("[useAuth] triggerAuthRefresh called, callback exists:", !!globalRefreshCallback);
  if (globalRefreshCallback) {
    globalRefreshCallback();
  }
}

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const prevUserIdRef = useRef<number | null>(null);

  const fetchUser = useCallback(async (options?: { suppressLoading?: boolean }) => {
    console.log("[useAuth] fetchUser called");
    try {
      if (!options?.suppressLoading) {
        setLoading(true);
      }
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        console.log("[useAuth] Web platform: fetching user from API...");

        // Check cached user info first for faster initial load
        const cachedUser = await Auth.getUserInfo();
        if (cachedUser) {
          console.log("[useAuth] Web: using cached user immediately", cachedUser);
          setUser(cachedUser);
          if (!options?.suppressLoading) {
            setLoading(false);
          }
        }

        const apiUser = await Api.getMe();
        console.log("[useAuth] API user response:", apiUser);

        if (apiUser) {
          const userInfo = normalizeUser(apiUser as Record<string, unknown>);
          setUser(userInfo);
          // Cache user info in localStorage for faster subsequent loads
          await Auth.setUserInfo(userInfo);
          console.log("[useAuth] Web user set from API:", userInfo);
        } else {
          console.log("[useAuth] Web: No authenticated user from API");
          setUser(null);
          await Auth.clearUserInfo();
        }
        // Do not return here, let it fall through to finally block for native/common logic if any
        // but for now native is separate. However, we must ensure setLoading(false) runs.
      } else {
        // Native platform: validate token against API
        console.log("[useAuth] Native platform: checking for session token...");
        const sessionToken = await Auth.getSessionToken();
        console.log(
          "[useAuth] Session token:",
          sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing",
        );
        if (!sessionToken) {
          console.log("[useAuth] No session token, setting user to null");
          setUser(null);
          await Auth.clearUserInfo();
          return;
        }

        const apiUser = await Api.getMe();
        if (apiUser) {
          const userInfo = normalizeUser(apiUser as Record<string, unknown>);
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
          console.log("[useAuth] Native user set from API:", userInfo);
        } else {
          console.log("[useAuth] Native: No authenticated user from API");
          setUser(null);
          await Auth.clearUserInfo();
          await Auth.removeSessionToken();
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      logError("auth.fetch_failed", error);
      setError(error);
      if (Platform.OS === "web") {
        console.log("[useAuth] Web: Clearing cached user after error");
        await Auth.clearUserInfo();
      }
      setUser(null);
    } finally {
      if (!options?.suppressLoading) {
        setLoading(false);
        console.log("[useAuth] fetchUser completed, loading:", false);
      }
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
      logEvent("auth.logout");
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
      logError("auth.logout_failed", err);
      // Continue with logout even if API call fails
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  // Register global refresh callback
  useEffect(() => {
    const refresh = () => {
      console.log("[useAuth] Global refresh callback triggered");
      fetchUser();
    };
    globalRefreshCallback = refresh;
    return () => {
      if (globalRefreshCallback === refresh) {
        globalRefreshCallback = null;
      }
    };
  }, [fetchUser]);

  useEffect(() => {
    console.log("[useAuth] useEffect triggered, autoFetch:", autoFetch, "platform:", Platform.OS);
    if (autoFetch) {
      if (Platform.OS === "web") {
        // Web: fetch user from API directly (user will login manually if needed)
        console.log("[useAuth] Web: fetching user from API...");
        fetchUser();
      } else {
        // Native: check for cached user info first for faster initial load
        Auth.getUserInfo().then((cachedUser) => {
          console.log("[useAuth] Native cached user check:", cachedUser);
          if (cachedUser) {
            console.log("[useAuth] Native: setting cached user immediately");
            setUser(cachedUser);
            setLoading(false);
            fetchUser({ suppressLoading: true });
          } else {
            // No cached user, check session token
            fetchUser();
          }
        });
      }
    } else {
      console.log("[useAuth] autoFetch disabled, setting loading to false");
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  useEffect(() => {
    console.log("[useAuth] State updated:", {
      hasUser: !!user,
      loading,
      isAuthenticated,
      error: error?.message,
    });
  }, [user, loading, isAuthenticated, error]);

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
