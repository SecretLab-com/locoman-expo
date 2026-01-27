import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptics } from "@/hooks/use-haptics";

/**
 * Banner shown when a coordinator is impersonating another user.
 * Displays the impersonated user's name and provides a button to end impersonation.
 */
export function ImpersonationBanner() {
  const colors = useColors();
  const { isImpersonating, impersonatedUser, stopImpersonation, isCoordinator } = useAuthContext();

  // Only show if actually impersonating
  if (!isImpersonating || !impersonatedUser) {
    return null;
  }

  const handleEndImpersonation = async () => {
    await haptics.medium();
    stopImpersonation();
    // Navigate back to coordinator dashboard
    router.replace("/(coordinator)" as any);
  };

  return (
    <SafeAreaView 
      edges={["top", "left", "right"]}
      className="bg-warning/20 border-b border-warning"
      style={{ zIndex: 1000 }}
    >
      <View className="px-4 pt-2 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <IconSymbol name="person.badge.key.fill" size={20} color={colors.warning} />
          <View className="ml-2 flex-1">
            <Text className="text-warning font-semibold text-sm">Impersonating</Text>
            <Text className="text-warning/80 text-xs" numberOfLines={1}>
              {impersonatedUser.name || impersonatedUser.email || "Unknown User"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleEndImpersonation}
          className="bg-warning px-4 py-2 rounded-full"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold text-sm">End Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
