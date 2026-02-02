import { useEffect } from "react";
import { ActivityIndicator } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/contexts/auth-context";
import { navigateToHome } from "@/lib/navigation";
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

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated && effectiveRole && effectiveRole !== "shopper") {
      navigateToHome({ isCoordinator, isManager, isTrainer, isClient });
    }
  }, [loading, isAuthenticated, effectiveRole, isCoordinator, isManager, isTrainer, isClient]);

  // Not authenticated or shopper → Show shopper experience
  if (!isAuthenticated || effectiveRole === "shopper" || !effectiveRole) {
    return <ShopperHome />;
  }

  return (
    <ScreenContainer className="items-center justify-center">
      <ActivityIndicator size="large" />
    </ScreenContainer>
  );
}
