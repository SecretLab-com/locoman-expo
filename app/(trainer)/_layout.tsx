import { Slot } from "expo-router";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";

export default function TrainerTabLayout() {
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

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Slot />
      </View>
      <RoleBottomNav items={navItems} />
    </View>
  );
}
