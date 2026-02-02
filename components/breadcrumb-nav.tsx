import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { router } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export type BreadcrumbItem = {
  /** Display label for the breadcrumb */
  label: string;
  /** Route path to navigate to when pressed (optional for current/last item) */
  path?: string;
  /** Optional params to pass to the route */
  params?: Record<string, string>;
};

type BreadcrumbNavProps = {
  /** Array of breadcrumb items from root to current */
  items: BreadcrumbItem[];
  /** Whether to show home icon as first item (default: true) */
  showHome?: boolean;
  /** Custom home path (default: /(tabs)) */
  homePath?: string;
};

/**
 * Breadcrumb navigation component for deeply nested screens.
 * Shows the navigation path and allows users to jump back to any level.
 * 
 * Usage:
 * ```tsx
 * <BreadcrumbNav
 *   items={[
 *     { label: "Bundles", path: "/(trainer)/bundles" },
 *     { label: "Weight Loss Program", path: "/bundle/123" },
 *     { label: "Edit" }, // Current screen, no path
 *   ]}
 * />
 * ```
 */
export function BreadcrumbNav({
  items,
  showHome = true,
  homePath = "/(tabs)",
}: BreadcrumbNavProps) {
  const colors = useColors();

  const handlePress = async (item: BreadcrumbItem) => {
    if (!item.path) return; // Current item, no navigation
    
    await haptics.light();
    
    if (item.params) {
      router.push({ pathname: item.path as any, params: item.params });
    } else {
      router.push(item.path as any);
    }
  };

  const handleHomePress = async () => {
    await haptics.light();
    router.replace(homePath as any);
  };

  // Build full items list including home
  const allItems: (BreadcrumbItem & { isHome?: boolean })[] = showHome
    ? [{ label: "Home", path: homePath, isHome: true }, ...items]
    : items;

  return (
    <View className="border-b border-border bg-surface/50">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }}
      >
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isClickable = !!item.path && !isLast;

          return (
            <View key={index} className="flex-row items-center">
              {/* Separator */}
              {index > 0 && (
                <IconSymbol
                  name="chevron.right"
                  size={12}
                  color={colors.muted}
                  style={{ marginHorizontal: 8 }}
                />
              )}

              {/* Breadcrumb item */}
              {item.isHome ? (
                <TouchableOpacity
                  onPress={handleHomePress}
                  activeOpacity={0.7}
                  className="flex-row items-center"
                  accessibilityRole="link"
                  accessibilityLabel="Go to home"
                >
                  <IconSymbol name="house.fill" size={14} color={colors.primary} />
                </TouchableOpacity>
              ) : isClickable ? (
                <TouchableOpacity
                  onPress={() => handlePress(item)}
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  accessibilityLabel={`Go to ${item.label}`}
                >
                  <Text
                    className="text-sm text-primary font-medium"
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text
                  className="text-sm text-muted font-medium"
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
