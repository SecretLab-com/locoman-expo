import { Slot, usePathname } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem, useBottomNavHeight } from "@/components/role-bottom-nav";

/**
 * Client Tab Layout
 *
 * Consistent bottom navigation for client workflows:
 * - Home: Dashboard
 * - Orders: Active bundles and purchases
 * - Deliveries: Product delivery tracking
 * - Subscriptions: Recurring programs
 * - Revenue: Insights and billing
 */
export default function ClientTabLayout() {
  const navHeight = useBottomNavHeight();
  const pathname = usePathname();
  const disableBottomPadding = pathname.includes("/messages/") || pathname.includes("/conversation/");
  const navItems: RoleNavItem[] = [
    { label: "Home", icon: "house.fill", href: "/(client)", testID: "tab-home" },
    { label: "Orders", icon: "bag.fill", href: "/(client)/orders", testID: "tab-orders" },
    { label: "Deliveries", icon: "shippingbox.fill", href: "/(client)/deliveries", testID: "tab-deliveries" },
    { label: "Subscriptions", icon: "creditcard.fill", href: "/(client)/subscriptions", testID: "tab-subscriptions" },
    { label: "Revenue", icon: "chart.bar.fill", href: "/(client)/spending", testID: "tab-revenue" },
  ];

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1, paddingBottom: disableBottomPadding ? 0 : navHeight }}>
        <Slot />
      </View>
      <RoleBottomNav items={navItems} />
    </View>
  );
}
