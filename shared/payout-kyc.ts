export const PAYOUT_KYC_ACCOUNT_HOLDER_TYPES = [
  "organization",
  "individual",
] as const;

export type PayoutKycAccountHolderType =
  (typeof PAYOUT_KYC_ACCOUNT_HOLDER_TYPES)[number];

export const PAYOUT_KYC_STATUSES = [
  "start_setup",
  "details_submitted",
  "verification_required",
  "under_review",
  "more_information_required",
  "active",
  "verification_failed",
  "account_rejected",
  // Legacy compatibility values kept so older rows still render safely.
  "not_started",
  "submitted",
  "kyc_link_sent",
  "kyc_in_progress",
  "approved",
  "additional_info_required",
  "rejected",
] as const;

export type PayoutKycStatus = (typeof PAYOUT_KYC_STATUSES)[number];

export const PAYOUT_KYC_STATUS_LABELS: Record<PayoutKycStatus, string> = {
  start_setup: "Start setup",
  details_submitted: "Details submitted",
  verification_required: "Verification required",
  under_review: "Under review",
  more_information_required: "More information required",
  active: "Active",
  verification_failed: "Verification failed",
  account_rejected: "Account rejected",
  not_started: "Start setup",
  submitted: "Details submitted",
  kyc_link_sent: "Verification required",
  kyc_in_progress: "Verification required",
  approved: "Active",
  additional_info_required: "More information required",
  rejected: "Verification failed",
};

export const PAYOUT_KYC_STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "start_setup", label: "Start setup" },
  { value: "details_submitted", label: "Details submitted" },
  { value: "verification_required", label: "Verification required" },
  { value: "under_review", label: "Under review" },
  { value: "more_information_required", label: "More information required" },
  { value: "active", label: "Active" },
  { value: "verification_failed", label: "Verification failed" },
  { value: "account_rejected", label: "Account rejected" },
] as const;

export const PAYOUT_KYC_WORKFLOW_STATUSES = [
  "start_setup",
  "details_submitted",
  "verification_required",
  "under_review",
  "more_information_required",
  "active",
  "verification_failed",
  "account_rejected",
] as const;

export function normalizePayoutKycStatus(
  value: string | null | undefined,
): PayoutKycStatus {
  switch (String(value || "").trim()) {
    case "not_started":
      return "start_setup";
    case "submitted":
      return "details_submitted";
    case "kyc_link_sent":
    case "kyc_in_progress":
      return "verification_required";
    case "approved":
      return "active";
    case "additional_info_required":
      return "more_information_required";
    case "rejected":
      return "verification_failed";
    default:
      return (String(value || "").trim() || "start_setup") as PayoutKycStatus;
  }
}

export function getPayoutKycStatusLabel(
  value: string | null | undefined,
): string {
  const normalized = normalizePayoutKycStatus(value);
  return PAYOUT_KYC_STATUS_LABELS[normalized] || "Start setup";
}

export function isPayoutKycPaymentEnabled(
  value: string | null | undefined,
): boolean {
  return normalizePayoutKycStatus(value) === "active";
}

export function canEditPayoutKycIntake(
  value: string | null | undefined,
): boolean {
  const normalized = normalizePayoutKycStatus(value);
  return (
    normalized === "start_setup" ||
    normalized === "details_submitted" ||
    normalized === "more_information_required" ||
    normalized === "verification_failed"
  );
}

export function getPayoutKycTrainerMessage(
  value: string | null | undefined,
): string {
  const normalized = normalizePayoutKycStatus(value);
  switch (normalized) {
    case "details_submitted":
      return "Your details have been submitted. Bright.Blue will create your Adyen request manually.";
    case "verification_required":
      return "Verification is required. Complete the secure Adyen KYC step once Bright.Blue sends your verification link.";
    case "under_review":
      return "Adyen is reviewing the submitted information and documents.";
    case "more_information_required":
      return "Adyen needs more information before your payout setup can continue.";
    case "active":
      return "Your payout account is active and ready to use.";
    case "verification_failed":
      return "Verification failed because the submitted documents or details were not accepted. Please update and retry.";
    case "account_rejected":
      return "The onboarding request was rejected for compliance reasons. Please contact Bright.Blue support.";
    case "start_setup":
    default:
      return "Start setup by completing the onboarding form so Bright.Blue can begin your payout application.";
  }
}

export const PAYOUT_KYC_TRACKER_STEPS = [
  { id: "start_setup", label: "Start setup" },
  { id: "details_submitted", label: "Details submitted" },
  { id: "verification_required", label: "Verification required" },
  { id: "under_review", label: "Under review" },
  { id: "more_information_required", label: "More information required" },
  { id: "active", label: "Active" },
  { id: "verification_failed", label: "Verification failed" },
  { id: "account_rejected", label: "Account rejected" },
] as const;

type TrackerState = "completed" | "current" | "inactive";

export function getPayoutKycTrackerState(
  value: string | null | undefined,
  stepId: (typeof PAYOUT_KYC_TRACKER_STEPS)[number]["id"],
): TrackerState {
  const normalized = normalizePayoutKycStatus(value);
  const completedByStatus: Record<string, string[]> = {
    start_setup: [],
    details_submitted: ["start_setup"],
    verification_required: ["start_setup", "details_submitted"],
    under_review: ["start_setup", "details_submitted", "verification_required"],
    more_information_required: [
      "start_setup",
      "details_submitted",
      "verification_required",
      "under_review",
    ],
    active: [
      "start_setup",
      "details_submitted",
      "verification_required",
      "under_review",
    ],
    verification_failed: [
      "start_setup",
      "details_submitted",
      "verification_required",
      "under_review",
    ],
    account_rejected: [
      "start_setup",
      "details_submitted",
      "verification_required",
      "under_review",
    ],
  };
  if (normalized === stepId) return "current";
  if ((completedByStatus[normalized] || []).includes(stepId)) return "completed";
  return "inactive";
}
