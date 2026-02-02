import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
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
    <View className="rounded-xl overflow-hidden flex-1 min-w-[140px] bg-surface border border-border p-4">
      <View className="flex-row items-center justify-between mb-2">
        <IconSymbol name={icon} size={24} color={iconColor} />
        {onPress && <IconSymbol name="chevron.right" size={16} color={colors.muted} />}
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
      className="rounded-xl overflow-hidden flex-1 mx-1 bg-surface border border-border p-4 items-center"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
        <IconSymbol name={icon} size={24} color={colors.primary} />
      </View>
      <Text className="text-sm font-medium text-foreground text-center">{title}</Text>
    </TouchableOpacity>
  );
}

export default function TrainerDashboardScreen() {
  const colors = useColors();
  const { user, effectiveUser, effectiveRole } = useAuthContext();
  const roleBase =
    effectiveRole === "client"
      ? "/(client)"
      : effectiveRole === "trainer"
        ? "/(trainer)"
        : effectiveRole === "manager"
          ? "/(manager)"
          : effectiveRole === "coordinator"
            ? "/(coordinator)"
            : "/(tabs)";

  // Fetch trainer stats from API
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.trainerDashboard.stats.useQuery();
  const { data: points, refetch: refetchPoints } = trpc.trainerDashboard.points.useQuery();

  const isLoading = statsLoading;
  const isRefetching = false;

  const onRefresh = async () => {
    await Promise.all([
      refetchStats(),
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
  const statusLabel = displayPoints.statusTier || "Delta";

  const salesByCategory = [
    { label: "Sessions", value: 62 },
    { label: "Products", value: 24 },
    { label: "Bundles", value: 14 },
  ];

  const balanceSnapshot = {
    available: 1925,
    pending: 320,
    lastPayout: "Jan 31",
    nextPayout: "Feb 28",
  };

  const clientPreview = [
    { id: "c1", name: "Alex", tag: "Hyrox", photoUrl: "https://i.pravatar.cc/150?img=12" },
    { id: "c2", name: "Sam", tag: "Marathon", photoUrl: "https://i.pravatar.cc/150?img=32" },
    { id: "c3", name: "Tom", tag: "Strength", photoUrl: "https://i.pravatar.cc/150?img=44" },
  ];

  const servicesPreview = ["1:1 PT Sessions", "Group Training", "Online Coaching", "Assessments"];

  const trendingItems = [
    {
      id: "t1",
      title: "Hyrox Recovery Bundle",
      subtitle: "Top seller this week",
      imageUrl: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?w=400",
    },
    {
      id: "t2",
      title: "Performance Protein Stack",
      subtitle: "+300 pts per sale",
      imageUrl: "https://images.unsplash.com/photo-1514996937319-344454492b37?w=400",
    },
  ];

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
            <Text className="text-sm text-muted">
              Welcome back, {effectiveUser?.name || user?.name || "Trainer"}!
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(trainer)/settings" as any)}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          >
            <IconSymbol name="gearshape.fill" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Status & Rewards */}
        <View className="px-4 mb-6">
          <TouchableOpacity
            onPress={() => router.push("/(trainer)/points" as any)}
            className="bg-surface border border-border rounded-xl p-4"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
                  <IconSymbol name="star.fill" size={20} color="#fff" />
                </View>
                <View className="ml-3">
                  <Text className="text-xs text-muted">Status</Text>
                  <Text className="text-lg font-bold text-foreground">{statusLabel}</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-xs text-muted">Points this month</Text>
                <Text className="text-lg font-bold text-foreground">
                  {displayPoints.totalPoints.toLocaleString()}
                </Text>
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-xs text-muted mb-2">Progress to next tier</Text>
              <View className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <View className="h-2 rounded-full bg-primary" style={{ width: "80%" }} />
              </View>
              <View className="flex-row items-center justify-between mt-3">
                <Text className="text-xs text-muted">Revenue share</Text>
                <Text className="text-xs font-semibold text-foreground">35%</Text>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-xs text-muted">Resets in</Text>
                <Text className="text-xs font-semibold text-foreground">12 days</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Revenue Performance Snapshot */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Performance</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/earnings" as any)}>
              <Text className="text-primary font-medium">View analytics</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-muted">Total sold</Text>
              <Text className="text-foreground font-semibold">
                ${displayStats.monthlyEarnings.toLocaleString()}
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-muted">Your earnings</Text>
              <Text className="text-foreground font-semibold">
                ${displayStats.totalEarnings.toLocaleString()}
              </Text>
            </View>
            {salesByCategory.map((item) => (
              <View key={item.label} className="mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm text-muted">{item.label}</Text>
                  <Text className="text-sm font-semibold text-foreground">{item.value}%</Text>
                </View>
                <View className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <View style={{ width: `${item.value}%` }} className="h-2 rounded-full bg-primary" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Sales Performance by Category */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Sales by category</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/earnings" as any)}>
              <Text className="text-primary font-medium">View analytics</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl p-4 border border-border">
            {salesByCategory.map((item) => (
              <View key={item.label} className="mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm text-muted">{item.label}</Text>
                  <Text className="text-sm font-semibold text-foreground">{item.value}%</Text>
                </View>
                <View className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <View style={{ width: `${item.value}%` }} className="h-2 rounded-full bg-primary" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Balance & Payouts */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Balance & payouts</Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-muted">Available</Text>
              <Text className="text-foreground font-semibold">${balanceSnapshot.available}</Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-muted">Pending</Text>
              <Text className="text-foreground font-semibold">${balanceSnapshot.pending}</Text>
            </View>
            <View className="flex-row items-center justify-between pt-2 border-t border-border">
              <Text className="text-muted">Last payout</Text>
              <Text className="text-foreground font-semibold">{balanceSnapshot.lastPayout}</Text>
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-muted">Next payout</Text>
              <Text className="text-foreground font-semibold">{balanceSnapshot.nextPayout}</Text>
            </View>
          </View>
        </View>

        {/* Clients */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Clients</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/clients" as any)}>
              <Text className="text-primary font-medium">View all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
            <View className="flex-row gap-3">
              {clientPreview.map((client) => (
                <View
                  key={client.id}
                  className="bg-surface border border-border rounded-xl px-4 py-3 min-w-[120px]"
                >
                  <View className="flex-row items-center gap-2">
                    <View className="w-8 h-8 rounded-full bg-muted/30 overflow-hidden items-center justify-center">
                      {client.photoUrl ? (
                        <Image
                          source={{ uri: client.photoUrl }}
                          className="w-8 h-8 rounded-full"
                          contentFit="cover"
                        />
                      ) : (
                        <IconSymbol name="person.fill" size={14} color={colors.muted} />
                      )}
                    </View>
                    <Text className="text-base font-semibold text-foreground">{client.name}</Text>
                  </View>
                  <Text className="text-xs text-muted mt-2">{client.tag}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
          <View className="flex-row mb-2">
            <QuickAction
              title="Charge Session"
              icon="creditcard.fill"
              onPress={() => router.push("/(trainer)/earnings" as any)}
            />
            <QuickAction
              title="Create Bundle"
              icon="cube.box.fill"
              onPress={() => router.push("/bundle-editor/new" as any)}
            />
            <QuickAction
              title="Create Subscription"
              icon="arrow.triangle.2.circlepath"
              onPress={() => router.push("/(trainer)/subscriptions" as any)}
            />
          </View>
          <View className="flex-row">
            <QuickAction
              title="Manage Sessions"
              icon="calendar"
              onPress={() => router.push("/(trainer)/calendar" as any)}
            />
            <QuickAction
              title="Invite Client"
              icon="person.badge.plus"
              onPress={() => router.push("/(trainer)/invite" as any)}
            />
            <QuickAction
              title="Messages"
              icon="message.fill"
              onPress={() => router.push(`${roleBase}/messages` as any)}
            />
          </View>
        </View>

        {/* Manage My Services */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Manage my services</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/settings" as any)}>
              <Text className="text-primary font-medium">Edit</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl p-4 border border-border">
            {servicesPreview.map((service, index) => (
              <View key={service} className={index === servicesPreview.length - 1 ? "" : "mb-2"}>
                <Text className="text-foreground">{service}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Trending Products, Bundles, Promotions */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Trending</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/products" as any)}>
              <Text className="text-primary font-medium">View catalog</Text>
            </TouchableOpacity>
          </View>
          <View className="gap-3">
            {trendingItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                className="bg-surface rounded-xl p-4 border border-border flex-row items-center"
                onPress={() => router.push("/(trainer)/products" as any)}
                activeOpacity={0.8}
              >
                <View className="w-12 h-12 rounded-xl bg-muted/30 overflow-hidden items-center justify-center mr-3">
                  {item.imageUrl ? (
                    <Image
                      source={{ uri: item.imageUrl }}
                      className="w-12 h-12"
                      contentFit="cover"
                    />
                  ) : (
                    <IconSymbol name="shippingbox.fill" size={18} color={colors.muted} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">{item.title}</Text>
                  <Text className="text-sm text-muted mt-1">{item.subtitle}</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View className="h-6" />
      </ScrollView>
    </ScreenContainer>
  );
}
