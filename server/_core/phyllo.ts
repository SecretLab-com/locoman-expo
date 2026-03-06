import { ENV } from "./env";
import { createHmac, timingSafeEqual } from "crypto";

type PhylloUserResponse = {
  id: string;
  name?: string;
  external_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type PhylloSdkTokenResponse = {
  sdk_token: string;
  expires_at: string;
};

export type PhylloSdkTokenClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  user_id?: string;
};

function ensurePhylloConfigured() {
  if (!ENV.phylloAuthBasic) {
    throw new Error("PHYLLO_AUTH_BASIC is required for Phyllo API calls");
  }
}

function toBaseUrl() {
  return String(ENV.phylloApiBaseUrl || "https://api.staging.getphyllo.com").replace(
    /\/+$/g,
    "",
  );
}

async function phylloRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, any>;
  } = {},
): Promise<T> {
  ensurePhylloConfigured();
  const response = await fetch(`${toBaseUrl()}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Basic ${ENV.phylloAuthBasic}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Phyllo request failed (${response.status}): ${text}`);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function createPhylloUser(input: {
  name: string;
  externalId: string;
}): Promise<PhylloUserResponse> {
  return phylloRequest<PhylloUserResponse>("/v1/users", {
    method: "POST",
    body: {
      name: input.name,
      external_id: input.externalId,
    },
  });
}

export async function createPhylloSdkToken(input: {
  userId: string;
  products?: string[];
}): Promise<PhylloSdkTokenResponse> {
  return phylloRequest<PhylloSdkTokenResponse>("/v1/sdk-tokens", {
    method: "POST",
    body: {
      user_id: input.userId,
      products:
        input.products && input.products.length > 0
          ? input.products
          : [
              "IDENTITY",
              "IDENTITY.AUDIENCE",
              "ENGAGEMENT",
              "ENGAGEMENT.AUDIENCE",
              "INCOME",
              "ACTIVITY",
            ],
    },
  });
}

export async function getPhylloAccounts(userId: string) {
  const params = new URLSearchParams({ user_id: userId });
  return phylloRequest<any[]>(`/v1/accounts?${params.toString()}`);
}

export async function getPhylloProfiles(userId: string) {
  const params = new URLSearchParams({ user_id: userId });
  return phylloRequest<any[]>(`/v1/profiles?${params.toString()}`);
}

export function getBootstrapPhylloUserFromEnv() {
  if (!ENV.phylloId) return null;
  return {
    id: ENV.phylloId,
    name: ENV.phylloName || "Trainer",
    externalId: ENV.phylloExternalId || null,
  };
}

export function getBootstrapSdkTokenFromEnv() {
  if (!ENV.phylloSdkToken) return null;
  return {
    sdkToken: ENV.phylloSdkToken,
    expiresAt: ENV.phylloSdkTokenExpiresAt || null,
  };
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4 || 4)) % 4;
  const padded = `${normalized}${"=".repeat(paddingLength)}`;
  return Buffer.from(padded, "base64").toString("utf8");
}

export function decodePhylloSdkTokenClaims(token: string): PhylloSdkTokenClaims | null {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const payload = decodeBase64Url(parts[1]);
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as PhylloSdkTokenClaims;
  } catch {
    return null;
  }
}

export function inferPhylloTokenEnvironment(
  claims: PhylloSdkTokenClaims | null,
): "sandbox" | "staging" | "production" | "unknown" {
  if (!claims) return "unknown";
  const targets = [
    ...(Array.isArray(claims.aud) ? claims.aud : [claims.aud]),
    claims.iss,
  ]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean)
    .join(" ");
  if (!targets) return "unknown";
  if (targets.includes("staging")) return "staging";
  if (targets.includes("sandbox")) return "sandbox";
  if (targets.includes("api.getphyllo.com")) return "production";
  return "unknown";
}

export type PhylloWebhookEvent = {
  providerEventId: string;
  eventType: string;
  occurredAt: string | null;
  phylloUserId: string | null;
  phylloAccountId: string | null;
  payload: any;
};

function normalizePhylloHeaderSignature(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes(",")) {
    const parts = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    for (const part of parts) {
      const [k, v] = part.split("=");
      if (String(k || "").trim().toLowerCase() === "sha256" && v) {
        return String(v).trim();
      }
    }
  }
  if (raw.toLowerCase().startsWith("sha256=")) {
    return raw.slice("sha256=".length).trim();
  }
  return raw;
}

export function verifyPhylloWebhookSignature(params: {
  rawBody: Buffer;
  signatureHeader: string;
  secret: string;
}): boolean {
  const secret = String(params.secret || "").trim();
  if (!secret) return false;
  const incoming = normalizePhylloHeaderSignature(params.signatureHeader);
  if (!incoming) return false;
  const expected = createHmac("sha256", secret)
    .update(params.rawBody)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(incoming, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

function normalizeWebhookEventType(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/_/g, ".");
}

function resolveWebhookPayloadRow(row: any) {
  if (!row || typeof row !== "object") return {};
  if (row.payload && typeof row.payload === "object") return row.payload;
  if (row.data && typeof row.data === "object") return row.data;
  return row;
}

export function normalizePhylloWebhookEvents(payload: any): PhylloWebhookEvent[] {
  const root = payload && typeof payload === "object" ? payload : {};
  const rows = Array.isArray(root.events)
    ? root.events
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(root.items)
        ? root.items
        : [root];
  return rows
    .map((row: any, index: number): PhylloWebhookEvent | null => {
      const body = resolveWebhookPayloadRow(row);
      const eventType = normalizeWebhookEventType(
        row?.event_type || row?.event || row?.type || body?.event_type || body?.event || body?.type,
      );
      const providerEventId = String(
        row?.id ||
          row?.event_id ||
          row?.webhook_id ||
          body?.id ||
          body?.event_id ||
          body?.webhook_id ||
          `${eventType || "phyllo.event"}:${Date.now()}:${index}`,
      ).trim();
      const occurredAtRaw =
        row?.created_at ||
        row?.occurred_at ||
        row?.timestamp ||
        body?.created_at ||
        body?.occurred_at ||
        body?.timestamp ||
        null;
      const occurredAt = occurredAtRaw ? new Date(occurredAtRaw).toISOString() : null;
      const phylloUserId = String(
        row?.user_id || body?.user_id || body?.user?.id || "",
      ).trim();
      const phylloAccountId = String(
        row?.account_id || body?.account_id || body?.account?.id || "",
      ).trim();
      return {
        providerEventId,
        eventType: eventType || "phyllo.unknown",
        occurredAt,
        phylloUserId: phylloUserId || null,
        phylloAccountId: phylloAccountId || null,
        payload: row,
      };
    })
    .filter(
      (event: PhylloWebhookEvent | null): event is PhylloWebhookEvent =>
        Boolean(event?.providerEventId),
    );
}
