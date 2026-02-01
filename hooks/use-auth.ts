import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const fetchUser = useCallback(async () => {
    console.log("[useAuth] fetchUser called");
    try {
      setLoading(true);
      setError(null);

      // Web platform: use cookie-based auth, fetch user from API
      if (Platform.OS === "web") {
        console.log("[useAuth] Web platform: fetching user from API...");
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
          const cachedUser = await Auth.getUserInfo();
          if (cachedUser) {
            console.log("[useAuth] Web: Using cached user info as fallback");
            setUser(cachedUser);
          } else {
            setUser(null);
            await Auth.clearUserInfo();
          }
        }
        return;
      }

      // Native platform: use token-based auth
      console.log("[useAuth] Native platform: checking for session token...");
      const sessionToken = await Auth.getSessionToken();
      console.log(
        "[useAuth] Session token:",
        sessionToken ? `present (${sessionToken.substring(0, 20)}...)` : "missing",
      );
      if (!sessionToken) {
        console.log("[useAuth] No session token, setting user to null");
        setUser(null);
        return;
      }

      // Use cached user info for native (token validates the session)
      const cachedUser = await Auth.getUserInfo();
      console.log("[useAuth] Cached user:", cachedUser);
      if (cachedUser) {
        console.log("[useAuth] Using cached user info");
        setUser(cachedUser);
      } else {
        console.log("[useAuth] No cached user, setting user to null");
        setUser(null);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch user");
      console.error("[useAuth] fetchUser error:", error);
      setError(error);
      if (Platform.OS === "web") {
        const cachedUser = await Auth.getUserInfo();
        if (cachedUser) {
          console.log("[useAuth] Web: Using cached user info after error");
          setUser(cachedUser);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
      console.log("[useAuth] fetchUser completed, loading:", false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
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
    globalRefreshCallback = fetchUser;
    return () => {
      globalRefreshCallback = null;
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

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    logout,
  };
}
