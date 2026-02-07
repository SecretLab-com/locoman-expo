import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../db";
import { getUserById } from "../db";
import { getServerSupabase } from "../../lib/supabase";
import { resolveOrCreateAppUser } from "./auth-utils";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

/** Extract Supabase access token from the Authorization header. */
function extractToken(req: CreateExpressContextOptions["req"]): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const token = extractToken(opts.req);
    if (!token) {
      return { req: opts.req, res: opts.res, user: null };
    }

    // Verify the Supabase JWT
    const sb = getServerSupabase();
    const { data: { user: supabaseUser }, error } = await sb.auth.getUser(token);
    if (error || !supabaseUser) {
      return { req: opts.req, res: opts.res, user: null };
    }

    // Resolve to our app user (auto-creates on first sign-in)
    user = await resolveOrCreateAppUser(supabaseUser);

    // Support impersonation for coordinators
    if (user?.role === "coordinator") {
      const impersonateHeader = opts.req.headers["x-impersonate-user-id"];
      const impersonateUserId = typeof impersonateHeader === "string" ? impersonateHeader : undefined;
      if (impersonateUserId) {
        const impersonatedUser = await getUserById(impersonateUserId);
        if (impersonatedUser) {
          console.log(`[Auth] Coordinator ${user.id} impersonating user ${impersonatedUser.id}`);
          return { req: opts.req, res: opts.res, user: impersonatedUser };
        }
      }
    }
  } catch (error) {
    console.error("[Auth] Context creation error:", error);
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
