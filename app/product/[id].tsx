import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Image, ScrollView, Text, View } from "react-native";

export default function ProductDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: products, isLoading } = trpc.catalog.products.useQuery();

  const product = (products || []).find((p: any) => String(p.id) === id);

  if (isLoading) {
    return (
      <ScreenContainer>
        <NavigationHeader title="Product" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!product) {
    return (
      <ScreenContainer>
        <NavigationHeader title="Product" showBack />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted text-center">Product not found.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const p = product as any;
  const inStock = p.availability === "available" && (p.inventoryQuantity || 0) > 0;

  return (
    <ScreenContainer>
      <NavigationHeader title="Product details" showBack />
      <ScrollView showsVerticalScrollIndicator={false}>
        {p.imageUrl ? (
          <Image
            source={{ uri: p.imageUrl }}
            style={{ width: "100%", height: 280 }}
            resizeMode="contain"
          />
        ) : (
          <View style={{ width: "100%", height: 180, backgroundColor: colors.surface }} className="items-center justify-center">
            <IconSymbol name="bag.fill" size={48} color={colors.muted} />
          </View>
        )}

        <View className="px-5 pt-4 pb-8">
          <View className="flex-row items-start justify-between mb-1">
            <Text className="text-xl font-bold text-foreground flex-1 pr-3">{p.name}</Text>
            <Text className="text-xl font-bold text-foreground">${parseFloat(p.price).toFixed(2)}</Text>
          </View>

          <View className="flex-row items-center justify-between mb-4">
            {p.category ? (
              <View className="bg-primary/10 px-2.5 py-1 rounded-full">
                <Text className="text-xs text-primary capitalize">{p.category}</Text>
              </View>
            ) : <View />}
            <View className="flex-row items-center">
              <View className={`w-2 h-2 rounded-full ${inStock ? "bg-success" : "bg-error"}`} />
              <Text className={`text-xs ml-1.5 ${inStock ? "text-success" : "text-error"}`}>
                {inStock ? `${p.inventoryQuantity} in stock` : "Out of stock"}
              </Text>
            </View>
          </View>

          {p.description ? (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
              <Text className="text-sm text-muted leading-5">{p.description.replace(/<[^>]*>/g, "")}</Text>
            </View>
          ) : null}

          {(p.brand || p.phase) ? (
            <View className="mb-4 gap-1">
              {p.brand && (
                <View className="flex-row">
                  <Text className="text-sm text-muted">Brand: </Text>
                  <Text className="text-sm font-medium text-foreground">{p.brand}</Text>
                </View>
              )}
              {p.phase && (
                <View className="flex-row">
                  <Text className="text-sm text-muted">Phase: </Text>
                  <Text className="text-sm font-medium text-foreground capitalize">{p.phase}</Text>
                </View>
              )}
            </View>
          ) : null}

          {p.isSponsored && p.trainerBonus && (
            <View className="bg-success/10 rounded-xl p-4 flex-row items-center">
              <IconSymbol name="star.fill" size={16} color={colors.success} />
              <View className="ml-3">
                <Text className="text-sm font-semibold" style={{ color: colors.success }}>
                  +${p.trainerBonus} trainer bonus per sale
                </Text>
                {p.sponsoredBy && (
                  <Text className="text-xs text-muted mt-0.5">Sponsored by {p.sponsoredBy}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
