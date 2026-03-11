import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { withAlpha } from "@/design-system/color-utils";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDesignSystem } from "@/hooks/use-design-system";
import { useColors } from "@/hooks/use-colors";
import { getRoleConversationPath } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired";

type DashboardSubscription = {
  id: string;
  bundleTitle: string;
  trainerName: string;
  price: string;
  cadence: "weekly" | "monthly";
  status: SubscriptionStatus;
  nextBillingDate: Date;
  sessionsIncluded: number;
  sessionsUsed: number;
  checkInsIncluded: number;
  checkInsUsed: number;
};

type DashboardTrainer = {
  id: string;
  name: string | null;
  photoUrl: string | null;
  specialties: string[] | null;
  activeBundles: number;
  isPrimary: boolean;
};

type DashboardPendingRequest = {
  id: string;
  createdAt: Date | string;
  trainer?: {
    id: string;
    name: string | null;
    photoUrl: string | null;
    specialties: string[] | null;
  };
};

function formatDate(value?: Date | string | null) {
  if (!value) return "TBD";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatPrice(value: string, cadence: "weekly" | "monthly") {
  const amount = Number(value || 0);
  const formatted = Number.isNaN(amount) ? "$0" : `$${amount.toFixed(2)}`;
  return `${formatted}/${cadence === "weekly" ? "week" : "month"}`;
}

function formatStatus(status: SubscriptionStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function ProgramMetric({
  icon,
  label,
  value,
  helper,
  tint,
  textColor,
  mutedColor,
}: {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  label: string;
  value: string;
  helper: string;
  tint: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View
      className="flex-1 rounded-2xl border p-3"
      style={{
        backgroundColor: withAlpha(tint, 0.1),
        borderColor: withAlpha(tint, 0.18),
      }}
    >
      <View
        className="w-8 h-8 rounded-full items-center justify-center"
        style={{ backgroundColor: withAlpha(tint, 0.16) }}
      >
        <IconSymbol name={icon} size={16} color={tint} />
      </View>
      <Text className="text-xs mt-3" style={{ color: mutedColor }}>
        {label}
      </Text>
      <Text className="text-lg font-semibold mt-1" style={{ color: textColor }}>
        {value}
      </Text>
      <Text className="text-xs mt-1" style={{ color: mutedColor }}>
        {helper}
      </Text>
    </View>
  );
}

function SectionHeading({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between mb-4">
      <Text className="text-lg font-semibold text-foreground">{title}</Text>
      {actionLabel && onPress ? (
        <TouchableOpacity
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-primary font-medium">{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function ClientDashboardScreen() {
  const colors = useColors();
  const ds = useDesignSystem();
  const colorScheme = useColorScheme();
  const isLight = colorScheme === "light";
  const { user, effectiveRole } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: rawSubscriptions = [],
    refetch: refetchSubscriptions,
    isLoading: subscriptionsLoading,
  } = trpc.subscriptions.mySubscriptions.useQuery();
  const {
    data: myTrainers = [],
    refetch: refetchTrainers,
    isLoading: trainersLoading,
  } = trpc.myTrainers.list.useQuery();
  const {
    data: pendingRequests = [],
    refetch: refetchPendingRequests,
    isLoading: pendingRequestsLoading,
  } = trpc.myTrainers.pendingRequests.useQuery();
  const {
    data: orders = [],
    refetch: refetchOrders,
    isLoading: ordersLoading,
  } = trpc.orders.myOrders.useQuery();
  const {
    data: deliveries = [],
    refetch: refetchDeliveries,
    isLoading: deliveriesLoading,
  } = trpc.deliveries.myDeliveries.useQuery();

  const subscriptions = useMemo<DashboardSubscription[]>(
    () =>
      (rawSubscriptions || []).map((sub: any) => ({
        id: sub.id,
        bundleTitle: sub.bundleTitle || sub.title || "Program",
        trainerName: sub.trainerName || "Your trainer",
        price: sub.price || "0.00",
        cadence: sub.subscriptionType === "weekly" ? "weekly" : "monthly",
        status: (sub.status || "active") as SubscriptionStatus,
        nextBillingDate: sub.nextBillingDate
          ? new Date(sub.nextBillingDate)
          : new Date(Date.now() + 30 * 86400000),
        sessionsIncluded: sub.sessionsIncluded || 0,
        sessionsUsed: sub.sessionsUsed || 0,
        checkInsIncluded: sub.checkInsIncluded || 0,
        checkInsUsed: sub.checkInsUsed || 0,
      })),
    [rawSubscriptions],
  );

  const featuredSubscription = useMemo(
    () =>
      subscriptions.find((subscription) => subscription.status === "active") ||
      subscriptions.find((subscription) => subscription.status === "paused") ||
      subscriptions[0] ||
      null,
    [subscriptions],
  );

  const primaryTrainer = useMemo<DashboardTrainer | null>(() => {
    const sorted = [...(myTrainers as DashboardTrainer[])].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return (b.activeBundles ?? 0) - (a.activeBundles ?? 0);
    });
    return sorted[0] ?? null;
  }, [myTrainers]);

  const featuredPendingRequest = (pendingRequests[0] as DashboardPendingRequest | undefined) ?? null;

  const activeOrders = useMemo(
    () => orders.filter((order) => !["delivered", "cancelled", "refunded"].includes(order.status ?? "")),
    [orders],
  );
  const pendingPaymentOrders = useMemo(
    () => activeOrders.filter((order) => String(order.paymentStatus || "").toLowerCase() !== "paid"),
    [activeOrders],
  );
  const upcomingDeliveries = useMemo(
    () =>
      deliveries
        .filter((delivery) => !["delivered", "confirmed", "cancelled"].includes(delivery.status ?? ""))
        .slice(0, 2),
    [deliveries],
  );

  const sessionsRemaining = featuredSubscription
    ? Math.max(0, featuredSubscription.sessionsIncluded - featuredSubscription.sessionsUsed)
    : 0;
  const checkInsRemaining = featuredSubscription
    ? Math.max(0, featuredSubscription.checkInsIncluded - featuredSubscription.checkInsUsed)
    : 0;

  const trainerSpecialty =
    Array.isArray(primaryTrainer?.specialties) && primaryTrainer.specialties.length > 0
      ? primaryTrainer.specialties[0]
      : "Personal training";
  const pendingSpecialty =
    Array.isArray(featuredPendingRequest?.trainer?.specialties) &&
    featuredPendingRequest?.trainer?.specialties.length
      ? featuredPendingRequest.trainer.specialties[0]
      : "Personal training";

  const heroColors = isLight
    ? ([ds.colors.surface.brand, ds.colors.surface.page, withAlpha(ds.colors.status.success, 0.12)] as const)
    : ([withAlpha(colors.primary, 0.48), ds.raw["surface-alt"], colors.background] as const);
  const heroText = ds.colors.text.primary;
  const heroSubtext = isLight ? "#334155" : "#CBD5E1";
  const heroMuted = ds.colors.text.secondary;
  const metricText = ds.colors.text.primary;
  const metricMuted = isLight ? ds.colors.text.secondary : withAlpha(ds.colors.text.inverse, 0.72);
  const heroChipBackground = isLight ? withAlpha(ds.colors.surface.cardAlt, 0.74) : "rgba(15,23,42,0.36)";
  const heroChipBorder = isLight ? withAlpha(ds.colors.text.secondary, 0.24) : withAlpha(ds.colors.text.inverse, 0.08);

  const openTrainerProfile = (trainerId: string) => {
    router.push(`/trainer/${trainerId}` as any);
  };

  const openTrainerConversation = (trainer: DashboardTrainer) => {
    if (!user?.id) {
      router.push("/login" as any);
      return;
    }
    const conversationId = [String(user.id), String(trainer.id)].sort().join("-");
    router.push({
      pathname: getRoleConversationPath(effectiveRole as any) as any,
      params: {
        id: conversationId,
        participantId: String(trainer.id),
        name: trainer.name || "Trainer",
      },
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSubscriptions(),
      refetchTrainers(),
      refetchPendingRequests(),
      refetchOrders(),
      refetchDeliveries(),
    ]);
    setRefreshing(false);
  };

  const showOverviewLoader =
    !featuredSubscription &&
    !primaryTrainer &&
    !featuredPendingRequest &&
    (subscriptionsLoading || trainersLoading || pendingRequestsLoading);
  const showSupportSection =
    activeOrders.length > 0 ||
    upcomingDeliveries.length > 0 ||
    ordersLoading ||
    deliveriesLoading;
  const showExploreCard = !featuredSubscription;

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View className="px-4 pt-2 pb-5">
          <Text className="text-3xl font-bold text-foreground">Welcome back</Text>
          <Text className="text-sm text-muted mt-1">
            Your program, trainer, and next step in one calm view.
          </Text>
        </View>

        <View className="px-4 mb-6">
          {showOverviewLoader ? (
            <View className="bg-surface rounded-[28px] border border-border p-6 items-center">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-sm text-muted mt-3">Loading your dashboard...</Text>
            </View>
          ) : featuredSubscription ? (
            <LinearGradient
              colors={heroColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 28, overflow: "hidden" }}
            >
              <View className="p-6">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-xs font-semibold uppercase tracking-[1.2px]" style={{ color: heroMuted }}>
                      My Program
                    </Text>
                    <Text className="text-[28px] font-bold mt-2" style={{ color: heroText }}>
                      {featuredSubscription.bundleTitle}
                    </Text>
                    <Text className="text-sm mt-2" style={{ color: heroSubtext }}>
                      With {featuredSubscription.trainerName}. Next billing {formatDate(featuredSubscription.nextBillingDate)}.
                    </Text>
                  </View>
                  <View
                    className="px-3 py-2 rounded-full border"
                    style={{ backgroundColor: heroChipBackground, borderColor: heroChipBorder }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: heroText }}>
                      {formatStatus(featuredSubscription.status)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row mt-5" style={{ gap: 12 }}>
                  <ProgramMetric
                    icon="clock"
                    label={featuredSubscription.sessionsIncluded > 0 ? "Sessions left" : "Program status"}
                    value={
                      featuredSubscription.sessionsIncluded > 0
                        ? `${sessionsRemaining}`
                        : formatStatus(featuredSubscription.status)
                    }
                    helper={
                      featuredSubscription.sessionsIncluded > 0
                        ? `${featuredSubscription.sessionsUsed}/${featuredSubscription.sessionsIncluded} used`
                        : formatPrice(featuredSubscription.price, featuredSubscription.cadence)
                    }
                    tint={colors.primary}
                    textColor={metricText}
                    mutedColor={metricMuted}
                  />
                  <ProgramMetric
                    icon={featuredSubscription.checkInsIncluded > 0 ? "checkmark.circle.fill" : "calendar"}
                    label={featuredSubscription.checkInsIncluded > 0 ? "Check-ins left" : "Next billing"}
                    value={
                      featuredSubscription.checkInsIncluded > 0
                        ? `${checkInsRemaining}`
                        : formatDate(featuredSubscription.nextBillingDate)
                    }
                    helper={
                      featuredSubscription.checkInsIncluded > 0
                        ? `${featuredSubscription.checkInsUsed}/${featuredSubscription.checkInsIncluded} used`
                        : formatPrice(featuredSubscription.price, featuredSubscription.cadence)
                    }
                    tint={colors.success}
                    textColor={metricText}
                    mutedColor={metricMuted}
                  />
                </View>

                <View className="flex-row mt-5" style={{ gap: 12 }}>
                  <TouchableOpacity
                    className="flex-1 rounded-full px-4 py-3 items-center"
                    style={{ backgroundColor: heroText }}
                    onPress={() => router.push("/(client)/subscriptions" as any)}
                    accessibilityRole="button"
                    accessibilityLabel="View my program"
                    testID="client-home-view-program"
                  >
                    <Text className="font-semibold" style={{ color: colors["primary-foreground"] }}>
                      View Program
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 rounded-full px-4 py-3 items-center border"
                    style={{ borderColor: heroChipBorder, backgroundColor: heroChipBackground }}
                    onPress={() => router.push("/my-trainers" as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Open my trainer"
                    testID="client-home-open-trainer"
                  >
                    <Text className="font-semibold" style={{ color: heroText }}>
                      My Trainer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          ) : featuredPendingRequest?.trainer ? (
            <LinearGradient
              colors={heroColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 28, overflow: "hidden" }}
            >
              <View className="p-6">
                <Text className="text-xs font-semibold uppercase tracking-[1.2px]" style={{ color: heroMuted }}>
                  Trainer Request Pending
                </Text>
                <Text className="text-[28px] font-bold mt-2" style={{ color: heroText }}>
                  You are almost set
                </Text>
                <Text className="text-sm mt-2" style={{ color: heroSubtext }}>
                  Your request to work with {featuredPendingRequest.trainer.name || "this trainer"} is still pending.
                  You can shop products and bundles while you wait.
                </Text>
                <View className="flex-row mt-5" style={{ gap: 12 }}>
                  <TouchableOpacity
                    className="flex-1 rounded-full px-4 py-3 items-center"
                    style={{ backgroundColor: heroText }}
                    onPress={() => openTrainerProfile(featuredPendingRequest.trainer!.id)}
                    accessibilityRole="button"
                    accessibilityLabel="View pending trainer profile"
                    testID="client-home-view-pending-trainer"
                  >
                    <Text className="font-semibold" style={{ color: colors["primary-foreground"] }}>
                      View Profile
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 rounded-full px-4 py-3 items-center border"
                    style={{ borderColor: heroChipBorder, backgroundColor: heroChipBackground }}
                    onPress={() => router.push("/(client)/products" as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Browse products"
                    testID="client-home-browse-products"
                  >
                    <Text className="font-semibold" style={{ color: heroText }}>
                      Browse Products
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          ) : primaryTrainer ? (
            <LinearGradient
              colors={heroColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 28, overflow: "hidden" }}
            >
              <View className="p-6">
                <Text className="text-xs font-semibold uppercase tracking-[1.2px]" style={{ color: heroMuted }}>
                  Ready For Your Next Program
                </Text>
                <Text className="text-[28px] font-bold mt-2" style={{ color: heroText }}>
                  Keep moving with {primaryTrainer.name || "your trainer"}
                </Text>
                <Text className="text-sm mt-2" style={{ color: heroSubtext }}>
                  Shop products, trainer bundles, or message your trainer to plan the next step together.
                </Text>
                <View className="flex-row mt-5" style={{ gap: 12 }}>
                  <TouchableOpacity
                    className="flex-1 rounded-full px-4 py-3 items-center"
                    style={{ backgroundColor: heroText }}
                    onPress={() => router.push("/(client)/products" as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Browse products"
                    testID="client-home-browse-products"
                  >
                    <Text className="font-semibold" style={{ color: colors["primary-foreground"] }}>
                      Browse Products
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 rounded-full px-4 py-3 items-center border"
                    style={{ borderColor: heroChipBorder, backgroundColor: heroChipBackground }}
                    onPress={() => openTrainerConversation(primaryTrainer)}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${primaryTrainer.name || "trainer"}`}
                    testID="client-home-message-trainer"
                  >
                    <Text className="font-semibold" style={{ color: heroText }}>
                      Message Trainer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={heroColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 28, overflow: "hidden" }}
            >
              <View className="p-6">
                <Text className="text-xs font-semibold uppercase tracking-[1.2px]" style={{ color: heroMuted }}>
                  Start Here
                </Text>
                <Text className="text-[28px] font-bold mt-2" style={{ color: heroText }}>
                  Find the right trainer first
                </Text>
                <Text className="text-sm mt-2" style={{ color: heroSubtext }}>
                  You can already shop products and trainer bundles here, or connect with a trainer for a guided plan.
                </Text>
                <View className="flex-row mt-5" style={{ gap: 12 }}>
                  <TouchableOpacity
                    className="flex-1 rounded-full px-4 py-3 items-center"
                    style={{ backgroundColor: heroText }}
                    onPress={() => router.push("/my-trainers/find" as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Find a trainer"
                    testID="client-home-find-trainer"
                  >
                    <Text className="font-semibold" style={{ color: colors["primary-foreground"] }}>
                      Find a Trainer
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 rounded-full px-4 py-3 items-center border"
                    style={{ borderColor: heroChipBorder, backgroundColor: heroChipBackground }}
                    onPress={() => router.push("/(client)/products" as any)}
                    accessibilityRole="button"
                    accessibilityLabel="Browse products"
                    testID="client-home-browse-offers"
                  >
                    <Text className="font-semibold" style={{ color: heroText }}>
                      Browse Products
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          )}
        </View>

        {featuredPendingRequest?.trainer ? (
          <View className="px-4 mb-6">
            <SectionHeading
              title="Trainer Request"
              actionLabel="Open My Trainers"
              onPress={() => router.push("/my-trainers" as any)}
            />
            <View className="bg-surface rounded-3xl border border-border p-5">
              <View className="flex-row items-center">
                {featuredPendingRequest.trainer.photoUrl ? (
                  <Image
                    source={{ uri: featuredPendingRequest.trainer.photoUrl }}
                    className="w-16 h-16 rounded-full"
                    contentFit="cover"
                  />
                ) : (
                  <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center">
                    <IconSymbol name="person.fill" size={24} color={colors.primary} />
                  </View>
                )}
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-semibold text-foreground">
                      {featuredPendingRequest.trainer.name || "Trainer"}
                    </Text>
                    <View className="ml-2 px-2 py-1 rounded-full bg-warning/15">
                      <Text className="text-[11px] font-semibold text-warning">Pending</Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted mt-1">{pendingSpecialty}</Text>
                  <Text className="text-xs text-muted mt-2">
                    Requested {formatDate(featuredPendingRequest.createdAt)}
                  </Text>
                </View>
              </View>
              <View className="flex-row mt-5" style={{ gap: 12 }}>
                <TouchableOpacity
                  className="flex-1 bg-primary/10 py-3 rounded-full items-center"
                  onPress={() => openTrainerProfile(featuredPendingRequest.trainer!.id)}
                  accessibilityRole="button"
                  accessibilityLabel="View requested trainer profile"
                  testID="client-pending-profile"
                >
                  <Text className="text-primary font-semibold">View Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-3 rounded-full items-center"
                  onPress={() => router.push("/my-trainers" as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Open my trainers"
                  testID="client-pending-open-trainers"
                >
                  <Text className="text-foreground font-semibold">Open My Trainers</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : primaryTrainer ? (
          <View className="px-4 mb-6">
            <SectionHeading
              title="My Trainer"
              actionLabel="Open My Trainers"
              onPress={() => router.push("/my-trainers" as any)}
            />
            <View className="bg-surface rounded-3xl border border-border p-5">
              <View className="flex-row items-center">
                {primaryTrainer.photoUrl ? (
                  <Image
                    source={{ uri: primaryTrainer.photoUrl }}
                    className="w-16 h-16 rounded-full"
                    contentFit="cover"
                  />
                ) : (
                  <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center">
                    <IconSymbol name="person.fill" size={24} color={colors.primary} />
                  </View>
                )}
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-semibold text-foreground">
                      {primaryTrainer.name || "Trainer"}
                    </Text>
                    {primaryTrainer.isPrimary ? (
                      <View className="ml-2 px-2 py-1 rounded-full bg-primary/10">
                        <Text className="text-[11px] font-semibold text-primary">Primary</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="text-sm text-muted mt-1">{trainerSpecialty}</Text>
                  <Text className="text-xs text-muted mt-2">
                    {primaryTrainer.activeBundles} active {primaryTrainer.activeBundles === 1 ? "program" : "programs"}
                  </Text>
                </View>
              </View>
              <View className="flex-row mt-5" style={{ gap: 12 }}>
                <TouchableOpacity
                  className="flex-1 bg-primary/10 py-3 rounded-full items-center"
                  onPress={() => openTrainerConversation(primaryTrainer)}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${primaryTrainer.name || "trainer"}`}
                  testID="client-home-trainer-message"
                >
                  <Text className="text-primary font-semibold">Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-3 rounded-full items-center"
                  onPress={() => openTrainerProfile(primaryTrainer.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${primaryTrainer.name || "trainer"} profile`}
                  testID="client-home-trainer-profile"
                >
                  <Text className="text-foreground font-semibold">View Profile</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {showSupportSection ? (
          <View className="px-4 mb-6">
            <SectionHeading title="Orders & Deliveries" />
            <View className="flex-row" style={{ gap: 12 }}>
              <TouchableOpacity
                className="flex-1 bg-surface rounded-3xl border border-border p-5"
                onPress={() => router.push("/(client)/orders" as any)}
                accessibilityRole="button"
                accessibilityLabel="Open orders"
                testID="client-home-orders-card"
              >
                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                  <IconSymbol name="bag.fill" size={18} color={colors.primary} />
                </View>
                <Text className="text-base font-semibold text-foreground mt-4">Orders</Text>
                {ordersLoading ? (
                  <Text className="text-sm text-muted mt-2">Loading...</Text>
                ) : (
                  <>
                    <Text className="text-3xl font-bold text-foreground mt-2">{activeOrders.length}</Text>
                    <Text className="text-sm text-muted mt-1">
                      {pendingPaymentOrders.length > 0
                        ? `${pendingPaymentOrders.length} payment${pendingPaymentOrders.length === 1 ? "" : "s"} waiting`
                        : activeOrders.length > 0
                          ? "Active orders in progress"
                          : "No active orders"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-surface rounded-3xl border border-border p-5"
                onPress={() => router.push("/(client)/deliveries" as any)}
                accessibilityRole="button"
                accessibilityLabel="Open deliveries"
                testID="client-home-deliveries-card"
              >
                <View className="w-10 h-10 rounded-full bg-success/10 items-center justify-center">
                  <IconSymbol name="shippingbox.fill" size={18} color={colors.success} />
                </View>
                <Text className="text-base font-semibold text-foreground mt-4">Deliveries</Text>
                {deliveriesLoading ? (
                  <Text className="text-sm text-muted mt-2">Loading...</Text>
                ) : (
                  <>
                    <Text className="text-3xl font-bold text-foreground mt-2">{upcomingDeliveries.length}</Text>
                    <Text className="text-sm text-muted mt-1">
                      {upcomingDeliveries.length > 0
                        ? `Next ${formatDate(
                            upcomingDeliveries[0]?.scheduledDate ||
                              upcomingDeliveries[0]?.deliveredAt ||
                              upcomingDeliveries[0]?.createdAt,
                          )}`
                        : "Nothing scheduled right now"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {showExploreCard ? (
          <View className="px-4">
            <SectionHeading title="Next Step" />
            <View className="bg-surface rounded-3xl border border-border p-5">
              <View className="flex-row items-start">
                <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                  <IconSymbol name={primaryTrainer ? "sparkles" : "magnifyingglass"} size={22} color={colors.primary} />
                </View>
                <View className="flex-1 ml-4">
                  <Text className="text-base font-semibold text-foreground">
                    {primaryTrainer ? "Shop products or your next bundle" : "Connect with the right trainer"}
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    {primaryTrainer
                      ? "Shop products, categories, or trainer bundles whenever you are ready."
                      : "Start with a trainer first, then explore offers that fit your goals."}
                  </Text>
                </View>
              </View>
              <View className="flex-row mt-5" style={{ gap: 12 }}>
                <TouchableOpacity
                  className="flex-1 bg-primary py-3 rounded-full items-center"
                  onPress={() => router.push((primaryTrainer ? "/(client)/products" : "/my-trainers/find") as any)}
                  accessibilityRole="button"
                  accessibilityLabel={primaryTrainer ? "Browse products" : "Find a trainer"}
                  testID="client-home-next-step-primary"
                >
                  <Text className="text-background font-semibold">
                    {primaryTrainer ? "Browse Products" : "Find a Trainer"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-3 rounded-full items-center"
                  onPress={() => router.push((primaryTrainer ? `/trainer/${primaryTrainer.id}` : "/(client)/products") as any)}
                  accessibilityRole="button"
                  accessibilityLabel={primaryTrainer ? "View trainer profile" : "Browse products"}
                  testID="client-home-next-step-secondary"
                >
                  <Text className="text-foreground font-semibold">
                    {primaryTrainer ? "View Trainer" : "Browse Products"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
