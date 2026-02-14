import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuthContext } from "@/contexts/auth-context";
import { getHomeRoute } from "@/lib/navigation";
import { router } from "expo-router";
import ShopperHome from "../../components/shopper-home";

/**
 * Unified Home Screen
 * 
 * This screen adapts its content based on the user's role while keeping
 * the bottom navigation stable. The navigation never changes - only the
 * content within this screen changes based on who is logged in.
 * 
 * Role mapping:
 * - Not authenticated / Shopper → ShopperHome (browse bundles)
 * - Client → ClientHome (active programs, deliveries)
 * - Trainer → TrainerHome (dashboard, stats, quick actions)
 * - Manager → ManagerHome (approvals, users, analytics)
 * - Coordinator → CoordinatorHome (impersonation, logs)
 */
export default function UnifiedHomeScreen() {
  const {
    isAuthenticated,
    effectiveRole,
    loading,
  } = useAuthContext();

  const validRoles = new Set(["shopper", "client", "trainer", "manager", "coordinator"]);
  const normalizedRole =
    typeof effectiveRole === "string" && validRoles.has(effectiveRole)
      ? effectiveRole
      : null;
  const redirectedRoleRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated) {
      if (normalizedRole && normalizedRole !== "shopper") {
        if (redirectedRoleRef.current === normalizedRole) return;
        redirectedRoleRef.current = normalizedRole;
        const timer = setTimeout(() => {
          const target = getHomeRoute(normalizedRole);
          if (target !== "/(tabs)") {
            router.replace(target as any);
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, isAuthenticated, normalizedRole, effectiveRole]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (isAuthenticated && normalizedRole && normalizedRole !== "shopper") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Not authenticated or shopper → Decide between Welcome or Shopper experience
  if (!isAuthenticated || normalizedRole === "shopper" || !normalizedRole) {
    // If not authenticated, we prefer showing the high-impact landing page first
    // unless they explicitly chose to browse programs.
    return <ShopperHome />;
  }

  // Avoid deadlocks on handoff by showing shopper home while redirecting.
  return <ShopperHome />;
}
