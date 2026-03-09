import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";

const POINTS_EXAMPLES = [
  "Complete training sessions",
  "Collect successful payments",
  "Grow active clients",
];

const TIER_COLORS: Record<string, string> = {
  "Getting Started": "#94A3B8",
  Growing: "#3B82F6",
  Pro: "#10B981",
  Elite: "#F59E0B",
};

export default function RewardsScreen() {
  const colors = useColors();
  const [showDetails, setShowDetails] = useState(false);
  const { data: pointsData, isLoading: pointsLoading } = trpc.trainerDashboard.points.useQuery();
  const { data: paymentsStats, isLoading: paymentLoading } = trpc.payments.stats.useQuery();

  const hasFirstPayment = (paymentsStats?.paid || 0) > 0 || (paymentsStats?.paidOut || 0) > 0;

  if (pointsLoading || paymentLoading) {
    return (
      <>
        <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <ScreenContainer>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </ScreenContainer>
      </>
    );
  }

  if (!hasFirstPayment) {
    return (
      <>
        <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <ScreenContainer>
          <ScreenHeader title="Rewards" subtitle="Motivation without pressure." />
          <View className="px-4 mt-6">
            <EmptyStateCard
              icon="star.fill"
              title="Rewards unlock after your first payment"
              description="Take your first payment to start earning points and status progress."
              ctaLabel="Go to Get Paid"
              onCtaPress={() => router.push("/(trainer)/get-paid" as any)}
            />
          </View>
        </ScreenContainer>
      </>
    );
  }

  const totalPoints = pointsData?.totalPoints || 0;
  const statusTier = pointsData?.statusTier || "Getting Started";
  const tierColor = TIER_COLORS[statusTier] || colors.primary;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenHeader title="Rewards" subtitle="Earn points by training clients and selling more." />

        <View className="px-4 mb-4">
          <SurfaceCard>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm text-muted">Current status</Text>
                <Text className="text-2xl font-bold" style={{ color: tierColor }}>
                  {statusTier}
                </Text>
              </View>
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: `${tierColor}22` }}
              >
                <IconSymbol name="star.fill" size={22} color={tierColor} />
              </View>
            </View>
            <View className="mt-4 pt-4 border-t border-border">
              <Text className="text-sm text-muted">Points</Text>
              <Text className="text-3xl font-bold text-foreground">{totalPoints.toLocaleString()}</Text>
            </View>
          </SurfaceCard>
        </View>

        <View className="px-4 pb-8">
          <TouchableOpacity
            className="rounded-xl"
            onPress={() => setShowDetails((v) => !v)}
          >
            <SurfaceCard>
              <View className="flex-row items-center justify-between">
                <Text className="text-foreground font-semibold">How points work</Text>
                <IconSymbol name={showDetails ? "chevron.up" : "chevron.down"} size={16} color={colors.muted} />
              </View>
              {showDetails ? (
                <View className="mt-3">
                  {POINTS_EXAMPLES.map((item) => (
                    <Text key={item} className="text-sm text-muted mb-1">
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
            </SurfaceCard>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
