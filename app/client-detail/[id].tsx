import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { getOfferFallbackImageUrl, normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBP } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Easing, ScrollView, Text, TouchableOpacity, View } from "react-native";

function paymentLabel(status: string | null | undefined) {
  const value = (status || "").toLowerCase();
  if (value === "paid") return "Paid";
  if (value === "refunded" || value === "partially_refunded") return "Paid out";
  return "Awaiting payment";
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

function toProgressPercent(used: number, included: number) {
  if (!included || included <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / included) * 100)));
}

export default function ClientDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const offerAttentionAnim = useRef(new Animated.Value(0)).current;
  const { data, isLoading } = trpc.clients.detail.useQuery({ id: id || "" }, { enabled: !!id });
  const { data: trainerOffers = [], isLoading: offersLoading } = trpc.offers.list.useQuery(undefined, {
    enabled: !!id,
  });
  const { data: products = [] } = trpc.catalog.products.useQuery();

  const topOffers = useMemo(() => {
    const ranked = [...(trainerOffers as any[])].sort((a, b) => {
      const rank = (status: string) => {
        if (status === "published") return 0;
        if (status === "in_review") return 1;
        if (status === "draft") return 2;
        return 3;
      };
      const statusDiff = rank(String(a?.status || "")) - rank(String(b?.status || ""));
      if (statusDiff !== 0) return statusDiff;
      const aTs = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTs = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTs - aTs;
    });
    return ranked.slice(0, 3);
  }, [trainerOffers]);

  const productImageByName = useMemo(() => {
    const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const imageMap = new Map<string, string>();
    for (const product of products as any[]) {
      if (!product?.name || !product?.imageUrl) continue;
      const normalized = normalizeName(String(product.name));
      const normalizedImageUrl = normalizeAssetUrl(String(product.imageUrl));
      if (!normalizedImageUrl) continue;
      if (!imageMap.has(normalized)) {
        imageMap.set(normalized, normalizedImageUrl);
      }
    }
    return imageMap;
  }, [products]);

  const productImageEntries = useMemo(
    () => Array.from(productImageByName.entries()),
    [productImageByName]
  );
  const fallbackProductImages = useMemo(
    () => productImageEntries.map(([, imageUrl]) => imageUrl).filter(Boolean),
    [productImageEntries]
  );

  const getOfferImageUrl = (offer: any): string => {
    const directImage = normalizeAssetUrl(offer?.imageUrl);
    if (directImage) return directImage;

    const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const candidates = new Set<string>();

    if (offer?.title) candidates.add(normalizeName(String(offer.title)));
    if (Array.isArray(offer?.included)) {
      for (const included of offer.included) {
        if (typeof included === "string" && included.trim()) {
          candidates.add(normalizeName(included));
        }
      }
    }
    if (typeof offer?.description === "string" && offer.description.trim()) {
      for (const item of extractListItemsFromHtml(offer.description)) {
        candidates.add(normalizeName(item));
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

    if (fallbackProductImages.length > 0) {
      const rawKey = String(offer?.id || offer?.title || "0");
      let hash = 0;
      for (let i = 0; i < rawKey.length; i++) {
        hash = (hash * 31 + rawKey.charCodeAt(i)) >>> 0;
      }
      return fallbackProductImages[hash % fallbackProductImages.length];
    }

    return getOfferFallbackImageUrl(offer?.title);
  };

  useEffect(() => {
    const attentionLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(offerAttentionAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(offerAttentionAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    attentionLoop.start();
    return () => attentionLoop.stop();
  }, [offerAttentionAnim]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <ScreenHeader
          title="Client"
          subtitle="Client details"
          leftSlot={(
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            >
              <IconSymbol name="arrow.left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
        />
        <View className="px-4">
          <EmptyStateCard
            icon="person.fill"
            title="Client not found"
            description="This client is unavailable or no longer active."
            ctaLabel="Back to Clients"
            onCtaPress={() => router.replace("/(trainer)/clients" as any)}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={data.name}
          subtitle={data.email || "No email on file"}
          leftSlot={(
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            >
              <IconSymbol name="arrow.left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
          rightSlot={(
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                className="bg-surface border border-border px-3 py-2 rounded-full"
                onPress={() =>
                  router.push({
                    pathname: "/(trainer)/invite",
                    params: {
                      clientId: data.id,
                      clientName: data.name || "",
                      clientEmail: data.email || "",
                      clientPhone: data.phone || "",
                    },
                  } as any)
                }
                accessibilityRole="button"
                accessibilityLabel={`Invite ${data.name} to an offer`}
                testID="client-detail-invite-offer"
              >
                <Text className="text-foreground font-semibold">Invite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-primary px-3 py-2 rounded-full"
                onPress={() => router.push("/(trainer)/get-paid" as any)}
                accessibilityRole="button"
                accessibilityLabel={`Request payment from ${data.name}`}
                testID="client-detail-get-paid"
              >
                <Text className="text-background font-semibold">Get Paid</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        <View className="px-4 mb-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Current bundle status</Text>
          {data.currentBundle ? (
            <SurfaceCard className="mb-3">
              <Text className="text-base font-semibold text-foreground">
                {data.currentBundle.title || "Active bundle"}
              </Text>
              <View className="mt-3">
                <Text className="text-xs text-muted">
                  Sessions: {Number(data.currentBundle.sessionsUsed || 0)}/{Number(data.currentBundle.sessionsIncluded || 0)}
                </Text>
                <View className="h-2 rounded-full mt-1.5 mb-2 overflow-hidden" style={{ backgroundColor: colors.surface }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${toProgressPercent(
                        Number(data.currentBundle.sessionsUsed || 0),
                        Number(data.currentBundle.sessionsIncluded || 0),
                      )}%`,
                      backgroundColor:
                        toProgressPercent(
                          Number(data.currentBundle.sessionsUsed || 0),
                          Number(data.currentBundle.sessionsIncluded || 0),
                        ) >= 80
                          ? colors.warning
                          : colors.primary,
                    }}
                  />
                </View>

                <Text className="text-xs text-muted">
                  Products: {Number(data.currentBundle.productsUsed || 0)}/{Number(data.currentBundle.productsIncluded || 0)}
                </Text>
                <View className="h-2 rounded-full mt-1.5 overflow-hidden" style={{ backgroundColor: colors.surface }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${toProgressPercent(
                        Number(data.currentBundle.productsUsed || 0),
                        Number(data.currentBundle.productsIncluded || 0),
                      )}%`,
                      backgroundColor:
                        toProgressPercent(
                          Number(data.currentBundle.productsUsed || 0),
                          Number(data.currentBundle.productsIncluded || 0),
                        ) >= 80
                          ? colors.warning
                          : colors.success,
                    }}
                  />
                </View>
              </View>

              {Array.isArray(data.currentBundle.alerts) && data.currentBundle.alerts.length > 0 ? (
                <View className="mt-3">
                  {data.currentBundle.alerts.map((alert: string, index: number) => (
                    <View
                      key={`${alert}-${index}`}
                      className="px-2.5 py-1.5 rounded-full self-start mb-1.5"
                      style={{ backgroundColor: `${colors.warning}20` }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: colors.warning }}>
                        {alert}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </SurfaceCard>
          ) : (
            <SurfaceCard className="mb-3">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-surface border border-border items-center justify-center mr-3">
                  <IconSymbol name="bag.fill" size={18} color={colors.muted} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-foreground">No active bundle</Text>
                  <Text className="text-sm text-muted mt-1">
                    This client is not currently signed up for a bundle. Use the Invite buttons below.
                  </Text>
                </View>
              </View>
            </SurfaceCard>
          )}
        </View>

        <View className="px-4 mb-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Active offers</Text>
          {offersLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-sm text-muted mt-2">Loading offers...</Text>
            </View>
          ) : topOffers.length === 0 ? (
            <EmptyStateCard
              icon="tag.fill"
              title="No offers available"
              description="Create an offer first, then invite this client directly from here."
              ctaLabel="Create Offer"
              onCtaPress={() => router.push("/(trainer)/offers/new" as any)}
            />
          ) : (
            <>
              {topOffers.map((offer: any, index: number) => (
              <Animated.View
                key={offer.id}
                style={{
                  transform: [
                    {
                      scale: offerAttentionAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.012 + index * 0.002, 1],
                      }),
                    },
                    {
                      translateY: offerAttentionAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, -1.5 - index * 0.5, 0],
                      }),
                    },
                  ],
                }}
              >
              <SurfaceCard className="mb-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row flex-1 items-center pr-3">
                    <View className="w-14 h-14 rounded-lg bg-surface border border-border overflow-hidden items-center justify-center mr-3">
                      {getOfferImageUrl(offer) ? (
                        <Image
                          source={{ uri: getOfferImageUrl(offer)! }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <IconSymbol name="photo" size={18} color={colors.muted} />
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold">{offer.title}</Text>
                      <Text className="text-sm text-muted mt-1 capitalize">
                        {offer.paymentType === "recurring" ? "Recurring" : "One-off"}
                      </Text>
                      <Text className="text-foreground font-bold mt-2">
                        {formatGBP((Number(offer.priceMinor || 0) || 0) / 100)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    className="bg-primary px-4 py-2 rounded-full"
                    onPress={() =>
                      router.push({
                        pathname: "/(trainer)/invite",
                        params: {
                          clientId: data.id,
                          clientName: data.name || "",
                          clientEmail: data.email || "",
                          clientPhone: data.phone || "",
                          bundleId: offer.id,
                          bundleTitle: offer.title || "",
                        },
                      } as any)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Invite ${data.name} to ${offer.title}`}
                    testID={`client-detail-offer-invite-${offer.id}`}
                  >
                    <Text className="text-background font-semibold">Invite</Text>
                  </TouchableOpacity>
                </View>
              </SurfaceCard>
              </Animated.View>
              ))}
              <TouchableOpacity
                className="self-start mt-1 px-1 py-2"
                onPress={() => router.push("/(trainer)/offers" as any)}
                accessibilityRole="button"
                accessibilityLabel="Show all offers"
                testID="client-detail-show-all-offers"
              >
                <Text className="text-primary font-semibold">Show all offers</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View className="px-4 pb-8">
          <Text className="text-lg font-semibold text-foreground mb-3">Payment history</Text>
          {data.paymentHistory.length === 0 ? (
            <EmptyStateCard
              icon="creditcard.fill"
              title="No payment history"
              description="Payments will appear here once this client is charged."
              ctaLabel="Take Payment"
              onCtaPress={() => router.push("/(trainer)/get-paid" as any)}
            />
          ) : (
            data.paymentHistory.map((payment: any) => (
              <SurfaceCard key={payment.id} className="mb-3">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-foreground font-semibold">{paymentLabel(payment.status)}</Text>
                    <Text className="text-xs text-muted mt-1">
                      {new Date(payment.createdAt).toLocaleDateString("en-GB")}
                    </Text>
                  </View>
                  <Text className="text-foreground font-bold">{formatGBP(payment.amount || 0)}</Text>
                </View>
              </SurfaceCard>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
