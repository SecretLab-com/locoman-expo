/** @type {const} */
const themeColors = {
  primary: { light: '#2563EB', dark: '#60A5FA' },
  'primary-foreground': { light: '#FFFFFF', dark: '#0B1020' },

  background: { light: '#F8FAFC', dark: '#0A0A14' },
  'background-muted': { light: '#EEF2FF', dark: '#111827' },

  surface: { light: '#F1F5F9', dark: '#151520' },
  'surface-alt': { light: '#FFFFFF', dark: '#171C2B' },
  'surface-elevated': { light: '#FFFFFF', dark: '#1B2233' },
  'surface-brand': { light: '#DBEAFE', dark: '#312E81' },
  'surface-overlay': { light: 'rgba(255,255,255,0.92)', dark: 'rgba(11,16,32,0.88)' },

  foreground: { light: '#0F172A', dark: '#FFFFFF' },
  muted: { light: '#64748B', dark: '#9CA3AF' },
  'foreground-subtle': { light: '#94A3B8', dark: '#CBD5E1' },
  'foreground-inverse': { light: '#FFFFFF', dark: '#0B1020' },

  border: { light: '#E2E8F0', dark: '#1E293B' },
  'border-muted': { light: 'rgba(148,163,184,0.18)', dark: 'rgba(148,163,184,0.16)' },
  'border-strong': { light: 'rgba(59,130,246,0.22)', dark: 'rgba(96,165,250,0.5)' },

  success: { light: '#16A34A', dark: '#4ADE80' },
  'success-surface': { light: 'rgba(34,197,94,0.12)', dark: 'rgba(52,211,153,0.18)' },
  warning: { light: '#D97706', dark: '#FBBF24' },
  'warning-surface': { light: 'rgba(245,158,11,0.14)', dark: 'rgba(250,204,21,0.15)' },
  error: { light: '#DC2626', dark: '#F87171' },
  'error-surface': { light: 'rgba(239,68,68,0.12)', dark: 'rgba(248,113,113,0.16)' },
  info: { light: '#0891B2', dark: '#22D3EE' },
  'info-surface': { light: 'rgba(6,182,212,0.12)', dark: 'rgba(34,211,238,0.16)' },
  accent: { light: '#7C3AED', dark: '#A78BFA' },
  'accent-surface': { light: 'rgba(124,58,237,0.12)', dark: 'rgba(167,139,250,0.18)' },

  icon: { light: '#334155', dark: '#E2E8F0' },
  'icon-muted': { light: '#64748B', dark: '#94A3B8' },
  'icon-inverse': { light: '#FFFFFF', dark: '#0B1020' },

  overlay: { light: 'rgba(15,23,42,0.52)', dark: 'rgba(2,6,23,0.72)' },
  'overlay-soft': { light: 'rgba(15,23,42,0.08)', dark: 'rgba(255,255,255,0.06)' },
  'focus-ring': { light: 'rgba(37,99,235,0.32)', dark: 'rgba(96,165,250,0.38)' },
};

/** @type {const} */
const themeSpacing = {
  0: 0,
  px: 1,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
};

/** @type {const} */
const themeRadii = {
  none: 0,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  '2xl': 30,
  pill: 999,
};

/** @type {const} */
const themeTypography = {
  fontSize: {
    caption2: 11,
    caption: 12,
    label: 13,
    bodySm: 14,
    body: 16,
    title: 20,
    h2: 24,
    h1: 30,
    display: 36,
  },
  lineHeight: {
    caption2: 14,
    caption: 16,
    label: 18,
    bodySm: 20,
    body: 24,
    title: 28,
    h2: 32,
    h1: 38,
    display: 44,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    heavy: '800',
  },
};

/** @type {const} */
const themeShadows = {
  none: {
    ios: {},
    android: { elevation: 0 },
    web: 'none',
  },
  sm: {
    ios: {
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
    },
    android: { elevation: 2 },
    web: '0 2px 6px rgba(15,23,42,0.08)',
  },
  md: {
    ios: {
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
    web: '0 6px 16px rgba(15,23,42,0.12)',
  },
  lg: {
    ios: {
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
    android: { elevation: 10 },
    web: '0 10px 24px rgba(15,23,42,0.16)',
  },
  float: {
    ios: {
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.22,
      shadowRadius: 22,
    },
    android: { elevation: 12 },
    web: '0 10px 22px rgba(15,23,42,0.22)',
  },
};

module.exports = {
  themeColors,
  themeSpacing,
  themeRadii,
  themeTypography,
  themeShadows,
};
