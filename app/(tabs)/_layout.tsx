import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { BadgeIcon } from "@/components/badge-icon";
import { useColors } from "@/hooks/use-colors";
import { useAuthContext } from "@/contexts/auth-context";
import { useBadgeContext } from "@/contexts/badge-context";

/**
 * Unified Tab Layout
 * 
 * This provides a STABLE bottom navigation that doesn't change based on role.
 * All users see the same 5 tabs:
 * - Home: Role-adaptive dashboard
 * - Discover: Browse products, trainers, bundles
 * - Activity: Orders, deliveries, notifications
 * - Messages: Conversations
 * - Profile: Settings, account
 * 
 * Role-specific features are accessed from the Home dashboard via cards/buttons,
 * not separate tabs. This creates a consistent, predictable navigation experience.
 */
export default function UnifiedTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthContext();
  const { counts } = useBadgeContext();
  
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  // Calculate total activity badge (deliveries + orders pending)
  const activityBadge = (counts.pendingDeliveries || 0) + (counts.pendingApprovals || 0);

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
      {/* Home - Role-adaptive dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      
      {/* Discover - Browse products, trainers, bundles */}
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
        }}
      />
      
      {/* Activity - Orders, deliveries, notifications */}
      <Tabs.Screen
        name="activity"
        options={{
          title: "Activity",
          tabBarIcon: ({ color }) => (
            <BadgeIcon size={28} name="bell.fill" color={color} badge={activityBadge} />
          ),
        }}
      />
      
      {/* Messages - Conversations */}
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="message.fill" color={color} />,
        }}
      />
      
      {/* Profile - Settings, account */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
      
      {/* Hidden screens - accessible via navigation but not in tab bar */}
      <Tabs.Screen name="home" options={{ href: null }} />
      <Tabs.Screen name="products" options={{ href: null }} />
      <Tabs.Screen name="trainers" options={{ href: null }} />
      <Tabs.Screen name="cart" options={{ href: null }} />
    </Tabs>
  );
}
