import { OAuthButtons } from "@/components/oauth-buttons";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { triggerAuthRefresh } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { getHomeRoute } from "@/lib/navigation";
import { supabase } from "@/lib/supabase-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const REMEMBER_ME_KEY = "locomotivate_remember_me";
const SAVED_EMAIL_KEY = "locomotivate_saved_email";

const FormView = Platform.OS === 'web' ? 'form' : View;

export default function LoginScreen() {
  const colors = useColors();
  const { isAuthenticated, loading: authLoading } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved email on mount
  useEffect(() => {
    async function loadSavedCredentials() {
      try {
        const savedRememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
        if (savedRememberMe === "true") {
          setRememberMe(true);
          const savedEmail = await AsyncStorage.getItem(SAVED_EMAIL_KEY);
          if (savedEmail) {
            setEmail(savedEmail);
          }
        }
      } catch (err) {
        console.error("[Login] Failed to load saved credentials:", err);
      }
    }
    loadSavedCredentials();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [authLoading, isAuthenticated]);

  const handleLogin = async (testEmail?: string | any, testPassword?: string) => {
    // Handle both direct calls with test credentials and button press events
    if (typeof testEmail !== 'string') {
      testEmail = undefined;
    }
    await haptics.light();

    const finalEmail = String(testEmail || email || "").trim();
    const finalPassword = testPassword || password;

    if (!finalEmail || !finalPassword) {
      await haptics.error();
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save or clear remember me preference
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, "true");
        await AsyncStorage.setItem(SAVED_EMAIL_KEY, finalEmail);
      } else {
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
        await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
      }

      console.log("[Login] Attempting Supabase sign-in for:", finalEmail);

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password: finalPassword,
      });

      if (signInError) {
        await haptics.error();
        setError(signInError.message || "Invalid email or password");
        return;
      }

      if (data.session) {
        await haptics.success();
        console.log("[Login] Supabase sign-in successful:", data.user?.email);

        // Trigger auth refresh — the useAuth hook will pick up the session
        // and fetch the full user profile from the backend
        triggerAuthRefresh();

        // Small delay to allow auth state to propagate
        await new Promise(resolve => setTimeout(resolve, 300));

        router.replace("/(tabs)");
      } else {
        await haptics.error();
        setError("Login failed — no session returned");
      }
    } catch (err) {
      await haptics.error();
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPress = async () => {
    await haptics.light();
    router.push("/register" as any);
  };

  const handleCancelPress = async () => {
    await haptics.light();
    router.back();
  };

  const handleGuestPress = async () => {
    await haptics.light();
    router.replace("/(tabs)");
  };

  const togglePasswordVisibility = async () => {
    await haptics.light();
    setShowPassword(!showPassword);
  };

  const toggleRememberMe = async (value: boolean) => {
    await haptics.light();
    setRememberMe(value);
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

            {/* Login fields and buttons wrapped in form for web */}
            <View
              {...(Platform.OS === 'web' ? {
                component: 'form',
                onSubmit: (e: any) => {
                  e.preventDefault();
                  handleLogin();
                }
              } : {})}
              className="w-full"
            >
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

              {/* Password Input with Visibility Toggle */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Password</Text>
                <View className="relative">
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 pr-12 text-foreground"
                    placeholder="Enter your password"
                    placeholderTextColor={colors.muted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    className="absolute right-3 top-0 bottom-0 justify-center"
                    onPress={togglePasswordVisibility}
                    activeOpacity={0.7}
                  >
                    <IconSymbol
                      name={showPassword ? "eye.slash.fill" : "eye.fill"}
                      size={22}
                      color={colors.muted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember Me Toggle */}
              <View className="flex-row items-center justify-between mb-6">
                <Text className="text-sm text-foreground">Remember me</Text>
                <Switch
                  value={rememberMe}
                  onValueChange={toggleRememberMe}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={Platform.OS === "android" ? (rememberMe ? colors.primary : colors.surface) : undefined}
                  ios_backgroundColor={colors.border}
                />
              </View>

              {/* Login Button */}
              <TouchableOpacity
                className={`bg-primary rounded-full py-4 items-center mb-4 ${loading ? 'opacity-80' : ''}`}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                testID="login-submit"
              >
                {loading ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color={colors.background} size="small" />
                    <Text className="text-background font-semibold text-lg ml-2">Signing In...</Text>
                  </View>
                ) : (
                  <Text className="text-background font-semibold text-lg">Sign In</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Other Auth Links */}
            <View className="flex-row justify-center">
              <Text className="text-muted">{"Don't have an account? "}</Text>
              <TouchableOpacity onPress={handleRegisterPress}>
                <Text className="text-primary font-semibold">Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Cancel */}
            <TouchableOpacity
              className="mt-4 items-center"
              onPress={handleCancelPress}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Cancel login"
              testID="login-cancel"
            >
              <Text className="text-muted">Cancel</Text>
            </TouchableOpacity>

            {/* Skip for now (guest browsing) */}
            <TouchableOpacity
              className="mt-6 items-center"
              onPress={handleGuestPress}
              accessibilityRole="button"
              accessibilityLabel="Browse as guest"
              testID="login-guest"
            >
              <Text className="text-muted">Browse as guest</Text>
            </TouchableOpacity>

            {/* Test Account Hints */}
            <View className="mt-8 p-4 bg-surface/50 rounded-xl border border-border">
              <Text className="text-xs text-muted text-center mb-2">Test Accounts (password: supertest)</Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                <TouchableOpacity
                  onPress={() => {
                    setEmail("trainer@secretlab.com");
                    setPassword("supertest");
                    handleLogin("trainer@secretlab.com", "supertest");
                  }}
                  className="px-2 py-1 bg-primary/10 rounded"
                  accessibilityRole="button"
                  accessibilityLabel="Fill trainer test account"
                  testID="test-account-trainer"
                >
                  <Text className="text-xs text-primary">Trainer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEmail("client@secretlab.com");
                    setPassword("supertest");
                    handleLogin("client@secretlab.com", "supertest");
                  }}
                  className="px-2 py-1 bg-primary/10 rounded"
                  accessibilityRole="button"
                  accessibilityLabel="Fill client test account"
                  testID="test-account-client"
                >
                  <Text className="text-xs text-primary">Client</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEmail("manager@secretlab.com");
                    setPassword("supertest");
                    handleLogin("manager@secretlab.com", "supertest");
                  }}
                  className="px-2 py-1 bg-primary/10 rounded"
                  accessibilityRole="button"
                  accessibilityLabel="Fill manager test account"
                  testID="test-account-manager"
                >
                  <Text className="text-xs text-primary">Manager</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEmail("testuser@secretlab.com");
                    setPassword("supertest");
                    handleLogin("testuser@secretlab.com", "supertest");
                  }}
                  className="px-2 py-1 bg-primary/10 rounded"
                  accessibilityRole="button"
                  accessibilityLabel="Fill shopper test account"
                  testID="test-account-shopper"
                >
                  <Text className="text-xs text-purple-500">Super User</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setEmail("coordinator@secretlab.com");
                    setPassword("supertest");
                    handleLogin("coordinator@secretlab.com", "supertest");
                  }}
                  className="px-2 py-1 bg-purple-500/10 rounded"
                  accessibilityRole="button"
                  accessibilityLabel="Fill coordinator test account"
                  testID="test-account-coordinator"
                >
                  <Text className="text-xs text-purple-500">Coordinator</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
