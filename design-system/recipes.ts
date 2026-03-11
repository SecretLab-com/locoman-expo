import type { TextStyle, ViewStyle } from 'react-native';

import type { DesignTokens } from '@/design-system/tokens';

export type SurfaceTone =
  | 'default'
  | 'alt'
  | 'elevated'
  | 'brand'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'transparent';
export type BadgeTone = 'default' | 'brand' | 'success' | 'warning' | 'error' | 'info';
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ControlSize = 'sm' | 'md' | 'lg';

function getSurfaceColor(tokens: DesignTokens, tone: SurfaceTone): string {
  switch (tone) {
    case 'alt':
      return tokens.colors.surface.cardAlt;
    case 'elevated':
      return tokens.colors.surface.elevated;
    case 'brand':
      return tokens.colors.surface.brand;
    case 'success':
      return tokens.colors.surface.success;
    case 'warning':
      return tokens.colors.surface.warning;
    case 'error':
      return tokens.colors.surface.error;
    case 'info':
      return tokens.colors.surface.info;
    case 'transparent':
      return 'transparent';
    case 'default':
    default:
      return tokens.colors.surface.card;
  }
}

export function getSurfaceRecipe(
  tokens: DesignTokens,
  options?: {
    tone?: SurfaceTone;
    border?: 'none' | 'subtle' | 'default' | 'strong';
    padding?: keyof DesignTokens['spacing'];
    radius?: keyof DesignTokens['radii'];
    elevated?: boolean;
  },
): ViewStyle {
  const {
    tone = 'default',
    border = tone === 'transparent' ? 'none' : 'default',
    padding = 4,
    radius = 'lg',
    elevated = false,
  } = options || {};

  return {
    backgroundColor: getSurfaceColor(tokens, tone),
    borderWidth: border === 'none' ? 0 : 1,
    borderColor:
      border === 'strong'
        ? tokens.colors.border.strong
        : border === 'subtle'
          ? tokens.colors.border.subtle
          : border === 'none'
            ? 'transparent'
            : tokens.colors.border.default,
    borderRadius: tokens.radii[radius],
    padding: tokens.spacing[padding],
    ...(elevated ? tokens.elevation.sm : null),
  };
}

export function getDividerStyle(tokens: DesignTokens): ViewStyle {
  return {
    height: 1,
    backgroundColor: tokens.colors.border.subtle,
  };
}

export function getBadgeRecipe(
  tokens: DesignTokens,
  tone: BadgeTone = 'default',
): {
  container: ViewStyle;
  text: TextStyle;
} {
  switch (tone) {
    case 'brand':
      return {
        container: {
          backgroundColor: tokens.colors.surface.brand,
          borderWidth: 1,
          borderColor: tokens.colors.border.strong,
          borderRadius: tokens.radii.pill,
          paddingHorizontal: tokens.spacing[3],
          paddingVertical: tokens.spacing[1],
        },
        text: {
          color: tokens.colors.brand.primary,
          fontSize: tokens.typography.fontSize.caption,
          fontWeight: tokens.typography.fontWeight.semibold,
        },
      };
    case 'success':
    case 'warning':
    case 'error':
    case 'info': {
      const color = tokens.colors.status[tone];
      const surface = tokens.colors.surface[tone];
      return {
        container: {
          backgroundColor: surface,
          borderWidth: 1,
          borderColor: color,
          borderRadius: tokens.radii.pill,
          paddingHorizontal: tokens.spacing[3],
          paddingVertical: tokens.spacing[1],
        },
        text: {
          color,
          fontSize: tokens.typography.fontSize.caption,
          fontWeight: tokens.typography.fontWeight.semibold,
        },
      };
    }
    case 'default':
    default:
      return {
        container: {
          backgroundColor: tokens.colors.overlay.soft,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          borderRadius: tokens.radii.pill,
          paddingHorizontal: tokens.spacing[3],
          paddingVertical: tokens.spacing[1],
        },
        text: {
          color: tokens.colors.text.secondary,
          fontSize: tokens.typography.fontSize.caption,
          fontWeight: tokens.typography.fontWeight.medium,
        },
      };
  }
}

