/**
 * API Configuration
 * 
 * This file contains hardcoded API URLs for different environments.
 * The native fallback URL is used when running on physical devices via Expo Go.
 * 
 * IMPORTANT: Update NATIVE_API_URL when the sandbox URL changes.
 */
import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";

// Hardcoded API URL for native platforms (Expo Go on physical devices)
// This URL must be publicly accessible from the internet
const NATIVE_API_URL = "https://3002-i4anndi9mla842misgiwl-a70979ba.sg1.manus.computer";
const WEB_API_URL = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.VITE_API_BASE_URL || "";

// Web API URL derivation from current hostname
function getWebApiUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname, port } = window.location;
    if (WEB_API_URL) {
      return WEB_API_URL;
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      const apiPort = port === "8081" ? "3002" : "3000";
      return `${protocol}//${hostname}:${apiPort}`;
    }
    // Pattern: 8081-sandboxid.region.domain -> 3002-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3002-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }
  return "";
}

function getNativeApiUrl(): string {
  if (WEB_API_URL) {
    return WEB_API_URL;
  }
  const scriptURL = NativeModules?.SourceCode?.scriptURL as string | undefined;
  const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.hostUri;
  const rawUrl = scriptURL || (hostUri ? `http://${hostUri}` : "");
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const hostname = parsed.hostname;
      const port = parsed.port || "8081";
      const apiPort = port === "8081" ? "3002" : port;
      return `${parsed.protocol}//${hostname}:${apiPort}`;
    } catch {
      // fallthrough
    }
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
