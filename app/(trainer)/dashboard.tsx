import { Stack } from "expo-router";
import TrainerHomeScreen from "./index";

export default function TrainerDashboardRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <TrainerHomeScreen />
    </>
  );
}
