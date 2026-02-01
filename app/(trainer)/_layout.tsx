import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BadgeIcon } from "@/components/badge-icon";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBadgeContext } from "@/contexts/badge-context";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

export default function TrainerTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { counts } = useBadgeContext();
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
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
          tabBarButton: renderTabButton("tab-calendar", "Calendar tab"),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          tabBarButton: renderTabButton("tab-clients", "Clients tab"),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ color }) => <BadgeIcon size={28} name="shippingbox.fill" color={color} badge={counts.pendingDeliveries} />,
          tabBarButton: renderTabButton("tab-deliveries", "Deliveries tab"),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="bundles"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="points"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invite"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="partnerships"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="join-requests"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
