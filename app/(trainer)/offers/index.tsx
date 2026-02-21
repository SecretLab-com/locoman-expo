import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/ui/screen-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
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
        />

        <View className="px-4 mb-4">
          <TouchableOpacity
            onPress={() => router.push("/(trainer)/templates" as any)}
            accessibilityRole="button"
            accessibilityLabel="Browse offer templates"
            testID="offers-browse-templates"
          >
            <SurfaceCard>
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: `${colors.primary}18` }}>
                  <IconSymbol name="rectangle.grid.2x2.fill" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Browse Templates</Text>
                  <Text className="text-xs text-muted mt-0.5">Find a ready-made starting point</Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </View>
            </SurfaceCard>
          </TouchableOpacity>
        </View>

        <View className="px-4 pb-8">
          {isLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : offers.length === 0 ? (
            <View className="bg-surface rounded-xl border border-border p-6 items-center">
              <IconSymbol name="tag.fill" size={36} color={colors.muted} />
              <Text className="text-foreground font-semibold text-base mt-3">No offers yet</Text>
              <Text className="text-sm text-muted mt-1 text-center">
                Offers are how you get paid. Create one to start earning.
              </Text>
              <TouchableOpacity
                className="flex-row items-center mt-4"
                onPress={() => router.push("/(trainer)/offers/new" as any)}
                accessibilityRole="button"
                accessibilityLabel="Create new offer"
              >
                <Text className="text-sm text-muted mr-2">Tap the</Text>
                <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
                  <IconSymbol name="plus" size={16} color="#fff" />
                </View>
                <Text className="text-sm text-muted ml-2">to get started</Text>
              </TouchableOpacity>
            </View>
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

      <TouchableOpacity
        onPress={() => router.push("/(trainer)/offers/new" as any)}
        className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{ right: 16, bottom: 16 }}
        accessibilityRole="button"
        accessibilityLabel="Create new offer"
        testID="offers-add-fab"
      >
        <IconSymbol name="plus" size={24} color="#fff" />
      </TouchableOpacity>
    </ScreenContainer>
  );
}
