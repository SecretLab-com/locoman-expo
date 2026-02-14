/**
 * OAuth callback screen.
 *
 * After Supabase completes the OAuth flow, the user is redirected here
 * via the exp:// deep link. We extract the tokens or auth code from the
 * URL and establish the Supabase session.
 */
import { ThemedView } from "@/components/themed-view";
import { triggerAuthRefresh } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase-client";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const handleCallback = async () => {
      try {
        console.log("[OAuth Callback] Processing...", {
          hasCode: !!params.code,
          hasAccessToken: !!params.access_token,
          platform: Platform.OS,
        });

        if (Platform.OS === "web") {
          let resolvedSession = (await supabase.auth.getSession()).data.session ?? null;

          // Web callbacks may include tokens in hash/query; set them directly so we can
          // deterministically escape /oauth/callback even if detectSessionInUrl races.
          if (!resolvedSession && typeof window !== "undefined") {
            const currentUrl = new URL(window.location.href);
            const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
            const queryParams = currentUrl.searchParams;

            const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");
            const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
            const code = queryParams.get("code");

            // Strip large OAuth payload from the URL immediately to avoid reprocessing loops.
            if (currentUrl.hash || currentUrl.search) {
              window.history.replaceState({}, "", "/oauth/callback");
            }

            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (error) throw error;
            } else if (code) {
              const { error } = await supabase.auth.exchangeCodeForSession(code);
              if (error) throw error;
            }

            resolvedSession = (await supabase.auth.getSession()).data.session ?? null;
          }

          if (!resolvedSession) {
            setStatus("error");
            setErrorMessage("Authentication did not complete. Please try again.");
            return;
          }

          console.log("[OAuth Callback] Session established for:", resolvedSession.user.email);
          setStatus("success");
          triggerAuthRefresh();
          // Use a hard navigation on web to guarantee we leave /oauth/callback.
          if (typeof window !== "undefined") {
            window.location.replace("/");
          } else {
            await new Promise((resolve) => setTimeout(resolve, 300));
            router.replace("/");
          }
          return;
        }

        // 1. Prefer token params first.
        // Native callback bridges may include code/state and tokens together.
        if (params.access_token && params.refresh_token) {
          console.log("[OAuth Callback] Setting session from token params...");
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token as string,
            refresh_token: params.refresh_token as string,
          });
          if (error) throw error;
        }

        // 2. On native, also check the full URL for hash fragment tokens
        if (!params.access_token) {
          const url = await Linking.getInitialURL();
          console.log("[OAuth Callback] Checking initial URL:", url?.substring(0, 80));

          if (url) {
            const hashIndex = url.indexOf("#");
            if (hashIndex !== -1) {
              const fragment = new URLSearchParams(url.substring(hashIndex + 1));
              const accessToken = fragment.get("access_token");
              const refreshToken = fragment.get("refresh_token");

              if (accessToken && refreshToken) {
                console.log("[OAuth Callback] Setting session from hash fragment...");
                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                if (error) throw error;
              }
            }

            // Also check query string in the full URL for tokens
            const queryStart = url.indexOf("?");
            if (queryStart !== -1) {
              const query = new URLSearchParams(url.substring(queryStart + 1).split("#")[0]);
              const accessToken = query.get("access_token");
              const refreshToken = query.get("refresh_token");
              if (accessToken && refreshToken) {
                console.log("[OAuth Callback] Setting session from URL query tokens...");
                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                if (error) throw error;
              }
            }
          }
        }

        // 3. Code exchange fallback (mainly web/PKCE-only callbacks).
        // Run after token handling so malformed code responses can't mask valid tokens.
        if (!params.access_token && params.code) {
          console.log("[OAuth Callback] Exchanging code for session...");
          const { error } = await supabase.auth.exchangeCodeForSession(params.code as string);
          if (error) throw error;
        }

        // 4. Check if we now have a valid session
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          console.log("[OAuth Callback] Session established for:", session.user.email);
          setStatus("success");
          triggerAuthRefresh();
          await new Promise((resolve) => setTimeout(resolve, 300));
          router.replace("/");
        } else {
          console.warn("[OAuth Callback] No session after processing");
          setStatus("error");
          setErrorMessage("Authentication did not complete. Please try again.");
        }
      } catch (error) {
        console.error("[OAuth Callback] Error:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to complete authentication",
        );
      }
    };

    handleCallback();
  }, []);

  return (
    <SafeAreaView className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <ThemedView className="flex-1 items-center justify-center gap-4 p-5">
        {status === "processing" && (
          <>
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-base leading-6 text-center text-foreground">
              Completing authentication...
            </Text>
          </>
        )}
        {status === "success" && (
          <Text className="text-base leading-6 text-center text-foreground">
            Authentication successful! Redirecting...
          </Text>
        )}
        {status === "error" && (
          <>
            <Text className="mb-2 text-xl font-bold leading-7 text-error">
              Authentication failed
            </Text>
            <Text className="text-base leading-6 text-center text-foreground">
              {errorMessage}
            </Text>
          </>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}
