import { useAuthContext } from "@/contexts/auth-context";
import { getHomeRoute } from "@/lib/navigation";
import { Redirect } from "expo-router";

export default function RootIndexRoute() {
  const { loading, hasSession, profileHydrated, isAuthenticated, effectiveRole } = useAuthContext();

  const authTransit = loading || (hasSession && !profileHydrated);
  if (authTransit) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  const roleTarget = getHomeRoute(effectiveRole ?? null);
  return <Redirect href={(roleTarget || "/(tabs)") as any} />;
}
