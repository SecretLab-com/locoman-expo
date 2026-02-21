import { Slot, usePathname } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useRoleGuard } from "@/hooks/use-role-guard";

export default function CoordinatorTabLayout() {
  useRoleGuard("coordinator");
  const pathname = usePathname();

  const navItems: RoleNavItem[] = [
    { label: "Home", icon: "house.fill", href: "/(coordinator)/dashboard", testID: "tab-home" },
    { label: "Users", icon: "person.2.fill", href: "/(coordinator)/users", testID: "tab-users" },
    { label: "Products", icon: "storefront.fill", href: "/(coordinator)/products", testID: "tab-products" },
    { label: "Analytics", icon: "chart.bar.fill", href: "/(coordinator)/analytics", testID: "tab-analytics" },
    { label: "More", icon: "ellipsis.circle.fill", href: "/(coordinator)/more", testID: "tab-more" },
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
