import { createTamagui, createTokens } from '@tamagui/core';
import { createInterFont } from '@tamagui/font-inter';
import { shorthands } from '@tamagui/shorthands';
import { themes as defaultThemes, tokens as defaultTokens } from '@tamagui/config/v3';
import { createMedia } from '@tamagui/react-native-media-driver';

// Custom tokens for LocoMotivate brand
const tokens = createTokens({
  ...defaultTokens,
  color: {
    ...defaultTokens.color,
    // Primary - Purple
    primary: '#7c3aed',
    primaryLight: '#a78bfa',
    primaryDark: '#5b21b6',
    // Secondary - Amber/Orange
    secondary: '#f59e0b',
    secondaryLight: '#fbbf24',
    secondaryDark: '#d97706',
    // Success - Green
    success: '#10b981',
    successLight: '#34d399',
    successDark: '#059669',
    // Warning - Yellow
    warning: '#eab308',
    warningLight: '#facc15',
    warningDark: '#ca8a04',
    // Error - Red
    error: '#ef4444',
    errorLight: '#f87171',
    errorDark: '#dc2626',
    // Neutral
    background: '#ffffff',
    backgroundDark: '#0f172a',
    foreground: '#0f172a',
    foregroundDark: '#f8fafc',
    muted: '#f1f5f9',
    mutedDark: '#1e293b',
    border: '#e2e8f0',
    borderDark: '#334155',
  },
});

const headingFont = createInterFont({
  size: {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 40,
    10: 48,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
  },
  face: {
    400: { normal: 'Inter' },
    500: { normal: 'InterMedium' },
    600: { normal: 'InterSemiBold' },
    700: { normal: 'InterBold' },
  },
});

const bodyFont = createInterFont({
  size: {
    1: 12,
    2: 14,
    3: 16,
    4: 18,
    5: 20,
    6: 24,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
  },
  face: {
    400: { normal: 'Inter' },
    500: { normal: 'InterMedium' },
    600: { normal: 'InterSemiBold' },
  },
});

const media = createMedia({
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1420 },
  xxl: { maxWidth: 1600 },
  gtXs: { minWidth: 660 + 1 },
  gtSm: { minWidth: 800 + 1 },
  gtMd: { minWidth: 1020 + 1 },
  gtLg: { minWidth: 1280 + 1 },
  short: { maxHeight: 820 },
  tall: { minHeight: 820 },
  hoverNone: { hover: 'none' },
  pointerCoarse: { pointer: 'coarse' },
});

// Custom themes
const lightTheme = {
  background: tokens.color.background,
  backgroundHover: tokens.color.muted,
  backgroundPress: tokens.color.muted,
  backgroundFocus: tokens.color.muted,
  color: tokens.color.foreground,
  colorHover: tokens.color.foreground,
  colorPress: tokens.color.foreground,
  colorFocus: tokens.color.foreground,
  borderColor: tokens.color.border,
  borderColorHover: tokens.color.primary,
  borderColorPress: tokens.color.primary,
  borderColorFocus: tokens.color.primary,
  placeholderColor: '#94a3b8',
  // Primary
  primary: tokens.color.primary,
  primaryHover: tokens.color.primaryDark,
  // Card
  cardBackground: '#ffffff',
  cardBorder: tokens.color.border,
  // Muted
  muted: tokens.color.muted,
  mutedForeground: '#64748b',
  // Accent
  accent: tokens.color.primaryLight,
  accentForeground: tokens.color.primaryDark,
};

const darkTheme = {
  background: tokens.color.backgroundDark,
  backgroundHover: tokens.color.mutedDark,
  backgroundPress: tokens.color.mutedDark,
  backgroundFocus: tokens.color.mutedDark,
  color: tokens.color.foregroundDark,
  colorHover: tokens.color.foregroundDark,
  colorPress: tokens.color.foregroundDark,
  colorFocus: tokens.color.foregroundDark,
  borderColor: tokens.color.borderDark,
  borderColorHover: tokens.color.primary,
  borderColorPress: tokens.color.primary,
  borderColorFocus: tokens.color.primary,
  placeholderColor: '#64748b',
  // Primary
  primary: tokens.color.primary,
  primaryHover: tokens.color.primaryLight,
  // Card
  cardBackground: '#1e293b',
  cardBorder: tokens.color.borderDark,
  // Muted
  muted: tokens.color.mutedDark,
  mutedForeground: '#94a3b8',
  // Accent
  accent: tokens.color.primaryDark,
  accentForeground: tokens.color.primaryLight,
};

export const config = createTamagui({
  defaultFont: 'body',
  animations: {
    fast: {
      type: 'spring',
      damping: 20,
      mass: 1.2,
      stiffness: 250,
    },
    medium: {
      type: 'spring',
      damping: 15,
      mass: 1,
      stiffness: 150,
    },
    slow: {
      type: 'spring',
      damping: 20,
      stiffness: 60,
    },
  },
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  tokens,
  themes: {
    light: lightTheme,
    dark: darkTheme,
    // Component-specific themes
    light_Button: {
      ...lightTheme,
      background: tokens.color.primary,
      backgroundHover: tokens.color.primaryDark,
      backgroundPress: tokens.color.primaryDark,
      color: '#ffffff',
    },
    dark_Button: {
      ...darkTheme,
      background: tokens.color.primary,
      backgroundHover: tokens.color.primaryLight,
      backgroundPress: tokens.color.primaryLight,
      color: '#ffffff',
    },
  },
  shorthands,
  media,
});

export default config;

export type AppConfig = typeof config;

declare module '@tamagui/core' {
  interface TamaguiCustomConfig extends AppConfig {}
}
