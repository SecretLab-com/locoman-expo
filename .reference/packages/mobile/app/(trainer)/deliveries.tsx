import { useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";

type DeliveryStatus = "pending" | "ready" | "delivered" | "confirmed" | "disputed";
type DeliveryMethod = "in_person" | "locker" | "front_desk" | "shipped";

type Delivery = {
  id: number;
  clientName: string;
  clientEmail: string;
  productName: string;
  quantity: number;
  status: DeliveryStatus;
  method: DeliveryMethod;
  scheduledDate: string;
  trackingNumber?: string;
  rescheduleRequested: boolean;
  rescheduleDate?: string;
  notes?: string;
};

const STATUS_TABS: { key: DeliveryStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "confirmed", label: "Confirmed" },
];

const METHOD_LABELS: Record<DeliveryMethod, string> = {
  in_person: "In Person",
  locker: "Locker",
  front_desk: "Front Desk",
  shipped: "Shipped",
};

// Mock data - replace with real API
const MOCK_DELIVERIES: Delivery[] = [
  {
    id: 1,
    clientName: "John Doe",
    clientEmail: "john@example.com",
    productName: "Protein Powder",
    quantity: 2,
    status: "pending",
    method: "in_person",
    scheduledDate: "2026-01-26",
    rescheduleRequested: false,
  },
  {
    id: 2,
    clientName: "Jane Smith",
    clientEmail: "jane@example.com",
    productName: "Pre-Workout",
    quantity: 1,
    status: "ready",
    method: "locker",
    scheduledDate: "2026-01-25",
    rescheduleRequested: true,
    rescheduleDate: "2026-01-28",
  },
  {
    id: 3,
    clientName: "Mike Johnson",
    clientEmail: "mike@example.com",
    productName: "BCAA",
    quantity: 3,
    status: "delivered",
    method: "shipped",
    scheduledDate: "2026-01-24",
    trackingNumber: "1Z999AA10123456784",
    rescheduleRequested: false,
  },
];

