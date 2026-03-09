import { useState, useMemo } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type Transaction = {
  id: string | number;
  type: string;
  description: string;
  amount: number;
  date: string;
  status: string;
};

type EarningsSummary = {
  totalEarnings: number;
  thisMonth: number;
  lastMonth: number;
  pending: number;
  monthlyGrowth: number;
  monthlyData?: { month: string; earnings: number }[];
};

const DEFAULT_SUMMARY: EarningsSummary = {
  totalEarnings: 0,
  thisMonth: 0,
  lastMonth: 0,
  pending: 0,
  monthlyGrowth: 0,
};

function EarningsCard({ title, value, subtitle, icon, color }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: Parameters<typeof IconSymbol>[0]["name"];
  color: string;
}) {
  return (
    <View className="bg-surface rounded-xl p-4 flex-1">
      <View className="flex-row items-center justify-between mb-2">
        <IconSymbol name={icon} size={24} color={color} />
        {subtitle && (
          <View className="flex-row items-center">
            <IconSymbol
              name={subtitle.startsWith("+") ? "chevron.up" : "chevron.down"}
              size={12}
              color={subtitle.startsWith("+") ? "#22C55E" : "#EF4444"}
            />
            <Text
              className={`text-xs font-medium ml-0.5 ${
                subtitle.startsWith("+") ? "text-success" : "text-error"
              }`}
            >
              {subtitle}
            </Text>
          </View>
        )}
      </View>
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-sm text-muted mt-1">{title}</Text>
    </View>
  );
}

