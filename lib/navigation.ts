import { router } from "expo-router";

/**
 * Centralized navigation utility for consistent home/dashboard navigation.
 * 
 * UNIFIED NAVIGATION PATTERN:
 * All users navigate to the same /(tabs) destination. The Home tab adapts
 * its content based on the user's role, but the navigation structure remains
 * stable and predictable.
 * 
 * This follows the mainstream app pattern (Instagram, Uber, DoorDash):
 * - Single stable bottom tab bar
 * - Role-specific content adapts within screens
 * - No navigation structure changes based on role
 */

type UserRole = "coordinator" | "manager" | "trainer" | "client" | "shopper" | null;

interface RoleFlags {
  isCoordinator?: boolean;
  isManager?: boolean;
  isTrainer?: boolean;
  isClient?: boolean;
}

/**
 * Get the home route path.
 * Always returns the appropriate dashboard for authenticated users with specific roles,
 * or the unified tabs for shoppers and guests.
 */
export function getHomeRoute(roleOrFlags?: RoleFlags | string | null): string {
  if (!roleOrFlags) return "/(tabs)";

  if (typeof roleOrFlags === "string") {
    if (roleOrFlags === "coordinator") return "/(coordinator)/dashboard";
    if (roleOrFlags === "manager") return "/(manager)/dashboard";
    if (roleOrFlags === "trainer") return "/(trainer)/dashboard";
    if (roleOrFlags === "client") return "/(client)/dashboard";
    return "/(tabs)";
  }

  const flags = roleOrFlags as RoleFlags;
  if (flags.isCoordinator) return "/(coordinator)/dashboard";
  if (flags.isManager) return "/(manager)/dashboard";
  if (flags.isTrainer) return "/(trainer)/dashboard";
  if (flags.isClient) return "/(client)/dashboard";
  return "/(tabs)";
}

function tryDismissAll(): void {
  try {
    const dismissAll = (router as any).dismissAll;
    if (typeof dismissAll === "function") {
      dismissAll();
    }
  } catch {
    // Best-effort stack reset.
  }
}

export function resetToHome(roleOrFlags?: RoleFlags | string | null): void {
  const target = getHomeRoute(roleOrFlags);
  tryDismissAll();
  try {
    router.replace(target as any);
  } catch {
    router.navigate(target as any);
  }
}

/**
 * Navigate to home.
 * Uses router.replace to prevent back navigation to the previous screen.
 */
export function navigateToHome(_roleFlags?: RoleFlags | string | null): void {
  resetToHome(_roleFlags);
}

/**
 * Navigate to home using push (allows back navigation).
 */
export function pushToHome(_roleFlags?: RoleFlags | string | null): void {
  router.push(getHomeRoute(_roleFlags) as any);
}

/**
 * Get the display label for the home destination.
 * Always returns "Home" for consistency.
 */
export function getHomeLabel(): string {
  return "Home";
}

/**
 * Get the display label with role context (for debugging/display purposes).
 */
export function getHomeLabelWithRole(roleFlags: RoleFlags): string {
  const { isCoordinator, isManager, isTrainer, isClient } = roleFlags;

  if (isCoordinator) return "Coordinator Home";
  if (isManager) return "Manager Home";
  if (isTrainer) return "Trainer Home";
  if (isClient) return "Client Home";
  return "Home";
}

/**
 * Navigate to a role-specific screen from the unified tabs.
 * These screens open as Stack cards on top of the tabs.
 */
export function navigateToRoleScreen(screen: string): void {
  router.push(screen as any);
}

/**
 * Get role-scoped conversation route to preserve stack gesture behavior.
 * Falls back to shared conversation route for shopper/guest contexts.
 */
export function getRoleConversationPath(role?: UserRole | string | null): string {
  if (role === "coordinator") return "/(coordinator)/conversation/[id]";
  if (role === "manager") return "/(manager)/conversation/[id]";
  if (role === "trainer") return "/(trainer)/conversation/[id]";
  if (role === "client") return "/(client)/conversation/[id]";
  return "/conversation/[id]";
}

/**
 * Role-specific screen routes for quick access from dashboards.
 */
export const RoleScreens = {
  // Client screens
  client: {
    subscriptions: "/(client)/subscriptions",
    deliveries: "/(client)/deliveries",
    spending: "/(client)/spending",
    orders: "/(client)/orders",
  },
  // Trainer screens
  trainer: {
    bundles: "/(trainer)/bundles",
    calendar: "/(trainer)/calendar",
    clients: "/(trainer)/clients",
    deliveries: "/(trainer)/deliveries",
    earnings: "/(trainer)/earnings",
    orders: "/(trainer)/orders",
    invite: "/(trainer)/invite",
    joinRequests: "/(trainer)/join-requests",
    partnerships: "/(trainer)/partnerships",
    points: "/(trainer)/points",
    settings: "/(trainer)/settings",
  },
  // Manager screens
  manager: {
    approvals: "/(manager)/approvals",
    users: "/(manager)/users",
    analytics: "/(manager)/analytics",
    trainers: "/(manager)/trainers",
    templates: "/(manager)/templates",
    invitations: "/(manager)/invitations",
    deliveries: "/(manager)/deliveries",
    products: "/(manager)/products",
  },
  // Coordinator screens
  coordinator: {
    catalog: "/(coordinator)/catalog",
    logs: "/(coordinator)/logs",
  },
} as const;
