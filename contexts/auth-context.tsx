import { useAuth } from "@/hooks/use-auth";
import * as Auth from "@/lib/_core/auth";
import { logError, logEvent } from "@/lib/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";

type AuthContextType = {
  user: Auth.User | null;
  hasSession: boolean;
  profileHydrated: boolean;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  role: UserRole | null;
  isTrainer: boolean;
  isClient: boolean;
  isManager: boolean;
  isCoordinator: boolean;
  canManage: boolean;
  impersonatedUser: Auth.User | null;
  isImpersonating: boolean;
  startImpersonation: (user: Auth.User) => void;
  stopImpersonation: () => void;
  effectiveUser: Auth.User | null;
  effectiveRole: UserRole | null;
  /** True while impersonation is transitioning -- navigation guards should hold. */
  navigationFrozen: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IMPERSONATION_KEY = "locomotivate_impersonation";
const NAVIGATION_FREEZE_MS = 1000;
const VALID_ROLES: UserRole[] = ["shopper", "client", "trainer", "manager", "coordinator"];

function hasValidRole(user: Auth.User | null | undefined): user is Auth.User {
  return Boolean(user?.role && VALID_ROLES.includes(user.role as UserRole));
}

function toValidRole(value: unknown): UserRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return VALID_ROLES.includes(normalized as UserRole) ? (normalized as UserRole) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [impersonatedUser, setImpersonatedUser] = useState<Auth.User | null>(null);
  const [navigationFrozen, setNavigationFrozen] = useState(false);
  const freezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const freezeNavigation = useCallback(() => {
    setNavigationFrozen(true);
    if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    freezeTimerRef.current = setTimeout(() => {
      setNavigationFrozen(false);
      freezeTimerRef.current = null;
    }, NAVIGATION_FREEZE_MS);
  }, []);

  useEffect(() => {
    async function loadImpersonation() {
      try {
        const saved = await AsyncStorage.getItem(IMPERSONATION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Auth.User;
          if (hasValidRole(parsed)) {
            setImpersonatedUser(parsed);
            freezeNavigation();
            logEvent("impersonation.restore");
          } else {
            await AsyncStorage.removeItem(IMPERSONATION_KEY);
          }
        }
      } catch (error) {
        logError("impersonation.restore_failed", error);
      }
    }
    loadImpersonation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auth.isAuthenticated && impersonatedUser) {
      setImpersonatedUser(null);
      AsyncStorage.removeItem(IMPERSONATION_KEY);
    }
  }, [auth.isAuthenticated, impersonatedUser]);

  const startImpersonation = useCallback(async (user: Auth.User) => {
    freezeNavigation();
    setImpersonatedUser(user);
    await AsyncStorage.setItem(IMPERSONATION_KEY, JSON.stringify(user));
    logEvent("impersonation.start", { userId: user.id, role: user.role });
  }, [freezeNavigation]);

  const stopImpersonation = useCallback(async () => {
    freezeNavigation();
    setImpersonatedUser(null);
    await AsyncStorage.removeItem(IMPERSONATION_KEY);
    logEvent("impersonation.stop");
  }, [freezeNavigation]);

  const logout = useCallback(async () => {
    try {
      setImpersonatedUser(null);
      await AsyncStorage.removeItem(IMPERSONATION_KEY);
      await auth.logout();
    } finally {
      router.replace("/welcome");
    }
  }, [auth]);

  const effectiveUser = impersonatedUser || auth.user;
  const isImpersonating = !!impersonatedUser;
  const role = toValidRole(auth.user?.role);
  const effectiveRole = toValidRole(effectiveUser?.role);

  const isTrainer = effectiveRole === "trainer" || effectiveRole === "manager" || effectiveRole === "coordinator";
  const isClient = effectiveRole === "client";
  const isManager = effectiveRole === "manager" || effectiveRole === "coordinator";
  const isCoordinator = role === "coordinator";
  const canManage = isManager;

  const value: AuthContextType = useMemo(() => ({
    ...auth,
    logout,
    role,
    isTrainer,
    isClient,
    isManager,
    isCoordinator,
    canManage,
    impersonatedUser,
    isImpersonating,
    startImpersonation,
    stopImpersonation,
    effectiveUser,
    effectiveRole,
    navigationFrozen,
  }), [
    auth, logout, role, isTrainer, isClient, isManager, isCoordinator, canManage,
    impersonatedUser, isImpersonating, startImpersonation, stopImpersonation,
    effectiveUser, effectiveRole, navigationFrozen,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}

export function useIsTrainer() {
  const { isTrainer } = useAuthContext();
  return isTrainer;
}

export function useIsManager() {
  const { isManager } = useAuthContext();
  return isManager;
}

export function useIsCoordinator() {
  const { isCoordinator } = useAuthContext();
  return isCoordinator;
}
