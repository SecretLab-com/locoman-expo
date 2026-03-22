import { ActionButton } from "@/components/action-button";
import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useCart } from "@/contexts/cart-context";
import { useColors } from "@/hooks/use-colors";
import { trackLaunchEvent } from "@/lib/analytics";
import { getBundleFallbackImageUrl, normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBPFromMinor } from "@/lib/currency";
import { sanitizeHtml } from "@/lib/html-utils";
import { trpc } from "@/lib/trpc";
import { getTrpcMutationMessage } from "@/lib/trpc-errors";
import {
  mapBundleDraftToBundleView,
  type BundleOfferPaymentType,
  type BundleOfferStatus,
  type BundleOfferType,
} from "@/shared/bundle-offer";
import { cadenceToSessionsPerWeek } from "@/shared/saved-cart-proposal";
import { BUNDLE_OFFER_STATUS_META } from "@/shared/status-meta";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import RenderHTML from "react-native-render-html";

type BundleOption = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceMinor: number;
  paymentType: BundleOfferPaymentType;
  type: BundleOfferType;
  status: BundleOfferStatus;
  sessionCount: number | null;
  included: string[];
};

type CatalogProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type CreatedClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type FlowStep =
  | { type: "form" }
  | { type: "choose_offer" }
  | { type: "simple_pick" }
  | { type: "simple_review"; offerId: string };

function formatBundleTypeLabel(type: BundleOfferType): string {
  if (type === "one_off_session") return "One-off session";
  if (type === "multi_session_package") return "Multi-session package";
  return "Product bundle";
}

function showAlert(title: string, msg: string) {
  Alert.alert(title, msg);
}

function extractListItemsFromHtml(description: string): string[] {
  const names: string[] = [];
  const liMatches = description.matchAll(/<li>(.*?)<\/li>/gi);
  for (const match of liMatches) {
    const raw = String(match[1] || "");
    const withoutTags = raw.replace(/<[^>]+>/g, "");
    const withoutQty = withoutTags.replace(/\(x\d+\)/gi, "");
    const cleaned = withoutQty.trim();
    if (cleaned) names.push(cleaned);
  }
  return names;
}

function defaultProposalScheduleFields() {
  return {
    startDate: new Date().toISOString(),
    cadenceCode: "weekly" as const,
    sessionsPerWeek: cadenceToSessionsPerWeek("weekly"),
    programWeeks: 12,
    sessionDurationMinutes: 60,
    timePreference: undefined as string | undefined,
    sessionCost: undefined as number | undefined,
  };
}

