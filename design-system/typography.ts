import type { TextStyle } from 'react-native';

import { Fonts, Typography as ThemeTypography, type ThemeColorPalette } from '@/constants/theme';

export type TextVariant = keyof typeof ThemeTypography.fontSize;
export type TextWeight = keyof typeof ThemeTypography.fontWeight;
export type TextTone =
  | 'default'
  | 'secondary'
  | 'subtle'
  | 'inverse'
  | 'brand'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';
export type FontFamilyVariant = keyof typeof Fonts;

export function getTextToneColor(
  palette: ThemeColorPalette,
  tone: TextTone = 'default',
): string {
  switch (tone) {
    case 'secondary':
      return palette.muted;
    case 'subtle':
      return palette['foreground-subtle'];
    case 'inverse':
      return palette['foreground-inverse'];
    case 'brand':
      return palette.primary;
    case 'success':
      return palette.success;
    case 'warning':
      return palette.warning;
    case 'error':
      return palette.error;
    case 'info':
      return palette.info;
    case 'default':
    default:
      return palette.foreground;
  }
}

export function getTypographyStyle(options: {
  palette: ThemeColorPalette;
  variant?: TextVariant;
  weight?: TextWeight;
  tone?: TextTone;
  family?: FontFamilyVariant;
  align?: TextStyle['textAlign'];
}): TextStyle {
  const {
    palette,
    variant = 'body',
    weight = variant === 'display' || variant === 'h1' || variant === 'h2'
      ? 'bold'
      : variant === 'title' || variant === 'label'
        ? 'semibold'
        : 'regular',
    tone = 'default',
    family = 'sans',
    align,
  } = options;

  return {
    color: getTextToneColor(palette, tone),
    fontFamily: Fonts[family],
    fontSize: ThemeTypography.fontSize[variant],
    lineHeight: ThemeTypography.lineHeight[variant],
    fontWeight: ThemeTypography.fontWeight[weight] as TextStyle['fontWeight'],
    textAlign: align,
  };
}
