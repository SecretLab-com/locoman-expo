import { useSegments } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useAuthContext } from "@/contexts/auth-context";
import { useBadgeContext } from "@/contexts/badge-context";
import MessagesScreen from "../(tabs)/messages";

export default function MessagesIndexScreen() {
  const segments = useSegments();
  const hasRoleLayout = segments.some((segment) =>
    ["(tabs)", "(trainer)", "(manager)", "(coordinator)", "(client)"].includes(segment),
  );
  const showBottomNav = !hasRoleLayout;
  const { effectiveRole } = useAuthContext();
  const { counts } = useBadgeContext();

  const navItems: RoleNavItem[] = (() => {
    if (effectiveRole === "manager") {
      return [
        { label: "Home", icon: "house.fill", href: "/(manager)/dashboard", testID: "tab-home" },
        {
          label: "Approvals",
          icon: "checkmark.circle.fill",
          href: "/(manager)/approvals",
          testID: "tab-approvals",
          badge: counts.pendingApprovals,
        },
        { label: "Users", icon: "person.2.fill", href: "/(manager)/users", testID: "tab-users" },
      ];
    }
    if (effectiveRole === "coordinator") {
      return [
        { label: "Home", icon: "house.fill", href: "/(coordinator)/dashboard", testID: "tab-home" },
        { label: "Users", icon: "person.2.fill", href: "/(coordinator)/users", testID: "tab-users" },
        { label: "Products", icon: "storefront.fill", href: "/(coordinator)/products", testID: "tab-products" },
        {
          label: "Analytics",
          icon: "chart.bar.fill",
          href: "/(coordinator)/analytics",
          testID: "tab-analytics",
        },
        { label: "Messaging", icon: "message.fill", href: "/(coordinator)/messages", testID: "tab-messaging" },
      ];
    }
    if (effectiveRole === "trainer") {
      return [
        { label: "Home", icon: "house.fill", href: "/(trainer)/dashboard", testID: "tab-home" },
        { label: "Clients", icon: "person.2.fill", href: "/(trainer)/clients", testID: "tab-clients" },
        { label: "Pay", icon: "creditcard.fill", href: "/(trainer)/pay", testID: "tab-pay" },
        { label: "Analytics", icon: "chart.bar.fill", href: "/(trainer)/analytics", testID: "tab-analytics" },
        {
          label: "Deliveries",
          icon: "shippingbox.fill",
          href: "/(trainer)/deliveries",
          testID: "tab-deliveries",
          badge: counts.pendingDeliveries,
        },
      ];
    }

    const role = effectiveRole ?? "shopper";
    const showCart = !["trainer", "manager", "coordinator"].includes(String(role));
    const items: RoleNavItem[] = [
      { label: "Home", icon: "house.fill", href: "/(tabs)", testID: "tab-home" },
      { label: "Products", icon: "cube.box.fill", href: "/(tabs)/products", testID: "tab-products" },
      { label: "Trainers", icon: "person.2.fill", href: "/(tabs)/trainers", testID: "tab-trainers" },
    ];
    if (showCart) {
      items.push({
        label: "Cart",
        icon: "cart.fill",
        href: "/(tabs)/cart",
        testID: "tab-cart",
      });
    }
    items.push({
      label: "Profile",
      icon: "person.fill",
      href: "/(tabs)/profile",
      testID: "tab-profile",
    });
    return items;
  })();

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1 }}>
        <MessagesScreen />
      </View>
      {showBottomNav && <RoleBottomNav items={navItems} />}
    </View>
  );
}
