import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { formatGBPFromMinor } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { router, Stack } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

const STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  paid_out: "Paid out",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  awaiting_payment: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  paid_out: "bg-primary/15 text-primary",
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

export default function PaymentHistoryScreen() {
  const colors = useColors();
  const {
    data: history = [],
    isLoading,
    isRefetching,
    refetch,
  } = trpc.payments.history.useQuery({ limit: 100 });
  const { data: stats } = trpc.payments.stats.useQuery();

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
              <TouchableOpacity
                onPress={() => router.canGoBack() ? router.back() : router.replace("/(trainer)" as any)}
                className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="payment-history-back"
              >
                <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
              </TouchableOpacity>
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

                return (
                  <View key={payment.id} className="mb-3">
                    <SurfaceCard>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-foreground font-semibold">{label}</Text>
                          <Text className="text-xs text-muted mt-1">
                            {methodLabel} • {createdLabel}
                          </Text>
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

