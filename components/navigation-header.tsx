import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";

type NavigationHeaderProps = {
  title: string;
  /** Show back button (default: true) */
  showBack?: boolean;
  /** Show home button for deep navigation (default: false) */
  showHome?: boolean;
  /** Custom back handler - if not provided, uses router.back() */
  onBack?: () => void;
  /** Home destination path (default: based on user role) */
  homePath?: string;
  /** Confirm before going back (for unsaved changes) */
  confirmBack?: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  };
  /** Right side action button */
  rightAction?: {
    icon: Parameters<typeof IconSymbol>[0]["name"];
    onPress: () => void;
    label?: string;
  };
  /** Subtitle text below title */
  subtitle?: string;
  /** Whether the header is transparent (for overlaying content) */
  transparent?: boolean;
};

/**
 * Consistent navigation header with back button, optional home button,
 * and support for confirmation dialogs on back navigation.
 * 
 * Usage:
 * ```tsx
 * <NavigationHeader 
 *   title="Bundle Editor" 
 *   showHome 
 *   confirmBack={{
 *     title: "Discard Changes?",
 *     message: "You have unsaved changes. Are you sure you want to leave?"
 *   }}
 * />
 * ```
 */
export function NavigationHeader({
  title,
  showBack = true,
  showHome = false,
  onBack,
  homePath,
  confirmBack,
  rightAction,
  subtitle,
  transparent = false,
}: NavigationHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const handleBack = async () => {
    await haptics.light();
    
    if (confirmBack) {
      Alert.alert(
        confirmBack.title,
        confirmBack.message,
        [
          { text: confirmBack.cancelText || "Cancel", style: "cancel" },
          {
            text: confirmBack.confirmText || "Discard",
            style: "destructive",
            onPress: () => {
              if (onBack) {
                onBack();
              } else {
                router.back();
              }
            },
          },
        ]
      );
    } else {
      if (onBack) {
        onBack();
      } else {
        router.back();
      }
    }
  };

  const handleHome = async () => {
    await haptics.light();
    
    // Determine home path based on current location or provided path
    const destination = homePath || getDefaultHomePath(pathname);
    router.replace(destination as any);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === "web" ? 16 : Math.max(insets.top, 16),
          backgroundColor: transparent ? "transparent" : colors.background,
          borderBottomColor: transparent ? "transparent" : colors.border,
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Left side - Back button */}
        <View style={styles.leftSection}>
          {showBack && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.iconButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name="chevron.left" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Center - Title */}
        <View style={styles.centerSection}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.subtitle, { color: colors.muted }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right side - Home button or custom action */}
        <View style={styles.rightSection}>
          {showHome && (
            <TouchableOpacity
              onPress={handleHome}
              style={styles.iconButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name="house.fill" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
          {rightAction && (
            <TouchableOpacity
              onPress={rightAction.onPress}
              style={styles.iconButton}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol name={rightAction.icon} size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Determine the default home path based on current pathname
 */
function getDefaultHomePath(pathname: string): string {
  if (pathname.startsWith("/(trainer)") || pathname.includes("/bundle-editor")) {
    return "/(trainer)";
  }
  if (pathname.startsWith("/(client)")) {
    return "/(client)";
  }
  if (pathname.startsWith("/(manager)")) {
    return "/(manager)";
  }
  if (pathname.startsWith("/(coordinator)")) {
    return "/(coordinator)";
  }
  // Default to shopper tabs
  return "/(tabs)";
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  leftSection: {
    width: 44,
    alignItems: "flex-start",
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
  },
  rightSection: {
    width: 44,
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
