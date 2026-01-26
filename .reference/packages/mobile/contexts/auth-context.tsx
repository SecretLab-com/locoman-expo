import React, { createContext, useContext, ReactNode, useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import * as Auth from "@/lib/_core/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";

type AuthContextType = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  // Role helpers
  role: UserRole | null;
  isTrainer: boolean;
  isClient: boolean;
  isManager: boolean;
  isCoordinator: boolean;
  canManage: boolean; // manager or coordinator
  // Impersonation (coordinator only)
  impersonatedUser: Auth.User | null;
  isImpersonating: boolean;
  startImpersonation: (user: Auth.User) => void;
  stopImpersonation: () => void;
  effectiveUser: Auth.User | null; // The user to use for UI (impersonated or real)
  effectiveRole: UserRole | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const IMPERSONATION_KEY = "locomotivate_impersonation";

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [impersonatedUser, setImpersonatedUser] = useState<Auth.User | null>(null);

  // Load impersonation state on mount
  useEffect(() => {
    async function loadImpersonation() {
      try {
        const saved = await AsyncStorage.getItem(IMPERSONATION_KEY);
        if (saved) {
          setImpersonatedUser(JSON.parse(saved));
        }
      } catch (error) {
        console.error("[Auth] Failed to load impersonation state:", error);
      }
    }
    loadImpersonation();
  }, []);

  // Clear impersonation when logging out
  useEffect(() => {
    if (!auth.isAuthenticated && impersonatedUser) {
      setImpersonatedUser(null);
      AsyncStorage.removeItem(IMPERSONATION_KEY);
    }
  }, [auth.isAuthenticated, impersonatedUser]);

  const startImpersonation = useCallback((user: Auth.User) => {
    setImpersonatedUser(user);
    AsyncStorage.setItem(IMPERSONATION_KEY, JSON.stringify(user));
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
    AsyncStorage.removeItem(IMPERSONATION_KEY);
  }, []);

  // Determine effective user (impersonated or real)
  const effectiveUser = impersonatedUser || auth.user;
  const isImpersonating = !!impersonatedUser;

  // Role helpers
  const role = (auth.user?.role as UserRole) || null;
  const effectiveRole = (effectiveUser?.role as UserRole) || null;
  
  const isTrainer = effectiveRole === "trainer" || effectiveRole === "manager" || effectiveRole === "coordinator";
  const isClient = effectiveRole === "client";
  const isManager = effectiveRole === "manager" || effectiveRole === "coordinator";
  const isCoordinator = role === "coordinator"; // Real role, not impersonated
  const canManage = isManager;

  const value: AuthContextType = {
    ...auth,
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}

// Convenience hooks for role checks
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
