/**
 * Frontend Supabase client (uses anon key — respects RLS).
 * Safe for use in React components and hooks.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
// Prefer the JWT-format anon key (required for auth operations)
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  "";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY are required",
      );
    }

    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Use AsyncStorage for native session persistence
        ...(Platform.OS !== "web" && {
          storage: AsyncStorage as any,
        }),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web",
      },
    });
  }
  return _client;
}

export const supabase = getSupabaseClient();
