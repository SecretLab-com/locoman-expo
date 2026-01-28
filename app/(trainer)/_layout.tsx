import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BadgeIcon } from "@/components/badge-icon";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useBadgeContext } from "@/contexts/badge-context";

export default function TrainerTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { counts } = useBadgeContext();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

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
          backgroundColor: '#000000',
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Clients",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ color }) => <BadgeIcon size={28} name="shippingbox.fill" color={color} badge={counts.pendingDeliveries} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="dollarsign.circle.fill" color={color} />,
        }}
      />
      {/* Hidden tabs - accessible via navigation */}
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
