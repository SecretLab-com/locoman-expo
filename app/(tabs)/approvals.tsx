import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/contexts/auth-context";
import { router } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function ApprovalsRedirectScreen() {
  const { canManage } = useAuthContext();

  useEffect(() => {
    if (canManage) {
      router.replace("/(manager)/approvals" as any);
      return;
    }
    router.replace("/(tabs)" as any);
  }, [canManage]);

  return (
    <ScreenContainer className="flex-1 items-center justify-center">
      <View className="items-center">
        <Text className="text-muted">Loading approvals...</Text>
      </View>
    </ScreenContainer>
  );
}