export default function InviteScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { clearCart, setProposalContext } = useCart();
  const params = useLocalSearchParams<{
    clientId?: string | string[];
    clientName?: string | string[];
    clientEmail?: string | string[];
    clientPhone?: string | string[];
    bundleId?: string | string[];
    bundleTitle?: string | string[];
    /** When "1", existing-client flow opens straight on Simple / Custom / Later choice */
    toOfferChoice?: string | string[];
  }>();
  const utils = trpc.useUtils();

  const getParamValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) || "";

  const existingClientId = getParamValue(params.clientId);
  const isExistingClientFlow = Boolean(existingClientId);
  const initialJumpToOffer =
    Boolean(existingClientId) &&
    getParamValue(params.toOfferChoice) === "1" &&
    getParamValue(params.clientName).trim().length > 0;
  const initialNameFromParams = getParamValue(params.clientName).trim();
  const initialEmailFromParams = getParamValue(params.clientEmail);
  const initialPhoneFromParams = getParamValue(params.clientPhone);

  const [clientEmail, setClientEmail] = useState(() =>
    initialJumpToOffer ? initialEmailFromParams : "",
  );
  const [clientName, setClientName] = useState(() => (initialJumpToOffer ? initialNameFromParams : ""));
  const [clientPhone, setClientPhone] = useState(() =>
    initialJumpToOffer ? initialPhoneFromParams : "",
  );
  const [message, setMessage] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [detailsOffer, setDetailsOffer] = useState<BundleOption | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>(() =>
    initialJumpToOffer ? { type: "choose_offer" } : { type: "form" },
  );
  const [createdClient, setCreatedClient] = useState<CreatedClient | null>(() =>
    initialJumpToOffer && existingClientId
      ? {
          id: existingClientId,
          name: initialNameFromParams,
          email: initialEmailFromParams.trim() || null,
          phone: initialPhoneFromParams.trim() || null,
        }
      : null,
  );
  /** When client has no email on file, trainer can enter one on the review step. */
  const [simpleInviteEmail, setSimpleInviteEmail] = useState(() =>
    initialJumpToOffer ? initialEmailFromParams.trim() : "",
  );

  const scrollRef = useRef<ScrollView | null>(null);
  const hasPrefilledFromParamsRef = useRef(false);
  const pendingBundleIdRef = useRef<string | null>(null);

  const { data: bundles = [] } = trpc.bundles.list.useQuery();
  const { data: products = [] } = trpc.catalog.products.useQuery();

  const createClientMutation = trpc.clients.create.useMutation({
    onError: (err) =>
      showAlert("Could not add client", getTrpcMutationMessage(err, "Unable to create this client.")),
  });

  const createProposalMutation = trpc.savedCartProposals.create.useMutation({
    onError: (err) =>
      showAlert("Could not create proposal", getTrpcMutationMessage(err, "Unable to create the proposal.")),
  });

  const sendInviteMutation = trpc.savedCartProposals.sendInvite.useMutation({
    onError: (err) =>
      showAlert("Send failed", getTrpcMutationMessage(err, "Unable to send the invite.")),
  });

  const options: BundleOption[] = (bundles as any[])
    .map((bundle) => mapBundleDraftToBundleView(bundle))
    .map((offer) => ({
      id: offer.id,
      title: String(offer.title || "Bundle"),
      description: typeof offer.description === "string" ? offer.description : null,
      imageUrl: typeof offer.imageUrl === "string" ? offer.imageUrl : null,
      priceMinor: Number(offer.priceMinor || 0),
      paymentType: (offer.paymentType === "recurring" ? "recurring" : "one_off") as BundleOfferPaymentType,
      type: offer.type || "one_off_session",
      status: offer.status || "draft",
      sessionCount: Number.isFinite(Number(offer.sessionCount)) ? Number(offer.sessionCount) : null,
      included: Array.isArray(offer.included)
        ? offer.included.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
    }))
    .filter((offer) => offer.status === "published")
    .sort((a, b) => {
      const rank = (status: BundleOfferStatus) =>
        status === "published" ? 0 : status === "in_review" ? 1 : status === "draft" ? 2 : 3;
      return rank(a.status) - rank(b.status);
    });

  useEffect(() => {
    if (hasPrefilledFromParamsRef.current) return;
    hasPrefilledFromParamsRef.current = true;

    const incomingClientName = getParamValue(params.clientName);
    const incomingClientEmail = getParamValue(params.clientEmail);
    const incomingClientPhone = getParamValue(params.clientPhone);
    const incomingBundleId = getParamValue(params.bundleId);

    if (incomingClientName) setClientName(incomingClientName);
    if (incomingClientEmail) setClientEmail(incomingClientEmail);
    if (incomingClientPhone) setClientPhone(incomingClientPhone);
    if (incomingBundleId) {
      setSelectedOfferId(incomingBundleId);
      pendingBundleIdRef.current = incomingBundleId;
    }
  }, [params.bundleId, params.clientEmail, params.clientId, params.clientName, params.clientPhone]);

  useEffect(() => {
    if (!pendingBundleIdRef.current) return;
    const exists = options.some((offer) => offer.id === pendingBundleIdRef.current);
    if (exists) {
      setSelectedOfferId(pendingBundleIdRef.current);
      pendingBundleIdRef.current = null;
    }
  }, [options]);

  const productImageByName = useMemo(() => {
    const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const imageMap = new Map<string, string>();
    for (const product of products as CatalogProduct[]) {
      if (!product?.name || !product.imageUrl) continue;
      const normalized = normalizeName(product.name);
      const normalizedImageUrl = normalizeAssetUrl(product.imageUrl);
      if (!normalizedImageUrl) continue;
      if (!imageMap.has(normalized)) {
        imageMap.set(normalized, normalizedImageUrl);
      }
    }
    return imageMap;
  }, [products]);
  const productImageEntries = useMemo(() => Array.from(productImageByName.entries()), [productImageByName]);

  const getBundleImageUrl = useCallback(
    (offer: BundleOption): string => {
      const directImage = normalizeAssetUrl(offer.imageUrl);
      if (directImage) return directImage;

      const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
      const candidates = new Set<string>();
      if (offer.title) candidates.add(normalizeName(offer.title));
      for (const included of offer.included) {
        if (included) candidates.add(normalizeName(included));
      }
      if (offer.description) {
        for (const extracted of extractListItemsFromHtml(offer.description)) {
          candidates.add(normalizeName(extracted));
        }
      }

      for (const name of candidates) {
        const match = productImageByName.get(name);
        if (match) return match;
      }

      for (const name of candidates) {
        for (const [productName, imageUrl] of productImageEntries) {
          if (name.includes(productName) || productName.includes(name)) {
            return imageUrl;
          }
        }
      }

      return getBundleFallbackImageUrl(offer?.title);
    },
    [productImageByName, productImageEntries],
  );

  const validateEmail = (value: string) => {
    const v = value.trim();
    if (!v) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  };

  const openChooseOffer = (client: CreatedClient) => {
    setCreatedClient(client);
    setSimpleInviteEmail(client.email?.trim() || "");
    setFlowStep({ type: "choose_offer" });
  };

  const handleNextCreateClient = async () => {
    const name = clientName.trim();
    if (!name) {
      showAlert("Name required", "Enter the client's name to continue.");
      return;
    }
    const emailTrim = clientEmail.trim();
    if (emailTrim && !validateEmail(emailTrim)) {
      showAlert("Invalid email", "Enter a valid email or leave it blank.");
      return;
    }

    try {
      const id = await createClientMutation.mutateAsync({
        name,
        email: emailTrim || undefined,
        phone: clientPhone.trim() || undefined,
        notes: message.trim() || undefined,
      });
      await utils.clients.list.invalidate();
      trackLaunchEvent("trainer_client_created", {
        hasEmail: Boolean(emailTrim),
        hasPhone: Boolean(clientPhone.trim()),
        hasMessage: Boolean(message.trim()),
      });
      openChooseOffer({
        id,
        name,
        email: emailTrim || null,
        phone: clientPhone.trim() || null,
      });
    } catch {
      /* mutation onError */
    }
  };

  const handleExistingClientContinue = async () => {
    const name = clientName.trim();
    if (!name) {
      showAlert("Name required", "Client name is missing. Open this screen from the client profile.");
      return;
    }
    const emailTrim = clientEmail.trim();
    if (emailTrim && !validateEmail(emailTrim)) {
      showAlert("Invalid email", "Enter a valid email or leave it blank.");
      return;
    }
    openChooseOffer({
      id: existingClientId,
      name,
      email: emailTrim || null,
      phone: clientPhone.trim() || null,
    });
  };

  const handleDoLater = () => {
    trackLaunchEvent("trainer_add_client_bundle_deferred", {});
    router.replace("/(trainer)/clients" as any);
  };

  const handleChooseSimpleOffer = () => {
    setFlowStep({ type: "simple_pick" });
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  };

  const handleChooseCustomOffer = () => {
    if (!createdClient) return;
    clearCart();
    setProposalContext({
      proposalId: null,
      clientRecordId: createdClient.id,
      clientName: createdClient.name,
      clientEmail: createdClient.email || "",
      notes: message.trim() || null,
      ...defaultProposalScheduleFields(),
    });
    trackLaunchEvent("trainer_add_client_custom_plan_start", {
      hasNotes: Boolean(message.trim()),
    });
    router.replace("/plan-shop" as any);
  };

  const goToSimpleReview = () => {
    if (!selectedOfferId) {
      showAlert("Select a bundle", "Choose one published bundle to continue.");
      return;
    }
    setFlowStep({ type: "simple_review", offerId: selectedOfferId });
  };

  const handleSendSimpleInvite = async () => {
    if (!createdClient || flowStep.type !== "simple_review") return;
    const offer = options.find((o) => o.id === flowStep.offerId);
    if (!offer) return;

    const emailRaw = (simpleInviteEmail.trim() || createdClient.email || "").trim();
    if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      showAlert("Client email required", "Add a valid email before sending this invite.");
      return;
    }

    try {
      const sched = defaultProposalScheduleFields();
      const { proposalId } = await createProposalMutation.mutateAsync({
        clientRecordId: createdClient.id,
        baseBundleDraftId: offer.id,
        title: createdClient.name,
        notes: message.trim() || undefined,
        ...sched,
        items: [],
      });
      await sendInviteMutation.mutateAsync({
        proposalId,
        email: emailRaw,
        name: createdClient.name,
        message: message.trim() || undefined,
      });
      await Promise.all([utils.clients.list.invalidate(), utils.savedCartProposals.list.invalidate()]);
      trackLaunchEvent("trainer_simple_proposal_invite_sent", {
        offerId: offer.id,
        hasMessage: Boolean(message.trim()),
      });
      Alert.alert("Invite sent", "Your client will receive an email with their plan invite.", [
        { text: "OK", onPress: () => router.replace("/(trainer)/clients" as any) },
      ]);
    } catch {
      /* handled in mutation onError */
    }
  };

  const offerDetailsIncluded = useMemo(() => {
    if (!detailsOffer) return [];
    const merged = new Set<string>();
    for (const item of detailsOffer.included) {
      if (item.trim()) merged.add(item.trim());
    }
    if (detailsOffer.description) {
      for (const item of extractListItemsFromHtml(detailsOffer.description)) {
        if (item.trim()) merged.add(item.trim());
      }
    }
    return Array.from(merged);
  }, [detailsOffer]);

  const headerTitle = useMemo(() => {
    if (flowStep.type === "simple_pick") return "Bundle";
    if (flowStep.type === "simple_review") return "Review invite";
    if (isExistingClientFlow) return "Send bundle";
    return "Add Client";
  }, [flowStep.type, isExistingClientFlow]);

  const headerSubtitle = useMemo(() => {
    if (flowStep.type === "simple_pick") return "Pick one published bundle to attach.";
    if (flowStep.type === "simple_review") return "Confirm details before sending the invite email.";
    if (flowStep.type === "choose_offer") return "Choose how you want to continue.";
    if (isExistingClientFlow) return clientName.trim() ? `For ${clientName.trim()}` : "Attach a bundle or custom plan.";
    return "Create the client, then add a bundle if you want.";
  }, [flowStep.type, isExistingClientFlow, clientName]);

  const handleHeaderBack = () => {
    if (flowStep.type === "simple_review") {
      setFlowStep({ type: "simple_pick" });
      return;
    }
    if (flowStep.type === "simple_pick") {
      setFlowStep({ type: "choose_offer" });
      return;
    }
    if (flowStep.type === "choose_offer") {
      router.back();
      return;
    }
    router.back();
  };

  const simpleReviewOffer =
    flowStep.type === "simple_review" ? options.find((o) => o.id === flowStep.offerId) : undefined;

  const renderForm = () => (
    <SurfaceCard className="mb-4">
      {isExistingClientFlow ? (
        <>
          <Text className="text-sm font-medium text-muted mb-2">Client</Text>
          <Text className="text-foreground font-semibold text-base mb-1">{clientName.trim() || "Client"}</Text>
          <Text className="text-muted text-sm mb-4">{clientEmail.trim() || "No email on file"}</Text>
          {clientPhone.trim() ? <Text className="text-muted text-sm mb-4">{clientPhone.trim()}</Text> : null}
          <Text className="text-sm font-medium text-muted mb-2">Client email (optional)</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
            value={clientEmail}
            onChangeText={setClientEmail}
            placeholder="Update email on file"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Client email"
          />
        </>
      ) : (
        <>
          <Text className="text-sm font-medium text-muted mb-2">Client name</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
            value={clientName}
            onChangeText={setClientName}
            placeholder="Jane Doe"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Client name"
            testID="add-client-name"
          />

          <Text className="text-sm font-medium text-muted mb-2">Client email (optional)</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
            value={clientEmail}
            onChangeText={setClientEmail}
            placeholder="jane@email.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Client email"
            testID="add-client-email"
          />

          <Text className="text-sm font-medium text-muted mb-2">Client phone (optional)</Text>
          <TextInput
            className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
            value={clientPhone}
            onChangeText={setClientPhone}
            placeholder="+44 7700 900123"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            accessibilityLabel="Client phone"
          />
        </>
      )}

      <Text className="text-sm font-medium text-muted mb-2">Invite note (optional)</Text>
      <TextInput
        className="bg-background border border-border rounded-xl px-4 py-3 text-foreground min-h-[90px]"
        value={message}
        onChangeText={setMessage}
        placeholder="Personal message included with the invite."
        placeholderTextColor={colors.muted}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Invite note"
        testID="add-client-message"
      />
    </SurfaceCard>
  );

  const renderSimplePick = () => (
    <View>
      <TouchableOpacity
        className="mb-3 self-start"
        onPress={() => setFlowStep({ type: "choose_offer" })}
        accessibilityRole="button"
        accessibilityLabel="Change bundle or plan type"
        testID="add-client-simple-change-choice"
      >
        <Text className="text-primary text-sm font-semibold">← Change choice</Text>
      </TouchableOpacity>

      <SurfaceCard className="mb-4">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-semibold text-foreground">Published bundles</Text>
          {selectedOfferId ? (
            <TouchableOpacity onPress={() => setSelectedOfferId(null)} accessibilityRole="button" accessibilityLabel="Clear selected bundle">
              <Text className="text-primary text-sm font-medium">Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {options.length === 0 ? (
          <EmptyStateCard
            icon="tag.fill"
            title="No bundles yet"
            description="Publish a bundle first, or use a custom plan instead."
            ctaLabel="Create bundle"
            onCtaPress={() => router.push("/bundle-editor/new" as any)}
          />
        ) : (
          options.map((offer) => {
            const offerImageUrl = getBundleImageUrl(offer);
            return (
              <View key={offer.id} className="mb-2">
                <TouchableOpacity
                  className={`border rounded-xl p-3 ${
                    selectedOfferId === offer.id ? "border-primary bg-primary/10" : "border-border bg-background"
                  }`}
                  onPress={() => setSelectedOfferId(offer.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select bundle ${offer.title}`}
                  testID={`invite-bundle-${offer.id}`}
                >
                  <View className="flex-row">
                    <View className="w-16 h-16 rounded-lg bg-surface overflow-hidden items-center justify-center mr-3">
                      {offerImageUrl ? (
                        <Image source={{ uri: offerImageUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                      ) : (
                        <IconSymbol name="photo" size={18} color={colors.muted} />
                      )}
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-start justify-between">
                        <Text
                          className={
                            selectedOfferId === offer.id
                              ? "text-primary font-semibold flex-1 pr-2"
                              : "text-foreground font-medium flex-1 pr-2"
                          }
                        >
                          {offer.title}
                        </Text>
                        <Text
                          className={selectedOfferId === offer.id ? "text-primary font-semibold" : "text-foreground font-semibold"}
                        >
                          {formatGBPFromMinor(offer.priceMinor)}
                        </Text>
                      </View>

                      <View className="flex-row flex-wrap items-center mt-1 gap-2">
                        <Text className="text-xs text-muted">{formatBundleTypeLabel(offer.type)}</Text>
                        <Text className="text-xs text-muted">{offer.paymentType === "recurring" ? "Recurring" : "One-off"}</Text>
                        {offer.sessionCount ? <Text className="text-xs text-muted">{offer.sessionCount} sessions</Text> : null}
                      </View>

                      {offer.description ? (
                        <Text className="text-xs text-muted mt-1" numberOfLines={2}>
                          {offer.description.replace(/<[^>]+>/g, " ")}
                        </Text>
                      ) : null}

                      <View className="flex-row items-center mt-2">
                        {(() => {
                          const meta = BUNDLE_OFFER_STATUS_META[offer.status] || BUNDLE_OFFER_STATUS_META.draft;
                          const dotColor =
                            meta.colorKey === "success"
                              ? colors.success
                              : meta.colorKey === "primary"
                                ? colors.primary
                                : meta.colorKey === "error"
                                  ? colors.error
                                  : colors.warning;
                          return (
                            <>
                              <View className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                              <Text className="text-xs text-muted ml-1">{meta.label}</Text>
                            </>
                          );
                        })()}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  className="self-start mt-1 px-2 py-1"
                  onPress={() => setDetailsOffer(offer)}
                  accessibilityRole="button"
                  accessibilityLabel={`View details for ${offer.title}`}
                  testID={`invite-bundle-details-${offer.id}`}
                >
                  <Text className="text-primary text-xs font-semibold">View details</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </SurfaceCard>

      <ActionButton
        constrainWidth
        variant="primary"
        size="md"
        onPress={goToSimpleReview}
        disabled={!selectedOfferId}
        accessibilityLabel="Continue to review invite"
        testID="add-client-simple-continue"
      >
        Review invite
      </ActionButton>
    </View>
  );

  const renderSimpleReview = () => {
    if (!simpleReviewOffer || !createdClient) return null;
    return (
      <View>
        <TouchableOpacity
          className="mb-3 self-start"
          onPress={() => setFlowStep({ type: "simple_pick" })}
          accessibilityRole="button"
          accessibilityLabel="Back to bundle list"
          testID="add-client-simple-review-back"
        >
          <Text className="text-primary text-sm font-semibold">← Back</Text>
        </TouchableOpacity>

        <SurfaceCard className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Client</Text>
          <Text className="text-foreground font-medium">{createdClient.name}</Text>
          <Text className="text-muted text-sm mt-1">{createdClient.email || "No email on file"}</Text>
        </SurfaceCard>

        <SurfaceCard className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Bundle</Text>
          <Text className="text-foreground font-medium">{simpleReviewOffer.title}</Text>
          <Text className="text-primary font-semibold mt-1">{formatGBPFromMinor(simpleReviewOffer.priceMinor)}</Text>
        </SurfaceCard>

        {(!createdClient.email || !createdClient.email.trim()) && (
          <SurfaceCard className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Client email for invite</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
              value={simpleInviteEmail}
              onChangeText={setSimpleInviteEmail}
              placeholder="client@email.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="Email address for invite"
              testID="add-client-simple-invite-email"
            />
          </SurfaceCard>
        )}

        <SurfaceCard className="mb-4">
          <Text className="text-sm font-semibold text-foreground mb-2">Invite note</Text>
          <Text className="text-muted text-sm leading-5">{message.trim() ? message.trim() : "No personal message."}</Text>
        </SurfaceCard>

        <ActionButton
          constrainWidth
          variant="primary"
          size="md"
          onPress={handleSendSimpleInvite}
          loading={createProposalMutation.isPending || sendInviteMutation.isPending}
          loadingText="Sending..."
          accessibilityLabel="Send invite email"
          testID="add-client-simple-send"
        >
          Send invite
        </ActionButton>
      </View>
    );
  };

  const chooseOfferModalVisible = flowStep.type === "choose_offer";

  return (
    <ScreenContainer>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          leftSlot={(
            <TouchableOpacity
              onPress={handleHeaderBack}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="add-client-back"
            >
              <IconSymbol name="arrow.left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
        />

        <View className="px-4 pb-8">
          {flowStep.type === "form" || flowStep.type === "choose_offer" ? (
            <>
              {flowStep.type === "choose_offer" ? (
                <SurfaceCard className="mb-4 bg-primary/5 border-primary/20">
                  <Text className="text-foreground font-semibold">
                    {createdClient?.name ? `${createdClient.name} is ready.` : "Client is ready."}
                  </Text>
                  <Text className="text-muted text-sm mt-1">Choose an option below.</Text>
                </SurfaceCard>
              ) : null}
              {flowStep.type === "form" ? renderForm() : null}
              {flowStep.type === "form" ? (
                <ActionButton
                  constrainWidth
                  variant="primary"
                  size="md"
                  onPress={isExistingClientFlow ? handleExistingClientContinue : handleNextCreateClient}
                  loading={createClientMutation.isPending}
                  loadingText="Saving..."
                  accessibilityLabel={isExistingClientFlow ? "Continue to bundle and plan options" : "Save client and continue"}
                  testID="add-client-next"
                >
                  {isExistingClientFlow ? "Continue" : "Next"}
                </ActionButton>
              ) : null}
            </>
          ) : null}

          {flowStep.type === "simple_pick" ? renderSimplePick() : null}
          {flowStep.type === "simple_review" ? renderSimpleReview() : null}
        </View>
      </ScrollView>

      <Modal visible={chooseOfferModalVisible} transparent animationType="fade" onRequestClose={handleDoLater}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.85)" }}>
          <Pressable
            className="bg-background rounded-2xl mx-6 overflow-hidden border border-border"
            style={{ maxWidth: 400, width: "90%" }}
          >
            <View className="px-5 pt-5 pb-2">
              <Text className="text-lg font-bold text-foreground text-center">Add a bundle?</Text>
              <Text className="text-sm text-muted text-center mt-2 leading-5">
                Send a published bundle now, build a custom plan, or finish later.
              </Text>
            </View>
            <View className="px-5 pb-5 gap-2">
              <ActionButton
                fullWidth
                variant="primary"
                size="md"
                onPress={handleChooseSimpleOffer}
                accessibilityLabel="Bundle…"
                testID="add-client-choice-simple"
              >
                <View className="items-center py-0.5">
                  <Text className="text-background font-semibold">Bundle</Text>
                  <Text className="text-background/80 text-xs mt-0.5">One published bundle</Text>
                </View>
              </ActionButton>
              <ActionButton
                fullWidth
                variant="secondary"
                size="md"
                onPress={handleChooseCustomOffer}
                accessibilityLabel="Custom plan"
                testID="add-client-choice-custom"
              >
                <View className="items-center py-0.5">
                  <Text className="text-foreground font-semibold">Custom plan</Text>
                  <Text className="text-muted text-xs mt-0.5">Shop plan, then review and send</Text>
                </View>
              </ActionButton>
              <ActionButton
                fullWidth
                variant="secondary"
                size="md"
                onPress={handleDoLater}
                accessibilityLabel="Do this later"
                testID="add-client-choice-later"
              >
                Do this later
              </ActionButton>
            </View>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={Boolean(detailsOffer)} transparent animationType="slide" onRequestClose={() => setDetailsOffer(null)}>
        <Pressable
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" }}
          onPress={() => setDetailsOffer(null)}
        >
          <View>
            <SwipeDownSheet
              visible={Boolean(detailsOffer)}
              onClose={() => setDetailsOffer(null)}
              className="bg-background rounded-t-2xl border-t border-border max-h-[84%]"
            >
              <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
                <Text className="text-foreground font-semibold text-base">Bundle details</Text>
                <TouchableOpacity
                  onPress={() => setDetailsOffer(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close bundle details"
                  testID="invite-bundle-details-close"
                >
                  <IconSymbol name="xmark" size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              {detailsOffer ? (
                <ScrollView className="px-4 py-4" showsVerticalScrollIndicator={false}>
                  <View className="flex-row">
                    <View className="w-20 h-20 rounded-xl bg-surface overflow-hidden items-center justify-center mr-3">
                      {getBundleImageUrl(detailsOffer) ? (
                        <Image
                          source={{ uri: getBundleImageUrl(detailsOffer)! }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <IconSymbol name="photo" size={20} color={colors.muted} />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold text-base">{detailsOffer.title}</Text>
                      <Text className="text-primary font-semibold mt-0.5">{formatGBPFromMinor(detailsOffer.priceMinor)}</Text>
                      <Text className="text-muted text-xs mt-1">
                        {formatBundleTypeLabel(detailsOffer.type)} • {detailsOffer.paymentType === "recurring" ? "Recurring" : "One-off"}
                        {detailsOffer.sessionCount ? ` • ${detailsOffer.sessionCount} sessions` : ""}
                      </Text>
                    </View>
                  </View>

                  {detailsOffer.description ? (
                    <View className="mt-4">
                      <Text className="text-foreground text-sm font-semibold mb-2">Description</Text>
                      {/<[a-z][\s\S]*>/i.test(detailsOffer.description) ? (
                        <RenderHTML
                          contentWidth={Math.max(0, width - 32)}
                          source={{ html: sanitizeHtml(detailsOffer.description) }}
                          tagsStyles={{
                            p: { color: colors.muted, lineHeight: 20, marginTop: 0, marginBottom: 8 },
                            ul: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                            ol: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                            li: { color: colors.muted, marginBottom: 4 },
                            strong: { color: colors.foreground, fontWeight: "600" },
                            b: { color: colors.foreground, fontWeight: "600" },
                          }}
                        />
                      ) : (
                        <Text className="text-muted text-sm leading-6">{detailsOffer.description}</Text>
                      )}
                    </View>
                  ) : null}

                  {offerDetailsIncluded.length > 0 ? (
                    <View className="mt-4">
                      <Text className="text-foreground text-sm font-semibold mb-2">{"What's included"}</Text>
                      {offerDetailsIncluded.map((item, index) => (
                        <View key={`${item}-${index}`} className="flex-row items-start mb-2">
                          <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
                          <Text className="text-muted text-sm ml-2 flex-1">{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              ) : null}
            </SwipeDownSheet>
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
