import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { trpc } from "@/lib/trpc";

// Status tiers
const STATUS_TIERS = [
  {
    name: "Bronze",
    minPoints: 0,
    maxPoints: 999,
    color: "#CD7F32",
    benefits: ["Basic dashboard access", "Up to 10 clients"],
  },
  {
    name: "Silver",
    minPoints: 1000,
    maxPoints: 4999,
    color: "#C0C0C0",
    benefits: ["Priority support", "Up to 25 clients", "Custom branding"],
  },
  {
    name: "Gold",
    minPoints: 5000,
    maxPoints: 14999,
    color: "#FFD700",
    benefits: ["Featured in directory", "Up to 50 clients", "Analytics dashboard", "Ad partnerships"],
  },
  {
    name: "Platinum",
    minPoints: 15000,
    maxPoints: Infinity,
    color: "#E5E4E2",
    benefits: ["Unlimited clients", "Priority placement", "White-label options", "Revenue sharing"],
  },
];

// Point earning activities
const POINT_ACTIVITIES = [
  { activity: "Complete a session", points: 10 },
  { activity: "Client completes order", points: 5 },
  { activity: "New client joins", points: 50 },
  { activity: "Client renews subscription", points: 25 },
  { activity: "5-star review", points: 20 },
  { activity: "Referral signup", points: 100 },
];

type PointHistory = {
  id: string;
  activity: string;
  points: number;
  date: Date;
  clientName?: string;
};