function SimpleBarChart({ data }: { data: { month: string; earnings: number }[] }) {
  const maxValue = Math.max(...data.map((d) => d.earnings));

  return (
    <View className="flex-row items-end justify-between h-32 px-2">
      {data.map((item, index) => {
        const height = (item.earnings / maxValue) * 100;
        const isLast = index === data.length - 1;

        return (
          <View key={item.month} className="items-center flex-1 mx-1">
            <View
              className={`w-full rounded-t-md ${isLast ? "bg-primary" : "bg-primary/30"}`}
              style={{ height: `${height}%` }}
            />
            <Text className="text-xs text-muted mt-2">{item.month}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const colors = useColors();
  const isNegative = transaction.amount < 0;

  return (
    <View className="flex-row items-center py-4 border-b border-border">
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${
          transaction.type === "payout" ? "bg-error/10" : "bg-success/10"
        }`}
      >
        <IconSymbol
          name={transaction.type === "payout" ? "arrow.right" : "arrow.left"}
          size={18}
          color={transaction.type === "payout" ? colors.error : colors.success}
        />
      </View>
      <View className="flex-1 ml-4">
        <Text className="text-base font-medium text-foreground">{transaction.description}</Text>
        <Text className="text-sm text-muted mt-0.5">{transaction.date}</Text>
      </View>
      <View className="items-end">
        <Text
          className={`text-base font-semibold ${isNegative ? "text-error" : "text-success"}`}
        >
          {isNegative ? "-" : "+"}${Math.abs(transaction.amount).toFixed(2)}
        </Text>
        <View
          className={`px-2 py-0.5 rounded-full mt-1 ${
            transaction.status === "completed" ? "bg-success/20" : "bg-warning/20"
          }`}
        >
          <Text
            className={`text-xs ${
              transaction.status === "completed" ? "text-success" : "text-warning"
            }`}
          >
            {transaction.status}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function TrainerEarningsScreen() {
  const colors = useColors();
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "year">("month");

  // Fetch earnings data from tRPC
  const { data: earningsData, isLoading: isLoadingEarnings, refetch: refetchEarnings, isRefetching: isRefetchingEarnings } = trpc.earnings.list.useQuery();
  const { data: summaryData, isLoading: isLoadingSummary, refetch: refetchSummary, isRefetching: isRefetchingSummary } = trpc.earnings.summary.useQuery();

  const isLoading = isLoadingEarnings || isLoadingSummary;
  const isRefetching = isRefetchingEarnings || isRefetchingSummary;

  const earnings: EarningsSummary = useMemo(() => {
    if (!summaryData) return DEFAULT_SUMMARY;
    return {
      totalEarnings: Number((summaryData as any).totalEarnings || 0),
      thisMonth: Number((summaryData as any).thisMonth || 0),
      lastMonth: Number((summaryData as any).lastMonth || 0),
      pending: Number((summaryData as any).pending || 0),
      monthlyGrowth: Number((summaryData as any).monthlyGrowth || 0),
      monthlyData: (summaryData as any).monthlyData,
    };
  }, [summaryData]);

  const transactions: Transaction[] = useMemo(() => {
    return (earningsData || []).map((e: any) => ({
      id: e.id,
      type: e.type || "sale",
      description: e.description || e.bundleTitle || "Earning",
      amount: Number(e.amount || 0),
      date: e.date || e.createdAt || "",
      status: e.status || "completed",
    }));
  }, [earningsData]);

  const monthlyData = earnings.monthlyData || [];

  const onRefresh = async () => {
    await Promise.all([refetchEarnings(), refetchSummary()]);
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      {/* Navigation Header */}
      <NavigationHeader
        title="Earnings"
        subtitle="Track your income and payouts"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
        <>
        {/* Stats Cards */}
        <View className="px-4 mb-6">
          <View className="flex-row gap-3 mb-3">
            <EarningsCard
              title="Total Earnings"
              value={`$${earnings.totalEarnings.toLocaleString()}`}
              icon="dollarsign.circle.fill"
              color={colors.success}
            />
            <EarningsCard
              title="This Month"
              value={`$${earnings.thisMonth.toLocaleString()}`}
              subtitle={earnings.monthlyGrowth ? `+${earnings.monthlyGrowth}%` : undefined}
              icon="chart.bar.fill"
              color={colors.primary}
            />
          </View>
          <View className="flex-row gap-3">
            <EarningsCard
              title="Last Month"
              value={`$${earnings.lastMonth.toLocaleString()}`}
              icon="calendar"
              color={colors.muted}
            />
            <EarningsCard
              title="Pending"
              value={`$${earnings.pending.toLocaleString()}`}
              icon="clock.fill"
              color={colors.warning}
            />
          </View>
        </View>

        {/* Chart Section */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-foreground">Earnings Overview</Text>
            <View className="flex-row bg-surface rounded-lg p-1">
              {(["week", "month", "year"] as const).map((period) => (
                <TouchableOpacity
                  key={period}
                  className={`px-3 py-1 rounded-md ${selectedPeriod === period ? "bg-primary" : ""}`}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text
                    className={`text-sm font-medium capitalize ${
                      selectedPeriod === period ? "text-background" : "text-muted"
                    }`}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {monthlyData.length > 0 ? (
          <View className="bg-surface rounded-xl p-4 border border-border">
            <SimpleBarChart data={monthlyData} />
          </View>
          ) : (
          <View className="bg-surface rounded-xl p-6 items-center border border-border">
            <Text className="text-muted">No chart data available yet</Text>
          </View>
          )}
        </View>

        {/* Transactions */}
        <View className="px-4 mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-foreground">Recent Transactions</Text>
            <TouchableOpacity>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>
          {transactions.length > 0 ? (
          <View className="bg-surface rounded-xl px-4 border border-border">
            {transactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}
          </View>
          ) : (
          <View className="bg-surface rounded-xl p-6 items-center border border-border">
            <IconSymbol name="dollarsign.circle.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No transactions yet</Text>
          </View>
          )}
        </View>

        {/* Request Payout Button */}
        <View className="px-4 mb-8">
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-background font-semibold text-lg">Request Payout</Text>
          </TouchableOpacity>
        </View>
        </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
