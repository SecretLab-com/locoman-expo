/**
 * API Configuration
 * 
 * This file contains hardcoded API URLs for different environments.
 * The native fallback URL is used when running on physical devices via Expo Go.
 * 
 * IMPORTANT: Update NATIVE_API_URL when the sandbox URL changes.
 */
import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

// Hardcoded API URL for native platforms (Expo Go on physical devices)
// This URL must be publicly accessible from the internet
const NATIVE_API_URL = "https://3002-i4anndi9mla842misgiwl-a70979ba.sg1.manus.computer";
const WEB_API_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL || "";
const IS_DEV = typeof __DEV__ !== "undefined" && __DEV__;

// Web API URL derivation from current hostname
function getWebApiUrl(): string {
  const location = typeof window !== "undefined" ? window.location : undefined;
  if (location) {
    const { protocol, hostname, port } = location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const apiPort = port === "8081" ? "3000" : "3000";
      return `${protocol}//${hostname}:${apiPort}`;
    }
    // Local LAN access (e.g. 192.168.x.x:8081)
    if (port === "8081") {
      return `${protocol}//${hostname}:3000`;
    }
    if (WEB_API_URL) {
      return WEB_API_URL;
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
  // 1. Check for manual environment override
  const envNativeUrl = process.env.EXPO_PUBLIC_NATIVE_API_URL;
  if (envNativeUrl) {
    return envNativeUrl;
  }

  // 2. Try to derive from Metro dev server address
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.hostUri;
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

  // 3. Fallback to hardcoded URL if all else fails
  if (WEB_API_URL) {
    return WEB_API_URL;
  }
  return NATIVE_API_URL;
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
