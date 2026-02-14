import { BadgeIcon } from "@/components/badge-icon";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { router, usePathname } from "expo-router";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BASE_NAV_HEIGHT = 56;

export type RoleNavItem = {
  label: string;
  icon: Parameters<typeof IconSymbol>[0]["name"];
  href: string;
  testID: string;
  badge?: number;
};

function normalizePath(path: string) {
  return path.replace(/\((.*?)\)/g, "$1");
}

function isActivePath(pathname: string, href: string) {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  return current === target || current.startsWith(`${target}/`);
}

export function RoleBottomNav({ items }: { items: RoleNavItem[] }) {
  const colors = useColors();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const height = BASE_NAV_HEIGHT + bottomPadding;

  return (
    <View
      className="flex-row items-center justify-around border-t border-border bg-surface"
      style={{ height, paddingBottom: bottomPadding }}
    >
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        const color = active ? colors.primary : colors.muted;
        return (
          <TouchableOpacity
            key={item.testID}
            onPress={async () => {
              if (active) return;
              await haptics.light();
              router.replace(item.href as any);
            }}
            className="flex-1 items-center justify-center py-2"
            accessibilityRole="button"
            accessibilityLabel={item.label}
            testID={item.testID}
            activeOpacity={0.7}
          >
            {item.badge ? (
              <BadgeIcon size={24} name={item.icon} color={color} badge={item.badge} />
            ) : (
              <IconSymbol size={24} name={item.icon} color={color} />
            )}
            <Text className="text-[11px] mt-1" style={{ color }}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function useBottomNavHeight() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return BASE_NAV_HEIGHT + bottomPadding;
}
