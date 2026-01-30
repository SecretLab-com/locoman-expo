import { router } from "expo-router";

/**
 * Centralized navigation utility for consistent home/dashboard navigation.
 * 
 * The "home" destination is always the user's role-specific dashboard:
 * - Coordinator: /(coordinator) - Impersonate screen
 * - Manager: /(manager) - Manager dashboard
 * - Trainer: /(trainer) - Trainer dashboard
 * - Client: /(client) - Client dashboard
 * - Shopper/Guest: /(tabs) - Default tab view
 * 
 * This ensures all "Home", "Dashboard", and "Go to Dashboard" buttons
 * navigate to the same predictable destination.
 */

type UserRole = "coordinator" | "manager" | "trainer" | "client" | "shopper" | null;

interface RoleFlags {
  isCoordinator?: boolean;
  isManager?: boolean;
  isTrainer?: boolean;
  isClient?: boolean;
}

/**
 * Get the home route path for a given role.
 * This is the initial landing page when the app loads for that role.
 */
export function getHomeRoute(roleFlags: RoleFlags): string {
  const { isCoordinator, isManager, isTrainer, isClient } = roleFlags;
  
  if (isCoordinator) return "/(coordinator)";
  if (isManager) return "/(manager)";
  if (isTrainer) return "/(trainer)";
  if (isClient) return "/(client)";
  return "/(tabs)";
}

/**
 * Navigate to the user's home/dashboard.
 * Uses router.replace to prevent back navigation to the previous screen.
 */
export function navigateToHome(roleFlags: RoleFlags): void {
  const route = getHomeRoute(roleFlags);
  router.replace(route as any);
}

/**
 * Navigate to the user's home/dashboard using push (allows back navigation).
 */
export function pushToHome(roleFlags: RoleFlags): void {
  const route = getHomeRoute(roleFlags);
  router.push(route as any);
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
