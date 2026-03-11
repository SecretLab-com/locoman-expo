import type { ThemeColorPalette } from '@/constants/theme';

export type TrainerDashboardPalette = {
  page: string;
  surface: string;
  card: string;
  cardSoft: string;
  primary: string;
  text: string;
  muted: string;
  border: string;
  borderStrong: string;
  chipBg: string;
  chipText: string;
  heroBg: string;
  heroBorder: string;
  heroSubtitle: string;
  heroGlowMain: string;
  heroGlowSecond: string;
  actionIconWrapBg: string;
  actionTileBg: string;
  actionTileBorder: string;
  mutedBadgeBg: string;
  mutedBadgeBorder: string;
  emptyIconBg: string;
  emptyIconColor: string;
  emptyText: string;
  stepInactiveBg: string;
  stepInactiveBorder: string;
  stepInactiveDot: string;
  socialStatBg: string;
  socialStatBorder: string;
  socialAccentText: string;
  socialPillBg: string;
  socialPillBorder: string;
  socialPillText: string;
  chartBg: string;
  chartBorder: string;
  chartOverlayBg: string;
  chartPlaceholderFill: string;
  chartPlaceholderText: string;
  chartGrid: string;
  progressTrackBg: string;
  divider: string;
  ratingPanelBg: string;
  ratingPanelBorder: string;
  ratingText: string;
  secondaryButtonBg: string;
  secondaryButtonBorder: string;
  fallbackHeroText: string;
  fallbackHeroSubtitle: string;
  surfaceDashedBg: string;
  surfaceDashedBorder: string;
  lockIconBg: string;
  lockIconColor: string;
  skeletonStrong: string;
  skeletonSoft: string;
  skeletonPillBg: string;
  skeletonPillBar: string;
};

export const trainerDialSegmentColors = ['#F87171', '#FBBF24', '#34D399'] as const;

