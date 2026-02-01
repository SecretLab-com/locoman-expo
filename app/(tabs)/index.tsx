import { useAuthContext } from "@/contexts/auth-context";

// Import role-specific dashboard components
import ClientHome from "@/components/dashboards/client-home";
import ManagerHome from "@/components/dashboards/manager-home";
import ShopperHome from "@/components/dashboards/shopper-home";
import TrainerHome from "@/components/dashboards/trainer-home";

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
  const { isAuthenticated, effectiveRole } = useAuthContext();

  // Not authenticated or shopper → Show shopper experience
  if (!isAuthenticated || effectiveRole === "shopper" || !effectiveRole) {
    return <ShopperHome />;
  }

  // Role-specific dashboards
  switch (effectiveRole) {
    case "coordinator":
      // Coordinators in tabs use the client-style home experience
      return <ClientHome />;
    case "manager":
      return <ManagerHome />;
    case "trainer":
      return <TrainerHome />;
    case "client":
      return <ClientHome />;
    default:
      return <ShopperHome />;
  }

}
