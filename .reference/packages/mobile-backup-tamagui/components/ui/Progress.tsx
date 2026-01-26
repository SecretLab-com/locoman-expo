import { styled, Stack, XStack, Text, GetProps } from 'tamagui';
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

// Progress track
const ProgressTrack = styled(Stack, {
  name: 'ProgressTrack',
  backgroundColor: '$muted',
  borderRadius: 9999,
  overflow: 'hidden',

  variants: {
    size: {
      sm: {
        height: 4,
      },
      md: {
        height: 8,
      },
      lg: {
        height: 12,
      },
    },
  } as const,

  defaultVariants: {
    size: 'md',
  },
});

// Progress fill
const ProgressFill = styled(Stack, {
  name: 'ProgressFill',
  height: '100%',
  borderRadius: 9999,

  variants: {
    variant: {
      default: {
        backgroundColor: '$primary',
      },
      success: {
        backgroundColor: '$success',
      },
      warning: {
        backgroundColor: '$warning',
      },
      error: {
        backgroundColor: '$error',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
  },
});

// Animated Progress component
interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}

export function Progress({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  label,
  animated = true,
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const width = useSharedValue(0);

  useEffect(() => {
    if (animated) {
      width.value = withSpring(percentage, {
        damping: 15,
        stiffness: 100,
      });
    } else {
      width.value = percentage;
    }
  }, [percentage, animated, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <Stack gap="$1">
      {(showLabel || label) && (
        <XStack justifyContent="space-between" alignItems="center">
          {label && (
            <Text fontSize="$2" color="$mutedForeground">
              {label}
            </Text>
          )}
          {showLabel && (
            <Text fontSize="$2" fontWeight="500" color="$color">
              {Math.round(percentage)}%
            </Text>
          )}
        </XStack>
      )}
      <ProgressTrack size={size}>
        <Animated.View style={[{ height: '100%' }, animatedStyle]}>
          <ProgressFill variant={variant} width="100%" />
        </Animated.View>
      </ProgressTrack>
    </Stack>
  );
}

// Circular progress
interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
}

export function CircularProgress({
  value,
  max = 100,
  size = 60,
  strokeWidth = 6,
  variant = 'default',
  showLabel = true,
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    switch (variant) {
      case 'success':
        return '$success';
      case 'warning':
        return '$warning';
      case 'error':
        return '$error';
      default:
        return '$primary';
    }
  };

  return (
    <Stack width={size} height={size} alignItems="center" justifyContent="center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`var(--${variant === 'default' ? 'primary' : variant})`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <Text
          position="absolute"
          fontSize={size > 50 ? '$3' : '$2'}
          fontWeight="600"
          color="$color"
        >
          {Math.round(percentage)}%
        </Text>
      )}
    </Stack>
  );
}

// Step progress
interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
  variant?: 'default' | 'success' | 'warning' | 'error';
}

export function StepProgress({
  currentStep,
  totalSteps,
  labels,
  variant = 'default',
}: StepProgressProps) {
  return (
    <Stack gap="$2">
      <XStack alignItems="center" gap="$1">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <XStack key={index} flex={1} alignItems="center">
              <Stack
                width={24}
                height={24}
                borderRadius={12}
                backgroundColor={isCompleted || isCurrent ? `$${variant === 'default' ? 'primary' : variant}` : '$muted'}
                alignItems="center"
                justifyContent="center"
              >
                <Text
                  fontSize="$1"
                  fontWeight="600"
                  color={isCompleted || isCurrent ? 'white' : '$mutedForeground'}
                >
                  {index + 1}
                </Text>
              </Stack>
              {index < totalSteps - 1 && (
                <Stack
                  flex={1}
                  height={2}
                  backgroundColor={isCompleted ? `$${variant === 'default' ? 'primary' : variant}` : '$muted'}
                  marginHorizontal="$1"
                />
              )}
            </XStack>
          );
        })}
      </XStack>
      {labels && labels.length > 0 && (
        <XStack>
          {labels.map((label, index) => (
            <Text
              key={index}
              flex={1}
              fontSize="$1"
              color={index <= currentStep ? '$color' : '$mutedForeground'}
              textAlign="center"
            >
              {label}
            </Text>
          ))}
        </XStack>
      )}
    </Stack>
  );
}

export type ProgressTrackProps = GetProps<typeof ProgressTrack>;

export default Progress;
