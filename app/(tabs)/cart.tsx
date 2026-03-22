import { Image } from "expo-image";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { PlanFlowCancelModal } from "@/components/plan-flow-cancel-modal";
import {
  PlanFlowBackButton,
  PlanFlowCloseButton,
} from "@/components/plan-flow-close-button";
import { PlanStartDateField } from "@/components/plan-start-date-field";
import { PlanTimePreferenceField } from "@/components/plan-time-preference-field";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useCart, type CartItem, type CartProposalContext } from "@/contexts/cart-context";
import { useColors } from "@/hooks/use-colors";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";
import { getTrpcMutationMessage } from "@/lib/trpc-errors";
import {
  buildSavedCartProposalSnapshot,
  cadenceToSessionsPerWeek,
  countPlanEligibleSessions,
  formatTimeHHmm,
  sessionsPerWeekToCadenceCode,
  type ProposalItemInput,
  type SavedCartProposalSnapshot,
} from "@/shared/saved-cart-proposal";

const CART_THUMB_SIZE = 56;
const CART_QTY_BTN = 28;

/** Align with checkout proposal flow — maps persisted snapshot lines into cart shape. */
function mapSnapshotItemToCartItemInput(
  item: SavedCartProposalSnapshot["items"][number],
  trainerName: string,
  trainerId: string | undefined,
): Omit<CartItem, "id"> {
  return {
    type: item.itemType,
    bundleId: item.bundleDraftId || undefined,
    productId: item.productId || undefined,
    customProductId: item.customProductId || undefined,
    title: item.title,
    description: item.description || undefined,
    trainer: trainerName,
    trainerId,
    price: item.unitPrice,
    quantity: item.quantity,
    imageUrl: item.imageUrl || undefined,
    cadence: item.itemType === "bundle" ? "weekly" : "one_time",
    fulfillment:
      (item.fulfillmentMethod as CartItem["fulfillment"]) || "trainer_delivery",
    metadata: item.metadata || null,
  };
}

