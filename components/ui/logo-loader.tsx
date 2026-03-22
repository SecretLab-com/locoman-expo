import { useEffect, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";

const VIEWBOX_WIDTH = 310;
const VIEWBOX_HEIGHT = 250;
const LOGO_ASPECT_RATIO = VIEWBOX_HEIGHT / VIEWBOX_WIDTH;
const ANGLE_PATH_LENGTH = 214.67;
const LOOP_PATH_LENGTH = 436.18;
const TOTAL_PATH_LENGTH = ANGLE_PATH_LENGTH + LOOP_PATH_LENGTH;
const ANGLE_PROGRESS_END = ANGLE_PATH_LENGTH / TOTAL_PATH_LENGTH;

export const DEFAULT_LOGO_LOADER_DURATION_MS = 1000;
export const DEFAULT_LOGO_LOADER_HOLD_MS = 200;
export const DEFAULT_LOGO_LOADER_CYCLE_MS =
  DEFAULT_LOGO_LOADER_DURATION_MS + DEFAULT_LOGO_LOADER_HOLD_MS;

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
  durationMs = DEFAULT_LOGO_LOADER_DURATION_MS,
  holdMs = DEFAULT_LOGO_LOADER_HOLD_MS,
  style,
  trackOpacity = 0.14,
}: LogoLoaderProps) {
  const colors = useColors();
  const stroke = color || colors.primary;
  const [progress, setProgress] = useState(0);
  const totalCycleMs = durationMs + holdMs;
  const drawProgressEnd = durationMs / totalCycleMs;

  useEffect(() => {
    let frameId = 0;
    let startTime = 0;

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) % totalCycleMs;
      setProgress(elapsed / totalCycleMs);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [totalCycleMs]);

  const normalizedDrawProgress = progress >= drawProgressEnd ? 1 : progress / drawProgressEnd;

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
        {LOGO_PATHS.map((path) => {
          const raw = (normalizedDrawProgress - path.start) / (path.end - path.start);
          const segmentProgress = Math.min(1, Math.max(0, raw));

          return (
            <Path
              key={`draw-${path.key}`}
              d={path.d}
              stroke={stroke}
              strokeWidth={36.0766}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${path.dashLength} ${path.dashLength}`}
              strokeDashoffset={path.dashLength * (1 - segmentProgress)}
              opacity={segmentProgress <= 0 ? 0 : 1}
            />
          );
        })}
      </Svg>
    </View>
  );
}
