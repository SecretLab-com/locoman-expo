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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired";

type Subscription = {
  id: number;
  bundleId: number;
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

// Mock data
const MOCK_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 1,
    bundleId: 1,
    bundleTitle: "Weight Loss Program",
    trainerName: "Coach Mike",
    price: "149.99",
    cadence: "monthly",
    status: "active",
    nextBillingDate: new Date(Date.now() + 15 * 86400000),
    startDate: new Date(Date.now() - 45 * 86400000),
    sessionsIncluded: 8,
    sessionsUsed: 5,
    checkInsIncluded: 4,
    checkInsUsed: 2,
  },
  {
    id: 2,
    bundleId: 2,
    bundleTitle: "Nutrition Coaching",
    trainerName: "Coach Sarah",
    price: "79.99",
    cadence: "monthly",
    status: "paused",
    nextBillingDate: new Date(Date.now() + 30 * 86400000),
    startDate: new Date(Date.now() - 60 * 86400000),
    sessionsIncluded: 4,
    sessionsUsed: 4,
    checkInsIncluded: 8,
    checkInsUsed: 6,
  },
];

export default function SubscriptionsScreen() {
  const colors = useColors();
  const [subscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

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
          onPress: () => {
            // TODO: Pause subscription via tRPC
            setShowDetailModal(false);
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
          onPress: () => {
            // TODO: Resume subscription via tRPC
            setShowDetailModal(false);
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
          onPress: () => {
            // TODO: Cancel subscription via tRPC
            setShowDetailModal(false);
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
        <Text className="text-2xl font-bold text-foreground">Subscriptions</Text>
        <Text className="text-sm text-muted mt-1">Manage your active programs</Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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

      {/* Subscription Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowDetailModal(false)}
        >
          <View className="bg-background rounded-t-3xl max-h-[85%]">
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
                        className="bg-warning/10 py-4 rounded-xl items-center border border-warning/30"
                      >
                        <Text className="text-warning font-semibold">Pause Subscription</Text>
                      </TouchableOpacity>
                    )}

                    {selectedSubscription.status === "paused" && (
                      <TouchableOpacity
                        onPress={() => handleResume(selectedSubscription)}
                        className="bg-primary py-4 rounded-xl items-center"
                      >
                        <Text className="text-white font-semibold">Resume Subscription</Text>
                      </TouchableOpacity>
                    )}

                    {(selectedSubscription.status === "active" || selectedSubscription.status === "paused") && (
                      <TouchableOpacity
                        onPress={() => handleCancel(selectedSubscription)}
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
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
