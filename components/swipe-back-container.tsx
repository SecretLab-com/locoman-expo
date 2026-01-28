import { ReactNode } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { router } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

interface SwipeBackContainerProps {
  children: ReactNode;
  /** Whether swipe-back is enabled (default: true) */
  enabled?: boolean;
  /** Custom callback when swipe-back is triggered */
  onSwipeBack?: () => void;
  /** Minimum swipe distance to trigger navigation (default: 100) */
  threshold?: number;
  /** Whether to show the swipe indicator on the left edge (default: true) */
  showIndicator?: boolean;
}

/**
 * A container component that adds swipe-back gesture support to any screen.
 * Provides visual feedback during the swipe and triggers navigation on completion.
 * 
 * This is useful for screens that need custom swipe-back behavior or
 * for adding swipe-back to web where it's not natively supported.
 * 
 * Usage:
 * ```tsx
 * <SwipeBackContainer>
 *   <ScreenContainer>
 *     {content}
 *   </ScreenContainer>
 * </SwipeBackContainer>
 * ```
 */
export function SwipeBackContainer({
  children,
  enabled = true,
  onSwipeBack,
  threshold = 100,
  showIndicator = true,
}: SwipeBackContainerProps) {
  const colors = useColors();
  const translateX = useSharedValue(0);
  const isActive = useSharedValue(false);

  const triggerHaptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSwipeBack = () => {
    triggerHaptic();
    if (onSwipeBack) {
      onSwipeBack();
    } else {
      router.back();
    }
  };

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([10, 10]) // Only activate for horizontal swipes
    .failOffsetY([-30, 30]) // Fail if vertical movement is too large
    .onStart((event) => {
      // Only start if swiping from left edge (within 30px)
      if (event.x < 30) {
        isActive.value = true;
      }
    })
    .onUpdate((event) => {
      if (isActive.value && event.translationX > 0) {
        // Limit the translation with resistance
        translateX.value = Math.min(event.translationX * 0.8, 200);
      }
    })
    .onEnd((event) => {
      if (isActive.value) {
        if (event.translationX > threshold && event.velocityX > 300) {
          // Swipe completed - trigger navigation
          runOnJS(handleSwipeBack)();
        }
        // Reset position
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 200,
        });
      }
      isActive.value = false;
    })
    .onFinalize(() => {
      isActive.value = false;
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 200,
      });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, 50, threshold],
      [0, 0.5, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale: interpolate(
          translateX.value,
          [0, threshold],
          [0.8, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // On iOS/Android, the native gesture is already enabled via Stack screenOptions
  // This component is primarily for web or custom behavior
  if (Platform.OS !== "web" && !onSwipeBack) {
    // On native, just render children without extra gesture handling
    // since React Navigation already handles swipe-back
    return <>{children}</>;
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {/* Swipe indicator on left edge */}
        {showIndicator && (
          <Animated.View
            style={[
              styles.indicator,
              { backgroundColor: colors.primary },
              indicatorStyle,
            ]}
          />
        )}
        
        {/* Content with animated translation */}
        <Animated.View style={[styles.content, animatedStyle]}>
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  indicator: {
    position: "absolute",
    left: 0,
    top: "50%",
    marginTop: -20,
    width: 4,
    height: 40,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    zIndex: 100,
  },
});
