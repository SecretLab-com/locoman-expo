import type { BundleOfferStatus } from '@/shared/bundle-offer';

export type StatusColorKey = 'success' | 'warning' | 'primary' | 'error';

export const BUNDLE_OFFER_STATUS_META: Record<
  BundleOfferStatus,
  { label: string; colorKey: StatusColorKey }
> = {
  draft: { label: 'Draft', colorKey: 'warning' },
  in_review: { label: 'In review', colorKey: 'primary' },
  published: { label: 'Published', colorKey: 'success' },
  archived: { label: 'Archived', colorKey: 'error' },
};

export function createBundleOfferStatusStyles(primary: string) {
  return {
    draft: {
      bg: 'rgba(250,204,21,0.15)',
      border: 'rgba(250,204,21,0.3)',
      text: '#FACC15',
      label: BUNDLE_OFFER_STATUS_META.draft.label,
    },
    in_review: {
      bg: 'rgba(96,165,250,0.2)',
      border: 'rgba(96,165,250,0.34)',
      text: primary,
      label: BUNDLE_OFFER_STATUS_META.in_review.label,
    },
    published: {
      bg: 'rgba(52,211,153,0.18)',
      border: 'rgba(52,211,153,0.35)',
      text: '#34D399',
      label: BUNDLE_OFFER_STATUS_META.published.label,
    },
    archived: {
      bg: 'rgba(248,113,113,0.16)',
      border: 'rgba(248,113,113,0.32)',
      text: '#F87171',
      label: BUNDLE_OFFER_STATUS_META.archived.label,
    },
  };
}
