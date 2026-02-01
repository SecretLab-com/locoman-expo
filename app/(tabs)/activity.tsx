import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";

type ActivityTab = "all" | "orders" | "deliveries" | "notifications";

/**
 * Activity Screen
 * 
 * Shows orders, deliveries, and notifications based on user role:
 * - Clients: Their orders and incoming deliveries
 * - Trainers: Client orders and outgoing deliveries
 * - Managers: Platform-wide activity overview
 */
export default function ActivityScreen() {
  const colors = useColors();
  const { isAuthenticated, effectiveRole, isTrainer, isClient } = useAuthContext();
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");

  // Fetch data based on role
  const { 
    data: clientDeliveries, 
    isLoading: deliveriesLoading,
    refetch: refetchDeliveries,
    isRefetching: isRefetchingDeliveries,
  } = trpc.deliveries.myDeliveries.useQuery(undefined, {
    enabled: isAuthenticated && (isClient || effectiveRole === "shopper"),
  });

  const {
    data: trainerDeliveries,
    isLoading: trainerDeliveriesLoading,
    refetch: refetchTrainerDeliveries,
    isRefetching: isRefetchingTrainerDeliveries,
  } = trpc.deliveries.list.useQuery(undefined, {
    enabled: isAuthenticated && isTrainer,
  });

  const {
    data: trainerOrders,
    isLoading: trainerOrdersLoading,
    refetch: refetchTrainerOrders,
    isRefetching: isRefetchingTrainerOrders,
  } = trpc.orders.list.useQuery(undefined, {
    enabled: isAuthenticated && isTrainer,
  });

  const isLoading = deliveriesLoading || trainerDeliveriesLoading || trainerOrdersLoading;
  const isRefetching = isRefetchingDeliveries || isRefetchingTrainerDeliveries || isRefetchingTrainerOrders;

  const onRefresh = async () => {
    await haptics.light();
    if (isClient || effectiveRole === "shopper") {
      await refetchDeliveries();
    }
    if (isTrainer) {
      await Promise.all([refetchTrainerDeliveries(), refetchTrainerOrders()]);
    }
  };

  const handleLoginPress = async () => {
    await haptics.light();
    router.push("/login");
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
      case "delivered":
      case "completed":
        return colors.success;
      case "pending":
      case "processing":
        return colors.warning;
      case "ready":
        return colors.primary;
      case "disputed":
      case "cancelled":
        return colors.error;
      default:
        return colors.muted;
    }
  };

  // Determine which data to show based on role
  const deliveries = isTrainer ? (trainerDeliveries || []) : (clientDeliveries || []);
  const orders = trainerOrders || [];

  // Filter items based on active tab
  const filteredOrders = activeTab === "deliveries" || activeTab === "notifications" ? [] : orders;
  const filteredDeliveries = activeTab === "orders" || activeTab === "notifications" ? [] : deliveries;

  // Format date
  const formatDate = (date: string | Date | null) => {
    if (!date) return "TBD";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-6">
          <IconSymbol name="bell.fill" size={40} color={colors.primary} />
        </View>
        <Text className="text-2xl font-bold text-foreground text-center mb-2">
          Track Your Activity
        </Text>
        <Text className="text-muted text-center mb-8">
          Sign in to view your orders, deliveries, and notifications
        </Text>
        <TouchableOpacity
          className="bg-primary px-8 py-3 rounded-full"
          onPress={handleLoginPress}
        >
          <Text className="text-background font-semibold text-lg">Sign In</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading activity...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4">
          <Text className="text-2xl font-bold text-foreground">Activity</Text>
          <Text className="text-sm text-muted">
            {isTrainer ? "Manage orders and deliveries" : "Your orders and deliveries"}
          </Text>
        </View>

        {/* Tab Selector */}
        <View className="px-4 mb-4">
          <View className="flex-row bg-surface rounded-xl p-1 border border-border">
            {(["all", "orders", "deliveries"] as ActivityTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                className={`flex-1 py-2 rounded-lg ${activeTab === tab ? "bg-primary" : ""}`}
                onPress={async () => {
                  await haptics.light();
                  setActiveTab(tab);
                }}
              >
                <Text className={`text-center font-medium capitalize ${activeTab === tab ? "text-white" : "text-muted"}`}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Stats for Trainers */}
        {isTrainer && (
          <View className="px-4 mb-4">
            <View className="flex-row gap-3">
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center mb-2">
                  <IconSymbol name="bag.fill" size={20} color={colors.warning} />
                  <Text className="text-warning font-semibold ml-2">
                    {orders.filter((o: any) => o.status === "pending").length}
                  </Text>
                </View>
                <Text className="text-sm text-muted">Pending Orders</Text>
              </View>
              <View className="flex-1 bg-surface rounded-xl p-4 border border-border">
                <View className="flex-row items-center mb-2">
                  <IconSymbol name="shippingbox.fill" size={20} color={colors.primary} />
                  <Text className="text-primary font-semibold ml-2">
                    {deliveries.filter((d: any) => d.status === "pending" || d.status === "ready").length}
                  </Text>
                </View>
                <Text className="text-sm text-muted">Pending Deliveries</Text>
              </View>
            </View>
          </View>
        )}

        {/* Orders Section */}
        {filteredOrders.length > 0 && (
          <View className="px-4 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-foreground">Orders</Text>
              {isTrainer && (
                <TouchableOpacity onPress={() => router.push("/(trainer)/orders" as any)}>
                  <Text className="text-primary font-medium">View All</Text>
                </TouchableOpacity>
              )}
            </View>
            <View className="bg-surface rounded-xl border border-border">
              {filteredOrders.slice(0, 5).map((order: any, index: number) => (
                <TouchableOpacity
                  key={order.id}
                  className={`flex-row items-center p-4 ${
                    index < Math.min(filteredOrders.length, 5) - 1 ? "border-b border-border" : ""
                  }`}
                  activeOpacity={0.7}
                  onPress={async () => {
                    await haptics.light();
                    if (isTrainer) {
                      router.push("/(trainer)/orders" as any);
                    }
                  }}
                >
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                    <IconSymbol name="bag.fill" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium" numberOfLines={1}>
                      {order.bundleTitle || `Order #${order.id}`}
                    </Text>
                    <Text className="text-sm text-muted">
                      {order.clientName || formatDate(order.createdAt)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-semibold">
                      ${parseFloat(order.totalAmount || order.amount || "0").toFixed(2)}
                    </Text>
                    <View
                      className="px-2 py-0.5 rounded-full mt-1"
                      style={{ backgroundColor: `${getStatusColor(order.status)}20` }}
                    >
                      <Text
                        className="text-xs font-medium capitalize"
                        style={{ color: getStatusColor(order.status) }}
                      >
                        {order.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Deliveries Section */}
        {filteredDeliveries.length > 0 && (
          <View className="px-4 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-foreground">Deliveries</Text>
              {isTrainer && (
                <TouchableOpacity onPress={() => router.push("/(trainer)/deliveries" as any)}>
                  <Text className="text-primary font-medium">View All</Text>
                </TouchableOpacity>
              )}
              {isClient && (
                <TouchableOpacity onPress={() => router.push("/(client)/deliveries" as any)}>
                  <Text className="text-primary font-medium">View All</Text>
                </TouchableOpacity>
              )}
            </View>
            <View className="bg-surface rounded-xl border border-border">
              {filteredDeliveries.slice(0, 5).map((delivery: any, index: number) => (
                <TouchableOpacity
                  key={delivery.id}
                  className={`flex-row items-center p-4 ${
                    index < Math.min(filteredDeliveries.length, 5) - 1 ? "border-b border-border" : ""
                  }`}
                  activeOpacity={0.7}
                  onPress={async () => {
                    await haptics.light();
                    if (isTrainer) {
                      router.push("/(trainer)/deliveries" as any);
                    } else if (isClient) {
                      router.push("/(client)/deliveries" as any);
                    }
                  }}
                >
                  <View 
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${getStatusColor(delivery.status)}20` }}
                  >
                    <IconSymbol 
                      name={delivery.status === "delivered" ? "checkmark.circle.fill" : "shippingbox.fill"} 
                      size={20} 
                      color={getStatusColor(delivery.status)} 
                    />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium" numberOfLines={1}>
                      {delivery.productName || delivery.item || "Delivery"}
                    </Text>
                    <Text className="text-sm text-muted" numberOfLines={1}>
                      {isTrainer ? (delivery.clientName || "Client") : (delivery.trainerName || "Trainer")}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm text-muted">
                      {formatDate(delivery.scheduledDate || delivery.date)}
                    </Text>
                    <View
                      className="px-2 py-0.5 rounded-full mt-1"
                      style={{ backgroundColor: `${getStatusColor(delivery.status)}20` }}
                    >
                      <Text
                        className="text-xs font-medium capitalize"
                        style={{ color: getStatusColor(delivery.status) }}
                      >
                        {delivery.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {filteredOrders.length === 0 && filteredDeliveries.length === 0 && (
          <View className="items-center py-12 px-4">
            <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
              <IconSymbol name="bell.fill" size={32} color={colors.muted} />
            </View>
            <Text className="text-foreground font-semibold text-lg mb-1">No activity yet</Text>
            <Text className="text-muted text-center">
              {isTrainer 
                ? "Orders and deliveries from your clients will appear here"
                : "Your orders and deliveries will appear here"
              }
            </Text>
            {!isTrainer && (
              <TouchableOpacity
                className="bg-primary px-6 py-3 rounded-full mt-6"
                onPress={async () => {
                  await haptics.light();
                  router.push("/(tabs)/discover" as any);
                }}
              >
                <Text className="text-background font-semibold">Browse Programs</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
