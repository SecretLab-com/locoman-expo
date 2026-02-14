/**
 * Shared auth utilities used by both context.ts and oauth.ts.
 */
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { getUserByAuthId, getUserByEmail, getUserByOpenId, updateUser, upsertUser } from "../db";
import type { User } from "../db";

/**
 * Generate a stable openId for a Supabase auth user.
 * Google users get `google_<sub>`, others get `supabase_<id>`.
 */
export function generateOpenId(supabaseUser: SupabaseAuthUser): string {
  const provider = supabaseUser.app_metadata?.provider;
  if (provider === "google") {
    return `google_${supabaseUser.user_metadata?.sub || supabaseUser.id}`;
  }
  return `supabase_${supabaseUser.id}`;
}

/**
 * Look up the app user by Supabase auth user ID.
 * Tries auth_id first, falls back to email matching (and auto-links).
 */
export async function resolveAppUser(supabaseUserId: string, email?: string): Promise<User | null> {
  const byAuthId = await getUserByAuthId(supabaseUserId);
  if (byAuthId) return byAuthId;

  if (email) {
    const byEmail = await getUserByEmail(email);
    if (byEmail) {
      await updateUser(byEmail.id, { authId: supabaseUserId });
      return { ...byEmail, authId: supabaseUserId };
    }
  }

  return null;
}

/**
 * Resolve or auto-create an app user from a Supabase auth user.
 */
export async function resolveOrCreateAppUser(supabaseUser: SupabaseAuthUser): Promise<User | null> {
  let user = await resolveAppUser(supabaseUser.id, supabaseUser.email);
  const openId = generateOpenId(supabaseUser);

  if (!user) {
    await upsertUser({
      openId,
      authId: supabaseUser.id,
      name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || null,
      email: supabaseUser.email || null,
      photoUrl: supabaseUser.user_metadata?.avatar_url || null,
      loginMethod: supabaseUser.app_metadata?.provider || "email",
      lastSignedIn: new Date().toISOString(),
    });
    user = await resolveAppUser(supabaseUser.id, supabaseUser.email);
    if (!user) {
      // Final fallback: read by openId in case auth_id/email linking lags behind.
      user = (await getUserByOpenId(openId)) ?? null;
      if (user && user.authId !== supabaseUser.id) {
        await updateUser(user.id, { authId: supabaseUser.id });
        user = { ...user, authId: supabaseUser.id };
      }
    }
  }

  return user;
}

/**
 * Build a safe user response object for API responses.
 */
export function buildUserResponse(user: Partial<User> | null | undefined) {
  return {
    id: user?.id ?? null,
    openId: user?.openId ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    loginMethod: user?.loginMethod ?? null,
    role: user?.role ?? "shopper",
    lastSignedIn: user?.lastSignedIn ?? new Date().toISOString(),
    photoUrl: user?.photoUrl ?? null,
    phone: user?.phone ?? null,
    username: user?.username ?? null,
    bio: user?.bio ?? null,
    specialties: user?.specialties ?? null,
    socialLinks: user?.socialLinks ?? null,
    trainerId: user?.trainerId ?? null,
    active: user?.active ?? true,
    metadata: user?.metadata ?? null,
    createdAt: user?.createdAt ?? null,
    updatedAt: user?.updatedAt ?? null,
  };
}
