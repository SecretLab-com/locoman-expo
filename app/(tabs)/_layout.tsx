import { Slot } from "expo-router";
import { router } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useAuthContext } from "@/contexts/auth-context";
import { getHomeRoute } from "@/lib/navigation";

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
  const { isAuthenticated, loading, hasSession, profileHydrated, effectiveRole, isTrainer, canManage } = useAuthContext();

  useEffect(() => {
    const authTransit = loading || (hasSession && !profileHydrated);
    if (authTransit) return;
    if (!isAuthenticated) return;

    if (effectiveRole && effectiveRole !== "shopper") {
      const target = getHomeRoute(effectiveRole);
      if (target !== "/(tabs)") {
        router.navigate(target as any);
      }
    }
  }, [effectiveRole, hasSession, isAuthenticated, loading, profileHydrated]);

  const showCart = !canManage && !isTrainer;

  const navItems: RoleNavItem[] = [
    {
      label: "Home",
      icon: "house.fill",
      href: "/(tabs)",
      testID: "tab-home",
    },
    {
      label: "Products",
      icon: "cube.box.fill",
      href: "/(tabs)/products",
      testID: "tab-products",
    },
    {
      label: "Trainers",
      icon: "person.2.fill",
      href: "/(tabs)/trainers",
      testID: "tab-trainers",
    },
  ];
  if (showCart) {
    navItems.push({
      label: "Cart",
      icon: "cart.fill",
      href: "/(tabs)/cart",
      testID: "tab-cart",
    });
  }
  navItems.push({
    label: "Profile",
    icon: "person.fill",
    href: "/(tabs)/profile",
    testID: "tab-profile",
  });

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <RoleBottomNav items={navItems} />
    </View>
  );
}
