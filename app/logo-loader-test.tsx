import { Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { LogoLoader } from "@/components/ui/logo-loader";
import { ScreenHeader } from "@/components/ui/screen-header";
import { withAlpha } from "@/design-system/color-utils";
import { useColors } from "@/hooks/use-colors";

export default function LogoLoaderTestScreen() {
  const colors = useColors();

  return (
    <ScreenContainer>
      <ScreenHeader
        title="Logo Loader Test"
        subtitle="Continuous logo draw preview."
      />

      <View className="flex-1 px-4 pb-8">
        <View
          className="flex-1 rounded-2xl items-center justify-center"
          style={{
            backgroundColor: withAlpha(colors.primary, 0.06),
            borderWidth: 1,
            borderColor: withAlpha(colors.primary, 0.16),
          }}
        >
          <LogoLoader size={220} durationMs={2000} holdMs={200} />
          <Text className="text-sm text-muted mt-6">Looping at 2.0s draw + 0.2s full-logo hold.</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
