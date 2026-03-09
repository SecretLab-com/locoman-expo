import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useBadgeContext } from "@/contexts/badge-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/lib/api-config";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MenuItem = {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
  showDot?: boolean;
};

export function ProfileFAB() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { user, effectiveUser, isAuthenticated, logout, isTrainer, effectiveRole } = useAuthContext();
  const { counts } = useBadgeContext();
  const { data: latestProfile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const [menuVisible, setMenuVisible] = useState(false);
  const pathname = usePathname();
  const { data: conversations } = trpc.messages.conversations.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: Infinity,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const roleBase =
    effectiveRole === "client"
      ? "/(client)"
      : effectiveRole === "trainer"
        ? "/(trainer)"
        : effectiveRole === "manager"
          ? "/(manager)"
          : effectiveRole === "coordinator"
            ? "/(coordinator)"
            : "/(tabs)";

  // Hide FAB on profile screen since it's redundant there
  const isOnProfileScreen =
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === `${roleBase}/profile` ||
    pathname.startsWith(`${roleBase}/profile/`);
  const isOnDashboardScreen =
    pathname === "/dashboard" ||
    pathname.endsWith("/dashboard") ||
    (pathname === "/" && Boolean(effectiveRole) && effectiveRole !== "shopper");
  const showFloatingAlerts = isOnDashboardScreen && effectiveRole === "trainer";
  const alertBadgeCount = counts.pendingDeliveries + counts.pendingJoinRequests;
  const profileFabRightOffset = 16;
  const alertFabRightOffset = 68;
  const isOnMessageThread = pathname.includes("/messages/") || pathname.includes("/conversation/");
  const isOnBundleDetail = pathname.includes("/bundle/");
  const openConversationId = useMemo(() => {
    const isConversationRoute =
      pathname.startsWith("/conversation/") || pathname.startsWith("/messages/");
    if (!isConversationRoute) return null;
    const parts = pathname.split("/");
    return parts.length >= 3 ? decodeURIComponent(parts[2]) : null;
  }, [pathname]);
  const unreadMessagesExcludingOpenConversation =
    conversations?.reduce((sum: number, conversation: any) => {
      if (openConversationId && conversation.conversationId === openConversationId) return sum;
      return sum + Number(conversation.unreadCount || 0);
    }, 0) ?? counts.unreadMessages;
  const hasUnreadMessages = unreadMessagesExcludingOpenConversation > 0;

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMenuVisible(true);
  };

  const closeMenu = () => setMenuVisible(false);

  const handleMenuItemPress = (onPress: () => void) => {
    closeMenu();
    setTimeout(onPress, 100);
  };

  const toTestId = (label: string) =>
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  // Navigate to the shared profile screen - this is presented as a card/modal
  // so it doesn't switch the bottom tab navigation
  const navigateToProfile = () => {
    router.push(`${roleBase}/profile` as any);
  };

  // Navigate to settings - for trainers use their settings, others use profile
  const navigateToSettings = () => {
    if (isTrainer) {
      router.push("/(trainer)/settings" as any);
    } else {
      router.push(`${roleBase}/profile` as any);
    }
  };

  const isUserAuthenticated = isAuthenticated || Boolean(effectiveUser);
  const rawAvatarUrl = latestProfile?.photoUrl || effectiveUser?.photoUrl || user?.photoUrl || undefined;
  const avatarVersion = latestProfile?.updatedAt || effectiveUser?.updatedAt || user?.updatedAt || "";
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const isDark = colorScheme === "dark";
  const shadowColor = isDark ? "#000" : colors.border;
  const fabBackgroundColor = isDark ? "rgba(21, 21, 32, 0.96)" : colors.surface;
  const fabBorderColor = isDark ? "rgba(96, 165, 250, 0.55)" : colors.border;
  const fabShadowOpacity = isDark ? 0.4 : 0.12;

  const avatarUrl = useMemo(() => {
    if (!rawAvatarUrl) return undefined;
    const absoluteUrl = /^https?:\/\//i.test(rawAvatarUrl)
      ? rawAvatarUrl
      : (() => {
          const baseUrl = getApiBaseUrl();
          if (!baseUrl) return undefined;
          return `${baseUrl}${rawAvatarUrl.startsWith("/") ? "" : "/"}${rawAvatarUrl}`;
        })();
    if (!absoluteUrl) return undefined;
    if (!avatarVersion) return absoluteUrl;
    const separator = absoluteUrl.includes("?") ? "&" : "?";
    return `${absoluteUrl}${separator}v=${encodeURIComponent(String(avatarVersion))}`;
  }, [avatarVersion, rawAvatarUrl]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [avatarUrl]);

  if (
    isOnProfileScreen ||
    isOnMessageThread ||
    isOnBundleDetail ||
    pathname === "/welcome"
  ) {
    return null;
  }

  const menuItems: MenuItem[] = isUserAuthenticated
    ? [
      {
        icon: "person.fill",
        label: "My Profile",
        onPress: navigateToProfile,
      },
      {
        icon: "message.fill",
        label: "Messages",
        onPress: () => router.push(`${roleBase}/messages` as any),
        showDot: hasUnreadMessages,
      },
      {
        icon: "rectangle.portrait.and.arrow.right",
        label: "Logout",
        onPress: async () => {
          await logout();
        },
        destructive: true,
      },
    ]
    : [
      {
        icon: "person.fill",
        label: "Sign In",
        onPress: () => router.push("/login"),
      },
      {
        icon: "person.badge.plus",
        label: "Create Account",
        onPress: () => router.push("/register"),
      },
    ];

  // Get user initials for avatar fallback
  const getInitials = () => {
    const displayName = latestProfile?.name || effectiveUser?.name || user?.name;
    if (!displayName) return "?";
    const parts = displayName.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  return (
    <>
      {showFloatingAlerts ? (
        <TouchableOpacity
          onPress={() => router.push("/(trainer)/alerts" as any)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Open alerts"
          testID="alerts-fab"
          style={[
            styles.alertFab,
            {
              top: insets.top + 10,
              right: alertFabRightOffset,
              backgroundColor: fabBackgroundColor,
              borderColor: fabBorderColor,
              shadowColor,
              shadowOpacity: fabShadowOpacity,
            },
          ]}
        >
          <View className="relative w-5 h-5 items-center justify-center">
            <IconSymbol name="bell.fill" size={16} color={colors.primary} />
            {alertBadgeCount > 0 ? (
              <View
                className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full px-1 items-center justify-center"
                style={{ backgroundColor: "#EF4444" }}
              >
                <Text className="text-[10px] font-bold text-white">
                  {alertBadgeCount > 99 ? "99+" : alertBadgeCount}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      ) : null}

      {/* FAB Button */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Open profile menu"
        testID="profile-fab"
        style={[
          styles.fab,
          {
            top: insets.top + 8,
            right: profileFabRightOffset,
            backgroundColor: fabBackgroundColor,
            borderColor: fabBorderColor,
            shadowColor,
            shadowOpacity: fabShadowOpacity,
          },
        ]}
      >
        {/* Keep a visible ring in dark mode so this doesn't disappear against dark backgrounds. */}
        <View pointerEvents="none" style={[styles.fabRing, { borderColor: fabBorderColor }]} />
        {isUserAuthenticated && avatarUrl && !avatarLoadFailed ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
            transition={100}
            onError={() => setAvatarLoadFailed(true)}
          />
        ) : isUserAuthenticated ? (
          <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarInitials, { color: colors.background }]}>{getInitials()}</Text>
          </View>
        ) : (
          <IconSymbol name="person.circle.fill" size={30} color={colors.foreground} />
        )}
        {hasUnreadMessages ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: "#EF4444",
              borderWidth: 1,
              borderColor: fabBackgroundColor,
            }}
          />
        ) : null}
      </TouchableOpacity>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }} onPress={closeMenu}>
          <View
            style={[
              styles.menu,
              {
                top: insets.top + 56,
                right: profileFabRightOffset,
                backgroundColor: isDark ? "#1E1E2E" : "#FFFFFF",
                borderColor: colors.border,
                shadowColor,
              },
            ]}
          >
            {/* User Info Header (if authenticated) */}
            {isUserAuthenticated && (effectiveUser || user) && (
              <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.userName, { color: colors.foreground }]}>
                  {effectiveUser?.name || user?.name || effectiveUser?.email || user?.email}
                </Text>
                <Text style={[styles.userRole, { color: colors.muted }]}>
                  {effectiveUser?.role
                    ? effectiveUser.role.charAt(0).toUpperCase() + effectiveUser.role.slice(1)
                    : user?.role
                      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                      : "User"}
                </Text>
              </View>
            )}

            {/* Menu Items */}
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => handleMenuItemPress(item.onPress)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                testID={`menu-${toTestId(item.label)}`}
              >
                <IconSymbol
                  name={item.icon}
                  size={20}
                  color={item.destructive ? colors.error : colors.foreground}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    { color: item.destructive ? colors.error : colors.foreground },
                  ]}
                >
                  {item.label}
                </Text>
                {item.showDot ? (
                  <View
                    pointerEvents="none"
                    style={{
                      marginLeft: "auto",
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: "#EF4444",
                    }}
                  />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  alertFab: {
    position: "absolute",
    zIndex: 999,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  fabRing: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 22,
    opacity: 0.9,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  menu: {
    position: "absolute",
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
  },
  userRole: {
    fontSize: 13,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    marginLeft: 12,
  },
});
