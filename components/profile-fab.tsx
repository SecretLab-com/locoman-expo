import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, usePathname } from "expo-router";
import { useState } from "react";
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
};

export function ProfileFAB() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { user, effectiveUser, isAuthenticated, logout, isTrainer, effectiveRole } = useAuthContext();
  const [menuVisible, setMenuVisible] = useState(false);
  const pathname = usePathname();

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
  const isOnMessageThread = pathname.includes("/messages/") || pathname.includes("/conversation/");
  if (isOnProfileScreen || isOnMessageThread || pathname === "/welcome") {
    return null;
  }

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
  const avatarUrl = effectiveUser?.photoUrl || user?.photoUrl || undefined;
  const isDark = colorScheme === "dark";
  const overlayColor = isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(15, 23, 42, 0.12)";
  const shadowColor = isDark ? "#000" : colors.border;

  const menuItems: MenuItem[] = isUserAuthenticated
    ? [
      {
        icon: "person.fill",
        label: "My Profile",
        onPress: navigateToProfile,
      },
      {
        icon: "gear",
        label: "Settings",
        onPress: navigateToSettings,
      },
      {
        icon: "message.fill",
        label: "Messages",
        onPress: () => router.push(`${roleBase}/messages` as any),
      },
      {
        icon: "rectangle.portrait.and.arrow.right",
        label: "Logout",
        onPress: async () => {
          await logout();
          router.replace("/(tabs)");
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
    const displayName = effectiveUser?.name || user?.name;
    if (!displayName) return "?";
    const parts = displayName.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  return (
    <>
      {/* FAB Button */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Profile menu"
        testID="profile-fab"
        style={[
          styles.fab,
          {
            top: insets.top + 8,
            right: 16,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            shadowColor,
          },
        ]}
      >
        {isUserAuthenticated && avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
          />
        ) : isUserAuthenticated ? (
          <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarInitials, { color: colors.background }]}>{getInitials()}</Text>
          </View>
        ) : (
          <IconSymbol name="person.circle.fill" size={32} color={colors.muted} />
        )}
      </TouchableOpacity>

      {/* Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={[styles.overlay, { backgroundColor: overlayColor }]} onPress={closeMenu}>
          <View
            style={[
              styles.menu,
              {
                top: insets.top + 56,
                right: 16,
                backgroundColor: colors.surface,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
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
