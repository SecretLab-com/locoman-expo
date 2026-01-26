import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Types for product deliveries
type DeliveryStatus = "pending" | "ready" | "in_transit" | "delivered" | "confirmed" | "issue_reported";

type ProductDelivery = {
  id: number;
  orderId: number;
  productName: string;
  productImage?: string;
  quantity: number;
  trainerName: string;
  trainerPhoto?: string;
  fulfillmentType: "home_ship" | "trainer_delivery" | "vending" | "cafeteria";
  status: DeliveryStatus;
  scheduledDate: string;
  deliveredDate?: string;
  trackingNumber?: string;
  notes?: string;
};

// Mock data for client deliveries
const MOCK_DELIVERIES: ProductDelivery[] = [
  {
    id: 1,
    orderId: 1001,
    productName: "Whey Protein - Chocolate",
    productImage: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=200",
    quantity: 2,
    trainerName: "Sarah Johnson",
    trainerPhoto: "https://i.pravatar.cc/150?img=1",
    fulfillmentType: "trainer_delivery",
    status: "ready",
    scheduledDate: "2024-03-22",
    notes: "Will be available at the gym front desk",
  },
  {
    id: 2,
    orderId: 1001,
    productName: "Resistance Bands Set",
    productImage: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=200",
    quantity: 1,
    trainerName: "Sarah Johnson",
    trainerPhoto: "https://i.pravatar.cc/150?img=1",
    fulfillmentType: "home_ship",
    status: "in_transit",
    scheduledDate: "2024-03-24",
    trackingNumber: "1Z999AA10123456784",
  },
  {
    id: 3,
    orderId: 1002,
    productName: "Pre-Workout Energy",
    productImage: "https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=200",
    quantity: 1,
    trainerName: "Mike Chen",
    trainerPhoto: "https://i.pravatar.cc/150?img=3",
    fulfillmentType: "vending",
    status: "pending",
    scheduledDate: "2024-03-25",
    notes: "Vending machine at Building A, 2nd floor",
  },
  {
    id: 4,
    orderId: 1000,
    productName: "Yoga Mat Premium",
    productImage: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=200",
    quantity: 1,
    trainerName: "Emma Wilson",
    trainerPhoto: "https://i.pravatar.cc/150?img=5",
    fulfillmentType: "trainer_delivery",
    status: "confirmed",
    scheduledDate: "2024-03-15",
    deliveredDate: "2024-03-15",
  },
  {
    id: 5,
    orderId: 999,
    productName: "BCAA Powder - Berry",
    productImage: "https://images.unsplash.com/photo-1594381898411-846e7d193883?w=200",
    quantity: 1,
    trainerName: "Sarah Johnson",
    trainerPhoto: "https://i.pravatar.cc/150?img=1",
    fulfillmentType: "cafeteria",
    status: "delivered",
    scheduledDate: "2024-03-10",
    deliveredDate: "2024-03-10",
    notes: "Pick up at cafeteria counter",
  },
];

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pending", color: "text-warning", bgColor: "bg-warning/20" },
  ready: { label: "Ready for Pickup", color: "text-primary", bgColor: "bg-primary/20" },
  in_transit: { label: "In Transit", color: "text-primary", bgColor: "bg-primary/20" },
  delivered: { label: "Delivered", color: "text-success", bgColor: "bg-success/20" },
  confirmed: { label: "Confirmed", color: "text-success", bgColor: "bg-success/20" },
  issue_reported: { label: "Issue Reported", color: "text-error", bgColor: "bg-error/20" },
};

const FULFILLMENT_LABELS: Record<ProductDelivery["fulfillmentType"], { label: string; icon: string }> = {
  home_ship: { label: "Home Shipping", icon: "shippingbox.fill" },
  trainer_delivery: { label: "Trainer Delivery", icon: "person.fill" },
  vending: { label: "Vending Machine", icon: "cube.fill" },
  cafeteria: { label: "Cafeteria Pickup", icon: "fork.knife" },
};

