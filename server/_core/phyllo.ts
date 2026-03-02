import { ENV } from "./env";

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
