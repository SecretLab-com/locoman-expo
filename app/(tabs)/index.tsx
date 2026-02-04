import { useEffect } from "react";
import { ActivityIndicator } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/contexts/auth-context";
import { navigateToHome } from "@/lib/navigation";
import { router, useLocalSearchParams } from "expo-router";
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
    isCoordinator,
    isManager,
    isTrainer,
    isClient,
  } = useAuthContext();

  const { guest } = useLocalSearchParams<{ guest: string }>();

  useEffect(() => {
    // Wait for hydration and a small mount delay to prevent flakiness
    if (loading) return;

    if (isAuthenticated) {
      console.log("[UnifiedHome] Authenticated as:", effectiveRole);
      if (effectiveRole && effectiveRole !== "shopper") {
        console.log("[UnifiedHome] Navigating to dashboard...");
        navigateToHome({ isCoordinator, isManager, isTrainer, isClient });
      }
    } else if (!guest) {
      // Not authenticated -> Landing Page
      // Only redirect if we're sure we're not just about to log in
      console.log("[UnifiedHome] Not authenticated, redirecting to welcome...");
      router.replace("/welcome");
    }
  }, [loading, isAuthenticated, effectiveRole, isCoordinator, isManager, isTrainer, isClient, guest]);

  // Not authenticated or shopper → Decide between Welcome or Shopper experience
  if (!isAuthenticated || effectiveRole === "shopper" || !effectiveRole) {
    // If not authenticated, we prefer showing the high-impact landing page first
    // unless they explicitly chose to browse programs.
    return <ShopperHome />;
  }

  return (
    <ScreenContainer className="items-center justify-center">
      <ActivityIndicator size="large" />
    </ScreenContainer>
  );
}
