import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { trpc } from "@/lib/trpc";

type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired";

type Subscription = {
  id: string;
  bundleId?: string;
  bundleTitle: string;
  trainerName: string;
  price: string;
  cadence: "weekly" | "monthly";
  status: SubscriptionStatus;
  nextBillingDate: Date;
  startDate: Date;
  sessionsIncluded: number;
  sessionsUsed: number;
  checkInsIncluded: number;
  checkInsUsed: number;
};

export default function SubscriptionsScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const overlayColor = colorScheme === "dark"
    ? "rgba(0, 0, 0, 0.5)"
    : "rgba(15, 23, 42, 0.18)";
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch real subscriptions
  const { data: rawSubscriptions, isLoading, refetch, isRefetching } = trpc.subscriptions.mySubscriptions.useQuery();
  const pauseSubscription = trpc.subscriptions.pause.useMutation({
    onSuccess: () => {
      refetch();
      setShowDetailModal(false);
    },
  });
  const resumeSubscription = trpc.subscriptions.resume.useMutation({
    onSuccess: () => {
      refetch();
      setShowDetailModal(false);
    },
  });
  const cancelSubscription = trpc.subscriptions.cancel.useMutation({
    onSuccess: () => {
      refetch();
      setShowDetailModal(false);
    },
  });

  // Map API data to UI type
  const subscriptions: Subscription[] = (rawSubscriptions || []).map((sub: any) => ({
    id: sub.id,
    bundleId: sub.bundleDraftId,
    bundleTitle: sub.bundleTitle || sub.title || "Subscription",
    trainerName: sub.trainerName || "Trainer",
    price: sub.price || "0.00",
    cadence: sub.subscriptionType === "weekly" ? "weekly" : "monthly",
    status: (sub.status || "active") as SubscriptionStatus,
    nextBillingDate: sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date(Date.now() + 30 * 86400000),
    startDate: new Date(sub.startDate || sub.createdAt),
    sessionsIncluded: sub.sessionsIncluded || 0,
    sessionsUsed: sub.sessionsUsed || 0,
    checkInsIncluded: sub.checkInsIncluded || 0,
    checkInsUsed: sub.checkInsUsed || 0,
  }));
  const isMutating = pauseSubscription.isPending || resumeSubscription.isPending || cancelSubscription.isPending;

  // Get status color
  const getStatusColor = (status: SubscriptionStatus) => {
    switch (status) {
      case "active":
        return "#22C55E";
      case "paused":
        return "#F59E0B";
      case "cancelled":
        return "#EF4444";
      case "expired":
        return colors.muted;
      default:
        return colors.muted;
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Handle pause subscription
  const handlePause = (subscription: Subscription) => {
    Alert.alert(
      "Pause Subscription",
      `Pause your ${subscription.bundleTitle} subscription? You can resume anytime.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pause",
          onPress: async () => {
            try {
              await pauseSubscription.mutateAsync({ id: subscription.id });
            } catch (error) {
              console.error("Failed to pause subscription:", error);
              Alert.alert("Error", "Unable to pause subscription. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Handle resume subscription
  const handleResume = (subscription: Subscription) => {
    Alert.alert(
      "Resume Subscription",
      `Resume your ${subscription.bundleTitle} subscription?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resume",
          onPress: async () => {
            try {
              await resumeSubscription.mutateAsync({ id: subscription.id });
            } catch (error) {
              console.error("Failed to resume subscription:", error);
              Alert.alert("Error", "Unable to resume subscription. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Handle cancel subscription
  const handleCancel = (subscription: Subscription) => {
    Alert.alert(
      "Cancel Subscription",
      `Are you sure you want to cancel your ${subscription.bundleTitle} subscription? This action cannot be undone.`,
      [
        { text: "Keep Subscription", style: "cancel" },
        {
          text: "Cancel Subscription",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelSubscription.mutateAsync({ id: subscription.id });
            } catch (error) {
              console.error("Failed to cancel subscription:", error);
              Alert.alert("Error", "Unable to cancel subscription. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Calculate progress percentage
  const getProgressPercentage = (used: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((used / total) * 100, 100);
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Subscriptions</Text>
            <Text className="text-sm text-muted mt-1">Manage your active programs</Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading subscriptions...</Text>
        </View>
      ) : (
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
        }
      >
        {subscriptions.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="bag.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2 text-center">
              No active subscriptions
            </Text>
            <Text className="text-muted text-sm text-center mt-1">
              Browse bundles to get started
            </Text>
          </View>
        ) : (
          subscriptions.map((subscription) => (
            <TouchableOpacity
              key={subscription.id}
              onPress={() => {
                setSelectedSubscription(subscription);
                setShowDetailModal(true);
              }}
              className="bg-surface rounded-xl p-4 mb-4 border border-border"
            >
              {/* Header */}
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground">
                    {subscription.bundleTitle}
                  </Text>
                  <Text className="text-sm text-muted">{subscription.trainerName}</Text>
                </View>
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${getStatusColor(subscription.status)}20` }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{ color: getStatusColor(subscription.status) }}
                  >
                    {subscription.status}
                  </Text>
                </View>
              </View>

              {/* Price */}
              <View className="flex-row items-baseline mb-4">
                <Text className="text-2xl font-bold text-primary">
                  ${subscription.price}
                </Text>
                <Text className="text-sm text-muted ml-1">
                  /{subscription.cadence === "weekly" ? "week" : "month"}
                </Text>
              </View>

              {/* Sessions Progress */}
              {subscription.sessionsIncluded > 0 && (
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm text-foreground">Sessions</Text>
                    <Text className="text-sm text-muted">
                      {subscription.sessionsUsed} / {subscription.sessionsIncluded} used
                    </Text>
                  </View>
                  <View className="h-2 bg-background rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${getProgressPercentage(subscription.sessionsUsed, subscription.sessionsIncluded)}%`,
                        backgroundColor: subscription.sessionsUsed >= subscription.sessionsIncluded
                          ? "#EF4444"
                          : colors.primary,
                      }}
                    />
                  </View>
                  <Text className="text-xs text-muted mt-1">
                    {subscription.sessionsIncluded - subscription.sessionsUsed} sessions remaining
                  </Text>
                </View>
              )}

              {/* Check-ins Progress */}
              {subscription.checkInsIncluded > 0 && (
                <View className="mb-3">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm text-foreground">Check-ins</Text>
                    <Text className="text-sm text-muted">
                      {subscription.checkInsUsed} / {subscription.checkInsIncluded} used
                    </Text>
                  </View>
                  <View className="h-2 bg-background rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{
                        width: `${getProgressPercentage(subscription.checkInsUsed, subscription.checkInsIncluded)}%`,
                        backgroundColor: subscription.checkInsUsed >= subscription.checkInsIncluded
                          ? "#EF4444"
                          : colors.primary,
                      }}
                    />
                  </View>
                </View>
              )}

              {/* Next Billing */}
              {subscription.status === "active" && (
                <View className="flex-row items-center mt-2 pt-3 border-t border-border">
                  <IconSymbol name="calendar" size={16} color={colors.muted} />
                  <Text className="text-sm text-muted ml-2">
                    Next billing: {formatDate(subscription.nextBillingDate)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
      )}

      {/* Subscription Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          onPress={() => setShowDetailModal(false)}
          style={{ backgroundColor: overlayColor }}
        >
          <SwipeDownSheet
            visible={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            className="bg-background rounded-t-3xl max-h-[85%]"
          >
            {selectedSubscription && (
              <ScrollView>
                <View className="p-6">
                  {/* Header */}
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-xl font-bold text-foreground">
                      Subscription Details
                    </Text>
                    <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                      <IconSymbol name="xmark" size={24} color={colors.muted} />
                    </TouchableOpacity>
                  </View>

                  {/* Bundle Info */}
                  <View className="bg-surface rounded-xl p-4 mb-4">
                    <Text className="text-lg font-semibold text-foreground">
                      {selectedSubscription.bundleTitle}
                    </Text>
                    <Text className="text-muted">{selectedSubscription.trainerName}</Text>
                    <View className="flex-row items-baseline mt-2">
                      <Text className="text-2xl font-bold text-primary">
                        ${selectedSubscription.price}
                      </Text>
                      <Text className="text-muted ml-1">
                        /{selectedSubscription.cadence === "weekly" ? "week" : "month"}
                      </Text>
                    </View>
                  </View>

                  {/* Status */}
                  <View className="bg-surface rounded-xl p-4 mb-4">
                    <Text className="text-sm font-semibold text-foreground mb-3">Status</Text>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-foreground">Current Status</Text>
                      <View
                        className="px-3 py-1 rounded-full"
                        style={{ backgroundColor: `${getStatusColor(selectedSubscription.status)}20` }}
                      >
                        <Text
                          className="text-sm font-semibold capitalize"
                          style={{ color: getStatusColor(selectedSubscription.status) }}
                        >
                          {selectedSubscription.status}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-3">
                      <Text className="text-foreground">Started</Text>
                      <Text className="text-muted">{formatDate(selectedSubscription.startDate)}</Text>
                    </View>
                    {selectedSubscription.status === "active" && (
                      <View className="flex-row items-center justify-between mt-3">
                        <Text className="text-foreground">Next Billing</Text>
                        <Text className="text-muted">{formatDate(selectedSubscription.nextBillingDate)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Usage */}
                  <View className="bg-surface rounded-xl p-4 mb-4">
                    <Text className="text-sm font-semibold text-foreground mb-3">Usage This Period</Text>
                    
                    {selectedSubscription.sessionsIncluded > 0 && (
                      <View className="mb-4">
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-foreground">Sessions</Text>
                          <Text className="text-muted">
                            {selectedSubscription.sessionsUsed} / {selectedSubscription.sessionsIncluded}
                          </Text>
                        </View>
                        <View className="h-3 bg-background rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${getProgressPercentage(selectedSubscription.sessionsUsed, selectedSubscription.sessionsIncluded)}%`,
                              backgroundColor: colors.primary,
                            }}
                          />
                        </View>
                      </View>
                    )}

                    {selectedSubscription.checkInsIncluded > 0 && (
                      <View>
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="text-foreground">Check-ins</Text>
                          <Text className="text-muted">
                            {selectedSubscription.checkInsUsed} / {selectedSubscription.checkInsIncluded}
                          </Text>
                        </View>
                        <View className="h-3 bg-background rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${getProgressPercentage(selectedSubscription.checkInsUsed, selectedSubscription.checkInsIncluded)}%`,
                              backgroundColor: colors.primary,
                            }}
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  <View className="gap-3">
                    {selectedSubscription.status === "active" && (
                      <TouchableOpacity
                        onPress={() => handlePause(selectedSubscription)}
                        disabled={isMutating}
                        className="bg-warning/10 py-4 rounded-xl items-center border border-warning/30"
                      >
                        <Text className="text-warning font-semibold">Pause Subscription</Text>
                      </TouchableOpacity>
                    )}

                    {selectedSubscription.status === "paused" && (
                      <TouchableOpacity
                        onPress={() => handleResume(selectedSubscription)}
                        disabled={isMutating}
                        className="bg-primary py-4 rounded-xl items-center"
                      >
                        <Text className="text-white font-semibold">Resume Subscription</Text>
                      </TouchableOpacity>
                    )}

                    {(selectedSubscription.status === "active" || selectedSubscription.status === "paused") && (
                      <TouchableOpacity
                        onPress={() => handleCancel(selectedSubscription)}
                        disabled={isMutating}
                        className="bg-error/10 py-4 rounded-xl items-center border border-error/30"
                      >
                        <Text className="text-error font-semibold">Cancel Subscription</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => setShowDetailModal(false)}
                    className="py-3 mt-3"
                  >
                    <Text className="text-center text-muted">Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </SwipeDownSheet>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
