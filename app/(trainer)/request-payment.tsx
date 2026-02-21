import { AdyenCheckout } from "@/components/adyen-checkout";
import { ScreenContainer } from "@/components/screen-container";
import { ServicePickerModal } from "@/components/service-picker-modal";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SERVICE_SUGGESTIONS } from "@/shared/service-suggestions";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trackLaunchEvent } from "@/lib/analytics";
import { toMinorUnits } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type PayMode = "tap" | "link";

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export default function RequestPaymentScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: PayMode = params.mode === "tap" ? "tap" : "link";

  const isDark = colors.foreground === "#FFFFFF";
  const goldBg = isDark ? "rgba(251,191,36,0.08)" : "rgba(245,158,11,0.06)";
  const goldBorder = isDark ? "rgba(251,191,36,0.25)" : "rgba(245,158,11,0.18)";
  const goldFieldBg = isDark ? "rgba(251,191,36,0.06)" : "rgba(245,158,11,0.04)";
  const goldFieldBorder = isDark ? "rgba(251,191,36,0.18)" : "rgba(245,158,11,0.12)";
  const [amount, setAmount] = useState("");
  const [selectedServiceName, setSelectedServiceName] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [customName, setCustomName] = useState("");
  const [showServicePicker, setShowServicePicker] = useState(false);

  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [tapSession, setTapSession] = useState<{
    sessionId: string;
    sessionData: string;
    clientKey: string;
    environment: string;
  } | null>(null);

  const { data: trainerServices = [] } = trpc.payments.trainerServices.useQuery();
  const utils = trpc.useUtils();

  const extraBundleServices = useMemo(() => {
    const suggestionsLower = new Set(SERVICE_SUGGESTIONS.map((s) => s.toLowerCase()));
    return trainerServices
      .map((s) => s.name)
      .filter((name) => !suggestionsLower.has(name.toLowerCase()));
  }, [trainerServices]);

  const serviceName = isCustom ? (customName.trim() || "Custom item") : (selectedServiceName || "");

  const description = useMemo(() => {
    if (!serviceName) return "";
    return quantity && quantity !== "1" ? `${quantity} × ${serviceName}` : serviceName;
  }, [serviceName, quantity]);

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
      createSession.mutate({ amountMinor, description: safeDescription, method: "tap" });
    } else {
      createLink.mutate({ amountMinor, description: safeDescription });
    }
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

  const selectService = (name: string) => {
    setSelectedServiceName(name);
    setIsCustom(false);
    setQuantity("1");
    setShowServicePicker(false);
    haptics.light();
  };

  const selectCustom = (name: string) => {
    setSelectedServiceName(null);
    setIsCustom(true);
    setCustomName(name);
    setQuantity("1");
    setShowServicePicker(false);
    haptics.light();
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenHeader
            title="Request Payment"
            subtitle={mode === "tap" ? "Tap to Pay — in-person contactless" : "Payment Link — share a checkout link"}
            leftSlot={
              <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(trainer)/get-paid" as any))}
                className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="request-payment-back"
              >
                <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
              </TouchableOpacity>
            }
          />

          {/* Mode indicator pill */}
          <View className="px-4 mb-4">
            <View
              className="flex-row items-center self-start rounded-full px-3.5 py-1.5"
              style={{ backgroundColor: goldFieldBg, borderWidth: 1, borderColor: goldFieldBorder }}
            >
              <IconSymbol
                name={mode === "tap" ? "creditcard.fill" : "link"}
                size={14}
                color={colors.warning}
              />
              <Text className="text-xs font-semibold ml-1.5" style={{ color: colors.warning }}>
                {mode === "tap" ? "Tap to Pay" : "Payment Link"}
              </Text>
            </View>
          </View>

          {/* Gold form card */}
          <View className="px-4 mb-4">
            <View
              className="rounded-xl overflow-hidden p-4"
              style={{ backgroundColor: goldBg, borderWidth: 1, borderColor: goldBorder }}
            >
              {/* Description */}
              <Text className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: colors.warning }}>
                Description
              </Text>
              <TouchableOpacity
                className="rounded-xl px-4 py-3 flex-row items-center justify-between mb-4"
                style={{ backgroundColor: goldFieldBg, borderWidth: 1, borderColor: goldFieldBorder }}
                onPress={() => setShowServicePicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Select a service"
                testID="request-payment-service-picker"
              >
                <Text
                  className={`text-sm flex-1 ${selectedServiceName || isCustom ? "text-foreground font-medium" : "text-muted"}`}
                  numberOfLines={1}
                >
                  {isCustom ? customName || "Custom" : selectedServiceName || "Select a service…"}
                </Text>
                <IconSymbol name="chevron.down" size={14} color={colors.warning} />
              </TouchableOpacity>

              {/* Count + Units row */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: colors.warning }}>
                    Count
                  </Text>
                  <TextInput
                    className="rounded-xl px-4 py-3 text-foreground font-semibold"
                    style={{ backgroundColor: goldFieldBg, borderWidth: 1, borderColor: goldFieldBorder }}
                    value={quantity}
                    onChangeText={setQuantity}
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: colors.warning }}>
                    Units
                  </Text>
                  {isCustom ? (
                    <TextInput
                      className="rounded-xl px-4 py-3 text-foreground"
                      style={{ backgroundColor: goldFieldBg, borderWidth: 1, borderColor: goldFieldBorder }}
                      value={customName}
                      onChangeText={setCustomName}
                      placeholder="e.g. Nutrition Bar"
                      placeholderTextColor={colors.muted}
                    />
                  ) : (
                    <View
                      className="rounded-xl px-4 py-3 justify-center"
                      style={{ backgroundColor: goldFieldBg, borderWidth: 1, borderColor: goldFieldBorder }}
                    >
                      <Text className="text-sm text-foreground" numberOfLines={1}>
                        {selectedServiceName || "—"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Total */}
              <Text className="text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: colors.warning }}>
                Total (GBP)
              </Text>
              <View
                className="rounded-xl px-4 py-3 flex-row items-center mb-5"
                style={{ backgroundColor: goldFieldBg, borderWidth: 1, borderColor: goldFieldBorder }}
              >
                <Text className="text-lg font-bold mr-1" style={{ color: colors.warning }}>£</Text>
                <TextInput
                  className="flex-1 text-foreground text-lg font-bold"
                  style={{ padding: 0 }}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Divider */}
              <View className="h-px mb-4" style={{ backgroundColor: goldFieldBorder }} />

              {/* Submit button */}
              <TouchableOpacity
                className="rounded-xl py-4 items-center"
                style={{ backgroundColor: colors.warning }}
                onPress={handleSubmit}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Request payment"
                testID="request-payment-submit"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-semibold text-base" style={{ color: "#1C1306" }}>
                    Request Payment
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Tap to Pay result */}
          {mode === "tap" && tapSession && (
            <View className="px-4 mb-4">
              <View className="bg-surface border border-border rounded-xl p-4">
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
              </View>
            </View>
          )}

          {/* Payment Link result */}
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
                  <TouchableOpacity
                    className="bg-primary px-4 py-2.5 rounded-full"
                    onPress={() => copyToClipboard(paymentLink)}
                    accessibilityRole="button"
                    accessibilityLabel="Copy payment link"
                    testID="request-payment-copy"
                  >
                    <Text className="text-background font-semibold">Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-surface border border-border px-4 py-2.5 rounded-full"
                    onPress={() => shareLink(paymentLink)}
                    accessibilityRole="button"
                    accessibilityLabel="Share payment link"
                    testID="request-payment-share"
                  >
                    <Text className="text-foreground font-semibold">Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View className="h-8" />
        </ScrollView>
      </ScreenContainer>

      <ServicePickerModal
        visible={showServicePicker}
        onClose={() => setShowServicePicker(false)}
        onSelect={(name) => {
          const isSuggestion = (SERVICE_SUGGESTIONS as readonly string[]).includes(name);
          if (isSuggestion || extraBundleServices.includes(name)) {
            selectService(name);
          } else {
            selectCustom(name);
          }
        }}
        extraServices={extraBundleServices}
        selectedName={isCustom ? null : selectedServiceName}
        presentation="bottomSheet"
      />
    </>
  );
}
