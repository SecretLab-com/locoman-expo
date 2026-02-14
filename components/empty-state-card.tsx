import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { Text, TouchableOpacity, View } from "react-native";

type EmptyStateCardProps = {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  title: string;
  description: string;
  ctaLabel: string;
  onCtaPress: () => void;
  testID?: string;
};

export function EmptyStateCard({
  icon,
  title,
  description,
  ctaLabel,
  onCtaPress,
  testID,
}: EmptyStateCardProps) {
  const colors = useColors();

  return (
    <View className="bg-surface rounded-xl border border-border p-6 items-center">
      <IconSymbol name={icon} size={34} color={colors.muted} />
      <Text className="text-foreground font-semibold mt-3 text-center">{title}</Text>
      <Text className="text-muted text-sm text-center mt-1">{description}</Text>
      <TouchableOpacity
        className="bg-primary px-5 py-2.5 rounded-full mt-4"
        onPress={onCtaPress}
        accessibilityRole="button"
        testID={testID}
      >
        <Text className="text-background font-semibold">{ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

