import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Mock data for client orders
const MOCK_ORDERS = [
  {
    id: 1,
    bundleId: 1,
    bundleTitle: "Full Body Transformation",
    trainerName: "Sarah Johnson",
    trainerAvatar: "https://i.pravatar.cc/150?img=1",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
    price: 149.99,
    status: "active",
    purchaseDate: "2024-01-15",
    progress: 65,
  },
  {
    id: 2,
    bundleId: 3,
    bundleTitle: "Yoga for Beginners",
    trainerName: "Emma Wilson",
    trainerAvatar: "https://i.pravatar.cc/150?img=5",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
    price: 59.99,
    status: "active",
    purchaseDate: "2024-02-20",
    progress: 30,
  },
  {
    id: 3,
    bundleId: 2,
    bundleTitle: "HIIT Cardio Blast",
    trainerName: "Mike Chen",
    trainerAvatar: "https://i.pravatar.cc/150?img=3",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400",
    price: 79.99,
    status: "completed",
    purchaseDate: "2023-11-10",
    progress: 100,
  },
];

type Order = (typeof MOCK_ORDERS)[0];

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
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

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl overflow-hidden mb-4 border border-border"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row">
        <Image
          source={{ uri: order.image }}
          className="w-24 h-full"
          contentFit="cover"
        />
        <View className="flex-1 p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
                {order.bundleTitle}
              </Text>
              <View className="flex-row items-center mt-1">
                <Image
                  source={{ uri: order.trainerAvatar }}
                  className="w-5 h-5 rounded-full"
                />
                <Text className="text-sm text-muted ml-2">{order.trainerName}</Text>
              </View>
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
              Purchased: {new Date(order.purchaseDate).toLocaleDateString()}
            </Text>
            <Text className="text-base font-bold text-primary">${order.price}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ClientOrdersScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const filteredOrders = MOCK_ORDERS.filter((order) => {
    if (filter === "all") return true;
    return order.status === filter;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleOrderPress = (order: Order) => {
    router.push(`/bundle/${order.bundleId}` as any);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">My Orders</Text>
        <Text className="text-sm text-muted">{MOCK_ORDERS.length} total orders</Text>

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
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <OrderCard order={item} onPress={() => handleOrderPress(item)} />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="bag.fill" size={48} color={colors.muted} />
            <Text className="text-muted text-center mt-4">No orders found</Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-full mt-4"
              onPress={() => router.push("/(tabs)")}
            >
              <Text className="text-background font-semibold">Browse Catalog</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </ScreenContainer>
  );
}
