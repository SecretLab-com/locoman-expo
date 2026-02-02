import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { navigateToHome } from "@/lib/navigation";

/**
 * Shopper Tab Layout
 *
 * Stable bottom navigation for shoppers:
 * - Home: Role-adaptive dashboard
 * - Products: Browse catalog
 * - Trainers: Find trainers
 * - Cart: View cart
 * - Profile: Settings, account
 */
export default function UnifiedTabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { role, canManage, isTrainer, isClient, isCoordinator, isManager } = useAuthContext();
  const isAdmin = role === "manager" || role === "coordinator";
  const showCart = !isAdmin && !isTrainer;
  
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;
  const renderTabButton = (testID: string, label: string) => {
    const TabButton = (props: any) => (
      <HapticTab {...props} testID={testID} accessibilityLabel={label} />
    );
    TabButton.displayName = `TabButton(${testID})`;
    return TabButton;
  };
  const renderHomeTabButton = () => {
    const TabButton = (props: any) => (
      <HapticTab
        {...props}
        testID="tab-home"
        accessibilityLabel="Home tab"
        onPress={() => navigateToHome({ isCoordinator, isManager, isTrainer, isClient })}
      />
    );
    TabButton.displayName = "TabButton(tab-home)";
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
      {/* Home - Role-adaptive dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          tabBarButton: renderHomeTabButton(),
        }}
      />
      
      {/* Products - Browse catalog */}
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="cube.box.fill" color={color} />,
          tabBarButton: renderTabButton("tab-products", "Products tab"),
        }}
      />
      
      {/* Trainers/Users - Find trainers or manage users */}
      <Tabs.Screen
        name="trainers"
        options={{
          title: isAdmin ? "Users" : "Trainers",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          tabBarButton: renderTabButton("tab-trainers", isAdmin ? "Users tab" : "Trainers tab"),
        }}
      />
      
      {/* Admin Approvals or Cart */}
      {isAdmin ? (
        <Tabs.Screen
          name="approvals"
          options={{
            title: "Approvals",
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="checkmark.circle.fill" color={color} />,
            tabBarButton: renderTabButton("tab-approvals", "Approvals tab"),
          }}
        />
      ) : (
        showCart && (
          <Tabs.Screen
            name="cart"
            options={{
              title: "Cart",
              tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} />,
              tabBarButton: renderTabButton("tab-cart", "Cart tab"),
            }}
          />
        )
      )}
      
      {/* Profile - Settings, account */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          tabBarButton: renderTabButton("tab-profile", "Profile tab"),
        }}
      />
      
      {/* Hidden screens - accessible via navigation but not in tab bar */}
      <Tabs.Screen name="discover" options={{ href: null }} />
      <Tabs.Screen name="activity" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
    </Tabs>
  );
}
