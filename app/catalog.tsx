import { useAuthContext } from "@/contexts/auth-context";
import { router } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function CatalogRedirect() {
  const { loading, effectiveRole } = useAuthContext();

  const target =
    effectiveRole === "client"
      ? "/(client)/products"
      : effectiveRole === "trainer"
        ? "/(trainer)/products"
        : effectiveRole === "manager"
          ? "/(manager)/products"
          : effectiveRole === "coordinator"
            ? "/(coordinator)/bundles"
            : "/(tabs)/products";

  useEffect(() => {
    if (loading) return;
    router.replace(target as any);
  }, [loading, target]);

  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-muted">Loading catalog...</Text>
    </View>
  );
}
