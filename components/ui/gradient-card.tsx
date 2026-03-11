import { View, type ViewProps } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { cn } from "@/lib/utils";
import { useDesignSystem } from "@/hooks/use-design-system";

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
  const ds = useDesignSystem();

  // Define gradient color presets based on variant
  const getGradientColors = (): readonly [string, string, ...string[]] => {
    if (customColors) return customColors;

    switch (variant) {
      case "primary":
        return [ds.colors.brand.primary, ds.raw["primary-foreground"] === "#FFFFFF" ? "#1D4ED8" : "#2563EB"] as const;
      case "success":
        return [ds.colors.status.success, "#059669"] as const;
      case "warning":
        return [ds.colors.status.warning, "#D97706"] as const;
      case "dark":
        return ds.colorScheme === "light"
          ? [ds.colors.surface.card, ds.colors.surface.page]
          : [ds.raw["surface-elevated"], ds.raw.background];
      case "surface":
      default:
        return ds.colorScheme === "light"
          ? [ds.colors.surface.card, ds.colors.surface.page]
          : [ds.raw["surface-alt"], ds.raw.surface];
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
