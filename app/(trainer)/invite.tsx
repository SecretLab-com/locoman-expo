import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trackLaunchEvent } from "@/lib/analytics";
import { getOfferFallbackImageUrl, normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBPFromMinor } from "@/lib/currency";
import { getInviteLink } from "@/lib/invite-links";
import { sanitizeHtml } from "@/lib/html-utils";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import RenderHTML from "react-native-render-html";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";

type OfferType = "one_off_session" | "multi_session_package" | "product_bundle";
type OfferPaymentType = "one_off" | "recurring";
type OfferStatus = "draft" | "in_review" | "published" | "archived";

type OfferOption = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  priceMinor: number;
  paymentType: OfferPaymentType;
  type: OfferType;
  status: OfferStatus;
  sessionCount: number | null;
  included: string[];
};

type CatalogProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
};

const OFFER_STATUS_META: Record<OfferStatus, { label: string; colorKey: "success" | "warning" | "primary" | "error" }> = {
  draft: { label: "Draft", colorKey: "warning" },
  in_review: { label: "In review", colorKey: "primary" },
  published: { label: "Published", colorKey: "success" },
  archived: { label: "Archived", colorKey: "error" },
};

function formatOfferTypeLabel(type: OfferType): string {
  if (type === "one_off_session") return "One-off session";
  if (type === "multi_session_package") return "Multi-session package";
  return "Product bundle";
}

