import { useState, useEffect } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { startOAuthLogin, getApiBaseUrl } from "@/constants/oauth";
import { OAuthButtons } from "@/components/oauth-buttons";
import { haptics } from "@/hooks/use-haptics";
import { IconSymbol } from "@/components/ui/icon-symbol";

const REMEMBER_ME_KEY = "locomotivate_remember_me";
const SAVED_EMAIL_KEY = "locomotivate_saved_email";

export default function LoginScreen() {
  const colors = useColors();
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
      // Save or clear remember me preference
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, "true");
        await AsyncStorage.setItem(SAVED_EMAIL_KEY, email.trim());
      } else {
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
        await AsyncStorage.removeItem(SAVED_EMAIL_KEY);
      }

      // Call login API with correct base URL
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (response.ok) {
        await haptics.success();
        const data = await response.json();
        const userRole = data.user?.role || "shopper";
        
        // Navigate to appropriate dashboard based on role
        let targetRoute = "/(tabs)";
        if (userRole === "trainer") {
          targetRoute = "/(trainer)";
        } else if (userRole === "client") {
          targetRoute = "/(client)";
        } else if (userRole === "manager") {
          targetRoute = "/(manager)";
        } else if (userRole === "coordinator") {
          targetRoute = "/(coordinator)";
        }
        
        // Navigate to the appropriate dashboard
        if (Platform.OS === "web" && typeof window !== "undefined") {
          window.location.href = targetRoute;
        } else {
          router.replace(targetRoute as any);
        }
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

            {/* Test Account Hints */}
            <View className="mt-8 p-4 bg-surface/50 rounded-xl border border-border">
              <Text className="text-xs text-muted text-center mb-2">Test Accounts (password: supertest)</Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                <TouchableOpacity
                  onPress={() => { setEmail("trainer@secretlab.com"); setPassword("supertest"); }}
                  className="px-2 py-1 bg-primary/10 rounded"
                >
                  <Text className="text-xs text-primary">Trainer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEmail("client@secretlab.com"); setPassword("supertest"); }}
                  className="px-2 py-1 bg-primary/10 rounded"
                >
                  <Text className="text-xs text-primary">Client</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEmail("manager@secretlab.com"); setPassword("supertest"); }}
                  className="px-2 py-1 bg-primary/10 rounded"
                >
                  <Text className="text-xs text-primary">Manager</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEmail("testuser@secretlab.com"); setPassword("supertest"); }}
                  className="px-2 py-1 bg-primary/10 rounded"
                >
                  <Text className="text-xs text-primary">Shopper</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEmail("coordinator@secretlab.com"); setPassword("supertest"); }}
                  className="px-2 py-1 bg-purple-500/10 rounded"
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
