import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// Mock data
const MOCK_STATS = {
  totalUsers: 1245,
  activeTrainers: 48,
  totalOrders: 3567,
  monthlyRevenue: 45890,
  pendingOrders: 23,
  lowInventoryItems: 5,
};

const MOCK_LOW_INVENTORY = [
  { id: 1, productName: "Protein Powder - Vanilla", currentStock: 3, trainerId: 1, trainerName: "Coach Mike" },
  { id: 2, productName: "Resistance Bands Set", currentStock: 2, trainerId: 2, trainerName: "Coach Sarah" },
  { id: 3, productName: "Pre-Workout Mix", currentStock: 1, trainerId: 1, trainerName: "Coach Mike" },
];

const MOCK_RECENT_ACTIVITY = [
  { id: 1, type: "new_user", description: "John Doe signed up", time: "5 min ago" },
  { id: 2, type: "order", description: "New order #3567 placed", time: "12 min ago" },
  { id: 3, type: "trainer", description: "Coach Sarah updated bundle", time: "1 hour ago" },
  { id: 4, type: "delivery", description: "Delivery #2345 completed", time: "2 hours ago" },
];

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

  // Gradient colors based on the icon color
  const getGradientColors = (): readonly [string, string] => {
    if (color === colors.success) {
      return ["#065F46", "#047857"] as const; // Green gradient
    }
    return ["#1E293B", "#0F172A"] as const; // Default dark slate gradient
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

export default function ManagerHome() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [lowInventory, setLowInventory] = useState(MOCK_LOW_INVENTORY);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // Dismiss low inventory alert
  const handleDismissAlert = (itemId: number) => {
    setLowInventory((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Alert trainer about low inventory
  const handleAlertTrainer = (item: typeof MOCK_LOW_INVENTORY[0]) => {
    Alert.alert(
      "Alert Trainer",
      `Send low inventory alert to ${item.trainerName} about "${item.productName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Alert",
          onPress: () => {
            Alert.alert("Alert Sent", `${item.trainerName} has been notified.`);
            handleDismissAlert(item.id);
          },
        },
      ]
    );
  };

  // Get activity icon
  const getActivityIcon = (type: string): Parameters<typeof IconSymbol>[0]["name"] => {
    switch (type) {
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
              value={MOCK_STATS.totalUsers.toLocaleString()}
              icon="person.2.fill"
              onPress={() => router.push("/(manager)/users" as any)}
            />
            <StatCard
              title="Active Trainers"
              value={MOCK_STATS.activeTrainers}
              icon="figure.run"
              color={colors.success}
              onPress={() => router.push("/(manager)/trainers" as any)}
            />
          </View>
          <View className="flex-row gap-3 mb-3">
            <StatCard
              title="Total Orders"
              value={MOCK_STATS.totalOrders.toLocaleString()}
              icon="bag.fill"
            />
            <StatCard
              title="Monthly Revenue"
              value={`$${MOCK_STATS.monthlyRevenue.toLocaleString()}`}
              icon="dollarsign.circle.fill"
              color={colors.success}
              onPress={() => router.push("/(manager)/analytics" as any)}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
          <View className="flex-row gap-3 mb-3">
            <TouchableOpacity
              onPress={() => router.push("/(manager)/templates" as any)}
              className="flex-1 rounded-xl overflow-hidden"
            >
              <LinearGradient
                colors={["#1E3A5F", "#0F2744"] as const}
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
            <TouchableOpacity
              onPress={() => router.push("/(manager)/invitations" as any)}
              className="flex-1 rounded-xl overflow-hidden"
            >
              <LinearGradient
                colors={["#1E3A5F", "#0F2744"] as const}
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
              className="flex-1 rounded-xl overflow-hidden"
            >
              <LinearGradient
                colors={["#1E3A5F", "#0F2744"] as const}
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
              className="flex-1 rounded-xl overflow-hidden"
            >
              <LinearGradient
                colors={["#1E3A5F", "#0F2744"] as const}
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
              className="flex-1 rounded-xl overflow-hidden"
            >
              <LinearGradient
                colors={["#1E3A5F", "#0F2744"] as const}
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
              className="flex-1 rounded-xl overflow-hidden"
            >
              <LinearGradient
                colors={["#4A3728", "#2D2118"] as const}
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

            {lowInventory.map((item) => (
              <View
                key={item.id}
                className="bg-warning/10 rounded-xl p-4 mb-2 border border-warning/30"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">{item.productName}</Text>
                    <Text className="text-sm text-muted mt-1">
                      {item.trainerName} • Only {item.currentStock} left
                    </Text>
                  </View>
                </View>
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => handleDismissAlert(item.id)}
                    className="flex-1 bg-surface py-2 rounded-lg items-center"
                  >
                    <Text className="text-muted font-medium">Dismiss</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleAlertTrainer(item)}
                    className="flex-1 bg-gradient-to-r from-warning to-warning/80 py-2.5 rounded-full items-center shadow-sm"
                  >
                    <Text className="text-white font-medium">Alert Trainer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pending Orders */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Pending Orders</Text>
            <View className="bg-primary/20 px-3 py-1 rounded-full">
              <Text className="text-primary text-sm font-semibold">{MOCK_STATS.pendingOrders}</Text>
            </View>
          </View>
          <TouchableOpacity
            className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                <IconSymbol name="bag.fill" size={20} color={colors.primary} />
              </View>
              <View className="ml-3">
                <Text className="text-foreground font-semibold">
                  {MOCK_STATS.pendingOrders} orders awaiting processing
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
            {MOCK_RECENT_ACTIVITY.map((activity) => (
              <View key={activity.id} className="flex-row items-center p-4">
                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                  <IconSymbol name={getActivityIcon(activity.type)} size={20} color={colors.primary} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-foreground">{activity.description}</Text>
                  <Text className="text-sm text-muted">{activity.time}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
