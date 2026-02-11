import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { signInWithGoogle } from "@/lib/google-oauth";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { clearPendingOnboardingContext, savePendingOnboardingContext } from "@/lib/onboarding-context";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen() {
  const colors = useColors();
  const { trainerId, inviteToken } = useLocalSearchParams<{ trainerId: string; inviteToken: string }>();

  const [step, setStep] = useState(1); // 1: Account, 2: Trainer Selection
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(trainerId || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: trainers, isLoading: trainersLoading } = trpc.catalog.trainers.useQuery(undefined, {
    enabled: step === 2 && !trainerId
  });

  const validateCredentials = () => {
    if (!name.trim()) {
      setError("Please enter your name");
      return false;
    }
    if (!email.trim()) {
      setError("Please enter your email");
      return false;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email");
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    await haptics.light();
    if (validateCredentials()) {
      if (trainerId) {
        handleRegister();
      } else {
        setStep(2);
      }
    }
  };

  const handleRegister = async () => {
    if (!validateCredentials()) return;

    setLoading(true);
    setError(null);

    try {
      await savePendingOnboardingContext({
        trainerId: selectedTrainerId || trainerId || null,
        inviteToken: inviteToken || null,
      });
      // Registration is Supabase OAuth-first. Profile details are completed post-auth.
      await signInWithGoogle();
    } catch (err) {
      await clearPendingOnboardingContext();
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthRegister = async () => {
    setLoading(true);
    setError(null);

    try {
      await savePendingOnboardingContext({
        trainerId: selectedTrainerId || trainerId || null,
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 ? (
            <View className="flex-1 justify-center px-6 py-8">
              {/* Header */}
              <View className="items-center mb-8">
                <Text className="text-3xl font-bold text-foreground">Create Account</Text>
                <Text className="text-base text-muted mt-2">
                  {trainerId ? "Join your trainer on LocoMotivate" : "Join LocoMotivate today"}
                </Text>
                <Text className="text-xs text-muted mt-2 text-center px-4">
                  Account creation is completed with Google sign-in.
                </Text>
              </View>

              {/* Error Message */}
              {error && (
                <View className="bg-error/10 border border-error rounded-lg p-3 mb-4">
                  <Text className="text-error text-center">{error}</Text>
                </View>
              )}

              {/* Name Input */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Full Name</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Enter your name"
                  placeholderTextColor={colors.muted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>

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

              <View className="mb-6" />

              {/* Next/Register Button */}
              <TouchableOpacity
                className="bg-primary rounded-xl py-4 items-center mb-4"
                onPress={handleNextStep}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text className="text-background font-semibold text-lg">
                    {trainerId ? "Create Account" : "Next: Pick a Trainer"}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View className="flex-row items-center my-6">
                <View className="flex-1 h-px bg-border" />
                <Text className="mx-4 text-muted">or</Text>
                <View className="flex-1 h-px bg-border" />
              </View>

              {/* OAuth Register Button */}
              <TouchableOpacity
                className="bg-surface border border-border rounded-xl py-4 items-center mb-6"
                onPress={handleOAuthRegister}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text className="text-foreground font-semibold">Continue with Google (Required)</Text>
              </TouchableOpacity>

              {/* Login Link */}
              <View className="flex-row justify-center">
                <Text className="text-muted">Already have an account? </Text>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text className="text-primary font-semibold">Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="flex-1 px-6 py-8">
              {/* Header */}
              <View className="mb-8 items-center">
                <Text className="text-3xl font-bold text-foreground">Find a Trainer</Text>
                <Text className="text-base text-muted mt-2 text-center">
                  Choose the fitness professional you would like to work with.
                </Text>
              </View>

              {trainersLoading ? (
                <View className="flex-1 items-center justify-center py-12">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <View className="flex-1">
                  {trainers?.map((trainer) => (
                    <TouchableOpacity
                      key={trainer.id}
                      onPress={() => {
                        haptics.light();
                        setSelectedTrainerId(trainer.id);
                      }}
                      className={`flex-row items-center p-4 rounded-2xl mb-4 border ${selectedTrainerId === trainer.id
                        ? "bg-primary/5 border-primary"
                        : "bg-surface border-border"
                        }`}
                    >
                      <View className="w-12 h-12 rounded-full bg-muted/20 items-center justify-center overflow-hidden">
                        {trainer.photoUrl ? (
                          <Image
                            source={{ uri: trainer.photoUrl }}
                            className="w-full h-full"
                          />
                        ) : (
                          <Text className="text-lg font-bold text-muted">
                            {trainer.name?.[0] || "?"}
                          </Text>
                        )}
                      </View>
                      <View className="flex-1 ml-4">
                        <Text className="text-lg font-semibold text-foreground">
                          {trainer.name}
                        </Text>
                        <Text className="text-sm text-muted" numberOfLines={1}>
                          {trainer.bio || "Fitness Professional"}
                        </Text>
                      </View>
                      {selectedTrainerId === trainer.id && (
                        <IconSymbol
                          name="checkmark.circle.fill"
                          size={24}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    className={`rounded-xl py-4 items-center mt-6 ${selectedTrainerId ? "bg-primary" : "bg-muted"
                      }`}
                    onPress={handleRegister}
                    disabled={!selectedTrainerId || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text className="text-background font-semibold text-lg">
                        Complete Registration
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setStep(1)}
                    className="py-4 items-center mt-2"
                  >
                    <Text className="text-muted">Back to Account info</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
