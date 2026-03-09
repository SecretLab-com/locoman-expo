/**
 * Server-side Supabase client (uses service role key — bypasses RLS).
 * Use this in server/ code only. NEVER expose service role key to frontend.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let _serverClient: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (!_serverClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server-side Supabase client",
      );
    }
    _serverClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _serverClient;
}

/**
 * Create a Supabase client scoped to a specific user's JWT.
 * This respects RLS policies for that user.
 */
export function getUserSupabase(accessToken: string): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is required");
  }
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_KEY || "";
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
