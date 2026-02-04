import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { getUserByOpenId, upsertUser } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { logError, logEvent, logWarn } from "./logger";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function syncUser(userInfo: {
  openId?: string | null;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  platform?: string | null;
  role?: "shopper" | "client" | "trainer" | "manager" | "coordinator" | null;
  trainerId?: number | null;
}) {
  if (!userInfo.openId) {
    throw new Error("openId missing from user info");
  }

  const lastSignedIn = new Date();
  await upsertUser({
    openId: userInfo.openId,
    name: userInfo.name || null,
    email: userInfo.email ?? null,
    loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
    lastSignedIn,
    role: userInfo.role ?? (userInfo.trainerId ? "client" : undefined),
    trainerId: userInfo.trainerId ?? undefined,
  });
  const saved = await getUserByOpenId(userInfo.openId);
  return (
    saved ?? {
      openId: userInfo.openId,
      name: userInfo.name,
      email: userInfo.email,
      loginMethod: userInfo.loginMethod ?? null,
      lastSignedIn,
    }
  );
}

function buildUserResponse(
  user:
    | Awaited<ReturnType<typeof getUserByOpenId>>
    | {
      openId: string;
      name?: string | null;
      email?: string | null;
      loginMethod?: string | null;
      lastSignedIn?: Date | null;
      role?: string | null;
    },
) {
  return {
    id: (user as any)?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    role: (user as any)?.role ?? "shopper",
    lastSignedIn: (user?.lastSignedIn ?? new Date()).toISOString(),
  };
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      logWarn("auth.oauth_callback_missing_params");
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      let userInfo: any;
      let sessionToken = "";
      let savedUser: any;

      let redirectUri: string | undefined;
      let trainerIdFromState: number | undefined;

      try {
        if (state) {
          const decoded = Buffer.from(state, "base64").toString("utf-8");
          console.log("[OAuth] Decoded state:", decoded);
          try {
            const parsed = JSON.parse(decoded);
            redirectUri = parsed.redirectUri;
            if (parsed.trainerId) {
              trainerIdFromState = parseInt(parsed.trainerId);
            }
          } catch {
            // Legacy state (just the redirect URI)
            redirectUri = decoded;
          }
        }
      } catch (err) {
        console.warn("[OAuth] Failed to decode state as base64:", err);
      }

      const portalUrl = (process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "").trim();
      const shouldUsePortal = Boolean(process.env.OAUTH_SERVER_URL) && portalUrl.length > 0;

      if (shouldUsePortal) {
        try {
          // Try Portal exchange first
          const tokenResponse = await sdk.exchangeCodeForToken(code, state);
          userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
          if (trainerIdFromState) userInfo.trainerId = trainerIdFromState;
          savedUser = await syncUser(userInfo);
          sessionToken = await sdk.createSessionToken(userInfo.openId!, {
            name: userInfo.name || "",
            expiresInMs: ONE_YEAR_MS,
          });
        } catch (portalError) {
          console.log(
            "[OAuth] Portal exchange failed, trying direct Google exchange...",
            (portalError as any)?.message,
          );
        }
      }

      if (!userInfo) {
        // Direct Google exchange
        // Use isSecureRequest from cookies.ts logic to handle Cloud Run HTTPS termination
        const isSecure = (req: Request) => {
          if (req.protocol === "https") return true;
          const forwardedProto = req.headers["x-forwarded-proto"];
          if (!forwardedProto) return false;
          const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
          return protoList.some((proto) => proto.trim().toLowerCase() === "https");
        };

        const protocol = isSecure(req) ? "https" : "http";
        const googleRedirectUri = `${protocol}://${req.get("host")}/api/oauth/callback`;
        console.log("[OAuth] Exchanging Google code with redirectUri:", googleRedirectUri);

        const googleToken = await sdk.exchangeGoogleCodeForToken(code, googleRedirectUri);
        const googleUser = await sdk.getGoogleUserInfo(googleToken.access_token);

        userInfo = {
          openId: `google_${googleUser.sub}`,
          name: googleUser.name,
          email: googleUser.email,
          loginMethod: "google",
        };
        if (trainerIdFromState) userInfo.trainerId = trainerIdFromState;
        savedUser = await syncUser(userInfo);
        sessionToken = await sdk.createSessionToken(userInfo.openId!, {
          name: userInfo.name || "",
          expiresInMs: ONE_YEAR_MS,
        });
      }

      if (!sessionToken) {
        throw new Error("OAuth session token missing after exchange");
      }

      logEvent("auth.oauth_callback_success", { openId: userInfo.openId, role: (savedUser as any)?.role });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      const frontendUrl =
        redirectUri ||
        process.env.EXPO_WEB_PREVIEW_URL ||
        process.env.EXPO_PACKAGER_PROXY_URL ||
        (process.env.NODE_ENV === "production"
          ? "https://locoman-web-870100645593.us-central1.run.app"
          : "http://localhost:8081");

      const userPayload = Buffer.from(
        JSON.stringify(buildUserResponse(savedUser)),
        "utf-8",
      ).toString("base64");
      const redirect = new URL(frontendUrl);
      redirect.searchParams.set("sessionToken", sessionToken);
      redirect.searchParams.set("user", userPayload);

      console.log("[OAuth] Redirecting to:", redirect.toString());
      res.redirect(302, redirect.toString());
    } catch (error: any) {
      const errorMessage = error?.response?.data
        ? JSON.stringify(error.response.data)
        : (error instanceof Error ? error.message : String(error));

      logError("auth.oauth_callback_failed", {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        error: "OAuth callback failed",
        details: process.env.NODE_ENV !== "production" ? errorMessage : undefined
      });
    }
  });

  app.get("/api/oauth/mobile", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      logWarn("auth.oauth_mobile_missing_params");
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      // Parse state for trainerId in mobile flow too
      try {
        const decoded = Buffer.from(state, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded);
        if (parsed.trainerId) {
          userInfo.trainerId = parseInt(parsed.trainerId);
        }
      } catch {
        // Ignore parsing errors for legacy states
      }

      const user = await syncUser(userInfo);

      const sessionToken = await sdk.createSessionToken(userInfo.openId!, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      logEvent("auth.oauth_mobile_success", { openId: userInfo.openId, role: (user as any)?.role });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({
        app_session_id: sessionToken,
        user: buildUserResponse(user),
      });
    } catch (error) {
      logError("auth.oauth_mobile_failed", error);
      res.status(500).json({ error: "OAuth mobile exchange failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    logEvent("auth.logout");
    res.json({ success: true });
  });

  // Get current authenticated user - works with both cookie (web) and Bearer token (mobile)
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      const hasBearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ");
      const hasCookie = typeof req.headers.cookie === "string" && req.headers.cookie.includes(COOKIE_NAME);

      if (!hasBearer && !hasCookie) {
        res.json({ user: null });
        return;
      }

      const user = await sdk.authenticateRequest(req);
      res.json({ user: buildUserResponse(user) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Invalid session cookie")) {
        const cookieOptions = getSessionCookieOptions(req);
        res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        res.json({ user: null });
        return;
      }
      logError("auth.me_failed", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  // Email/password login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Test user credentials - superuser (coordinator) role
      if ((email === "testuser@secretlab.com" || email === "jason@secretlab.com") && password === "supertest") {
        // Create a test user session with coordinator role
        const testOpenId = email === "jason@secretlab.com" ? "jason_secretlab_coordinator" : "test_user_coordinator";
        const testUser = {
          openId: testOpenId,
          name: email === "jason@secretlab.com" ? "Jason" : "Test User",
          email: email,
          loginMethod: "email",
          role: "coordinator" as const,
        };

        await syncUser(testUser);
        const sessionToken = await sdk.createSessionToken(testOpenId, {
          name: testUser.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        const savedUser = await getUserByOpenId(testOpenId);
        logEvent("auth.login_success", { role: "coordinator", method: "email" });
        res.json({ success: true, user: buildUserResponse(savedUser || testUser), sessionToken });
        return;
      }

      // Trainer test account - has trainer role for testing bundle creation
      if (email === "trainer@secretlab.com" && password === "supertest") {
        const trainerOpenId = "test_trainer_account";
        const trainerUser = {
          openId: trainerOpenId,
          name: "Test Trainer",
          email: email,
          loginMethod: "email",
          role: "trainer" as const,
        };

        await syncUser(trainerUser);
        const sessionToken = await sdk.createSessionToken(trainerOpenId, {
          name: trainerUser.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        const savedUser = await getUserByOpenId(trainerOpenId);
        logEvent("auth.login_success", { role: "trainer", method: "email" });
        res.json({ success: true, user: buildUserResponse(savedUser || trainerUser), sessionToken });
        return;
      }

      // Client test account - has client role for testing client features
      if (email === "client@secretlab.com" && password === "supertest") {
        const clientOpenId = "test_client_account";
        const clientUser = {
          openId: clientOpenId,
          name: "Test Client",
          email: email,
          loginMethod: "email",
          role: "client" as const,
        };

        await syncUser(clientUser);
        const sessionToken = await sdk.createSessionToken(clientOpenId, {
          name: clientUser.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        const savedUser = await getUserByOpenId(clientOpenId);
        logEvent("auth.login_success", { role: "client", method: "email" });
        res.json({ success: true, user: buildUserResponse(savedUser || clientUser), sessionToken });
        return;
      }

      // Manager test account - has manager role for testing admin features
      if (email === "manager@secretlab.com" && password === "supertest") {
        const managerOpenId = "test_manager_account";
        const managerUser = {
          openId: managerOpenId,
          name: "Test Manager",
          email: email,
          loginMethod: "email",
          role: "manager" as const,
        };

        await syncUser(managerUser);
        const sessionToken = await sdk.createSessionToken(managerOpenId, {
          name: managerUser.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        const savedUser = await getUserByOpenId(managerOpenId);
        logEvent("auth.login_success", { role: "manager", method: "email" });
        res.json({ success: true, user: buildUserResponse(savedUser || managerUser), sessionToken });
        return;
      }

      // Coordinator test account - has coordinator role for testing impersonation
      if (email === "coordinator@secretlab.com" && password === "supertest") {
        const coordinatorOpenId = "test_coordinator_account";
        const coordinatorUser = {
          openId: coordinatorOpenId,
          name: "Test Coordinator",
          email: email,
          loginMethod: "email",
          role: "coordinator" as const,
        };

        await syncUser(coordinatorUser);
        const sessionToken = await sdk.createSessionToken(coordinatorOpenId, {
          name: coordinatorUser.name,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        const savedUser = await getUserByOpenId(coordinatorOpenId);
        logEvent("auth.login_success", { role: "coordinator", method: "email" });
        res.json({ success: true, user: buildUserResponse(savedUser || coordinatorUser), sessionToken });
        return;
      }

      // For other users, check database
      // In production, you would verify password hash here
      res.status(401).json({ error: "Invalid email or password", message: "Invalid email or password" });
    } catch (error) {
      console.error("[Auth] Login failed:", error);
      res.status(500).json({ error: "Login failed", message: "An error occurred during login" });
    }
  });

  // Establish session cookie from Bearer token
  // Used by iframe preview: frontend receives token via postMessage, then calls this endpoint
  // to get a proper Set-Cookie response from the backend (3000-xxx domain)
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    try {
      // Authenticate using Bearer token from Authorization header
      const user = await sdk.authenticateRequest(req);

      // Get the token from the Authorization header to set as cookie
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.status(400).json({ error: "Bearer token required" });
        return;
      }
      const token = authHeader.slice("Bearer ".length).trim();

      // Set cookie for this domain (3000-xxx)
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      logEvent("auth.session_set", { userId: (user as any)?.id, role: (user as any)?.role });

      res.json({ success: true, user: buildUserResponse(user) });
    } catch (error) {
      logError("auth.session_failed", error);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}
