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

type DeliveryStatus = "pending" | "ready" | "delivered" | "confirmed" | "disputed";

type Delivery = {
  id: number;
  trainerName: string;
  clientName: string;
  productName: string;
  quantity: number;
  status: DeliveryStatus;
  method: string;
  scheduledDate: string;
};

const STATUS_TABS: { key: DeliveryStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "disputed", label: "Disputed" },
];

// Mock data
const MOCK_DELIVERIES: Delivery[] = [
  {
    id: 1,
    trainerName: "Sarah Johnson",
    clientName: "John Doe",
    productName: "Protein Powder",
    quantity: 2,
    status: "pending",
    method: "In Person",
    scheduledDate: "2026-01-26",
  },
  {
    id: 2,
    trainerName: "Mike Chen",
    clientName: "Jane Smith",
    productName: "Pre-Workout",
    quantity: 1,
    status: "ready",
    method: "Locker",
    scheduledDate: "2026-01-25",
  },
  {
    id: 3,
    trainerName: "Emily Davis",
    clientName: "Alex Rivera",
    productName: "BCAA",
    quantity: 3,
    status: "delivered",
    method: "Shipped",
    scheduledDate: "2026-01-24",
  },
  {
    id: 4,
    trainerName: "Sarah Johnson",
    clientName: "Chris Lee",
    productName: "Creatine",
    quantity: 1,
    status: "disputed",
    method: "Front Desk",
    scheduledDate: "2026-01-23",
  },
];

export default function ManagerDeliveriesScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<DeliveryStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveries] = useState<Delivery[]>(MOCK_DELIVERIES);

  const filteredDeliveries = deliveries.filter((d) => {
    const matchesTab = activeTab === "all" || d.status === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      d.trainerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.productName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
          <Text className="text-foreground text-sm">{item.method}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-muted text-sm">Scheduled:</Text>
          <Text className="text-foreground text-sm">{item.scheduledDate}</Text>
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
            <TouchableOpacity onPress={() => setSearchQuery("")}>
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
        data={filteredDeliveries}
        renderItem={renderDelivery}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
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
