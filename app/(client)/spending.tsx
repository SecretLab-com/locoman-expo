import { useMemo, useState } from "react";
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

type SpendingCategory = "subscriptions" | "products" | "sessions" | "other";

type SpendingItem = {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: SpendingCategory;
  trainerName?: string;
};

type MonthlySpending = {
  month: string;
  total: number;
  subscriptions: number;
  products: number;
  sessions: number;
  other: number;
};

const CATEGORY_COLORS: Record<SpendingCategory, string> = {
  subscriptions: "#10B981",
  products: "#3B82F6",
  sessions: "#F59E0B",
  other: "#6B7280",
};

const CATEGORY_ICONS: Record<SpendingCategory, Parameters<typeof IconSymbol>[0]["name"]> = {
  subscriptions: "bag.fill",
  products: "cart.fill",
  sessions: "clock.fill",
  other: "ellipsis.circle.fill",
};

export default function SpendingScreen() {
  const colors = useColors();
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "year">("month");

  // Fetch real order data
  const { data: orders, isLoading, refetch, isRefetching } = trpc.orders.myOrders.useQuery();

  // Derive spending items from orders
  const spendingItems = useMemo((): SpendingItem[] => {
    if (!orders || orders.length === 0) return [];
    return orders.map((order: any) => {
      const desc = String(order.description || order.status || "").toLowerCase();
      const method = String(order.fulfillmentMethod || "").toLowerCase();
      let category: SpendingCategory = "products";
      if (desc.includes("session") || desc.includes("training") || method === "session") {
        category = "sessions";
      } else if (desc.includes("subscription") || desc.includes("recurring") || desc.includes("monthly") || desc.includes("weekly")) {
        category = "subscriptions";
      }
      return {
        id: order.id,
        description: order.description || order.status || "Order",
        amount: parseFloat(order.totalAmount || order.amount || "0"),
        date: new Date(order.createdAt),
        category,
        trainerName: order.trainerName,
      };
    });
  }, [orders]);

  // Build monthly spending from orders
  const monthlyData = useMemo((): MonthlySpending[] => {
    if (!orders || orders.length === 0) return [];
    const monthMap = new Map<string, MonthlySpending>();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    for (const order of orders as any[]) {
      const date = new Date(order.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const monthLabel = monthNames[date.getMonth()];
      const amount = parseFloat(order.totalAmount || order.amount || "0");

      if (!monthMap.has(key)) {
        monthMap.set(key, { month: monthLabel, total: 0, subscriptions: 0, products: 0, sessions: 0, other: 0 });
      }
      const entry = monthMap.get(key)!;
      const desc = String((order as any).description || (order as any).status || "").toLowerCase();
      const method = String((order as any).fulfillmentMethod || "").toLowerCase();
      entry.total += amount;
      if (desc.includes("session") || desc.includes("training") || method === "session") {
        entry.sessions += amount;
      } else if (desc.includes("subscription") || desc.includes("recurring")) {
        entry.subscriptions += amount;
      } else {
        entry.products += amount;
      }
    }

    return Array.from(monthMap.values())
      .sort((a, b) => {
        // Sort most recent first
        const aIdx = monthNames.indexOf(a.month);
        const bIdx = monthNames.indexOf(b.month);
        return bIdx - aIdx;
      })
      .slice(0, 6);
  }, [orders]);

  // Calculate totals for current month
  const totals = useMemo(() => {
    if (monthlyData.length === 0) {
      return { total: 0, subscriptions: 0, products: 0, sessions: 0, other: 0 };
    }
    const currentMonth = monthlyData[0];
    return {
      total: currentMonth.total,
      subscriptions: currentMonth.subscriptions,
      products: currentMonth.products,
      sessions: currentMonth.sessions,
      other: currentMonth.other,
    };
  }, [monthlyData]);

  // Get max value for chart
  const maxMonthlyTotal = useMemo(() => {
    if (monthlyData.length === 0) return 1;
    return Math.max(...monthlyData.map((m) => m.total), 1);
  }, [monthlyData]);

  // Format date
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

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
            <Text className="text-2xl font-bold text-foreground">Revenue</Text>
            <Text className="text-sm text-muted mt-1">Track your fitness income</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading spending data...</Text>
        </View>
      ) : (
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
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

        {/* Total Spending Card */}
        <View className="bg-surface rounded-xl p-6 mb-6">
          <Text className="text-sm text-muted">This {selectedPeriod}</Text>
          <Text className="text-4xl font-bold text-foreground mt-1">
            ${totals.total.toFixed(2)}
          </Text>

          {/* Category Breakdown */}
          <View className="flex-row mt-4 gap-2">
            {(["subscriptions", "products", "sessions"] as SpendingCategory[]).map((category) => {
              const amount = totals[category];
              if (amount === 0) return null;
              const percentage = (amount / totals.total) * 100;

              return (
                <View
                  key={category}
                  className="flex-1 rounded-lg p-3"
                  style={{ backgroundColor: `${CATEGORY_COLORS[category]}15` }}
                >
                  <View className="flex-row items-center mb-1">
                    <View
                      className="w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: CATEGORY_COLORS[category] }}
                    />
                    <Text className="text-xs text-muted capitalize">{category}</Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground">
                    ${amount.toFixed(0)}
                  </Text>
                  <Text className="text-xs text-muted">{percentage.toFixed(0)}%</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Monthly Chart */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Monthly Trend</Text>
          <View className="bg-surface rounded-xl p-4">
            <View className="flex-row items-end justify-between h-32">
              {monthlyData.slice(0, 6).reverse().map((month, index) => {
                const height = (month.total / maxMonthlyTotal) * 100;
                return (
                  <View key={month.month} className="items-center flex-1">
                    <View
                      className="w-8 rounded-t-lg"
                      style={{
                        height: `${height}%`,
                        backgroundColor: index === 5 ? colors.primary : `${colors.primary}40`,
                      }}
                    />
                    <Text className="text-xs text-muted mt-2">{month.month}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Category Breakdown */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">By Category</Text>
          <View className="bg-surface rounded-xl divide-y divide-border">
            {(["subscriptions", "products", "sessions", "other"] as SpendingCategory[]).map((category) => {
              const amount = totals[category];
              const percentage = totals.total > 0 ? (amount / totals.total) * 100 : 0;

              return (
                <View key={category} className="flex-row items-center p-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${CATEGORY_COLORS[category]}20` }}
                  >
                    <IconSymbol
                      name={CATEGORY_ICONS[category]}
                      size={20}
                      color={CATEGORY_COLORS[category]}
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium capitalize">{category}</Text>
                    <View className="flex-row items-center mt-1">
                      <View className="flex-1 h-2 bg-background rounded-full overflow-hidden mr-3">
                        <View
                          className="h-full rounded-full"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: CATEGORY_COLORS[category],
                          }}
                        />
                      </View>
                      <Text className="text-xs text-muted w-10">{percentage.toFixed(0)}%</Text>
                    </View>
                  </View>
                  <Text className="text-foreground font-semibold">${amount.toFixed(2)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Transactions */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Recent Transactions</Text>
          <View className="bg-surface rounded-xl divide-y divide-border">
            {spendingItems.map((item) => (
              <View key={item.id} className="flex-row items-center p-4">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${CATEGORY_COLORS[item.category]}20` }}
                >
                  <IconSymbol
                    name={CATEGORY_ICONS[item.category]}
                    size={20}
                    color={CATEGORY_COLORS[item.category]}
                  />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-foreground font-medium">{item.description}</Text>
                  <Text className="text-sm text-muted">
                    {item.trainerName ? `${item.trainerName} • ` : ""}{formatDate(item.date)}
                  </Text>
                </View>
                <Text className="text-foreground font-semibold">-${item.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Insights */}
        <View className="mb-6 bg-primary/10 rounded-xl p-4">
          <View className="flex-row items-center mb-2">
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <Text className="text-primary font-semibold ml-2">Insight</Text>
          </View>
          <Text className="text-foreground text-sm leading-5">
            Your spending increased by 28% compared to last month. Most of the increase came from product purchases.
          </Text>
        </View>

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
      )}
    </ScreenContainer>
  );
}
