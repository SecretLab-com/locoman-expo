import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBadgeContext } from "@/contexts/badge-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

type QuickActionProps = {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
};

function QuickAction({ icon, title, subtitle, onPress, testID }: QuickActionProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={async () => {
        await haptics.light();
        onPress();
      }}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
          <IconSymbol name={icon} size={24} color={colors.primary} />
        </View>
        <View className="flex-1 ml-4">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          <Text className="text-sm text-muted mt-0.5">{subtitle}</Text>
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.muted} />
      </View>
    </TouchableOpacity>
  );
}

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
  const userGrowth = useMemo(() => [14, 18, 22, 16, 24, 28, 31], []);
  const revenueTrend = useMemo(() => [22, 30, 26, 34, 42, 38, 46], []);
  const topTrainers = useMemo(
    () => [
      { id: 101, name: "Ava Brooks", clients: 42, avatar: "https://i.pravatar.cc/100?img=11" },
      { id: 102, name: "Kai Rivera", clients: 38, avatar: "https://i.pravatar.cc/100?img=32" },
      { id: 103, name: "Noah Patel", clients: 34, avatar: "https://i.pravatar.cc/100?img=26" },
    ],
    []
  );
  const topBundles = useMemo(
    () => [
      {
        id: 501,
        title: "Strength Starter",
        orders: 128,
        image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=300",
      },
      {
        id: 502,
        title: "Lean Nutrition",
        orders: 104,
        image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=300",
      },
      {
        id: 503,
        title: "Endurance Pro",
        orders: 92,
        image: "https://images.unsplash.com/photo-1517832207067-4db24a2ae47c?w=300",
      },
    ],
    []
  );
  const pendingActions = useMemo(
    () => [
      {
        label: "Approvals",
        value: "12",
        tone: "warning" as const,
        onPress: () => router.push("/(coordinator)/approvals" as any),
        testID: "coord-pending-approvals",
      },
      {
        label: "Deliveries",
        value: "7",
        tone: "primary" as const,
        onPress: () => router.push("/(coordinator)/deliveries" as any),
        testID: "coord-pending-deliveries",
      },
    ],
    []
  );
  const alerts = useMemo(
    () => [
      {
        label: "Failed payments",
        value: "4",
        tone: colors.error,
        icon: "exclamationmark.triangle.fill",
        route: "/(coordinator)/alerts?section=failed-payments",
        testID: "coord-alert-failed-payments",
      },
      {
        label: "Overdue deliveries",
        value: "6",
        tone: colors.warning,
        icon: "clock.fill",
        route: "/(coordinator)/deliveries?filter=overdue",
        testID: "coord-alert-overdue-deliveries",
      },
      {
        label: "Low stock",
        value: "9",
        tone: colors.primary,
        icon: "shippingbox.fill",
        route: "/(coordinator)/bundles?filter=low-stock",
        testID: "coord-alert-low-stock",
      },
      {
        label: "Flagged accounts",
        value: "2",
        tone: colors.error,
        icon: "person.crop.circle.badge.exclamationmark",
        route: "/(coordinator)/users?sort=alphabetical",
        testID: "coord-alert-flagged",
      },
    ],
    [colors.error, colors.warning, colors.primary]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
                <Text className="text-2xl font-bold text-foreground">$48.2k</Text>
                <Text className="text-xs text-success mt-1">+12% vs last week</Text>
              </View>
              <MiniBarChart values={revenueTrend} color={colors.primary} />
            </View>
            <View className="mt-4 flex-row justify-between">
              <View>
                <Text className="text-xs text-muted">Failed payments</Text>
                <Text className="text-base font-semibold text-foreground">4</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Chargebacks</Text>
                <Text className="text-base font-semibold text-foreground">1</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Payouts due</Text>
                <Text className="text-base font-semibold text-foreground">$6.4k</Text>
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
                <Text className="text-2xl font-bold text-foreground">142</Text>
              </View>
              <MiniBarChart values={userGrowth} color={colors.success} />
            </View>
            <View className="mt-4 flex-row justify-between">
              <View>
                <Text className="text-xs text-muted">Active users</Text>
                <Text className="text-base font-semibold text-foreground">1,284</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">Retention</Text>
                <Text className="text-base font-semibold text-foreground">68%</Text>
              </View>
              <View>
                <Text className="text-xs text-muted">New trainers</Text>
                <Text className="text-base font-semibold text-foreground">8</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Alerts */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Alerts</Text>
            <TouchableOpacity
              onPress={() => router.push("/(coordinator)/alerts?section=alerts" as any)}
              accessibilityRole="button"
              accessibilityLabel="Show all alerts"
              testID="coord-alerts-show-all"
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
                key={trainer.name}
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
                    className="absolute h-14 w-14 rounded-full"
                    contentFit="cover"
                    transition={150}
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
                key={bundle.title}
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
                    source={{ uri: bundle.image }}
                    className="absolute h-20 w-full"
                    contentFit="cover"
                    transition={150}
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

        {/* Actions Bar */}
        <View className="px-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Actions</Text>
          <View className="flex-row flex-wrap gap-3">
            {[
              { label: "Impersonate", icon: "person.crop.circle.badge.checkmark", route: "/(coordinator)/users", testID: "coord-action-impersonate" },
              { label: "Manage Users", icon: "person.2.fill", route: "/(coordinator)/users", testID: "coord-action-users" },
              { label: "Approvals", icon: "checkmark.circle.fill", route: "/(coordinator)/approvals", testID: "coord-action-approvals" },
              { label: "Catalog", icon: "rectangle.grid.2x2.fill", route: "/(coordinator)/bundles", testID: "coord-action-catalog" },
            ].map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={async () => {
                  await haptics.light();
                  router.push(action.route as any);
                }}
                className="flex-row items-center rounded-full border border-border bg-surface px-4 py-2"
                accessibilityRole="button"
                accessibilityLabel={action.label}
                testID={action.testID}
              >
                <IconSymbol name={action.icon as any} size={16} color={colors.primary} />
                <Text className="text-sm font-semibold text-foreground ml-2">{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mt-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick actions</Text>

          <QuickAction
            icon="rectangle.grid.2x2.fill"
            title="Product Catalog"
            subtitle="Manage products and inventory"
            onPress={() => router.push("/(coordinator)/bundles" as any)}
            testID="coord-quick-catalog"
          />

          <QuickAction
            icon="doc.text.fill"
            title="System Logs"
            subtitle="View activity and error logs"
            onPress={() => router.push("/(coordinator)/logs" as any)}
            testID="coord-quick-logs"
          />
        </View>

        {/* Back to Main App */}
        <View className="px-4 mt-6 mb-8">
          <TouchableOpacity
            onPress={async () => {
              await haptics.light();
              router.replace("/(tabs)");
            }}
            className="bg-surface rounded-xl p-4 border border-border"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back to Main App"
            testID="coord-back-main"
          >
            <View className="flex-row items-center justify-center">
              <IconSymbol name="arrow.left" size={20} color={colors.primary} />
              <Text className="text-primary font-semibold ml-2">Back to Main App</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
