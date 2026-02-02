/**
 * API Configuration
 * 
 * This file contains hardcoded API URLs for different environments.
 * The native fallback URL is used when running on physical devices via Expo Go.
 * 
 * IMPORTANT: Update NATIVE_API_URL when the sandbox URL changes.
 */
import { Platform } from "react-native";

// Hardcoded API URL for native platforms (Expo Go on physical devices)
// This URL must be publicly accessible from the internet
const NATIVE_API_URL = "https://3002-i4anndi9mla842misgiwl-a70979ba.sg1.manus.computer";

// Web API URL derivation from current hostname
function getWebApiUrl(): string {
  if (typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    // Pattern: 8081-sandboxid.region.domain -> 3002-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3002-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }
  return "";
}

/**
 * Get the API base URL for the current platform.
 * 
 * - On web: derives from current hostname (8081 -> 3002)
 * - On native (iOS/Android): uses hardcoded public URL
 */
export function getApiBaseUrl(): string {
  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  
  if (isNative) {
    // Always use hardcoded URL on native - env vars don't work reliably in Expo Go
    console.log("[API Config] Native platform detected, using hardcoded URL:", NATIVE_API_URL);
    return NATIVE_API_URL;
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
