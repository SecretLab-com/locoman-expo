import React from "react";
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { haptics } from "@/hooks/use-haptics";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";

interface HapticButtonProps extends TouchableOpacityProps {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
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
  hapticType = "light",
  children,
  className,
  textClassName,
  onPress,
  disabled,
  style,
  ...props
}: HapticButtonProps) {
  const colors = useColors();
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

  const variantStyles = {
    primary: "bg-primary",
    secondary: "bg-surface border border-border",
    outline: "bg-transparent border border-primary",
    ghost: "bg-transparent",
    danger: "bg-error",
  };

  const variantTextStyles = {
    primary: "text-white",
    secondary: "text-foreground",
    outline: "text-primary",
    ghost: "text-primary",
    danger: "text-white",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5",
    md: "px-4 py-2.5",
    lg: "px-6 py-3.5",
  };

  const sizeTextStyles = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const spinnerColor = variant === "primary" || variant === "danger" ? colors.background : colors.primary;

  const computedAccessibilityLabel =
    props.accessibilityLabel ||
    (loading && loadingText ? loadingText : undefined) ||
    (typeof children === "string" ? children : undefined);

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      accessibilityRole={props.accessibilityRole || "button"}
      accessibilityLabel={computedAccessibilityLabel}
      style={[
        styles.button,
        disabled && styles.disabled,
        style,
      ]}
      className={cn(
        "rounded-xl flex-row items-center justify-center",
        variantStyles[variant],
        sizeStyles[size],
        (disabled || loading) && "opacity-60",
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading ? (
        loadingText ? (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator size="small" color={spinnerColor} />
            <Text
              className={cn(
                "font-semibold text-center ml-2",
                variantTextStyles[variant],
                sizeTextStyles[size],
                textClassName
              )}
            >
              {loadingText}
            </Text>
          </View>
        ) : (
          <ActivityIndicator size="small" color={spinnerColor} />
        )
      ) : (
        typeof children === "string" ? (
          <Text
            className={cn(
              "font-semibold text-center",
              variantTextStyles[variant],
              sizeTextStyles[size],
              textClassName
            )}
          >
            {children}
          </Text>
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
  disabled: {
    opacity: 0.5,
  },
});
