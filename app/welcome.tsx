import { ScreenContainer } from "@/components/screen-container";
import { TEST_LOGIN_ACCOUNTS } from "@/constants/test-login-accounts";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { triggerAuthRefresh } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase-client";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type OnboardingSlide = {
  title: string;
  body: string;
};

const SLIDES: OnboardingSlide[] = [
  {
    title: "Get paid by clients — without chasing invoices",
    body: "Fast payments, simple setup, zero finance jargon.",
  },
  {
    title: "Invite → Offer → Get paid",
    body: "Everything is built around the shortest path to earnings.",
  },
  {
    title: "Invite your first client",
    body: "Start now. You can add advanced settings later under More.",
  },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const { isAuthenticated, loading } = useAuthContext();
  const [index, setIndex] = useState(0);
  const [testLoginLoading, setTestLoginLoading] = useState<string | null>(null);
  const [testLoginError, setTestLoginError] = useState<string | null>(null);
  const current = useMemo(() => SLIDES[index], [index]);
  const isLast = index === SLIDES.length - 1;

  useEffect(() => {
    if (loading || !isAuthenticated) return;
    const timer = setTimeout(() => {
      router.replace("/");
    }, 800);
    return () => clearTimeout(timer);
  }, [isAuthenticated, loading]);

  const handleQuickTestLogin = async (email: string, password: string, label: string) => {
    await haptics.light();
    setTestLoginError(null);
    setTestLoginLoading(label);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new Error(error?.message || "Test login failed");
      }
      triggerAuthRefresh();
      await new Promise((resolve) => setTimeout(resolve, 300));
      router.replace("/");
    } catch (err) {
      await haptics.error();
      setTestLoginError(err instanceof Error ? err.message : "Test login failed");
    } finally {
      setTestLoginLoading(null);
    }
  };

  const next = async () => {
    await haptics.light();
    if (isLast) {
      router.push("/register");
      return;
    }
    setIndex((value) => Math.min(value + 1, SLIDES.length - 1));
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View className="flex-1 px-6 justify-between py-8">
        <View className="items-center pt-8">
          <Text className="text-3xl font-black text-foreground">LocoMotive</Text>
          <Text className="text-sm text-muted mt-2">Simple beats powerful.</Text>
        </View>

        <View className="bg-surface border border-border rounded-2xl p-6">
          <Text className="text-xs text-muted mb-2">Step {index + 1} of {SLIDES.length}</Text>
          <Text className="text-2xl font-bold text-foreground">{current.title}</Text>
          <Text className="text-base text-muted mt-2">{current.body}</Text>
          <View className="flex-row mt-4">
            {SLIDES.map((_, slideIndex) => (
              <View
                key={slideIndex}
                className={`h-1.5 rounded-full mr-2 ${slideIndex === index ? "bg-primary w-8" : "bg-border w-4"}`}
              />
            ))}
          </View>
        </View>

        <View>
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center mb-3"
            onPress={next}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Get started" : "Next onboarding step"}
            testID="welcome-next"
          >
            <Text className="text-background font-semibold text-lg">{isLast ? "Get Started" : "Next"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-surface border border-border rounded-xl py-4 items-center mb-3"
            onPress={async () => {
              await haptics.light();
              router.push("/login");
            }}
            accessibilityRole="button"
            accessibilityLabel="Open sign in screen"
            testID="welcome-sign-in"
          >
            <Text className="text-foreground font-semibold">Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="items-center py-2"
            onPress={async () => {
              await haptics.light();
              router.replace("/(tabs)/products?guest=true");
            }}
            accessibilityRole="button"
            accessibilityLabel="Continue as guest"
            testID="welcome-guest"
          >
            <Text className="text-muted">Continue as guest</Text>
          </TouchableOpacity>

          <View className="mt-6 pt-4 border-t border-border/70">
            <Text className="text-center text-xs text-muted mb-3">Test logins</Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {TEST_LOGIN_ACCOUNTS.map((account) => {
                const isCurrentLoading = testLoginLoading === account.label;
                return (
                  <TouchableOpacity
                    key={`welcome-${account.testID}`}
                    className="bg-surface border border-border rounded-full px-3 py-2"
                    onPress={() =>
                      handleQuickTestLogin(account.email, account.password, account.label)
                    }
                    disabled={Boolean(testLoginLoading)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Sign in as ${account.label} test account`}
                    testID={`welcome-${account.testID}`}
                  >
                    <View className="flex-row items-center">
                      {isCurrentLoading ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : null}
                      <Text className={`text-xs font-medium text-foreground ${isCurrentLoading ? "ml-2" : ""}`}>
                        {account.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            {testLoginError ? (
              <Text className="text-center text-xs text-error mt-3">{testLoginError}</Text>
            ) : null}
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