function showAlert(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
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

export default function InviteScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{
    clientId?: string | string[];
    clientName?: string | string[];
    clientEmail?: string | string[];
    clientPhone?: string | string[];
    bundleId?: string | string[];
    bundleTitle?: string | string[];
  }>();
  const utils = trpc.useUtils();
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [message, setMessage] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [detailsOffer, setDetailsOffer] = useState<OfferOption | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const inviteResultTopRef = useRef<number>(0);
  const hasPrefilledFromParamsRef = useRef(false);
  const pendingBundleIdRef = useRef<string | null>(null);

  const { data: offers = [] } = trpc.offers.list.useQuery();
  const { data: products = [] } = trpc.catalog.products.useQuery();
  const inviteMutation = trpc.clients.invite.useMutation({
    onError: (err) => showAlert("Invite failed", `${err.message}\n\nA Server message with next steps has been sent to your inbox.`),
  });

  const options: OfferOption[] = offers
    .map((offer: any) => ({
    id: offer.id,
    title: String(offer.title || "Offer"),
    description: typeof offer.description === "string" ? offer.description : null,
    imageUrl: typeof offer.imageUrl === "string" ? offer.imageUrl : null,
    priceMinor: Number(offer.priceMinor || 0),
    paymentType: (offer.paymentType === "recurring" ? "recurring" : "one_off") as OfferPaymentType,
    type: (offer.type as OfferType) || "one_off_session",
    status: (offer.status as OfferStatus) || "draft",
    sessionCount: Number.isFinite(Number(offer.sessionCount)) ? Number(offer.sessionCount) : null,
    included: Array.isArray(offer.included)
      ? offer.included.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    }))
    .sort((a, b) => {
      const rank = (status: OfferStatus) =>
        status === "published" ? 0 : status === "in_review" ? 1 : status === "draft" ? 2 : 3;
      return rank(a.status) - rank(b.status);
    });

  const getParamValue = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value) || "";

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
  }, [params.bundleId, params.clientEmail, params.clientName, params.clientPhone]);

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
  const productImageEntries = useMemo(
    () => Array.from(productImageByName.entries()),
    [productImageByName],
  );

  const getOfferImageUrl = (offer: OfferOption): string => {
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

    return getOfferFallbackImageUrl(offer?.title);
  };

  const validateEmail = () => {
    const value = clientEmail.trim();
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const createInvite = async () => {
    await haptics.light();
    if (!validateEmail()) {
      showAlert("Valid email required", "Enter a valid client email to send an invite.");
      return;
    }

    const result = await inviteMutation.mutateAsync({
      email: clientEmail.trim(),
      name: clientName.trim() || undefined,
      bundleDraftId: selectedOfferId || undefined,
      message: message.trim() || undefined,
    });

    await Promise.all([
      utils.clients.invitations.invalidate(),
      utils.clients.list.invalidate(),
    ]);

    const link = getInviteLink(result.token);
    setInviteLink(link);
    // Ensure action buttons are visible immediately after link creation.
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, inviteResultTopRef.current - 20),
        animated: true,
      });
    }, 80);
    trackLaunchEvent("trainer_invite_sent", {
      hasOffer: Boolean(selectedOfferId),
      hasMessage: Boolean(message.trim()),
    });
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      if (Platform.OS === "web" && navigator?.clipboard) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        const Clipboard = require("expo-clipboard");
        await Clipboard.setStringAsync(inviteLink);
      }
      showAlert("Copied", "Invite link copied.");
    } catch {
      showAlert("Copy failed", "Unable to copy invite link.");
    }
  };

  const shareLink = async () => {
    if (!inviteLink) return;
    const text = message.trim()
      ? `${message.trim()}\n\nJoin me on LocoMotive:\n${inviteLink}`
      : `Join me on LocoMotive:\n${inviteLink}`;
    try {
      await Share.share({ message: text, url: inviteLink });
    } catch {
      await copyLink();
    }
  };

  const emailLink = async () => {
    if (!inviteLink) return;
    const subject = encodeURIComponent("Your LocoMotive invite");
    const bodyText = message.trim()
      ? `${message.trim()}\n\nJoin me on LocoMotive:\n${inviteLink}`
      : `Join me on LocoMotive:\n${inviteLink}`;
    const body = encodeURIComponent(bodyText);
    const recipient = encodeURIComponent(clientEmail.trim());
    const mailto = `mailto:${recipient}?subject=${subject}&body=${body}`;
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        showAlert("Email unavailable", "No email app is available on this device.");
        return;
      }
      await Linking.openURL(mailto);
    } catch {
      showAlert("Email failed", "Unable to open email composer.");
    }
  };

  const smsLink = async () => {
    if (!inviteLink) return;
    const bodyText = message.trim()
      ? `${message.trim()}\n\nJoin me on LocoMotive:\n${inviteLink}`
      : `Join me on LocoMotive:\n${inviteLink}`;
    const separator = Platform.OS === "ios" ? "&" : "?";
    const smsTarget = clientPhone.trim().replace(/\s+/g, "");
    const url = `sms:${smsTarget}${separator}body=${encodeURIComponent(bodyText)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        showAlert("SMS unavailable", "No SMS app is available on this device.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      showAlert("SMS failed", "Unable to open SMS composer.");
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

  return (
    <ScreenContainer>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={clientName.trim() ? `Invite ${clientName.trim()}` : "Invite Client"}
          subtitle={clientEmail.trim() ? `Preparing invite for ${clientEmail.trim()}` : "Send an invite link in under 30 seconds."}
          leftSlot={(
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            >
              <IconSymbol name="arrow.left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
        />

        <View className="px-4 pb-8">
          <SurfaceCard className="mb-4">
            <Text className="text-sm font-medium text-muted mb-2">Client name (optional)</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
              value={clientName}
              onChangeText={setClientName}
              placeholder="Jane Doe"
              placeholderTextColor={colors.muted}
            />

            <Text className="text-sm font-medium text-muted mb-2">Client email</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
              value={clientEmail}
              onChangeText={setClientEmail}
              placeholder="jane@email.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text className="text-sm font-medium text-muted mb-2">Client phone (optional)</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
              value={clientPhone}
              onChangeText={setClientPhone}
              placeholder="+44 7700 900123"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
            />

            <Text className="text-sm font-medium text-muted mb-2">Optional message</Text>
            <TextInput
              className="bg-background border border-border rounded-xl px-4 py-3 text-foreground min-h-[90px]"
              value={message}
              onChangeText={setMessage}
              placeholder="Excited to train with you. Here is your invite."
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
            />
          </SurfaceCard>

          <SurfaceCard className="mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm font-semibold text-foreground">Attach offer (optional)</Text>
              {selectedOfferId ? (
                <TouchableOpacity onPress={() => setSelectedOfferId(null)}>
                  <Text className="text-primary text-sm font-medium">Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {options.length === 0 ? (
              <EmptyStateCard
                icon="tag.fill"
                title="No offers yet"
                description="You can still invite clients now and add offers later."
                ctaLabel="Create Offer"
                onCtaPress={() => router.push("/(trainer)/offers/new" as any)}
              />
            ) : (
              options.map((offer) => {
                const offerImageUrl = getOfferImageUrl(offer);
                return (
                  <View key={offer.id} className="mb-2">
                    <TouchableOpacity
                      className={`border rounded-xl p-3 ${
                        selectedOfferId === offer.id ? "border-primary bg-primary/10" : "border-border bg-background"
                      }`}
                      onPress={() => setSelectedOfferId(offer.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select offer ${offer.title}`}
                      testID={`invite-offer-${offer.id}`}
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
                          <Text className={selectedOfferId === offer.id ? "text-primary font-semibold flex-1 pr-2" : "text-foreground font-medium flex-1 pr-2"}>
                            {offer.title}
                          </Text>
                          <Text className={selectedOfferId === offer.id ? "text-primary font-semibold" : "text-foreground font-semibold"}>
                            {formatGBPFromMinor(offer.priceMinor)}
                          </Text>
                        </View>

                        <View className="flex-row flex-wrap items-center mt-1 gap-2">
                          <Text className="text-xs text-muted">{formatOfferTypeLabel(offer.type)}</Text>
                          <Text className="text-xs text-muted">
                            {offer.paymentType === "recurring" ? "Recurring" : "One-off"}
                          </Text>
                          {offer.sessionCount ? (
                            <Text className="text-xs text-muted">{offer.sessionCount} sessions</Text>
                          ) : null}
                        </View>

                        {offer.description ? (
                          <Text className="text-xs text-muted mt-1" numberOfLines={2}>
                            {offer.description}
                          </Text>
                        ) : null}

                        {offer.included.length > 0 ? (
                          <Text className="text-xs text-muted mt-1" numberOfLines={1}>
                            Includes: {offer.included.slice(0, 2).join(", ")}
                            {offer.included.length > 2 ? ` +${offer.included.length - 2}` : ""}
                          </Text>
                        ) : null}

                        <View className="flex-row items-center mt-2">
                          {(() => {
                            const meta = OFFER_STATUS_META[offer.status] || OFFER_STATUS_META.draft;
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
                      testID={`invite-offer-details-${offer.id}`}
                    >
                      <Text className="text-primary text-xs font-semibold">View details</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </SurfaceCard>

          {inviteLink ? (
            <View
              className="bg-success/10 border border-success/30 rounded-xl p-4"
              onLayout={(event) => {
                inviteResultTopRef.current = event.nativeEvent.layout.y;
              }}
            >
              <View className="flex-row items-center mb-2">
                <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
                <Text className="text-success font-semibold ml-2">Invite link ready</Text>
              </View>
              <Text className="text-foreground text-sm" selectable>{inviteLink}</Text>
              <View className="flex-row gap-2 mt-4">
                <TouchableOpacity
                  className="flex-1 bg-primary rounded-xl py-3 items-center"
                  onPress={emailLink}
                  accessibilityRole="button"
                  accessibilityLabel="Email invite link"
                  testID="invite-email-link"
                >
                  <Text className="text-background font-semibold">Email</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
                  onPress={copyLink}
                  accessibilityRole="button"
                  accessibilityLabel="Copy invite link"
                  testID="invite-copy-link"
                >
                  <Text className="text-foreground font-semibold">Copy</Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
                  onPress={shareLink}
                  accessibilityRole="button"
                  accessibilityLabel="Share invite link"
                  testID="invite-share-link"
                >
                  <Text className="text-foreground font-semibold">Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
                  onPress={smsLink}
                  accessibilityRole="button"
                  accessibilityLabel="Send invite by SMS"
                  testID="invite-sms-link"
                >
                  <Text className="text-foreground font-semibold">SMS</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center"
              onPress={createInvite}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-background font-semibold text-lg">Create Invite Link</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(detailsOffer)}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsOffer(null)}
      >
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setDetailsOffer(null)}>
          <View>
            <SwipeDownSheet
              visible={Boolean(detailsOffer)}
              onClose={() => setDetailsOffer(null)}
              className="bg-background rounded-t-2xl border-t border-border max-h-[84%]"
            >
            <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
              <Text className="text-foreground font-semibold text-base">Offer details</Text>
              <TouchableOpacity
                onPress={() => setDetailsOffer(null)}
                accessibilityRole="button"
                accessibilityLabel="Close offer details"
                testID="invite-offer-details-close"
              >
                <IconSymbol name="xmark" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {detailsOffer ? (
              <ScrollView className="px-4 py-4" showsVerticalScrollIndicator={false}>
                <View className="flex-row">
                  <View className="w-20 h-20 rounded-xl bg-surface overflow-hidden items-center justify-center mr-3">
                    {getOfferImageUrl(detailsOffer) ? (
                      <Image source={{ uri: getOfferImageUrl(detailsOffer)! }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <IconSymbol name="photo" size={20} color={colors.muted} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base">{detailsOffer.title}</Text>
                    <Text className="text-primary font-semibold mt-0.5">{formatGBPFromMinor(detailsOffer.priceMinor)}</Text>
                    <Text className="text-muted text-xs mt-1">
                      {formatOfferTypeLabel(detailsOffer.type)} • {detailsOffer.paymentType === "recurring" ? "Recurring" : "One-off"}
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
