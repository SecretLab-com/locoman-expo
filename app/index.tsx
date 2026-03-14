import { useAuthContext } from "@/contexts/auth-context";
import { getHomeRoute } from "@/lib/navigation";
import { LogoLoader } from "@/components/ui/logo-loader";
import { Redirect } from "expo-router";
import { View } from "react-native";

export default function RootIndexRoute() {
  const { loading, hasSession, profileHydrated, isAuthenticated, effectiveRole } = useAuthContext();

  const authTransit = loading || (hasSession && !profileHydrated);
  if (authTransit) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <LogoLoader size={80} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  const roleTarget = getHomeRoute(effectiveRole ?? null);
  return <Redirect href={(roleTarget || "/(tabs)") as any} />;
}
