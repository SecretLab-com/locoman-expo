import { BulkInviteModal } from "@/components/bulk-invite-modal";
import { EmptyStateCard } from "@/components/empty-state-card";
import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { FAB } from "@/components/ui/fab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const showAlert = (title: string, message: string) => {
  Alert.alert(title, message);
};

const copyToClipboard = async (text: string) => {
  try {
    if (Platform.OS === "web" && navigator?.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const Clipboard = require("expo-clipboard");
    await Clipboard.setStringAsync(text);
  } catch {
    if (Platform.OS === "web") {
      window.prompt("Copy this link:", text);
    }
  }
};

type Client = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  photoUrl?: string | null;
  activeBundles: number;
  totalSpent: number;
  lastActive?: string | null;
  status: string;
  currentBundle?: {
    sessionsUsed: number;
    sessionsIncluded: number;
    productsUsed: number;
    productsIncluded: number;
    sessionsProgressPct: number;
    productsProgressPct: number;
    alerts: string[];
    bundleTitle?: string;
  } | null;
};

type ClientListRow =
  | { type: "no_results" }
  | { type: "header"; title: string; section: "active" | "inactive" | "hidden" }
  | { type: "client"; data: Client };

function toProgressPercent(used: number, included: number) {
  if (!included || included <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / included) * 100)));
}

