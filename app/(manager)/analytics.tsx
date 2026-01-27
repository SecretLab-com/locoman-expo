import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

// Mock data
const MOCK_REVENUE = {
  total: 145890,
  thisMonth: 45890,
  lastMonth: 38750,
  growth: 18.4,
};

const MOCK_MONTHLY_DATA = [
  { month: "Aug", revenue: 28500, orders: 245 },
  { month: "Sep", revenue: 32100, orders: 278 },
  { month: "Oct", revenue: 35400, orders: 312 },
  { month: "Nov", revenue: 38750, orders: 345 },
  { month: "Dec", revenue: 42300, orders: 389 },
  { month: "Jan", revenue: 45890, orders: 421 },
];

const MOCK_TOP_TRAINERS = [
  { id: 1, name: "Coach Mike", revenue: 12450, clients: 24 },
  { id: 2, name: "Coach Sarah", revenue: 8900, clients: 18 },
  { id: 3, name: "Coach Emma", revenue: 7200, clients: 15 },
  { id: 4, name: "Coach Alex", revenue: 5600, clients: 12 },
  { id: 5, name: "Coach John", revenue: 4800, clients: 10 },
];

const MOCK_TOP_BUNDLES = [
  { id: 1, title: "Weight Loss Program", sales: 156, revenue: 23244 },
  { id: 2, title: "Strength Training", sales: 98, revenue: 19502 },
  { id: 3, title: "HIIT Cardio Blast", sales: 87, revenue: 6873 },
  { id: 4, title: "Yoga for Beginners", sales: 76, revenue: 4484 },
  { id: 5, title: "Nutrition Coaching", sales: 65, revenue: 5135 },
];

export default function AnalyticsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "year">("month");

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // Get max revenue for chart
  const maxRevenue = Math.max(...MOCK_MONTHLY_DATA.map((d) => d.revenue));

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
            ${MOCK_REVENUE.total.toLocaleString()}
          </Text>

          <View className="flex-row mt-4 gap-4">
            <View className="flex-1 bg-background rounded-lg p-3">
              <Text className="text-xs text-muted">This Month</Text>
              <Text className="text-lg font-bold text-foreground">
                ${MOCK_REVENUE.thisMonth.toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-background rounded-lg p-3">
              <Text className="text-xs text-muted">Last Month</Text>
              <Text className="text-lg font-bold text-foreground">
                ${MOCK_REVENUE.lastMonth.toLocaleString()}
              </Text>
            </View>
            <View className="flex-1 bg-success/10 rounded-lg p-3">
              <Text className="text-xs text-muted">Growth</Text>
              <View className="flex-row items-center">
                <IconSymbol name="arrow.up" size={14} color={colors.success} />
                <Text className="text-lg font-bold text-success ml-1">
                  {MOCK_REVENUE.growth}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Revenue Chart */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Revenue Trend</Text>
          <View className="bg-surface rounded-xl p-4">
            <View className="flex-row items-end justify-between h-40">
              {MOCK_MONTHLY_DATA.map((data, index) => {
                const height = (data.revenue / maxRevenue) * 100;
                const isCurrentMonth = index === MOCK_MONTHLY_DATA.length - 1;
                return (
                  <View key={data.month} className="items-center flex-1">
                    <Text className="text-xs text-muted mb-1">
                      ${(data.revenue / 1000).toFixed(0)}k
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
          </View>
        </View>

        {/* Key Metrics */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Key Metrics</Text>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-xl p-4">
              <IconSymbol name="bag.fill" size={24} color={colors.primary} />
              <Text className="text-2xl font-bold text-foreground mt-2">
                {MOCK_MONTHLY_DATA[MOCK_MONTHLY_DATA.length - 1].orders}
              </Text>
              <Text className="text-sm text-muted">Orders This Month</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-4">
              <IconSymbol name="person.2.fill" size={24} color={colors.success} />
              <Text className="text-2xl font-bold text-foreground mt-2">1,245</Text>
              <Text className="text-sm text-muted">Active Users</Text>
            </View>
          </View>
        </View>

        {/* Top Trainers */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Top Trainers</Text>
          <View className="bg-surface rounded-xl divide-y divide-border">
            {MOCK_TOP_TRAINERS.map((trainer, index) => (
              <View key={trainer.id} className="flex-row items-center p-4">
                <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-sm font-bold text-primary">{index + 1}</Text>
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-foreground font-medium">{trainer.name}</Text>
                  <Text className="text-sm text-muted">{trainer.clients} clients</Text>
                </View>
                <Text className="text-foreground font-semibold">
                  ${trainer.revenue.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top Bundles */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Top Bundles</Text>
          <View className="bg-surface rounded-xl divide-y divide-border">
            {MOCK_TOP_BUNDLES.map((bundle, index) => (
              <View key={bundle.id} className="flex-row items-center p-4">
                <View className="w-8 h-8 rounded-full bg-success/20 items-center justify-center">
                  <Text className="text-sm font-bold text-success">{index + 1}</Text>
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-foreground font-medium">{bundle.title}</Text>
                  <Text className="text-sm text-muted">{bundle.sales} sales</Text>
                </View>
                <Text className="text-foreground font-semibold">
                  ${bundle.revenue.toLocaleString()}
                </Text>
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
