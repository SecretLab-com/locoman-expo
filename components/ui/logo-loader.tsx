import { useEffect } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/use-colors";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const VIEWBOX_WIDTH = 310;
const VIEWBOX_HEIGHT = 250;
const LOGO_ASPECT_RATIO = VIEWBOX_HEIGHT / VIEWBOX_WIDTH;
const ANGLE_PATH_LENGTH = 214.67;
const LOOP_PATH_LENGTH = 436.18;
const TOTAL_PATH_LENGTH = ANGLE_PATH_LENGTH + LOOP_PATH_LENGTH;
const ANGLE_PROGRESS_END = ANGLE_PATH_LENGTH / TOTAL_PATH_LENGTH;

const LOGO_PATHS = [
  {
    key: "angle",
    d: "M110.162 117.818L18.0381 172.577L110.162 227.981",
    dashLength: ANGLE_PATH_LENGTH + 2,
    start: 0,
    end: ANGLE_PROGRESS_END,
  },
  {
    key: "loop",
    d: "M171.212 18.0383C171.212 60.1412 171.212 150.41 171.212 174.661C171.212 205.346 198.914 231.921 229.443 231.921C263.166 231.921 291.038 205.99 291.038 175.305C291.038 138.831 267.846 114.35 231.447 112.739",
    dashLength: LOOP_PATH_LENGTH + 2,
    start: ANGLE_PROGRESS_END,
    end: 1,
  },
] as const;

type LogoLoaderProps = {
  size?: number;
  color?: string;
  durationMs?: number;
  holdMs?: number;
  style?: StyleProp<ViewStyle>;
  trackOpacity?: number;
};

export function LogoLoader({
  size = 64,
  color,
  durationMs = 1000,
  holdMs = 200,
  style,
  trackOpacity = 0.14,
}: LogoLoaderProps) {
  const colors = useColors();
  const stroke = color || colors.primary;
  const progress = useSharedValue(0);
  const totalCycleMs = durationMs + holdMs;
  const drawProgressEnd = durationMs / totalCycleMs;

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: totalCycleMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [progress, totalCycleMs]);

  const angleAnimatedProps = useAnimatedProps(() => {
    const normalizedDrawProgress =
      progress.value >= drawProgressEnd ? 1 : progress.value / drawProgressEnd;
    const raw =
      (normalizedDrawProgress - LOGO_PATHS[0].start) / (LOGO_PATHS[0].end - LOGO_PATHS[0].start);
    const segmentProgress = Math.min(1, Math.max(0, raw));

    return {
      strokeDashoffset: LOGO_PATHS[0].dashLength * (1 - segmentProgress),
      opacity: segmentProgress <= 0 ? 0 : 1,
    };
  });

  const loopAnimatedProps = useAnimatedProps(() => {
    const normalizedDrawProgress =
      progress.value >= drawProgressEnd ? 1 : progress.value / drawProgressEnd;
    const raw =
      (normalizedDrawProgress - LOGO_PATHS[1].start) / (LOGO_PATHS[1].end - LOGO_PATHS[1].start);
    const segmentProgress = Math.min(1, Math.max(0, raw));

    return {
      strokeDashoffset: LOGO_PATHS[1].dashLength * (1 - segmentProgress),
      opacity: segmentProgress <= 0 ? 0 : 1,
    };
  });

  return (
    <View style={style}>
      <Svg
        width={size}
        height={size * LOGO_ASPECT_RATIO}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        fill="none"
      >
        {LOGO_PATHS.map((path) => (
          <Path
            key={`track-${path.key}`}
            d={path.d}
            stroke={stroke}
            strokeWidth={36.0766}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={trackOpacity}
          />
        ))}
        <AnimatedPath
          d={LOGO_PATHS[0].d}
          stroke={stroke}
          strokeWidth={36.0766}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${LOGO_PATHS[0].dashLength} ${LOGO_PATHS[0].dashLength}`}
          animatedProps={angleAnimatedProps}
        />
        <AnimatedPath
          d={LOGO_PATHS[1].d}
          stroke={stroke}
          strokeWidth={36.0766}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${LOGO_PATHS[1].dashLength} ${LOGO_PATHS[1].dashLength}`}
          animatedProps={loopAnimatedProps}
        />
      </Svg>
    </View>
  );
}
