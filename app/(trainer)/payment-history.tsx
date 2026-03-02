import { ActionButton } from "@/components/action-button";
import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { formatGBPFromMinor } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, Share, Text, View } from "react-native";

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  paid_out: "Paid out",
  cancelled: "Cancelled",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  awaiting_payment: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  paid_out: "bg-primary/15 text-primary",
  cancelled: "bg-error/15 text-error",
};

function formatHistoryTime(value: string | null | undefined): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReminderDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function PaymentHistoryScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const {
    data: history = [],
    isLoading,
    isRefetching,
    refetch,
  } = trpc.payments.history.useQuery({ limit: 100 });
  const { data: stats } = trpc.payments.stats.useQuery();

  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const [remindingRef, setRemindingRef] = useState<string | null>(null);
  const cancelPayment = trpc.payments.cancelLink.useMutation({
    onSuccess: () => { setCancellingRef(null); return Promise.all([utils.payments.history.invalidate(), utils.payments.stats.invalidate()]); },
    onError: (err) => {
      setCancellingRef(null);
      const msg = err.message || "Please try again.";
      if (Platform.OS === "web") window.alert("Unable to cancel: " + msg);
      else Alert.alert("Unable to cancel", msg);
    },
  });

  const recordReminder = trpc.payments.recordReminder.useMutation({
    onSuccess: () => { setRemindingRef(null); return utils.payments.history.invalidate(); },
    onError: () => setRemindingRef(null),
  });

  const handleCancel = (payment: any) => {
    const doCancel = () => { setCancellingRef(payment.merchantReference); cancelPayment.mutate({ merchantReference: payment.merchantReference }); };
    if (Platform.OS === "web") {
      if (window.confirm("Cancel this payment request?\n\nThe client will no longer be able to pay using this link.")) doCancel();
    } else {
      Alert.alert("Cancel payment?", "The client will no longer be able to pay using this link.", [
        { text: "Keep", style: "cancel" },
        { text: "Cancel", style: "destructive", onPress: doCancel },
      ]);
    }
  };

  const handleSendReminder = async (payment: any) => {
    if (!payment.paymentLink) {
      Alert.alert("No payment link", "This payment does not have a shareable link.");
      return;
    }
    const amount = formatGBPFromMinor(Number(payment.amountMinor || 0));
    const message = `Friendly reminder: ${payment.description || "Training payment"} (${amount}) is still pending.\n\n${payment.paymentLink}`;
    await Share.share({ message, url: payment.paymentLink });
    setRemindingRef(payment.merchantReference);
    recordReminder.mutate({ merchantReference: payment.merchantReference });
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor="#60A5FA" />
          }
        >
          <ScreenHeader
            title="Payment history"
            subtitle="Track every payment and payout status in one place."
            leftSlot={
              <ActionButton
                onPress={() => router.canGoBack() ? router.back() : router.replace("/(trainer)" as any)}
                variant="ghost"
                size="sm"
                className="w-10 h-10 rounded-full bg-surface"
                accessibilityLabel="Go back"
                testID="payment-history-back"
              >
                <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
              </ActionButton>
            }
          />

          <View className="px-4 mb-4">
            <SurfaceCard>
              <View className="flex-row items-center justify-between">
                <Text className="text-muted text-sm">Total records</Text>
                <Text className="text-foreground font-semibold">{history.length}</Text>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-muted text-sm">Paid</Text>
                <Text className="text-foreground font-semibold">{stats?.paid || 0}</Text>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-muted text-sm">Awaiting</Text>
                <Text className="text-foreground font-semibold">{stats?.awaitingPayment || 0}</Text>
              </View>
              {(stats?.cancelled || 0) > 0 && (
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-muted text-sm">Cancelled</Text>
                  <Text className="text-foreground font-semibold">{stats?.cancelled}</Text>
                </View>
              )}
            </SurfaceCard>
          </View>

          <View className="px-4 pb-8">
            {isLoading ? (
              <View className="py-10 items-center justify-center">
                <ActivityIndicator />
              </View>
            ) : history.length === 0 ? (
              <EmptyStateCard
                icon="creditcard.fill"
                title="No payment history yet"
                description="You have not collected any payments yet. Start from Get Paid to create your first payment."
                ctaLabel="Go to Get Paid"
                onCtaPress={() => router.push("/(trainer)/get-paid" as any)}
              />
            ) : (
              history.map((payment: any) => {
                const statusKey = String(payment.status || "awaiting_payment");
                const statusLabel = STATUS_LABEL[statusKey] || "Awaiting payment";
                const statusClass = STATUS_BADGE_CLASS[statusKey] || STATUS_BADGE_CLASS.awaiting_payment;
                const label = payment.description || (payment.method === "tap" ? "Tap to Pay" : "Payment Link");
                const createdLabel = formatHistoryTime(payment.createdAt);
                const methodLabel = payment.method === "tap" ? "Tap to Pay" : "Payment Link";
                const isAwaiting = statusKey === "awaiting_payment";
                const reminderDate = formatReminderDate(payment.lastReminderSentAt);

                return (
                  <View key={payment.id} className="mb-3">
                    <SurfaceCard>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-foreground font-semibold">{label}</Text>
                          <Text className="text-xs text-muted mt-1">
                            {methodLabel} · {createdLabel}
                          </Text>
                          {reminderDate && (
                            <Text className="text-[10px] text-primary mt-0.5">
                              Last reminded {reminderDate}
                            </Text>
                          )}
                        </View>
                        <Text className="text-foreground font-semibold">
                          {formatGBPFromMinor(Number(payment.amountMinor || 0))}
                        </Text>
                      </View>
                      <View className="mt-3 flex-row items-center justify-between">
                        <Text className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusClass}`}>
                          {statusLabel}
                        </Text>
                        <Text className="text-[11px] text-muted">Ref {payment.merchantReference || "n/a"}</Text>
                      </View>
                      {isAwaiting && payment.merchantReference && (
                        <View className="flex-row gap-2 mt-3 pt-3 border-t border-border">
                          <ActionButton
                            className="flex-1"
                            variant="secondary"
                            size="sm"
                            onPress={() => handleCancel(payment)}
                            loading={cancellingRef === payment.merchantReference}
                            accessibilityLabel={`Cancel ${label}`}
                          >
                            <Text className="text-error text-xs font-semibold">Cancel</Text>
                          </ActionButton>
                          {payment.paymentLink && (
                            <ActionButton
                              className="flex-1"
                              variant="outline"
                              size="sm"
                              onPress={() => handleSendReminder(payment)}
                              loading={remindingRef === payment.merchantReference}
                              accessibilityLabel={`Send reminder for ${label}`}
                            >
                              <Text className="text-primary text-xs font-semibold">Send Reminder</Text>
                            </ActionButton>
                          )}
                        </View>
                      )}
                    </SurfaceCard>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
