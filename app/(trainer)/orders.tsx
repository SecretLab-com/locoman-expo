import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { trpc } from "@/lib/trpc";

type OrderStatus = "pending" | "processing" | "ready" | "delivered" | "cancelled";

type Order = {
  id: string;
  clientId?: string;
  clientName?: string;
  clientPhoto?: string;
  bundleId?: string;
  bundleTitle?: string;
  status: string;
  total?: string;
  totalAmount?: string;
  items?: {
    name: string;
    quantity: number;
    price: string;
  }[];
  fulfillment?: string;
  fulfillmentMethod?: string;
  createdAt: string;
  notes?: string;
};

const STATUS_TABS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "delivered", label: "Delivered" },
];

export default function OrdersScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const overlayColor = colorScheme === "dark"
    ? "rgba(0, 0, 0, 0.5)"
    : "rgba(15, 23, 42, 0.18)";
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch orders from tRPC
  const { data: ordersData, isLoading, refetch, isRefetching } = trpc.orders.list.useQuery();
  const orders: Order[] = (ordersData || []).map((o: any) => ({
    ...o,
    id: String(o.id),
    total: o.total || o.totalAmount || "0.00",
    fulfillment: o.fulfillment || o.fulfillmentMethod || "trainer_delivery",
    items: o.items || [],
    createdAt: o.createdAt || new Date().toISOString(),
  }));

  // Filter orders by status
  const filteredOrders = useMemo(() => {
    if (activeTab === "all") return orders;
    return orders.filter((o) => o.status === activeTab);
  }, [orders, activeTab]);

  // Pull to refresh
  const onRefresh = async () => {
    await refetch();
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#F59E0B";
      case "processing":
        return colors.primary;
      case "ready":
        return "#22C55E";
      case "delivered":
        return colors.muted;
      case "cancelled":
        return "#EF4444";
      default:
        return colors.muted;
    }
  };

  // Get fulfillment label
  const getFulfillmentLabel = (fulfillment: string) => {
    switch (fulfillment) {
      case "trainer_delivery":
        return "Trainer Delivery";
      case "home_ship":
        return "Home Shipping";
      case "vending":
        return "Vending Machine";
      case "cafeteria":
        return "Cafeteria Pickup";
      default:
        return fulfillment;
    }
  };

  // Format date
  const formatDate = (dateInput: string | Date) => {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Handle order actions
  // TODO: Replace with trpc.orders.updateStatus.useMutation() when endpoint is created
  const handleProcessOrder = (order: Order) => {
    Alert.alert(
      "Process Order",
      `Start processing order #${order.id}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Process",
          onPress: () => {
            // TODO: Replace with real API when orders.updateStatus endpoint is created
            setShowDetailModal(false);
            refetch();
          },
        },
      ]
    );
  };

  // TODO: Replace with trpc.orders.updateStatus.useMutation() when endpoint is created
  const handleMarkReady = (order: Order) => {
    Alert.alert(
      "Mark Ready",
      `Mark order #${order.id} as ready for delivery?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Ready",
          onPress: () => {
            // TODO: Replace with real API when orders.updateStatus endpoint is created
            setShowDetailModal(false);
            refetch();
          },
        },
      ]
    );
  };

  // TODO: Replace with trpc.orders.updateStatus.useMutation() when endpoint is created
  const handleMarkDelivered = (order: Order) => {
    Alert.alert(
      "Mark Delivered",
      `Mark order #${order.id} as delivered?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delivered",
          onPress: () => {
            // TODO: Replace with real API when orders.updateStatus endpoint is created
            setShowDetailModal(false);
            refetch();
          },
        },
      ]
    );
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
            <Text className="text-2xl font-bold text-foreground">Orders</Text>
            <Text className="text-sm text-muted mt-1">Manage client orders</Text>
          </View>
        </View>
      </View>

      {/* Status Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 mb-4"
        contentContainerStyle={{ gap: 8 }}
      >
        {STATUS_TABS.map((tab) => {
          const count = tab.value === "all"
            ? orders.length
            : orders.filter((o) => o.status === tab.value).length;

          return (
            <TouchableOpacity
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-full flex-row items-center ${
                activeTab === tab.value
                  ? "bg-primary"
                  : "bg-surface border border-border"
              }`}
            >
              <Text
                className={`text-sm ${
                  activeTab === tab.value
                    ? "text-white font-semibold"
                    : "text-foreground"
                }`}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  className={`ml-2 px-2 py-0.5 rounded-full ${
                    activeTab === tab.value ? "bg-white/20" : "bg-muted/20"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      activeTab === tab.value ? "text-white" : "text-muted"
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Orders List */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {isLoading ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="bag.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No orders found</Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              onPress={() => {
                setSelectedOrder(order);
                setShowDetailModal(true);
              }}
              className="bg-surface rounded-xl p-4 mb-3 border border-border"
            >
              <View className="flex-row items-start">
                {/* Client Avatar */}
                <View className="w-12 h-12 rounded-full bg-background items-center justify-center overflow-hidden">
                  {order.clientPhoto ? (
                    <Image
                      source={{ uri: order.clientPhoto }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <IconSymbol name="person.fill" size={24} color={colors.muted} />
                  )}
                </View>

                {/* Order Info */}
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold text-foreground">
                      {order.clientName}
                    </Text>
                    <Text className="text-lg font-bold text-foreground">
                      ${order.total}
                    </Text>
                  </View>

                  <Text className="text-sm text-muted">{order.bundleTitle}</Text>

                  <View className="flex-row items-center mt-2 gap-2">
                    {/* Status Badge */}
                    <View
                      className="px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${getStatusColor(order.status)}20` }}
                    >
                      <Text
                        className="text-xs font-medium capitalize"
                        style={{ color: getStatusColor(order.status) }}
                      >
                        {order.status}
                      </Text>
                    </View>

                    {/* Fulfillment */}
                    <Text className="text-xs text-muted">
                      {getFulfillmentLabel(order.fulfillment || "")}
                    </Text>
                  </View>

                  {/* Items Preview */}
                  {(order.items || []).length > 0 && (
                  <Text className="text-xs text-muted mt-2">
                    {(order.items || []).map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </Text>
                  )}

                  {/* Time */}
                  <Text className="text-xs text-muted mt-1">
                    {formatDate(order.createdAt)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>

      {/* Order Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          onPress={() => setShowDetailModal(false)}
          style={{ backgroundColor: overlayColor }}
        >
          <View className="bg-background rounded-t-3xl max-h-[85%]">
            {selectedOrder && (
              <ScrollView>
                <View className="p-6">
                  {/* Header */}
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-xl font-bold text-foreground">
                      Order #{selectedOrder.id}
                    </Text>
                    <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                      <IconSymbol name="xmark" size={24} color={colors.muted} />
                    </TouchableOpacity>
                  </View>

                  {/* Status */}
                  <View
                    className="self-start px-3 py-1 rounded-full mb-4"
                    style={{ backgroundColor: `${getStatusColor(selectedOrder.status)}20` }}
                  >
                    <Text
                      className="text-sm font-semibold capitalize"
                      style={{ color: getStatusColor(selectedOrder.status) }}
                    >
                      {selectedOrder.status}
                    </Text>
                  </View>

                  {/* Client Info */}
                  <View className="bg-surface rounded-xl p-4 mb-4">
                    <Text className="text-sm font-semibold text-foreground mb-2">Client</Text>
                    <View className="flex-row items-center">
                      <View className="w-10 h-10 rounded-full bg-background items-center justify-center">
                        <IconSymbol name="person.fill" size={20} color={colors.muted} />
                      </View>
                      <View className="ml-3">
                        <Text className="text-base font-semibold text-foreground">
                          {selectedOrder.clientName}
                        </Text>
                        <Text className="text-sm text-muted">{selectedOrder.bundleTitle}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Items */}
                  <View className="bg-surface rounded-xl p-4 mb-4">
                    <Text className="text-sm font-semibold text-foreground mb-3">Items</Text>
                    {(selectedOrder.items || []).map((item, index) => (
                      <View
                        key={index}
                        className="flex-row items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <View className="flex-row items-center">
                          <Text className="text-foreground">{item.quantity}x</Text>
                          <Text className="text-foreground ml-2">{item.name}</Text>
                        </View>
                        <Text className="text-foreground font-semibold">${item.price}</Text>
                      </View>
                    ))}
                    <View className="flex-row items-center justify-between pt-3 mt-2 border-t border-border">
                      <Text className="text-base font-semibold text-foreground">Total</Text>
                      <Text className="text-lg font-bold text-primary">${selectedOrder.total}</Text>
                    </View>
                  </View>

                  {/* Fulfillment */}
                  <View className="bg-surface rounded-xl p-4 mb-4">
                    <Text className="text-sm font-semibold text-foreground mb-2">Fulfillment</Text>
                    <View className="flex-row items-center">
                      <IconSymbol name="shippingbox.fill" size={20} color={colors.primary} />
                      <Text className="text-foreground ml-2">
                        {getFulfillmentLabel(selectedOrder.fulfillment || "")}
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  {selectedOrder.status === "pending" && (
                    <TouchableOpacity
                      onPress={() => handleProcessOrder(selectedOrder)}
                      className="bg-primary py-4 rounded-xl items-center mb-3"
                    >
                      <Text className="text-white font-semibold">Start Processing</Text>
                    </TouchableOpacity>
                  )}

                  {selectedOrder.status === "processing" && (
                    <TouchableOpacity
                      onPress={() => handleMarkReady(selectedOrder)}
                      className="bg-success py-4 rounded-xl items-center mb-3"
                    >
                      <Text className="text-white font-semibold">Mark as Ready</Text>
                    </TouchableOpacity>
                  )}

                  {selectedOrder.status === "ready" && (
                    <TouchableOpacity
                      onPress={() => handleMarkDelivered(selectedOrder)}
                      className="bg-success py-4 rounded-xl items-center mb-3"
                    >
                      <Text className="text-white font-semibold">Mark as Delivered</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                    className="py-3"
                  >
                    <Text className="text-center text-muted">Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
