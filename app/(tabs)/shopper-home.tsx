import { OfflineBadge } from "@/components/offline-indicator";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useOffline } from "@/contexts/offline-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Bundle = {
  id: number;
  title: string;
  description: string | null;
  price: string | number | null;
  imageUrl: string | null;
  trainerName?: string;
  trainerAvatar?: string;
  rating?: number;
  reviews?: number;
};

function BundleCard({ bundle, onPress }: { bundle: Bundle; onPress: () => void }) {
  const colors = useColors();
  const price = typeof bundle.price === "string" ? parseFloat(bundle.price) : bundle.price || 0;

  const handlePress = async () => {
    await haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      className="bg-surface rounded-2xl overflow-hidden mb-4 border border-border"
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: bundle.imageUrl || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400" }}
        className="w-full h-40"
        contentFit="cover"
        placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"
      />
      <View className="p-4">
        <Text className="text-lg font-semibold text-foreground mb-1" numberOfLines={1}>
          {bundle.title}
        </Text>
        <Text className="text-sm text-muted mb-3" numberOfLines={2}>
          {bundle.description || "No description available"}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {bundle.trainerAvatar && (
              <Image
                source={{ uri: bundle.trainerAvatar }}
                className="w-6 h-6 rounded-full mr-2"
              />
            )}
            <Text className="text-sm text-muted">{bundle.trainerName || "Trainer"}</Text>
          </View>
          <Text className="text-lg font-bold text-primary">${price.toFixed(2)}</Text>
        </View>

        {bundle.rating !== undefined && (
          <View className="flex-row items-center mt-2">
            <IconSymbol name="star.fill" size={14} color={colors.warning} />
            <Text className="text-sm text-foreground ml-1">{bundle.rating.toFixed(1)}</Text>
            <Text className="text-sm text-muted ml-1">({bundle.reviews || 0} reviews)</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ShopperHome() {
  const colors = useColors();
  const { isAuthenticated } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");
  const { isOnline, getCachedBundles, cacheBundles } = useOffline();
  const [cachedBundles, setCachedBundles] = useState<Bundle[]>([]);
  const [usingCache, setUsingCache] = useState(false);

  // Fetch bundles from API
  const {
    data: bundlesData,
    isLoading,
    refetch,
    isRefetching,
    isError,
  } = trpc.catalog.bundles.useQuery(undefined, {
    enabled: isOnline,
    retry: isOnline ? 1 : 0,
  });

  // Load cached data on mount
  useEffect(() => {
    async function loadCache() {
      const cached = await getCachedBundles();
      if (cached) {
        setCachedBundles(
          cached.map((b: any) => ({
            id: b.id,
            title: b.title,
            description: b.description,
            price: b.price,
            imageUrl: b.imageUrl,
            trainerName: b.trainerName || "Trainer",
            trainerAvatar: b.trainerAvatar,
            rating: b.rating,
            reviews: b.reviewCount,
          }))
        );
      }
    }
    loadCache();
  }, [getCachedBundles]);

  // Cache bundles when fetched
  useEffect(() => {
    if (bundlesData && bundlesData.length > 0) {
      cacheBundles(bundlesData);
      setUsingCache(false);
    }
  }, [bundlesData, cacheBundles]);

  // Determine which data to show
  const allBundles: Bundle[] = bundlesData
    ? bundlesData.map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        price: b.price,
        imageUrl: b.imageUrl,
        trainerName: b.trainerName || "Trainer",
        trainerAvatar: b.trainerAvatar,
        rating: b.rating,
        reviews: b.reviewCount,
      }))
    : cachedBundles;

  // Set using cache flag
  useEffect(() => {
    if (!isOnline || isError) {
      setUsingCache(cachedBundles.length > 0);
    }
  }, [isOnline, isError, cachedBundles.length]);

  // Client-side filtering
  const bundles = searchQuery
    ? allBundles.filter(
        (b) =>
          b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (b.trainerName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : allBundles;

  const handleBundlePress = (bundle: Bundle) => {
    router.push(`/bundle/${bundle.id}` as any);
  };

  const handleRefresh = async () => {
    await haptics.light();
    if (isOnline) {
      refetch();
    }
  };

  const handleLoginPress = async () => {
    await haptics.light();
    router.push("/login");
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-foreground">Discover</Text>
            <View className="flex-row items-center">
              <Text className="text-sm text-muted">Find your perfect fitness program</Text>
              {usingCache && (
                <View className="ml-2">
                  <OfflineBadge />
                </View>
              )}
            </View>
          </View>
          {!isAuthenticated && (
            <TouchableOpacity
              className="bg-primary px-4 py-2 rounded-full"
              onPress={handleLoginPress}
            >
              <Text className="text-background font-semibold">Login</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-foreground"
            placeholder="Search bundles or trainers..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bundle List */}
      {isLoading && !usingCache ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading bundles...</Text>
        </View>
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>
          <FlatList
            data={bundles}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <BundleCard bundle={item} onPress={() => handleBundlePress(item)} />
            )}
            style={{ flex: 1, minHeight: 0 }}
            scrollEnabled
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <View className="items-center py-12">
                <IconSymbol name="magnifyingglass" size={48} color={colors.muted} />
                <Text className="text-muted text-center mt-4">
                  {!isOnline ? "You're offline" : "No bundles found"}
                </Text>
                <Text className="text-muted text-center text-sm mt-1">
                  {!isOnline
                    ? "Connect to the internet to browse bundles"
                    : "Try adjusting your search"}
                </Text>
              </View>
            }
          />
        </View>
      )}
    </ScreenContainer>
  );
}
