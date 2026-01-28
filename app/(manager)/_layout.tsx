import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BadgeIcon } from "@/components/badge-icon";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useBadgeContext } from "@/contexts/badge-context";

export default function ManagerTabLayout() {
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
        name="approvals"
        options={{
          title: "Approvals",
          tabBarIcon: ({ color }) => <BadgeIcon size={28} name="checkmark.circle.fill" color={color} badge={counts.pendingApprovals} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Users",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      {/* Hidden tabs - accessible from dashboard */}
      <Tabs.Screen
        name="trainers"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invitations"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
