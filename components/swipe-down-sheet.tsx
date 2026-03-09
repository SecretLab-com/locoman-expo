import { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, type StyleProp, View, type ViewStyle } from "react-native";

type SwipeDownSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  dismissThreshold?: number;
  testID?: string;
};

export function SwipeDownSheet({
  visible,
  onClose,
  children,
  className = "bg-background rounded-t-3xl",
  style,
  dismissThreshold = 110,
  testID = "swipe-down-sheet-handle",
}: SwipeDownSheetProps) {
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          translateY.setValue(Math.max(0, gestureState.dy));
        },
        onPanResponderRelease: (_, gestureState) => {
          const shouldDismiss = gestureState.dy > dismissThreshold || gestureState.vy > 1.05;
          if (shouldDismiss) {
            Animated.timing(translateY, {
              toValue: 420,
              duration: 180,
              useNativeDriver: true,
            }).start(() => {
              translateY.setValue(0);
              onClose();
            });
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 5,
          }).start();
        },
      }),
    [dismissThreshold, onClose, translateY],
  );

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(0);
  }, [visible, translateY]);

  return (
    <Animated.View
      className={className}
      style={[{ transform: [{ translateY }] }, style]}
      onStartShouldSetResponder={() => true}
    >
      <View
        {...panResponder.panHandlers}
        className="items-center py-2"
        accessibilityRole="button"
        accessibilityLabel="Swipe down to dismiss"
        testID={testID}
      >
        <View
          className="w-10 h-1 rounded-full"
          style={{ backgroundColor: "rgba(148,163,184,0.55)" }}
        />
      </View>
      {children}
    </Animated.View>
  );
}
