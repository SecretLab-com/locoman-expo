import { useEffect, useRef } from "react";
import { Tabs, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAuthContext } from "@/contexts/auth-context";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;
  
  // Get auth context for role-based redirection
  const { isAuthenticated, role, loading } = useAuthContext();
  const hasRedirected = useRef(false);

  // Redirect authenticated users to their role-specific dashboard
  useEffect(() => {
    // Don't redirect if still loading, not authenticated, or already redirected
    if (loading || !isAuthenticated || hasRedirected.current) return;
    
    // Only redirect non-shopper roles to their dashboards
    // Shoppers stay on the main (tabs) view
    if (role && role !== "shopper") {
      hasRedirected.current = true;
      
      let targetRoute = "/(tabs)";
      if (role === "trainer") {
        targetRoute = "/(trainer)";
      } else if (role === "client") {
        targetRoute = "/(client)";
      } else if (role === "manager") {
        targetRoute = "/(manager)";
      } else if (role === "coordinator") {
        targetRoute = "/(coordinator)";
      }
      
      // Use replace to prevent back navigation to (tabs)
      router.replace(targetRoute as any);
    }
  }, [isAuthenticated, role, loading]);

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
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      {/* Home hub screen - hidden, accessible via navigation */}
      <Tabs.Screen
        name="home"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cube.box.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="trainers"
        options={{
          title: "Trainers",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} />,
        }}
      />
      {/* Profile is now accessed via the ProfileFAB in top-right corner */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
