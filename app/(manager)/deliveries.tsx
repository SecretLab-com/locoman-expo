import { useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type DeliveryStatus = "pending" | "ready" | "delivered" | "confirmed" | "disputed";

type Delivery = {
  id: string;
  trainerName: string;
  clientName: string;
  productName: string;
  quantity: number;
  status: DeliveryStatus;
  method: string;
  scheduledDate: string | null;
};

const STATUS_TABS: { key: DeliveryStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "disputed", label: "Disputed" },
];

export default function ManagerDeliveriesScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<DeliveryStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const deliveriesQuery = trpc.admin.deliveries.useQuery({
    limit: 200,
    offset: 0,
    status: activeTab === "all" ? undefined : activeTab,
    search: searchQuery.trim() || undefined,
  });

  const deliveries: Delivery[] = ((deliveriesQuery.data as any)?.deliveries || []).map((delivery: any) => ({
    id: String(delivery.id),
    trainerName: delivery.trainerName || "Unknown Trainer",
    clientName: delivery.clientName || "Unknown Client",
    productName: delivery.productName || "Product",
    quantity: delivery.quantity || 0,
    status: (delivery.status || "pending") as DeliveryStatus,
    method: delivery.deliveryMethod || "in_person",
    scheduledDate: delivery.scheduledDate || null,
  }));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await deliveriesQuery.refetch();
    setRefreshing(false);
  }, [deliveriesQuery]);

  const formatMethod = (method: string) => {
    switch (method) {
      case "in_person":
        return "In Person";
      case "locker":
        return "Locker";
      case "front_desk":
        return "Front Desk";
      case "shipped":
        return "Shipped";
      default:
        return method;
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "Not scheduled";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not scheduled";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case "pending":
        return colors.warning;
      case "ready":
        return colors.primary;
      case "delivered":
        return colors.success;
      case "confirmed":
        return "#22C55E";
      case "disputed":
        return colors.error;
      default:
        return colors.muted;
    }
  };

  // Stats
  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === "pending").length,
    ready: deliveries.filter((d) => d.status === "ready").length,
    delivered: deliveries.filter((d) => d.status === "delivered").length,
    disputed: deliveries.filter((d) => d.status === "disputed").length,
  };

  const renderDelivery = ({ item }: { item: Delivery }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-foreground font-semibold">{item.productName}</Text>
          <Text className="text-muted text-sm">Qty: {item.quantity}</Text>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <Text
            className="text-xs font-medium capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View className="bg-background rounded-lg p-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-muted text-sm">Trainer:</Text>
          <Text className="text-foreground text-sm font-medium">{item.trainerName}</Text>
        </View>
        <View className="flex-row justify-between mb-1">
          <Text className="text-muted text-sm">Client:</Text>
          <Text className="text-foreground text-sm font-medium">{item.clientName}</Text>
        </View>
        <View className="flex-row justify-between mb-1">
          <Text className="text-muted text-sm">Method:</Text>
          <Text className="text-foreground text-sm">{formatMethod(item.method)}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-muted text-sm">Scheduled:</Text>
          <Text className="text-foreground text-sm">{formatDate(item.scheduledDate)}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="py-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-foreground">All Deliveries</Text>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 bg-surface rounded-lg p-3 items-center border border-border">
          <Text className="text-xl font-bold text-foreground">{stats.total}</Text>
          <Text className="text-xs text-muted">Total</Text>
        </View>
        <View className="flex-1 bg-warning/10 rounded-lg p-3 items-center">
          <Text className="text-xl font-bold text-warning">{stats.pending}</Text>
          <Text className="text-xs text-muted">Pending</Text>
        </View>
        <View className="flex-1 bg-primary/10 rounded-lg p-3 items-center">
          <Text className="text-xl font-bold text-primary">{stats.ready}</Text>
          <Text className="text-xs text-muted">Ready</Text>
        </View>
        <View className="flex-1 bg-error/10 rounded-lg p-3 items-center">
          <Text className="text-xl font-bold text-error">{stats.disputed}</Text>
          <Text className="text-xs text-muted">Disputed</Text>
        </View>
      </View>

      {/* Search */}
      <View className="mb-4">
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-2 text-foreground"
            placeholder="Search by trainer, client, or product..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== "" && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row mb-4">
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 py-2 items-center border-b-2 ${
              activeTab === tab.key ? "border-primary" : "border-transparent"
            }`}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${tab.label}`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab.key ? "text-primary" : "text-muted"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Deliveries List */}
      <FlatList
        data={deliveries}
        renderItem={renderDelivery}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || deliveriesQuery.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          deliveriesQuery.isLoading ? (
            <View className="items-center py-6">
              <Text className="text-muted">Loading deliveries...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-4">No deliveries found</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
