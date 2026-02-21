import { Slot, usePathname } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useBadgeContext } from "@/contexts/badge-context";
import { useRoleGuard } from "@/hooks/use-role-guard";

export default function ManagerTabLayout() {
  useRoleGuard("manager");
  const { counts } = useBadgeContext();
  const pathname = usePathname();

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
