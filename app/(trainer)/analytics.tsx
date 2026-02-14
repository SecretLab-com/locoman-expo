import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { getOfferFallbackImageUrl, normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBP } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

export default function TrainerAnalyticsScreen() {
  const colors = useColors();
  const { data: earningsSummary, isLoading: summaryLoading } = trpc.earnings.summary.useQuery();
  const { data: offers = [], isLoading: offersLoading } = trpc.offers.list.useQuery();

  if (summaryLoading || offersLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const topOffers = [...offers]
    .sort((a: any, b: any) => (b.priceMinor || 0) - (a.priceMinor || 0))
    .slice(0, 3);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Analytics" subtitle="Present but quiet." />

        <View className="px-4 mb-4">
          <SurfaceCard>
            <Text className="text-sm text-muted">Earnings over time</Text>
            <Text className="text-2xl font-bold text-foreground mt-1">
              {formatGBP(earningsSummary?.total || 0)}
            </Text>
            <Text className="text-xs text-muted mt-2">Pending: {formatGBP(earningsSummary?.pending || 0)}</Text>
          </SurfaceCard>
        </View>

        <View className="px-4 pb-8">
          <Text className="text-lg font-semibold text-foreground mb-3">Top offers</Text>
          {topOffers.length === 0 ? (
            <EmptyStateCard
              icon="chart.bar.fill"
              title="No offer data yet"
              description="Create your first offer to start seeing performance insights."
              ctaLabel="Create Offer"
              onCtaPress={() => router.push("/(trainer)/offers/new" as any)}
            />
          ) : (
            topOffers.map((offer: any) => (
              <SurfaceCard key={offer.id} className="mb-3">
                <View className="flex-row items-center">
                  <View className="w-12 h-12 rounded-lg bg-surface border border-border overflow-hidden mr-3">
                    <Image
                      source={{ uri: normalizeAssetUrl(offer?.imageUrl) || getOfferFallbackImageUrl(offer?.title) }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold">{offer.title}</Text>
                    <Text className="text-sm text-muted mt-1">{offer.type.replaceAll("_", " ")}</Text>
                    <Text className="text-foreground font-bold mt-2">{formatGBP((offer.priceMinor || 0) / 100)}</Text>
                  </View>
                </View>
              </SurfaceCard>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
