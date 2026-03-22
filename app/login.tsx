import { OAuthButtons } from "@/components/oauth-buttons";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LogoLoader } from "@/components/ui/logo-loader";
import { withAlpha } from "@/design-system/color-utils";
import { useAuthContext } from "@/contexts/auth-context";
import { triggerAuthRefresh } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { getHomeRoute } from "@/lib/navigation";
import { clearPendingOnboardingContext, savePendingOnboardingContext } from "@/lib/onboarding-context";
import { supabase } from "@/lib/supabase-client";
import { trpc } from "@/lib/trpc";
import { TEST_LOGIN_ACCOUNTS } from "@/constants/test-login-accounts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

const REMEMBER_ME_KEY = "locomotivate_remember_me";
const SAVED_EMAIL_KEY = "locomotivate_saved_email";
const MIN_BRANDED_LOGIN_LOADER_MS = 2000;

/** Portrait source asset (background.m4v) — used to size cover like `welcome.tsx`. */
const BACKGROUND_VIDEO_ASPECT = 1080 / 1920;

export default function LoginScreen() {
  const colors = useColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  /** Prefer measured container (safe area); fall back to window until `onLayout`. */
  const [backgroundSize, setBackgroundSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const { videoWidth, videoHeight, videoLeft, videoTop } = useMemo(() => {
    const width = backgroundSize?.width ?? windowWidth;
    const height = Math.max(backgroundSize?.height ?? windowHeight, 1);
    const viewportAspectRatio = width / height;
    const videoAspectRatio = BACKGROUND_VIDEO_ASPECT;
    const vw =
      viewportAspectRatio > videoAspectRatio ? width : height * videoAspectRatio;
    const vh =
      viewportAspectRatio > videoAspectRatio ? width / videoAspectRatio : height;
    return {
      videoWidth: vw,
      videoHeight: vh,
      videoLeft: (width - vw) / 2,
      videoTop: (height - vh) / 2,
    };
  }, [backgroundSize?.height, backgroundSize?.width, windowHeight, windowWidth]);

  const handleBackgroundLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setBackgroundSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  const backgroundPlayer = useVideoPlayer(require("../assets/background.m4v"), (video) => {
    video.loop = true;
    video.muted = true;
    video.play();
  });
  const { inviteToken } = useLocalSearchParams<{ inviteToken?: string }>();
  const normalizedInviteToken =
    typeof inviteToken === "string" && inviteToken.trim().length > 0
      ? inviteToken.trim()
      : null;
  const inviteContextQuery = trpc.auth.inviteRegistrationContext.useQuery(
    { token: normalizedInviteToken || "" },
    { enabled: Boolean(normalizedInviteToken) },
  );
  const inviteContext = inviteContextQuery.data;
  const hasInviteEmailLock =
    Boolean(normalizedInviteToken) &&
    typeof inviteContext?.email === "string" &&
    inviteContext.email.length > 0;
  const { isAuthenticated, loading: authLoading, effectiveRole } = useAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginLoaderVisibleUntil, setLoginLoaderVisibleUntil] = useState<number | null>(null);
  const [authRedirectReady, setAuthRedirectReady] = useState(false);

  useEffect(() => {
    if (!inviteContext?.email) return;
    setEmail((prev) => (prev.trim().length > 0 ? prev : inviteContext.email || ""));
  }, [inviteContext?.email]);

  // Load saved email on mount
  useEffect(() => {
    async function loadSavedCredentials() {
      try {
        const savedRememberMe = await AsyncStorage.getItem(REMEMBER_ME_KEY);
        if (savedRememberMe === "true") {
          setRememberMe(true);
          const savedEmail = await AsyncStorage.getItem(SAVED_EMAIL_KEY);
          if (savedEmail && !normalizedInviteToken) {
            setEmail(savedEmail);
          }
        }
      } catch (err) {
        console.error("[Login] Failed to load saved credentials:", err);
      }
    }
    loadSavedCredentials();
  }, [normalizedInviteToken]);

  useEffect(() => {
    if (!loginLoaderVisibleUntil) {
      setAuthRedirectReady(false);
      return;
    }
    const remainingMs = loginLoaderVisibleUntil - Date.now();
    if (remainingMs <= 0) {
      setAuthRedirectReady(true);
      return;
    }
    setAuthRedirectReady(false);
    const timer = setTimeout(() => setAuthRedirectReady(true), remainingMs);
    return () => clearTimeout(timer);
  }, [loginLoaderVisibleUntil]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (normalizedInviteToken) return;
    if (loginLoaderVisibleUntil && !authRedirectReady) return;
    const timer = setTimeout(() => {
      router.replace(getHomeRoute(effectiveRole) as any);
    }, loginLoaderVisibleUntil ? 0 : 800);
    return () => clearTimeout(timer);
  }, [authLoading, authRedirectReady, effectiveRole, isAuthenticated, loginLoaderVisibleUntil, normalizedInviteToken]);

  useEffect(() => {
    if (!normalizedInviteToken) return;
    void savePendingOnboardingContext({ inviteToken: normalizedInviteToken }).catch((err) => {
      console.error("[Login] Failed to persist invite token context:", err);
    });
  }, [normalizedInviteToken]);

  // Web autoplay can fail on initial mount; retry when tab gains focus/visibility.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const tryPlay = async () => {
      if (cancelled) return;
      try {
        backgroundPlayer.loop = true;
        backgroundPlayer.muted = true;
        await Promise.resolve((backgroundPlayer as any).play?.());
      } catch {
        retryTimer = setTimeout(tryPlay, 400);
      }
    };

    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      tryPlay();
    };

    tryPlay();
    if (typeof window !== "undefined") window.addEventListener("focus", onVisible);
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (typeof window !== "undefined") window.removeEventListener("focus", onVisible);
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", onVisible);
    };
  }, [backgroundPlayer]);

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
    const loaderVisibleUntil = Date.now() + MIN_BRANDED_LOGIN_LOADER_MS;
    setLoginLoaderVisibleUntil(loaderVisibleUntil);
    let loginSucceeded = false;

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
        setLoginLoaderVisibleUntil(null);
        return;
      }

      if (data.session) {
        if (normalizedInviteToken) {
          await savePendingOnboardingContext({ inviteToken: normalizedInviteToken });
        } else {
          await clearPendingOnboardingContext();
        }
        await haptics.success();
        console.log("[Login] Supabase sign-in successful:", data.user?.email);
        loginSucceeded = true;

        const remainingLoaderMs = Math.max(0, loaderVisibleUntil - Date.now());
        if (remainingLoaderMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingLoaderMs));
        }

        // Trigger auth refresh — the useAuth hook will pick up the session
        // and fetch the full user profile from the backend
        triggerAuthRefresh();
      } else {
        await haptics.error();
        setError("Login failed — no session returned");
        setLoginLoaderVisibleUntil(null);
      }
    } catch (err) {
      await haptics.error();
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      setLoginLoaderVisibleUntil(null);
    } finally {
      if (!loginSucceeded) {
        setLoading(false);
      }
    }
  };

  const handleRegisterPress = async () => {
    await haptics.light();
    if (normalizedInviteToken) {
      router.push({
        pathname: "/register",
        params: { inviteToken: normalizedInviteToken },
      } as any);
      return;
    }
    router.push("/register" as any);
  };

  const handleCancelPress = async () => {
    await haptics.light();
    setLoginLoaderVisibleUntil(null);
    router.back();
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
      <View
        pointerEvents="none"
        onLayout={handleBackgroundLayout}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" }}
      >
        <VideoView
          player={backgroundPlayer}
          style={{
            position: "absolute",
            left: videoLeft,
            top: videoTop,
            width: videoWidth,
            height: videoHeight,
          }}
          contentFit="cover"
          nativeControls={false}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: "rgba(0,0,0,0.45)",
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {loading ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: withAlpha(colors.background, 0.82),
              paddingHorizontal: 24,
            }}
          >
            <LogoLoader size={120} />
            <Text className="mt-6 text-lg font-semibold" style={{ color: colors.foreground }}>
              Signing In...
            </Text>
          </View>
        ) : null}
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
              <Text className="text-3xl font-bold text-white">LocoMotivate</Text>
              <Text className="text-base text-white/80 mt-2">
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
                if (!normalizedInviteToken) {
                  router.replace(getHomeRoute(effectiveRole) as any);
                }
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
              className="w-full bg-background/80 border border-border/60 rounded-2xl p-4"
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
                  editable={!loading && !hasInviteEmailLock}
                />
                {hasInviteEmailLock ? (
                  <Text className="text-xs text-muted mt-2">
                    Email matches your invitation — sign in with this account.
                  </Text>
                ) : null}
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
                {!loading ? (
                  <Text className="text-background font-semibold text-lg">Sign In</Text>
                ) : null}
              </TouchableOpacity>
            </View>

            {/* Other Auth Links */}
            <View className="flex-row justify-center">
              <Text className="text-white/80">{"Don't have an account? "}</Text>
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
              <Text className="text-white/80">Cancel</Text>
            </TouchableOpacity>

            {/* Quick test account sign-in buttons */}
            <View className="mt-8 pt-4 border-t border-white/30">
              <Text className="text-center text-xs text-white/70 mb-3">Test accounts</Text>
              <View className="flex-row flex-wrap justify-center gap-2">
                {TEST_LOGIN_ACCOUNTS.map((account) => (
                  <TouchableOpacity
                    key={account.testID}
                    className="bg-surface border border-border rounded-full px-3 py-2"
                    onPress={() => handleLogin(account.email, account.password)}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Sign in as ${account.label} test account`}
                    testID={account.testID}
                  >
                    <Text className="text-xs font-medium text-foreground">{account.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
