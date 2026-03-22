import React from "react";
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { AppText } from "@/components/ui/app-text";
import { FORM_PRIMARY_ACTION_MAX_WIDTH } from "@/design-system/layout-constants";
import { getButtonRecipe } from "@/design-system/recipes";
import { useDesignSystem } from "@/hooks/use-design-system";
import { haptics } from "@/hooks/use-haptics";
import { cn } from "@/lib/utils";

interface HapticButtonProps extends TouchableOpacityProps {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingText?: string;
  /** Stretch to parent width (e.g. bottom bars, horizontal button groups). */
  fullWidth?: boolean;
  /**
   * Cap width and center (stacked form CTAs). Use with vertical stacks — not inside flex-row groups (use fullWidth there).
   */
  constrainWidth?: boolean;
  hapticType?: "light" | "medium" | "heavy" | "selection";
  children: React.ReactNode;
  className?: string;
  textClassName?: string;
  accessibilityLabel?: string;
}

export function HapticButton({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  fullWidth = false,
  constrainWidth = false,
  hapticType = "light",
  children,
  className,
  textClassName,
  onPress,
  disabled,
  style,
  ...props
}: HapticButtonProps) {
  const ds = useDesignSystem();
  const handlePress = async (e: any) => {
    if (disabled || loading) return;

    switch (hapticType) {
      case "light":
        await haptics.light();
        break;
      case "medium":
        await haptics.medium();
        break;
      case "heavy":
        await haptics.heavy();
        break;
      case "selection":
        await haptics.selection();
        break;
    }

    onPress?.(e);
  };

  const recipe = getButtonRecipe(ds, {
    variant,
    size,
    disabled: disabled || loading,
  });
  const spinnerColor = recipe.iconColor;

  const computedAccessibilityLabel =
    props.accessibilityLabel ||
    (loading && loadingText ? loadingText : undefined) ||
    (typeof children === "string" ? children : undefined);

  const widthStyle = fullWidth
    ? { alignSelf: "stretch" as const, width: "100%" as const }
    : constrainWidth
      ? {
          alignSelf: "center" as const,
          width: "100%" as const,
          maxWidth: FORM_PRIMARY_ACTION_MAX_WIDTH,
        }
      : {};

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole={props.accessibilityRole || "button"}
      accessibilityLabel={computedAccessibilityLabel}
      style={[
        styles.button,
        recipe.container,
        widthStyle,
        style,
      ]}
      className={cn(fullWidth && "w-full", className)}
      {...props}
    >
      {loading ? (
        loadingText ? (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator size="small" color={spinnerColor} />
            <AppText
              className={cn("ml-2", textClassName)}
              variant={recipe.labelVariant}
              tone={recipe.labelTone}
              weight="semibold"
            >
              {loadingText}
            </AppText>
          </View>
        ) : (
          <ActivityIndicator size="small" color={spinnerColor} />
        )
      ) : (
        typeof children === "string" ? (
          <AppText
            className={cn("text-center", textClassName)}
            variant={recipe.labelVariant}
            tone={recipe.labelTone}
            weight="semibold"
          >
            {children}
          </AppText>
        ) : (
          children
        )
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
  },
});
