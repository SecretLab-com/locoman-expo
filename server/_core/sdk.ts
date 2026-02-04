import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import { ForbiddenError } from "../../shared/_core/errors.js";
import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import * as db from "../db";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/portalTypes";
// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const DEV_TEST_USERS = new Map<
  string,
  { name: string; email: string; role: User["role"] }
>([
  [
    "test_user_coordinator",
    { name: "Test User", email: "testuser@secretlab.com", role: "coordinator" },
  ],
  [
    "test_trainer_account",
    { name: "Test Trainer", email: "trainer@secretlab.com", role: "trainer" },
  ],
  ["test_client_account", { name: "Test Client", email: "client@secretlab.com", role: "client" }],
  [
    "test_manager_account",
    { name: "Test Manager", email: "manager@secretlab.com", role: "manager" },
  ],
  [
    "test_coordinator_account",
    {
      name: "Test Coordinator",
      email: "coordinator@secretlab.com",
      role: "coordinator",
    },
  ],
]);

const buildDevUser = (openId: string): User | null => {
  const devUser = DEV_TEST_USERS.get(openId);
  if (!devUser) return null;
  const now = new Date();
  return {
    id: 0,
    openId,
    name: devUser.name,
    email: devUser.email,
    phone: null,
    photoUrl: null,
    loginMethod: "email",
    role: devUser.role,
    username: null,
    bio: null,
    specialties: null,
    socialLinks: null,
    trainerId: null,
    active: true,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    passwordHash: null,
  };
};

const buildSessionUser = (session: { openId: string; name: string }): User => {
  const devUser = buildDevUser(session.openId);
  if (devUser) return devUser;
  const now = new Date();
  return {
    id: 0,
    openId: session.openId,
    name: session.name || "User",
    email: null,
    phone: null,
    photoUrl: null,
    loginMethod: "email",
    role: "shopper",
    username: null,
    bio: null,
    specialties: null,
    socialLinks: null,
    trainerId: null,
    active: true,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    passwordHash: null,
  };
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  constructor(private client: ReturnType<typeof axios.create>) {
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl || "(disabled)");
    const portalUrl = (process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "").trim();
    if (!ENV.oAuthServerUrl && portalUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable.",
      );
    }
  }

  private decodeState(state: string): string {
    const redirectUri = atob(state);
    return redirectUri;
  }

  async getTokenByCode(code: string, state: string): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };

    const { data } = await this.client.post<ExchangeTokenResponse>(EXCHANGE_TOKEN_PATH, payload);

    return data;
  }

  async getUserInfoByToken(token: ExchangeTokenResponse): Promise<GetUserInfoResponse> {
    const { data } = await this.client.post<GetUserInfoResponse>(GET_USER_INFO_PATH, {
      accessToken: token.accessToken,
    });

    return data;
  }
}

const createOAuthHttpClient = (): AxiosInstance =>
  axios.create({
    baseURL: ENV.oAuthServerUrl,
    timeout: AXIOS_TIMEOUT_MS,
  });

class SDKServer {
  private readonly client: AxiosInstance;
  private readonly oauthService: OAuthService;

  constructor(client: AxiosInstance = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }

  private deriveLoginMethod(
    platforms: unknown,
    fallback: string | null | undefined,
  ): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(platforms.filter((p): p is string => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code: string, state: string): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  /**
   * Exchange Google OAuth code for token
   */
  async exchangeGoogleCodeForToken(code: string, redirectUri: string): Promise<any> {
    if (!ENV.googleClientId || !ENV.googleClientSecret) {
      throw new Error("Google OAuth credentials not configured on backend");
    }

    try {
      const { data } = await axios.post("https://oauth2.googleapis.com/token", {
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });

      return data;
    } catch (error: any) {
      console.error("[OAuth] Google token exchange failed:",
        error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get Google user info
   */
  async getGoogleUserInfo(accessToken: string): Promise<any> {
    const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return data;
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken,
    } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null,
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret && ENV.isProduction) {
      throw new Error("JWT_SECRET is required in production");
    }
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for a user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
      },
      options,
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
      };
    } catch (error) {
      const errorMessage = String(error);
      if (/JWSSignatureVerificationFailed|JWTExpired|JWTInvalid|JWSInvalid/i.test(errorMessage)) {
        return null;
      }
      console.warn("[Auth] Session verification failed", errorMessage);
      return null;
    }
  }

  async getUserInfoWithJwt(jwtToken: string): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = {
      jwtToken,
      projectId: ENV.appId,
    };

    const { data } = await this.client.post<GetUserInfoWithJwtResponse>(
      GET_USER_INFO_WITH_JWT_PATH,
      payload,
    );

    const loginMethod = this.deriveLoginMethod(
      (data as any)?.platforms,
      (data as any)?.platform ?? data.platform ?? null,
    );
    return {
      ...(data as any),
      platform: loginMethod,
      loginMethod,
    } as GetUserInfoWithJwtResponse;
  }

  async authenticateRequest(req: Request): Promise<User> {
    // Regular authentication flow
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token: string | undefined;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }

    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = token || cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    const dbInstance = await db.getDb();
    if (!dbInstance) {
      console.warn("[Auth] Database unavailable, using session-only user");
      return buildSessionUser({ openId: sessionUserId, name: session.name });
    }
    const devUser = !ENV.isProduction ? buildDevUser(sessionUserId) : null;
    let user = await db.getUserByOpenId(sessionUserId);

    // If user not in DB, sync from OAuth server automatically
    if (!user) {
      if (devUser) {
        return devUser;
      }
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    // Support impersonation for coordinators
    const impersonateHeader = req.headers["x-impersonate-user-id"] || req.headers["X-Impersonate-User-Id"];
    const impersonateUserId = typeof impersonateHeader === "string" ? parseInt(impersonateHeader) : undefined;

    if (impersonateUserId && user.role === "coordinator") {
      const impersonatedUser = await db.getUserById(impersonateUserId);
      if (impersonatedUser) {
        console.log(`[Auth] Coordinator ${user.id} impersonating user ${impersonatedUser.id}`);
        return impersonatedUser;
      }
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

export const sdk = new SDKServer();
