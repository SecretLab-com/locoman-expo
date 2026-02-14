import { Slot } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";

export default function CoordinatorTabLayout() {
  const navItems: RoleNavItem[] = [
    { label: "Home", icon: "house.fill", href: "/(coordinator)/dashboard", testID: "tab-home" },
    { label: "Users", icon: "person.2.fill", href: "/(coordinator)/users", testID: "tab-users" },
    { label: "Products", icon: "storefront.fill", href: "/(coordinator)/products", testID: "tab-products" },
    { label: "Analytics", icon: "chart.bar.fill", href: "/(coordinator)/analytics", testID: "tab-analytics" },
    { label: "Messaging", icon: "message.fill", href: "/(coordinator)/messages", testID: "tab-messaging" },
  ];

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <RoleBottomNav items={navItems} />
    </View>
  );
}
