import { ScreenContainer } from "@/components/screen-container";
import { ShareButton } from "@/components/share-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { sanitizeHtml, stripHtml } from "@/lib/html-utils";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
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

export default function BundleDetailScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isFavorite, setIsFavorite] = useState(false);
  const { effectiveRole, isTrainer, isManager, isCoordinator, isClient } = useAuthContext();
  const canPurchase = isClient || effectiveRole === "shopper" || !effectiveRole;

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
      trainerName: (rawBundle as any).trainerName || "Trainer",
      trainerAvatar: (rawBundle as any).trainerAvatar || null,
      trainerBio: (rawBundle as any).trainerBio || "",
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
      trainerName: bundle.trainerName,
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

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View className="relative">
          {bundle.image ? (
            <Image
              source={{ uri: bundle.image }}
              className="w-full h-72"
              contentFit="cover"
            />
          ) : (
            <View className="w-full h-72 bg-primary/10 items-center justify-center">
              <IconSymbol name="bag.fill" size={64} color={colors.primary} />
            </View>
          )}
          {/* Back Button */}
          <TouchableOpacity
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-primary items-center justify-center shadow-sm"
            onPress={() => router.back()}
          >
            <IconSymbol name="arrow.left" size={20} color="#fff" />
          </TouchableOpacity>
          {/* Share Button */}
          <View className="absolute top-4 right-16 w-10 h-10 rounded-full bg-primary items-center justify-center shadow-sm">
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
          {/* Favorite Button — offset below ProfileFAB */}
          <TouchableOpacity
            className="absolute top-14 right-4 w-10 h-10 rounded-full bg-primary items-center justify-center shadow-sm"
            onPress={handleToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? "Remove from favorites" : "Add to favorites"}
            testID="bundle-favorite"
          >
            <IconSymbol
              name={isFavorite ? "heart.fill" : "heart"}
              size={20}
              color={isFavorite ? "#FF6B6B" : "#fff"}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* Title and Price */}
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1 mr-4">
              <Text className="text-2xl font-bold text-foreground">{bundle.title}</Text>
              {bundle.rating > 0 && (
                <View className="flex-row items-center mt-2">
                  <IconSymbol name="star.fill" size={16} color={colors.warning} />
                  <Text className="text-foreground ml-1 font-medium">{bundle.rating}</Text>
                  <Text className="text-muted ml-1">({bundle.reviews} reviews)</Text>
                </View>
              )}
            </View>
            <Text className="text-2xl font-bold text-primary">${bundle.price}</Text>
          </View>

          {/* Trainer Info */}
          <TouchableOpacity className="flex-row items-center bg-surface rounded-xl p-4 mb-6">
            {bundle.trainerAvatar ? (
              <Image
                source={{ uri: bundle.trainerAvatar }}
                className="w-12 h-12 rounded-full"
              />
            ) : (
              <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                <Text className="text-primary font-bold text-lg">
                  {bundle.trainerName.charAt(0)}
                </Text>
              </View>
            )}
            <View className="ml-4 flex-1">
              <Text className="text-base font-semibold text-foreground">
                {bundle.trainerName}
              </Text>
              <Text className="text-sm text-muted">{bundle.trainerBio}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>

          {/* Quick Info */}
          <View className="flex-row mb-6">
            <View className="flex-1 bg-surface rounded-xl p-4 mr-2 items-center">
              <IconSymbol name="clock.fill" size={24} color={colors.primary} />
              <Text className="text-sm text-muted mt-2">Duration</Text>
              <Text className="text-base font-semibold text-foreground">{bundle.duration}</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-4 ml-2 items-center">
              <IconSymbol name="chart.bar.fill" size={24} color={colors.primary} />
              <Text className="text-sm text-muted mt-2">Level</Text>
              <Text className="text-base font-semibold text-foreground">{bundle.level}</Text>
            </View>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">About</Text>
            {bundle.description && /<[a-z][\s\S]*>/i.test(bundle.description) ? (
              <RenderHTML
                contentWidth={width - 48}
                source={{ html: sanitizeHtml(bundle.description) }}
                tagsStyles={{
                  p: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 0, marginBottom: 8 },
                  strong: { color: colors.foreground, fontWeight: "600" },
                  b: { color: colors.foreground, fontWeight: "600" },
                  em: { fontStyle: "italic" },
                  ul: { color: colors.muted, paddingLeft: 16 },
                  ol: { color: colors.muted, paddingLeft: 16 },
                  li: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 4 },
                  h1: { color: colors.foreground, fontSize: 20, fontWeight: "700", marginBottom: 8 },
                  h2: { color: colors.foreground, fontSize: 18, fontWeight: "700", marginBottom: 6 },
                  h3: { color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 4 },
                }}
              />
            ) : (
              <Text className="text-base text-muted leading-6">{bundle.description}</Text>
            )}
          </View>

          {/* What's Included */}
          {bundle.includes.length > 0 && (
            <View className="mb-6">
              <Text className="text-lg font-semibold text-foreground mb-3">{"What's Included"}</Text>
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
        {canPurchase ? (
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            onPress={handleAddToCart}
            activeOpacity={0.8}
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