function DeliveryCard({ 
  delivery, 
  onConfirmReceipt, 
  onReportIssue 
}: { 
  delivery: ProductDelivery;
  onConfirmReceipt: () => void;
  onReportIssue: () => void;
}) {
  const colors = useColors();
  const statusConfig = STATUS_CONFIG[delivery.status];
  const fulfillmentConfig = FULFILLMENT_LABELS[delivery.fulfillmentType];
  const showActions = delivery.status === "delivered" || delivery.status === "ready";

  return (
    <View className="bg-surface rounded-xl mb-4 border border-border overflow-hidden">
      <View className="flex-row p-4">
        {/* Product Image */}
        {delivery.productImage ? (
          <Image
            source={{ uri: delivery.productImage }}
            className="w-20 h-20 rounded-lg"
            contentFit="cover"
          />
        ) : (
          <View className="w-20 h-20 rounded-lg bg-primary/20 items-center justify-center">
            <IconSymbol name="bag.fill" size={28} color={colors.primary} />
          </View>
        )}

        <View className="flex-1 ml-4">
          {/* Product Name & Quantity */}
          <Text className="text-foreground font-semibold" numberOfLines={2}>
            {delivery.productName}
          </Text>
          <Text className="text-muted text-sm">Qty: {delivery.quantity}</Text>

          {/* Trainer */}
          <View className="flex-row items-center mt-2">
            {delivery.trainerPhoto ? (
              <Image
                source={{ uri: delivery.trainerPhoto }}
                className="w-5 h-5 rounded-full"
                contentFit="cover"
              />
            ) : (
              <View className="w-5 h-5 rounded-full bg-primary/20 items-center justify-center">
                <Text className="text-primary text-xs font-bold">
                  {delivery.trainerName.charAt(0)}
                </Text>
              </View>
            )}
            <Text className="text-muted text-sm ml-2">{delivery.trainerName}</Text>
          </View>
        </View>

        {/* Status Badge */}
        <View className={`px-2 py-1 rounded-full h-6 ${statusConfig.bgColor}`}>
          <Text className={`text-xs font-medium ${statusConfig.color}`}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Delivery Info */}
      <View className="px-4 pb-4 gap-2">
        {/* Fulfillment Type */}
        <View className="flex-row items-center">
          <IconSymbol name={fulfillmentConfig.icon as any} size={16} color={colors.muted} />
          <Text className="text-muted text-sm ml-2">{fulfillmentConfig.label}</Text>
        </View>

        {/* Scheduled/Delivered Date */}
        <View className="flex-row items-center">
          <IconSymbol name="calendar" size={16} color={colors.muted} />
          <Text className="text-muted text-sm ml-2">
            {delivery.deliveredDate
              ? `Delivered: ${new Date(delivery.deliveredDate).toLocaleDateString()}`
              : `Scheduled: ${new Date(delivery.scheduledDate).toLocaleDateString()}`}
          </Text>
        </View>

        {/* Tracking Number */}
        {delivery.trackingNumber && (
          <View className="flex-row items-center">
            <IconSymbol name="shippingbox.fill" size={16} color={colors.muted} />
            <Text className="text-muted text-sm ml-2">
              Tracking: {delivery.trackingNumber}
            </Text>
          </View>
        )}

        {/* Notes */}
        {delivery.notes && (
          <View className="bg-background rounded-lg p-3 mt-2">
            <Text className="text-muted text-sm">{delivery.notes}</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {showActions && (
        <View className="flex-row border-t border-border">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center py-3 border-r border-border"
            onPress={onConfirmReceipt}
          >
            <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
            <Text className="text-success font-medium ml-2">Confirm Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center py-3"
            onPress={onReportIssue}
          >
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />
            <Text className="text-error font-medium ml-2">Report Issue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ClientDeliveriesScreen() {
  const colors = useColors();
  const [deliveries, setDeliveries] = useState(MOCK_DELIVERIES);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const filteredDeliveries = deliveries.filter((delivery) => {
    if (filter === "all") return true;
    if (filter === "pending") {
      return ["pending", "ready", "in_transit", "delivered"].includes(delivery.status);
    }
    return ["confirmed", "issue_reported"].includes(delivery.status);
  });

  const pendingCount = deliveries.filter((d) => 
    ["pending", "ready", "in_transit", "delivered"].includes(d.status)
  ).length;
  const completedCount = deliveries.filter((d) => 
    ["confirmed", "issue_reported"].includes(d.status)
  ).length;

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch from API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleConfirmReceipt = (deliveryId: number) => {
    Alert.alert(
      "Confirm Receipt",
      "Have you received this item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Received",
          onPress: () => {
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setDeliveries((prev) =>
              prev.map((d) =>
                d.id === deliveryId
                  ? { ...d, status: "confirmed" as DeliveryStatus, deliveredDate: new Date().toISOString().split("T")[0] }
                  : d
              )
            );
            // TODO: API call to confirm
          },
        },
      ]
    );
  };

  const handleReportIssue = (deliveryId: number) => {
    Alert.alert(
      "Report Issue",
      "What's the problem with this delivery?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Item Damaged",
          onPress: () => reportIssue(deliveryId, "damaged"),
        },
        {
          text: "Wrong Item",
          onPress: () => reportIssue(deliveryId, "wrong_item"),
        },
        {
          text: "Not Received",
          onPress: () => reportIssue(deliveryId, "not_received"),
        },
      ]
    );
  };

  const reportIssue = (deliveryId: number, issueType: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === deliveryId
          ? { ...d, status: "issue_reported" as DeliveryStatus }
          : d
      )
    );
    Alert.alert(
      "Issue Reported",
      "Your trainer has been notified and will contact you shortly."
    );
    // TODO: API call to report issue
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Deliveries</Text>
        <Text className="text-sm text-muted">
          {pendingCount} pending · {completedCount} completed
        </Text>

        {/* Filter Tabs */}
        <View className="flex-row bg-surface rounded-xl p-1 mt-4">
          {(["all", "pending", "completed"] as const).map((filterOption) => (
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
          <DeliveryCard
            delivery={item}
            onConfirmReceipt={() => handleConfirmReceipt(item.id)}
            onReportIssue={() => handleReportIssue(item.id)}
          />
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
