import { ScreenContainer } from "@/components/screen-container";
import { signInWithGoogle } from "@/lib/google-oauth";
import { clearPendingOnboardingContext, savePendingOnboardingContext } from "@/lib/onboarding-context";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

export default function RegisterScreen() {
  const { trainerId, inviteToken } = useLocalSearchParams<{ trainerId?: string; inviteToken?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      await savePendingOnboardingContext({
        trainerId: trainerId || null,
        inviteToken: inviteToken || null,
      });
      await signInWithGoogle();
    } catch (err) {
      await clearPendingOnboardingContext();
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-foreground text-center">Create Account</Text>
        <Text className="text-base text-muted text-center mt-3">
          Get paid by clients — without chasing invoices.
        </Text>
        <Text className="text-base text-muted text-center mt-1">
          Invite → Offer → Get paid.
        </Text>

        {error ? (
          <View className="bg-error/10 border border-error rounded-lg p-3 mt-6">
            <Text className="text-error text-center">{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center mt-8"
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-background font-semibold text-lg">Continue with Google</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity className="items-center mt-5" onPress={() => router.push("/login")}>
          <Text className="text-muted">
            Already have an account? <Text className="text-primary font-semibold">Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

