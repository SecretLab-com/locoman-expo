import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import { router, usePathname } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type MenuItem = {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

export function ProfileFAB() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated, logout, isTrainer, isClient, isManager, isCoordinator } = useAuthContext();
  const [menuVisible, setMenuVisible] = useState(false);
  const pathname = usePathname();

  // Hide FAB on profile screen since it's redundant there
  const isOnProfileScreen = pathname === "/profile" || pathname.startsWith("/profile/");
  if (isOnProfileScreen) {
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

  // Navigate to the shared profile screen - this is presented as a card/modal
  // so it doesn't switch the bottom tab navigation
  const navigateToProfile = () => {
    router.push("/profile" as any);
  };

  // Navigate to settings - for trainers use their settings, others use profile
  const navigateToSettings = () => {
    if (isTrainer) {
      router.push("/(trainer)/settings" as any);
    } else {
      router.push("/profile" as any);
    }
  };

  const menuItems: MenuItem[] = isAuthenticated
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
          onPress: () => router.push("/messages" as any),
        },
        {
          icon: "rectangle.portrait.and.arrow.right",
          label: "Sign Out",
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
    if (!user?.name) return "?";
    const parts = user.name.split(" ");
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
        style={[
          styles.fab,
          {
            top: insets.top + 8,
            right: 16,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {isAuthenticated && user?.photoUrl ? (
          <Image
            source={{ uri: user.photoUrl }}
            style={styles.avatar}
          />
        ) : isAuthenticated ? (
          <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarInitials}>{getInitials()}</Text>
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
        <Pressable style={styles.overlay} onPress={closeMenu}>
          <View
            style={[
              styles.menu,
              {
                top: insets.top + 56,
                right: 16,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {/* User Info Header (if authenticated) */}
            {isAuthenticated && user && (
              <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.userName, { color: colors.foreground }]}>
                  {user.name || user.email}
                </Text>
                <Text style={[styles.userRole, { color: colors.muted }]}>
                  {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
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
