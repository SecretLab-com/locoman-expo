/**
 * OAuth callback screen.
 *
 * After Supabase completes the OAuth flow, the user is redirected here.
 * On web, Supabase detects the hash fragment automatically
 * (detectSessionInUrl: true). On native, we extract the tokens from
 * the deep-link URL and pass them to Supabase manually.
 */
import { ThemedView } from "@/components/themed-view";
import { triggerAuthRefresh } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase-client";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function OAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("[OAuth Callback] Processing...");

        if (Platform.OS !== "web") {
          // Native: extract tokens from the deep-link URL
          const url = await Linking.getInitialURL();
          console.log("[OAuth Callback] Native URL:", url);

          if (url) {
            // Supabase puts tokens in the hash fragment: #access_token=...&refresh_token=...
            const hashIndex = url.indexOf("#");
            if (hashIndex !== -1) {
              const fragment = url.substring(hashIndex + 1);
              const params = new URLSearchParams(fragment);
              const accessToken = params.get("access_token");
              const refreshToken = params.get("refresh_token");

              if (accessToken && refreshToken) {
                console.log("[OAuth Callback] Setting Supabase session from tokens");
                const { error } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                if (error) throw error;
              }
            }
          }
        }

        // At this point, the Supabase client should have a valid session
        // (web: auto-detected from URL, native: set above)
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          console.log("[OAuth Callback] Session established for:", session.user.email);
          setStatus("success");
          triggerAuthRefresh();

          // Small delay for state to propagate
          await new Promise((resolve) => setTimeout(resolve, 300));
          router.replace("/(tabs)");
        } else {
          console.warn("[OAuth Callback] No session after callback");
          setStatus("error");
          setErrorMessage("No session established. Please try again.");
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
  }, [router]);

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
