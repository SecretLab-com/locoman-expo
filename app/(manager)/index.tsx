import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: Parameters<typeof IconSymbol>[0]["name"];
  color?: string;
  onPress?: () => void;
};

function StatCard({ title, value, icon, color, onPress }: StatCardProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isLight = colorScheme === "light";
  const iconColor = color || colors.primary;

  // Gradient colors based on the icon color
  const getGradientColors = (): readonly [string, string] => {
    if (color === colors.success) {
      return isLight
        ? ["#DCFCE7", "#ECFDF5"] as const
        : ["#065F46", "#047857"] as const;
    }
    return isLight
      ? ["#DBEAFE", "#EFF6FF"] as const
      : ["#1E293B", "#0F172A"] as const;
  };

  const content = (
    <View className="rounded-xl overflow-hidden flex-1 min-w-[140px]">
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="p-4"
      >
        <View className="flex-row items-center justify-between mb-2">
          <IconSymbol name={icon} size={24} color={iconColor} />
          {onPress && <IconSymbol name="chevron.right" size={16} color={colors.muted} />}
        </View>
        <Text className="text-2xl font-bold text-foreground">{value}</Text>
        <Text className="text-sm text-muted mt-1">{title}</Text>
      </LinearGradient>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="flex-1">
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

export default function ManagerDashboardScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isLight = colorScheme === "light";
  const quickActionGradient = isLight
    ? ["#DBEAFE", "#EFF6FF"] as const
    : ["#1E3A5F", "#0F2744"] as const;
  const warningGradient = isLight
    ? ["#FEF3C7", "#FFFBEB"] as const
    : ["#4A3728", "#2D2118"] as const;

  const utils = trpc.useUtils();

  const statsQuery = trpc.coordinator.stats.useQuery();
  const lowInventoryQuery = trpc.admin.lowInventory.useQuery({ threshold: 5, limit: 10 });
  const activityFeedQuery = trpc.admin.activityFeed.useQuery({ limit: 10, category: "all" });
  const stats = statsQuery.data;

  const [refreshing, setRefreshing] = useState(false);
  const [dismissedInventoryIds, setDismissedInventoryIds] = useState<Set<string>>(new Set());

  const lowInventory = (lowInventoryQuery.data || []).filter(
    (item: any) => !dismissedInventoryIds.has(String(item.id))
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      utils.coordinator.stats.invalidate(),
      utils.admin.lowInventory.invalidate(),
      utils.admin.activityFeed.invalidate(),
    ]);
    setRefreshing(false);
  };

  // Dismiss low inventory alert
  const handleDismissAlert = (itemId: string) => {
    setDismissedInventoryIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });
  };

  // Alert trainer about low inventory
  const handleAlertTrainer = (item: { id: string; productName: string }) => {
    Alert.alert(
      "Inventory Alert",
      `Mark "${item.productName}" as acknowledged?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Acknowledge",
          onPress: () => {
            Alert.alert("Acknowledged", "Inventory alert has been marked as reviewed.");
            handleDismissAlert(item.id);
          },
        },
      ]
    );
  };

  // Get activity icon
  const getActivityIcon = (type: string): Parameters<typeof IconSymbol>[0]["name"] => {
    const normalized = type.toLowerCase();
    if (normalized.includes("role") || normalized.includes("status") || normalized.includes("impersonation")) {
      return "person.badge.key.fill";
    }
    if (normalized.includes("bundle")) {
      return "bag.fill";
    }
    if (normalized.includes("delivery")) {
      return "shippingbox.fill";
    }
    if (normalized.includes("payment")) {
      return "creditcard.fill";
    }
    switch (normalized) {
      case "new_user":
        return "person.badge.plus";
      case "order":
        return "bag.fill";
      case "trainer":
        return "figure.run";
      case "delivery":
        return "shippingbox.fill";
      default:
        return "bell.fill";
    }
  };

  const formatRelativeTime = (value: string) => {
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Loading state
  if (statsQuery.isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading dashboard...</Text>
        </View>
      </ScreenContainer>
    );
  }

  // Error state
  if (statsQuery.isError) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-8">
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
          <Text className="text-foreground font-semibold mt-4 text-center">Failed to load dashboard</Text>
          <Text className="text-muted text-sm mt-2 text-center">{statsQuery.error.message}</Text>
          <TouchableOpacity
            onPress={() => statsQuery.refetch()}
            className="mt-4 bg-primary px-6 py-3 rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Retry loading dashboard"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4">
          <Text className="text-2xl font-bold text-foreground">Manager Dashboard</Text>
          <Text className="text-sm text-muted">Platform overview and management</Text>
        </View>

        {/* Stats Grid */}
        <View className="px-4 mb-6">
          <View className="flex-row gap-3 mb-3">
            <StatCard
              title="Total Users"
              value={stats?.totalUsers?.toLocaleString() ?? "—"}
              icon="person.2.fill"
              onPress={() => router.push("/(manager)/users" as any)}
            />
            <StatCard
              title="New This Month"
              value={stats?.newUsersThisMonth?.toLocaleString() ?? "—"}
              icon="figure.run"
              color={colors.success}
              onPress={() => router.push("/(manager)/trainers" as any)}
            />
          </View>
          <View className="flex-row gap-3 mb-3">
            <StatCard
              title="Published Bundles"
              value={stats?.totalBundles?.toLocaleString() ?? "—"}
              icon="bag.fill"
            />
            <StatCard
              title="Pending Approvals"
              value={stats?.pendingApprovals?.toLocaleString() ?? "—"}
              icon="checkmark.circle.fill"
              color={colors.success}
              onPress={() => router.push("/(manager)/approvals" as any)}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity
              onPress={() => router.push("/bundle-editor/new" as any)}
              className="flex-1 rounded-xl overflow-hidden border-2 border-border"
              accessibilityRole="button"
              accessibilityLabel="Create new bundle"
              testID="manager-create-bundle"
            >
              <LinearGradient
                colors={quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
                  <IconSymbol name="plus" size={24} color={colors.primary} />
                </View>
                <Text className="text-sm font-medium text-primary">Create Bundle</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(manager)/templates" as any)}
              className="flex-1 rounded-xl overflow-hidden border-2 border-border"
            >
              <LinearGradient
                colors={quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
                  <IconSymbol name="doc.text.fill" size={24} color={colors.primary} />
                </View>
                <Text className="text-sm font-medium text-primary">Templates</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity
              onPress={() => router.push("/(manager)/invitations" as any)}
              className="flex-1 rounded-xl overflow-hidden border-2 border-border"
            >
              <LinearGradient
                colors={quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
                  <IconSymbol name="envelope.fill" size={24} color={colors.primary} />
                </View>
                <Text className="text-sm font-medium text-primary">Invitations</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(manager)/analytics" as any)}
              className="flex-1 rounded-xl overflow-hidden border-2 border-border"
            >
              <LinearGradient
                colors={quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
                  <IconSymbol name="chart.bar.fill" size={24} color={colors.primary} />
                </View>
                <Text className="text-sm font-medium text-primary">Analytics</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.push("/(manager)/deliveries" as any)}
              className="flex-1 rounded-xl overflow-hidden border-2 border-border"
            >
              <LinearGradient
                colors={quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
                  <IconSymbol name="shippingbox.fill" size={24} color={colors.primary} />
                </View>
                <Text className="text-sm font-medium text-primary">Deliveries</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(manager)/products" as any)}
              className="flex-1 rounded-xl overflow-hidden border-2 border-border"
            >
              <LinearGradient
                colors={quickActionGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
                  <IconSymbol name="bag.fill" size={24} color={colors.primary} />
                </View>
                <Text className="text-sm font-medium text-primary">Products</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(manager)/approvals" as any)}
              className="flex-1 rounded-xl overflow-hidden border-2 border-border"
            >
              <LinearGradient
                colors={warningGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="p-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-warning/20 items-center justify-center mb-2">
                  <IconSymbol name="checkmark.circle.fill" size={24} color={colors.warning} />
                </View>
                <Text className="text-sm font-medium text-warning">Approvals</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Low Inventory Alerts */}
        {lowInventory.length > 0 && (
          <View className="px-4 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.warning} />
                <Text className="text-lg font-semibold text-foreground ml-2">
                  Low Inventory Alerts
                </Text>
              </View>
              <View className="bg-warning/20 px-2 py-1 rounded-full">
                <Text className="text-warning text-xs font-semibold">{lowInventory.length}</Text>
              </View>
            </View>

            {lowInventory.map((item: any) => (
              <View
                key={String(item.id)}
                className="bg-warning/10 rounded-xl p-4 mb-2 border border-warning/30"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">{item.productName}</Text>
                    <Text className="text-sm text-muted mt-1">
                      Only {item.currentStock} left
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => handleDismissAlert(String(item.id))}
                    className="flex-1 bg-surface py-2 rounded-lg items-center"
                  >
                    <Text className="text-muted font-medium">Dismiss</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAlertTrainer({ id: String(item.id), productName: item.productName })}
                    className="flex-1 bg-gradient-to-r from-warning to-warning/80 py-2.5 rounded-full items-center shadow-sm"
                  >
                    <Text className="text-white font-medium">Acknowledge</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pending Approvals */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Pending Approvals</Text>
            <View className="bg-primary/20 px-3 py-1 rounded-full">
              <Text className="text-primary text-sm font-semibold">{stats?.pendingApprovals ?? 0}</Text>
            </View>
          </View>
          <TouchableOpacity
            className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
            activeOpacity={0.8}
            onPress={() => router.push("/(manager)/approvals" as any)}
            accessibilityRole="button"
            accessibilityLabel="View pending approvals"
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
              </View>
              <View className="ml-3">
                <Text className="text-foreground font-semibold">
                  {stats?.pendingApprovals ?? 0} bundles awaiting review
                </Text>
                <Text className="text-sm text-muted">Tap to view and manage</Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Recent Activity</Text>
          <View className="bg-surface rounded-xl divide-y divide-border">
            {activityFeedQuery.isLoading ? (
              <View className="p-4">
                <Text className="text-muted">Loading activity...</Text>
              </View>
            ) : (activityFeedQuery.data || []).length === 0 ? (
              <View className="p-4">
                <Text className="text-muted">No recent activity</Text>
              </View>
            ) : (
              (activityFeedQuery.data || []).map((activity: any) => (
                <View key={activity.id} className="flex-row items-center p-4">
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                    <IconSymbol name={getActivityIcon(activity.action || activity.category || "other")} size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground">{activity.description || activity.action}</Text>
                    <Text className="text-sm text-muted">{formatRelativeTime(activity.createdAt)}</Text>
                  </View>
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
