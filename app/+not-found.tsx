import { Redirect } from "expo-router";

/**
 * Fallback for unknown deep-link paths.
 * Keeps native app opens resilient by sending unmatched routes to home.
 */
export default function NotFoundRedirect() {
  return <Redirect href="/(tabs)" />;
}
