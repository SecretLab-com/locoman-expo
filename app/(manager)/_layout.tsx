import { Slot } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useBadgeContext } from "@/contexts/badge-context";

export default function ManagerTabLayout() {
  const { counts } = useBadgeContext();
  const navItems: RoleNavItem[] = [
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

  return (
    <View className="flex-1 bg-background">
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <RoleBottomNav items={navItems} />
    </View>
  );
}
