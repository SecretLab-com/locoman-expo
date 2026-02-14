import { Stack } from "expo-router";
import TrainerHomeScreen from "./index";

export default function TrainerDashboardRoute() {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <TrainerHomeScreen />
    </>
  );
}
