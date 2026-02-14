import { AdyenCheckout } from "@/components/adyen-checkout";
import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trackLaunchEvent } from "@/lib/analytics";
import { formatGBP, formatGBPFromMinor, toMinorUnits } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type PayMode = "tap" | "link";
type PaymentStatus = "awaiting_payment" | "paid" | "paid_out";

const STATUS_STYLE: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
  awaiting_payment: { bg: "bg-warning/20", text: "text-warning", label: "Awaiting payment" },
  paid: { bg: "bg-success/20", text: "text-success", label: "Paid" },
  paid_out: { bg: "bg-primary/20", text: "text-primary", label: "Paid out" },
};

function resolvePaymentStatusStyle(rawStatus: unknown) {
  const status = typeof rawStatus === "string" ? rawStatus.toLowerCase().trim() : "";
  if (status in STATUS_STYLE) {
    return STATUS_STYLE[status as PaymentStatus];
  }
  // Map common backend variants into the UI buckets.
  if (status === "pending" || status === "awaiting" || status === "requires_payment_method") {
    return STATUS_STYLE.awaiting_payment;
  }
  if (status === "completed" || status === "succeeded" || status === "captured") {
    return STATUS_STYLE.paid;
  }
  if (status === "payout_pending" || status === "settled" || status === "paidout") {
    return STATUS_STYLE.paid_out;
  }
  return STATUS_STYLE.awaiting_payment;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function GetPaidScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<PayMode>("tap");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [tapSession, setTapSession] = useState<{
    sessionId: string;
    sessionData: string;
    clientKey: string;
    environment: string;
  } | null>(null);

  const {
    data: history = [],
    isLoading: historyLoading,
    isRefetching,
    refetch,
  } = trpc.payments.history.useQuery({ limit: 20 });
  const { data: stats } = trpc.payments.stats.useQuery();
  const { data: payoutSummary } = trpc.payments.payoutSummary.useQuery();

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
      void refetch();
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

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        <ScreenHeader
          title="Get Paid"
          subtitle="Fast, simple payments for in-person or remote clients."
        />

        <View className="px-4 mb-4">
          <SurfaceCard>
            <Text className="text-sm text-muted mb-1">Collected</Text>
            <Text className="text-2xl font-bold text-foreground">
              {formatGBPFromMinor(stats?.totalPaidMinor || 0)}
            </Text>
            <View className="flex-row items-center mt-2">
              <Text className="text-xs text-muted mr-4">Awaiting: {stats?.awaitingPayment || 0}</Text>
              <Text className="text-xs text-muted mr-4">Paid: {stats?.paid || 0}</Text>
              <Text className="text-xs text-muted">Paid out: {stats?.paidOut || 0}</Text>
            </View>
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
                  void refetch();
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
            <Text className="text-sm text-muted mt-1">{payoutSummary?.message || "Payouts happen automatically — no action needed."}</Text>
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
          <Text className="text-lg font-semibold text-foreground mb-3">Recent payments</Text>
          {historyLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : history.length === 0 ? (
            <EmptyStateCard
              icon="creditcard.fill"
              title="No payment history yet"
              description="You have not collected any payments yet. Start with Tap to Pay or send a payment link."
              ctaLabel={mode === "tap" ? "Start Tap to Pay" : "Create Link"}
              onCtaPress={handleSubmit}
            />
          ) : (
            history.map((item) => {
              const style = resolvePaymentStatusStyle(item.status);
              return (
                <SurfaceCard key={item.id} className="mb-3">
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-foreground font-semibold" numberOfLines={1}>
                        {item.description || "Training session"}
                      </Text>
                      <Text className="text-xs text-muted mt-1">
                        {item.method === "link" ? "Payment Link" : "Tap to Pay"} · {formatDate(item.createdAt)}
                      </Text>
                    </View>
                    <Text className="text-foreground font-bold">{formatGBPFromMinor(item.amountMinor)}</Text>
                  </View>
                  <View className="mt-3 self-start px-2 py-1 rounded-full bg-muted/20">
                    <View className={`px-2 py-0.5 rounded-full ${style.bg}`}>
                      <Text className={`text-xs font-medium ${style.text}`}>{style.label}</Text>
                    </View>
                  </View>
                </SurfaceCard>
              );
            })
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