function CartItemCard({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}) {
  const colors = useColors();
  const [thumbFailed, setThumbFailed] = useState(false);

  const resolvedImageUrl = useMemo(() => {
    const raw = typeof item.imageUrl === "string" ? item.imageUrl.trim() : "";
    if (!raw) return null;
    return normalizeAssetUrl(raw);
  }, [item.imageUrl]);

  useEffect(() => {
    setThumbFailed(false);
  }, [resolvedImageUrl, item.id]);

  const showRemoteThumb = Boolean(resolvedImageUrl) && !thumbFailed;

  const priceSuffix =
    item.cadence && item.cadence !== "one_time" ? `/${item.cadence}` : "";

  return (
    <View className="bg-surface rounded-lg px-3 py-2.5 mb-2 border border-border">
      <View className="flex-row items-start">
        {showRemoteThumb ? (
          <Image
            source={{ uri: resolvedImageUrl as string }}
            style={{
              width: CART_THUMB_SIZE,
              height: CART_THUMB_SIZE,
              borderRadius: 8,
              backgroundColor: colors.surface,
            }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={100}
            onError={() => setThumbFailed(true)}
            accessibilityLabel={`${item.title} image`}
          />
        ) : (
          <View
            className="rounded-lg bg-primary/20 items-center justify-center"
            style={{ width: CART_THUMB_SIZE, height: CART_THUMB_SIZE }}
            accessibilityElementsHidden={false}
            importantForAccessibility="yes"
          >
            <IconSymbol name="bag.fill" size={20} color={colors.primary} />
          </View>
        )}
        <View className="flex-1 ml-2.5 min-w-0">
          <View className="flex-row items-start gap-2">
            <Text className="text-sm font-semibold text-foreground flex-1 min-w-0" numberOfLines={2}>
              {item.title}
            </Text>
            <Text className="text-sm font-bold text-primary shrink-0" numberOfLines={1}>
              £{item.price.toFixed(2)}
              {priceSuffix ? (
                <Text className="text-muted text-xs font-normal">{priceSuffix}</Text>
              ) : null}
            </Text>
          </View>
          {item.description ? (
            <Text className="text-[11px] text-muted mt-0.5 leading-4" numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <Text className="text-[11px] text-muted mt-0.5" numberOfLines={1}>
            {item.trainer || "Trainer"}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-2 pt-2 border-t border-border">
        <View className="flex-row items-center">
          <TouchableOpacity
            className="rounded-full bg-background border border-border items-center justify-center"
            style={{ width: CART_QTY_BTN, height: CART_QTY_BTN }}
            onPress={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
            accessibilityRole="button"
            accessibilityLabel={`Decrease quantity for ${item.title}`}
            testID={`cart-decrease-${item.id}`}
          >
            <IconSymbol name="minus" size={14} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="mx-2.5 min-w-[20px] text-center text-sm text-foreground font-semibold">
            {item.quantity}
          </Text>
          <TouchableOpacity
            className="rounded-full bg-background border border-border items-center justify-center"
            style={{ width: CART_QTY_BTN, height: CART_QTY_BTN }}
            onPress={() => onUpdateQuantity(item.quantity + 1)}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity for ${item.title}`}
            testID={`cart-increase-${item.id}`}
          >
            <IconSymbol name="plus" size={14} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="flex-row items-center py-0.5"
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.title} from cart`}
          testID={`cart-remove-${item.id}`}
        >
          <IconSymbol name="trash.fill" size={16} color={colors.error} />
          <Text className="text-error text-xs ml-1">Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Default invite note when the trainer has not written one yet (includes emoji). */
function buildDefaultInviteNote(clientName: string | null | undefined): string {
  const first =
    clientName?.trim().split(/\s+/).filter(Boolean)[0] ?? "there";
  return `Hi ${first}! 👋 I've put together a personalized training plan for you in the app. Take a look when you have a moment — I'd love to hear what you think so we can get started when you're ready.`;
}

function TrainerProposalBuilder() {
  const colors = useColors();
  const { height: windowHeight } = useWindowDimensions();
  const { effectiveUser } = useAuthContext();
  const {
    items,
    itemCount,
    addItem,
    updateQuantity,
    removeItem,
    replaceItems,
    proposalContext,
    setProposalContext,
    clearCart,
    isLoading: isCartLoading,
  } = useCart();

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showPlanCancelModal, setShowPlanCancelModal] = useState(false);
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showAllProjectedSessionsModal, setShowAllProjectedSessionsModal] = useState(false);
  const [customProductName, setCustomProductName] = useState("");
  const [customProductPrice, setCustomProductPrice] = useState("");
  const [customProductDescription, setCustomProductDescription] = useState("");
  const [serviceTitle, setServiceTitle] = useState("Additional Sessions");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceSessions, setServiceSessions] = useState("1");
  const browseCatalogRoute = "/plan-shop";

  const clientsQuery = trpc.clients.list.useQuery();
  const customProductsQuery = trpc.customProducts.list.useQuery();

  const closeCustomProductModal = () => {
    setShowCustomProductModal(false);
    setCustomProductName("");
    setCustomProductPrice("");
    setCustomProductDescription("");
  };

  const createCustomProductMutation = trpc.customProducts.create.useMutation({
    onSuccess: async (created) => {
      await customProductsQuery.refetch();
      addItem({
        type: "custom_product",
        title: created.name,
        description: created.description || undefined,
        customProductId: created.id,
        trainer: effectiveUser?.name || "Trainer",
        trainerId: effectiveUser?.id,
        price: Number.parseFloat(String(created.price || "0")),
        quantity: 1,
        imageUrl: created.imageUrl || undefined,
        cadence: "one_time",
        fulfillment: created.fulfillmentMethod as CartItem["fulfillment"],
        metadata: null,
      });
      closeCustomProductModal();
    },
  });
  const createProposalMutation = trpc.savedCartProposals.create.useMutation();
  const updateProposalMutation = trpc.savedCartProposals.update.useMutation();
  const sendInviteMutation = trpc.savedCartProposals.sendInvite.useMutation();

  const pathname = usePathname();
  const localParams = useLocalSearchParams<{ proposalId?: string | string[] }>();
  const proposalIdFromUrl = useMemo(() => {
    const raw = localParams.proposalId;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
    return null;
  }, [localParams.proposalId]);

  const hydratedProposalFromUrlRef = useRef<string | null>(null);
  const proposalUrlErrorAlertRef = useRef(false);

  const proposalFromUrlQuery = trpc.savedCartProposals.get.useQuery(
    { id: proposalIdFromUrl! },
    {
      enabled: Boolean(proposalIdFromUrl) && !isCartLoading,
      retry: false,
    },
  );

  useEffect(() => {
    proposalUrlErrorAlertRef.current = false;
  }, [proposalIdFromUrl]);

  useEffect(() => {
    if (!proposalIdFromUrl) {
      hydratedProposalFromUrlRef.current = null;
      return;
    }
    if (isCartLoading) return;
    const row = proposalFromUrlQuery.data;
    if (!row) return;
    if (hydratedProposalFromUrlRef.current === row.id) return;

    hydratedProposalFromUrlRef.current = row.id;
    const snapshot = row.snapshot;
    const trainerName = effectiveUser?.name || "Trainer";
    const trainerId = effectiveUser?.id;

    const cartInputs = snapshot.items.map((item) =>
      mapSnapshotItemToCartItemInput(item, trainerName, trainerId),
    );

    const nextContext: CartProposalContext = {
      proposalId: row.id,
      clientRecordId: row.clientRecordId ?? null,
      clientName: row.clientName ?? null,
      clientEmail: row.clientEmail ?? null,
      startDate: snapshot.startDate ?? row.startDate ?? null,
      cadenceCode: snapshot.cadenceCode,
      sessionsPerWeek: snapshot.sessionsPerWeek,
      timePreference: snapshot.timePreference ?? null,
      programWeeks: snapshot.programWeeks ?? null,
      sessionCost: snapshot.sessionCost ?? null,
      sessionDurationMinutes: snapshot.sessionDurationMinutes ?? null,
      notes: snapshot.notes ?? row.notes ?? null,
      assistantPrompt: row.assistantPrompt ?? null,
    };

    replaceItems(cartInputs, nextContext);
    if (pathname) {
      router.replace(pathname as any);
    }
  }, [
    proposalIdFromUrl,
    isCartLoading,
    proposalFromUrlQuery.data,
    effectiveUser?.name,
    effectiveUser?.id,
    replaceItems,
    pathname,
  ]);

  useEffect(() => {
    if (!proposalIdFromUrl || isCartLoading) return;
    if (!proposalFromUrlQuery.isError) return;
    if (proposalUrlErrorAlertRef.current) return;
    proposalUrlErrorAlertRef.current = true;
    Alert.alert(
      "Could not open plan",
      proposalFromUrlQuery.error?.message ?? "This plan link may be invalid or you may not have access.",
    );
  }, [
    proposalIdFromUrl,
    isCartLoading,
    proposalFromUrlQuery.isError,
    proposalFromUrlQuery.error?.message,
  ]);

  const showLoadingProposalFromUrl =
    Boolean(proposalIdFromUrl) &&
    !isCartLoading &&
    proposalFromUrlQuery.isLoading &&
    !proposalFromUrlQuery.data;

  const selectedClient = useMemo(
    () =>
      (clientsQuery.data || []).find(
        (client) => String(client.id) === String(proposalContext?.clientRecordId || ""),
      ) || null,
    [clientsQuery.data, proposalContext?.clientRecordId],
  );

  const daysPerWeek = useMemo(() => {
    const spw = proposalContext?.sessionsPerWeek;
    if (Number.isFinite(spw) && spw != null && spw > 0) {
      return Math.min(7, Math.max(1, Math.floor(Number(spw))));
    }
    return cadenceToSessionsPerWeek(proposalContext?.cadenceCode);
  }, [proposalContext?.sessionsPerWeek, proposalContext?.cadenceCode]);

  /** Plan was started from Clients / client detail / plan-shop with a specific client — do not allow switching. */
  const clientLockedForPlan = Boolean(proposalContext?.clientRecordId);

  const lockedClientPhotoUrl = normalizeAssetUrl(
    (selectedClient as { photoUrl?: string | null } | null)?.photoUrl,
  );

  const displayClientName =
    proposalContext?.clientName || selectedClient?.name || "Client";
  const displayClientEmail =
    proposalContext?.clientEmail || selectedClient?.email || "";

  const getClientInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "C";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  };

  const proposalItems = useMemo<ProposalItemInput[]>(
    () =>
      items.map((item) => ({
        itemType: item.type,
        title: item.title,
        description: item.description || null,
        bundleDraftId: item.bundleId || null,
        productId: item.productId || null,
        customProductId: item.customProductId || null,
        imageUrl: item.imageUrl || null,
        quantity: item.quantity,
        unitPrice: item.price,
        fulfillmentMethod: item.type === "service" ? null : item.fulfillment,
        metadata: item.metadata || null,
      })),
    [items],
  );

  const previewSnapshot = useMemo(
    () =>
      buildSavedCartProposalSnapshot({
        title:
          proposalContext?.clientName ||
          selectedClient?.name ||
          "Saved Cart",
        notes: proposalContext?.notes || null,
        baseBundleDraftId:
          proposalItems.find((item) => item.itemType === "bundle")?.bundleDraftId || null,
        startDate: proposalContext?.startDate || new Date().toISOString(),
        cadenceCode: proposalContext?.cadenceCode || "weekly",
        sessionsPerWeek:
          proposalContext?.sessionsPerWeek ||
          cadenceToSessionsPerWeek(proposalContext?.cadenceCode || "weekly"),
        timePreference: proposalContext?.timePreference || null,
        programWeeks: proposalContext?.programWeeks ?? null,
        sessionCost: proposalContext?.sessionCost ?? null,
        sessionDurationMinutes: proposalContext?.sessionDurationMinutes ?? null,
        items: proposalItems,
      }),
    [proposalContext, proposalItems, selectedClient],
  );

  const updateProposalField = (patch: Record<string, unknown>) => {
    setProposalContext({
      ...(proposalContext || {}),
      ...patch,
    });
  };

  useEffect(() => {
    if (!proposalContext) return;
    const patch: Record<string, unknown> = {};
    if (proposalContext.startDate == null || proposalContext.startDate === "") {
      patch.startDate = new Date().toISOString();
    }
    if (proposalContext.timePreference == null || proposalContext.timePreference === "") {
      const t = new Date();
      t.setMinutes(0, 0, 0);
      patch.timePreference = formatTimeHHmm(t);
    }
    if (proposalContext.programWeeks == null || proposalContext.programWeeks === undefined) {
      patch.programWeeks = 12;
    }
    if (
      proposalContext.sessionDurationMinutes == null ||
      proposalContext.sessionDurationMinutes === undefined
    ) {
      patch.sessionDurationMinutes = 60;
    }
    // Only when never set — not `""` so clearing the field does not immediately refill.
    if (proposalContext.notes === undefined || proposalContext.notes === null) {
      patch.notes = buildDefaultInviteNote(proposalContext.clientName);
    }
    if (Object.keys(patch).length === 0) return;
    setProposalContext({ ...proposalContext, ...patch });
  }, [proposalContext, setProposalContext]);

  /** Keep a cart service line in sync so sold session count covers programWeeks × sessions/week. */
  useEffect(() => {
    if (!proposalContext) return;
    const programWeeks = proposalContext.programWeeks ?? 12;
    const spwRaw =
      proposalContext.sessionsPerWeek != null && proposalContext.sessionsPerWeek > 0
        ? Math.floor(proposalContext.sessionsPerWeek)
        : cadenceToSessionsPerWeek(proposalContext.cadenceCode || "weekly");
    const spw = Math.min(7, Math.max(1, spwRaw));
    const costRaw = Number(proposalContext.sessionCost);
    const sessionCostNum = Number.isFinite(costRaw) && costRaw >= 0 ? costRaw : 0;

    const required = Math.max(1, Math.floor(programWeeks)) * spw;
    const eligibleProposalItems: ProposalItemInput[] = items
      .filter((i) => !i.metadata?.planSessionTopUp)
      .map((item) => ({
        itemType: item.type,
        title: item.title,
        description: item.description || null,
        bundleDraftId: item.bundleId || null,
        productId: item.productId || null,
        customProductId: item.customProductId || null,
        imageUrl: item.imageUrl || null,
        quantity: item.quantity,
        unitPrice: item.price,
        fulfillmentMethod: item.type === "service" ? null : item.fulfillment,
        metadata: item.metadata || null,
      }));
    const natural = countPlanEligibleSessions(eligibleProposalItems);
    const topUp = Math.max(0, required - natural);

    const curTop = items.find((i) => i.metadata?.planSessionTopUp === true);
    const targetPrice = Number((topUp * sessionCostNum).toFixed(2));

    if (topUp === 0) {
      if (!curTop) return;
      const next = items
        .filter((i) => !i.metadata?.planSessionTopUp)
        .map(({ id: _id, ...rest }) => rest);
      replaceItems(next, proposalContext);
      return;
    }

    if (
      curTop &&
      Number(curTop.metadata?.sessions) === topUp &&
      curTop.price === targetPrice
    ) {
      return;
    }

    const base = items
      .filter((i) => !i.metadata?.planSessionTopUp)
      .map(({ id: _id, ...rest }) => rest);
    const next: Omit<CartItem, "id">[] = [
      ...base,
      {
        type: "service",
        title: "Program sessions (plan coverage)",
        trainer: effectiveUser?.name || "Trainer",
        trainerId: effectiveUser?.id,
        price: targetPrice,
        quantity: 1,
        cadence: "one_time",
        fulfillment: "trainer_delivery",
        metadata: { sessions: topUp, planSessionTopUp: true },
      },
    ];
    replaceItems(next, proposalContext);
  }, [
    items,
    proposalContext,
    replaceItems,
    effectiveUser?.id,
    effectiveUser?.name,
  ]);

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from this plan?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeItem(itemId),
        },
      ],
    );
  };

  const handleSelectClient = (client: any) => {
    updateProposalField({
      clientRecordId: client.id,
      clientName: client.name || "",
      clientEmail: client.email || "",
    });
    setShowClientPicker(false);
  };

  const handleDaysPerWeekDelta = (delta: number) => {
    const raw =
      proposalContext?.sessionsPerWeek != null && proposalContext.sessionsPerWeek > 0
        ? Math.floor(proposalContext.sessionsPerWeek)
        : cadenceToSessionsPerWeek(proposalContext?.cadenceCode);
    const current = Math.min(7, Math.max(1, raw));
    const next = Math.min(7, Math.max(1, current + delta));
    updateProposalField({
      sessionsPerWeek: next,
      cadenceCode: sessionsPerWeekToCadenceCode(next),
    });
  };

  const handleProgramWeeksDelta = (delta: number) => {
    const current = proposalContext?.programWeeks ?? 12;
    const next = Math.min(104, Math.max(1, Math.floor(current) + delta));
    updateProposalField({ programWeeks: next });
  };

  const handleSessionDurationDelta = (delta: number) => {
    const current = proposalContext?.sessionDurationMinutes ?? 60;
    const next = Math.min(240, Math.max(15, Math.floor(current) + delta * 15));
    updateProposalField({ sessionDurationMinutes: next });
  };

  const handleAddExistingCustomProduct = (product: any) => {
    addItem({
      type: "custom_product",
      title: product.name,
      description: product.description || undefined,
      customProductId: product.id,
      trainer: effectiveUser?.name || "Trainer",
      trainerId: effectiveUser?.id,
      price: Number.parseFloat(String(product.price || "0")),
      quantity: 1,
      imageUrl: product.imageUrl || undefined,
      cadence: "one_time",
      fulfillment: product.fulfillmentMethod as CartItem["fulfillment"],
      metadata: null,
    });
    closeCustomProductModal();
  };

  const handleCreateCustomProduct = async () => {
    const parsedPrice = Number.parseFloat(customProductPrice || "0");
    if (!customProductName.trim()) {
      Alert.alert("Product name required", "Enter a custom product name.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      Alert.alert("Valid price required", "Enter a valid custom product price.");
      return;
    }
    await createCustomProductMutation.mutateAsync({
      name: customProductName.trim(),
      description: customProductDescription.trim() || undefined,
      price: parsedPrice.toFixed(2),
    });
  };

  const handleAddService = () => {
    const parsedPrice = Number.parseFloat(servicePrice || "0");
    const parsedSessions = Number.parseInt(serviceSessions || "1", 10);
    if (!serviceTitle.trim()) {
      Alert.alert("Service title required", "Enter a title for the session block.");
      return;
    }
    addItem({
      type: "service",
      title: serviceTitle.trim(),
      trainer: effectiveUser?.name || "Trainer",
      trainerId: effectiveUser?.id,
      price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      quantity: 1,
      cadence: "one_time",
      fulfillment: "trainer_delivery",
      metadata: {
        sessions:
          Number.isFinite(parsedSessions) && parsedSessions > 0
            ? parsedSessions
            : 1,
      },
    });
    setServiceTitle("Additional Sessions");
    setServicePrice("");
    setServiceSessions("1");
    setShowServiceModal(false);
  };

  const buildProposalPayload = () => ({
    clientRecordId: proposalContext?.clientRecordId || undefined,
    title: proposalContext?.clientName || selectedClient?.name || "Saved Cart",
    notes: proposalContext?.notes || undefined,
    startDate: proposalContext?.startDate || new Date().toISOString(),
    cadenceCode: proposalContext?.cadenceCode || "weekly",
    sessionsPerWeek:
      proposalContext?.sessionsPerWeek ||
      cadenceToSessionsPerWeek(proposalContext?.cadenceCode || "weekly"),
    timePreference: proposalContext?.timePreference || undefined,
    programWeeks: proposalContext?.programWeeks ?? 12,
    sessionCost:
      proposalContext?.sessionCost != null && Number.isFinite(proposalContext.sessionCost)
        ? proposalContext.sessionCost
        : undefined,
    sessionDurationMinutes: proposalContext?.sessionDurationMinutes ?? 60,
    baseBundleDraftId:
      proposalItems.find((item) => item.itemType === "bundle")?.bundleDraftId || undefined,
    items: proposalItems.map((item) => ({
      itemType: item.itemType,
      title: item.title,
      description: item.description || undefined,
      bundleDraftId: item.bundleDraftId || undefined,
      productId: item.productId || undefined,
      customProductId: item.customProductId || undefined,
      imageUrl: item.imageUrl || undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      fulfillmentMethod:
        (item.fulfillmentMethod as
          | "home_ship"
          | "trainer_delivery"
          | "vending"
          | "cafeteria"
          | undefined) || undefined,
      metadata: item.metadata || undefined,
    })),
  });

  const persistProposal = async () => {
    if (!proposalContext?.clientRecordId) {
      Alert.alert("Client required", "Select a client before saving this proposal.");
      return null;
    }
    const payload = buildProposalPayload();
    if (proposalContext?.proposalId) {
      const result = await updateProposalMutation.mutateAsync({
        id: proposalContext.proposalId,
        ...payload,
      });
      updateProposalField({ proposalId: result.proposalId });
      return result.proposalId;
    }
    const result = await createProposalMutation.mutateAsync(payload);
    updateProposalField({ proposalId: result.proposalId });
    return result.proposalId;
  };

  const exitPlanReviewDiscard = () => {
    setShowPlanCancelModal(false);
    clearCart();
    router.replace("/(trainer)/clients" as any);
  };

  const handleEditSelections = () => {
    router.replace(`${browseCatalogRoute}?skipIntro=1` as any);
  };

  const handleInviteProposal = async () => {
    try {
      const proposalId = await persistProposal();
      if (!proposalId) return;
      const email = proposalContext?.clientEmail || selectedClient?.email || "";
      if (!email) {
        Alert.alert("Client email required", "The selected client needs an email address.");
        return;
      }
      await sendInviteMutation.mutateAsync({
        proposalId,
        email,
        name: proposalContext?.clientName || selectedClient?.name || "",
        message: proposalContext?.notes || undefined,
      });
      Alert.alert("Plan sent", "The client plan invite has been sent.");
    } catch (error: unknown) {
      Alert.alert(
        "Send failed",
        getTrpcMutationMessage(error, "Unable to send the client plan."),
      );
    }
  };

  return (
    <ScreenContainer className="flex-1">
      {showLoadingProposalFromUrl ? (
        <View
          style={[StyleSheet.absoluteFillObject, { zIndex: 50, backgroundColor: `${colors.background}E6` }]}
          pointerEvents="auto"
          accessibilityLabel="Loading plan from link"
          className="items-center justify-center px-6"
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4 text-center">Loading plan…</Text>
        </View>
      ) : null}
      <View className="flex-1">
        <View className="flex-row items-center px-4 pb-2 pt-2 bg-background border-b border-border">
          <PlanFlowBackButton
            onPress={handleEditSelections}
            accessibilityLabel="Go back to shopping to change plan selections"
            testID="plan-review-edit-selections"
          />
          <View className="flex-1 mx-2">
            <Text className="text-xl font-bold text-foreground text-center">
              Review & Send Plan
            </Text>
            <Text className="text-sm text-muted text-center mt-1">
              Review the items you&apos;ve picked, set the schedule, and send a client-specific plan.
            </Text>
          </View>
          <PlanFlowCloseButton
            onPress={() => setShowPlanCancelModal(true)}
            accessibilityLabel="Cancel plan"
            testID="plan-review-cancel-plan"
          />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        >
        <View className="bg-surface rounded-xl p-4 mb-4 border border-border mt-4">
          <Text className="text-foreground font-semibold mb-3">Client and Schedule</Text>
          {clientLockedForPlan ? (
            <View
              className="border border-border rounded-lg px-4 py-3 flex-row items-center"
              accessible
              accessibilityLabel={`Plan for ${displayClientName}${displayClientEmail ? `, ${displayClientEmail}` : ""}`}
              testID="plan-review-client-locked"
            >
              {lockedClientPhotoUrl ? (
                <Image
                  source={{ uri: lockedClientPhotoUrl }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                  contentFit="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  className="w-11 h-11 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${colors.primary}22` }}
                >
                  <Text className="text-primary text-sm font-bold">
                    {getClientInitials(displayClientName)}
                  </Text>
                </View>
              )}
              <View className="flex-1 ml-3">
                <Text className="text-foreground font-medium">{displayClientName}</Text>
                <Text className="text-xs text-muted mt-1">{displayClientEmail || "No email on file"}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              className="border border-border rounded-lg px-4 py-3 flex-row items-center justify-between"
              onPress={() => setShowClientPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select client for plan"
              testID="plan-review-client-picker"
            >
              <View>
                <Text className="text-foreground font-medium">
                  {proposalContext?.clientName || selectedClient?.name || "Select a client"}
                </Text>
                <Text className="text-xs text-muted mt-1">
                  {proposalContext?.clientEmail || selectedClient?.email || "Required before invite"}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </TouchableOpacity>
          )}

          <View className="mt-4">
            <Text className="text-foreground font-semibold mb-2">Start Date</Text>
            <PlanStartDateField
              valueIso={proposalContext?.startDate}
              onChangeIso={(iso) => updateProposalField({ startDate: iso })}
            />
          </View>

          <View className="mt-4">
            <Text className="text-foreground font-semibold mb-2">Program length</Text>
            <View className="flex-row items-center flex-wrap gap-2">
              <TouchableOpacity
                className={`w-9 h-9 rounded-full border border-border items-center justify-center bg-surface ${
                  (proposalContext?.programWeeks ?? 12) <= 1 ? "opacity-40" : ""
                }`}
                onPress={() => handleProgramWeeksDelta(-1)}
                disabled={(proposalContext?.programWeeks ?? 12) <= 1}
                accessibilityRole="button"
                accessibilityLabel="Decrease program length in weeks"
                testID="plan-program-weeks-minus"
              >
                <IconSymbol name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <Text
                className="text-base font-semibold text-foreground min-w-[28px] text-center tabular-nums"
                accessibilityLabel={`${proposalContext?.programWeeks ?? 12} weeks program length`}
                testID="plan-program-weeks-value"
              >
                {proposalContext?.programWeeks ?? 12}
              </Text>
              <TouchableOpacity
                className={`w-9 h-9 rounded-full border border-border items-center justify-center bg-surface ${
                  (proposalContext?.programWeeks ?? 12) >= 104 ? "opacity-40" : ""
                }`}
                onPress={() => handleProgramWeeksDelta(1)}
                disabled={(proposalContext?.programWeeks ?? 12) >= 104}
                accessibilityRole="button"
                accessibilityLabel="Increase program length in weeks"
                testID="plan-program-weeks-plus"
              >
                <IconSymbol name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-base text-muted flex-1 min-w-[100px]">weeks</Text>
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-foreground font-semibold mb-2">Session cost (each)</Text>
            <View className="flex-row items-center border border-border rounded-lg px-3">
              <Text className="text-foreground text-base font-semibold pr-1" aria-hidden>
                £
              </Text>
              <TextInput
                className="flex-1 py-3 text-foreground min-w-0"
                value={
                  proposalContext?.sessionCost != null &&
                  Number.isFinite(proposalContext.sessionCost)
                    ? String(proposalContext.sessionCost)
                    : ""
                }
                onChangeText={(value) => {
                  const trimmed = value.replace(/£/g, "").trim();
                  if (trimmed === "") {
                    updateProposalField({ sessionCost: null });
                    return;
                  }
                  const n = Number.parseFloat(trimmed);
                  updateProposalField({
                    sessionCost: Number.isFinite(n) && n >= 0 ? n : null,
                  });
                }}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                accessibilityLabel="Session cost per session in pounds"
                testID="plan-session-cost"
              />
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-foreground font-semibold mb-2">Session length</Text>
            <View className="flex-row items-center flex-wrap gap-2">
              <TouchableOpacity
                className={`w-9 h-9 rounded-full border border-border items-center justify-center bg-surface ${
                  (proposalContext?.sessionDurationMinutes ?? 60) <= 15 ? "opacity-40" : ""
                }`}
                onPress={() => handleSessionDurationDelta(-1)}
                disabled={(proposalContext?.sessionDurationMinutes ?? 60) <= 15}
                accessibilityRole="button"
                accessibilityLabel="Decrease session length by 15 minutes"
                testID="plan-session-duration-minus"
              >
                <IconSymbol name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <Text
                className="text-base font-semibold text-foreground min-w-[72px] text-center tabular-nums"
                accessibilityLabel={`Session length ${proposalContext?.sessionDurationMinutes ?? 60} minutes`}
                testID="plan-session-duration-value"
              >
                {(proposalContext?.sessionDurationMinutes ?? 60) % 60 === 0
                  ? `${(proposalContext?.sessionDurationMinutes ?? 60) / 60} hr`
                  : `${proposalContext?.sessionDurationMinutes ?? 60} min`}
              </Text>
              <TouchableOpacity
                className={`w-9 h-9 rounded-full border border-border items-center justify-center bg-surface ${
                  (proposalContext?.sessionDurationMinutes ?? 60) >= 240 ? "opacity-40" : ""
                }`}
                onPress={() => handleSessionDurationDelta(1)}
                disabled={(proposalContext?.sessionDurationMinutes ?? 60) >= 240}
                accessibilityRole="button"
                accessibilityLabel="Increase session length by 15 minutes"
                testID="plan-session-duration-plus"
              >
                <IconSymbol name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-base text-muted flex-1 min-w-[120px]">per session</Text>
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-foreground font-semibold mb-2">Cadence</Text>
            <View className="flex-row items-center flex-wrap gap-2">
              <TouchableOpacity
                className={`w-9 h-9 rounded-full border border-border items-center justify-center bg-surface ${
                  daysPerWeek <= 1 ? "opacity-40" : ""
                }`}
                onPress={() => handleDaysPerWeekDelta(-1)}
                disabled={daysPerWeek <= 1}
                accessibilityRole="button"
                accessibilityLabel="Decrease days per week"
                testID="plan-cadence-minus"
              >
                <IconSymbol name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <Text
                className="text-base font-semibold text-foreground min-w-[28px] text-center tabular-nums"
                accessibilityLabel={`${daysPerWeek} days per week`}
                testID="plan-cadence-value"
              >
                {daysPerWeek}
              </Text>
              <TouchableOpacity
                className={`w-9 h-9 rounded-full border border-border items-center justify-center bg-surface ${
                  daysPerWeek >= 7 ? "opacity-40" : ""
                }`}
                onPress={() => handleDaysPerWeekDelta(1)}
                disabled={daysPerWeek >= 7}
                accessibilityRole="button"
                accessibilityLabel="Increase days per week"
                testID="plan-cadence-plus"
              >
                <IconSymbol name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <Text className="text-base text-muted flex-1 min-w-[140px]">
                {daysPerWeek === 1 ? "day per week" : "days per week"}
              </Text>
            </View>
          </View>

          <View className="mt-4">
            <Text className="text-foreground font-semibold mb-2">Time Preference</Text>
            <PlanTimePreferenceField
              value={proposalContext?.timePreference}
              onChange={(hhmm) => updateProposalField({ timePreference: hhmm })}
            />
          </View>

          <View className="mt-4">
            <Text className="text-foreground font-semibold mb-2">Invite Note</Text>
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-foreground min-h-[96px]"
              value={proposalContext?.notes || ""}
              onChangeText={(value) => updateProposalField({ notes: value })}
              placeholder="Message to include with the invite"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
            />
          </View>
        </View>

        <View className="flex-row gap-2 mb-4">
          <TouchableOpacity
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 items-center"
            onPress={() => setShowCustomProductModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Add custom product"
          >
            <Text className="text-foreground font-semibold">Add Custom Product</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 items-center"
            onPress={() => setShowServiceModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Add sessions"
          >
            <Text className="text-foreground font-semibold">Add Sessions</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 mb-4 border border-border items-center">
            <IconSymbol name="cart.fill" size={40} color={colors.muted} />
            <Text className="text-foreground font-semibold mt-3">No items in plan yet</Text>
            <Text className="text-muted text-center mt-2">
              Browse published bundles and products to start building a client plan.
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-full mt-6"
              onPress={() => router.push(browseCatalogRoute as any)}
              accessibilityRole="button"
              accessibilityLabel="Browse catalog for client plan"
            >
              <Text className="text-background font-semibold">Create Plan</Text>
            </TouchableOpacity>
          </View>
        ) : (
          items.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onRemove={() => handleRemoveItem(item.id)}
              onUpdateQuantity={(quantity) => updateQuantity(item.id, quantity)}
            />
          ))
        )}

        <View className="bg-surface rounded-xl p-4 mb-4 border border-border">
          <Text className="text-foreground font-semibold mb-3">Projected Plan</Text>
          <Text className="text-sm text-muted">
            {previewSnapshot.projectedSchedule.length} projected sessions · {previewSnapshot.projectedDeliveries.length} projected deliveries
          </Text>
          {previewSnapshot.projectedSchedule.slice(0, 4).map((entry) => (
            <Text key={entry.index} className="text-xs text-foreground mt-2">
              {entry.label}: {new Date(entry.startsAt).toLocaleString()}
            </Text>
          ))}
          {previewSnapshot.projectedSchedule.length > 4 ? (
            <TouchableOpacity
              className="mt-2 self-start"
              onPress={() => setShowAllProjectedSessionsModal(true)}
              accessibilityRole="button"
              accessibilityLabel={`Show all ${previewSnapshot.projectedSchedule.length} projected sessions`}
              testID="projected-plan-sessions-more"
            >
              <Text className="text-sm font-semibold text-primary">
                More ({previewSnapshot.projectedSchedule.length - 4} more)
              </Text>
            </TouchableOpacity>
          ) : null}
          {previewSnapshot.projectedDeliveries.slice(0, 4).map((entry, index) => (
            <Text key={`${entry.title}-${index}`} className="text-xs text-muted mt-2">
              Delivery: {entry.title} · {entry.projectedDate ? new Date(entry.projectedDate).toLocaleDateString() : "TBD"}
            </Text>
          ))}
        </View>

        <View className="bg-background border border-border rounded-xl px-4 py-4">
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Subtotal</Text>
            <Text className="text-foreground">£{previewSnapshot.pricing.subtotalAmount.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-4">
            <Text className="text-muted">Discount</Text>
            <Text className="text-foreground">£{previewSnapshot.pricing.discountAmount.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-4 pt-2 border-t border-border">
            <Text className="text-lg font-bold text-foreground">Total</Text>
            <Text className="text-lg font-bold text-primary">£{previewSnapshot.pricing.totalAmount.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            className="bg-primary rounded-xl py-3 items-center"
            onPress={() => void handleInviteProposal()}
            accessibilityRole="button"
            accessibilityLabel="Send client plan"
            testID="plan-send-invite"
          >
            <Text className="text-background font-semibold">Send Plan</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </View>

      <Modal
        visible={showAllProjectedSessionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllProjectedSessionsModal(false)}
      >
        <View className="flex-1">
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => setShowAllProjectedSessionsModal(false)}
            accessibilityLabel="Dismiss all sessions list"
            accessibilityRole="button"
          />
          <View className="bg-background rounded-t-3xl w-full max-h-[88%]">
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2 border-b border-border">
              <View className="w-10" />
              <Text className="text-lg font-semibold text-foreground flex-1 text-center">
                All sessions ({previewSnapshot.projectedSchedule.length})
              </Text>
              <TouchableOpacity
                onPress={() => setShowAllProjectedSessionsModal(false)}
                className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
                accessibilityRole="button"
                accessibilityLabel="Close all sessions list"
                testID="projected-plan-sessions-close"
              >
                <IconSymbol name="xmark" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: Math.min(windowHeight * 0.72, 640) }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 28,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {previewSnapshot.projectedSchedule.map((entry) => (
                <Text
                  key={`session-${entry.index}`}
                  className="text-sm text-foreground py-2 border-b border-border/60"
                >
                  {entry.label}: {new Date(entry.startsAt).toLocaleString()}
                </Text>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showClientPicker && !clientLockedForPlan}
        transparent
        animationType="slide"
        onRequestClose={() => setShowClientPicker(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-background rounded-t-3xl p-4 max-h-[70%]">
            <Text className="text-lg font-semibold text-foreground mb-3">Select Client</Text>
            <ScrollView>
              {(clientsQuery.data || []).map((client) => (
                <TouchableOpacity
                  key={client.id}
                  className="border border-border rounded-xl px-4 py-3 mb-2"
                  onPress={() => handleSelectClient(client)}
                >
                  <Text className="text-foreground font-medium">{client.name || "Client"}</Text>
                  <Text className="text-xs text-muted mt-1">{client.email || "No email"}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCustomProductModal}
        transparent
        animationType="slide"
        onRequestClose={closeCustomProductModal}
      >
        <View className="flex-1">
          <Pressable
            className="flex-1 bg-black/50"
            onPress={closeCustomProductModal}
            accessibilityLabel="Dismiss custom products"
            accessibilityRole="button"
          />
          <View className="bg-background rounded-t-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
              <View className="w-10" />
              <Text className="text-lg font-semibold text-foreground flex-1 text-center">
                Custom Products
              </Text>
              <TouchableOpacity
                onPress={closeCustomProductModal}
                className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
                accessibilityRole="button"
                accessibilityLabel="Close custom products"
                testID="custom-products-dismiss"
              >
                <IconSymbol name="xmark" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <ScrollView
              className="px-4 pb-4"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {(customProductsQuery.data || []).map((product) => (
                <TouchableOpacity
                  key={product.id}
                  className="border border-border rounded-xl px-4 py-3 mb-2"
                  onPress={() => handleAddExistingCustomProduct(product)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add custom product ${product.name}`}
                >
                  <Text className="text-foreground font-medium">{product.name}</Text>
                  <Text className="text-xs text-muted mt-1">£{Number(product.price || 0).toFixed(2)}</Text>
                </TouchableOpacity>
              ))}

              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-foreground font-semibold mb-2">Create New Custom Product</Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground mb-2"
                  value={customProductName}
                  onChangeText={setCustomProductName}
                  placeholder="Name"
                  placeholderTextColor={colors.muted}
                />
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground mb-2"
                  value={customProductPrice}
                  onChangeText={setCustomProductPrice}
                  placeholder="Price"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-foreground mb-3"
                  value={customProductDescription}
                  onChangeText={setCustomProductDescription}
                  placeholder="Description"
                  placeholderTextColor={colors.muted}
                />
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
                    onPress={closeCustomProductModal}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel custom products"
                    testID="custom-products-cancel"
                  >
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 bg-primary rounded-xl py-3 items-center"
                    onPress={() => void handleCreateCustomProduct()}
                    accessibilityRole="button"
                    accessibilityLabel="Create custom product and add to plan"
                    testID="custom-products-create"
                  >
                    <Text className="text-background font-semibold">Create and Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PlanFlowCancelModal
        visible={showPlanCancelModal}
        onDismiss={() => setShowPlanCancelModal(false)}
        clientName={displayClientName}
        itemCount={itemCount}
        onDiscardPlan={exitPlanReviewDiscard}
        testID="plan-review-exit-modal"
      />

      <Modal visible={showServiceModal} transparent animationType="slide" onRequestClose={() => setShowServiceModal(false)}>
        <View className="flex-1">
          <Pressable
            className="flex-1 bg-black/50"
            onPress={() => setShowServiceModal(false)}
            accessibilityLabel="Dismiss add sessions"
            accessibilityRole="button"
          />
          <View className="bg-background rounded-t-3xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View className="w-10" />
              <Text className="text-lg font-semibold text-foreground flex-1 text-center">Add Sessions</Text>
              <TouchableOpacity
                onPress={() => setShowServiceModal(false)}
                className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
                accessibilityRole="button"
                accessibilityLabel="Close add sessions"
                testID="add-sessions-dismiss"
              >
                <IconSymbol name="xmark" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-foreground mb-2"
              value={serviceTitle}
              onChangeText={setServiceTitle}
              placeholder="Service title"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-foreground mb-2"
              value={serviceSessions}
              onChangeText={setServiceSessions}
              placeholder="Number of sessions"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
            />
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-foreground mb-3"
              value={servicePrice}
              onChangeText={setServicePrice}
              placeholder="Price"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity
              className="bg-primary rounded-xl py-3 items-center"
              onPress={handleAddService}
            >
              <Text className="text-background font-semibold">Add Service</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

export default function CartScreen() {
  const colors = useColors();
  const { isAuthenticated, isTrainer, isClient } = useAuthContext();
  const { items, subtotal, updateQuantity, removeItem, isLoading } = useCart();
  const browseCatalogRoute = isClient ? "/(client)/products" : "/(tabs)/products";

  const tax = subtotal * 0.08;
  const total = subtotal + tax;

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeItem(itemId),
        },
      ],
    );
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please login to proceed with checkout",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/login") },
        ],
      );
      return;
    }
    router.push("/checkout" as any);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading cart...</Text>
      </ScreenContainer>
    );
  }

  if (isTrainer && !isClient) {
    return <TrainerProposalBuilder />;
  }

  if (items.length === 0) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <IconSymbol name="cart.fill" size={64} color={colors.muted} />
        <Text className="text-xl font-semibold text-foreground mt-4">
          Your cart is empty
        </Text>
        <Text className="text-muted text-center mt-2">
          Browse products and categories to build your order
        </Text>
        <TouchableOpacity
          className="bg-primary px-6 py-3 rounded-full mt-6"
          onPress={() => router.push(browseCatalogRoute as any)}
          accessibilityRole="button"
          accessibilityLabel="Browse products"
          testID="cart-browse-products"
        >
          <Text className="text-background font-semibold">Browse Products</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Your Cart</Text>
        <Text className="text-sm text-muted">{items.length} items</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CartItemCard
            item={item}
            onRemove={() => handleRemoveItem(item.id)}
            onUpdateQuantity={(quantity) => updateQuantity(item.id, quantity)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      />

      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 pt-4 pb-8">
        <View className="flex-row justify-between mb-2">
          <Text className="text-muted">Subtotal</Text>
          <Text className="text-foreground">£{subtotal.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between mb-2">
          <Text className="text-muted">Tax (8%)</Text>
          <Text className="text-foreground">£{tax.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between mb-4 pt-2 border-t border-border">
          <Text className="text-lg font-bold text-foreground">Total</Text>
          <Text className="text-lg font-bold text-primary">£{total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center"
          onPress={handleCheckout}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Proceed to checkout"
          testID="cart-proceed-checkout"
        >
          <Text className="text-background font-semibold text-lg">
            Proceed to Checkout
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
