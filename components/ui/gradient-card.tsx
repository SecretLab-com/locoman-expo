import { View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

export type GradientVariant = "primary" | "success" | "warning" | "surface" | "dark";

export interface GradientCardProps extends ViewProps {
  /**
   * The gradient color variant
   */
  variant?: GradientVariant;
  /**
   * Custom gradient colors (overrides variant)
   */
  colors?: readonly [string, string, ...string[]];
  /**
   * Gradient direction: "horizontal" | "vertical" | "diagonal"
   */
  direction?: "horizontal" | "vertical" | "diagonal";
  /**
   * Border radius class name (e.g., "rounded-xl", "rounded-2xl")
   */
  rounded?: string;
  /**
   * Additional className for the card
   */
  className?: string;
}

/**
 * A card component with gradient background.
 * 
 * Usage:
 * ```tsx
 * <GradientCard variant="primary" className="p-4">
 *   <Text>Content</Text>
 * </GradientCard>
 * ```
 */
export function GradientCard({
  variant = "surface",
  colors: customColors,
  direction = "diagonal",
  rounded = "rounded-xl",
  className,
  children,
  style,
  ...props
}: GradientCardProps) {
  const themeColors = useColors();
  const colorScheme = useColorScheme();
  const isLight = colorScheme === "light";

  // Define gradient color presets based on variant
  const getGradientColors = (): readonly [string, string, ...string[]] => {
    if (customColors) return customColors;

    switch (variant) {
      case "primary":
        return [themeColors.primary, "#2563EB"] as const; // Blue gradient
      case "success":
        return [themeColors.success, "#059669"] as const; // Green gradient
      case "warning":
        return [themeColors.warning, "#D97706"] as const; // Orange gradient
      case "dark":
        return isLight
          ? [themeColors.surface, themeColors.background]
          : ["#1E293B", "#0F172A"];
      case "surface":
      default:
        return isLight
          ? [themeColors.surface, themeColors.background]
          : ["#1A1A2E", "#16162A"];
    }
  };

  // Get gradient start/end points based on direction
  const getGradientPoints = () => {
    switch (direction) {
      case "horizontal":
        return { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } };
      case "vertical":
        return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };
      case "diagonal":
      default:
        return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    }
  };

  const gradientColors = getGradientColors();
  const { start, end } = getGradientPoints();

  return (
    <View className={cn(rounded, "overflow-hidden")} style={style} {...props}>
      <LinearGradient
        colors={gradientColors}
        start={start}
        end={end}
        className={cn("flex-1", className)}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

/**
 * A stat card with gradient background for dashboards.
 */
export interface GradientStatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: GradientVariant;
  onPress?: () => void;
}
