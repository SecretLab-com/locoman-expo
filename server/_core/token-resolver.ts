import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { getServerSupabase } from "../../lib/supabase";

type CachedTokenUser = {
  user: SupabaseAuthUser;
  expiresAt: number;
};

const TOKEN_CACHE_MAX = 512;
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
const tokenUserCache = new Map<string, CachedTokenUser>();

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getTokenExpiryMs(token: string): number {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return exp * 1000;
  }
  return Date.now() + TOKEN_CACHE_TTL_MS;
}

function getCachedUser(token: string): SupabaseAuthUser | null {
  const cached = tokenUserCache.get(token);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    tokenUserCache.delete(token);
    return null;
  }
  return cached.user;
}

function setCachedUser(token: string, user: SupabaseAuthUser) {
  if (tokenUserCache.size >= TOKEN_CACHE_MAX) {
    const first = tokenUserCache.keys().next().value;
    if (first) tokenUserCache.delete(first);
  }
  tokenUserCache.set(token, {
    user,
    expiresAt: Math.min(Date.now() + TOKEN_CACHE_TTL_MS, getTokenExpiryMs(token)),
  });
}

export async function resolveSupabaseUserFromToken(token: string): Promise<SupabaseAuthUser | null> {
  const cached = getCachedUser(token);
  if (cached) return cached;

  const sb = getServerSupabase();
  // Retry once because auth.getUser can fail transiently under load/network jitter.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: { user }, error } = await sb.auth.getUser(token);
    if (user && !error) {
      setCachedUser(token, user);
      return user;
    }
  }
  return null;
}
