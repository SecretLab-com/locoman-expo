import { Platform, type ViewStyle } from 'react-native';

import {
  Radii,
  Shadows,
  Spacing,
  Typography,
  type ThemeColorPalette,
} from '@/constants/theme';

type ShadowName = keyof typeof Shadows;

function resolveShadow(
  palette: ThemeColorPalette,
  shadowName: ShadowName,
): ViewStyle {
  const recipe = Shadows[shadowName];
  const shadowColor = palette.colorScheme === 'dark'
    ? 'rgba(2,6,23,0.72)'
    : 'rgba(15,23,42,0.18)';

  if (Platform.OS === 'android') {
    return {
      ...(recipe.android as ViewStyle),
      shadowColor,
    };
  }

  if (Platform.OS === 'web') {
    return {
      boxShadow: recipe.web,
    } as ViewStyle;
  }

  return {
    shadowColor,
    ...(recipe.ios as ViewStyle),
  };
}

export function createDesignTokens(palette: ThemeColorPalette) {
  return {
    colorScheme: palette.colorScheme,
    raw: palette,
    colors: {
      brand: {
        primary: palette.primary,
        onPrimary: palette['primary-foreground'],
        accent: palette.accent,
        focusRing: palette['focus-ring'],
      },
      text: {
        primary: palette.foreground,
        secondary: palette.muted,
        subtle: palette['foreground-subtle'],
        inverse: palette['foreground-inverse'],
      },
      surface: {
        page: palette.background,
        pageMuted: palette['background-muted'],
        card: palette.surface,
        cardAlt: palette['surface-alt'],
        elevated: palette['surface-elevated'],
        brand: palette['surface-brand'],
        overlay: palette['surface-overlay'],
        success: palette['success-surface'],
        warning: palette['warning-surface'],
        error: palette['error-surface'],
        info: palette['info-surface'],
      },
      border: {
        subtle: palette['border-muted'],
        default: palette.border,
        strong: palette['border-strong'],
      },
      icon: {
        default: palette.icon,
        muted: palette['icon-muted'],
        inverse: palette['icon-inverse'],
        brand: palette.primary,
      },
      status: {
        success: palette.success,
        warning: palette.warning,
        error: palette.error,
        info: palette.info,
        accent: palette.accent,
      },
      overlay: {
        scrim: palette.overlay,
        soft: palette['overlay-soft'],
      },
    },
    spacing: Spacing,
    radii: Radii,
    typography: Typography,
    elevation: {
      none: resolveShadow(palette, 'none'),
      sm: resolveShadow(palette, 'sm'),
      md: resolveShadow(palette, 'md'),
      lg: resolveShadow(palette, 'lg'),
      float: resolveShadow(palette, 'float'),
    },
  };
}

export type DesignTokens = ReturnType<typeof createDesignTokens>;
