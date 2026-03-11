import { useAuthContext } from "@/contexts/auth-context";
import { AppText } from "@/components/ui/app-text";
import { withAlpha } from "@/design-system/color-utils";
import { useDesignSystem } from "@/hooks/use-design-system";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { navigateToHome } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { usePathname } from "expo-router";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Floating banner shown when a coordinator is impersonating another user.
 * Does not consume vertical space — floats over content.
 */
export function ImpersonationBanner() {
  const colors = useColors();
  const ds = useDesignSystem();
  const insets = useSafeAreaInsets();
  const { isImpersonating, impersonatedUser, stopImpersonation, user } = useAuthContext();
  const pathname = usePathname();
  const logAction = trpc.admin.logUserAction.useMutation();

  if (!isImpersonating || !impersonatedUser || pathname === "/welcome") {
    return null;
  }

  const handleEndImpersonation = async () => {
    await haptics.medium();
    // Log the end of impersonation
    try {
      await logAction.mutateAsync({
        targetUserId: impersonatedUser.id,
        action: "impersonation_ended",
        notes: `Impersonation ended by ${user?.name || "coordinator"}`,
      });
    } catch {
      // Don't block end of impersonation if logging fails
    }
    stopImpersonation();
    navigateToHome({ isCoordinator: true });
  };

  const topOffset = Platform.OS === "web" ? 4 : Math.max(insets.top, 4);

  return (
    <View
      style={[styles.container, { top: topOffset }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: withAlpha(colors.warning, 0.9),
            ...ds.elevation.sm,
          },
        ]}
      >
        <AppText variant="label" tone="inverse" weight="medium">
          Impersonating{" "}
          <AppText variant="label" tone="inverse" weight="bold">
            {impersonatedUser.name || impersonatedUser.email || "Unknown"}
          </AppText>
        </AppText>
        <TouchableOpacity
          onPress={handleEndImpersonation}
          style={[styles.button, { backgroundColor: withAlpha(colors["foreground-inverse"], 0.25) }]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="End impersonation session"
          testID="end-impersonation"
        >
          <AppText variant="caption" tone="inverse" weight="bold">
            End Session
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 12,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
