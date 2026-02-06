import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "created", label: "Pending" },
  { key: "authorised", label: "Authorised" },
  { key: "captured", label: "Captured" },
  { key: "refused", label: "Refused" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  created: { bg: "bg-muted/20", text: "text-muted" },
  pending: { bg: "bg-warning/20", text: "text-warning" },
  authorised: { bg: "bg-success/20", text: "text-success" },
  captured: { bg: "bg-success/20", text: "text-success" },
  refused: { bg: "bg-error/20", text: "text-error" },
  cancelled: { bg: "bg-muted/20", text: "text-muted" },
  error: { bg: "bg-error/20", text: "text-error" },
  refunded: { bg: "bg-primary/20", text: "text-primary" },
};

function formatAmount(amountMinor: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

function formatDate(date: Date | string) {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PaymentHistoryScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState("all");

  const {
    data: payments = [],
    isLoading,
    refetch,
    isRefetching,
  } = trpc.payments.history.useQuery({
    limit: 100,
    status: filter === "all" ? undefined : filter,
  });

  const { data: stats } = trpc.payments.stats.useQuery();

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="payment-history-back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Payment History</Text>
            <Text className="text-sm text-muted">
              {stats
                ? `${stats.captured} completed · ${stats.pending} pending`
                : "Loading..."}
            </Text>
          </View>
        </View>

        {/* Stats Summary */}
        {stats && (
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-surface border border-border rounded-xl p-3">
              <Text className="text-xs text-muted">Total Collected</Text>
              <Text className="text-lg font-bold text-success">
                {formatAmount(stats.totalAmount)}
              </Text>
            </View>
            <View className="flex-1 bg-surface border border-border rounded-xl p-3">
              <Text className="text-xs text-muted">Transactions</Text>
              <Text className="text-lg font-bold text-foreground">{stats.total}</Text>
            </View>
          </View>
        )}

        {/* Filter Tabs */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`px-3 py-1.5 rounded-full mr-2 border ${
                filter === item.key
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface"
              }`}
              onPress={() => setFilter(item.key)}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${item.label}`}
            >
              <Text
                className={`text-sm font-medium ${
                  filter === item.key ? "text-primary" : "text-muted"
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Payment List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.created;
            return (
              <View className="bg-surface border border-border rounded-xl p-4 mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                      {item.description || "Payment"}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                  <Text className="text-lg font-bold text-foreground">
                    {formatAmount(item.amountMinor, item.currency)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <View className={`px-2 py-0.5 rounded-full ${statusStyle.bg}`}>
                    <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>
                      {item.status}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    {item.method && (
                      <Text className="text-xs text-muted capitalize">{item.method}</Text>
                    )}
                    {item.pspReference && (
                      <Text className="text-xs text-muted ml-2">
                        {item.pspReference.slice(0, 12)}...
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <IconSymbol name="clock.fill" size={48} color={colors.muted} />
              <Text className="text-lg font-semibold text-foreground mt-4">
                No payments found
              </Text>
              <Text className="text-muted text-center mt-2">
                {filter === "all"
                  ? "Request your first payment to get started"
                  : `No ${filter} payments`}
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
