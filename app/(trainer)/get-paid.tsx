import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { formatGBP } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const TILE_STYLE = { backgroundColor: "rgba(21,21,32,0.94)", borderColor: "rgba(148,163,184,0.22)" };
const TILE_HEIGHT = 130;
const ICON_BG = { backgroundColor: "rgba(251,191,36,0.18)" };

export default function GetPaidScreen() {
  const colors = useColors();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: payoutSummary } = trpc.payments.payoutSummary.useQuery();
  const utils = trpc.useUtils();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await utils.payments.payoutSummary.invalidate();
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

          {/* Setup payment status */}
          <View className="px-4 mb-4">
            <TouchableOpacity
              onPress={() => router.push("/(trainer)/payment-setup" as any)}
              accessibilityRole="button"
              accessibilityLabel="Setup payment merchant account"
              testID="get-paid-setup-payment"
              style={!payoutSummary?.bankConnected ? {
                backgroundColor: "rgba(251,191,36,0.12)",
                borderWidth: 2,
                borderColor: "rgba(251,191,36,0.5)",
                borderRadius: 16,
                padding: 16,
              } : undefined}
            >
              {payoutSummary?.bankConnected ? (
                <SurfaceCard>
                  <View className="flex-row items-center">
                    <View className="h-9 w-9 rounded-full items-center justify-center mr-3 bg-success/10">
                      <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">Setup payment</Text>
                      <Text className="text-xs text-muted mt-0.5">Merchant account active</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </View>
                </SurfaceCard>
              ) : (
                <View className="flex-row items-center">
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(251,191,36,0.22)", alignItems: "center", justifyContent: "center", marginRight: 14 }}>
                    <IconSymbol name="exclamationmark.triangle.fill" size={22} color="#FBBF24" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#FBBF24" }}>Complete Setup to Get Paid</Text>
                    <Text style={{ fontSize: 12, color: "#FDE68A", marginTop: 3 }}>
                      Finish merchant onboarding so clients can pay you
                    </Text>
                  </View>
                  <View style={{ backgroundColor: "#FBBF24", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#0A0A14" }}>Setup</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Payment method cards */}
          <View className="px-4 mb-4">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TouchableOpacity
                  className="rounded-xl border p-4 items-center justify-center"
                  style={{ ...TILE_STYLE, height: TILE_HEIGHT }}
                  onPress={() => router.push("/(trainer)/request-payment?mode=link" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Create payment link"
                  testID="get-paid-card-link"
                >
                  <View className="w-12 h-12 rounded-full items-center justify-center mb-2" style={ICON_BG}>
                    <IconSymbol name="link" size={22} color={colors.warning} />
                  </View>
                  <Text className="text-sm font-semibold text-center" style={{ color: "#F8FAFC" }} numberOfLines={1}>
                    Payment Link
                  </Text>
                  <Text className="text-[11px] mt-1 text-center" style={{ color: "#94A3B8" }} numberOfLines={1}>
                    Share a checkout link
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="flex-1">
                <TouchableOpacity
                  className="rounded-xl border p-4 items-center justify-center"
                  style={{ ...TILE_STYLE, height: TILE_HEIGHT }}
                  onPress={() => router.push("/(trainer)/request-payment?mode=tap" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Start tap to pay"
                  testID="get-paid-card-tap"
                >
                  <View className="w-12 h-12 rounded-full items-center justify-center mb-2" style={ICON_BG}>
                    <IconSymbol name="creditcard.fill" size={22} color={colors.warning} />
                  </View>
                  <Text className="text-sm font-semibold text-center" style={{ color: "#F8FAFC" }} numberOfLines={1}>
                    Tap to Pay
                  </Text>
                  <Text className="text-[11px] mt-1 text-center" style={{ color: "#94A3B8" }} numberOfLines={1}>
                    In-person contactless
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Payouts summary */}
          <View className="px-4 mb-4">
            <SurfaceCard>
              <Text className="text-sm font-semibold text-foreground">Payouts</Text>
              <Text className="text-sm text-muted mt-1">
                {payoutSummary?.message || "Connect your bank account to receive payouts."}
              </Text>
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

          {/* Payment history */}
          <View className="px-4 pb-8">
            <TouchableOpacity
              onPress={() => router.push("/(trainer)/payment-history" as any)}
              className="rounded-xl border border-border bg-surface px-4 py-4"
              accessibilityRole="button"
              accessibilityLabel="Open payment history"
              testID="get-paid-open-history"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-foreground font-semibold">Payment history</Text>
                  <Text className="text-xs text-muted mt-1">
                    View all payments, statuses, and amounts.
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
