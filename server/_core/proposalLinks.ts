/**
 * Deep links for trainer saved-cart / custom plan proposals.
 * Uses EXPO_PUBLIC_APP_URL (web app origin). If unset, returns empty string.
 */
export function getTrainerProposalDeepLink(proposalId: string): string {
  const raw = (process.env.EXPO_PUBLIC_APP_URL || "").trim().replace(/\/+$/g, "");
  if (!raw) return "";
  return `${raw}/cart?proposalId=${encodeURIComponent(proposalId)}`;
}
