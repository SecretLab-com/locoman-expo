import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

/**
 * Client Tab Layout
 *
 * Consistent bottom navigation for client workflows:
 * - Home: Dashboard
 * - Orders: Active bundles and purchases
 * - Deliveries: Product delivery tracking
 * - Subscriptions: Recurring programs
 * - Revenue: Insights and billing
 */
export default function ClientTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;
  const renderTabButton = (testID: string, label: string) => {
    const TabButton = (props: any) => (
      <HapticTab {...props} testID={testID} accessibilityLabel={label} />
    );
    TabButton.displayName = `TabButton(${testID})`;
    return TabButton;
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          tabBarButton: renderTabButton("tab-home", "Home tab"),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bag.fill" color={color} />,
          tabBarButton: renderTabButton("tab-orders", "Orders tab"),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="shippingbox.fill" color={color} />,
          tabBarButton: renderTabButton("tab-deliveries", "Deliveries tab"),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: "Subscriptions",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="creditcard.fill" color={color} />,
          tabBarButton: renderTabButton("tab-subscriptions", "Subscriptions tab"),
        }}
      />
      <Tabs.Screen
        name="spending"
        options={{
          title: "Revenue",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
          tabBarButton: renderTabButton("tab-revenue", "Revenue tab"),
        }}
      />
    </Tabs>
  );
}
