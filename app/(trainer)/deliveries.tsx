import { useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";

type DeliveryStatus = "pending" | "ready" | "scheduled" | "out_for_delivery" | "delivered" | "confirmed" | "disputed" | "cancelled";
type DeliveryMethod = "in_person" | "locker" | "front_desk" | "shipped";

type Delivery = {
  id: string;
  orderId: string | null;
  orderItemId: string | null;
  trainerId: string;
  clientId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  status: DeliveryStatus | null;
  scheduledDate: string | null;
  deliveredAt: string | null;
  confirmedAt: string | null;
  deliveryMethod: DeliveryMethod | null;
  trackingNumber: string | null;
  notes: string | null;
  clientNotes: string | null;
  disputeReason: string | null;
  createdAt: string;
  updatedAt: string;
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

const RESCHEDULE_REQUEST_PREFIX = "reschedule_request_v1:";

type RescheduleRequest = {
  requestedDate: string | null;
  reason: string | null;
  requestedAt: string | null;
};

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseRescheduleRequest(clientNotes: string | null): RescheduleRequest | null {
  if (!clientNotes) return null;
  if (clientNotes.startsWith(RESCHEDULE_REQUEST_PREFIX)) {
    try {
      const payload = JSON.parse(clientNotes.slice(RESCHEDULE_REQUEST_PREFIX.length)) as Partial<RescheduleRequest>;
      return {
        requestedDate: toIsoDate(payload.requestedDate ?? null),
        reason: payload.reason?.trim() || null,
        requestedAt: toIsoDate(payload.requestedAt ?? null),
      };
    } catch {
      return null;
    }
  }
  if (!clientNotes.toLowerCase().includes("reschedule requested")) return null;
  const [, reason] = clientNotes.split(":");
  return {
    requestedDate: null,
    reason: reason?.trim() || null,
    requestedAt: null,
  };
}

export default function TrainerDeliveriesScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<DeliveryStatus | "all">("all");
  const utils = trpc.useUtils();

  // Use real API
  const { data: deliveries = [], isLoading, refetch, isRefetching } = trpc.deliveries.list.useQuery();
  const markReadyMutation = trpc.deliveries.markReady.useMutation({
    onSuccess: () => utils.deliveries.list.invalidate(),
  });
  const markDeliveredMutation = trpc.deliveries.markDelivered.useMutation({
    onSuccess: () => utils.deliveries.list.invalidate(),
  });
  const approveRescheduleMutation = trpc.deliveries.approveReschedule.useMutation({
    onSuccess: () => utils.deliveries.list.invalidate(),
  });
  const rejectRescheduleMutation = trpc.deliveries.rejectReschedule.useMutation({
    onSuccess: () => utils.deliveries.list.invalidate(),
  });

  const filteredDeliveries = (deliveries as Delivery[]).filter(
    (d) => activeTab === "all" || d.status === activeTab
  );

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleMarkReady = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (Platform.OS === "web") {
      if (window.confirm(`Mark delivery for Client #${delivery.clientId} as ready for pickup?`)) {
        await markReadyMutation.mutateAsync({ id: delivery.id });
      }
    } else {
      Alert.alert(
        "Mark as Ready",
        `Mark delivery for Client #${delivery.clientId} as ready for pickup?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark Ready",
            onPress: async () => {
              await markReadyMutation.mutateAsync({ id: delivery.id });
            },
          },
        ]
      );
    }
  };

  const handleMarkDelivered = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (Platform.OS === "web") {
      if (window.confirm(`Confirm that ${delivery.productName} has been delivered?`)) {
        await markDeliveredMutation.mutateAsync({ id: delivery.id });
      }
    } else {
      Alert.alert(
        "Mark as Delivered",
        `Confirm that ${delivery.productName} has been delivered?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark Delivered",
            onPress: async () => {
              await markDeliveredMutation.mutateAsync({ id: delivery.id });
            },
          },
        ]
      );
    }
  };

  const handleApproveReschedule = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const request = parseRescheduleRequest(delivery.clientNotes);
    const newDate = request?.requestedDate ? new Date(request.requestedDate) : new Date();
    if (!request?.requestedDate) {
      newDate.setDate(newDate.getDate() + 7);
    }

    if (Platform.OS === "web") {
      if (window.confirm(`Approve reschedule request?`)) {
        await approveRescheduleMutation.mutateAsync({ 
          id: delivery.id, 
          newDate: newDate.toISOString() 
        });
      }
    } else {
      Alert.alert(
        "Approve Reschedule",
        `Approve reschedule request?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Approve",
            onPress: async () => {
              await approveRescheduleMutation.mutateAsync({ 
                id: delivery.id, 
                newDate: newDate.toISOString() 
              });
            },
          },
        ]
      );
    }
  };

  const handleRejectReschedule = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (Platform.OS === "web") {
      if (window.confirm(`Reject reschedule request?`)) {
        await rejectRescheduleMutation.mutateAsync({ id: delivery.id });
      }
    } else {
      Alert.alert(
        "Reject Reschedule",
        `Reject reschedule request?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reject",
            style: "destructive",
            onPress: async () => {
              await rejectRescheduleMutation.mutateAsync({ id: delivery.id });
            },
          },
        ]
      );
    }
  };

  const getStatusColor = (status: DeliveryStatus | null) => {
    switch (status) {
      case "pending":
        return colors.warning;
      case "ready":
      case "scheduled":
        return colors.primary;
      case "out_for_delivery":
        return "#3B82F6";
      case "delivered":
        return colors.success;
      case "confirmed":
        return "#22C55E";
      case "disputed":
        return colors.error;
      case "cancelled":
        return colors.muted;
      default:
        return colors.muted;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Not scheduled";
    return new Date(date).toLocaleDateString();
  };

  const hasRescheduleRequest = (delivery: Delivery) => {
    return Boolean(parseRescheduleRequest(delivery.clientNotes));
  };

  const renderDelivery = ({ item }: { item: Delivery }) => {
    const rescheduleRequest = parseRescheduleRequest(item.clientNotes);
    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">Client #{item.clientId}</Text>
          <Text className="text-sm text-muted">Order #{item.orderId || "N/A"}</Text>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <Text
            className="text-xs font-medium capitalize"
            style={{ color: getStatusColor(item.status) }}
          >
            {item.status || "pending"}
          </Text>
        </View>
      </View>

      {/* Product Info */}
      <View className="bg-background rounded-lg p-3 mb-3">
        <Text className="text-foreground font-medium">{item.productName}</Text>
        <Text className="text-muted text-sm">Quantity: {item.quantity}</Text>
        <View className="flex-row items-center mt-1">
          <IconSymbol name="calendar" size={14} color={colors.muted} />
          <Text className="text-muted text-sm ml-1">{formatDate(item.scheduledDate)}</Text>
        </View>
        <View className="flex-row items-center mt-1">
          <IconSymbol name="shippingbox.fill" size={14} color={colors.muted} />
          <Text className="text-muted text-sm ml-1">
            {item.deliveryMethod ? METHOD_LABELS[item.deliveryMethod] : "Not set"}
          </Text>
        </View>
        {item.trackingNumber && (
          <View className="flex-row items-center mt-1">
            <IconSymbol name="barcode" size={14} color={colors.muted} />
            <Text className="text-muted text-sm ml-1">{item.trackingNumber}</Text>
          </View>
        )}
      </View>

      {/* Reschedule Request */}
      {rescheduleRequest && (
        <View className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3">
          <Text className="text-warning font-medium mb-1">Reschedule Requested</Text>
          <Text className="text-muted text-sm">
            Requested date: {formatDate(rescheduleRequest.requestedDate)}
          </Text>
          {rescheduleRequest.reason && (
            <Text className="text-muted text-sm mt-1">Reason: {rescheduleRequest.reason}</Text>
          )}
          <View className="flex-row gap-2 mt-2">
            <TouchableOpacity
              className="flex-1 bg-primary py-2 rounded-lg items-center"
              onPress={() => handleApproveReschedule(item)}
              disabled={approveRescheduleMutation.isPending}
            >
              <Text className="text-background font-medium">Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-error py-2 rounded-lg items-center"
              onPress={() => handleRejectReschedule(item)}
              disabled={rejectRescheduleMutation.isPending}
            >
              <Text className="text-background font-medium">Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Notes */}
      {item.notes && (
        <View className="bg-background rounded-lg p-3 mb-3">
          <Text className="text-muted text-sm">{item.notes}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        {item.status === "pending" && (
          <TouchableOpacity
            className="flex-1 bg-primary py-3 rounded-lg items-center"
            onPress={() => handleMarkReady(item)}
            disabled={markReadyMutation.isPending}
          >
            {markReadyMutation.isPending ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text className="text-background font-semibold">Mark Ready</Text>
            )}
          </TouchableOpacity>
        )}
        {(item.status === "ready" || item.status === "scheduled" || item.status === "out_for_delivery") && (
          <TouchableOpacity
            className="flex-1 bg-success py-3 rounded-lg items-center"
            onPress={() => handleMarkDelivered(item)}
            disabled={markDeliveredMutation.isPending}
          >
            {markDeliveredMutation.isPending ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text className="text-background font-semibold">Mark Delivered</Text>
            )}
          </TouchableOpacity>
        )}
        {(item.status === "delivered" || item.status === "confirmed") && (
          <View className="flex-1 bg-surface border border-border py-3 rounded-lg items-center">
            <Text className="text-muted font-medium">
              {item.status === "confirmed" ? "Confirmed by Client" : "Awaiting Confirmation"}
            </Text>
          </View>
        )}
        {item.status === "disputed" && (
          <View className="flex-1 bg-error/10 border border-error/30 py-3 rounded-lg items-center">
            <Text className="text-error font-medium">Disputed</Text>
            {item.disputeReason && (
              <Text className="text-error text-xs mt-1">{item.disputeReason}</Text>
            )}
          </View>
        )}
      </View>
    </View>
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading deliveries...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]}>
      {/* Navigation Header */}
      <NavigationHeader
        title="Deliveries"
        subtitle="Manage product deliveries to clients"
      />

      {/* Status Tabs */}
      <View className="px-4 py-2">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_TABS}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`px-4 py-2 mr-2 rounded-full ${
                activeTab === item.key ? "bg-primary" : "bg-surface border border-border"
              }`}
              onPress={() => setActiveTab(item.key)}
            >
              <Text
                className={`font-medium ${
                  activeTab === item.key ? "text-background" : "text-foreground"
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Deliveries List */}
      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => item.id}
        renderItem={renderDelivery}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-4 text-center">
              No deliveries found
            </Text>
            <Text className="text-muted text-sm text-center mt-1">
              Deliveries will appear here when clients purchase bundles with products
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