export function buildTrainerDashboardPalette(
  colors: ThemeColorPalette,
  isLight: boolean,
): TrainerDashboardPalette {
  if (isLight) {
    return {
      page: colors.background,
      surface: colors.surface,
      card: '#FFFFFF',
      cardSoft: '#FFFFFF',
      primary: colors.primary,
      text: colors.text,
      muted: colors.muted,
      border: colors.border,
      borderStrong: colors['border-strong'],
      chipBg: 'rgba(59,130,246,0.10)',
      chipText: '#1D4ED8',
      heroBg: colors['surface-brand'],
      heroBorder: 'rgba(59,130,246,0.18)',
      heroSubtitle: '#334155',
      heroGlowMain: 'rgba(96,165,250,0.16)',
      heroGlowSecond: 'rgba(59,130,246,0.10)',
      actionIconWrapBg: 'rgba(59,130,246,0.12)',
      actionTileBg: '#FFFFFF',
      actionTileBorder: colors.border,
      mutedBadgeBg: 'rgba(148,163,184,0.10)',
      mutedBadgeBorder: 'rgba(148,163,184,0.18)',
      emptyIconBg: '#E2E8F0',
      emptyIconColor: '#64748B',
      emptyText: '#64748B',
      stepInactiveBg: 'rgba(148,163,184,0.10)',
      stepInactiveBorder: 'rgba(148,163,184,0.16)',
      stepInactiveDot: '#94A3B8',
      socialStatBg: 'rgba(255,255,255,0.86)',
      socialStatBorder: 'rgba(148,163,184,0.18)',
      socialAccentText: '#2563EB',
      socialPillBg: 'rgba(226,232,240,0.85)',
      socialPillBorder: 'rgba(148,163,184,0.20)',
      socialPillText: '#334155',
      chartBg: 'rgba(255,255,255,0.92)',
      chartBorder: 'rgba(148,163,184,0.16)',
      chartOverlayBg: 'rgba(255,255,255,0.88)',
      chartPlaceholderFill: 'rgba(148,163,184,0.08)',
      chartPlaceholderText: 'rgba(100,116,139,0.82)',
      chartGrid: 'rgba(148,163,184,0.22)',
      progressTrackBg: 'rgba(148,163,184,0.18)',
      divider: 'rgba(148,163,184,0.20)',
      ratingPanelBg: 'rgba(239,246,255,0.9)',
      ratingPanelBorder: 'rgba(96,165,250,0.24)',
      ratingText: colors.accent,
      secondaryButtonBg: 'rgba(255,255,255,0.82)',
      secondaryButtonBorder: 'rgba(148,163,184,0.18)',
      fallbackHeroText: colors.text,
      fallbackHeroSubtitle: '#334155',
      surfaceDashedBg: 'rgba(255,255,255,0.92)',
      surfaceDashedBorder: colors['border-strong'],
      lockIconBg: 'rgba(148,163,184,0.10)',
      lockIconColor: '#64748B',
      skeletonStrong: 'rgba(148,163,184,0.18)',
      skeletonSoft: 'rgba(148,163,184,0.10)',
      skeletonPillBg: 'rgba(226,232,240,0.8)',
      skeletonPillBar: 'rgba(148,163,184,0.18)',
    };
  }

  return {
    page: colors.background,
    surface: colors.surface,
    card: '#171C2B',
    cardSoft: '#141A28',
    primary: colors.primary,
    text: '#F8FAFC',
    muted: '#94A3B8',
    border: 'rgba(148,163,184,0.22)',
    borderStrong: colors['border-strong'],
    chipBg: 'rgba(167,139,250,0.22)',
    chipText: '#BFDBFE',
    heroBg: '#312E81',
    heroBorder: 'rgba(167,139,250,0.65)',
    heroSubtitle: '#B6C2D6',
    heroGlowMain: 'rgba(168,85,247,0.5)',
    heroGlowSecond: 'rgba(59,130,246,0.38)',
    actionIconWrapBg: 'rgba(96,165,250,0.2)',
    actionTileBg: 'rgba(21,21,32,0.94)',
    actionTileBorder: 'rgba(148,163,184,0.22)',
    mutedBadgeBg: 'rgba(255,255,255,0.05)',
    mutedBadgeBorder: 'rgba(255,255,255,0.12)',
    emptyIconBg: 'rgba(255,255,255,0.06)',
    emptyIconColor: '#64748B',
    emptyText: '#A7B5CC',
    stepInactiveBg: 'rgba(255,255,255,0.05)',
    stepInactiveBorder: 'rgba(255,255,255,0.12)',
    stepInactiveDot: '#94A3A0',
    socialStatBg: 'rgba(11,16,32,0.42)',
    socialStatBorder: 'rgba(148,163,184,0.18)',
    socialAccentText: '#93C5FD',
    socialPillBg: 'rgba(15,23,42,0.55)',
    socialPillBorder: 'rgba(148,163,184,0.25)',
    socialPillText: '#C7D2FE',
    chartBg: 'rgba(15,23,42,0.42)',
    chartBorder: 'rgba(148,163,184,0.14)',
    chartOverlayBg: 'rgba(15,23,42,0.6)',
    chartPlaceholderFill: 'rgba(148,163,184,0.05)',
    chartPlaceholderText: 'rgba(148,163,184,0.72)',
    chartGrid: 'rgba(148,163,184,0.16)',
    progressTrackBg: 'rgba(255,255,255,0.05)',
    divider: 'rgba(255,255,255,0.10)',
    ratingPanelBg: 'rgba(15,23,42,0.28)',
    ratingPanelBorder: 'rgba(167,139,250,0.35)',
    ratingText: '#C4B5FD',
    secondaryButtonBg: 'rgba(255,255,255,0.06)',
    secondaryButtonBorder: 'rgba(255,255,255,0.12)',
    fallbackHeroText: '#F8FAFC',
    fallbackHeroSubtitle: '#C7D2FE',
    surfaceDashedBg: 'rgba(23,28,43,0.75)',
    surfaceDashedBorder: 'rgba(96,165,250,0.22)',
    lockIconBg: 'rgba(255,255,255,0.05)',
    lockIconColor: '#64748B',
    skeletonStrong: 'rgba(255,255,255,0.12)',
    skeletonSoft: 'rgba(255,255,255,0.08)',
    skeletonPillBg: 'rgba(15,23,42,0.55)',
    skeletonPillBar: 'rgba(199,210,254,0.16)',
  };
}

export function createTrainerActivityStatusStyles(primary: string) {
  return {
    awaiting_payment: { bg: 'rgba(250,204,21,0.15)', text: '#FACC15', label: 'Awaiting payment' },
    paid: { bg: 'rgba(52,211,153,0.18)', text: '#34D399', label: 'Paid' },
    paid_out: { bg: 'rgba(96,165,250,0.18)', text: primary, label: 'Paid out' },
    cancelled: { bg: 'rgba(248,113,113,0.15)', text: '#F87171', label: 'Cancelled' },
  };
}

export function createTrainerOfferStatusStyles(primary: string) {
  return {
    draft: { bg: 'rgba(250,204,21,0.15)', border: 'rgba(250,204,21,0.3)', text: '#FACC15', label: 'Draft' },
    in_review: { bg: 'rgba(96,165,250,0.2)', border: 'rgba(96,165,250,0.34)', text: primary, label: 'In review' },
    published: { bg: 'rgba(52,211,153,0.18)', border: 'rgba(52,211,153,0.35)', text: '#34D399', label: 'Published' },
    archived: { bg: 'rgba(248,113,113,0.16)', border: 'rgba(248,113,113,0.32)', text: '#F87171', label: 'Archived' },
  };
}
