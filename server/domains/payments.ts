import type { PaymentSession } from "../db";

export type PaymentViewState = "awaiting_payment" | "paid" | "paid_out" | "cancelled";

const RAW_TO_VIEW_STATE: Record<string, PaymentViewState> = {
  created: "awaiting_payment",
  pending: "awaiting_payment",
  authorised: "paid",
  captured: "paid",
  refused: "awaiting_payment",
  cancelled: "cancelled",
  error: "awaiting_payment",
  refunded: "awaiting_payment",
  paid_out: "paid_out",
};

export function mapPaymentState(rawStatus: string | null | undefined): PaymentViewState {
  const normalized = (rawStatus || "").toLowerCase();
  return RAW_TO_VIEW_STATE[normalized] || "awaiting_payment";
}

export function mapPaymentSessionForView(session: PaymentSession) {
  return {
    ...session,
    rawStatus: session.status,
    status: mapPaymentState(session.status),
  };
}

export function summarizePaymentSessions(sessions: PaymentSession[]) {
  let awaitingPayment = 0;
  let paid = 0;
  let paidOut = 0;
  let cancelled = 0;
  let totalPaidMinor = 0;

  for (const session of sessions) {
    const viewStatus = mapPaymentState(session.status);
    if (viewStatus === "awaiting_payment") awaitingPayment += 1;
    if (viewStatus === "paid") {
      paid += 1;
      totalPaidMinor += session.amountMinor || 0;
    }
    if (viewStatus === "paid_out") paidOut += 1;
    if (viewStatus === "cancelled") cancelled += 1;
  }

  return {
    total: sessions.length,
    awaitingPayment,
    paid,
    paidOut,
    cancelled,
    totalPaidMinor,
  };
}