export default function TrainerDeliveriesScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<DeliveryStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>(MOCK_DELIVERIES);

  // Uncomment to use real API
  // const { data: deliveriesData, refetch } = trpc.deliveries.getTrainerDeliveries.useQuery();
  // const markReadyMutation = trpc.deliveries.markReady.useMutation();
  // const markDeliveredMutation = trpc.deliveries.markDelivered.useMutation();
  // const approveRescheduleMutation = trpc.deliveries.approveReschedule.useMutation();
  // const rejectRescheduleMutation = trpc.deliveries.rejectReschedule.useMutation();

  const filteredDeliveries = deliveries.filter(
    (d) => activeTab === "all" || d.status === activeTab
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // await refetch();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleMarkReady = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      "Mark as Ready",
      `Mark delivery for ${delivery.clientName} as ready for pickup?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Ready",
          onPress: async () => {
            // await markReadyMutation.mutateAsync({ deliveryId: delivery.id });
            setDeliveries((prev) =>
              prev.map((d) =>
                d.id === delivery.id ? { ...d, status: "ready" as DeliveryStatus } : d
              )
            );
          },
        },
      ]
    );
  };

  const handleMarkDelivered = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      "Mark as Delivered",
      `Confirm that ${delivery.productName} has been delivered to ${delivery.clientName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark Delivered",
          onPress: async () => {
            // await markDeliveredMutation.mutateAsync({ deliveryId: delivery.id });
            setDeliveries((prev) =>
              prev.map((d) =>
                d.id === delivery.id ? { ...d, status: "delivered" as DeliveryStatus } : d
              )
            );
          },
        },
      ]
    );
  };

  const handleApproveReschedule = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Alert.alert(
      "Approve Reschedule",
      `Approve reschedule to ${delivery.rescheduleDate} for ${delivery.clientName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: async () => {
            // await approveRescheduleMutation.mutateAsync({ deliveryId: delivery.id });
            setDeliveries((prev) =>
              prev.map((d) =>
                d.id === delivery.id
                  ? {
                      ...d,
                      scheduledDate: d.rescheduleDate || d.scheduledDate,
                      rescheduleRequested: false,
                      rescheduleDate: undefined,
                    }
                  : d
              )
            );
          },
        },
      ]
    );
  };

  const handleRejectReschedule = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Alert.alert(
      "Reject Reschedule",
      `Reject reschedule request from ${delivery.clientName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            // await rejectRescheduleMutation.mutateAsync({ deliveryId: delivery.id });
            setDeliveries((prev) =>
              prev.map((d) =>
                d.id === delivery.id
                  ? { ...d, rescheduleRequested: false, rescheduleDate: undefined }
                  : d
              )
            );
          },
        },
      ]
    );
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

  const renderDelivery = ({ item }: { item: Delivery }) => (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{item.clientName}</Text>
          <Text className="text-sm text-muted">{item.clientEmail}</Text>
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

      {/* Product Info */}
      <View className="bg-background rounded-lg p-3 mb-3">
        <Text className="text-foreground font-medium">{item.productName}</Text>
        <Text className="text-muted text-sm">Quantity: {item.quantity}</Text>
        <View className="flex-row items-center mt-1">
          <IconSymbol name="calendar" size={14} color={colors.muted} />
          <Text className="text-muted text-sm ml-1">{item.scheduledDate}</Text>
        </View>
        <View className="flex-row items-center mt-1">
          <IconSymbol name="shippingbox.fill" size={14} color={colors.muted} />
          <Text className="text-muted text-sm ml-1">{METHOD_LABELS[item.method]}</Text>
        </View>
        {item.trackingNumber && (
          <View className="flex-row items-center mt-1">
            <IconSymbol name="barcode" size={14} color={colors.muted} />
            <Text className="text-muted text-sm ml-1">{item.trackingNumber}</Text>
          </View>
        )}
      </View>

      {/* Reschedule Request */}
      {item.rescheduleRequested && (
        <View className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3">
          <Text className="text-warning font-medium mb-1">Reschedule Requested</Text>
          <Text className="text-muted text-sm">
            Client wants to reschedule to: {item.rescheduleDate}
          </Text>
          <View className="flex-row gap-2 mt-2">
            <TouchableOpacity
              className="flex-1 bg-primary py-2 rounded-lg items-center"
              onPress={() => handleApproveReschedule(item)}
            >
              <Text className="text-background font-medium">Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-error py-2 rounded-lg items-center"
              onPress={() => handleRejectReschedule(item)}
            >
              <Text className="text-background font-medium">Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        {item.status === "pending" && (
          <TouchableOpacity
            className="flex-1 bg-primary py-3 rounded-lg items-center"
            onPress={() => handleMarkReady(item)}
          >
            <Text className="text-background font-semibold">Mark Ready</Text>
          </TouchableOpacity>
        )}
        {item.status === "ready" && (
          <TouchableOpacity
            className="flex-1 bg-success py-3 rounded-lg items-center"
            onPress={() => handleMarkDelivered(item)}
          >
            <Text className="text-background font-semibold">Mark Delivered</Text>
          </TouchableOpacity>
        )}
        {(item.status === "delivered" || item.status === "confirmed") && (
          <View className="flex-1 bg-surface border border-border py-3 rounded-lg items-center">
            <Text className="text-muted font-medium">
              {item.status === "confirmed" ? "Confirmed by Client" : "Awaiting Confirmation"}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // Stats
  const stats = {
    pending: deliveries.filter((d) => d.status === "pending").length,
    ready: deliveries.filter((d) => d.status === "ready").length,
    delivered: deliveries.filter((d) => d.status === "delivered").length,
    rescheduleRequests: deliveries.filter((d) => d.rescheduleRequested).length,
  };

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="flex-row items-center justify-between py-4">
        <Text className="text-2xl font-bold text-foreground">Deliveries</Text>
        <View className="flex-row items-center">
          {stats.rescheduleRequests > 0 && (
            <View className="bg-warning px-2 py-1 rounded-full mr-2">
              <Text className="text-background text-xs font-medium">
                {stats.rescheduleRequests} reschedule
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats Row */}
      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 bg-warning/10 rounded-lg p-3 items-center">
          <Text className="text-2xl font-bold text-warning">{stats.pending}</Text>
          <Text className="text-xs text-muted">Pending</Text>
        </View>
        <View className="flex-1 bg-primary/10 rounded-lg p-3 items-center">
          <Text className="text-2xl font-bold text-primary">{stats.ready}</Text>
          <Text className="text-xs text-muted">Ready</Text>
        </View>
        <View className="flex-1 bg-success/10 rounded-lg p-3 items-center">
          <Text className="text-2xl font-bold text-success">{stats.delivered}</Text>
          <Text className="text-xs text-muted">Delivered</Text>
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
