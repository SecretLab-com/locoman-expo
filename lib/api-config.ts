/**
 * API Configuration
 * 
 * This file resolves API URLs for web and native platforms.
 * Prefer explicit environment configuration in production.
 */
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

function readRuntimeExtraApiUrl(): string {
  const expoConfigExtra = (Constants?.expoConfig as { extra?: { apiBaseUrl?: string } } | undefined)?.extra;
  const manifestExtra = (Constants?.manifest as { extra?: { apiBaseUrl?: string } } | undefined)?.extra;
  return expoConfigExtra?.apiBaseUrl || manifestExtra?.apiBaseUrl || "";
}

function getExplicitApiUrl(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_NATIVE_API_URL ||
    process.env.VITE_API_BASE_URL ||
    readRuntimeExtraApiUrl() ||
    ""
  );
}

const FORCE_SINGLE_API_URL = process.env.EXPO_PUBLIC_FORCE_SINGLE_API_URL === "true";
const PREFER_LOCAL_WEB_API = process.env.EXPO_PUBLIC_PREFER_LOCAL_WEB_API === "true";
const IS_DEV = typeof __DEV__ !== "undefined" && __DEV__;

// Web API URL derivation from current hostname
function getWebApiUrl(): string {
  const explicitApiUrl = getExplicitApiUrl();

  // Prefer explicit API URL whenever provided, unless local override is explicitly requested.
  if (explicitApiUrl && !PREFER_LOCAL_WEB_API) {
    return explicitApiUrl;
  }

  const location = typeof window !== "undefined" ? window.location : undefined;
  if (location) {
    const { protocol, hostname, port } = location;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    // Force explicit API URL when requested.
    if (explicitApiUrl && FORCE_SINGLE_API_URL) {
      return explicitApiUrl;
    }

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const apiPort = port === "8081" ? "3000" : "3000";
      return `${protocol}//${hostname}:${apiPort}`;
    }
    // Local LAN access (e.g. 192.168.x.x:8081)
    if (port === "8081") {
      return `${protocol}//${hostname}:3000`;
    }
    // Pattern: 8081-sandboxid.region.domain -> 3002-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3002-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
    return `${protocol}//${hostname}`;
  }
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  return "";
}

function getNativeApiUrl(): string {
  const explicitApiUrl = getExplicitApiUrl();

  // 1. Check for explicit environment configuration first
  if (explicitApiUrl) {
    return explicitApiUrl;
  }

  // 2. Try to derive from Metro dev server address
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  const expoConfigHost = (Constants?.expoConfig as { hostUri?: string } | undefined)?.hostUri;
  const manifestHost = (Constants?.manifest as { hostUri?: string } | undefined)?.hostUri;
  const hostUri = expoConfigHost || manifestHost;
  const rawUrl = scriptURL || (hostUri ? `http://${hostUri}` : "");

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const hostname = parsed.hostname;
      const port = parsed.port || "8081";

      // If we're on a sandbox (e.g. 8081-xxx), the API is likely on 3002-xxx (proxy to 3000)
      if (hostname.startsWith("8081-")) {
        const apiHostname = hostname.replace(/^8081-/, "3002-");
        return `https://${apiHostname}`;
      }

      // Standard local development
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return `http://${hostname}:3000`;
      }

      // LAN development (e.g. 192.168.x.x)
      const apiPort = port === "8081" ? "3000" : port;
      return `${parsed.protocol}//${hostname}:${apiPort}`;
    } catch {
      // fallthrough
    }
  }

  // 3. Fallbacks
  if (IS_DEV) {
    return "http://localhost:3000";
  }
  return "";
}

/**
 * Get the API base URL for the current platform.
 *
 * - On web: derives from current hostname (8081 -> 3002)
 * - On native (iOS/Android): uses env override, then dev server host, then hardcoded URL
 */
export function getApiBaseUrl(): string {
  const isNative = Platform.OS === "ios" || Platform.OS === "android";

  if (isNative) {
    const nativeUrl = getNativeApiUrl();
    console.log("[API Config] Native platform detected, using URL:", nativeUrl);
    return nativeUrl;
  }

  // On web, derive from current hostname
  const webUrl = getWebApiUrl();
  console.log("[API Config] Web platform, derived URL:", webUrl || "(empty - using relative URL)");
  return webUrl;
}

/**
 * Get the full tRPC endpoint URL
 */
export function getTrpcUrl(): string {
  return `${getApiBaseUrl()}/api/trpc`;
}

/**
 * Get fallback tRPC URLs used when the primary host is unreachable
 * from certain mobile network contexts (for example, DNS/proxy edge cases).
 */
export function getTrpcFallbackUrls(): string[] {
  const explicitFallback =
    process.env.EXPO_PUBLIC_API_BASE_URL_FALLBACK ||
    process.env.EXPO_PUBLIC_NATIVE_API_URL_FALLBACK ||
    "";

  const primary = getApiBaseUrl();
  const candidates = new Set<string>();

  if (explicitFallback) {
    candidates.add(`${explicitFallback.replace(/\/+$/g, "")}/api/trpc`);
  }

  // Prefer a stable direct Cloud Run fallback when using the custom domain.
  if (primary.includes("services.bright.coach")) {
    candidates.add("https://locoman-backend-870100645593.us-central1.run.app/api/trpc");
  }

  // Never include the already-selected URL as a fallback.
  candidates.delete(getTrpcUrl());
  return Array.from(candidates);
}
