import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Platform,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type OrderStatus = "active" | "completed";

type Order = {
  id: string;
  title: string;
  imageUrl?: string | null;
  price: number;
  status: OrderStatus;
  paymentStatus: string | null;
  purchaseDate: string | null;
  progress: number;
};

function OrderCard({
  order,
  onPress,
  onPayNow,
  isPaying,
}: {
  order: Order;
  onPress: () => void;
  onPayNow: () => void;
  isPaying: boolean;
}) {
  const colors = useColors();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return { bg: "bg-primary/20", text: "text-primary" };
      case "completed":
        return { bg: "bg-success/20", text: "text-success" };
      case "pending":
        return { bg: "bg-warning/20", text: "text-warning" };
      default:
        return { bg: "bg-muted/20", text: "text-muted" };
    }
  };

  const statusStyle = getStatusStyle(order.status);
  const paymentPending = (order.paymentStatus || "").toLowerCase() !== "paid";

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl overflow-hidden mb-4 border border-border"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row">
        {order.imageUrl ? (
          <Image
            source={{ uri: order.imageUrl }}
            className="w-24 h-full"
            contentFit="cover"
          />
        ) : (
          <View className="w-24 h-full items-center justify-center bg-muted/20">
            <IconSymbol name="bag.fill" size={22} color={colors.muted} />
          </View>
        )}
        <View className="flex-1 p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
                {order.title}
              </Text>
              <Text className="text-sm text-muted mt-1">Order #{order.id}</Text>
            </View>
            <View className={`px-2 py-1 rounded-full ${statusStyle.bg}`}>
              <Text className={`text-xs font-medium capitalize ${statusStyle.text}`}>
                {order.status}
              </Text>
            </View>
          </View>

          {order.status === "active" && (
            <View className="mt-3">
              <View className="flex-row justify-between mb-1">
                <Text className="text-xs text-muted">Progress</Text>
                <Text className="text-xs font-medium text-foreground">{order.progress}%</Text>
              </View>
              <View className="h-2 bg-border rounded-full overflow-hidden">
                <View
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${order.progress}%` }}
                />
              </View>
            </View>
          )}

          <View className="flex-row items-center justify-between mt-3">
            <Text className="text-sm text-muted">
              Purchased: {order.purchaseDate ? new Date(order.purchaseDate).toLocaleDateString() : "N/A"}
            </Text>
            <Text className="text-base font-bold text-primary">${order.price}</Text>
          </View>
          <View className="flex-row items-center justify-between mt-2">
            <Text className={`text-xs font-semibold ${paymentPending ? "text-warning" : "text-success"}`}>
              Payment: {paymentPending ? "Pending" : "Paid"}
            </Text>
            {paymentPending && (
              <TouchableOpacity
                onPress={onPayNow}
                disabled={isPaying}
                className="bg-warning px-3 py-1 rounded-full"
              >
                {isPaying ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text className="text-background text-xs font-semibold">Pay Now</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ClientOrdersScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const normalizedFilter = useMemo<"all" | "active" | "completed">(() => {
    if (filterParam === "active" || filterParam === "completed" || filterParam === "all") {
      return filterParam;
    }
    return "all";
  }, [filterParam]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">(normalizedFilter);
  const { data: orders = [], refetch, isLoading } = trpc.orders.myOrders.useQuery();
  const createPaymentLink = trpc.orders.createPaymentLink.useMutation();

  useEffect(() => {
    setFilter(normalizedFilter);
  }, [normalizedFilter]);

  const normalizedOrders = useMemo<Order[]>(() => {
    return orders.map((order) => {
      const status = order.status === "delivered" ? "completed" : "active";
      const progress = status === "completed" ? 100 : 55;
      return {
        id: order.id,
        title: order.shopifyOrderNumber ? `Order #${order.shopifyOrderNumber}` : `Order #${order.id}`,
        imageUrl: (order.orderData as any)?.imageUrl ?? null,
        price: Number(order.totalAmount ?? 0),
        status,
        paymentStatus: order.paymentStatus ?? "pending",
        purchaseDate: order.createdAt ?? null,
        progress,
      };
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (filter === "all") return normalizedOrders;
    return normalizedOrders.filter((order) => order.status === filter);
  }, [filter, normalizedOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleOrderPress = (_order: Order) => {
    router.push("/(client)/orders" as any);
  };

  const handlePayNow = async (order: Order) => {
    try {
      const result = await createPaymentLink.mutateAsync({ orderId: order.id });
      const paymentLink = result.payment?.paymentLink;
      if (paymentLink) {
        await Linking.openURL(paymentLink);
        return;
      }

      if (!result.payment?.configured) {
        Alert.alert("Payment Unavailable", "Payment provider is not configured yet. Please try again later.");
        return;
      }

      if (!result.payment?.required) {
        Alert.alert("Payment Complete", "This order is already marked as paid.");
        await refetch();
        return;
      }

      Alert.alert("Payment Pending", "Unable to generate payment link. Please try again.");
    } catch (error) {
      console.error("[Orders] Failed to create payment link:", error);
      if (Platform.OS === "web") {
        window.alert("Unable to create payment link. Please try again.");
      } else {
        Alert.alert("Error", "Unable to create payment link. Please try again.");
      }
    }
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="orders-back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">My Orders</Text>
            <Text className="text-sm text-muted">{orders.length} total orders</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row bg-surface rounded-xl p-1 mt-4">
          {(["all", "active", "completed"] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              className={`flex-1 py-2 rounded-lg ${filter === filterOption ? "bg-primary" : ""}`}
              onPress={() => setFilter(filterOption)}
            >
              <Text
                className={`text-center font-medium capitalize ${
                  filter === filterOption ? "text-background" : "text-muted"
                }`}
              >
                {filterOption}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => handleOrderPress(item)}
            onPayNow={() => handlePayNow(item)}
            isPaying={createPaymentLink.isPending}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="bag.fill" size={48} color={colors.muted} />
            <Text className="text-muted text-center mt-4">
              {isLoading ? "Loading orders..." : "No orders found"}
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-full mt-4"
              onPress={() => router.push("/(client)/products" as any)}
              accessibilityRole="button"
              accessibilityLabel="Browse catalog"
              testID="orders-browse"
            >
              <Text className="text-background font-semibold">Browse Catalog</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </ScreenContainer>
  );
}
