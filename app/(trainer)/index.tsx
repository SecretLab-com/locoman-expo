import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
// expo-clipboard requires Metro restart after install; use fallback for web
const copyToClipboard = async (text: string) => {
  try {
    if (Platform.OS === "web" && navigator?.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const Clipboard = require("expo-clipboard");
    await Clipboard.setStringAsync(text);
  } catch {
    // Fallback: prompt user to copy
    if (Platform.OS === "web") {
      window.prompt("Copy this link:", text);
    }
  }
};
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
type StatCardProps = {
  title: string;
  value: string | number;
  icon: Parameters<typeof IconSymbol>[0]["name"];
  color?: string;
  onPress?: () => void;
};

function StatCard({ title, value, icon, color, onPress }: StatCardProps) {
  const colors = useColors();
  const iconColor = color || colors.primary;

  const content = (
    <View className="rounded-xl overflow-hidden flex-1 min-w-[140px] bg-surface border border-border p-4">
      <View className="flex-row items-center justify-between mb-2">
        <IconSymbol name={icon} size={24} color={iconColor} />
        {onPress && <IconSymbol name="chevron.right" size={16} color={colors.muted} />}
      </View>
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-sm text-muted mt-1">{title}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="flex-1">
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

type QuickActionProps = {
  title: string;
  icon: Parameters<typeof IconSymbol>[0]["name"];
  onPress: () => void;
};

function QuickAction({ title, icon, onPress }: QuickActionProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="rounded-xl overflow-hidden flex-1 mx-1 bg-surface border border-border p-4 items-center"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
        <IconSymbol name={icon} size={24} color={colors.primary} />
      </View>
      <Text className="text-sm font-medium text-foreground text-center">{title}</Text>
    </TouchableOpacity>
  );
}

function ClientAvatar({ uri }: { uri?: string | null }) {
  const colors = useColors();
  const [hasError, setHasError] = useState(false);
  const isValidUri = typeof uri === "string" && uri.trim().length > 0;

  return (
    <View className="w-8 h-8 rounded-full bg-muted/30 overflow-hidden items-center justify-center">
      {isValidUri && !hasError ? (
        <Image
          source={{ uri }}
          className="w-8 h-8 rounded-full"
          contentFit="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <IconSymbol name="person.fill" size={14} color={colors.muted} />
      )}
    </View>
  );
}

function TrendingItemImage({ uri }: { uri?: string | null }) {
  const colors = useColors();
  const [hasError, setHasError] = useState(false);
  const isValidUri = typeof uri === "string" && uri.trim().length > 0;

  return (
    <View className="w-12 h-12 rounded-xl bg-muted/30 overflow-hidden items-center justify-center mr-3">
      {isValidUri && !hasError ? (
        <Image
          source={{ uri }}
          className="w-12 h-12"
          contentFit="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <IconSymbol name="shippingbox.fill" size={18} color={colors.muted} />
      )}
    </View>
  );
}

export default function TrainerDashboardScreen() {
  const colors = useColors();
  const { user, effectiveUser, effectiveRole } = useAuthContext();
  const roleBase =
    effectiveRole === "client"
      ? "/(client)"
      : effectiveRole === "trainer"
        ? "/(trainer)"
        : effectiveRole === "manager"
          ? "/(manager)"
          : effectiveRole === "coordinator"
            ? "/(coordinator)"
            : "/(tabs)";

  // Fetch trainer stats from API
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.trainerDashboard.stats.useQuery();
  const { data: points, refetch: refetchPoints } = trpc.trainerDashboard.points.useQuery();
  const { data: clientsData, refetch: refetchClients } = trpc.clients.list.useQuery();

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"link" | "card">("link");

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const [paymentLinkResult, setPaymentLinkResult] = useState<string | null>(null);

  const createLink = trpc.payments.createLink.useMutation({
    onSuccess: (data) => {
      setPaymentAmount("");
      setPaymentDescription("");
      setPaymentLinkResult(data.linkUrl);
    },
    onError: (err) => {
      console.error("[Payments] createLink error:", err);
      showAlert("Payment Error", err.message);
    },
  });

  const handleCopyLink = async () => {
    if (!paymentLinkResult) return;
    await copyToClipboard(paymentLinkResult);
    await haptics.light();
    showAlert("Copied", "Payment link copied to clipboard");
  };

  const handleShareLink = async () => {
    if (!paymentLinkResult) return;
    try {
      const { Share } = require("react-native");
      await Share.share({
        message: `Please complete your payment: ${paymentLinkResult}`,
        url: paymentLinkResult,
      });
    } catch {
      handleCopyLink();
    }
  };

  const createSession = trpc.payments.createSession.useMutation({
    onSuccess: (_data) => {
      // Card session created — in a full dev build, this would open the Adyen Drop-in
      // For now, fall back to creating a payment link instead
      console.log("[Payments] Session created, falling back to link for Expo Go");
      const amountMinor = Math.round(parseFloat(paymentAmount) * 100);
      createLink.mutate({
        amountMinor,
        description: paymentDescription || undefined,
      });
    },
    onError: (err) => {
      console.error("[Payments] createSession error:", err);
      showAlert("Payment Error", err.message);
    },
  });

  const handleRequestPayment = async () => {
    await haptics.light();
    console.log("[Payments] handleRequestPayment called", { paymentAmount, paymentMethod, paymentDescription });
    const amountFloat = parseFloat(paymentAmount);
    if (!amountFloat || amountFloat <= 0) {
      showAlert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    const amountMinor = Math.round(amountFloat * 100);

    console.log("[Payments] Calling mutation", { paymentMethod, amountMinor });
    if (paymentMethod === "link") {
      createLink.mutate({
        amountMinor,
        description: paymentDescription || undefined,
      });
    } else {
      createSession.mutate({
        amountMinor,
        description: paymentDescription || undefined,
        method: "card",
      });
    }
  };

  const isLoading = statsLoading;
  const isRefetching = false;

  const onRefresh = async () => {
    await Promise.all([
      refetchStats(),
      refetchPoints(),
      refetchClients(),
    ]);
  };

  // Default stats if not loaded
  const displayStats = stats || {
    totalEarnings: 0,
    monthlyEarnings: 0,
    activeClients: 0,
    activeBundles: 0,
    pendingOrders: 0,
    completedDeliveries: 0,
  };

  const displayPoints = points || { totalPoints: 0, statusTier: "Bronze" };
  const statusLabel = displayPoints.statusTier || "Delta";

  const salesByCategory = [
    { label: "Sessions", value: 62 },
    { label: "Products", value: 24 },
    { label: "Bundles", value: 14 },
  ];

  const balanceSnapshot = {
    available: 1925,
    pending: 320,
    lastPayout: "Jan 31",
    nextPayout: "Feb 28",
  };

  const clientPreview = (clientsData || []).slice(0, 5).map(c => ({
    id: c.id.toString(),
    name: c.name.split(' ')[0],
    tag: c.status === 'active' ? 'Active' : 'Pending',
    photoUrl: c.photoUrl
  }));

  const servicesPreview = ["1:1 PT Sessions", "Group Training", "Online Coaching", "Assessments"];

  const trendingItems = [
    {
      id: "t1",
      title: "Hyrox Recovery Bundle",
      subtitle: "Top seller this week",
      imageUrl: "https://images.unsplash.com/photo-1549576490-b0b4831ef60a?w=400",
    },
    {
      id: "t2",
      title: "Performance Protein Stack",
      subtitle: "+300 pts per sale",
      imageUrl: "https://images.unsplash.com/photo-1514996937319-344454492b37?w=400",
    },
  ];

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading dashboard...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
            <Text className="text-sm text-muted">
              Welcome back, {effectiveUser?.name || user?.name || "Trainer"}!
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(trainer)/settings" as any)}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          >
            <IconSymbol name="gearshape.fill" size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* Status & Rewards */}
        <View className="px-4 mb-6">
          <TouchableOpacity
            onPress={() => router.push("/(trainer)/points" as any)}
            className="bg-surface border border-border rounded-xl p-4"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-primary items-center justify-center">
                  <IconSymbol name="star.fill" size={20} color="#fff" />
                </View>
                <View className="ml-3">
                  <Text className="text-xs text-muted">Status</Text>
                  <Text className="text-lg font-bold text-foreground">{statusLabel}</Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-xs text-muted">Points this month</Text>
                <Text className="text-lg font-bold text-foreground">
                  {displayPoints.totalPoints.toLocaleString()}
                </Text>
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-xs text-muted mb-2">Progress to next tier</Text>
              <View className="h-2 rounded-full bg-muted/30 overflow-hidden">
                <View className="h-2 rounded-full bg-primary" style={{ width: "80%" }} />
              </View>
              <View className="flex-row items-center justify-between mt-3">
                <Text className="text-xs text-muted">Revenue share</Text>
                <Text className="text-xs font-semibold text-foreground">35%</Text>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text className="text-xs text-muted">Resets in</Text>
                <Text className="text-xs font-semibold text-foreground">12 days</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Revenue Performance Snapshot */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Performance</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/earnings" as any)}>
              <Text className="text-primary font-medium">View analytics</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-muted">Total sold</Text>
              <Text className="text-foreground font-semibold">
                ${displayStats.monthlyEarnings.toLocaleString()}
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-muted">Your earnings</Text>
              <Text className="text-foreground font-semibold">
                ${displayStats.totalEarnings.toLocaleString()}
              </Text>
            </View>
            {salesByCategory.map((item) => (
              <View key={item.label} className="mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm text-muted">{item.label}</Text>
                  <Text className="text-sm font-semibold text-foreground">{item.value}%</Text>
                </View>
                <View className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <View style={{ width: `${item.value}%` }} className="h-2 rounded-full bg-primary" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Sales Performance by Category */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Sales by category</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/earnings" as any)}>
              <Text className="text-primary font-medium">View analytics</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl p-4 border border-border">
            {salesByCategory.map((item) => (
              <View key={item.label} className="mb-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-sm text-muted">{item.label}</Text>
                  <Text className="text-sm font-semibold text-foreground">{item.value}%</Text>
                </View>
                <View className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <View style={{ width: `${item.value}%` }} className="h-2 rounded-full bg-primary" />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Balance & Payouts */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Balance & payouts</Text>
          <View className="bg-surface rounded-xl p-4 border border-border">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-muted">Available</Text>
              <Text className="text-foreground font-semibold">${balanceSnapshot.available}</Text>
            </View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-muted">Pending</Text>
              <Text className="text-foreground font-semibold">${balanceSnapshot.pending}</Text>
            </View>
            <View className="flex-row items-center justify-between pt-2 border-t border-border">
              <Text className="text-muted">Last payout</Text>
              <Text className="text-foreground font-semibold">{balanceSnapshot.lastPayout}</Text>
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="text-muted">Next payout</Text>
              <Text className="text-foreground font-semibold">{balanceSnapshot.nextPayout}</Text>
            </View>
          </View>
        </View>

        {/* Clients */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Clients</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/clients" as any)}>
              <Text className="text-primary font-medium">View all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
            <View className="flex-row gap-3">
              {clientPreview.map((client) => (
                <View
                  key={client.id}
                  className="bg-surface border border-border rounded-xl px-4 py-3 min-w-[120px]"
                >
                  <View className="flex-row items-center gap-2">
                    <ClientAvatar uri={client.photoUrl} />
                    <Text className="text-base font-semibold text-foreground">{client.name}</Text>
                  </View>
                  <Text className="text-xs text-muted mt-2">{client.tag}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* QuickPay */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">QuickPay</Text>
          <View className="bg-surface border border-border rounded-xl p-4">
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-primary rounded-xl py-4 items-center"
                onPress={() => setPaymentModalOpen(true)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Request payment"
                testID="quickpay-request"
              >
                <IconSymbol name="dollarsign.circle.fill" size={28} color="#fff" />
                <Text className="text-white font-semibold mt-2">Request Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-surface border border-border rounded-xl py-4 items-center"
                onPress={() => router.push("/(trainer)/payment-history" as any)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Payment history"
                testID="quickpay-history"
              >
                <IconSymbol name="clock.fill" size={28} color={colors.primary} />
                <Text className="text-foreground font-semibold mt-2">Payment History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
          <View className="flex-row mb-2">
            <QuickAction
              title="Charge Session"
              icon="creditcard.fill"
              onPress={() => router.push("/(trainer)/earnings" as any)}
            />
            <QuickAction
              title="Create Bundle"
              icon="cube.box.fill"
              onPress={() => router.push("/bundle-editor/new" as any)}
            />
            <QuickAction
              title="Create Subscription"
              icon="arrow.triangle.2.circlepath"
              onPress={() => router.push("/(trainer)/subscriptions" as any)}
            />
          </View>
          <View className="flex-row">
            <QuickAction
              title="Manage Sessions"
              icon="calendar"
              onPress={() => router.push("/(trainer)/calendar" as any)}
            />
            <QuickAction
              title="Invite Client"
              icon="person.badge.plus"
              onPress={() => router.push("/(trainer)/invite" as any)}
            />
            <QuickAction
              title="Messages"
              icon="message.fill"
              onPress={() => router.push(`${roleBase}/messages` as any)}
            />
          </View>
        </View>

        {/* Manage My Services */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Manage my services</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/settings" as any)}>
              <Text className="text-primary font-medium">Edit</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl p-4 border border-border">
            {servicesPreview.map((service, index) => (
              <View key={service} className={index === servicesPreview.length - 1 ? "" : "mb-2"}>
                <Text className="text-foreground">{service}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Trending Products, Bundles, Promotions */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Trending</Text>
            <TouchableOpacity onPress={() => router.push("/(trainer)/products" as any)}>
              <Text className="text-primary font-medium">View catalog</Text>
            </TouchableOpacity>
          </View>
          <View className="gap-3">
            {trendingItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                className="bg-surface rounded-xl p-4 border border-border flex-row items-center"
                onPress={() => router.push("/(trainer)/products" as any)}
                activeOpacity={0.8}
              >
                <TrendingItemImage uri={item.imageUrl} />
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">{item.title}</Text>
                  <Text className="text-sm text-muted mt-1">{item.subtitle}</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View className="h-6" />
      </ScrollView>

      {/* Request Payment Modal */}
      <Modal
        visible={paymentModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { setPaymentModalOpen(false); setPaymentLinkResult(null); }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => setPaymentModalOpen(false)} />
          <View
            className="bg-background rounded-t-3xl p-6"
            onStartShouldSetResponder={() => true}
          >
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-foreground">
                {paymentLinkResult ? "Payment Link Ready" : "Request Payment"}
              </Text>
              <TouchableOpacity onPress={() => { setPaymentModalOpen(false); setPaymentLinkResult(null); }}>
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {paymentLinkResult ? (
              <View>
                <View className="bg-success/10 border border-success/30 rounded-xl p-4 mb-4">
                  <View className="flex-row items-center mb-2">
                    <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                    <Text className="text-success font-semibold ml-2">Payment link created</Text>
                  </View>
                  <Text className="text-foreground text-sm" selectable>{paymentLinkResult}</Text>
                </View>

                <View className="flex-row gap-3 mb-4">
                  <TouchableOpacity
                    className="flex-1 bg-primary py-4 rounded-xl items-center"
                    onPress={handleCopyLink}
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-bold">Copy Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-surface border border-border py-4 rounded-xl items-center"
                    onPress={handleShareLink}
                    activeOpacity={0.8}
                  >
                    <Text className="text-foreground font-bold">Share</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  className="py-3 items-center"
                  onPress={() => { setPaymentLinkResult(null); }}
                  activeOpacity={0.8}
                >
                  <Text className="text-primary font-medium">Create Another</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>

            {/* Amount */}
            <Text className="text-sm font-medium text-muted mb-2">Amount (£)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-lg font-bold mb-4"
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              testID="payment-amount"
            />

            {/* Description */}
            <Text className="text-sm font-medium text-muted mb-2">Description (optional)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-4"
              placeholder="e.g. Personal training session"
              placeholderTextColor={colors.muted}
              value={paymentDescription}
              onChangeText={setPaymentDescription}
              testID="payment-description"
            />

            {/* Payment Method */}
            <Text className="text-sm font-medium text-muted mb-2">Payment Method</Text>
            <View className="flex-row gap-3 mb-6">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl items-center border ${
                  paymentMethod === "link" ? "border-primary bg-primary/10" : "border-border bg-surface"
                }`}
                onPress={() => setPaymentMethod("link")}
                accessibilityRole="button"
                accessibilityLabel="QR Code / Link"
                testID="payment-method-link"
              >
                <IconSymbol name="link" size={24} color={paymentMethod === "link" ? colors.primary : colors.muted} />
                <Text className={`text-sm font-medium mt-1 ${paymentMethod === "link" ? "text-primary" : "text-muted"}`}>
                  QR / Link
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl items-center border ${
                  paymentMethod === "card" ? "border-primary bg-primary/10" : "border-border bg-surface"
                }`}
                onPress={() => setPaymentMethod("card")}
                accessibilityRole="button"
                accessibilityLabel="Card payment"
                testID="payment-method-card"
              >
                <IconSymbol name="creditcard.fill" size={24} color={paymentMethod === "card" ? colors.primary : colors.muted} />
                <Text className={`text-sm font-medium mt-1 ${paymentMethod === "card" ? "text-primary" : "text-muted"}`}>
                  Card
                </Text>
              </TouchableOpacity>
            </View>

            {/* Submit */}
            <TouchableOpacity
              className="bg-primary py-4 rounded-xl items-center"
              onPress={handleRequestPayment}
              disabled={createLink.isPending || createSession.isPending}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Send payment request"
              testID="payment-submit"
            >
              {createLink.isPending || createSession.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-lg">
                  {paymentMethod === "link" ? "Generate Payment Link" : "Create Payment Session"}
                </Text>
              )}
            </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
