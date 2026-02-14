import { ScreenContainer } from "@/components/screen-container";
import { ShareButton } from "@/components/share-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { sanitizeHtml, stripHtml } from "@/lib/html-utils";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, useLocalSearchParams, useSegments } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import RenderHTML from "react-native-render-html";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BundleDetailScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const segmentList = segments as string[];
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bundleImageLoadFailed, setBundleImageLoadFailed] = useState(false);
  const { effectiveRole, isTrainer, isManager, isCoordinator, isClient, isAuthenticated } = useAuthContext();
  const isTrainerRoleRoute =
    segmentList.includes("(trainer)") || segmentList.includes("(manager)") || segmentList.includes("(coordinator)");
  const showInviteCta = isTrainerRoleRoute || (isAuthenticated && (isTrainer || isManager || isCoordinator));
  const canPurchase = !showInviteCta && (!isAuthenticated || isClient || effectiveRole === "shopper");

  // Fetch bundle detail from API
  const { data: rawBundle, isLoading, error } = trpc.catalog.bundleDetail.useQuery(
    { id: id || "" },
    { enabled: !!id }
  );

  // Map API response to component shape
  const bundle = useMemo(() => {
    if (!rawBundle) return null;
    const services = typeof rawBundle.servicesJson === "string"
      ? JSON.parse(rawBundle.servicesJson || "[]")
      : rawBundle.servicesJson || [];
    const goals = typeof rawBundle.goalsJson === "string"
      ? JSON.parse(rawBundle.goalsJson || "[]")
      : rawBundle.goalsJson || [];

    return {
      id: rawBundle.id,
      title: rawBundle.title,
      description: rawBundle.description || "",
      price: parseFloat(rawBundle.price || "0"),
      image: rawBundle.imageUrl || null,
      rating: (rawBundle as any).rating || 0,
      reviews: (rawBundle as any).reviewCount || 0,
      duration: rawBundle.cadence || "monthly",
      level: (rawBundle as any).level || "All Levels",
      includes: [
        ...services.map((s: any) => typeof s === "string" ? s : s.name || s.title || ""),
        ...goals.map((g: any) => typeof g === "string" ? g : g.name || g.title || ""),
      ].filter(Boolean),
    };
  }, [rawBundle]);

  const bundleImageUrl = useMemo(() => {
    return normalizeAssetUrl(bundle?.image);
  }, [bundle?.image]);

  useEffect(() => {
    setBundleImageLoadFailed(false);
  }, [bundleImageUrl]);

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading bundle...</Text>
      </ScreenContainer>
    );
  }

  if (error || !bundle) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-4">
        <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.muted} />
        <Text className="text-xl font-bold text-foreground mt-4">Bundle not found</Text>
        <Text className="text-muted text-center mt-2">
          This bundle may have been removed or is unavailable.
        </Text>
        <TouchableOpacity
          className="mt-4 bg-primary px-6 py-3 rounded-full"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text className="text-background font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const handleAddToCart = () => {
    Alert.alert("Added to Cart", `${bundle.title} has been added to your cart!`);
  };

  const handleInviteClient = () => {
    const params = {
      bundleId: id,
      bundleTitle: bundle.title,
      bundlePrice: String(bundle.price),
    };

    if (isCoordinator) {
      router.push({ pathname: "/(coordinator)/invite", params } as any);
      return;
    }
    if (isManager) {
      router.push({ pathname: "/(manager)/invite", params } as any);
      return;
    }
    router.push({ pathname: "/(trainer)/invite", params } as any);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View className="relative">
          {bundleImageUrl && !bundleImageLoadFailed ? (
            <Image
              source={{ uri: bundleImageUrl }}
              className="w-full h-72"
              contentFit="cover"
              transition={120}
              onError={() => setBundleImageLoadFailed(true)}
            />
          ) : (
            <View className="w-full h-72 bg-primary/10 items-center justify-center">
              <IconSymbol name="bag.fill" size={64} color={colors.primary} />
            </View>
          )}
          {/* Back Button */}
          <TouchableOpacity
            className="absolute left-4 w-10 h-10 rounded-full bg-primary items-center justify-center shadow-sm"
            style={{ top: insets.top + 8 }}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color="#fff" />
          </TouchableOpacity>
          {/* Share Button */}
          <View
            className="absolute right-4 w-10 h-10 rounded-full bg-primary items-center justify-center shadow-sm"
            style={{ top: insets.top + 8 }}
          >
            <ShareButton
              content={{
                type: "bundle",
                id: String(bundle.id),
                title: bundle.title,
                message: `Check out ${bundle.title} - ${stripHtml(bundle.description).slice(0, 100)}...`,
              }}
              size={20}
              color="#fff"
              className="p-0"
            />
          </View>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          <View className="flex-row items-center justify-between mb-1">
            <View className="flex-1 mr-3">
              <Text className="text-2xl font-bold text-foreground">
                {bundle.title}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-2xl font-bold text-foreground">
                ${bundle.price.toFixed(2)}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between mb-5">
            <View className="bg-primary/10 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-primary">Bundle</Text>
            </View>
            <Text className="text-xs text-muted capitalize">{bundle.duration || "one_time"}</Text>
          </View>

          {bundle.rating > 0 && (
            <View className="flex-row items-center mb-4">
              <IconSymbol name="star.fill" size={14} color={colors.warning} />
              <Text className="text-foreground ml-1 font-medium">{bundle.rating}</Text>
              <Text className="text-muted ml-1">({bundle.reviews} reviews)</Text>
            </View>
          )}

          <View className="mb-6">
            <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
            {bundle.description && /<[a-z][\s\S]*>/i.test(bundle.description) ? (
              <RenderHTML
                contentWidth={Math.max(0, width - 32)}
                source={{ html: sanitizeHtml(bundle.description) }}
                tagsStyles={{
                  p: {
                    color: colors.muted,
                    lineHeight: 20,
                    marginTop: 0,
                    marginBottom: 8,
                  },
                  strong: { color: colors.foreground, fontWeight: "600" },
                  b: { color: colors.foreground, fontWeight: "600" },
                  em: { fontStyle: "italic" },
                  i: { fontStyle: "italic" },
                  ul: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                  ol: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                  li: { color: colors.muted, marginBottom: 4 },
                  h1: { color: colors.foreground, fontSize: 18, fontWeight: "600", marginBottom: 8 },
                  h2: { color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 8 },
                  h3: { color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 },
                }}
              />
            ) : (
              <Text className="text-base text-muted leading-6">{bundle.description}</Text>
            )}
          </View>

          {bundle.includes.length > 0 && (
            <View className="mb-6">
              <Text className="text-sm font-semibold text-foreground mb-3">{"What's Included"}</Text>
              {bundle.includes.map((item: string, index: number) => (
                <View key={index} className="flex-row items-center mb-2">
                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                  <Text className="text-base text-foreground ml-3">{item}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 pt-4 pb-8">
        {showInviteCta ? (
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            onPress={handleInviteClient}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTrainer ? "Invite client to this bundle" : "Assign this bundle to a client"}
            testID="bundle-invite-cta"
          >
            <Text className="text-background font-semibold text-lg">
              {isTrainer ? "Invite Client" : "Assign to Client"}
            </Text>
          </TouchableOpacity>
        ) : canPurchase ? (
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            onPress={handleAddToCart}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add bundle to cart"
            testID="bundle-add-to-cart-cta"
          >
            <Text className="text-background font-semibold text-lg">
              Add to Cart - ${bundle.price}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            onPress={handleInviteClient}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isTrainer ? "Invite client to this bundle" : "Assign this bundle to a client"}
            testID="bundle-invite-fallback-cta"
          >
            <Text className="text-background font-semibold text-lg">
              {isTrainer ? "Invite Client" : "Assign to Client"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScreenContainer>
  );
}
