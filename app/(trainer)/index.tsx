import { Text, View, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/auth-context";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: Parameters<typeof IconSymbol>[0]["name"];
  color?: string;
  onPress?: () => void;
};

function StatCard({ title, value, icon, color, onPress }: StatCardProps) {
  const colors = useColors();
  const iconColor = color || colors.primary;

  const content = (
    <View className="bg-surface rounded-xl p-4 flex-1 min-w-[140px]">
      <View className="flex-row items-center justify-between mb-2">
        <IconSymbol name={icon} size={24} color={iconColor} />
        {onPress && (
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        )}
      </View>
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-sm text-muted mt-1">{title}</Text>
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

type QuickActionProps = {
  title: string;
  icon: Parameters<typeof IconSymbol>[0]["name"];
  onPress: () => void;
};

function QuickAction({ title, icon, onPress }: QuickActionProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl p-4 items-center flex-1 mx-1"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mb-2">
        <IconSymbol name={icon} size={24} color={colors.primary} />
      </View>
      <Text className="text-sm font-medium text-foreground text-center">{title}</Text>
    </TouchableOpacity>
  );
}

export default function TrainerDashboardScreen() {
  const colors = useColors();
  const { user } = useAuthContext();

  // Fetch trainer stats from API
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.trainerDashboard.stats.useQuery();
  const { data: recentOrders, isLoading: ordersLoading, refetch: refetchOrders } = trpc.trainerDashboard.recentOrders.useQuery();
  const { data: todaySessions, isLoading: sessionsLoading, refetch: refetchSessions } = trpc.trainerDashboard.todaySessions.useQuery();
  const { data: points, refetch: refetchPoints } = trpc.trainerDashboard.points.useQuery();

  const isLoading = statsLoading || ordersLoading || sessionsLoading;
  const isRefetching = false;

  const onRefresh = async () => {
    await Promise.all([
      refetchStats(),
      refetchOrders(),
      refetchSessions(),
      refetchPoints(),
    ]);
  };

  // Default stats if not loaded
  const displayStats = stats || {
    totalEarnings: 0,
    monthlyEarnings: 0,
    activeClients: 0,
    activeBundles: 0,
    pendingOrders: 0,
    completedDeliveries: 0,
  };

  const displayPoints = points || { totalPoints: 0, statusTier: "Bronze" };
  const displayOrders = recentOrders || [];
  const displaySessions = todaySessions || [];

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading dashboard...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
            <Text className="text-sm text-muted">Welcome back, {user?.name || "Trainer"}!</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(trainer)/settings" as any)}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          >
            <IconSymbol name="gearshape.fill" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Status Tier Banner */}
        <TouchableOpacity
          onPress={() => router.push("/(trainer)/points" as any)}
          className="mx-4 mb-4 bg-gradient-to-r from-primary/20 to-primary/10 rounded-xl p-4 border border-primary/30"
          activeOpacity={0.8}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
                <IconSymbol name="star.fill" size={20} color="#fff" />
              </View>
              <View className="ml-3">
                <Text className="text-sm text-muted">Status</Text>
                <Text className="text-lg font-bold text-primary">{displayPoints.statusTier}</Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-sm text-muted">Points</Text>
              <Text className="text-lg font-bold text-foreground">{displayPoints.totalPoints.toLocaleString()}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Stats Grid */}
        <View className="px-4 mb-6">
          <View className="flex-row gap-3 mb-3">
            <StatCard
              title="Total Earnings"
              value={`$${displayStats.totalEarnings.toLocaleString()}`}
              icon="dollarsign.circle.fill"
              color={colors.success}
              onPress={() => router.push("/(trainer)/earnings" as any)}
            />
            <StatCard
              title="This Month"
              value={`$${displayStats.monthlyEarnings.toLocaleString()}`}
              icon="chart.bar.fill"
            />
          </View>
          <View className="flex-row gap-3">
            <StatCard
              title="Active Clients"
              value={displayStats.activeClients}
              icon="person.2.fill"
              onPress={() => router.push("/(trainer)/clients" as any)}
            />
            <StatCard
              title="Active Bundles"
              value={displayStats.activeBundles}
              icon="bag.fill"
              onPress={() => router.push("/(trainer)/bundles" as any)}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
          <View className="flex-row mb-2">
            <QuickAction
              title="New Bundle"
              icon="plus"
              onPress={() => router.push("/bundle-editor/new" as any)}
            />
            <QuickAction
              title="Invite Client"
              icon="person.badge.plus"
              onPress={() => router.push("/(trainer)/invite" as any)}
            />
            <QuickAction
              title="Messages"
              icon="message.fill"
              onPress={() => router.push("/messages" as any)}
            />
          </View>
          <View className="flex-row">
            <QuickAction
              title="Partnerships"
              icon="megaphone.fill"
              onPress={() => router.push("/(trainer)/partnerships" as any)}
            />
            <QuickAction
              title="Orders"
              icon="bag.fill"
              onPress={() => router.push("/(trainer)/orders" as any)}
            />
            <QuickAction
              title="Deliveries"
              icon="shippingbox.fill"
              onPress={() => router.push("/(trainer)/deliveries" as any)}
            />
          </View>
        </View>

        {/* Today's Sessions */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Today's Sessions</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/calendar" as any)}>
              <Text className="text-primary font-medium">View Calendar</Text>
            </TouchableOpacity>
          </View>

          {displaySessions.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 items-center border border-border">
              <IconSymbol name="calendar" size={32} color={colors.muted} />
              <Text className="text-muted mt-2">No sessions today</Text>
            </View>
          ) : (
            displaySessions.map((session: any) => (
              <TouchableOpacity
                key={session.id}
                className="bg-surface rounded-xl p-4 mb-2 border border-border flex-row items-center"
                activeOpacity={0.8}
                onPress={() => router.push("/(trainer)/calendar" as any)}
              >
                <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                  <IconSymbol name="clock.fill" size={24} color={colors.primary} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-base font-semibold text-foreground">{session.clientName}</Text>
                  <Text className="text-sm text-muted">{session.type || "Session"}</Text>
                </View>
                <Text className="text-base font-semibold text-primary">
                  {new Date(session.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Orders */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Recent Orders</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/orders" as any)}>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>

          {displayOrders.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 items-center border border-border">
              <IconSymbol name="bag.fill" size={32} color={colors.muted} />
              <Text className="text-muted mt-2">No recent orders</Text>
            </View>
          ) : (
            displayOrders.slice(0, 3).map((order: any) => (
              <TouchableOpacity
                key={order.id}
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
                activeOpacity={0.8}
                onPress={() => router.push("/(trainer)/orders" as any)}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">{order.clientName || "Client"}</Text>
                    <Text className="text-sm text-muted mt-1">{order.bundleTitle || "Bundle"}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-base font-bold text-foreground">${parseFloat(order.total || "0").toFixed(2)}</Text>
                    <View
                      className={`px-2 py-1 rounded-full mt-1 ${
                        order.status === "completed" ? "bg-success/20" : "bg-warning/20"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          order.status === "completed" ? "text-success" : "text-warning"
                        }`}
                      >
                        {(order.status || "pending").charAt(0).toUpperCase() + (order.status || "pending").slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Performance Summary */}
        <View className="px-4 mb-8">
          <Text className="text-lg font-semibold text-foreground mb-3">Performance</Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-muted">Pending Orders</Text>
              <Text className="text-foreground font-semibold">{displayStats.pendingOrders}</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-muted">Completed Deliveries</Text>
              <Text className="text-foreground font-semibold">{displayStats.completedDeliveries}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
