import { useAuthContext } from "@/contexts/auth-context";

// Import role-specific dashboard components
import ShopperHome from "@/components/dashboards/shopper-home";
import ClientHome from "@/components/dashboards/client-home";
import TrainerHome from "@/components/dashboards/trainer-home";
import ManagerHome from "@/components/dashboards/manager-home";
import CoordinatorHome from "@/components/dashboards/coordinator-home";

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
  const { isAuthenticated, effectiveRole, isImpersonating } = useAuthContext();

  // Not authenticated or shopper role → Show shopper/browse experience
  if (!isAuthenticated || effectiveRole === "shopper" || !effectiveRole) {
    return <ShopperHome />;
  }

  // Role-specific dashboards
  switch (effectiveRole) {
    case "coordinator":
      // Coordinators who are impersonating see the impersonated role's dashboard
      // Otherwise they see the coordinator dashboard
      if (!isImpersonating) {
        return <CoordinatorHome />;
      }
      // Fall through to show impersonated role's dashboard
      break;
    case "manager":
      return <ManagerHome />;
    case "trainer":
      return <TrainerHome />;
    case "client":
      return <ClientHome />;
    default:
      return <ShopperHome />;
  }

  // This handles coordinators who are impersonating
  return <ShopperHome />;
}
