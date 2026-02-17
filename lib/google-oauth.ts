import { triggerAuthRefresh } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase-client";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_OAUTH_QUERY_PARAMS = {
  // Always show the Google account chooser so users can switch accounts
  // after app logout, even if Google still has an active browser session.
  prompt: "select_account",
};

function isMissingCodeVerifierError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = (error.message || "").toLowerCase();
  return (
    message.includes("code verifier") ||
    message.includes("both auth code and code verifier should be non-empty")
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function normalizeConfiguredWebOrigin(): string {
  const configured = String(process.env.EXPO_PUBLIC_APP_URL || "").trim();
  if (!configured) return "";
  try {
    const parsed = new URL(configured);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    if (isLoopbackHostname(parsed.hostname)) return "";
    return trimTrailingSlash(parsed.origin);
  } catch {
    return "";
  }
}

function getWebRedirectOrigin(): string {
  const runtimeOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? trimTrailingSlash(window.location.origin)
      : "";
  if (runtimeOrigin) {
    try {
      const hostname = new URL(runtimeOrigin).hostname;
      // Local web development must round-trip back to localhost, otherwise
      // OAuth returns to production and the local PKCE flow fails.
      if (isLoopbackHostname(hostname)) {
        return runtimeOrigin;
      }
    } catch {
      // Ignore URL parse failures and continue with configured fallback.
    }
  }

  const configuredOrigin = normalizeConfiguredWebOrigin();
  if (configuredOrigin) {
    // Keep a stable public callback origin for production web OAuth.
    return configuredOrigin;
  }
  return runtimeOrigin;
}

function getNativeRedirectUri(): string {
  // Hard-force iOS auth callbacks to app scheme so OAuth never
  // falls back into localhost/web view.
  if (Platform.OS === "ios") {
    return "locomotivate://oauth/callback";
  }

  return makeRedirectUri({
    scheme: Constants.appOwnership === "expo" ? undefined : "locomotivate",
    path: "oauth/callback",
  });
}

export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === "web") {
    const redirectOrigin = getWebRedirectOrigin();
    if (!redirectOrigin) {
      throw new Error("OAuth redirect origin is not configured. Set EXPO_PUBLIC_APP_URL.");
    }
    const redirectTo = `${redirectOrigin}/oauth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: GOOGLE_OAUTH_QUERY_PARAMS,
      },
    });
    if (error) throw error;
    return;
  }

  if (Platform.OS === "ios" && Constants.appOwnership === "expo") {
    throw new Error(
      "Google OAuth on iOS requires a development build with the locomotivate:// scheme. Expo Go is not supported for this flow.",
    );
  }

  const redirectTo = getNativeRedirectUri();
  console.log("[OAuth] redirectTo:", redirectTo, "appOwnership:", Constants.appOwnership);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: GOOGLE_OAUTH_QUERY_PARAMS,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("No OAuth URL returned.");

  let authCompleted = false;

  const linkSubscription = Linking.addEventListener("url", async ({ url }) => {
    if (authCompleted || !url.includes("/oauth/callback")) return;
    authCompleted = true;
    console.log("[OAuth] Deep link callback received");
    await processCallbackUrl(url);
    triggerAuthRefresh();
  });

  const {
    data: { subscription: authSubscription },
  } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      authCompleted = true;
      triggerAuthRefresh();
    }
  });

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "success" && result.url) {
    await processCallbackUrl(result.url);
    authCompleted = true;
  }

  // Session propagation can be slightly delayed after browser dismissal.
  for (let i = 0; i < 10 && !authCompleted; i++) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      authCompleted = true;
      triggerAuthRefresh();
      break;
    }
    await wait(200);
  }

  if (!authCompleted) {
    linkSubscription.remove();
    authSubscription.unsubscribe();
    throw new Error(
      "Google OAuth did not complete. Check Supabase redirect URLs and try again.",
    );
  }

  linkSubscription.remove();
  authSubscription.unsubscribe();
}

async function processCallbackUrl(url: string): Promise<void> {
  // Hash fragment tokens (implicit flow)
  const hash = url.indexOf("#");
  if (hash !== -1) {
    const params = new URLSearchParams(url.slice(hash + 1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      console.log("[OAuth] Setting session from tokens...");
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      triggerAuthRefresh();
      return;
    }
  }

  // Query param tokens (native callback bridges may move hash -> query)
  const qIndex = url.indexOf("?");
  if (qIndex !== -1) {
    const params = new URLSearchParams(url.slice(qIndex + 1).split("#")[0]);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      console.log("[OAuth] Setting session from query tokens...");
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      triggerAuthRefresh();
      return;
    }
  }

  // Query param code (PKCE flow)
  if (qIndex !== -1) {
    const code = new URLSearchParams(url.slice(qIndex + 1).split("#")[0]).get("code");
    if (code) {
      console.log("[OAuth] Exchanging code...");
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        // Callback may be replayed after session is already established.
        // Treat missing verifier as non-fatal and let session polling continue.
        if (!isMissingCodeVerifierError(error)) throw error;
        console.warn("[OAuth] Code verifier missing during callback replay; continuing.");
        return;
      }
      triggerAuthRefresh();
      return;
    }
  }
}
