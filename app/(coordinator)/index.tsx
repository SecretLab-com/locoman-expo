import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBadgeContext } from "@/contexts/badge-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

function StatPill({
  label,
  value,
  tone = "primary",
  onPress,
  testID,
}: {
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "error";
  onPress?: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const toneColor =
    tone === "success"
      ? colors.success
      : tone === "warning"
        ? colors.warning
        : tone === "error"
          ? colors.error
          : colors.primary;

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3"
      {...(onPress
        ? {
          onPress: async () => {
            await haptics.light();
            onPress();
          },
          activeOpacity: 0.7,
          accessibilityRole: "button",
          accessibilityLabel: label,
          testID,
        }
        : {})}
    >
      <Text className="text-xs font-semibold text-muted uppercase">{label}</Text>
      <Text className="text-2xl font-bold text-foreground mt-1">{value}</Text>
      <View className="mt-2 h-1.5 w-12 rounded-full" style={{ backgroundColor: toneColor }} />
    </Wrapper>
  );
}

function MiniBarChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <View className="flex-row items-end gap-1">
      {values.map((value, index) => (
        <View
          key={`bar-${index}`}
          className="w-3 rounded-full"
          style={{ height: 10 + (value / max) * 40, backgroundColor: color, opacity: 0.7 }}
        />
      ))}
    </View>
  );
}

