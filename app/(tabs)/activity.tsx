import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { haptics } from "@/hooks/use-haptics";

type ActivityTab = "all" | "orders" | "deliveries";

// Mock data - in production, this would come from tRPC queries
const MOCK_ORDERS = [
  { id: 1, bundleTitle: "Full Body Transformation", status: "active", date: "Jan 15", amount: "$149.99" },
  { id: 2, bundleTitle: "Yoga for Beginners", status: "completed", date: "Dec 28", amount: "$79.99" },
  { id: 3, bundleTitle: "HIIT Bootcamp", status: "pending", date: "Jan 28", amount: "$199.99" },
];

const MOCK_DELIVERIES = [
  { id: 1, item: "Week 8 Workout Plan", bundleTitle: "Full Body Transformation", status: "pending", date: "Mar 22" },
  { id: 2, item: "Meditation Guide", bundleTitle: "Yoga for Beginners", status: "delivered", date: "Mar 20" },
  { id: 3, item: "Nutrition Checklist", bundleTitle: "Full Body Transformation", status: "pending", date: "Mar 25" },
];

export default function ActivityScreen() {
  const colors = useColors();
  const { isAuthenticated, effectiveRole } = useAuthContext();
  const [activeTab, setActiveTab] = useState<ActivityTab>("all");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
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
        return colors.success;
      case "pending":
        return colors.warning;
      case "completed":
        return colors.primary;
      default:
        return colors.muted;
    }
  };

  // Filter items based on active tab
  const filteredOrders = activeTab === "deliveries" ? [] : MOCK_ORDERS;
  const filteredDeliveries = activeTab === "orders" ? [] : MOCK_DELIVERIES;

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
          <Text className="text-2xl font-bold text-foreground">Activity</Text>
          <Text className="text-sm text-muted">Your orders and deliveries</Text>
        </View>

        {/* Tab Selector */}
        <View className="px-4 mb-4">
          <View className="flex-row bg-surface rounded-xl p-1 border border-border">
            {(["all", "orders", "deliveries"] as ActivityTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                className={`flex-1 py-2 rounded-lg ${activeTab === tab ? "bg-primary" : ""}`}
                onPress={() => setActiveTab(tab)}
              >
                <Text className={`text-center font-medium capitalize ${activeTab === tab ? "text-white" : "text-muted"}`}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Orders Section */}
        {filteredOrders.length > 0 && (
          <View className="px-4 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-foreground">Orders</Text>
              <TouchableOpacity>
                <Text className="text-primary font-medium">View All</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-surface rounded-xl border border-border">
              {filteredOrders.map((order, index) => (
                <TouchableOpacity
                  key={order.id}
                  className={`flex-row items-center p-4 ${
                    index < filteredOrders.length - 1 ? "border-b border-border" : ""
                  }`}
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                    <IconSymbol name="bag.fill" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">{order.bundleTitle}</Text>
                    <Text className="text-sm text-muted">{order.date}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-foreground font-semibold">{order.amount}</Text>
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
              <TouchableOpacity>
                <Text className="text-primary font-medium">View All</Text>
              </TouchableOpacity>
            </View>
            <View className="bg-surface rounded-xl border border-border">
              {filteredDeliveries.map((delivery, index) => (
                <TouchableOpacity
                  key={delivery.id}
                  className={`flex-row items-center p-4 ${
                    index < filteredDeliveries.length - 1 ? "border-b border-border" : ""
                  }`}
                  activeOpacity={0.7}
                >
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                    <IconSymbol name="shippingbox.fill" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">{delivery.item}</Text>
                    <Text className="text-sm text-muted">{delivery.bundleTitle}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm text-muted">{delivery.date}</Text>
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
              Your orders and deliveries will appear here
            </Text>
          </View>
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
