import { useState, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";

// Types for product deliveries
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
  locker: "Locker Pickup",
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

const ISSUE_REASONS = [
  "Product damaged",
  "Wrong product received",
  "Product not received",
  "Quality issue",
  "Other",
];

export default function ClientDeliveriesScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<DeliveryStatus | "all">("all");
  const utils = trpc.useUtils();

  // Use real API
  const { data: deliveries = [], isLoading, refetch, isRefetching } = trpc.deliveries.myDeliveries.useQuery();
  const confirmReceiptMutation = trpc.deliveries.confirmReceipt.useMutation({
    onSuccess: () => utils.deliveries.myDeliveries.invalidate(),
  });
  const reportIssueMutation = trpc.deliveries.reportIssue.useMutation({
    onSuccess: () => utils.deliveries.myDeliveries.invalidate(),
  });
  const requestRescheduleMutation = trpc.deliveries.requestReschedule.useMutation({
    onSuccess: () => utils.deliveries.myDeliveries.invalidate(),
  });

  const filteredDeliveries = (deliveries as Delivery[]).filter(
    (d) => activeTab === "all" || d.status === activeTab
  );

  const onRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleConfirmReceipt = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (Platform.OS === "web") {
      if (window.confirm(`Confirm you received ${delivery.productName}?`)) {
        await confirmReceiptMutation.mutateAsync({ id: delivery.id });
      }
    } else {
      Alert.alert(
        "Confirm Receipt",
        `Confirm you received ${delivery.productName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              await confirmReceiptMutation.mutateAsync({ id: delivery.id });
            },
          },
        ]
      );
    }
  };

  const handleReportIssue = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (Platform.OS === "web") {
      const reason = window.prompt("Please describe the issue:", "");
      if (reason) {
        await reportIssueMutation.mutateAsync({ id: delivery.id, reason });
      }
    } else {
      Alert.alert(
        "Report Issue",
        "What's wrong with this delivery?",
        [
          ...ISSUE_REASONS.map((reason) => ({
            text: reason,
            onPress: async () => {
              await reportIssueMutation.mutateAsync({ id: delivery.id, reason });
            },
          })),
          { text: "Cancel", style: "cancel" as const },
        ]
      );
    }
  };

  const handleRequestReschedule = async (delivery: Delivery) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // For simplicity, request reschedule to 7 days from now
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 7);

    if (Platform.OS === "web") {
      const reason = window.prompt("Reason for reschedule (optional):", "");
      if (reason !== null) {
        await requestRescheduleMutation.mutateAsync({ 
          id: delivery.id, 
          requestedDate: newDate.toISOString(),
          reason: reason || undefined,
        });
        alert("Reschedule request sent to trainer");
      }
    } else {
      Alert.alert(
        "Request Reschedule",
        "Request to reschedule this delivery?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Request",
            onPress: async () => {
              await requestRescheduleMutation.mutateAsync({ 
                id: delivery.id, 
                requestedDate: newDate.toISOString(),
              });
              Alert.alert("Success", "Reschedule request sent to trainer");
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

  const getStatusLabel = (status: DeliveryStatus | null) => {
    switch (status) {
      case "pending":
        return "Preparing";
      case "ready":
        return "Ready for Pickup";
      case "scheduled":
        return "Scheduled";
      case "out_for_delivery":
        return "Out for Delivery";
      case "delivered":
        return "Delivered";
      case "confirmed":
        return "Confirmed";
      case "disputed":
        return "Issue Reported";
      case "cancelled":
        return "Cancelled";
      default:
        return "Unknown";
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Not scheduled";
    return new Date(date).toLocaleDateString();
  };

  const renderDelivery = ({ item }: { item: Delivery }) => {
    const rescheduleRequest = parseRescheduleRequest(item.clientNotes);
    return (
      <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* Header */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-foreground">{item.productName}</Text>
          <Text className="text-sm text-muted">Quantity: {item.quantity}</Text>
        </View>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: getStatusColor(item.status) }}
          >
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      {/* Delivery Info */}
      <View className="bg-background rounded-lg p-3 mb-3">
        <View className="flex-row items-center mb-2">
          <IconSymbol name="calendar" size={16} color={colors.muted} />
          <Text className="text-foreground ml-2">
            {item.status === "delivered" || item.status === "confirmed"
              ? `Delivered: ${formatDate(item.deliveredAt)}`
              : `Scheduled: ${formatDate(item.scheduledDate)}`}
          </Text>
        </View>
        <View className="flex-row items-center mb-2">
          <IconSymbol name="shippingbox.fill" size={16} color={colors.muted} />
          <Text className="text-foreground ml-2">
            {item.deliveryMethod ? METHOD_LABELS[item.deliveryMethod] : "Not set"}
          </Text>
        </View>
        {item.trackingNumber && (
          <View className="flex-row items-center">
            <IconSymbol name="barcode" size={16} color={colors.muted} />
            <Text className="text-foreground ml-2">{item.trackingNumber}</Text>
          </View>
        )}
      </View>

      {/* Notes */}
      {item.notes && (
        <View className="bg-primary/10 rounded-lg p-3 mb-3">
          <Text className="text-foreground text-sm">{item.notes}</Text>
        </View>
      )}

      {/* Reschedule Request Pending */}
      {rescheduleRequest && (
        <View className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3">
          <Text className="text-warning font-medium">Reschedule Requested</Text>
          <Text className="text-muted text-sm">
            Requested date: {formatDate(rescheduleRequest.requestedDate)}
          </Text>
          {rescheduleRequest.reason && (
            <Text className="text-muted text-sm mt-1">Reason: {rescheduleRequest.reason}</Text>
          )}
          <Text className="text-muted text-sm mt-1">Waiting for trainer approval</Text>
        </View>
      )}

      {/* Dispute Info */}
      {item.status === "disputed" && item.disputeReason && (
        <View className="bg-error/10 border border-error/30 rounded-lg p-3 mb-3">
          <Text className="text-error font-medium">Issue Reported</Text>
          <Text className="text-muted text-sm">{item.disputeReason}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        {item.status === "delivered" && (
          <>
            <TouchableOpacity
              className="flex-1 bg-success py-3 rounded-lg items-center"
              onPress={() => handleConfirmReceipt(item)}
              disabled={confirmReceiptMutation.isPending}
            >
              {confirmReceiptMutation.isPending ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text className="text-background font-semibold">Confirm Receipt</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-error py-3 rounded-lg items-center"
              onPress={() => handleReportIssue(item)}
              disabled={reportIssueMutation.isPending}
            >
              {reportIssueMutation.isPending ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text className="text-background font-semibold">Report Issue</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        {(item.status === "pending" || item.status === "ready" || item.status === "scheduled") && 
         !rescheduleRequest && (
          <TouchableOpacity
            className="flex-1 bg-surface border border-border py-3 rounded-lg items-center"
            onPress={() => handleRequestReschedule(item)}
            disabled={requestRescheduleMutation.isPending}
          >
            {requestRescheduleMutation.isPending ? (
              <ActivityIndicator color={colors.foreground} size="small" />
            ) : (
              <Text className="text-foreground font-medium">Request Reschedule</Text>
            )}
          </TouchableOpacity>
        )}
        {item.status === "confirmed" && (
          <View className="flex-1 bg-success/10 border border-success/30 py-3 rounded-lg items-center">
            <Text className="text-success font-medium">Receipt Confirmed</Text>
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
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">My Deliveries</Text>
            <Text className="text-muted">Track your product deliveries</Text>
          </View>
        </View>
      </View>

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
              No deliveries yet
            </Text>
            <Text className="text-muted text-sm text-center mt-1">
              When you purchase bundles with products, deliveries will appear here
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
