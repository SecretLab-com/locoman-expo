import { triggerAuthRefresh } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { supabase } from "@/lib/supabase-client";
import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Ensure web browser redirects are handled
WebBrowser.maybeCompleteAuthSession();

interface OAuthButtonsProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function OAuthButtons({ onSuccess, onError }: OAuthButtonsProps) {
  const colors = useColors();

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        if (error) throw error;
        triggerAuthRefresh();
        onSuccess?.();
      }
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") return;
      console.error("Apple Sign In error:", error);
      onError?.(error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      if (Platform.OS === "web") {
        // Web: use Supabase OAuth redirect (works natively in browser)
        const redirectTo = `${window.location.origin}/oauth/callback`;
        console.log("[OAuth] Web: starting Supabase OAuth, redirectTo:", redirectTo);
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) throw error;
        onSuccess?.();
        return;
      }

      // Native: use Supabase signInWithOAuth + WebBrowser
      // The redirect URL must be in Supabase's allowed redirect URLs
      const redirectTo = makeRedirectUri();
      console.log("[OAuth] Native: redirect URI:", redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("No OAuth URL returned");

      console.log("[OAuth] Opening Supabase OAuth URL:", data.url);

      // Open the auth URL in an in-app browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      console.log("[OAuth] WebBrowser result:", result.type);

      if (result.type === "success" && result.url) {
        // Extract the tokens from the redirect URL
        // Supabase puts them in the hash fragment: #access_token=...&refresh_token=...
        const url = result.url;
        console.log("[OAuth] Redirect URL received:", url.substring(0, 100));

        // Parse hash fragment parameters
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) {
          const fragment = url.substring(hashIndex + 1);
          const params = new URLSearchParams(fragment);
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");

          if (accessToken && refreshToken) {
            console.log("[OAuth] Setting Supabase session from tokens...");
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;

            console.log("[OAuth] Session set successfully!");
            triggerAuthRefresh();
            onSuccess?.();
            return;
          }
        }

        // Fallback: try query params (for PKCE flow)
        const queryIndex = url.indexOf("?");
        if (queryIndex !== -1) {
          const queryParams = new URLSearchParams(url.substring(queryIndex + 1));
          const code = queryParams.get("code");
          if (code) {
            console.log("[OAuth] Exchanging code for session...");
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
            triggerAuthRefresh();
            onSuccess?.();
            return;
          }
        }

        console.warn("[OAuth] No tokens or code found in redirect URL");
      } else if (result.type === "cancel" || result.type === "dismiss") {
        console.log("[OAuth] User cancelled sign-in");
      }
    } catch (error: any) {
      console.error("Google Sign In error:", error);
      Alert.alert(
        "Login Failed",
        error?.message || "An error occurred during Google sign in.",
      );
      onError?.(error);
    }
  };

  return (
    <View className="gap-3">
      {/* Apple Sign In - iOS only */}
      {Platform.OS === "ios" && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
          accessibilityLabel="Continue with Apple"
          testID="oauth-apple"
        />
      )}

      {/* Google OAuth Sign In */}
      <TouchableOpacity
        className="flex-row items-center justify-center border border-border rounded-xl py-4 px-6"
        onPress={handleGoogleSignIn}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        testID="oauth-google"
        style={{ backgroundColor: colors.surface }}
      >
        <View className="w-5 h-5 mr-3">
          <GoogleIcon />
        </View>
        <Text className="font-semibold text-base" style={{ color: colors.foreground }}>
          Continue with Google
        </Text>
      </TouchableOpacity>

      {/* Divider */}
      <View className="flex-row items-center my-2">
        <View className="flex-1 h-px bg-border" />
        <Text className="text-muted mx-4 text-sm">or</Text>
        <View className="flex-1 h-px bg-border" />
      </View>
    </View>
  );
}

function GoogleIcon() {
  return (
    <View style={{ width: 20, height: 20 }}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: "#4285F4",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "bold", fontSize: 12 }}>G</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appleButton: {
    width: "100%",
    height: 52,
  },
});
