import { Platform } from "react-native";
import { router } from "expo-router";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

/**
 * Configuration for swipe-back gesture behavior
 */
export interface SwipeBackConfig {
  /** Whether the gesture is enabled (default: true) */
  enabled?: boolean;
  /** Minimum swipe distance to trigger navigation (default: 50) */
  minDistance?: number;
  /** Minimum velocity to trigger navigation (default: 500) */
  minVelocity?: number;
  /** Width of the edge detection zone in pixels (default: 20) */
  edgeWidth?: number;
  /** Custom callback when swipe-back is triggered */
  onSwipeBack?: () => void;
}

/**
 * Default configuration for swipe-back gesture
 */
export const DEFAULT_SWIPE_CONFIG: Required<SwipeBackConfig> = {
  enabled: true,
  minDistance: 50,
  minVelocity: 500,
  edgeWidth: 20,
  onSwipeBack: () => router.back(),
};

/**
 * Creates a pan gesture for swipe-back navigation
 * 
 * Usage:
 * ```tsx
 * import { useSwipeBackGesture } from "@/hooks/use-swipe-back";
 * import { GestureDetector } from "react-native-gesture-handler";
 * 
 * function MyScreen() {
 *   const swipeGesture = useSwipeBackGesture();
 *   
 *   return (
 *     <GestureDetector gesture={swipeGesture}>
 *       <View style={{ flex: 1 }}>
 *         {content}
 *       </View>
 *     </GestureDetector>
 *   );
 * }
 * ```
 */
export function useSwipeBackGesture(config: SwipeBackConfig = {}) {
  const {
    enabled,
    minDistance,
    minVelocity,
    edgeWidth,
    onSwipeBack,
  } = { ...DEFAULT_SWIPE_CONFIG, ...config };

  const handleSwipeBack = () => {
    onSwipeBack();
  };

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(minDistance)
    .failOffsetY([-20, 20])
    .onEnd((event) => {
      // Only trigger if swiping from left edge with sufficient velocity
      if (
        event.translationX > minDistance &&
        event.velocityX > minVelocity
      ) {
        runOnJS(handleSwipeBack)();
      }
    });

  return gesture;
}

/**
 * Screen options for enabling swipe-back gesture in Stack navigator
 * Use these options in your Stack.Screen or screenOptions
 */
export const swipeBackScreenOptions = {
  // Enable gesture-based navigation
  gestureEnabled: true,
  // iOS: Enable full-screen swipe (not just from edge)
  fullScreenGestureEnabled: true,
  // Slide animation for natural feel
  animation: "slide_from_right" as const,
  // Horizontal gesture direction
  gestureDirection: "horizontal" as const,
};

/**
 * Screen options for disabling swipe-back gesture
 * Use for screens that shouldn't allow back navigation (e.g., confirmation screens)
 */
export const noSwipeBackScreenOptions = {
  gestureEnabled: false,
};

/**
 * Check if swipe-back gesture should be enabled based on platform
 * iOS has native support, Android needs custom implementation
 */
export function shouldEnableSwipeBack(): boolean {
  // iOS has native swipe-back support via React Navigation
  // Android also supports it but may need additional configuration
  return Platform.OS === "ios" || Platform.OS === "android";
}
