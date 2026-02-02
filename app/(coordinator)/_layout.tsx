import { Slot, usePathname } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem, useBottomNavHeight } from "@/components/role-bottom-nav";

export default function CoordinatorTabLayout() {
  const navHeight = useBottomNavHeight();
  const pathname = usePathname();
  const disableBottomPadding = pathname.includes("/messages/") || pathname.includes("/conversation/");
  const navItems: RoleNavItem[] = [
    { label: "Home", icon: "house.fill", href: "/(coordinator)", testID: "tab-home" },
    { label: "Users", icon: "person.2.fill", href: "/(coordinator)/users", testID: "tab-users" },
    { label: "Bundles", icon: "cube.box.fill", href: "/(coordinator)/bundles", testID: "tab-bundles" },
    { label: "Alerts", icon: "exclamationmark.triangle.fill", href: "/(coordinator)/alerts?section=alerts", testID: "tab-alerts" },
    { label: "Messaging", icon: "message.fill", href: "/(coordinator)/messages", testID: "tab-messaging" },
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
