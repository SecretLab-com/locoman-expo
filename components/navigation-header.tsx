import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { cn } from "@/lib/utils";
import { router, usePathname } from "expo-router";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
    testID?: string;
  };
  backTestID?: string;
  homeTestID?: string;
  /** Subtitle text below title */
  subtitle?: string;
  /** Whether the header is transparent (for overlaying content) */
  transparent?: boolean;
  /** Use SafeArea top inset (default: true) */
  useSafeAreaTop?: boolean;
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
  backTestID,
  homeTestID,
  subtitle,
  transparent = false,
  useSafeAreaTop = true,
}: NavigationHeaderProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const iconColor = colorScheme === "dark" ? "#F8FAFC" : colors.primary;

  const handleBack = () => {
    // Fire haptics without awaiting (don't block navigation)
    haptics.light();
    
    const doBack = () => {
      if (onBack) {
        onBack();
        return;
      }
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace(getDefaultHomePath(pathname) as any);
    };
    
    if (confirmBack) {
      // Use window.confirm on web since Alert.alert doesn't work properly
      if (Platform.OS === "web") {
        const confirmed = window.confirm(`${confirmBack.title}\n\n${confirmBack.message}`);
        if (confirmed) {
          doBack();
        }
      } else {
        Alert.alert(
          confirmBack.title,
          confirmBack.message,
          [
            { text: confirmBack.cancelText || "Cancel", style: "cancel" },
            {
              text: confirmBack.confirmText || "Discard",
              style: "destructive",
              onPress: doBack,
            },
          ]
        );
      }
    } else {
      doBack();
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
      className={cn(
        transparent
          ? "bg-transparent border-b-0"
          : colorScheme === "dark"
            ? "bg-background border-b border-border"
            : "bg-surface border-b border-border",
      )}
      style={[
        styles.container,
        {
          paddingTop:
            Platform.OS === "web"
              ? 6
              : useSafeAreaTop
                ? Math.max(insets.top, 6)
                : 6,
        },
      ]}
    >
      <View style={styles.content}>
        {/* Left side - Back button */}
        <View style={styles.leftSection}>
          {showBack && (
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID={backTestID || "nav-back"}
            >
              <IconSymbol name="chevron.left" size={20} color={iconColor} />
            </Pressable>
          )}
        </View>

        {/* Center - Title */}
        <View style={styles.centerSection}>
          <Text className="text-foreground" style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text className="text-muted" style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right side - Home button or custom action */}
        <View style={styles.rightSection}>
          {showHome && (
            <Pressable
              onPress={handleHome}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Go to home"
              testID={homeTestID || "nav-home"}
            >
              <IconSymbol name="house.fill" size={18} color={iconColor} />
            </Pressable>
          )}
          {rightAction && (
            <Pressable
              onPress={rightAction.onPress}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && { opacity: 0.6 },
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={rightAction.label || "Action"}
              testID={rightAction.testID || "nav-action"}
            >
              <IconSymbol name={rightAction.icon} size={18} color={iconColor} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Determine the default home path based on current pathname
 * Routes to the unified bottom tab interface
 */
function getDefaultHomePath(_pathname: string): string {
  return "/(tabs)";
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
  },
  leftSection: {
    width: 36,
    alignItems: "flex-start",
  },
  centerSection: {
    flex: 1,
    alignItems: "center",
  },
  rightSection: {
    width: 36,
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  iconButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
