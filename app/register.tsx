import { ScreenContainer } from "@/components/screen-container";
import { triggerAuthRefresh } from "@/hooks/use-auth";
import { signInWithGoogle } from "@/lib/google-oauth";
import { clearPendingOnboardingContext, savePendingOnboardingContext } from "@/lib/onboarding-context";
import { supabase } from "@/lib/supabase-client";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function RegisterScreen() {
  const { trainerId, inviteToken } = useLocalSearchParams<{ trainerId?: string; inviteToken?: string }>();
  const normalizedInviteToken =
    typeof inviteToken === "string" && inviteToken.trim().length > 0 ? inviteToken.trim() : undefined;
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const inviteContextQuery = trpc.auth.inviteRegistrationContext.useQuery(
    { token: normalizedInviteToken || "" },
    { enabled: Boolean(normalizedInviteToken) },
  );
  const inviteContext = inviteContextQuery.data;
  const hasInviteEmailLock =
    Boolean(normalizedInviteToken) && typeof inviteContext?.email === "string" && inviteContext.email.length > 0;

  useEffect(() => {
    if (!inviteContext) return;
    if (inviteContext.email) {
      setEmail(inviteContext.email);
    }
    if (inviteContext.name) {
      setFullName((prev) => (prev.trim().length > 0 ? prev : inviteContext.name || ""));
    }
  }, [inviteContext]);

  const handleRegister = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      await savePendingOnboardingContext({
        trainerId: trainerId || null,
        inviteToken: normalizedInviteToken || null,
      });
      await signInWithGoogle();
    } catch (err) {
      await clearPendingOnboardingContext();
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailRegister = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please enter email and password");
      return;
    }

    setEmailLoading(true);
    setError(null);
    try {
      await savePendingOnboardingContext({
        trainerId: trainerId || null,
        inviteToken: normalizedInviteToken || null,
      });

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim() || undefined,
            invite_token: normalizedInviteToken || undefined,
          },
        },
      });

      if (signUpError) {
        await clearPendingOnboardingContext();
        setError(signUpError.message || "Registration failed");
        return;
      }

      if (!data.session) {
        await clearPendingOnboardingContext();
        setError("Check your email to confirm your account, then sign in.");
        return;
      }

      triggerAuthRefresh();
      router.replace("/");
    } catch (err) {
      await clearPendingOnboardingContext();
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center px-6 py-8">
            <Text className="text-3xl font-bold text-foreground text-center">Create Account</Text>
            <Text className="text-base text-muted text-center mt-3">
              Get paid by clients - without chasing invoices.
            </Text>
            <Text className="text-base text-muted text-center mt-1">
              Invite to Offer to Get paid.
            </Text>

            {error ? (
              <View className="bg-error/10 border border-error rounded-lg p-3 mt-6">
                <Text className="text-error text-center">{error}</Text>
              </View>
            ) : null}

            <View className="mt-8">
              <Text className="text-sm font-medium text-foreground mb-2">Full name (optional)</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Enter your full name"
                placeholderTextColor="#94A3B8"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                editable={!googleLoading && !emailLoading}
              />
            </View>

            <View className="mt-4">
              <Text className="text-sm font-medium text-foreground mb-2">Email</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Enter your email"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!googleLoading && !emailLoading && !hasInviteEmailLock}
              />
              {hasInviteEmailLock ? (
                <Text className="text-xs text-muted mt-2">
                  Email is locked to your invite.
                </Text>
              ) : null}
            </View>

            <View className="mt-4">
              <Text className="text-sm font-medium text-foreground mb-2">Password</Text>
              <TextInput
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="Create a password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!googleLoading && !emailLoading}
              />
            </View>

            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center mt-6"
              onPress={handleEmailRegister}
              disabled={googleLoading || emailLoading || (Boolean(normalizedInviteToken) && inviteContextQuery.isLoading)}
              accessibilityRole="button"
              accessibilityLabel="Create account with email and password"
              testID="register-email-submit"
            >
              {emailLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-background font-semibold text-lg">Create account</Text>
              )}
            </TouchableOpacity>

            <Text className="text-muted text-center mt-5">or</Text>

            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center mt-5"
              onPress={handleRegister}
              disabled={googleLoading || emailLoading || (Boolean(normalizedInviteToken) && inviteContextQuery.isLoading)}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              testID="register-google-submit"
            >
              {googleLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-background font-semibold text-lg">Continue with Google</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="items-center mt-5"
              onPress={() =>
                router.push({
                  pathname: "/login",
                  params: normalizedInviteToken ? { inviteToken: normalizedInviteToken } : undefined,
                } as any)
              }
              accessibilityRole="button"
              accessibilityLabel="Open sign in screen"
              testID="register-open-login"
            >
              <Text className="text-muted">
                Already have an account? <Text className="text-primary font-semibold">Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