export default function PointsScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const overlayColor = colorScheme === "dark"
    ? "rgba(0, 0, 0, 0.5)"
    : "rgba(15, 23, 42, 0.18)";
  const [showTiersModal, setShowTiersModal] = useState(false);

  // Fetch points from API
  const { data: pointsData, isLoading } = trpc.trainerDashboard.points.useQuery();
  const totalPoints = pointsData?.totalPoints ?? 0;

  // TODO: Add trpc.trainerDashboard.pointHistory.useQuery() when endpoint exists
  // For now, history is empty until a points history endpoint is created
  const history: PointHistory[] = [];

  // Get current tier
  const currentTier = useMemo(() => {
    return STATUS_TIERS.find(
      (tier) => totalPoints >= tier.minPoints && totalPoints <= tier.maxPoints
    ) || STATUS_TIERS[0];
  }, [totalPoints]);

  // Get next tier
  const nextTier = useMemo(() => {
    const currentIndex = STATUS_TIERS.findIndex((t) => t.name === currentTier.name);
    return currentIndex < STATUS_TIERS.length - 1 ? STATUS_TIERS[currentIndex + 1] : null;
  }, [currentTier]);

  // Calculate progress to next tier
  const progressToNextTier = useMemo(() => {
    if (!nextTier) return 100;
    const pointsInCurrentTier = totalPoints - currentTier.minPoints;
    const tierRange = nextTier.minPoints - currentTier.minPoints;
    return Math.min((pointsInCurrentTier / tierRange) * 100, 100);
  }, [totalPoints, currentTier, nextTier]);

  // Points needed for next tier
  const pointsToNextTier = useMemo(() => {
    if (!nextTier) return 0;
    return nextTier.minPoints - totalPoints;
  }, [totalPoints, nextTier]);

  // Format date
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading points...</Text>
      </ScreenContainer>
    );
  }

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
            <Text className="text-2xl font-bold text-foreground">Points & Status</Text>
            <Text className="text-sm text-muted mt-1">Earn points to unlock benefits</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Current Status Card */}
        <View
          className="rounded-2xl p-6 mb-6"
          style={{ backgroundColor: `${currentTier.color}20` }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-sm text-muted">Current Status</Text>
              <Text
                className="text-3xl font-bold"
                style={{ color: currentTier.color }}
              >
                {currentTier.name}
              </Text>
            </View>
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: currentTier.color }}
            >
              <IconSymbol name="star.fill" size={32} color="#fff" />
            </View>
          </View>

          {/* Total Points */}
          <View className="bg-background/50 rounded-xl p-4 mb-4">
            <Text className="text-sm text-muted">Total Points</Text>
            <Text className="text-4xl font-bold text-foreground">
              {totalPoints.toLocaleString()}
            </Text>
          </View>

          {/* Progress to Next Tier */}
          {nextTier && (
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-sm text-foreground">
                  Progress to {nextTier.name}
                </Text>
                <Text className="text-sm font-semibold text-foreground">
                  {pointsToNextTier.toLocaleString()} pts to go
                </Text>
              </View>
              <View className="h-3 bg-background/50 rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${progressToNextTier}%`,
                    backgroundColor: nextTier.color,
                  }}
                />
              </View>
            </View>
          )}

          {/* View All Tiers */}
          <TouchableOpacity
            onPress={() => setShowTiersModal(true)}
            className="mt-4 py-2"
          >
            <Text className="text-center text-primary font-medium">
              View All Status Tiers →
            </Text>
          </TouchableOpacity>
        </View>

        {/* How to Earn Points */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            How to Earn Points
          </Text>
          <View className="bg-surface rounded-xl border border-border divide-y divide-border">
            {POINT_ACTIVITIES.map((item, index) => (
              <View key={index} className="flex-row items-center justify-between p-4">
                <Text className="text-foreground">{item.activity}</Text>
                <View className="flex-row items-center">
                  <Text className="text-primary font-bold">+{item.points}</Text>
                  <Text className="text-muted ml-1">pts</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Current Benefits */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Your Benefits
          </Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            {currentTier.benefits.map((benefit, index) => (
              <View key={index} className="flex-row items-center py-2">
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                <Text className="text-foreground ml-3">{benefit}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Points History */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Recent Activity
          </Text>
          {history.length === 0 ? (
            <View className="bg-surface rounded-xl border border-border p-6 items-center">
              <IconSymbol name="clock.fill" size={32} color={colors.muted} />
              <Text className="text-muted mt-2">No activity yet</Text>
              <Text className="text-muted text-sm text-center mt-1">
                Complete sessions and grow your client base to earn points
              </Text>
            </View>
          ) : (
            <View className="bg-surface rounded-xl border border-border divide-y divide-border">
              {history.map((item) => (
                <View key={item.id} className="p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-foreground font-medium">{item.activity}</Text>
                      {item.clientName && (
                        <Text className="text-sm text-muted">{item.clientName}</Text>
                      )}
                      <Text className="text-xs text-muted mt-1">{formatDate(item.date)}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <Text className="text-success font-bold">+{item.points}</Text>
                      <Text className="text-muted ml-1">pts</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>

      {/* Status Tiers Modal */}
      <Modal
        visible={showTiersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTiersModal(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          onPress={() => setShowTiersModal(false)}
          style={{ backgroundColor: overlayColor }}
        >
          <View className="bg-background rounded-t-3xl max-h-[85%]">
            <ScrollView>
              <View className="p-6">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-xl font-bold text-foreground">Status Tiers</Text>
                  <TouchableOpacity onPress={() => setShowTiersModal(false)}>
                    <IconSymbol name="xmark" size={24} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                {/* Tiers */}
                {STATUS_TIERS.map((tier, index) => {
                  const isCurrentTier = tier.name === currentTier.name;
                  const isUnlocked = totalPoints >= tier.minPoints;

                  return (
                    <View
                      key={tier.name}
                      className={`rounded-xl p-4 mb-4 border ${
                        isCurrentTier ? "border-2" : "border"
                      }`}
                      style={{
                        borderColor: isCurrentTier ? tier.color : colors.border,
                        backgroundColor: isCurrentTier ? `${tier.color}10` : colors.surface,
                      }}
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center">
                          <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: tier.color }}
                          >
                            <IconSymbol name="star.fill" size={20} color="#fff" />
                          </View>
                          <View className="ml-3">
                            <Text
                              className="text-lg font-bold"
                              style={{ color: tier.color }}
                            >
                              {tier.name}
                            </Text>
                            <Text className="text-sm text-muted">
                              {tier.maxPoints === Infinity
                                ? `${tier.minPoints.toLocaleString()}+ pts`
                                : `${tier.minPoints.toLocaleString()} - ${tier.maxPoints.toLocaleString()} pts`}
                            </Text>
                          </View>
                        </View>
                        {isCurrentTier && (
                          <View className="bg-primary px-3 py-1 rounded-full">
                            <Text className="text-white text-xs font-semibold">Current</Text>
                          </View>
                        )}
                      </View>

                      <View className="pl-13">
                        {tier.benefits.map((benefit, benefitIndex) => (
                          <View key={benefitIndex} className="flex-row items-center py-1">
                            <IconSymbol
                              name="checkmark"
                              size={16}
                              color={isUnlocked ? colors.primary : colors.muted}
                            />
                            <Text
                              className={`ml-2 ${
                                isUnlocked ? "text-foreground" : "text-muted"
                              }`}
                            >
                              {benefit}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setShowTiersModal(false)}
                  className="bg-primary py-4 rounded-xl items-center mt-2"
                >
                  <Text className="text-white font-semibold">Got it</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
