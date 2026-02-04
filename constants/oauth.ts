import { getApiBaseUrl } from "@/lib/api-config";
import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

// Extract scheme from bundle ID
// e.g., "com.example.app" -> "locomotivate"
const bundleId = "com.bright.blue.locomotivate";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = timestamp || "locomotivate";

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  deepLinkScheme: schemeFromBundleId,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  oauthRedirectBase: process.env.EXPO_PUBLIC_OAUTH_REDIRECT_BASE ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const GOOGLE_WEB_CLIENT_ID = env.googleWebClientId;

const isPrivateHostname = (hostname: string) => {
  if (!hostname) return true;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.endsWith(".local")) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  return /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
};

console.log("[OAuth Config] Base URLs:", {
  portal: OAUTH_PORTAL_URL || "(empty)",
  server: OAUTH_SERVER_URL || "(empty)",
  googleClientId: GOOGLE_WEB_CLIENT_ID ? `${GOOGLE_WEB_CLIENT_ID.slice(0, 10)}...` : "(empty)",
});

// Re-export getApiBaseUrl for backward compatibility
export { getApiBaseUrl };

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "loco-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getPostAuthRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "http://localhost:8081";
  }
  return Linking.createURL("/oauth/callback", {
    scheme: env.deepLinkScheme,
  });
};

export const getAuthRedirectUri = () => {
  const defaultBase = getApiBaseUrl();
  const preferredBase =
    env.oauthRedirectBase || env.apiBaseUrl || defaultBase;

  if (ReactNative.Platform.OS !== "web") {
    try {
      const parsed = new URL(preferredBase);
      if (isPrivateHostname(parsed.hostname) && env.apiBaseUrl) {
        return `${env.apiBaseUrl.replace(/\/$/, "")}/api/oauth/callback`;
      }
    } catch {
      // fall through to default
    }
  }

  return `${preferredBase.replace(/\/$/, "")}/api/oauth/callback`;
};

export const getLoginUrl = (trainerId?: string) => {
  const postAuthRedirectUri = getPostAuthRedirectUri();

  // Combine redirect URI and trainerId if present
  const stateObj = {
    redirectUri: postAuthRedirectUri,
    trainerId: trainerId || undefined
  };
  const state = encodeState(JSON.stringify(stateObj));

  const portalUrl = OAUTH_PORTAL_URL.trim();

  // Only use portal if explicitly configured AND it's not localhost in production
  if (portalUrl && portalUrl !== "http://localhost:3000") {
    const isLocalhost = /localhost|127\.0\.0\.1/.test(portalUrl);
    if (isLocalhost && process.env.NODE_ENV === "production") {
      console.warn("[OAuth] Portal URL points to localhost in production, falling back to direct Google.");
    } else {
      const url = new URL(`${portalUrl}/app-auth`);
      url.searchParams.set("appId", APP_ID);
      url.searchParams.set("redirectUri", getAuthRedirectUri());
      url.searchParams.set("state", state);
      url.searchParams.set("type", "signIn");
      return url.toString();
    }
  }

  // Fallback to direct Google OAuth
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error(
      "Google OAuth is not configured. " +
      "Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in your environment."
    );
  }

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleUrl.searchParams.set("client_id", GOOGLE_WEB_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", getAuthRedirectUri());
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("access_type", "offline");
  googleUrl.searchParams.set("prompt", "select_account");
  googleUrl.searchParams.set("state", state);
  return googleUrl.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(trainerId?: string): Promise<string | null> {
  const loginUrl = getLoginUrl(trainerId);

  if (ReactNative.Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
  }

  // The OAuth callback will reopen the app via deep link.
  return null;
}
