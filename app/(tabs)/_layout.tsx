import { Slot, usePathname } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useAuthContext } from "@/contexts/auth-context";
import { getHomeRoute, resetToHome } from "@/lib/navigation";

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
  const pathname = usePathname();
  const { isAuthenticated, loading, hasSession, profileHydrated, effectiveRole, isTrainer, canManage } = useAuthContext();

  useEffect(() => {
    const authTransit = loading || (hasSession && !profileHydrated);
    if (authTransit) return;
    if (!isAuthenticated) return;

    if (effectiveRole && effectiveRole !== "shopper") {
      // Trainers may browse catalog / cart tabs (RootAccessGate); do not bounce them to dashboard.
      if (effectiveRole === "trainer") {
        const p = pathname || "";
        const trainerAllowed =
          p === "/(tabs)/products" ||
          p.startsWith("/(tabs)/products/") ||
          p === "/(tabs)/cart" ||
          p.startsWith("/(tabs)/cart/");
        if (trainerAllowed) return;
      }
      const target = getHomeRoute(effectiveRole);
      if (target !== "/(tabs)") {
        resetToHome(effectiveRole);
      }
    }
  }, [effectiveRole, hasSession, isAuthenticated, loading, profileHydrated, pathname]);

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
