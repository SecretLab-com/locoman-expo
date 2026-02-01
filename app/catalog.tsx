import { useAuthContext } from "@/contexts/auth-context";
import { router } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function CatalogRedirect() {
  const { loading } = useAuthContext();

  useEffect(() => {
    if (loading) return;
    router.replace("/(tabs)/products" as any);
  }, [loading]);

  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-muted">Loading catalog...</Text>
    </View>
  );
}
