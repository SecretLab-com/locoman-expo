/**
 * Frontend Supabase client (uses anon key — respects RLS).
 * Safe for use in React components and hooks.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { processLock } from "@supabase/supabase-js";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
// Prefer the JWT-format anon key (required for auth operations)
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_KEY ||
  "";

let _client: SupabaseClient | null = null;
let hasInstalledSupabaseWarnFilter = false;

function installSupabaseLockWarningFilter() {
  if (hasInstalledSupabaseWarnFilter) return;
  hasInstalledSupabaseWarnFilter = true;

  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : "";
    if (
      first.includes("@supabase/gotrue-js: Lock") &&
      first.includes("acquisition timed out")
    ) {
      return;
    }
    originalWarn(...args);
  };
}

export function getSupabaseClient(): SupabaseClient {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY are required",
      );
    }

    installSupabaseLockWarningFilter();

    const authOptions: any = {
      // Use AsyncStorage for native session persistence
      ...(Platform.OS !== "web" && {
        storage: AsyncStorage as any,
      }),
      // On web, use Supabase/browser default lock strategy.
      // For native, keep in-process locking where navigator.locks is unavailable.
      ...(Platform.OS !== "web" && { lock: processLock }),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
      // Increase lock wait window to reduce transient lock timeout warnings.
      lockAcquireTimeout: 30000,
      // Use PKCE on web to avoid very large hash-token callback URLs
      // that can destabilize dev sessions with excessive logging payload.
      // Native keeps implicit flow for deep-link token handling.
      flowType: Platform.OS === "web" ? "pkce" : "implicit",
    };

    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: authOptions,
    });
  }
  return _client;
}

export const supabase = getSupabaseClient();
