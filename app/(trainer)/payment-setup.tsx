import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
import * as WebBrowser from "expo-web-browser";
import { router, Stack } from "expo-router";
import {
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

const STEPS = [
  {
    title: "Merchant creation",
    description:
      "A dedicated merchant account is created for you on the Adyen platform, linked to this app.",
  },
  {
    title: "Identity verification (KYC)",
    description:
      "Adyen verifies your identity, address, and bank details to comply with UK financial regulations.",
  },
  {
    title: "Payout activation",
    description:
      "Once verified, payouts from client payments are deposited directly into your bank account on a rolling basis.",
  },
] as const;

export default function PaymentSetupScreen() {
  const colors = useColors();
  const {
    data: config,
    isRefetching,
    refetch,
  } = trpc.payments.config.useQuery();
  const { data: payoutSetup } = trpc.payments.payoutSetup.useQuery();

  const isConnected = payoutSetup?.connected === true;

  const openOnboardingPortal = async () => {
    const url = config?.onboardingUrl;
    if (!url) {
      showAlert(
        "Not available",
        "Adyen onboarding is not configured yet. Contact support.",
      );
      return;
    }
    await haptics.light();
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        await Linking.openURL(url);
      }
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <ScreenContainer>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        >
          <ScreenHeader
            title="Payment setup"
            subtitle="Set up your merchant account so you can receive payouts."
            leftSlot={
              <TouchableOpacity
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(trainer)/get-paid" as any)
                }
                className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="payment-setup-back"
              >
                <IconSymbol
                  name="arrow.left"
                  size={20}
                  color={colors.foreground}
                />
              </TouchableOpacity>
            }
          />

          {/* Status banner */}
          <View className="px-4 mb-4">
            {isConnected ? (
              <View className="bg-success/10 border border-success/30 rounded-xl px-4 py-3.5 flex-row items-center">
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={20}
                  color={colors.success}
                />
                <View className="ml-3 flex-1">
                  <Text className="text-success font-semibold text-sm">
                    Merchant account active
                  </Text>
                  <Text className="text-sm text-muted mt-0.5">
                    {payoutSetup?.bankName} ••••
                    {payoutSetup?.accountNumberLast4}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="bg-warning/10 border border-warning/30 rounded-xl px-4 py-3.5 flex-row items-center">
                <IconSymbol
                  name="exclamationmark.triangle.fill"
                  size={20}
                  color={colors.warning}
                />
                <View className="ml-3 flex-1">
                  <Text className="text-warning font-semibold text-sm">
                    Setup required
                  </Text>
                  <Text className="text-sm text-muted mt-0.5">
                    Complete onboarding to start receiving payouts.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* How it works */}
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm font-semibold text-foreground mb-3">
                How it works
              </Text>
              <Text className="text-sm text-muted leading-5 mb-4">
                Adyen, our payment partner, handles merchant onboarding and
                regulatory compliance. The process is quick and only needs to be
                done once.
              </Text>

              <View className="gap-4">
                {STEPS.map((step, index) => (
                  <View key={step.title} className="flex-row items-start">
                    <View className="h-7 w-7 rounded-full bg-primary/10 items-center justify-center mr-3 mt-0.5">
                      <Text className="text-primary text-xs font-bold">
                        {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">
                        {step.title}
                      </Text>
                      <Text className="text-sm text-muted leading-5 mt-0.5">
                        {step.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </SurfaceCard>
          </View>

          {/* What you'll need */}
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm font-semibold text-foreground mb-2">
                What you'll need
              </Text>
              <View className="gap-2">
                <View className="flex-row items-center">
                  <IconSymbol
                    name="person.fill"
                    size={14}
                    color={colors.muted}
                  />
                  <Text className="text-sm text-muted ml-2">
                    A valid photo ID (passport or driving licence)
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <IconSymbol
                    name="building.2.fill"
                    size={14}
                    color={colors.muted}
                  />
                  <Text className="text-sm text-muted ml-2">
                    Your bank account details (sort code &amp; account number)
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <IconSymbol
                    name="envelope.fill"
                    size={14}
                    color={colors.muted}
                  />
                  <Text className="text-sm text-muted ml-2">
                    A valid email address for verification
                  </Text>
                </View>
              </View>
            </SurfaceCard>
          </View>

          {/* CTA */}
          <View className="px-4 pb-8">
            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center flex-row justify-center"
              onPress={openOnboardingPortal}
              accessibilityRole="button"
              accessibilityLabel="Open Adyen merchant onboarding portal"
              testID="payment-setup-open-portal"
            >
              <Text className="text-background font-semibold text-base">
                {isConnected
                  ? "Open Adyen Portal"
                  : "Start Merchant Onboarding"}
              </Text>
              <IconSymbol
                name="arrow.right"
                size={16}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
            <Text className="text-xs text-muted text-center mt-3 leading-4">
              You'll be taken to Adyen's secure portal to complete setup. The
              process typically takes a few minutes.
            </Text>
          </View>
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
