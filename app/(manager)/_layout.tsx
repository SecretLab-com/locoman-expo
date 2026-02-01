import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BadgeIcon } from "@/components/badge-icon";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBadgeContext } from "@/contexts/badge-context";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

export default function ManagerTabLayout() {
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
        name="approvals"
        options={{
          title: "Approvals",
          tabBarIcon: ({ color }) => <BadgeIcon size={28} name="checkmark.circle.fill" color={color} badge={counts.pendingApprovals} />,
          tabBarButton: renderTabButton("tab-approvals", "Approvals tab"),
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: "Users",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          tabBarButton: renderTabButton("tab-users", "Users tab"),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          href: null,
        }}
      />
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
