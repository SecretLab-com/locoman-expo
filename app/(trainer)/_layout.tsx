import { Slot, usePathname } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem, useBottomNavHeight } from "@/components/role-bottom-nav";
import { useBadgeContext } from "@/contexts/badge-context";

export default function TrainerTabLayout() {
  const { counts } = useBadgeContext();
  const navHeight = useBottomNavHeight();
  const pathname = usePathname();
  const disableBottomPadding = pathname.includes("/messages/") || pathname.includes("/conversation/");
  const navItems: RoleNavItem[] = [
    { label: "Home", icon: "house.fill", href: "/(trainer)", testID: "tab-home" },
    {
      label: "Clients",
      icon: "person.2.fill",
      href: "/(trainer)/clients",
      testID: "tab-clients",
    },
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

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1, paddingBottom: disableBottomPadding ? 0 : navHeight }}>
        <Slot />
      </View>
      <RoleBottomNav items={navItems} />
    </View>
  );
}
