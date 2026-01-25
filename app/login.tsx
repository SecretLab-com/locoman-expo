import { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { startOAuthLogin } from "@/constants/oauth";
import { OAuthButtons } from "@/components/oauth-buttons";
import { haptics } from "@/hooks/use-haptics";

export default function LoginScreen() {
  const colors = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    await haptics.light();
    
    if (!email.trim() || !password.trim()) {
      await haptics.error();
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call login API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        await haptics.success();
        router.replace("/(tabs)");
      } else {
        await haptics.error();
        const data = await response.json();
        setError(data.message || "Invalid email or password");
      }
    } catch (err) {
      await haptics.error();
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    await haptics.light();
    setLoading(true);
    setError(null);

    try {
      await startOAuthLogin();
    } catch (err) {
      await haptics.error();
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  const handleRegisterPress = async () => {
    await haptics.light();
    router.push("/register" as any);
  };

  const handleGuestPress = async () => {
    await haptics.light();
    router.replace("/(tabs)");
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center px-6 py-8">
            {/* Logo and Title */}
            <View className="items-center mb-10">
              <View className="w-20 h-20 rounded-2xl bg-primary items-center justify-center mb-4">
                <Text className="text-4xl text-background font-bold">L</Text>
              </View>
              <Text className="text-3xl font-bold text-foreground">LocoMotivate</Text>
              <Text className="text-base text-muted mt-2">
                Connect with trainers, achieve your goals
              </Text>
            </View>

            {/* Error Message */}
            {error && (
              <View className="bg-error/10 border border-error rounded-lg p-3 mb-4">
                <Text className="text-error text-center">{error}</Text>
              </View>
            )}

            {/* OAuth Buttons (Apple & Google) */}
            <OAuthButtons
              onSuccess={() => {
                // OAuth success is handled in the component
              }}
              onError={(err) => {
                setError(err.message || "OAuth login failed");
              }}
            />

            {/* Email Input */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-2">Email</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Enter your email"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-2">Password</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Enter your password"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {/* Login Button */}
            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center mb-4"
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text className="text-background font-semibold text-lg">Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Manus OAuth Login Button */}
            <TouchableOpacity
              className="bg-surface border border-border rounded-xl py-4 items-center mb-6"
              onPress={handleOAuthLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text className="text-foreground font-semibold">Continue with Manus</Text>
            </TouchableOpacity>

            {/* Register Link */}
            <View className="flex-row justify-center">
              <Text className="text-muted">Don't have an account? </Text>
              <TouchableOpacity onPress={handleRegisterPress}>
                <Text className="text-primary font-semibold">Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Skip for now (guest browsing) */}
            <TouchableOpacity
              className="mt-6 items-center"
              onPress={handleGuestPress}
            >
              <Text className="text-muted">Browse as guest</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
