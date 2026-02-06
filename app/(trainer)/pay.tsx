import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const copyToClipboard = async (text: string) => {
  try {
    if (Platform.OS === "web" && navigator?.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const Clipboard = require("expo-clipboard");
    await Clipboard.setStringAsync(text);
  } catch {
    if (Platform.OS === "web") {
      window.prompt("Copy this link:", text);
    }
  }
};

const showAlert = (title: string, message: string) => {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

function formatAmount(amountMinor: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amountMinor / 100);
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  created: { bg: "bg-muted/20", text: "text-muted" },
  pending: { bg: "bg-warning/20", text: "text-warning" },
  authorised: { bg: "bg-success/20", text: "text-success" },
  captured: { bg: "bg-success/20", text: "text-success" },
  refused: { bg: "bg-error/20", text: "text-error" },
  cancelled: { bg: "bg-muted/20", text: "text-muted" },
  error: { bg: "bg-error/20", text: "text-error" },
  refunded: { bg: "bg-primary/20", text: "text-primary" },
};

export default function PayScreen() {
  const colors = useColors();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"link" | "card">("link");
  const [paymentLinkResult, setPaymentLinkResult] = useState<string | null>(null);

  const { data: stats } = trpc.payments.stats.useQuery();
  const {
    data: payments = [],
    isLoading,
    refetch,
    isRefetching,
  } = trpc.payments.history.useQuery({ limit: 20 });

  const createLink = trpc.payments.createLink.useMutation({
    onSuccess: (data) => {
      setPaymentAmount("");
      setPaymentDescription("");
      setPaymentLinkResult(data.linkUrl);
      refetch();
    },
    onError: (err) => {
      console.error("[Payments] createLink error:", err);
      showAlert("Payment Error", err.message);
    },
  });

  const createSession = trpc.payments.createSession.useMutation({
    onSuccess: () => {
      const amountMinor = Math.round(parseFloat(paymentAmount) * 100);
      createLink.mutate({
        amountMinor,
        description: paymentDescription || undefined,
      });
    },
    onError: (err) => {
      console.error("[Payments] createSession error:", err);
      showAlert("Payment Error", err.message);
    },
  });

  const handleRequestPayment = async () => {
    await haptics.light();
    const amountFloat = parseFloat(paymentAmount);
    if (!amountFloat || amountFloat <= 0) {
      showAlert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    const amountMinor = Math.round(amountFloat * 100);
    if (paymentMethod === "link") {
      createLink.mutate({ amountMinor, description: paymentDescription || undefined });
    } else {
      createSession.mutate({ amountMinor, description: paymentDescription || undefined, method: "card" });
    }
  };

  const handleCopyLink = async () => {
    if (!paymentLinkResult) return;
    await copyToClipboard(paymentLinkResult);
    await haptics.light();
    showAlert("Copied", "Payment link copied to clipboard");
  };

  const handleShareLink = async () => {
    if (!paymentLinkResult) return;
    try {
      const { Share } = require("react-native");
      await Share.share({ message: `Please complete your payment: ${paymentLinkResult}`, url: paymentLinkResult });
    } catch {
      handleCopyLink();
    }
  };

  const isPending = createLink.isPending || createSession.isPending;

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4">
          <Text className="text-2xl font-bold text-foreground">Payments</Text>
          <Text className="text-sm text-muted">
            {stats ? `${formatAmount(stats.totalAmount)} collected · ${stats.pending} pending` : "Manage payments"}
          </Text>
        </View>

        {/* QuickPay Actions */}
        <View className="px-4 mb-6">
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-primary rounded-xl py-4 items-center"
              onPress={() => setPaymentModalOpen(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Request payment"
              testID="pay-request"
            >
              <IconSymbol name="dollarsign.circle.fill" size={28} color="#fff" />
              <Text className="text-white font-semibold mt-2">Request Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-surface border border-border rounded-xl py-4 items-center"
              onPress={() => router.push("/(trainer)/payment-history" as any)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Full payment history"
              testID="pay-full-history"
            >
              <IconSymbol name="clock.fill" size={28} color={colors.primary} />
              <Text className="text-foreground font-semibold mt-2">Full History</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        {stats && (
          <View className="px-4 mb-4">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface border border-border rounded-xl p-3">
                <Text className="text-xs text-muted">Total Collected</Text>
                <Text className="text-lg font-bold text-success">{formatAmount(stats.totalAmount)}</Text>
              </View>
              <View className="flex-1 bg-surface border border-border rounded-xl p-3">
                <Text className="text-xs text-muted">Transactions</Text>
                <Text className="text-lg font-bold text-foreground">{stats.total}</Text>
              </View>
              <View className="flex-1 bg-surface border border-border rounded-xl p-3">
                <Text className="text-xs text-muted">Pending</Text>
                <Text className="text-lg font-bold text-warning">{stats.pending}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recent Payments */}
        <View className="px-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Recent Payments</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/payment-history" as any)}>
              <Text className="text-primary font-medium">View all</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : payments.length === 0 ? (
            <View className="items-center py-8 bg-surface rounded-xl border border-border">
              <IconSymbol name="creditcard.fill" size={40} color={colors.muted} />
              <Text className="text-foreground font-semibold mt-3">No payments yet</Text>
              <Text className="text-muted text-sm mt-1">Request your first payment to get started</Text>
            </View>
          ) : (
            payments.map((item) => {
              const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.created;
              return (
                <View key={item.id} className="bg-surface border border-border rounded-xl p-4 mb-3">
                  <View className="flex-row items-start justify-between mb-1">
                    <Text className="text-base font-semibold text-foreground flex-1 mr-3" numberOfLines={1}>
                      {item.description || "Payment"}
                    </Text>
                    <Text className="text-lg font-bold text-foreground">
                      {formatAmount(item.amountMinor, item.currency)}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <View className={`px-2 py-0.5 rounded-full ${statusStyle.bg}`}>
                      <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>{item.status}</Text>
                    </View>
                    <Text className="text-xs text-muted">{formatDate(item.createdAt)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
        <View className="h-6" />
      </ScrollView>

      {/* Request Payment Modal */}
      <Modal
        visible={paymentModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { setPaymentModalOpen(false); setPaymentLinkResult(null); }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => { setPaymentModalOpen(false); setPaymentLinkResult(null); }} />
          <View className="bg-background rounded-t-3xl p-6" onStartShouldSetResponder={() => true}>
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">
                {paymentLinkResult ? "Payment Link Ready" : "Request Payment"}
              </Text>
              <TouchableOpacity onPress={() => { setPaymentModalOpen(false); setPaymentLinkResult(null); }}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {paymentLinkResult ? (
              <View>
                <View className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4">
                  <View className="flex-row items-center mb-2">
                    <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                    <Text className="text-success font-semibold ml-2">Payment link created</Text>
                  </View>
                  <Text className="text-foreground text-sm" selectable>{paymentLinkResult}</Text>
                </View>
                <View className="flex-row gap-3 mb-4">
                  <TouchableOpacity className="flex-1 bg-primary py-4 rounded-xl items-center" onPress={handleCopyLink}>
                    <Text className="text-white font-bold">Copy Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity className="flex-1 bg-surface border border-border py-4 rounded-xl items-center" onPress={handleShareLink}>
                    <Text className="text-foreground font-bold">Share</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity className="py-3 items-center" onPress={() => setPaymentLinkResult(null)}>
                  <Text className="text-primary font-medium">Create Another</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Amount (£)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-lg font-bold mb-4"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="decimal-pad"
                />
                <Text className="text-sm font-medium text-muted mb-2">Description (optional)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-4"
                  placeholder="e.g. Personal training session"
                  placeholderTextColor={colors.muted}
                  value={paymentDescription}
                  onChangeText={setPaymentDescription}
                />
                <Text className="text-sm font-medium text-muted mb-2">Payment Method</Text>
                <View className="flex-row gap-3 mb-6">
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-xl items-center border ${paymentMethod === "link" ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                    onPress={() => setPaymentMethod("link")}
                  >
                    <IconSymbol name="link" size={24} color={paymentMethod === "link" ? colors.primary : colors.muted} />
                    <Text className={`text-sm font-medium mt-1 ${paymentMethod === "link" ? "text-primary" : "text-muted"}`}>QR / Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-xl items-center border ${paymentMethod === "card" ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                    onPress={() => setPaymentMethod("card")}
                  >
                    <IconSymbol name="creditcard.fill" size={24} color={paymentMethod === "card" ? colors.primary : colors.muted} />
                    <Text className={`text-sm font-medium mt-1 ${paymentMethod === "card" ? "text-primary" : "text-muted"}`}>Card</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  className="bg-primary py-4 rounded-xl items-center"
                  onPress={handleRequestPayment}
                  disabled={isPending}
                  activeOpacity={0.8}
                >
                  {isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-lg">
                      {paymentMethod === "link" ? "Generate Payment Link" : "Create Payment Session"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
