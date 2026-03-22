import { AppText } from "@/components/ui/app-text";
import { FAB } from "@/components/ui/fab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ModalSurface } from "@/components/ui/modal-surface";
import { useAuthContext } from "@/contexts/auth-context";
import { useBadgeContext } from "@/contexts/badge-context";
import { useCart } from "@/contexts/cart-context";
import { useColors } from "@/hooks/use-colors";
import { useDesignSystem } from "@/hooks/use-design-system";
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
  const ds = useDesignSystem();
  const insets = useSafeAreaInsets();
  const { user, effectiveUser, isAuthenticated, logout, effectiveRole } = useAuthContext();
  const { proposalContext } = useCart();
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
  /** Trainer Clients: add-client FAB (44px) + gap — sit profile FAB to the left of it. */
  const pathSegments = pathname.split("/").filter(Boolean);
  const lastPathSegment = pathSegments[pathSegments.length - 1] ?? "";
  const isOnTrainerClientsScreen =
    effectiveRole === "trainer" &&
    lastPathSegment === "clients" &&
    !pathname.includes("client-detail");
  const trainerClientsAddFabWidth = 44;
  const trainerClientsAddFabGap = 12;
  const trainerClientsHeaderReserve = trainerClientsAddFabWidth + trainerClientsAddFabGap;
  const profileFabRightOffset = isOnTrainerClientsScreen ? 16 + trainerClientsHeaderReserve : 16;
  /** Sit left of the profile FAB (44px) with comfortable gap so the two don’t overlap. */
  const alertFabRightOffset = 16 + 44 + 12;
  const isOnMessageThread = pathname.includes("/messages/") || pathname.includes("/conversation/");
  const isOnBundleDetail = pathname.includes("/bundle/");
  const isOnClientDetail = pathname.includes("client-detail");
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

  const isUserAuthenticated = isAuthenticated || Boolean(effectiveUser);
  const rawAvatarUrl = latestProfile?.photoUrl || effectiveUser?.photoUrl || user?.photoUrl || undefined;
  const avatarVersion = latestProfile?.updatedAt || effectiveUser?.updatedAt || user?.updatedAt || "";
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const fabBackgroundColor = ds.colors.surface.overlay;
  const fabBorderColor = ds.colors.border.strong;

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

  /**
   * Don’t cover plan-flow top chrome (cart / catalog / plan-shop) when a client proposal is active.
   * Only hide on those routes — not on trainer home, or a stale `proposalContext` in storage would remove the FAB everywhere.
   */
  const isTrainerPlanFlowTopChromeRoute =
    pathname.includes("plan-shop") ||
    pathname.includes("/cart") ||
    pathname.includes("/products");
  const hideFabForTrainerPlanFlowChrome =
    effectiveRole === "trainer" &&
    Boolean(proposalContext?.clientRecordId) &&
    isTrainerPlanFlowTopChromeRoute;

  if (
    isOnProfileScreen ||
    isOnMessageThread ||
    isOnBundleDetail ||
    isOnClientDetail ||
    pathname === "/welcome" ||
    hideFabForTrainerPlanFlowChrome
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
        <FAB
          icon="bell.fill"
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
              width: 40,
              height: 40,
              borderRadius: 20,
            },
          ]}
        >
          <View className="relative w-5 h-5 items-center justify-center">
            <IconSymbol name="bell.fill" size={16} color={colors.primary} />
            {alertBadgeCount > 0 ? (
              <View
                className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] rounded-full px-1 items-center justify-center"
                style={{ backgroundColor: ds.colors.status.error }}
              >
                <AppText variant="caption2" tone="inverse" weight="bold">
                  {alertBadgeCount > 99 ? "99+" : alertBadgeCount}
                </AppText>
              </View>
            ) : null}
          </View>
        </FAB>
      ) : null}

      {/* FAB Button */}
      <FAB
        icon="person.circle.fill"
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
            <AppText variant="bodySm" weight="semibold" style={{ color: colors.background }}>
              {getInitials()}
            </AppText>
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
              backgroundColor: ds.colors.status.error,
              borderWidth: 1,
              borderColor: fabBackgroundColor,
            }}
          />
        ) : null}
      </FAB>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={{ flex: 1, backgroundColor: ds.colors.overlay.scrim }} onPress={closeMenu}>
          <ModalSurface
            style={[
              styles.menu,
              {
                top: insets.top + 56,
                right: profileFabRightOffset,
                backgroundColor: ds.colors.surface.elevated,
                borderColor: ds.colors.border.default,
                ...ds.elevation.lg,
              },
            ]}
          >
            {/* User Info Header (if authenticated) */}
            {isUserAuthenticated && (effectiveUser || user) && (
              <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
                <AppText variant="body" weight="semibold">
                  {effectiveUser?.name || user?.name || effectiveUser?.email || user?.email}
                </AppText>
                <AppText variant="label" tone="secondary" style={{ marginTop: 2 }}>
                  {effectiveUser?.role
                    ? effectiveUser.role.charAt(0).toUpperCase() + effectiveUser.role.slice(1)
                    : user?.role
                      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                      : "User"}
                </AppText>
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
                <AppText
                  variant="bodySm"
                  tone={item.destructive ? "error" : "default"}
                  style={styles.menuItemText}
                >
                  {item.label}
                </AppText>
                {item.showDot ? (
                  <View
                    pointerEvents="none"
                    style={{
                      marginLeft: "auto",
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: ds.colors.status.error,
                    }}
                  />
                ) : null}
              </TouchableOpacity>
            ))}
          </ModalSurface>
        </Pressable>
      </Modal>
    </>
  );
}

/** Above `CollapsibleHeaderScrollView` shell (zIndex 1010) so profile/alerts stay tappable on trainer home. */
const FAB_Z_PROFILE = 1020;
const FAB_Z_ALERTS = 1019;
/** Android: above collapsible header `elevation: 12` without using extreme values (shadow cost). */
const FAB_ELEVATION = 16;

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    zIndex: FAB_Z_PROFILE,
    elevation: FAB_ELEVATION,
  },
  alertFab: {
    position: "absolute",
    zIndex: FAB_Z_ALERTS,
    elevation: FAB_ELEVATION,
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
  menu: {
    position: "absolute",
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingHorizontal: 16,
  },
  menuItemText: {
    marginLeft: 12,
  },
});
