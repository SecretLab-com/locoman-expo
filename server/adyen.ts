/**
 * Adyen Payment Service
 *
 * Uses the official @adyen/api-library SDK per the ADYEN_DIRECTIONS.md spec.
 * Handles payment session creation, payment links, and webhook verification.
 */
import * as adyenLib from "@adyen/api-library";
const CheckoutAPI = (adyenLib as any).CheckoutAPI || (adyenLib as any).default?.CheckoutAPI;
const Client = (adyenLib as any).Client || (adyenLib as any).default?.Client;
import crypto from "crypto";

type AdyenEnvironment = "test" | "TEST" | "LIVE" | "live-us" | "live-au" | "live-apse" | "live-in";

const ADYEN_API_KEY = process.env.ADYEN_API_KEY || "";
const ADYEN_MERCHANT_ACCOUNT = process.env.ADYEN_MERCHANT_ACCOUNT || "";
const ADYEN_ENVIRONMENT = (process.env.ADYEN_ENVIRONMENT || "test") as AdyenEnvironment;
const ADYEN_WEBHOOK_HMAC = process.env.ADYEN_WEBHOOK_HMAC || "";
const ADYEN_CLIENT_KEY = process.env.ADYEN_CLIENT_SECRET || "";
const ADYEN_STORE = process.env.ADYEN_STORE || "";
const ADYEN_LIVE_PREFIX = process.env.ADYEN_LIVE_ENDPOINT_URL_PREFIX || "";

const RETURN_URL =
  process.env.WEBHOOK_BASE_URL || "https://locoman-backend-870100645593.us-central1.run.app";

console.log("[Adyen] Config:", {
  merchantAccount: ADYEN_MERCHANT_ACCOUNT,
  environment: ADYEN_ENVIRONMENT,
  store: ADYEN_STORE || "(none)",
  hasApiKey: Boolean(ADYEN_API_KEY),
  hasClientKey: Boolean(ADYEN_CLIENT_KEY),
});

// ============================================================================
// SINGLETON CLIENT (Adyen docs recommend reusing)
// ============================================================================

let _client: InstanceType<typeof Client> | undefined;

function getClient(): InstanceType<typeof Client> {
  if (!_client) {
    if (!ADYEN_API_KEY) throw new Error("ADYEN_API_KEY is not configured");

    const config: any = {
      apiKey: ADYEN_API_KEY,
      environment: ADYEN_ENVIRONMENT,
    };

    if (ADYEN_ENVIRONMENT === "LIVE" && ADYEN_LIVE_PREFIX) {
      config.liveEndpointUrlPrefix = ADYEN_LIVE_PREFIX;
    }

    _client = new Client(config);
  }
  return _client;
}

function getCheckout(): InstanceType<typeof CheckoutAPI> {
  return new CheckoutAPI(getClient());
}

// ============================================================================
// PAYMENT SESSIONS
// ============================================================================

export interface CreateSessionOptions {
  amountMinor: number;
  currency?: string;
  merchantReference: string;
  shopperEmail?: string;
  returnUrl?: string;
  channel?: string;
  shopperReference?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    amountIncludingTax: number;
  }>;
}

export async function createCheckoutSession(
  options: CreateSessionOptions,
): Promise<any> {
  const checkout = getCheckout();

  const request: any = {
    amount: {
      value: options.amountMinor,
      currency: options.currency || "GBP",
    },
    reference: options.merchantReference,
    returnUrl: options.returnUrl || `${RETURN_URL}/api/payments/redirect`,
    merchantAccount: ADYEN_MERCHANT_ACCOUNT,
    countryCode: "GB",
    channel: options.channel || "Web",
    shopperLocale: "en-GB",
    shopperEmail: options.shopperEmail,
    shopperReference: options.shopperReference,
    ...(ADYEN_STORE && { store: ADYEN_STORE }),
    ...(options.lineItems && { lineItems: options.lineItems }),
  };

  return checkout.PaymentsApi.sessions(request);
}

// ============================================================================
// PAYMENT LINKS
// ============================================================================

export interface CreatePaymentLinkOptions {
  amountMinor: number;
  currency?: string;
  merchantReference: string;
  description?: string;
  shopperEmail?: string;
  expiresInMinutes?: number;
}

export async function createPaymentLink(
  options: CreatePaymentLinkOptions,
): Promise<any> {
  const checkout = getCheckout();

  const expiresAt = new Date(
    Date.now() + (options.expiresInMinutes || 60) * 60 * 1000,
  ).toISOString();

  const request: any = {
    amount: {
      value: options.amountMinor,
      currency: options.currency || "GBP",
    },
    reference: options.merchantReference,
    description: options.description || "Payment",
    merchantAccount: ADYEN_MERCHANT_ACCOUNT,
    countryCode: "GB",
    shopperLocale: "en-GB",
    shopperEmail: options.shopperEmail,
    expiresAt: new Date(expiresAt),
    ...(ADYEN_STORE && { store: ADYEN_STORE }),
  };

  return checkout.PaymentLinksApi.paymentLinks(request);
}

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

export function verifyAdyenWebhook(
  payload: Record<string, unknown>,
  hmacSignature: string,
): boolean {
  if (!ADYEN_WEBHOOK_HMAC) {
    console.warn("[Adyen] No HMAC key configured, rejecting webhook");
    return false;
  }

  const notification = payload as any;
  const signingString = [
    notification.pspReference || "",
    notification.originalReference || "",
    notification.merchantAccountCode || "",
    notification.merchantReference || "",
    notification.amount?.value?.toString() || "",
    notification.amount?.currency || "",
    notification.eventCode || "",
    notification.success || "",
  ].join(":");

  const hmacKey = Buffer.from(ADYEN_WEBHOOK_HMAC, "hex");
  const computed = crypto
    .createHmac("sha256", hmacKey)
    .update(signingString)
    .digest("base64");

  return computed === hmacSignature;
}

// ============================================================================
// UTILITIES
// ============================================================================

export function generateMerchantReference(prefix = "PAY"): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

export function formatAmount(amountMinor: number, currency = "GBP"): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(major);
}

export function isAdyenConfigured(): boolean {
  return Boolean(ADYEN_API_KEY && ADYEN_MERCHANT_ACCOUNT);
}

export function getClientKey(): string {
  return ADYEN_CLIENT_KEY;
}

export function getEnvironment(): string {
  return ADYEN_ENVIRONMENT;
}

const ADYEN_ONBOARDING_URL = process.env.ADYEN_ONBOARDING_URL || "";

export function getOnboardingUrl(): string {
  if (ADYEN_ONBOARDING_URL) return ADYEN_ONBOARDING_URL;
  return ADYEN_ENVIRONMENT === "LIVE"
    ? "https://ca-live.adyen.com/ca/ca/overview/default.shtml"
    : "https://ca-test.adyen.com/ca/ca/overview/default.shtml";
}
