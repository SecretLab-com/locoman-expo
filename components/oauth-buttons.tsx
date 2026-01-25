import { View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { router } from "expo-router";

// Ensure web browser redirects are handled
WebBrowser.maybeCompleteAuthSession();

interface OAuthButtonsProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function OAuthButtons({ onSuccess, onError }: OAuthButtonsProps) {
  const colors = useColors();
  const { refresh } = useAuthContext();

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Extract user info from credential
      const { user, email, fullName, identityToken } = credential;
      
      if (identityToken) {
        // Send to backend for verification and session creation
        const response = await fetch("/api/auth/apple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityToken,
            user,
            email,
            fullName: fullName ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim() : undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            await refresh();
            onSuccess?.();
            router.replace("/(tabs)");
          }
        } else {
          throw new Error("Failed to authenticate with Apple");
        }
      }
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        // User canceled, do nothing
        return;
      }
      console.error("Apple Sign In error:", error);
      onError?.(error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Open Google OAuth flow in browser
      const result = await WebBrowser.openAuthSessionAsync(
        `/api/auth/google`,
        "exp://localhost:8081/oauth/callback"
      );

      if (result.type === "success" && result.url) {
        // The OAuth callback will handle the rest
        onSuccess?.();
      }
    } catch (error: any) {
      console.error("Google Sign In error:", error);
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
        />
      )}

      {/* Google Sign In */}
      <TouchableOpacity
        className="flex-row items-center justify-center bg-white border border-border rounded-xl py-4 px-6"
        onPress={handleGoogleSignIn}
        activeOpacity={0.8}
      >
        <View className="w-5 h-5 mr-3">
          <GoogleIcon />
        </View>
        <Text className="text-gray-800 font-semibold text-base">
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

// Google icon SVG component
function GoogleIcon() {
  return (
    <View style={{ width: 20, height: 20 }}>
      {/* Simplified Google "G" representation */}
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
