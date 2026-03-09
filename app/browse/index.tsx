/**
 * Browse Screen - Stack-based products browsing
 * 
 * This screen allows users to browse products without switching tab groups.
 * It's accessed from the client dashboard "Discover More" button and opens
 * as a stack screen on top of the current tab layout.
 * 
 * Per Navigation_Overview.md: Shared screens must live in the root stack
 * so the tab bar stays stable underneath.
 */
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Product = {
  id: string;
  name: string;
  price: number | string | null;
  imageUrl: string | null;
  category: string | null;
};

function formatPrice(price: number | string | null | undefined): string {
  if (price == null) return "$0.00";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (Number.isNaN(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="flex-1 m-2 bg-surface rounded-xl overflow-hidden border border-border"
      onPress={onPress}
      activeOpacity={0.8}
    >
      {product.imageUrl ? (
        <Image
          source={{ uri: product.imageUrl }}
          className="w-full h-32"
          contentFit="cover"
        />
      ) : (
        <View className="w-full h-32 items-center justify-center bg-muted/20">
          <IconSymbol name="cube.box.fill" size={32} color={colors.muted} />
        </View>
      )}
      <View className="p-3">
        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
          {product.name}
        </Text>
        <Text className="text-xs text-muted mt-1">{product.category || "Product"}</Text>
        <Text className="text-sm font-semibold text-primary mt-2">
          {formatPrice(product.price)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function BrowseScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: products = [], refetch, isLoading } = trpc.catalog.products.useQuery();

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleProductPress = (product: Product) => {
    // Navigate to bundle detail or product detail
    router.push(`/bundle/${product.id}` as any);
  };

  return (
    <ScreenContainer>
      {/* Search Bar */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-foreground"
            placeholder="Search products..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Products Grid */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item }) => (
          <ProductCard product={item} onPress={() => handleProductPress(item)} />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-16">
            {isLoading ? (
              <Text className="text-muted">Loading products...</Text>
            ) : (
              <>
                <IconSymbol name="cube.box.fill" size={48} color={colors.muted} />
                <Text className="text-muted mt-4">No products found</Text>
              </>
            )}
          </View>
        }
      />
    </ScreenContainer>
  );
}
