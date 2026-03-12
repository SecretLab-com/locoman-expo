export type BundleOfferType =
  | 'one_off_session'
  | 'multi_session_package'
  | 'product_bundle';

export type BundleOfferPaymentType = 'one_off' | 'recurring';

export type BundleOfferStatus = 'draft' | 'in_review' | 'published' | 'archived';

export type BundleOfferView = {
  id: string;
  legacyBundleId: string;
  templateId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  type: BundleOfferType;
  priceMinor: number;
  currency: 'GBP';
  included: string[];
  sessionCount: number | null;
  paymentType: BundleOfferPaymentType;
  status: BundleOfferStatus;
  productsJson: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
};

type BundleLike = {
  id: string;
  templateId?: string | null;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  price?: string | number | null;
  cadence?: string | null;
  servicesJson?: unknown;
  productsJson?: unknown;
  goalsJson?: unknown;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeIncluded(values: unknown): string[] {
  return toArray<Record<string, unknown> | string>(values)
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const candidate = record.name ?? record.title ?? record.label;
        return typeof candidate === 'string' ? candidate.trim() : '';
      }
      return '';
    })
    .filter((item) => item.length > 0);
}

function resolveBundleOfferType(bundle: BundleLike): BundleOfferType {
  const goals =
    bundle.goalsJson && typeof bundle.goalsJson === 'object'
      ? (bundle.goalsJson as Record<string, unknown>)
      : {};
  const explicit = typeof goals.offerType === 'string' ? goals.offerType : '';
  if (
    explicit === 'one_off_session' ||
    explicit === 'multi_session_package' ||
    explicit === 'product_bundle'
  ) {
    return explicit;
  }

  const hasProducts = toArray(bundle.productsJson).length > 0;
  const hasServices = toArray(bundle.servicesJson).length > 0;
  if (hasProducts && !hasServices) return 'product_bundle';
  if (hasServices && !hasProducts) return 'one_off_session';
  return 'multi_session_package';
}

function resolveBundleOfferPaymentType(bundle: BundleLike): BundleOfferPaymentType {
  return bundle.cadence === 'weekly' || bundle.cadence === 'monthly'
    ? 'recurring'
    : 'one_off';
}

function resolveBundleOfferStatus(bundle: BundleLike): BundleOfferStatus {
  if (bundle.status === 'published') return 'published';
  if (bundle.status === 'pending_review' || bundle.status === 'publishing') {
    return 'in_review';
  }
  if (bundle.status === 'failed' || bundle.status === 'rejected' || bundle.status === 'archived') {
    return 'archived';
  }
  return 'draft';
}

function resolveSessionCount(bundle: BundleLike, type: BundleOfferType): number | null {
  if (type !== 'multi_session_package') return null;

  const goals =
    bundle.goalsJson && typeof bundle.goalsJson === 'object'
      ? (bundle.goalsJson as Record<string, unknown>)
      : {};
  const sessionsFromGoalsRaw = Number(goals.sessionCount ?? 0);
  const sessionsFromGoals =
    Number.isFinite(sessionsFromGoalsRaw) && sessionsFromGoalsRaw > 0
      ? Math.floor(sessionsFromGoalsRaw)
      : 0;

  const sessionsFromServices = toArray<Record<string, unknown>>(bundle.servicesJson).reduce(
    (sum, item) => {
      const raw = Number(item.sessions ?? item.quantity ?? item.count ?? 0);
      return Number.isFinite(raw) && raw > 0 ? sum + Math.floor(raw) : sum;
    },
    0,
  );

  return sessionsFromGoals || sessionsFromServices || null;
}

export function mapBundleDraftToOfferView(bundle: BundleLike): BundleOfferView {
  const type = resolveBundleOfferType(bundle);
  const services = normalizeIncluded(bundle.servicesJson);
  const products = normalizeIncluded(bundle.productsJson);
  const productsJson = toArray<Record<string, unknown>>(bundle.productsJson);

  return {
    id: bundle.id,
    legacyBundleId: bundle.id,
    templateId: bundle.templateId ?? null,
    title: bundle.title || 'Offer',
    description: bundle.description || null,
    imageUrl: bundle.imageUrl || null,
    type,
    priceMinor: Math.round((Number.parseFloat(String(bundle.price || '0')) || 0) * 100),
    currency: 'GBP',
    included: [...services, ...products],
    sessionCount: resolveSessionCount(bundle, type),
    paymentType: resolveBundleOfferPaymentType(bundle),
    status: resolveBundleOfferStatus(bundle),
    productsJson,
    createdAt: String(bundle.createdAt || ''),
    updatedAt: String(bundle.updatedAt || ''),
  };
}
