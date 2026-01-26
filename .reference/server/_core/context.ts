import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { IMPERSONATE_ADMIN_COOKIE, IMPERSONATE_STARTED_AT_COOKIE } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  isImpersonating: boolean;
  realAdminUser: User | null;
  impersonationStartedAt: string | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let isImpersonating = false;
  let realAdminUser: User | null = null;
  let impersonationStartedAt: string | null = null;

  try {
    // First, authenticate the real user
    user = await sdk.authenticateRequest(opts.req);
    
    // Check if there's an impersonation cookie (meaning admin is impersonating someone)
    const cookies = parseCookieHeader(opts.req.headers.cookie || "");
    const impersonateAdminSession = cookies[IMPERSONATE_ADMIN_COOKIE];
    
    if (impersonateAdminSession) {
      // Verify the admin session stored in impersonation cookie
      const adminSession = await sdk.verifySession(impersonateAdminSession);
      if (adminSession) {
        const adminUser = await db.getUserByOpenId(adminSession.openId);
        // Only allow if the stored session belongs to a coordinator
        if (adminUser && adminUser.role === "coordinator") {
          realAdminUser = adminUser;
          isImpersonating = true;
          // Get the impersonation start time from cookie
          impersonationStartedAt = cookies[IMPERSONATE_STARTED_AT_COOKIE] || null;
          // The current user (from main cookie) is the impersonated user
          console.log(`[Impersonation] Admin ${adminUser.name} (${adminUser.id}) is impersonating ${user?.name} (${user?.id})`);
        }
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    isImpersonating,
    realAdminUser,
    impersonationStartedAt,
  };
}
