import { getApiBaseUrl } from "@/lib/api-config";

export function normalizeAssetUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

export function getOfferFallbackImageUrl(title: unknown): string {
  const safeTitle = encodeURIComponent(
    String(title || "Offer").trim() || "Offer"
  );
  return `https://ui-avatars.com/api/?name=${safeTitle}&background=1f2937&color=93c5fd&size=256&rounded=false&bold=true`;
}
