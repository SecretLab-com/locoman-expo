import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl, getTrpcFallbackUrls, getTrpcUrl } from "@/lib/api-config";
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
const DEBUG_TRPC = process.env.EXPO_PUBLIC_DEBUG_TRPC === "true";

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  const trpcUrl = getTrpcUrl();
  const trpcFallbackUrls = getTrpcFallbackUrls();

  if (DEBUG_TRPC) {
    console.log("[tRPC] Full tRPC URL:", trpcUrl);
  }

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
          if (DEBUG_TRPC) {
            console.log("[tRPC] Fetching:", url);
          }
          const fetchWithCredentials = (targetUrl: RequestInfo | URL) =>
            fetch(targetUrl, {
              ...options,
              credentials: "include",
            });

          return fetchWithCredentials(url)
            .catch(async (error) => {
              const message = String(error?.message || error || "");
              const isNetworkFailure =
                message.includes("Network request failed") ||
                message.includes("Failed to fetch") ||
                message.includes("Load failed");

              if (!isNetworkFailure || !trpcFallbackUrls.length) {
                throw error;
              }

              const originalUrl = String(url);
              for (const fallbackBase of trpcFallbackUrls) {
                try {
                  const original = new URL(originalUrl);
                  const fallback = new URL(fallbackBase);
                  original.protocol = fallback.protocol;
                  original.host = fallback.host;
                  const fallbackUrl = original.toString();
                  if (DEBUG_TRPC) {
                    console.warn("[tRPC] Primary fetch failed, retrying fallback:", fallbackUrl);
                  }
                  return await fetchWithCredentials(fallbackUrl);
                } catch (fallbackError) {
                  if (DEBUG_TRPC) {
                    console.warn("[tRPC] Fallback fetch attempt failed:", fallbackError);
                  }
                }
              }

              throw error;
            })
            .then(async (response) => {
              if (response.status !== 401) return response;
              // One-shot retry to survive transient auth/session desync.
              const refreshedToken = await Auth.getSessionToken();
              if (!refreshedToken) return response;

              const headers = new Headers(options?.headers ?? undefined);
              headers.set("Authorization", `Bearer ${refreshedToken}`);
              const retryTargetUrl = response.url || String(url);
              const retriedResponse = await fetch(retryTargetUrl, {
                ...options,
                headers,
                credentials: "include",
              });
              if (retriedResponse.status === 401) {
                await Auth.handleAuthDesync("trpc_retry_401");
              }
              return retriedResponse;
            })
            .catch((error) => {
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
