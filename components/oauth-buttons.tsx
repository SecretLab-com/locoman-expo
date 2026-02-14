import { triggerAuthRefresh } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { signInWithGoogle } from "@/lib/google-oauth";
import { supabase } from "@/lib/supabase-client";
import * as AppleAuthentication from "expo-apple-authentication";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

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
      await signInWithGoogle();
      // Web OAuth redirects away immediately and does not have a session yet here.
      // Calling onSuccess early can trigger route churn (/ -> /welcome) before callback.
      if (Platform.OS !== "web") {
        onSuccess?.();
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
