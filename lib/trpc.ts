import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl, getTrpcUrl } from "@/lib/api-config";
import type { AppRouter } from "@/server/routers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import superjson from "superjson";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  const trpcUrl = getTrpcUrl();

  // Debug logging to help diagnose connection issues
  console.log("[tRPC] Full tRPC URL:", trpcUrl);

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: trpcUrl,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

          // Add impersonation header if present
          try {
            const impersonated = await AsyncStorage.getItem("locomotivate_impersonation");
            if (impersonated) {
              const user = JSON.parse(impersonated);
              if (user?.id) {
                headers["X-Impersonate-User-Id"] = user.id.toString();
              }
            }
          } catch (e) {
            // Ignore storage errors
          }

          return headers;
        },
        // Custom fetch to include credentials for cookie-based auth
        fetch(url, options) {
          console.log("[tRPC] Fetching:", url);
          return fetch(url, {
            ...options,
            credentials: "include",
          }).catch((error) => {
            console.error("[tRPC] Fetch error:", error);
            throw error;
          });
        },
      }),
    ],
  });
}

// Re-export getApiBaseUrl for backward compatibility
export { getApiBaseUrl };
