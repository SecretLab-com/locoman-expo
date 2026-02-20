import { AdyenCheckout } from "@/components/adyen-checkout";
import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
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
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
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

const SERVICE_SUGGESTIONS = [
  "Training Session",
  "Check-In",
  "Video Call",
  "Plan Review",
  "Meal Planning",
  "Progress Photos",
  "Custom Workout",
  "Nutrition Coaching",
];

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
  const [mode, setMode] = useState<PayMode>("link");
  const [amount, setAmount] = useState("");
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tapSession, setTapSession] = useState<{
    sessionId: string;
    sessionData: string;
    clientKey: string;
    environment: string;
  } | null>(null);

  const [selectedServiceName, setSelectedServiceName] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [customName, setCustomName] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [showServicePicker, setShowServicePicker] = useState(false);

  const { data: payoutSummary } = trpc.payments.payoutSummary.useQuery();
  const { data: trainerServices = [] } = trpc.payments.trainerServices.useQuery();
  const utils = trpc.useUtils();

  const overlayColor = colors.foreground === "#FFFFFF"
    ? "rgba(0, 0, 0, 0.55)"
    : "rgba(15, 23, 42, 0.18)";

  const extraBundleServices = useMemo(() => {
    const suggestionsLower = new Set(SERVICE_SUGGESTIONS.map((s) => s.toLowerCase()));
    return trainerServices
      .map((s) => s.name)
      .filter((name) => !suggestionsLower.has(name.toLowerCase()));
  }, [trainerServices]);

  const description = useMemo(() => {
    if (isCustom) {
      const name = customName.trim() || "Custom item";
      return quantity && quantity !== "1" ? `${quantity} × ${name}` : name;
    }
    if (selectedServiceName) {
      return quantity && quantity !== "1" ? `${quantity} × ${selectedServiceName}` : selectedServiceName;
    }
    return "";
  }, [isCustom, customName, selectedServiceName, quantity]);

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

  const handleSubmit = async () => {
    await haptics.light();
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      showAlert("Invalid amount", "Enter a valid amount in GBP.");
      return;
    }
    const amountMinor = toMinorUnits(value);
    const safeDescription = description || "Training session";

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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        utils.payments.payoutSummary.invalidate(),
        utils.payments.config.invalidate(),
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
              <View className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
              <View
                className="absolute inset-0"
                style={{ backgroundColor: mode === "tap" ? "rgba(59,130,246,0.45)" : "rgba(34,197,94,0.40)" }}
              />
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.85)" }}>Selected function</Text>
                  <Text className="text-lg font-bold mt-1" style={{ color: "#fff" }}>
                    {mode === "tap" ? "Tap to Pay" : "Payment Link"}
                  </Text>
                  <Text className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>
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
          <TouchableOpacity
            onPress={() => router.push("/(trainer)/payment-setup" as any)}
            accessibilityRole="button"
            accessibilityLabel="Setup payment merchant account"
            testID="get-paid-setup-payment"
          >
            <SurfaceCard>
              <View className="flex-row items-center">
                <View
                  className={`h-9 w-9 rounded-full items-center justify-center mr-3 ${
                    payoutSummary?.bankConnected ? "bg-success/10" : "bg-warning/10"
                  }`}
                >
                  <IconSymbol
                    name={payoutSummary?.bankConnected ? "checkmark.circle.fill" : "exclamationmark.triangle.fill"}
                    size={18}
                    color={payoutSummary?.bankConnected ? colors.success : colors.warning}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Setup payment</Text>
                  <Text className="text-xs text-muted mt-0.5">
                    {payoutSummary?.bankConnected
                      ? "Merchant account active"
                      : "Complete merchant onboarding to get paid"}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </View>
            </SurfaceCard>
          </TouchableOpacity>
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
          <View
            className="rounded-xl overflow-hidden p-4"
            style={{
              backgroundColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.08)" : "rgba(245,158,11,0.06)",
              borderWidth: 1,
              borderColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.25)" : "rgba(245,158,11,0.18)",
            }}
          >
            <View className="flex-row items-center mb-3">
              <IconSymbol name="creditcard.fill" size={16} color={colors.warning} />
              <Text className="text-xs font-bold uppercase tracking-wider ml-2" style={{ color: colors.warning }}>
                Payment request
              </Text>
            </View>

            <Text className="text-sm font-medium mb-2" style={{ color: colors.warning }}>
              Amount (GBP)
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-foreground text-lg font-bold mb-4"
              style={{
                backgroundColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.06)" : "rgba(245,158,11,0.04)",
                borderWidth: 1,
                borderColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.18)" : "rgba(245,158,11,0.12)",
              }}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />

            <Text className="text-sm font-medium mb-2" style={{ color: colors.warning }}>
              What is this for?
            </Text>
            <TouchableOpacity
              className="rounded-xl px-4 py-3 flex-row items-center justify-between mb-3"
              style={{
                backgroundColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.06)" : "rgba(245,158,11,0.04)",
                borderWidth: 1,
                borderColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.18)" : "rgba(245,158,11,0.12)",
              }}
              onPress={() => setShowServicePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select a service"
              testID="get-paid-service-picker"
            >
              <Text
                className={`text-sm flex-1 ${selectedServiceName || isCustom ? "text-foreground font-medium" : "text-muted"}`}
                numberOfLines={1}
              >
                {isCustom ? "Custom" : selectedServiceName || "Select a service…"}
              </Text>
              <IconSymbol name="chevron.down" size={14} color={colors.warning} />
            </TouchableOpacity>

            {(selectedServiceName || isCustom) && (
              <View className="flex-row items-center mb-4 gap-2">
                <TextInput
                  className="rounded-xl px-4 py-3 text-foreground font-semibold"
                  style={{
                    width: 80,
                    backgroundColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.06)" : "rgba(245,158,11,0.04)",
                    borderWidth: 1,
                    borderColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.18)" : "rgba(245,158,11,0.12)",
                  }}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="1"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                />
                {isCustom ? (
                  <View className="flex-1 flex-row items-center">
                    <Text className="text-sm mr-2" style={{ color: colors.warning }}>×</Text>
                    <TextInput
                      className="flex-1 rounded-xl px-4 py-3 text-foreground"
                      style={{
                        backgroundColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.06)" : "rgba(245,158,11,0.04)",
                        borderWidth: 1,
                        borderColor: colors.foreground === "#FFFFFF" ? "rgba(251,191,36,0.18)" : "rgba(245,158,11,0.12)",
                      }}
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder="e.g. Nutrition Bar"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                ) : (
                  <Text className="text-sm flex-1" style={{ color: colors.warning }} numberOfLines={1}>
                    × {selectedServiceName}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              className="rounded-xl py-3.5 items-center"
              style={{ backgroundColor: colors.warning }}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={mode === "tap" ? "Start tap to pay" : "Create payment link"}
              testID="get-paid-submit"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="font-semibold" style={{ color: "#1C1306" }}>
                  {mode === "tap" ? "Start Tap to Pay" : "Create Payment Link"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
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

      <Modal
        visible={showServicePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowServicePicker(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          onPress={() => setShowServicePicker(false)}
          style={{ backgroundColor: overlayColor }}
        >
          <Pressable>
          <SwipeDownSheet
            visible={showServicePicker}
            onClose={() => setShowServicePicker(false)}
            className="bg-background rounded-t-3xl max-h-[75%]"
          >
            <View className="px-5 pb-2 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-foreground">Select a service</Text>
              <TouchableOpacity
                onPress={() => setShowServicePicker(false)}
                accessibilityRole="button"
                accessibilityLabel="Close service picker"
                testID="service-picker-close"
              >
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-5 pb-6" showsVerticalScrollIndicator={false}>
              <Text className="text-xs text-muted mb-3">Select a service type or add a custom one</Text>

              <View className="gap-2 mb-3">
                {SERVICE_SUGGESTIONS.map((name) => {
                  const active = selectedServiceName === name && !isCustom;
                  return (
                    <TouchableOpacity
                      key={name}
                      className="bg-surface border border-border rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                      onPress={() => {
                        setSelectedServiceName(name);
                        setIsCustom(false);
                        setQuantity("1");
                        setShowServicePicker(false);
                        haptics.light();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${name}`}
                    >
                      <Text className="text-foreground font-medium text-sm">{name}</Text>
                      {active ? (
                        <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                      ) : (
                        <IconSymbol name="plus" size={18} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {extraBundleServices.length > 0 && (
                <>
                  <Text className="text-xs text-muted mb-2 mt-1">From your bundles</Text>
                  <View className="gap-2 mb-3">
                    {extraBundleServices.map((name) => {
                      const active = selectedServiceName === name && !isCustom;
                      return (
                        <TouchableOpacity
                          key={name}
                          className="bg-surface border border-border rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                          onPress={() => {
                            setSelectedServiceName(name);
                            setIsCustom(false);
                            setQuantity("1");
                            setShowServicePicker(false);
                            haptics.light();
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Select ${name}`}
                        >
                          <Text className="text-foreground font-medium text-sm">{name}</Text>
                          {active ? (
                            <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                          ) : (
                            <IconSymbol name="plus" size={18} color={colors.primary} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <Text className="text-xs text-muted mb-2 mt-1">Custom service</Text>
              <View className="flex-row gap-2">
                <TextInput
                  className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Custom service name…"
                  placeholderTextColor={colors.muted}
                  value={customInput}
                  onChangeText={setCustomInput}
                />
                <TouchableOpacity
                  className="bg-primary rounded-xl px-4 items-center justify-center"
                  onPress={() => {
                    const trimmed = customInput.trim();
                    if (!trimmed) return;
                    setSelectedServiceName(null);
                    setIsCustom(true);
                    setCustomName(trimmed);
                    setQuantity("1");
                    setCustomInput("");
                    setShowServicePicker(false);
                    haptics.light();
                  }}
                  disabled={!customInput.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Add custom service"
                  testID="service-picker-custom-add"
                >
                  <IconSymbol name="plus" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View className="h-8" />
            </ScrollView>
          </SwipeDownSheet>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
