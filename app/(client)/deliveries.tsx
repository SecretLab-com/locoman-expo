import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Mock data for client deliveries
const MOCK_DELIVERIES = [
  {
    id: 1,
    bundleTitle: "Full Body Transformation",
    item: "Week 8 Workout Plan",
    description: "Advanced strength training routines for week 8",
    date: "2024-03-22",
    status: "upcoming",
    type: "workout",
  },
  {
    id: 2,
    bundleTitle: "Yoga for Beginners",
    item: "Meditation Guide",
    description: "10-minute daily meditation practices",
    date: "2024-03-23",
    status: "upcoming",
    type: "guide",
  },
  {
    id: 3,
    bundleTitle: "Full Body Transformation",
    item: "Week 7 Workout Plan",
    description: "Progressive overload training program",
    date: "2024-03-15",
    status: "delivered",
    type: "workout",
  },
  {
    id: 4,
    bundleTitle: "Yoga for Beginners",
    item: "Flexibility Assessment",
    description: "Track your flexibility progress",
    date: "2024-03-14",
    status: "delivered",
    type: "assessment",
  },
  {
    id: 5,
    bundleTitle: "Full Body Transformation",
    item: "Nutrition Plan - Week 7",
    description: "Meal prep guide and macros",
    date: "2024-03-13",
    status: "delivered",
    type: "nutrition",
  },
  {
    id: 6,
    bundleTitle: "Yoga for Beginners",
    item: "Pose Library - Advanced",
    description: "15 new poses with video tutorials",
    date: "2024-03-10",
    status: "delivered",
    type: "video",
  },
];

type Delivery = (typeof MOCK_DELIVERIES)[0];

function DeliveryCard({ delivery, onPress }: { delivery: Delivery; onPress: () => void }) {
  const colors = useColors();

  const getTypeIcon = (type: string): Parameters<typeof IconSymbol>[0]["name"] => {
    switch (type) {
      case "workout":
        return "chart.bar.fill";
      case "guide":
        return "list.bullet";
      case "assessment":
        return "checkmark.circle.fill";
      case "nutrition":
        return "heart.fill";
      case "video":
        return "camera.fill";
      default:
        return "shippingbox.fill";
    }
  };

  const isUpcoming = delivery.status === "upcoming";

  return (
    <TouchableOpacity
      className={`bg-surface rounded-xl p-4 mb-3 border ${
        isUpcoming ? "border-primary" : "border-border"
      }`}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="flex-row items-start">
        <View
          className={`w-12 h-12 rounded-xl items-center justify-center ${
            isUpcoming ? "bg-primary/20" : "bg-surface"
          }`}
        >
          <IconSymbol
            name={getTypeIcon(delivery.type)}
            size={24}
            color={isUpcoming ? colors.primary : colors.muted}
          />
        </View>
        <View className="flex-1 ml-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-base font-semibold text-foreground">{delivery.item}</Text>
              <Text className="text-sm text-muted mt-0.5">{delivery.bundleTitle}</Text>
            </View>
            {isUpcoming && (
              <View className="bg-primary/20 px-2 py-1 rounded-full">
                <Text className="text-xs font-medium text-primary">Upcoming</Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-muted mt-2" numberOfLines={2}>
            {delivery.description}
          </Text>
          <View className="flex-row items-center mt-3">
            <IconSymbol name="calendar" size={14} color={colors.muted} />
            <Text className="text-sm text-muted ml-1">
              {new Date(delivery.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
        </View>
      </View>

      {delivery.status === "delivered" && (
        <View className="flex-row items-center justify-end mt-3 pt-3 border-t border-border">
          <TouchableOpacity className="flex-row items-center">
            <IconSymbol name="eye.fill" size={16} color={colors.primary} />
            <Text className="text-primary font-medium ml-1">View Content</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ClientDeliveriesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "upcoming" | "delivered">("all");

  const filteredDeliveries = MOCK_DELIVERIES.filter((delivery) => {
    if (filter === "all") return true;
    return delivery.status === filter;
  });

  const upcomingCount = MOCK_DELIVERIES.filter((d) => d.status === "upcoming").length;
  const deliveredCount = MOCK_DELIVERIES.filter((d) => d.status === "delivered").length;

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleDeliveryPress = (delivery: Delivery) => {
    // Navigate to delivery detail - coming soon
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Deliveries</Text>
        <Text className="text-sm text-muted">
          {upcomingCount} upcoming · {deliveredCount} delivered
        </Text>

        {/* Filter Tabs */}
        <View className="flex-row bg-surface rounded-xl p-1 mt-4">
          {(["all", "upcoming", "delivered"] as const).map((filterOption) => (
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

      {/* Deliveries List */}
      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <DeliveryCard delivery={item} onPress={() => handleDeliveryPress(item)} />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
            <Text className="text-muted text-center mt-4">No deliveries found</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
