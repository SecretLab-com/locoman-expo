import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

export default function AnalyticsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "year">("month");
  const monthsByPeriod: Record<"week" | "month" | "year", number> = {
    week: 1,
    month: 6,
    year: 12,
  };
  const trendMonths = monthsByPeriod[selectedPeriod];

  const utils = trpc.useUtils();

  const statsQuery = trpc.coordinator.stats.useQuery();
  const topTrainersQuery = trpc.coordinator.topTrainers.useQuery();
  const topBundlesQuery = trpc.coordinator.topBundles.useQuery();
  const revenueSummaryQuery = trpc.admin.revenueSummary.useQuery();
  const revenueTrendQuery = trpc.admin.revenueTrend.useQuery({ months: trendMonths });

  const stats = statsQuery.data;
  const topTrainers = topTrainersQuery.data ?? [];
  const topBundles = topBundlesQuery.data ?? [];
  const revenueSummary = revenueSummaryQuery.data ?? {
    total: 0,
    thisMonth: 0,
    lastMonth: 0,
    growth: 0,
  };
  const revenueTrend = revenueTrendQuery.data ?? [];

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      utils.coordinator.stats.invalidate(),
      utils.coordinator.topTrainers.invalidate(),
      utils.coordinator.topBundles.invalidate(),
      utils.admin.revenueSummary.invalidate(),
      utils.admin.revenueTrend.invalidate(),
    ]);
    setRefreshing(false);
  };

  // Get max revenue for chart
  const maxRevenue = Math.max(1, ...revenueTrend.map((d: any) => Number(d.revenue || 0)));

  const isLoading =
    statsQuery.isLoading ||
    topTrainersQuery.isLoading ||
    topBundlesQuery.isLoading ||
    revenueSummaryQuery.isLoading ||
    revenueTrendQuery.isLoading;
  const isError =
    statsQuery.isError &&
    topTrainersQuery.isError &&
    topBundlesQuery.isError &&
    revenueSummaryQuery.isError &&
    revenueTrendQuery.isError;

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Analytics</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading analytics...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Analytics</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
          <Text className="text-foreground font-semibold mt-4 text-center">Failed to load analytics</Text>
          <TouchableOpacity
            onPress={() => {
              statsQuery.refetch();
              topTrainersQuery.refetch();
              topBundlesQuery.refetch();
              revenueSummaryQuery.refetch();
              revenueTrendQuery.refetch();
            }}
            className="mt-4 bg-primary px-6 py-3 rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Retry loading analytics"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Analytics</Text>
            <Text className="text-sm text-muted mt-1">Platform performance insights</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Period Selector */}
        <View className="flex-row bg-surface rounded-xl p-1 mb-6">
          {(["week", "month", "year"] as const).map((period) => (
            <TouchableOpacity
              key={period}
              onPress={() => setSelectedPeriod(period)}
              className={`flex-1 py-2 rounded-lg ${
                selectedPeriod === period ? "bg-primary" : ""
              }`}
              accessibilityRole="button"
              accessibilityLabel={`Select ${period} period`}
            >
              <Text
                className={`text-center font-medium capitalize ${
                  selectedPeriod === period ? "text-white" : "text-muted"
                }`}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Revenue Overview */}
        <View className="bg-surface rounded-xl p-6 mb-6">
          <Text className="text-sm text-muted">Total Revenue</Text>
          <Text className="text-4xl font-bold text-foreground mt-1">
            ${Number(revenueSummary.total || 0).toLocaleString()}
          </Text>

          <View className="flex-row mt-4 gap-4">
            <View className="flex-1 bg-background rounded-lg p-3">
              <Text className="text-xs text-muted">This Month</Text>
              <Text className="text-lg font-bold text-foreground">
                ${Number(revenueSummary.thisMonth || 0).toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-background rounded-lg p-3">
              <Text className="text-xs text-muted">Last Month</Text>
              <Text className="text-lg font-bold text-foreground">
                ${Number(revenueSummary.lastMonth || 0).toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-success/10 rounded-lg p-3">
              <Text className="text-xs text-muted">Growth</Text>
              <View className="flex-row items-center">
                <IconSymbol name="arrow.up" size={14} color={colors.success} />
                <Text className="text-lg font-bold text-success ml-1">
                  {Number(revenueSummary.growth || 0).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Revenue Chart */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Revenue Trend ({trendMonths} month{trendMonths === 1 ? "" : "s"})
          </Text>
          <View className="bg-surface rounded-xl p-4">
            {revenueTrend.length === 0 ? (
              <View className="h-40 items-center justify-center">
                <Text className="text-muted">No revenue trend data available</Text>
              </View>
            ) : (
              <View className="flex-row items-end justify-between h-40">
                {revenueTrend.map((data: any, index: number) => {
                  const revenue = Number(data.revenue || 0);
                  const height = (revenue / maxRevenue) * 100;
                  const isCurrentMonth = index === revenueTrend.length - 1;
                  return (
                    <View key={`${data.month}-${index}`} className="items-center flex-1">
                      <Text className="text-xs text-muted mb-1">
                        ${(revenue / 1000).toFixed(0)}k
                      </Text>
                      <View
                        className="w-8 rounded-t-lg"
                        style={{
                          height: `${height}%`,
                          backgroundColor: isCurrentMonth ? colors.primary : `${colors.primary}40`,
                        }}
                      />
                      <Text className="text-xs text-muted mt-2">{data.month}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* Key Metrics */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Key Metrics</Text>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-xl p-4">
              <IconSymbol name="bag.fill" size={24} color={colors.primary} />
              <Text className="text-2xl font-bold text-foreground mt-2">
                {stats?.totalBundles ?? 0}
              </Text>
              <Text className="text-sm text-muted">Published Bundles</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-4">
              <IconSymbol name="person.2.fill" size={24} color={colors.success} />
              <Text className="text-2xl font-bold text-foreground mt-2">
                {stats?.totalUsers?.toLocaleString() ?? 0}
              </Text>
              <Text className="text-sm text-muted">Total Users</Text>
            </View>
          </View>
        </View>

        {/* Top Trainers */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Top Trainers</Text>
          <View className="bg-surface rounded-xl divide-y divide-border">
            {topTrainers.length === 0 ? (
              <View className="p-6 items-center">
                <Text className="text-muted">No trainer data available</Text>
              </View>
            ) : (
              topTrainers.map((trainer: any, index: number) => (
                <View key={trainer.id || index} className="flex-row items-center p-4">
                  <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center">
                    <Text className="text-sm font-bold text-primary">{index + 1}</Text>
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">
                      {trainer.name || trainer.trainer_name || "Unknown"}
                    </Text>
                    <Text className="text-sm text-muted">
                      {trainer.client_count ?? trainer.clients ?? 0} clients
                    </Text>
                  </View>
                  <Text className="text-foreground font-semibold">
                    ${(trainer.total_revenue ?? trainer.revenue ?? 0).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Top Bundles */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Top Bundles</Text>
          <View className="bg-surface rounded-xl divide-y divide-border">
            {topBundles.length === 0 ? (
              <View className="p-6 items-center">
                <Text className="text-muted">No bundle data available</Text>
              </View>
            ) : (
              topBundles.map((bundle: any, index: number) => (
                <View key={bundle.id || index} className="flex-row items-center p-4">
                  <View className="w-8 h-8 rounded-full bg-success/20 items-center justify-center">
                    <Text className="text-sm font-bold text-success">{index + 1}</Text>
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">
                      {bundle.title || bundle.bundle_title || "Unknown"}
                    </Text>
                    <Text className="text-sm text-muted">
                      {bundle.sales_count ?? bundle.sales ?? 0} sales
                    </Text>
                  </View>
                  <Text className="text-foreground font-semibold">
                    ${(bundle.total_revenue ?? bundle.revenue ?? 0).toLocaleString()}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
