import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { getOfferFallbackImageUrl, normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBPFromMinor } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

type OfferStatus = "draft" | "in_review" | "published" | "archived";

const OFFER_STATUS_META: Record<OfferStatus, { label: string; colorKey: "success" | "warning" | "primary" | "error" }> = {
  draft: { label: "Draft", colorKey: "warning" },
  in_review: { label: "In review", colorKey: "primary" },
  published: { label: "Published", colorKey: "success" },
  archived: { label: "Archived", colorKey: "error" },
};

export default function OffersListScreen() {
  const colors = useColors();
  const { data: offers = [], isLoading, isRefetching, refetch } = trpc.offers.list.useQuery();

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        <ScreenHeader
          title="Offers"
          subtitle="Sessions, packages, and bundles in one place."
          rightSlot={(
            <TouchableOpacity
              className="bg-primary px-4 py-2 rounded-full"
              onPress={() => router.push("/(trainer)/offers/new" as any)}
              accessibilityRole="button"
              accessibilityLabel="Create new offer"
              testID="offers-new"
            >
              <Text className="text-background font-semibold">New</Text>
            </TouchableOpacity>
          )}
        />

        <View className="px-4 pb-8">
          {isLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : offers.length === 0 ? (
            <EmptyStateCard
              icon="tag.fill"
              title="No offers yet"
              description="Offers are how you get paid. Create one to start earning."
              ctaLabel="Create Offer"
              onCtaPress={() => router.push("/(trainer)/offers/new" as any)}
            />
          ) : (
            offers.map((offer: any) => (
              <TouchableOpacity
                key={offer.id}
                className="rounded-xl mb-3"
                onPress={() => router.push({ pathname: "/(trainer)/offers/new", params: { id: offer.id } } as any)}
                accessibilityRole="button"
                accessibilityLabel={`Open offer ${offer.title}`}
                testID={`offer-row-${offer.id}`}
              >
                <SurfaceCard>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-3">
                      <View className="w-12 h-12 rounded-lg bg-surface border border-border overflow-hidden mr-3">
                        <Image
                          source={{ uri: normalizeAssetUrl(offer?.imageUrl) || getOfferFallbackImageUrl(offer?.title) }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold">{offer.title}</Text>
                        <Text className="text-sm text-muted mt-1">{String(offer.type || "").replaceAll("_", " ")}</Text>
                      </View>
                    </View>
                    <View className="items-end">
                      <Text className="text-foreground font-bold">{formatGBPFromMinor(offer.priceMinor || 0)}</Text>
                      <View className="flex-row items-center mt-1">
                        {(() => {
                          const status = ((offer.status as OfferStatus) || "draft");
                          const meta = OFFER_STATUS_META[status] || OFFER_STATUS_META.draft;
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
                              <View
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: dotColor }}
                              />
                              <Text className="text-xs text-muted ml-1">{meta.label}</Text>
                            </>
                          );
                        })()}
                      </View>
                    </View>
                  </View>
                </SurfaceCard>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
