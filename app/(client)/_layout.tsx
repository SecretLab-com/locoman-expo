import { Stack } from "expo-router";
import { useColors } from "@/hooks/use-colors";

/**
 * Client Stack Layout
 * 
 * All client screens are now accessible via Stack navigation from the unified tabs.
 * The bottom tab bar remains stable - these screens appear as cards/modals on top.
 */
export default function ClientStackLayout() {
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
      <Stack.Screen name="subscriptions" />
      <Stack.Screen name="deliveries" />
      <Stack.Screen name="spending" />
      <Stack.Screen name="orders" />
    </Stack>
  );
}
