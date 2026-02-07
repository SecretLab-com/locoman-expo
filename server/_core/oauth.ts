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
import { getUserById } from "../db";
import { getSessionCookieOptions } from "./cookies";
import { logError, logEvent } from "./logger";
import { getServerSupabase } from "../../lib/supabase";
import { resolveOrCreateAppUser, buildUserResponse } from "./auth-utils";

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
      const sb = getServerSupabase();
      const { data: { user: supabaseUser }, error } = await sb.auth.getUser(token);

      if (error || !supabaseUser) {
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