export default function CoordinatorHomeScreen() {
  const colors = useColors();
  const { refetch } = useBadgeContext();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data from tRPC
  const { data: coordinatorStats, refetch: refetchStats } = trpc.coordinator.stats.useQuery();
  const { data: topTrainersData, refetch: refetchTrainers } = trpc.coordinator.topTrainers.useQuery();
  const { data: topBundlesData, refetch: refetchBundles } = trpc.coordinator.topBundles.useQuery();
  const { data: pendingBundlesData, refetch: refetchPendingBundles } = trpc.admin.pendingBundles.useQuery();
  const { data: pendingDeliveriesData, refetch: refetchPendingDeliveries } = trpc.admin.deliveries.useQuery({
    status: "pending",
    limit: 200,
    offset: 0,
  });
  const { data: revenueSummary, refetch: refetchRevenueSummary } = trpc.admin.revenueSummary.useQuery();
  const { data: revenueTrendData, refetch: refetchRevenueTrend } = trpc.admin.revenueTrend.useQuery({ months: 7 });
  const { data: lowInventoryData, refetch: refetchLowInventory } = trpc.admin.lowInventory.useQuery({
    threshold: 5,
    limit: 50,
  });
  const { data: campaignTemplatesData, refetch: refetchCampaignTemplates } =
    trpc.admin.listCampaignTemplates.useQuery({ activeOnly: true });
  const { data: campaignMetricsRows, refetch: refetchCampaignMetrics } =
    trpc.admin.campaignMetricsSummary.useQuery();

  const revenueTrend = useMemo(
    () =>
      (revenueTrendData || []).map((entry) => Number(entry.revenue || 0)),
    [revenueTrendData]
  );
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount || 0);
  }, []);
  const formatPercent = useCallback((value: number) => {
    const rounded = Math.round((value || 0) * 10) / 10;
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
  }, []);
  const pendingApprovalsCount = useMemo(
    () =>
      (pendingBundlesData || []).filter(
        (bundle: any) =>
          bundle.status === "pending_review" || bundle.status === "changes_requested"
      ).length,
    [pendingBundlesData]
  );
  const pendingDeliveriesCount = pendingDeliveriesData?.deliveries.length || 0;
  const lowStockCount = lowInventoryData?.length || 0;
  const thisMonthRevenue = Number(revenueSummary?.thisMonth || 0);
  const lastMonthRevenue = Number(revenueSummary?.lastMonth || 0);
  const lifetimeRevenue = Number(revenueSummary?.total || 0);
  const revenueGrowth = Number(revenueSummary?.growth || 0);

  const topTrainers = (topTrainersData || []).map(t => ({
    id: t.id,
    name: t.name,
    clients: t.clientCount,
    avatar: t.photoUrl || `https://i.pravatar.cc/100?u=${t.id}`
  }));

  const topBundles = (topBundlesData || []).map(b => ({
    id: b.id,
    title: b.title,
    orders: b.orderCount,
    image: b.imageUrl
  }));
  const latestCampaigns = useMemo(() => {
    const templates = (campaignTemplatesData || [])
      .filter((template: any) => Boolean(template.templateActive))
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      )
      .slice(0, 8);
    const metrics = campaignMetricsRows || [];
    return templates.map((template: any) => {
      const rows = metrics.filter((row: any) => row.bundleDraftId === template.id);
      const totals = rows.reduce(
        (acc: any, row: any) => {
          acc.views += Number(row?.views || 0);
          acc.engagements += Number(row?.engagements || 0);
          acc.postsDelivered += Number(row?.postsDelivered || 0);
          acc.requiredPosts += Number(row?.requiredPosts || 0);
          if (row?.trainerId) acc.trainerIds.add(String(row.trainerId));
          return acc;
        },
        {
          views: 0,
          engagements: 0,
          postsDelivered: 0,
          requiredPosts: 0,
          trainerIds: new Set<string>(),
        },
      );
      const engagementRate =
        totals.views > 0 ? (totals.engagements / totals.views) * 100 : 0;
      const deliveryPct =
        totals.requiredPosts > 0
          ? (totals.postsDelivered / totals.requiredPosts) * 100
          : 0;
      return {
        id: template.id,
        title: template.title || "Campaign",
        brandName: template.primaryBrandName || "Unassigned brand",
        imageUrl: template.imageUrl || null,
        createdAt: template.createdAt,
        trainerCount: totals.trainerIds.size,
        views: totals.views,
        engagementRate,
        deliveryPct,
      };
    });
  }, [campaignTemplatesData, campaignMetricsRows]);
  const pendingActions = [
    {
      label: "Approvals",
      value: String(pendingApprovalsCount),
      tone: "warning" as const,
      onPress: () => router.push("/(coordinator)/approvals" as any),
      testID: "coord-pending-approvals",
    },
    {
      label: "Deliveries",
      value: String(pendingDeliveriesCount),
      tone: "primary" as const,
      onPress: () => router.push("/(coordinator)/deliveries" as any),
      testID: "coord-pending-deliveries",
    },
  ];
  const alerts = useMemo(
    () => [
      {
        label: "Actionable approvals",
        value: String(pendingApprovalsCount),
        tone: colors.warning,
        icon: "checkmark.circle.fill",
        route: "/(coordinator)/approvals",
        testID: "coord-alert-approvals",
      },
      {
        label: "Pending deliveries",
        value: String(pendingDeliveriesCount),
        tone: colors.warning,
        icon: "shippingbox.fill",
        route: "/(coordinator)/deliveries",
        testID: "coord-alert-pending-deliveries",
      },
      {
        label: "Low stock",
        value: String(lowStockCount),
        tone: colors.primary,
        icon: "shippingbox.fill",
        route: "/(coordinator)/bundles?filter=low-stock",
        testID: "coord-alert-low-stock",
      },
      {
        label: "Revenue growth",
        value: formatPercent(revenueGrowth),
        tone: revenueGrowth >= 0 ? colors.success : colors.error,
        icon: "chart.line.uptrend.xyaxis",
        route: "/(coordinator)/analytics?section=finance",
        testID: "coord-alert-revenue-growth",
      },
    ],
    [
      colors.warning,
      colors.primary,
      colors.success,
      colors.error,
      pendingApprovalsCount,
      pendingDeliveriesCount,
      lowStockCount,
      revenueGrowth,
      formatPercent,
    ]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      refetchStats(),
      refetchTrainers(),
      refetchBundles(),
      refetchPendingBundles(),
      refetchPendingDeliveries(),
      refetchRevenueSummary(),
      refetchRevenueTrend(),
      refetchLowInventory(),
      refetchCampaignTemplates(),
      refetchCampaignMetrics(),
    ]);
    setRefreshing(false);
  }, [
    refetch,
    refetchStats,
    refetchTrainers,
    refetchBundles,
    refetchPendingBundles,
    refetchPendingDeliveries,
    refetchRevenueSummary,
    refetchRevenueTrend,
    refetchLowInventory,
    refetchCampaignTemplates,
    refetchCampaignMetrics,
  ]);

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Banner */}
        <View className="px-4 pt-2 pb-4">
          <View className="rounded-3xl border border-border bg-surface px-5 py-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-primary uppercase">Coordinator</Text>
                <Text className="text-2xl font-bold text-foreground mt-1">Operations overview</Text>
                <Text className="text-sm text-muted mt-1">
                  Track approvals, growth, and critical alerts in one place.
                </Text>
              </View>
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
                <IconSymbol name="sparkles" size={24} color={colors.primary} />
              </View>
            </View>
          </View>
        </View>

        {/* Pending Actions */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Pending actions</Text>
            <TouchableOpacity
              onPress={() => router.push("/(coordinator)/approvals" as any)}
              accessibilityRole="button"
              accessibilityLabel="Show all pending actions"
              testID="coord-pending-show-all"
            >
              <Text className="text-sm text-primary">Show all</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3">
            {pendingActions.slice(0, 2).map((item) => (
              <StatPill
                key={item.label}
                label={item.label}
                value={item.value}
                tone={item.tone}
                onPress={item.onPress}
                testID={item.testID}
              />
            ))}
          </View>
        </View>

        {/* Financial Status */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Financial status</Text>
            <Text className="text-sm text-muted">Last 7 days</Text>
          </View>
          <TouchableOpacity
            onPress={async () => {
              await haptics.light();
              router.push("/(coordinator)/analytics?section=finance" as any);
            }}
            className="rounded-2xl border border-border bg-surface p-4"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View financial analytics"
            testID="coord-financial-detail"
          >
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm text-muted">Revenue</Text>
                <Text className="text-2xl font-bold text-foreground">{formatCurrency(thisMonthRevenue)}</Text>
                <Text className={`text-xs mt-1 ${revenueGrowth >= 0 ? "text-success" : "text-error"}`}>
                  {formatPercent(revenueGrowth)} vs last month
                </Text>
              </View>
              <MiniBarChart values={revenueTrend.length ? revenueTrend : [0, 0, 0, 0, 0, 0, 0]} color={colors.primary} />
            </View>
            <View className="mt-4 flex-row justify-between">
              <View>
                <Text className="text-xs text-muted">This month</Text>
                <Text className="text-base font-semibold text-foreground">{formatCurrency(thisMonthRevenue)}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Last month</Text>
                <Text className="text-base font-semibold text-foreground">{formatCurrency(lastMonthRevenue)}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Lifetime</Text>
                <Text className="text-base font-semibold text-foreground">{formatCurrency(lifetimeRevenue)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* User Growth */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">User growth</Text>
            <TouchableOpacity
              onPress={() => router.push("/(coordinator)/users?sort=newest" as any)}
              accessibilityRole="button"
              accessibilityLabel="Show all users by newest"
              testID="coord-growth-show-all"
            >
              <Text className="text-sm text-primary">Show all</Text>
            </TouchableOpacity>
          </View>
          <View className="rounded-2xl border border-border bg-surface p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm text-muted">New users</Text>
                <Text className="text-2xl font-bold text-foreground">{coordinatorStats?.newUsersThisMonth || 0}</Text>
              </View>
            </View>
            <View className="mt-4 flex-row justify-between">
              <View>
                <Text className="text-xs text-muted">Total users</Text>
                <Text className="text-base font-semibold text-foreground">{coordinatorStats?.totalUsers || 0}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Total bundles</Text>
                <Text className="text-base font-semibold text-foreground">{coordinatorStats?.totalBundles || 0}</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Pending</Text>
                <Text className="text-base font-semibold text-foreground">{pendingApprovalsCount}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Alerts */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Alerts</Text>
            <TouchableOpacity
              onPress={() => router.push("/(coordinator)/analytics" as any)}
              accessibilityRole="button"
              accessibilityLabel="View analytics"
              testID="coord-analytics-show-all"
            >
              <Text className="text-sm text-primary">Show all</Text>
            </TouchableOpacity>
          </View>
          <View className="rounded-2xl border border-border bg-surface p-4">
            {alerts.map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={async () => {
                  await haptics.light();
                  router.push(item.route as any);
                }}
                className="flex-row items-center justify-between border-b border-border py-3 last:border-b-0"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.label}`}
                testID={item.testID}
              >
                <View className="flex-row items-center">
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-background">
                    <IconSymbol name={item.icon as any} size={18} color={item.tone} />
                  </View>
                  <Text className="text-sm text-foreground ml-3">{item.label}</Text>
                </View>
                <Text className="text-sm font-semibold text-foreground">{item.value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Top Trainers */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Top trainers</Text>
            <TouchableOpacity
              onPress={() => router.push("/(coordinator)/users?role=trainer&sort=performance" as any)}
              accessibilityRole="button"
              accessibilityLabel="Show all trainers by performance"
              testID="coord-trainers-show-all"
            >
              <Text className="text-sm text-primary">Show all</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3">
            {topTrainers.map((trainer) => (
              <TouchableOpacity
                key={trainer.id}
                onPress={async () => {
                  await haptics.light();
                  router.push(`/trainer/${trainer.id}` as any);
                }}
                className="flex-1 rounded-2xl border border-border bg-surface p-3 items-center"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View ${trainer.name}`}
                testID={`coord-trainer-${trainer.id}`}
              >
                <View className="h-14 w-14 rounded-full bg-muted/30 items-center justify-center overflow-hidden">
                  <IconSymbol name="person.fill" size={20} color={colors.muted} />
                  <Image
                    source={{ uri: trainer.avatar }}
                    style={[styles.coverImage, styles.roundedFull]}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                </View>
                <Text className="text-sm font-semibold text-foreground mt-2" numberOfLines={1}>
                  {trainer.name}
                </Text>
                <Text className="text-xs text-muted">{trainer.clients} clients</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Top Bundles */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Top bundles</Text>
            <TouchableOpacity
              onPress={() => router.push("/(coordinator)/bundles?sort=popular" as any)}
              accessibilityRole="button"
              accessibilityLabel="Show all top bundles"
              testID="coord-bundles-show-all"
            >
              <Text className="text-sm text-primary">Show all</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3">
            {topBundles.map((bundle) => (
              <TouchableOpacity
                key={bundle.id}
                onPress={async () => {
                  await haptics.light();
                  router.push(`/bundle/${bundle.id}` as any);
                }}
                className="flex-1 rounded-2xl border border-border bg-surface overflow-hidden"
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`View ${bundle.title}`}
                testID={`coord-bundle-${bundle.id}`}
              >
                <View className="h-20 w-full bg-muted/30 items-center justify-center">
                  <IconSymbol name="shippingbox.fill" size={20} color={colors.muted} />
                  <Image
                    source={bundle.image ? { uri: bundle.image } : undefined}
                    style={styles.coverImage}
                    contentFit="cover"
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                </View>
                <View className="p-3">
                  <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                    {bundle.title}
                  </Text>
                  <Text className="text-xs text-muted mt-1">{bundle.orders} orders</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="px-4 mt-1 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Latest campaigns</Text>
            <TouchableOpacity
              onPress={() => router.push("/(coordinator)/templates" as any)}
              accessibilityRole="button"
              accessibilityLabel="Show all campaigns"
              testID="coord-campaigns-show-all"
            >
              <Text className="text-sm text-primary">Show all</Text>
            </TouchableOpacity>
          </View>
          <View className="rounded-2xl border border-border bg-surface p-3">
            {latestCampaigns.length === 0 ? (
              <Text className="text-sm text-muted">No active campaigns yet.</Text>
            ) : (
              latestCampaigns.map((campaign) => (
                <TouchableOpacity
                  key={campaign.id}
                  onPress={async () => {
                    await haptics.light();
                    router.push({
                      pathname: "/(coordinator)/campaign-dashboard",
                      params: { bundleId: campaign.id },
                    } as any);
                  }}
                  className="mb-2 last:mb-0 rounded-xl border border-border bg-background/70 overflow-hidden"
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`View campaign ${campaign.title}`}
                  testID={`coord-campaign-row-${campaign.id}`}
                >
                  <View className="flex-row">
                    <View
                      className="w-20 h-20 items-center justify-center"
                      style={{ backgroundColor: `${colors.primary}1A` }}
                    >
                      {campaign.imageUrl ? (
                        <Image
                          source={{ uri: campaign.imageUrl }}
                          style={styles.coverImage}
                          contentFit="cover"
                          transition={150}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <IconSymbol name="photo" size={18} color={colors.primary} />
                      )}
                    </View>
                    <View className="flex-1 p-3">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-2">
                          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                            {campaign.title}
                          </Text>
                          <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                            {campaign.brandName}
                          </Text>
                        </View>
                        <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                      </View>

                      <View className="flex-row items-center gap-1.5 mt-2">
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${colors.primary}1F` }}
                        >
                          <Text className="text-[10px] font-semibold" style={{ color: colors.primary }}>
                            {campaign.trainerCount} trainers
                          </Text>
                        </View>
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${colors.success}1F` }}
                        >
                          <Text className="text-[10px] font-semibold" style={{ color: colors.success }}>
                            ER {campaign.engagementRate.toFixed(1)}%
                          </Text>
                        </View>
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${colors.warning}1F` }}
                        >
                          <Text className="text-[10px] font-semibold" style={{ color: colors.warning }}>
                            Delivery {campaign.deliveryPct.toFixed(0)}%
                          </Text>
                        </View>
                      </View>

                      <View className="mt-2">
                        <View className="h-1.5 rounded-full bg-surface overflow-hidden">
                          <View
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${Math.max(4, Math.min(100, campaign.deliveryPct))}%`,
                              backgroundColor:
                                campaign.deliveryPct >= 75
                                  ? colors.success
                                  : campaign.deliveryPct >= 45
                                    ? colors.warning
                                    : colors.error,
                            }}
                          />
                        </View>
                        <Text className="text-[11px] text-muted mt-1">
                          {campaign.views.toLocaleString()} views
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  coverImage: {
    ...StyleSheet.absoluteFillObject,
  },
  roundedFull: {
    borderRadius: 999,
  },
});
