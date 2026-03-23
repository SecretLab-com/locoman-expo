import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type {
  CartAnimationRect,
  CartFlyOverlayItem,
} from "../contexts/cart-animation-context";

type CartFlyOverlayProps = {
  flights: CartFlyOverlayItem[];
  onFlightComplete: (flightId: string) => void;
};

function getRectCenter(rect: CartAnimationRect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function CartFlyChip({
  flight,
  onFlightComplete,
}: {
  flight: CartFlyOverlayItem;
  onFlightComplete: (flightId: string) => void;
}) {
  const colors = useColors();
  const progress = useSharedValue(0);

  const start = getRectCenter(flight.startRect);
  const end = getRectCenter(flight.targetRect);
  const chipSize = Math.max(
    28,
    Math.min(56, Math.max(flight.startRect.width, flight.startRect.height)),
  );
  const controlPoint = {
    x: start.x + (end.x - start.x) * 0.45,
    y: Math.min(start.y, end.y) - 110,
  };

  useEffect(() => {
    progress.value = withTiming(
      1,
      {
        duration: 520,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(onFlightComplete)(flight.id);
        }
      },
    );
  }, [flight.id, onFlightComplete, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const inv = 1 - t;
    const x =
      inv * inv * start.x +
      2 * inv * t * controlPoint.x +
      t * t * end.x;
    const y =
      inv * inv * start.y +
      2 * inv * t * controlPoint.y +
      t * t * end.y;

    return {
      opacity: interpolate(t, [0, 0.88, 1], [1, 1, 0]),
      transform: [
        { translateX: x - chipSize / 2 },
        { translateY: y - chipSize / 2 },
        { scale: interpolate(t, [0, 0.65, 1], [1, 0.95, 0.34]) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.chip,
        animatedStyle,
        {
          width: chipSize,
          height: chipSize,
          borderRadius: chipSize / 2,
          backgroundColor: flight.imageUri ? colors.surface : colors.primary,
          borderColor: flight.imageUri ? colors.border : colors.primary,
        },
      ]}
    >
      {flight.imageUri ? (
        <Image
          source={{ uri: flight.imageUri }}
          style={{ width: chipSize, height: chipSize, borderRadius: chipSize / 2 }}
          contentFit="cover"
        />
      ) : (
        <View style={styles.iconWrap}>
          <IconSymbol name="cart.fill" size={18} color={colors["primary-foreground"]} />
        </View>
      )}
    </Animated.View>
  );
}

export function CartFlyOverlay({
  flights,
  onFlightComplete,
}: CartFlyOverlayProps) {
  if (flights.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      {flights.map((flight) => (
        <CartFlyChip
          key={flight.id}
          flight={flight}
          onFlightComplete={onFlightComplete}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6000,
    pointerEvents: "none",
  },
  chip: {
    position: "absolute",
    overflow: "hidden",
    borderWidth: 1,
  },
  iconWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
