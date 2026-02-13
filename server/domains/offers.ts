import type { BundleDraft } from "../db";

export type OfferType = "one_off_session" | "multi_session_package" | "product_bundle";
export type OfferPaymentType = "one_off" | "recurring";
export type OfferStatus = "draft" | "in_review" | "published" | "archived";

export type Offer = {
  id: string;
  title: string;
  description: string | null;
  type: OfferType;
  priceMinor: number;
  currency: "GBP";
  included: string[];
  sessionCount: number | null;
  paymentType: OfferPaymentType;
  status: OfferStatus;
  legacyBundleId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateOfferInput = {
  title: string;
  description?: string;
  type: OfferType;
  priceMinor: number;
  included?: string[];
  sessionCount?: number;
  paymentType: OfferPaymentType;
  publish?: boolean;
};

function normalizeIncluded(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as { name?: unknown; title?: unknown };
        if (typeof record.name === "string") return record.name.trim();
        if (typeof record.title === "string") return record.title.trim();
      }
      return "";
    })
    .filter((item) => item.length > 0);
}

function resolveOfferType(bundle: BundleDraft): OfferType {
  const goals = bundle.goalsJson as { offerType?: unknown } | null;
  const explicit = typeof goals?.offerType === "string" ? goals.offerType : "";
  if (explicit === "one_off_session" || explicit === "multi_session_package" || explicit === "product_bundle") {
    return explicit;
  }

  const hasProducts = Array.isArray(bundle.productsJson) && bundle.productsJson.length > 0;
  const hasServices = Array.isArray(bundle.servicesJson) && bundle.servicesJson.length > 0;
  if (hasProducts && !hasServices) return "product_bundle";
  if (hasServices && !hasProducts) return "one_off_session";
  return "multi_session_package";
}

function resolvePaymentType(bundle: BundleDraft): OfferPaymentType {
  return bundle.cadence === "weekly" || bundle.cadence === "monthly" ? "recurring" : "one_off";
}

function resolveOfferStatus(bundle: BundleDraft): OfferStatus {
  if (bundle.status === "published") return "published";
  if (bundle.status === "pending_review" || bundle.status === "publishing") return "in_review";
  if (bundle.status === "failed" || bundle.status === "rejected") return "archived";
  return "draft";
}

export function mapBundleToOffer(bundle: BundleDraft): Offer {
  const services = normalizeIncluded(bundle.servicesJson);
  const products = Array.isArray(bundle.productsJson)
    ? (bundle.productsJson as Array<{ name?: unknown; title?: unknown }>).map((item) => {
        if (typeof item?.name === "string") return item.name.trim();
        if (typeof item?.title === "string") return item.title.trim();
        return "";
      })
    : [];
  const included = [...services, ...products].filter((item) => item.length > 0);

  const goals =
    bundle.goalsJson && typeof bundle.goalsJson === "object"
      ? (bundle.goalsJson as Record<string, unknown>)
      : {};
  const sessionsFromGoalsRaw = Number(goals.sessionCount ?? 0);
  const sessionsFromGoals =
    Number.isFinite(sessionsFromGoalsRaw) && sessionsFromGoalsRaw > 0
      ? Math.floor(sessionsFromGoalsRaw)
      : 0;
  const sessionsFromServices = Array.isArray(bundle.servicesJson)
    ? (bundle.servicesJson as Array<{ sessions?: unknown }>)
        .reduce((sum, item) => {
          const raw = Number(item?.sessions ?? 0);
          return Number.isFinite(raw) && raw > 0 ? sum + Math.floor(raw) : sum;
        }, 0)
    : 0;
  const resolvedOfferType = resolveOfferType(bundle);
  const sessionCount =
    resolvedOfferType === "multi_session_package"
      ? (sessionsFromGoals || sessionsFromServices || null)
      : null;

  return {
    id: bundle.id,
    title: bundle.title || "Offer",
    description: bundle.description || null,
    type: resolvedOfferType,
    priceMinor: Math.round((parseFloat(bundle.price || "0") || 0) * 100),
    currency: "GBP",
    included,
    sessionCount,
    paymentType: resolvePaymentType(bundle),
    status: resolveOfferStatus(bundle),
    legacyBundleId: bundle.id,
    createdAt: bundle.createdAt,
    updatedAt: bundle.updatedAt,
  };
}

export function mapOfferInputToBundleDraft(input: CreateOfferInput) {
  const cadence = input.paymentType === "recurring" ? "monthly" : "one_time";
  const included = (input.included || []).map((value) => value.trim()).filter((value) => value.length > 0);

  const requestedSessionCountRaw = Number(input.sessionCount ?? 0);
  const requestedSessionCount =
    Number.isFinite(requestedSessionCountRaw) && requestedSessionCountRaw > 0
      ? Math.floor(requestedSessionCountRaw)
      : 0;
  const normalizedSessionCount =
    input.type === "multi_session_package"
      ? (requestedSessionCount || Math.max(1, included.length || 1))
      : null;

  return {
    title: input.title,
    description: input.description,
    price: (input.priceMinor / 100).toFixed(2),
    cadence,
    servicesJson:
      input.type === "product_bundle"
        ? []
        : included.map((name) => ({
            name,
            sessions: 1,
          })),
    productsJson:
      input.type === "product_bundle"
        ? included.map((name) => ({
            name,
            price: "0.00",
          }))
        : [],
    goalsJson: {
      offerType: input.type,
      ...(normalizedSessionCount ? { sessionCount: normalizedSessionCount } : {}),
    },
    status: input.publish ? "published" : "draft",
  };
}
