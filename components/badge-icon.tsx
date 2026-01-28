import { View, Text } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

type BadgeIconProps = {
  name: Parameters<typeof IconSymbol>[0]["name"];
  color: string;
  size?: number;
  badge?: number;
};

/**
 * Icon with optional badge indicator for tab bar
 * Shows a red badge with count when badge > 0
 */
export function BadgeIcon({ name, color, size = 28, badge }: BadgeIconProps) {
  return (
    <View style={{ width: size, height: size }}>
      <IconSymbol name={name} color={color} size={size} />
      {badge !== undefined && badge > 0 && (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -8,
            backgroundColor: "#EF4444",
            borderRadius: 10,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {badge > 99 ? "99+" : badge}
          </Text>
        </View>
      )}
    </View>
  );
}
