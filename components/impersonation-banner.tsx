import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { navigateToHome } from "@/lib/navigation";
import { usePathname } from "expo-router";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Floating banner shown when a coordinator is impersonating another user.
 * Does not consume vertical space — floats over content.
 */
export function ImpersonationBanner() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isImpersonating, impersonatedUser, stopImpersonation } = useAuthContext();
  const pathname = usePathname();

  if (!isImpersonating || !impersonatedUser || pathname === "/welcome") {
    return null;
  }

  const handleEndImpersonation = async () => {
    await haptics.medium();
    stopImpersonation();
    navigateToHome({ isCoordinator: true });
  };

  const topOffset = Platform.OS === "web" ? 4 : Math.max(insets.top, 4);

  return (
    <View
      style={[styles.container, { top: topOffset }]}
      pointerEvents="box-none"
    >
      <View style={styles.pill}>
        <Text style={styles.label}>
          Impersonating{" "}
          <Text style={styles.name}>
            {impersonatedUser.name || impersonatedUser.email || "Unknown"}
          </Text>
        </Text>
        <TouchableOpacity
          onPress={handleEndImpersonation}
          style={styles.button}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="End impersonation session"
          testID="end-impersonation"
        >
          <Text style={styles.buttonText}>End Session</Text>
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
    backgroundColor: "rgba(234, 179, 8, 0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  label: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
  name: {
    fontWeight: "700",
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
