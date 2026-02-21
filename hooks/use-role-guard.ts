import { useAuthContext, type UserRole } from "@/contexts/auth-context";
import { resetToHome } from "@/lib/navigation";
import { useEffect } from "react";

/**
 * Centralized role guard for layout files.
 *
 * Handles impersonation, navigation freezes, and auth transitions
 * in one place so individual layouts don't need to reimplement the logic.
 *
 * Usage:
 * ```ts
 * useRoleGuard("trainer");
 * ```
 */
export function useRoleGuard(allowedRole: UserRole) {
  const {
    isAuthenticated,
    loading,
    hasSession,
    profileHydrated,
    effectiveRole,
    isImpersonating,
    navigationFrozen,
  } = useAuthContext();

  useEffect(() => {
    if (navigationFrozen) return;
    if (isImpersonating) return;
    const authTransit = loading || (hasSession && !profileHydrated);
    if (authTransit || !isAuthenticated) return;
    if (effectiveRole === allowedRole) return;
    resetToHome(effectiveRole);
  }, [
    effectiveRole,
    hasSession,
    isAuthenticated,
    loading,
    profileHydrated,
    isImpersonating,
    navigationFrozen,
    allowedRole,
  ]);
}
