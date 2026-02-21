import { Slot, usePathname } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useRoleGuard } from "@/hooks/use-role-guard";

/**
 * Client Tab Layout
 *
 * Consistent bottom navigation for client workflows:
 * - Home: Dashboard
 * - Shop: Active bundles and purchases
 * - Trainer: Your trainers and chat
 * - Basket: Subscriptions and cart
 * - Account: Insights and billing
 */
export default function ClientTabLayout() {
  useRoleGuard("client");
  const pathname = usePathname();

  const navItems: RoleNavItem[] = [
    { label: "Home", icon: "house.fill", href: "/(client)/dashboard", testID: "tab-home" },
    { label: "Shop", icon: "storefront.fill", href: "/(client)/orders", testID: "tab-orders" },
    { label: "Trainer", icon: "person.2.fill", href: "/my-trainers", testID: "tab-trainer" },
    { label: "Basket", icon: "cart.fill", href: "/(client)/subscriptions", testID: "tab-basket" },
    { label: "Account", icon: "person.circle.fill", href: "/(client)/spending", testID: "tab-revenue" },
  ];
  const hideBottomNav = pathname.includes("/conversation/") || pathname.endsWith("/messages/new");

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      {!hideBottomNav && <RoleBottomNav items={navItems} />}
    </View>
  );
}