export function getButtonRecipe(
  tokens: DesignTokens,
  options?: {
    variant?: ButtonVariant;
    size?: ControlSize;
    disabled?: boolean;
  },
): {
  container: ViewStyle;
  labelTone: 'default' | 'brand' | 'inverse' | 'error';
  labelVariant: 'label' | 'bodySm' | 'body';
  iconColor: string;
} {
  const {
    variant = 'primary',
    size = 'md',
    disabled = false,
  } = options || {};

  const sizeMap = {
    sm: { minHeight: 40, px: tokens.spacing[3], py: tokens.spacing[2], variant: 'label' as const },
    md: { minHeight: 44, px: tokens.spacing[4], py: tokens.spacing[3], variant: 'bodySm' as const },
    lg: { minHeight: 52, px: tokens.spacing[6], py: tokens.spacing[3], variant: 'body' as const },
  };

  const base: ViewStyle = {
    minHeight: sizeMap[size].minHeight,
    paddingHorizontal: sizeMap[size].px,
    paddingVertical: sizeMap[size].py,
    borderRadius: tokens.radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.6 : 1,
  };

  switch (variant) {
    case 'secondary':
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.surface.card,
          borderWidth: 1,
          borderColor: tokens.colors.border.default,
        },
        labelTone: 'default',
        labelVariant: sizeMap[size].variant,
        iconColor: tokens.colors.icon.brand,
      };
    case 'outline':
      return {
        container: {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: tokens.colors.brand.primary,
        },
        labelTone: 'brand',
        labelVariant: sizeMap[size].variant,
        iconColor: tokens.colors.brand.primary,
      };
    case 'ghost':
      return {
        container: {
          ...base,
          backgroundColor: 'transparent',
        },
        labelTone: 'brand',
        labelVariant: sizeMap[size].variant,
        iconColor: tokens.colors.brand.primary,
      };
    case 'danger':
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.status.error,
          borderWidth: 1,
          borderColor: tokens.colors.status.error,
        },
        labelTone: 'inverse',
        labelVariant: sizeMap[size].variant,
        iconColor: tokens.colors.text.inverse,
      };
    case 'primary':
    default:
      return {
        container: {
          ...base,
          backgroundColor: tokens.colors.brand.primary,
          borderWidth: 1,
          borderColor: tokens.colors.brand.primary,
        },
        labelTone: 'inverse',
        labelVariant: sizeMap[size].variant,
        iconColor: tokens.colors.brand.onPrimary,
      };
  }
}

export function getInputRecipe(
  tokens: DesignTokens,
  options?: {
    invalid?: boolean;
    disabled?: boolean;
    multiline?: boolean;
  },
): {
  container: ViewStyle;
  input: TextStyle;
} {
  const invalid = options?.invalid ?? false;
  const disabled = options?.disabled ?? false;
  return {
    container: {
      backgroundColor: disabled
        ? tokens.colors.surface.pageMuted
        : tokens.colors.surface.cardAlt,
      borderWidth: 1,
      borderColor: invalid
        ? tokens.colors.status.error
        : tokens.colors.border.default,
      borderRadius: tokens.radii.lg,
      minHeight: options?.multiline ? 120 : 48,
      paddingHorizontal: tokens.spacing[4],
      paddingVertical: tokens.spacing[3],
      opacity: disabled ? 0.7 : 1,
    },
    input: {
      color: tokens.colors.text.primary,
      fontSize: tokens.typography.fontSize.body,
      lineHeight: tokens.typography.lineHeight.body,
      fontWeight: tokens.typography.fontWeight.regular,
    },
  };
}

export function getFabRecipe(tokens: DesignTokens): ViewStyle {
  return {
    backgroundColor: tokens.colors.surface.overlay,
    borderWidth: 1,
    borderColor: tokens.colors.border.strong,
    borderRadius: tokens.radii.pill,
    ...tokens.elevation.float,
  };
}
