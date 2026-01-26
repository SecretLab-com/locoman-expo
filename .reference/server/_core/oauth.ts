import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    // Check if this login was initiated from the Expo app
    const returnTo = getQueryParam(req, "returnTo");

    console.log("[OAuth] Callback received", { code: code?.substring(0, 10) + "...", state: state?.substring(0, 20) + "...", returnTo });

    if (!code || !state) {
      console.error("[OAuth] Missing code or state");
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      console.log("[OAuth] Exchanging code for token...");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      console.log("[OAuth] Token exchange successful");
      
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      console.log("[OAuth] Got user info:", { openId: userInfo.openId, name: userInfo.name, email: userInfo.email });

      if (!userInfo.openId) {
        console.error("[OAuth] Missing openId in user info");
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      console.log("[OAuth] Upserting user...");
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      console.log("[OAuth] User upserted successfully");

      console.log("[OAuth] Creating session token with secret length:", process.env.JWT_SECRET?.length || 0);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      console.log("[OAuth] Session token created", { tokenLength: sessionToken.length });

      const cookieOptions = getSessionCookieOptions(req);
      console.log("[OAuth] Cookie options:", cookieOptions);
      console.log("[OAuth] Setting cookie:", COOKIE_NAME, "maxAge:", ONE_YEAR_MS);
      
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to the returnTo URL if specified (e.g., /expo for mobile app login)
      const redirectUrl = returnTo === 'expo' ? '/expo' : '/';
      console.log("[OAuth] Redirecting to", redirectUrl);
      res.redirect(302, redirectUrl);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
