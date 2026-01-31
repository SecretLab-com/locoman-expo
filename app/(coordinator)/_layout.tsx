import { Stack } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

/**
 * Coordinator Stack Layout
 * 
 * All coordinator screens are now accessible via Stack navigation from the unified tabs.
 * The bottom tab bar remains stable - these screens appear as cards/modals on top.
 * 
 * Animation presets:
 * - slide_from_right: Standard horizontal slide for detail screens
 * - slide_from_bottom: Modal-style presentation for forms/editors
 * - fade: Subtle fade for quick transitions
 */
export default function CoordinatorStackLayout() {
  const colors = useColors();

  // Platform-specific animation configuration
  const defaultAnimation = Platform.OS === "ios" ? "default" : "slide_from_right";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animation: defaultAnimation,
        gestureDirection: "horizontal",
        contentStyle: { backgroundColor: colors.background },
        animationDuration: 250,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="home" />
      <Stack.Screen 
        name="catalog" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="logs" 
        options={{ animation: "slide_from_right" }}
      />
    </Stack>
  );
}
