import { Stack } from "expo-router";
import { useColors } from "@/hooks/use-colors";

/**
 * Trainer Stack Layout
 * 
 * All trainer screens are now accessible via Stack navigation from the unified tabs.
 * The bottom tab bar remains stable - these screens appear as cards/modals on top.
 */
export default function TrainerStackLayout() {
  const colors = useColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animation: "slide_from_right",
        gestureDirection: "horizontal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="home" />
      <Stack.Screen name="bundles" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="clients" />
      <Stack.Screen name="deliveries" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="join-requests" />
      <Stack.Screen name="partnerships" />
      <Stack.Screen name="points" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
