import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Mock earnings data
const MOCK_EARNINGS = {
  totalEarnings: 12450.0,
  thisMonth: 2340.0,
  lastMonth: 1890.0,
  pending: 450.0,
  monthlyGrowth: 23.8,
};

const MOCK_TRANSACTIONS = [
  { id: 1, type: "sale", description: "Full Body Transformation", amount: 149.99, date: "2024-03-20", status: "completed" },
  { id: 2, type: "sale", description: "HIIT Cardio Blast", amount: 79.99, date: "2024-03-19", status: "completed" },
  { id: 3, type: "payout", description: "Weekly Payout", amount: -850.0, date: "2024-03-18", status: "completed" },
  { id: 4, type: "sale", description: "Yoga for Beginners", amount: 59.99, date: "2024-03-17", status: "pending" },
  { id: 5, type: "sale", description: "Full Body Transformation", amount: 149.99, date: "2024-03-16", status: "completed" },
  { id: 6, type: "sale", description: "Strength Training 101", amount: 99.99, date: "2024-03-15", status: "completed" },
];

const MOCK_MONTHLY_DATA = [
  { month: "Oct", earnings: 1200 },
  { month: "Nov", earnings: 1450 },
  { month: "Dec", earnings: 1680 },
  { month: "Jan", earnings: 1890 },
  { month: "Feb", earnings: 2100 },
  { month: "Mar", earnings: 2340 },
];

type Transaction = (typeof MOCK_TRANSACTIONS)[0];

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

function SimpleBarChart({ data }: { data: typeof MOCK_MONTHLY_DATA }) {
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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "year">("month");

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
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
          <Text className="text-2xl font-bold text-foreground">Earnings</Text>
          <Text className="text-sm text-muted">Track your income and payouts</Text>
        </View>

        {/* Stats Cards */}
        <View className="px-4 mb-6">
          <View className="flex-row gap-3 mb-3">
            <EarningsCard
              title="Total Earnings"
              value={`$${MOCK_EARNINGS.totalEarnings.toLocaleString()}`}
              icon="dollarsign.circle.fill"
              color={colors.success}
            />
            <EarningsCard
              title="This Month"
              value={`$${MOCK_EARNINGS.thisMonth.toLocaleString()}`}
              subtitle={`+${MOCK_EARNINGS.monthlyGrowth}%`}
              icon="chart.bar.fill"
              color={colors.primary}
            />
          </View>
          <View className="flex-row gap-3">
            <EarningsCard
              title="Last Month"
              value={`$${MOCK_EARNINGS.lastMonth.toLocaleString()}`}
              icon="calendar"
              color={colors.muted}
            />
            <EarningsCard
              title="Pending"
              value={`$${MOCK_EARNINGS.pending.toLocaleString()}`}
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
          <View className="bg-surface rounded-xl p-4 border border-border">
            <SimpleBarChart data={MOCK_MONTHLY_DATA} />
          </View>
        </View>

        {/* Transactions */}
        <View className="px-4 mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-foreground">Recent Transactions</Text>
            <TouchableOpacity>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl px-4 border border-border">
            {MOCK_TRANSACTIONS.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
            ))}
          </View>
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
      </ScrollView>
    </ScreenContainer>
  );
}
