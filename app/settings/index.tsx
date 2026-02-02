import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem, useBottomNavHeight } from "@/components/role-bottom-nav";
import { useAuthContext } from "@/contexts/auth-context";
import { useBadgeContext } from "@/contexts/badge-context";

import ClientSettings from "../(client)/settings";
import CoordinatorSettings from "../(coordinator)/settings";
import ManagerSettings from "../(manager)/settings";
import TabsSettings from "../(tabs)/settings";
import TrainerSettings from "../(trainer)/settings";

export default function SettingsIndexScreen() {
  const navHeight = useBottomNavHeight();
  const { effectiveRole } = useAuthContext();
  const { counts } = useBadgeContext();

  const SettingsScreen =
    effectiveRole === "trainer"
      ? TrainerSettings
      : effectiveRole === "manager"
        ? ManagerSettings
        : effectiveRole === "coordinator"
          ? CoordinatorSettings
          : effectiveRole === "client"
            ? ClientSettings
            : TabsSettings;

  const navItems: RoleNavItem[] = (() => {
    if (effectiveRole === "manager") {
      return [
        { label: "Home", icon: "house.fill", href: "/(manager)", testID: "tab-home" },
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
        { label: "Home", icon: "house.fill", href: "/(coordinator)", testID: "tab-home" },
        { label: "Users", icon: "person.2.fill", href: "/(coordinator)/users", testID: "tab-users" },
        { label: "Bundles", icon: "cube.box.fill", href: "/(coordinator)/bundles", testID: "tab-bundles" },
        {
          label: "Alerts",
          icon: "exclamationmark.triangle.fill",
          href: "/(coordinator)/alerts?section=alerts",
          testID: "tab-alerts",
        },
        { label: "Messaging", icon: "message.fill", href: "/(coordinator)/messages", testID: "tab-messaging" },
      ];
    }
    if (effectiveRole === "trainer") {
      return [
        { label: "Home", icon: "house.fill", href: "/(trainer)", testID: "tab-home" },
        { label: "Clients", icon: "person.2.fill", href: "/(trainer)/clients", testID: "tab-clients" },
        { label: "Pay", icon: "creditcard.fill", href: "/(trainer)/pay", testID: "tab-pay" },
        { label: "Analytics", icon: "chart.bar.fill", href: "/(trainer)/analytics", testID: "tab-analytics" },
        {
          label: "Alerts",
          icon: "exclamationmark.triangle.fill",
          href: "/(trainer)/alerts",
          testID: "tab-alerts",
          badge: counts.pendingDeliveries,
        },
      ];
    }

    const roleName = effectiveRole ?? "shopper";
    const showCart = !["trainer", "manager", "coordinator"].includes(String(roleName));
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
      <View style={{ flex: 1, paddingBottom: navHeight }}>
        <SettingsScreen />
      </View>
      <RoleBottomNav items={navItems} />
    </View>
  );
}
