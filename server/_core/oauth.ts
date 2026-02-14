/**
 * Auth routes — Supabase Auth.
 *
 * Google OAuth is handled entirely by Supabase on the frontend.
 * This file provides:
 *   GET  /api/auth/me     — returns the authenticated user profile
 *   POST /api/auth/logout — clears legacy cookies
 */

import type { Express, Request, Response } from "express";
import { COOKIE_NAME } from "../../shared/const.js";
import { getServerSupabase } from "../../lib/supabase";
import { getUserById } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { logError, logEvent } from "./logger";
import { resolveOrCreateAppUser, buildUserResponse } from "./auth-utils";
import { resolveSupabaseUserFromToken } from "./token-resolver";

function getDefaultNativeReturnTo(): string {
  return process.env.OAUTH_NATIVE_RETURN_TO || "locomotivate://oauth/callback";
}

function appendParam(target: URL, key: string, value: unknown) {
  if (typeof value === "string" && value.length > 0) {
    target.searchParams.set(key, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.length > 0) {
        target.searchParams.set(key, entry);
      }
    }
  }
}

function buildNativeCallbackTarget(req: Request): string {
  const returnTo = (req.query.returnTo as string) || getDefaultNativeReturnTo();
  const deepLink = new URL(returnTo);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "returnTo") continue;
    appendParam(deepLink, key, value);
  }
  return deepLink.toString();
}

function sendNativeRedirectHtml(res: Response, target: string) {
  const safeTarget = target.replace(/"/g, "&quot;");
  const jsTarget = JSON.stringify(target);
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html><html><head>
<meta http-equiv="refresh" content="0;url=${safeTarget}">
</head><body>
<script>
  (function () {
    try {
      var target = new URL(${jsTarget});
      var current = new URL(window.location.href);
      current.searchParams.forEach(function (value, key) {
        if (key !== "returnTo") target.searchParams.set(key, value);
      });
      if (current.hash && current.hash.length > 1) {
        var hash = new URLSearchParams(current.hash.substring(1));
        hash.forEach(function (value, key) {
          target.searchParams.set(key, value);
        });
      }
      window.location.replace(target.toString());
      return;
    } catch (_error) {}
    window.location.href = ${jsTarget};
  })();
</script>
<p>Redirecting to app...</p></body></html>`);
}

export function registerOAuthRoutes(app: Express) {
  // ----------------------------------------------------------------
  // GET /api/auth/me — current authenticated user
  // ----------------------------------------------------------------
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        res.json({ user: null });
        return;
      }

      const token = authHeader.slice(7);
      const supabaseUser = await resolveSupabaseUserFromToken(token);
      if (!supabaseUser) {
        res.json({ user: null });
        return;
      }

      const appUser = await resolveOrCreateAppUser(supabaseUser);

      // Support impersonation for coordinators
      if (appUser?.role === "coordinator") {
        const impersonateHeader = req.headers["x-impersonate-user-id"];
        if (typeof impersonateHeader === "string") {
          const impersonated = await getUserById(impersonateHeader);
          if (impersonated) {
            res.json({ user: buildUserResponse(impersonated) });
            return;
          }
        }
      }

      res.json({ user: appUser ? buildUserResponse(appUser) : null });
    } catch (error) {
      logError("auth.me_failed", error);
      res.status(401).json({ error: "Not authenticated", user: null });
    }
  });

  const handleNativeOAuthCallback = (req: Request, res: Response) => {
    try {
      const target = buildNativeCallbackTarget(req);
      console.log(`[Auth] Native callback redirecting to: ${target.split("?")[0]}?...`);
      sendNativeRedirectHtml(res, target);
    } catch (error) {
      logError("auth.native_callback_failed", error, { query: req.query as Record<string, unknown> });
      res.status(400).send("Invalid OAuth callback request");
    }
  };

  // ----------------------------------------------------------------
  // Legacy + current native callback routes.
  // Keep both to avoid TestFlight breakage from stale provider config.
  // ----------------------------------------------------------------
  app.get("/api/auth/native-callback", handleNativeOAuthCallback);
  app.get("/api/auth/callback", handleNativeOAuthCallback);
  app.get("/api/auth/mobile", handleNativeOAuthCallback);
  app.get("/api/oauth/callback", handleNativeOAuthCallback);
  app.get("/api/oauth/mobile", handleNativeOAuthCallback);

  // ----------------------------------------------------------------
  // POST /api/auth/logout
  // ----------------------------------------------------------------
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    logEvent("auth.logout");
    res.json({ success: true });
  });
}
