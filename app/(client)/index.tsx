import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type OrderCardData = {
  id: number;
  title: string;
  status: string;
  total: number;
  imageUrl?: string | null;
  createdAt?: Date | string | null;
};

const STATUS_PROGRESS: Record<string, number> = {
  pending: 15,
  confirmed: 30,
  processing: 55,
  shipped: 80,
  delivered: 100,
  cancelled: 0,
  refunded: 0,
};

function formatCurrency(value: number) {
  if (Number.isNaN(value)) return "$0.00";
  return `$${value.toFixed(2)}`;
}

function formatDate(value?: Date | string | null) {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

function withAlpha(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "");
  const hex = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized.padStart(6, "0");
  const value = parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function OrderCard({ order, onPress }: { order: OrderCardData; onPress: () => void }) {
  const colors = useColors();
  const progress = STATUS_PROGRESS[order.status] ?? 0;

  return (
    <TouchableOpacity
      className="bg-surface rounded-2xl overflow-hidden mr-4 border border-border"
      style={{ width: 280 }}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {order.imageUrl ? (
        <Image
          source={{ uri: order.imageUrl }}
          className="w-full h-32"
          contentFit="cover"
        />
      ) : (
        <View className="w-full h-32 items-center justify-center bg-muted/20">
          <IconSymbol name="bag.fill" size={28} color={colors.muted} />
        </View>
      )}
      <View className="p-4">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {order.title}
        </Text>
        
        <View className="flex-row items-center mt-2">
          <View className="w-6 h-6 rounded-full bg-primary/10 items-center justify-center">
            <IconSymbol name="tag.fill" size={12} color={colors.primary} />
          </View>
          <Text className="text-sm text-muted ml-2 capitalize">{order.status}</Text>
        </View>

        {/* Progress Bar */}
        <View className="mt-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-muted">Progress</Text>
            <Text className="text-xs font-medium text-foreground">{progress}%</Text>
          </View>
          <View className="h-2 bg-border rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${progress}%` }}
            />
          </View>
        </View>

        <View className="flex-row items-center mt-3">
          <IconSymbol name="calendar" size={14} color={colors.primary} />
          <Text className="text-sm text-primary ml-1">
            {formatDate(order.createdAt)}
          </Text>
          <Text className="text-sm text-muted ml-auto">
            {formatCurrency(order.total)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatLabelRow({ imageUrls, label }: { imageUrls: (string | null | undefined)[]; label: string }) {
  const colors = useColors();
  const visible = imageUrls.filter(Boolean).slice(0, 3) as string[];

  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-sm text-muted">{label}</Text>
      {visible.length > 0 ? (
        <View className="flex-row">
          {visible.map((uri, index) => (
            <View
              key={`${uri}-${index}`}
              className={`w-5 h-5 rounded-full border border-background overflow-hidden ${
                index === 0 ? "" : "-ml-2"
              }`}
            >
              <Image source={{ uri }} className="w-full h-full" contentFit="cover" />
            </View>
          ))}
        </View>
      ) : (
        <View className="w-5 h-5 rounded-full bg-primary/20 items-center justify-center">
          <IconSymbol name="sparkles" size={10} color={colors.primary} />
        </View>
      )}
    </View>
  );
}

export default function ClientDashboardScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isLight = colorScheme === "light";
  const statBlue = isLight
    ? [withAlpha(colors.primary, 0.18), withAlpha(colors.primary, 0.08)] as const
    : [withAlpha(colors.primary, 0.35), withAlpha(colors.primary, 0.16)] as const;
  const statGreen = isLight
    ? [withAlpha(colors.success, 0.18), withAlpha(colors.success, 0.08)] as const
    : [withAlpha(colors.success, 0.35), withAlpha(colors.success, 0.16)] as const;
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: orders = [],
    refetch: refetchOrders,
    isLoading: ordersLoading,
  } = trpc.orders.myOrders.useQuery();
  const {
    data: deliveries = [],
    refetch: refetchDeliveries,
    isLoading: deliveriesLoading,
  } = trpc.deliveries.myDeliveries.useQuery();
  const {
    data: myTrainers = [],
    refetch: refetchTrainers,
    isLoading: trainersLoading,
  } = trpc.myTrainers.list.useQuery();

  const activeOrders = useMemo(
    () => orders.filter((order) => !["delivered", "cancelled", "refunded"].includes(order.status ?? "")),
    [orders]
  );
  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === "delivered").length,
    [orders]
  );
  const activeOrderImages = useMemo(
    () =>
      activeOrders
        .map((order) => (order.orderData as any)?.imageUrl ?? null)
        .filter(Boolean),
    [activeOrders]
  );
  const completedOrderImages = useMemo(
    () =>
      orders
        .filter((order) => order.status === "delivered")
        .map((order) => (order.orderData as any)?.imageUrl ?? null)
        .filter(Boolean),
    [orders]
  );
  const orderCards = useMemo<OrderCardData[]>(
    () =>
      activeOrders.map((order) => ({
        id: order.id,
        title: order.shopifyOrderNumber ? `Order #${order.shopifyOrderNumber}` : `Order #${order.id}`,
        status: order.status ?? "pending",
        total: Number(order.totalAmount ?? 0),
        imageUrl: (order.orderData as any)?.imageUrl ?? null,
        createdAt: order.createdAt,
      })),
    [activeOrders]
  );
  const upcomingDeliveries = useMemo(
    () =>
      deliveries
        .filter((delivery) => !["delivered", "confirmed", "cancelled"].includes(delivery.status ?? ""))
        .slice(0, 2),
    [deliveries]
  );
  const topTrainers = useMemo(
    () =>
      [...myTrainers]
        .sort((a, b) => (b.activeBundles ?? 0) - (a.activeBundles ?? 0))
        .slice(0, 5),
    [myTrainers]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchOrders(), refetchDeliveries(), refetchTrainers()]);
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
          <Text className="text-2xl font-bold text-foreground">Welcome Back!</Text>
          <Text className="text-sm text-muted">Lets continue your fitness journey</Text>
        </View>

        {/* Quick Stats */}
        <View className="flex-row px-4 mb-6">
          <TouchableOpacity
            className="flex-1 rounded-xl overflow-hidden mr-2"
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: "/(client)/orders", params: { filter: "active" } })}
            accessibilityRole="button"
            accessibilityLabel="View active bundles"
            testID="client-stats-active"
          >
            <LinearGradient
              colors={statBlue}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-4"
              style={{ padding: 16 }}
            >
              <IconSymbol name="bag.fill" size={24} color={colors.primary} />
              <Text className="text-2xl font-bold text-foreground mt-2">
                {activeOrders.length}
              </Text>
              <StatLabelRow imageUrls={activeOrderImages} label="Active Orders" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 rounded-xl overflow-hidden ml-2"
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: "/(client)/orders", params: { filter: "completed" } })}
            accessibilityRole="button"
            accessibilityLabel="View completed bundles"
            testID="client-stats-completed"
          >
            <LinearGradient
              colors={statGreen}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-4"
              style={{ padding: 16 }}
            >
              <IconSymbol name="checkmark.circle.fill" size={24} color={colors.success} />
              <Text className="text-2xl font-bold text-foreground mt-2">{completedOrders}</Text>
              <StatLabelRow imageUrls={completedOrderImages} label="Delivered" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Top Trainers */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Top Trainers</Text>
            <TouchableOpacity onPress={() => router.push("/my-trainers" as any)}>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>
          {trainersLoading ? (
            <View className="bg-surface rounded-xl p-4 border border-border">
              <Text className="text-sm text-muted">Loading trainers...</Text>
            </View>
          ) : topTrainers.length > 0 ? (
            <View className="bg-surface rounded-xl border border-border divide-y divide-border">
              {topTrainers.map((trainer) => (
                <View key={trainer.id} className="flex-row items-center p-4">
                  {trainer.photoUrl ? (
                    <Image source={{ uri: trainer.photoUrl }} className="w-10 h-10 rounded-full" />
                  ) : (
                    <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                      <IconSymbol name="person.fill" size={18} color={colors.primary} />
                    </View>
                  )}
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">{trainer.name || "Trainer"}</Text>
                    <Text className="text-xs text-muted">
                      {trainer.activeBundles ?? 0} active bundles
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="px-3 py-1 rounded-full bg-primary/10"
                    onPress={() => router.push(`/trainer/${trainer.id}` as any)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${trainer.name || "trainer"} profile`}
                    testID={`trainer-${trainer.id}`}
                  >
                    <Text className="text-primary text-xs font-semibold">View</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View className="bg-surface rounded-xl p-4 border border-border">
              <Text className="text-sm text-muted">No trainers yet.</Text>
            </View>
          )}
        </View>

        {/* Active Bundles */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between px-4 mb-3">
            <Text className="text-lg font-semibold text-foreground">Active Orders</Text>
            <TouchableOpacity onPress={() => router.push("/(client)/orders" as any)}>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>
          {ordersLoading ? (
            <View className="px-4">
              <Text className="text-sm text-muted">Loading orders...</Text>
            </View>
          ) : orderCards.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            >
              {orderCards.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPress={() => router.push("/(client)/orders" as any)}
                />
              ))}
            </ScrollView>
          ) : (
            <View className="px-4">
              <Text className="text-sm text-muted">No active orders yet.</Text>
            </View>
          )}
        </View>

        {/* Upcoming Deliveries */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Upcoming Deliveries</Text>
            <TouchableOpacity onPress={() => router.push("/(client)/deliveries" as any)}>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl border border-border">
            {deliveriesLoading ? (
              <View className="p-4">
                <Text className="text-sm text-muted">Loading deliveries...</Text>
              </View>
            ) : upcomingDeliveries.length > 0 ? (
              upcomingDeliveries.map((delivery, index) => (
                <View
                  key={delivery.id}
                  className={`flex-row items-center p-4 ${
                    index < upcomingDeliveries.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                    <IconSymbol name="shippingbox.fill" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1 ml-4">
                    <Text className="text-base font-medium text-foreground">{delivery.productName}</Text>
                    <Text className="text-sm text-muted">{delivery.deliveryMethod ?? "Delivery"}</Text>
                  </View>
                  <Text className="text-sm font-medium text-primary">
                    {formatDate(delivery.scheduledDate || delivery.deliveredAt || delivery.createdAt)}
                  </Text>
                </View>
              ))
            ) : (
              <View className="p-4">
                <Text className="text-sm text-muted">No upcoming deliveries.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Browse More */}
        <View className="px-4 mb-8">
          <TouchableOpacity
            className="bg-surface border border-border rounded-xl p-4 flex-row items-center"
            onPress={() => router.push("/(tabs)/products" as any)}
          >
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
              <IconSymbol name="magnifyingglass" size={24} color={colors.primary} />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-base font-semibold text-foreground">Discover More</Text>
              <Text className="text-sm text-muted">Browse new fitness programs</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
