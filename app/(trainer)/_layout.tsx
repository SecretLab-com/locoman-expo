import { Slot, usePathname } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useRoleGuard } from "@/hooks/use-role-guard";

export default function TrainerTabLayout() {
  useRoleGuard("trainer");
  const pathname = usePathname();

  const navItems: RoleNavItem[] = [
    { label: "Home", icon: "house.fill", href: "/(trainer)/dashboard", testID: "tab-home" },
    {
      label: "Clients",
      icon: "person.2.fill",
      href: "/(trainer)/clients",
      testID: "tab-clients",
    },
    { label: "Get Paid", icon: "creditcard.fill", href: "/(trainer)/get-paid", testID: "tab-get-paid" },
    { label: "Rewards", icon: "star.fill", href: "/(trainer)/rewards", testID: "tab-rewards" },
    { label: "More", icon: "ellipsis.circle.fill", href: "/(trainer)/more", testID: "tab-more" },
  ];
  const hideBottomNav = pathname.includes("/conversation/") || pathname.endsWith("/messages/new");

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      {!hideBottomNav && <RoleBottomNav items={navItems} />}
    </View>
  );
}