function getInitials(name?: string | null) {
  const parts = String(name || "Client")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function ClientAvatar({ uri, name }: { uri?: string | null; name?: string | null }) {
  const colors = useColors();
  const [hasError, setHasError] = useState(false);
  const normalizedUri = useMemo(() => normalizeAssetUrl(uri), [uri]);
  const hasImage = typeof normalizedUri === "string" && normalizedUri.trim().length > 0 && !hasError;

  useEffect(() => {
    setHasError(false);
  }, [normalizedUri]);

  return (
    <View
      className="w-14 h-14 rounded-full overflow-hidden items-center justify-center border"
      style={{ borderColor: "rgba(96,165,250,0.35)" }}
    >
      {hasImage ? (
        <Image
          source={{ uri: normalizedUri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <View
          className="w-14 h-14 rounded-full items-center justify-center"
          style={{ backgroundColor: "rgba(96,165,250,0.22)" }}
        >
          <Text className="text-sm font-bold" style={{ color: colors.primary }}>
            {getInitials(name)}
          </Text>
        </View>
      )}
    </View>
  );
}

function ClientCard({
  client,
  onPress,
  onStartPlan,
  onRequestPayment,
  onUnhideClient,
}: {
  client: Client;
  onPress: () => void;
  onStartPlan: () => void;
  onRequestPayment: () => void;
  onUnhideClient?: () => void;
}) {
  const colors = useColors();
  const bundleProgress = client.currentBundle || null;
  const isHidden = (client.status || "") === "hidden";
  const sessionsProgress = toProgressPercent(
    Number(bundleProgress?.sessionsUsed || 0),
    Number(bundleProgress?.sessionsIncluded || 0),
  );
  const productsProgress = toProgressPercent(
    Number(bundleProgress?.productsUsed || 0),
    Number(bundleProgress?.productsIncluded || 0),
  );

  return (
    <View className="bg-surface rounded-xl mb-3 border border-border overflow-hidden">
      <TouchableOpacity
        className="p-4"
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Open ${client.name} details`}
        testID={`trainer-client-${client.id}`}
      >
        <View className="flex-row items-center">
          <ClientAvatar uri={client.avatar || client.photoUrl} name={client.name} />
          <View className="flex-1 ml-4">
            <View className="flex-row items-center">
              <Text className="text-base font-semibold text-foreground">{client.name}</Text>
              <View
                className={`w-2 h-2 rounded-full ml-2 ${
                  client.status === "active" ? "bg-success" : isHidden ? "bg-warning" : "bg-muted"
                }`}
              />
            </View>
            <Text className="text-sm text-muted mt-0.5">{client.email}</Text>
            <View className="flex-row items-center mt-2">
              <View className="flex-row items-center mr-4">
                <IconSymbol name="bag.fill" size={14} color={colors.primary} />
                <Text className="text-sm text-muted ml-1">{client.activeBundles} bundles</Text>
              </View>
              <View className="flex-row items-center">
                <IconSymbol name="dollarsign.circle.fill" size={14} color={colors.success} />
                <Text className="text-sm text-muted ml-1">${Number(client.totalSpent || 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={20} color={colors.muted} />
        </View>
        {bundleProgress ? (
          <View className="mt-3">
            <Text className="text-xs font-semibold text-foreground mb-1.5" numberOfLines={1}>
              {bundleProgress.bundleTitle || "Current bundle"}
            </Text>
            <Text className="text-xs text-muted">
              Sessions: {bundleProgress.sessionsUsed}/{bundleProgress.sessionsIncluded || 0}
            </Text>
            <View className="h-1.5 rounded-full mt-1.5 mb-2" style={{ backgroundColor: colors.surface }}>
              <View
                className="h-full rounded-full"
                style={{
                  width: `${sessionsProgress}%`,
                  backgroundColor: sessionsProgress >= 80 ? colors.warning : colors.primary,
                }}
              />
            </View>
            <Text className="text-xs text-muted">
              Products: {bundleProgress.productsUsed}/{bundleProgress.productsIncluded || 0}
            </Text>
            <View className="h-1.5 rounded-full mt-1.5" style={{ backgroundColor: colors.surface }}>
              <View
                className="h-full rounded-full"
                style={{
                  width: `${productsProgress}%`,
                  backgroundColor: productsProgress >= 80 ? colors.warning : colors.success,
                }}
              />
            </View>
            {Array.isArray(bundleProgress.alerts) && bundleProgress.alerts.length > 0 ? (
              <Text className="text-[11px] mt-2" style={{ color: colors.warning }} numberOfLines={1}>
                {bundleProgress.alerts[0]}
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="mt-3">
            <Text className="text-xs text-warning">No active bundle. Create a plan or invite this client.</Text>
          </View>
        )}
      </TouchableOpacity>
      {isHidden ? (
        <View className="border-t border-border">
          <TouchableOpacity
            className="flex-row items-center justify-center py-2.5"
            onPress={onUnhideClient}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Show ${client.name} in client list again`}
            testID={`trainer-client-unhide-${client.id}`}
          >
            <IconSymbol name="eye.fill" size={14} color={colors.primary} />
            <Text className="text-primary font-medium text-sm ml-1.5">Show in list again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View className="flex-row border-t border-border">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center py-2.5 border-r border-border"
              onPress={onStartPlan}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Create a custom plan for ${client.name}`}
              testID={`trainer-client-create-plan-${client.id}`}
            >
              <IconSymbol name="bag.fill" size={14} color={colors.primary} />
              <Text className="text-primary font-medium text-sm ml-1.5">Create Offer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center py-2.5"
              onPress={onRequestPayment}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Request payment from ${client.name}`}
              testID={`trainer-client-pay-${client.id}`}
            >
              <IconSymbol name="creditcard.fill" size={14} color={colors.primary} />
              <Text className="text-primary font-medium text-sm ml-1.5">Request Payment</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

export default function TrainerClientsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { effectiveUser } = useAuthContext();
  const { items, proposalContext, clearCart } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [inactiveSectionCollapsed, setInactiveSectionCollapsed] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payClientName, setPayClientName] = useState("");
  const [payClientId, setPayClientId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDescription, setPayDescription] = useState("");
  const [payLinkResult, setPayLinkResult] = useState<string | null>(null);
  /** Bottom sheet: safe area + standard screen gutter (matches ~p-4 horizontal rhythm). */
  const requestPaymentSheetPaddingBottom = Math.max(insets.bottom, 20) + 16;

  // Fetch real clients from tRPC
  const utils = trpc.useUtils();
  const { data: clientsData, isLoading, refetch, isRefetching } = trpc.clients.list.useQuery();
  const bulkInviteMutation = trpc.clients.bulkInvite.useMutation();
  const updateClientMutation = trpc.clients.update.useMutation({
    onSuccess: async () => {
      await utils.clients.list.invalidate();
    },
    onError: (err) => showAlert("Update failed", err.message),
  });

  const createPayLink = trpc.payments.createLink.useMutation({
    onSuccess: (data) => {
      setPayAmount("");
      setPayDescription("");
      setPayLinkResult(data.linkUrl);
    },
    onError: (err) => {
      showAlert("Payment Error", err.message);
    },
  });

  const handleOpenPayModal = (client: any) => {
    setPayClientName(client.name);
    setPayClientId(client.id);
    setPayAmount("");
    setPayDescription("");
    setPayLinkResult(null);
    setPayModalOpen(true);
  };

  /** Same entry as client detail "Send offer": invite screen with Simple / Custom / Do this later. */
  const openInviteOfferChoice = (client: Pick<Client, "id" | "name" | "email" | "phone">) => {
    const clientId = String(client.id || "");
    if (!clientId) return;
    const name =
      (client.name || "").trim() ||
      (typeof client.email === "string" ? client.email.trim() : "") ||
      "Client";
    router.push({
      pathname: "/(trainer)/invite",
      params: {
        clientId,
        clientName: name,
        clientEmail: client.email || "",
        clientPhone: client.phone || "",
        toOfferChoice: "1",
      },
    } as any);
  };

  const handleStartPlan = (client: Pick<Client, "id" | "name" | "email" | "phone">) => {
    const clientId = String(client.id || "");
    const existingClientId = proposalContext?.clientRecordId
      ? String(proposalContext.clientRecordId)
      : "";
    const hasConflictingCart =
      items.length > 0 && (!existingClientId || existingClientId !== clientId);

    if (!hasConflictingCart) {
      openInviteOfferChoice(client);
      return;
    }

    const currentClientLabel = proposalContext?.clientName || "another client";
    Alert.alert(
      "Start new plan?",
      `You already have a plan in progress for ${currentClientLabel}. Starting one for ${client.name || "this client"} will clear the current plan.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create New",
          style: "destructive",
          onPress: () => {
            clearCart();
            openInviteOfferChoice(client);
          },
        },
      ],
    );
  };

  const handleSubmitPayment = async () => {
    await haptics.light();
    const amountFloat = parseFloat(payAmount);
    if (!amountFloat || amountFloat <= 0) {
      showAlert("Invalid Amount", "Please enter a valid amount.");
      return;
    }
    createPayLink.mutate({
      amountMinor: Math.round(amountFloat * 100),
      description: payDescription || `Payment from ${payClientName}`,
      payerId: payClientId || undefined,
    });
  };

  const clients = clientsData || [];

  const visibleCount = clients.filter((c) => (c.status || "") !== "hidden").length;
  const hiddenCount = clients.length - visibleCount;

  const handleUnhideClient = (client: Client) => {
    updateClientMutation.mutate({ id: client.id, status: "inactive" });
  };

  const clientListRows: ClientListRow[] = useMemo(() => {
    const list = clientsData || [];
    if (list.length === 0) {
      return [];
    }
    const q = searchQuery.trim().toLowerCase();
    const filtered = list.filter(
      (client) =>
        client.name.toLowerCase().includes(q) ||
        (client.email && client.email.toLowerCase().includes(q)),
    );
    if (filtered.length === 0 && q) {
      return [{ type: "no_results" as const }];
    }
    const active = filtered.filter((c) => c.status === "active");
    const inactive = filtered.filter((c) => {
      const s = c.status || "";
      return s !== "active" && s !== "hidden";
    });
    const hidden = filtered.filter((c) => (c.status || "") === "hidden");
    return [
      { type: "header" as const, title: `Active (${active.length})`, section: "active" as const },
      ...active.map((c) => ({ type: "client" as const, data: c as Client })),
      { type: "header" as const, title: `Inactive (${inactive.length})`, section: "inactive" as const },
      ...(inactiveSectionCollapsed ? [] : inactive.map((c) => ({ type: "client" as const, data: c as Client }))),
      { type: "header" as const, title: `Hidden (${hidden.length})`, section: "hidden" as const },
      ...hidden.map((c) => ({ type: "client" as const, data: c as Client })),
    ];
  }, [clientsData, searchQuery, inactiveSectionCollapsed]);

  const onRefresh = async () => {
    await refetch();
  };

  const handleClientPress = (client: Pick<Client, "id">) => {
    router.push(`/client-detail/${client.id}` as any);
  };

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer edges={["left", "right"]}>
      {/* Navigation Header */}
      <NavigationHeader
        title="Clients"
        subtitle={
          hiddenCount > 0
            ? `${visibleCount} visible · ${hiddenCount} hidden`
            : `${clients.length} total clients`
        }
        showBack={false}
      />

      {/* Content */}
      <View className="px-4 pb-4">

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3 mt-4">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-foreground"
            placeholder="Search clients..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          className="flex-row items-center self-start mt-3 py-2 px-3 rounded-xl border border-border bg-surface"
          onPress={() => {
            void haptics.light();
            setShowBulkInvite(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Bulk invite"
          testID="bulk-invite"
        >
          <IconSymbol name="person.badge.plus" size={18} color={colors.primary} />
          <Text className="text-primary font-semibold text-sm ml-2">Bulk invite</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center py-20">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
      <FlatList<ClientListRow>
        data={clientListRows}
        keyExtractor={(item) => {
          if (item.type === "header") return `header-${item.section}`;
          if (item.type === "no_results") return "no-results";
          return `client-${item.data.id}`;
        }}
        renderItem={({ item }) => {
          if (item.type === "no_results") {
            return (
              <View className="px-4 py-12">
                <Text className="text-muted text-center text-sm">No clients match your search.</Text>
              </View>
            );
          }
          if (item.type === "header") {
            if (item.section === "inactive") {
              return (
                <TouchableOpacity
                  className="flex-row items-center justify-between px-4 py-2 mt-2"
                  activeOpacity={0.7}
                  onPress={() => setInactiveSectionCollapsed((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    inactiveSectionCollapsed
                      ? "Inactive clients, collapsed. Tap to expand."
                      : "Inactive clients, expanded. Tap to collapse."
                  }
                  accessibilityState={{ expanded: !inactiveSectionCollapsed }}
                  testID="trainer-clients-inactive-header"
                >
                  <Text className="text-sm font-semibold text-muted uppercase">{item.title}</Text>
                  <IconSymbol
                    name={inactiveSectionCollapsed ? "chevron.right" : "chevron.down"}
                    size={14}
                    color={colors.muted}
                  />
                </TouchableOpacity>
              );
            }
            return (
              <Text className="text-sm font-semibold text-muted uppercase px-4 py-2 mt-2">{item.title}</Text>
            );
          }
          const rowClient = item.data;
          return (
            <View className="px-4">
              <ClientCard
                client={rowClient}
                onPress={() => handleClientPress(rowClient)}
                onStartPlan={() => handleStartPlan(rowClient)}
                onRequestPayment={() => handleOpenPayModal(rowClient)}
                onUnhideClient={
                  rowClient.status === "hidden" ? () => handleUnhideClient(rowClient) : undefined
                }
              />
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="px-4 py-12">
            <EmptyStateCard
              icon="person.2.fill"
              title="No clients yet"
              description="Add a client first. You can send an offer or plan invite right after."
              ctaLabel="Add Client"
              onCtaPress={() => router.push("/(trainer)/invite" as any)}
            />
          </View>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      )}

      {/* Bulk Invite Modal */}
      <BulkInviteModal
        visible={showBulkInvite}
        onClose={() => setShowBulkInvite(false)}
        onSubmit={async (invites) => {
          if (!effectiveUser?.id) return;
          await bulkInviteMutation.mutateAsync({
            invitations: invites.map((invite) => ({
              email: invite.email,
              name: invite.name,
            })),
          });
        }}
      />

      {/* Add client — top-right stack (matches ProfileFAB / site FAB pattern) */}
      <FAB
        icon="plus"
        onPress={() => router.push("/(trainer)/invite" as any)}
        accessibilityLabel="Add client"
        testID="clients-invite-fab"
        style={{
          position: "absolute",
          top: insets.top + 8,
          right: 16,
          zIndex: 1018,
          elevation: 16,
        }}
      />

      {/* Request Payment Modal */}
      <Modal
        visible={payModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => { setPayModalOpen(false); setPayLinkResult(null); }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" }}>
          <Pressable style={{ flex: 1 }} onPress={() => { setPayModalOpen(false); setPayLinkResult(null); }} />
          <SwipeDownSheet
            visible={payModalOpen}
            onClose={() => { setPayModalOpen(false); setPayLinkResult(null); }}
            className="bg-background rounded-t-3xl"
            style={{
              // className on Animated.View doesn't reliably apply on web; use explicit insets (matches px-6 / pt-3).
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: requestPaymentSheetPaddingBottom,
            }}
          >
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-1 pr-3">
                <Text className="text-xl font-bold text-foreground">
                  {payLinkResult ? "Payment Link Ready" : "Request Payment"}
                </Text>
                <Text className="text-sm text-muted mt-1">for {payClientName}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setPayModalOpen(false); setPayLinkResult(null); }}
                className="p-2 rounded-full"
                accessibilityRole="button"
                accessibilityLabel="Close request payment"
                testID="request-payment-close"
              >
                <IconSymbol name="xmark" size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {payLinkResult ? (
              <View>
                <View className="bg-success/10 border border-success/30 rounded-xl p-5 mb-6">
                  <View className="flex-row items-center mb-3">
                    <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                    <Text className="text-success font-semibold ml-2">Payment link created</Text>
                  </View>
                  <Text className="text-foreground text-sm leading-6" selectable>{payLinkResult}</Text>
                </View>
                <View className="flex-row gap-3 mb-6">
                  <TouchableOpacity
                    className="flex-1 bg-primary py-4 px-3 rounded-xl items-center"
                    onPress={async () => { await copyToClipboard(payLinkResult); await haptics.light(); showAlert("Copied", "Payment link copied"); }}
                  >
                    <Text className="text-white font-bold">Copy Link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-surface border border-border py-4 px-3 rounded-xl items-center"
                    onPress={async () => {
                      try {
                        const { Share } = require("react-native");
                        await Share.share({ message: `Hi ${payClientName}, please complete your payment: ${payLinkResult}`, url: payLinkResult });
                      } catch { await copyToClipboard(payLinkResult); }
                    }}
                  >
                    <Text className="text-foreground font-bold">Share</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity className="py-4 items-center" onPress={() => setPayLinkResult(null)}>
                  <Text className="text-primary font-medium">Create Another</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text className="text-sm font-medium text-foreground mb-2">Amount (£)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground text-lg font-bold mb-5"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  value={payAmount}
                  onChangeText={setPayAmount}
                  keyboardType="decimal-pad"
                />
                <Text className="text-sm font-medium text-foreground mb-2">Description (optional)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-4 text-foreground mb-8"
                  placeholder={`e.g. PT session with ${payClientName}`}
                  placeholderTextColor={colors.muted}
                  value={payDescription}
                  onChangeText={setPayDescription}
                />
                <TouchableOpacity
                  className="bg-primary py-4 px-4 rounded-xl items-center"
                  onPress={handleSubmitPayment}
                  disabled={createPayLink.isPending}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Generate payment link"
                  testID="request-payment-generate-link"
                >
                  {createPayLink.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white font-bold text-lg">Generate Payment Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </SwipeDownSheet>
        </View>
      </Modal>
      </ScreenContainer>
    </>
  );
}
