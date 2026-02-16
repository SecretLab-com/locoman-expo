import { Slot, usePathname } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { RoleBottomNav, type RoleNavItem } from "@/components/role-bottom-nav";
import { useAuthContext } from "@/contexts/auth-context";
import { resetToHome } from "@/lib/navigation";

export default function CoordinatorTabLayout() {
  const { isAuthenticated, loading, hasSession, profileHydrated, effectiveRole } = useAuthContext();
  const pathname = usePathname();

  useEffect(() => {
    const authTransit = loading || (hasSession && !profileHydrated);
    if (authTransit || !isAuthenticated) return;
    if (effectiveRole === "coordinator") return;
    resetToHome(effectiveRole);
  }, [effectiveRole, hasSession, isAuthenticated, loading, profileHydrated]);

  const navItems: RoleNavItem[] = [
    { label: "Home", icon: "house.fill", href: "/(coordinator)/dashboard", testID: "tab-home" },
    { label: "Users", icon: "person.2.fill", href: "/(coordinator)/users", testID: "tab-users" },
    { label: "Products", icon: "storefront.fill", href: "/(coordinator)/products", testID: "tab-products" },
    { label: "Analytics", icon: "chart.bar.fill", href: "/(coordinator)/analytics", testID: "tab-analytics" },
    { label: "Messaging", icon: "message.fill", href: "/(coordinator)/messages", testID: "tab-messaging" },
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
