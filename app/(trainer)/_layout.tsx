import { Stack } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { Platform } from "react-native";

/**
 * Trainer Stack Layout
 * 
 * All trainer screens are now accessible via Stack navigation from the unified tabs.
 * The bottom tab bar remains stable - these screens appear as cards/modals on top.
 * 
 * Animation presets:
 * - slide_from_right: Standard horizontal slide for detail screens
 * - slide_from_bottom: Modal-style presentation for forms/editors
 * - fade: Subtle fade for quick transitions
 */
export default function TrainerStackLayout() {
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
        name="bundles" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="calendar" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="clients" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="deliveries" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="earnings" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="orders" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="invite"
        options={{
          animation: "slide_from_bottom",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="join-requests"
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="partnerships" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen 
        name="points" 
        options={{ animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="settings"
        options={{ animation: "slide_from_right" }}
      />
    </Stack>
  );
}
