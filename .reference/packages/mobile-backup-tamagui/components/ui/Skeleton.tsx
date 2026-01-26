import { styled, Stack, GetProps } from 'tamagui';
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

// Base skeleton
const SkeletonBase = styled(Stack, {
  name: 'Skeleton',
  backgroundColor: '$muted',
  overflow: 'hidden',

  variants: {
    variant: {
      default: {
        borderRadius: '$2',
      },
      circular: {
        borderRadius: 9999,
      },
      rounded: {
        borderRadius: '$4',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
  },
});

// Animated skeleton with shimmer effect
interface SkeletonProps extends GetProps<typeof SkeletonBase> {
  width?: number | string;
  height?: number | string;
  animate?: boolean;
}

export function Skeleton({
  width = '100%',
  height = 20,
  animate = true,
  ...props
}: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    if (animate) {
      shimmer.value = withRepeat(
        withTiming(1, { duration: 1500 }),
        -1,
        false
      );
    }
  }, [animate, shimmer]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 0.5, 1], [0.5, 0.8, 0.5]);
    return {
      opacity,
    };
  });

  if (!animate) {
    return <SkeletonBase width={width} height={height} {...props} />;
  }

  return (
    <Animated.View style={[{ width, height }, animatedStyle]}>
      <SkeletonBase width="100%" height="100%" {...props} />
    </Animated.View>
  );
}

// Text skeleton
export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
  gap = 8,
}: {
  lines?: number;
  lastLineWidth?: number | string;
  gap?: number;
}) {
  return (
    <Stack gap={gap}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </Stack>
  );
}

// Avatar skeleton
export function SkeletonAvatar({
  size = 40,
}: {
  size?: number;
}) {
  return <Skeleton width={size} height={size} variant="circular" />;
}

// Card skeleton
export function SkeletonCard() {
  return (
    <Stack
      backgroundColor="$cardBackground"
      borderRadius="$4"
      padding="$4"
      gap="$3"
      borderWidth={1}
      borderColor="$cardBorder"
    >
      <Stack flexDirection="row" gap="$3" alignItems="center">
        <SkeletonAvatar />
        <Stack flex={1} gap="$2">
          <Skeleton height={16} width="60%" />
          <Skeleton height={12} width="40%" />
        </Stack>
      </Stack>
      <SkeletonText lines={2} />
    </Stack>
  );
}

// List item skeleton
export function SkeletonListItem() {
  return (
    <Stack
      flexDirection="row"
      padding="$3"
      gap="$3"
      alignItems="center"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
    >
      <SkeletonAvatar size={48} />
      <Stack flex={1} gap="$2">
        <Skeleton height={16} width="70%" />
        <Skeleton height={12} width="50%" />
      </Stack>
      <Skeleton height={24} width={60} variant="rounded" />
    </Stack>
  );
}

// Table row skeleton
export function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <Stack flexDirection="row" padding="$3" gap="$3" alignItems="center">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          flex={i === 0 ? 2 : 1}
        />
      ))}
    </Stack>
  );
}

// Dashboard stat card skeleton
export function SkeletonStatCard() {
  return (
    <Stack
      backgroundColor="$cardBackground"
      borderRadius="$4"
      padding="$4"
      gap="$2"
      borderWidth={1}
      borderColor="$cardBorder"
    >
      <Skeleton height={14} width={80} />
      <Skeleton height={32} width={100} />
      <Skeleton height={12} width={60} />
    </Stack>
  );
}

export type { SkeletonProps };
export default Skeleton;
