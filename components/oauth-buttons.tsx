import { getApiBaseUrl, startOAuthLogin } from "@/constants/oauth";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import * as Auth from "@/lib/_core/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
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
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/auth/apple`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identityToken,
            user,
            email,
            fullName: fullName ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim() : undefined,
          }),
          credentials: "include",
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
      const shouldUseDevLogin = process.env.EXPO_PUBLIC_DEV_LOGIN === "true";

      if (shouldUseDevLogin) {
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "testuser@secretlab.com", password: "supertest" }),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to authenticate using dev login.");
        }

        const data = await response.json();
        if (data.user) {
          const userInfo: Auth.User = {
            id: data.user.id,
            openId: data.user.openId,
            name: data.user.name ?? null,
            email: data.user.email ?? null,
            phone: data.user.phone ?? null,
            photoUrl: data.user.photoUrl ?? null,
            loginMethod: data.user.loginMethod ?? null,
            role: data.user.role ?? "shopper",
            username: data.user.username ?? null,
            bio: data.user.bio ?? null,
            specialties: data.user.specialties ?? null,
            socialLinks: data.user.socialLinks ?? null,
            trainerId: data.user.trainerId ?? null,
            active: data.user.active ?? true,
            metadata: data.user.metadata ?? null,
            createdAt: data.user.createdAt ? new Date(data.user.createdAt) : new Date(),
            updatedAt: data.user.updatedAt ? new Date(data.user.updatedAt) : new Date(),
            lastSignedIn: data.user.lastSignedIn ? new Date(data.user.lastSignedIn) : new Date(),
          };
          await Auth.setUserInfo(userInfo);
        }

        if (Platform.OS !== "web" && data.sessionToken) {
          await Auth.setSessionToken(data.sessionToken);
        }

        await refresh();
        onSuccess?.();
        router.replace("/(tabs)");
        return;
      }

      // Use the centralized OAuth login flow which handles web + native
      await startOAuthLogin();
      // The OAuth callback will handle the rest via deep link
      onSuccess?.();
    } catch (error: any) {
      console.error("Google Sign In error detailed:", error);
      const errorMessage = error?.message || String(error);

      Alert.alert(
        "Login Failed",
        `Details: ${errorMessage}\n\nIf variables were recently added to .env, please restart your dev server with 'npx expo start --clear'.`,
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

      {/* Google/Manus OAuth Sign In */}
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
