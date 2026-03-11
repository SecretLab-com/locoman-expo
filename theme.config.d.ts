export const themeColors: {
  primary: { light: string; dark: string };
  'primary-foreground': { light: string; dark: string };
  background: { light: string; dark: string };
  'background-muted': { light: string; dark: string };
  surface: { light: string; dark: string };
  'surface-alt': { light: string; dark: string };
  'surface-elevated': { light: string; dark: string };
  'surface-brand': { light: string; dark: string };
  'surface-overlay': { light: string; dark: string };
  foreground: { light: string; dark: string };
  muted: { light: string; dark: string };
  'foreground-subtle': { light: string; dark: string };
  'foreground-inverse': { light: string; dark: string };
  border: { light: string; dark: string };
  'border-muted': { light: string; dark: string };
  'border-strong': { light: string; dark: string };
  success: { light: string; dark: string };
  'success-surface': { light: string; dark: string };
  warning: { light: string; dark: string };
  'warning-surface': { light: string; dark: string };
  error: { light: string; dark: string };
  'error-surface': { light: string; dark: string };
  info: { light: string; dark: string };
  'info-surface': { light: string; dark: string };
  accent: { light: string; dark: string };
  'accent-surface': { light: string; dark: string };
  icon: { light: string; dark: string };
  'icon-muted': { light: string; dark: string };
  'icon-inverse': { light: string; dark: string };
  overlay: { light: string; dark: string };
  'overlay-soft': { light: string; dark: string };
  'focus-ring': { light: string; dark: string };
};

export const themeSpacing: {
  0: number;
  px: number;
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
  8: number;
  10: number;
  12: number;
  14: number;
  16: number;
  20: number;
};

export const themeRadii: {
  none: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
  pill: number;
};

export const themeTypography: {
  fontSize: {
    caption2: number;
    caption: number;
    label: number;
    bodySm: number;
    body: number;
    title: number;
    h2: number;
    h1: number;
    display: number;
  };
  lineHeight: {
    caption2: number;
    caption: number;
    label: number;
    bodySm: number;
    body: number;
    title: number;
    h2: number;
    h1: number;
    display: number;
  };
  fontWeight: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
    heavy: string;
  };
};

export const themeShadows: {
  [key: string]: {
    ios: Record<string, unknown>;
    android: Record<string, unknown>;
    web: string;
  };
};

declare const themeConfig: {
  themeColors: typeof themeColors;
  themeSpacing: typeof themeSpacing;
  themeRadii: typeof themeRadii;
  themeTypography: typeof themeTypography;
  themeShadows: typeof themeShadows;
};

export default themeConfig;
