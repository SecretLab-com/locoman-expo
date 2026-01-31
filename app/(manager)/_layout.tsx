import { Stack } from "expo-router";
import { useColors } from "@/hooks/use-colors";

/**
 * Manager Stack Layout
 * 
 * All manager screens are now accessible via Stack navigation from the unified tabs.
 * The bottom tab bar remains stable - these screens appear as cards/modals on top.
 */
export default function ManagerStackLayout() {
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
      <Stack.Screen name="approvals" />
      <Stack.Screen name="users" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="trainers" />
      <Stack.Screen name="templates" />
      <Stack.Screen name="invitations" />
      <Stack.Screen name="deliveries" />
      <Stack.Screen name="products" />
    </Stack>
  );
}
