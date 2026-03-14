import { ScreenContainer } from "@/components/screen-container";
import { ScreenHeader } from "@/components/ui/screen-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LogoLoader } from "@/components/ui/logo-loader";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBPFromMinor } from "@/lib/currency";
import { mapBundleDraftToOfferView, type BundleOfferStatus } from "@/shared/bundle-offer";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

const OFFER_STATUS_META: Record<BundleOfferStatus, { label: string; colorKey: "success" | "warning" | "primary" | "error" }> = {
  draft: { label: "Draft", colorKey: "warning" },
  in_review: { label: "In review", colorKey: "primary" },
  published: { label: "Published", colorKey: "success" },
  archived: { label: "Archived", colorKey: "error" },
};

function formatOfferType(value: string | undefined) {
  return String(value || "offer")
    .replaceAll("_", " ")
    .trim()
    .toLowerCase();
}

export default function OffersListScreen() {
  const colors = useColors();
  const { data: bundles = [], isLoading, isRefetching, refetch } = trpc.bundles.list.useQuery();
  const offers = useMemo(
    () => (bundles as any[]).map((bundle) => mapBundleDraftToOfferView(bundle)),
    [bundles],
  );

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
            accessibilityLabel="Browse campaigns"
            testID="offers-browse-templates"
          >
            <SurfaceCard>
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: `${colors.primary}18` }}>
                  <IconSymbol name="rectangle.grid.2x2.fill" size={18} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">Browse Campaigns</Text>
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
              <LogoLoader size={72} />
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
                onPress={() => router.push("/bundle-editor/new" as any)}
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
                onPress={() => router.push(`/bundle-editor/${offer.id}` as any)}
                accessibilityRole="button"
                accessibilityLabel={`Open offer ${offer.title}`}
                testID={`offer-row-${offer.id}`}
              >
                <SurfaceCard>
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 pr-3">
                      <View className="w-12 h-12 rounded-lg bg-surface border border-border overflow-hidden items-center justify-center mr-3">
                        {normalizeAssetUrl(offer?.imageUrl) ? (
                          <Image
                            source={{ uri: normalizeAssetUrl(offer?.imageUrl) as string }}
                            style={{ width: "100%", height: "100%" }}
                            contentFit="cover"
                          />
                        ) : (
                          <IconSymbol name="photo" size={16} color={colors.muted} />
                        )}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-start justify-between">
                          <Text className="text-foreground font-semibold flex-1 pr-2" numberOfLines={2}>
                            {offer.title}
                          </Text>
                          <Text className="text-foreground font-bold">
                            {formatGBPFromMinor(offer.priceMinor || 0)}
                          </Text>
                        </View>
                        <View className="flex-row items-center mt-2">
                          <View
                            className="px-2 py-1 rounded-full border mr-2"
                            style={{
                              backgroundColor: "rgba(148,163,184,0.16)",
                              borderColor: "rgba(148,163,184,0.24)",
                            }}
                          >
                            <Text className="text-[11px] text-muted">
                              {formatOfferType(offer.type)}
                            </Text>
                          </View>
                          {(() => {
                            const status = ((offer.status as BundleOfferStatus) || "draft");
                            const meta = OFFER_STATUS_META[status] || OFFER_STATUS_META.draft;
                            const tone =
                              meta.colorKey === "success"
                                ? {
                                    text: colors.success,
                                    bg: "rgba(52,211,153,0.16)",
                                    border: "rgba(52,211,153,0.34)",
                                  }
                                : meta.colorKey === "primary"
                                  ? {
                                      text: colors.primary,
                                      bg: "rgba(96,165,250,0.16)",
                                      border: "rgba(96,165,250,0.34)",
                                    }
                                  : meta.colorKey === "error"
                                    ? {
                                        text: colors.error,
                                        bg: "rgba(248,113,113,0.16)",
                                        border: "rgba(248,113,113,0.34)",
                                      }
                                    : {
                                        text: colors.warning,
                                        bg: "rgba(245,158,11,0.16)",
                                        border: "rgba(245,158,11,0.34)",
                                      };
                            return (
                              <View
                                className="px-2 py-1 rounded-full border"
                                style={{
                                  backgroundColor: tone.bg,
                                  borderColor: tone.border,
                                }}
                              >
                                <Text
                                  className="text-[11px] font-medium"
                                  style={{ color: tone.text }}
                                >
                                  {meta.label}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
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
        onPress={() => router.push("/bundle-editor/new" as any)}
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
