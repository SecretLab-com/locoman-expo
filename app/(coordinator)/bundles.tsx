import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type BundleCard = {
  id: number;
  title: string;
  description?: string | null;
  price?: string | null;
  imageUrl?: string | null;
  trainerName?: string | null;
  trainerAvatar?: string | null;
};

export default function CoordinatorBundlesScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const { data, isLoading, refetch, isRefetching } = trpc.catalog.bundles.useQuery();

  const bundles: BundleCard[] = useMemo(
    () =>
      (data || []).map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        price: b.price,
        imageUrl: b.imageUrl,
        trainerName: b.trainerName || "Trainer",
        trainerAvatar: b.trainerAvatar,
      })),
    [data]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScreenContainer>
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Bundles</Text>
        <Text className="text-sm text-muted mt-1">
          Review bundles and assign them to clients
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-2">Loading bundles...</Text>
        </View>
      ) : (
        <FlatList
          data={bundles}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="mx-4 mb-3 bg-surface border border-border rounded-xl p-3 flex-row"
              onPress={() => router.push(`/bundle/${item.id}` as any)}
              accessibilityRole="button"
              accessibilityLabel={`Review ${item.title}`}
              testID={`bundle-review-${item.id}`}
            >
              <View className="w-16 h-16 rounded-lg bg-muted/30 overflow-hidden mr-3 items-center justify-center">
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} className="w-16 h-16" contentFit="cover" />
                ) : (
                  <IconSymbol name="shippingbox.fill" size={20} color={colors.muted} />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                  {item.trainerName}
                </Text>
                {item.price && (
                  <Text className="text-sm text-primary font-semibold mt-1">
                    ${item.price}
                  </Text>
                )}
              </View>
              <View className="items-center justify-center">
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing || isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View className="items-center py-12">
              <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
              <Text className="text-foreground font-semibold mt-4">No bundles yet</Text>
              <Text className="text-muted mt-2">Published bundles will appear here.</Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
