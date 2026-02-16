import { AdyenCheckout } from "@/components/adyen-checkout";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trackLaunchEvent } from "@/lib/analytics";
import { formatGBP, toMinorUnits } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    Share,
  StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type PayMode = "tap" | "link";

const FUNCTION_BANNER_IMAGE_URLS = {
  tap: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=1400&q=80",
  link: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=1400&q=80",
} as const;

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function GetPaidScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<PayMode>("tap");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tapSession, setTapSession] = useState<{
    sessionId: string;
    sessionData: string;
    clientKey: string;
    environment: string;
  } | null>(null);

  const { data: payoutSummary } = trpc.payments.payoutSummary.useQuery();
  const { data: payoutSetup } = trpc.payments.payoutSetup.useQuery();
  const utils = trpc.useUtils();
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankSortCode, setBankSortCode] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  useEffect(() => {
    if (params.mode === "link") {
      setMode("link");
      return;
    }
    if (params.mode === "tap") {
      setMode("tap");
    }
  }, [params.mode]);

  const createSession = trpc.payments.createSession.useMutation({
    onSuccess: (result) => {
      setTapSession({
        sessionId: result.sessionId,
        sessionData: result.sessionData,
        clientKey: result.clientKey,
        environment: result.environment,
      });
      trackLaunchEvent("trainer_tap_to_pay_started", { amountMinor: toMinorUnits(parseFloat(amount || "0")) });
    },
    onError: (err) => showAlert("Tap to Pay Error", err.message),
  });

  const createLink = trpc.payments.createLink.useMutation({
    onSuccess: (result) => {
      setPaymentLink(result.linkUrl);
      trackLaunchEvent("trainer_payment_link_created", { amountMinor: toMinorUnits(parseFloat(amount || "0")) });
      void utils.payments.payoutSummary.invalidate();
    },
    onError: (err) => showAlert("Payment Link Error", err.message),
  });

  const isSubmitting = createSession.isPending || createLink.isPending;
  const connectPayoutBank = trpc.payments.connectPayoutBank.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.payments.payoutSetup.invalidate(), utils.payments.payoutSummary.invalidate()]);
      setShowBankForm(false);
      setBankAccountNumber("");
      showAlert("Bank connected", "Your payout bank details are saved.");
    },
    onError: (err) => showAlert("Bank setup error", err.message),
  });

  useEffect(() => {
    if (!payoutSetup?.connected) return;
    setBankAccountHolder(payoutSetup.accountHolderName || "");
    setBankName(payoutSetup.bankName || "");
    setBankSortCode(payoutSetup.sortCode || "");
    setBankAccountNumber("");
  }, [payoutSetup]);

  const handleSubmit = async () => {
    await haptics.light();
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      showAlert("Invalid amount", "Enter a valid amount in GBP.");
      return;
    }
    const amountMinor = toMinorUnits(value);
    const safeDescription = description.trim() || "Training session";

    if (mode === "tap") {
      createSession.mutate({
        amountMinor,
        description: safeDescription,
        method: "tap",
      });
      return;
    }

    createLink.mutate({
      amountMinor,
      description: safeDescription,
    });
  };

  const copyToClipboard = async (value: string) => {
    try {
      if (Platform.OS === "web" && navigator?.clipboard) {
        await navigator.clipboard.writeText(value);
      } else {
        const Clipboard = require("expo-clipboard");
        await Clipboard.setStringAsync(value);
      }
      showAlert("Copied", "Payment link copied.");
    } catch {
      showAlert("Copy failed", "Could not copy the payment link.");
    }
  };

  const shareLink = async (value: string) => {
    try {
      await Share.share({ message: `Please complete your payment: ${value}`, url: value });
    } catch {
      await copyToClipboard(value);
    }
  };

  const formatSortCode = (rawValue: string) => {
    const digits = rawValue.replace(/\D/g, "").slice(0, 6);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  };

  const handleConnectBank = async () => {
    await haptics.light();
    if (!bankAccountHolder.trim()) {
      showAlert("Missing field", "Enter the account holder name.");
      return;
    }
    if (!bankName.trim()) {
      showAlert("Missing field", "Enter the bank name.");
      return;
    }
    const sortCodeDigits = bankSortCode.replace(/\D/g, "");
    if (sortCodeDigits.length !== 6) {
      showAlert("Invalid sort code", "Sort code must be 6 digits.");
      return;
    }
    const accountDigits = bankAccountNumber.replace(/\D/g, "");
    if (accountDigits.length < 6 || accountDigits.length > 10) {
      showAlert("Invalid account number", "Account number must be between 6 and 10 digits.");
      return;
    }

    connectPayoutBank.mutate({
      accountHolderName: bankAccountHolder.trim(),
      bankName: bankName.trim(),
      sortCode: sortCodeDigits,
      accountNumber: accountDigits,
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        utils.payments.payoutSummary.invalidate(),
        utils.payments.payoutSetup.invalidate(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <ScreenHeader
          title="Get Paid"
          subtitle="Fast, simple payments for in-person or remote clients."
        />

        <View className="px-4 mb-4">
          <SurfaceCard className="overflow-hidden p-0">
            <View className="px-4 py-4 border-b border-border relative overflow-hidden">
              <Image
                source={{ uri: FUNCTION_BANNER_IMAGE_URLS[mode] }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
              />
              <View
                className={`absolute inset-0 ${mode === "tap" ? "bg-primary/60" : "bg-success/60"}`}
              />
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-background/90">Selected function</Text>
                  <Text className="text-lg font-bold text-background mt-1">
                    {mode === "tap" ? "Tap to Pay" : "Payment Link"}
                  </Text>
                  <Text className="text-sm text-background/90 mt-1">
                    {mode === "tap"
                      ? "Present your device for a contactless card or wallet payment."
                      : "Generate and share a secure checkout link for remote payment."}
                  </Text>
                </View>
                <View
                  className="h-16 w-16 rounded-2xl items-center justify-center bg-black/25"
                >
                  <IconSymbol
                    name={mode === "tap" ? "creditcard.fill" : "link"}
                    size={30}
                    color="#FFFFFF"
                  />
                </View>
              </View>
            </View>
            <View className="px-4 py-3 flex-row items-center">
              <View className="flex-1">
                <Text className="text-xs text-muted">{mode === "tap" ? "In-person checkout flow" : "Remote checkout flow"}</Text>
              </View>
              <View className={`h-2.5 w-2.5 rounded-full ${mode === "tap" ? "bg-primary" : "bg-success"}`} />
            </View>
          </SurfaceCard>
        </View>

        <View className="px-4 mb-4">
          <SurfaceCard>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-foreground">Payout destination</Text>
              <TouchableOpacity
                onPress={() => setShowBankForm((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={showBankForm ? "Hide bank account form" : "Show bank account form"}
                testID="get-paid-bank-toggle"
              >
                <Text className="text-sm font-semibold text-primary">
                  {showBankForm ? "Done" : payoutSetup?.connected ? "Update" : "Connect"}
                </Text>
              </TouchableOpacity>
            </View>
            {payoutSetup?.connected ? (
              <View className="mb-1">
                <Text className="text-sm text-foreground">
                  {payoutSetup.bankName} ••••{payoutSetup.accountNumberLast4}
                </Text>
                <Text className="text-xs text-muted mt-1">
                  {payoutSetup.accountHolderName} · {payoutSetup.sortCode}
                </Text>
              </View>
            ) : (
              <Text className="text-sm text-warning mb-1">No bank account connected yet.</Text>
            )}

            {showBankForm ? (
              <View className="mt-3 pt-3 border-t border-border">
                <Text className="text-xs text-muted mb-1.5">Account holder name</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
                  value={bankAccountHolder}
                  onChangeText={setBankAccountHolder}
                  placeholder="e.g. Jason Bright"
                  placeholderTextColor={colors.muted}
                />
                <Text className="text-xs text-muted mb-1.5">Bank name</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
                  value={bankName}
                  onChangeText={setBankName}
                  placeholder="e.g. Barclays"
                  placeholderTextColor={colors.muted}
                />
                <Text className="text-xs text-muted mb-1.5">Sort code</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
                  value={bankSortCode}
                  onChangeText={(next) => setBankSortCode(formatSortCode(next))}
                  placeholder="12-34-56"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={8}
                />
                <Text className="text-xs text-muted mb-1.5">Account number</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
                  value={bankAccountNumber}
                  onChangeText={(next) => setBankAccountNumber(next.replace(/\D/g, "").slice(0, 10))}
                  placeholder="12345678"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  maxLength={10}
                />
                <TouchableOpacity
                  className="bg-primary rounded-xl py-3.5 items-center"
                  onPress={handleConnectBank}
                  disabled={connectPayoutBank.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Save payout bank account"
                  testID="get-paid-bank-save"
                >
                  {connectPayoutBank.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-background font-semibold">
                      {payoutSetup?.connected ? "Update bank details" : "Connect bank account to get paid"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}
          </SurfaceCard>
        </View>

        <View className="px-4 mb-4">
          <SurfaceCard className="p-1 flex-row">
            <TouchableOpacity
              className={`flex-1 py-2.5 rounded-lg items-center ${mode === "tap" ? "bg-primary" : ""}`}
              onPress={() => setMode("tap")}
            >
              <Text className={mode === "tap" ? "text-background font-semibold" : "text-muted font-medium"}>
                Tap to Pay
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-2.5 rounded-lg items-center ${mode === "link" ? "bg-primary" : ""}`}
              onPress={() => setMode("link")}
            >
              <Text className={mode === "link" ? "text-background font-semibold" : "text-muted font-medium"}>
                Payment Link
              </Text>
            </TouchableOpacity>
          </SurfaceCard>
        </View>

        <View className="px-4 mb-4">
          <SurfaceCard>
            <Text className="text-sm font-medium text-muted mb-2">Amount (GBP)</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground text-lg font-bold mb-4"
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
            <Text className="text-sm font-medium text-muted mb-2">What is this for? (optional)</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
              value={description}
              onChangeText={setDescription}
              placeholder="Training session"
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity
              className="bg-primary rounded-xl py-3.5 items-center"
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-background font-semibold">
                  {mode === "tap" ? "Start Tap to Pay" : "Create Payment Link"}
                </Text>
              )}
            </TouchableOpacity>
          </SurfaceCard>
        </View>

        {mode === "tap" && tapSession && (
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm text-muted mb-2">Client checkout</Text>
              <AdyenCheckout
                sessionId={tapSession.sessionId}
                sessionData={tapSession.sessionData}
                clientKey={tapSession.clientKey}
                environment={tapSession.environment}
                onPaymentComplete={() => {
                  trackLaunchEvent("trainer_tap_to_pay_completed");
                  void utils.payments.payoutSummary.invalidate();
                  showAlert("Payment received", "Tap to Pay completed.");
                }}
                onError={(err) => showAlert("Tap to Pay Error", err.message)}
              />
            </SurfaceCard>
          </View>
        )}

        {mode === "link" && paymentLink && (
          <View className="px-4 mb-4">
            <View className="bg-success/10 border border-success/30 rounded-xl p-4">
              <View className="flex-row items-center mb-2">
                <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
                <Text className="text-success font-semibold ml-2">Payment link ready</Text>
              </View>
              <Text className="text-foreground text-sm" selectable>
                {paymentLink}
              </Text>
              <View className="flex-row mt-3 gap-2">
                <TouchableOpacity className="bg-primary px-4 py-2.5 rounded-full" onPress={() => copyToClipboard(paymentLink)}>
                  <Text className="text-background font-semibold">Copy</Text>
                </TouchableOpacity>
                <TouchableOpacity className="bg-surface border border-border px-4 py-2.5 rounded-full" onPress={() => shareLink(paymentLink)}>
                  <Text className="text-foreground font-semibold">Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        <View className="px-4 mb-4">
          <SurfaceCard>
            <Text className="text-sm font-semibold text-foreground">Payouts</Text>
            <Text className="text-sm text-muted mt-1">{payoutSummary?.message || "Connect your bank account to receive payouts."}</Text>
            {payoutSummary?.destination ? (
              <Text className="text-xs text-foreground mt-2">{payoutSummary.destination}</Text>
            ) : null}
            <View className="flex-row items-center justify-between mt-3">
              <Text className="text-muted text-sm">Available</Text>
              <Text className="text-foreground font-semibold">{formatGBP(payoutSummary?.available || 0)}</Text>
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-muted text-sm">Pending</Text>
              <Text className="text-foreground font-semibold">{formatGBP(payoutSummary?.pending || 0)}</Text>
            </View>
          </SurfaceCard>
        </View>

        <View className="px-4 pb-8">
          <Text className="text-lg font-semibold text-foreground mb-3">Payment history</Text>
          <TouchableOpacity
            onPress={() => router.push("/(trainer)/payment-history" as any)}
            className="rounded-xl border border-border bg-surface px-4 py-4"
            accessibilityRole="button"
            accessibilityLabel="Open payment history"
            testID="get-paid-open-history"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-foreground font-semibold">Open payment history</Text>
                <Text className="text-xs text-muted mt-1">
                  View all payments, statuses, and amounts on a dedicated page.
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color={colors.muted} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </ScreenContainer>
    </>
  );
}
