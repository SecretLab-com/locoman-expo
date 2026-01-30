import { useState, useMemo } from "react";
import { Text, View, FlatList, TextInput, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type TabType = "bundles" | "products";

export default function CoordinatorCatalogScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<TabType>("bundles");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch bundles
  const { data: bundlesData, isLoading: bundlesLoading } = trpc.catalog.bundles.useQuery();

  // Fetch products
  const { data: productsData, isLoading: productsLoading } = trpc.catalog.products.useQuery();

  const bundles = bundlesData || [];
  const products = productsData || [];

  // Filter based on search
  const filteredBundles = useMemo(() => {
    if (!searchQuery) return bundles;
    const query = searchQuery.toLowerCase();
    return bundles.filter(
      (b: any) =>
        b.title?.toLowerCase().includes(query) ||
        b.description?.toLowerCase().includes(query)
    );
  }, [bundles, searchQuery]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p: any) =>
        p.name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const isLoading = activeTab === "bundles" ? bundlesLoading : productsLoading;

  const renderBundleItem = ({ item }: { item: any }) => {
    const price = typeof item.price === "string" ? parseFloat(item.price) : item.price || 0;
    return (
      <Pressable
        onPress={() => router.push(`/bundle/${item.id}` as any)}
        style={({ pressed }) => ({
          backgroundColor: pressed ? "rgba(59, 130, 246, 0.1)" : colors.surface,
          borderRadius: 12,
          marginBottom: 12,
          overflow: "hidden",
        })}
      >
        {item.imageUrl && (
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: "100%", height: 120 }}
            contentFit="cover"
          />
        )}
        <View className="p-4">
          <Text style={{ color: colors.primary }} className="text-lg font-semibold">
            {item.title}
          </Text>
          {item.description && (
            <Text className="text-muted text-sm mt-1" numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View className="flex-row items-center justify-between mt-2">
            <Text style={{ color: colors.success }} className="font-bold">
              ${price.toFixed(2)}
            </Text>
            <View className="flex-row items-center">
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderProductItem = ({ item }: { item: any }) => {
    const price = typeof item.price === "string" ? parseFloat(item.price) : item.price || 0;
    return (
      <Pressable
        onPress={() => router.push(`/product/${item.id}` as any)}
        style={({ pressed }) => ({
          backgroundColor: pressed ? "rgba(59, 130, 246, 0.1)" : colors.surface,
          borderRadius: 12,
          marginBottom: 12,
          flexDirection: "row",
          overflow: "hidden",
        })}
      >
        {item.imageUrl && (
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: 80, height: 80 }}
            contentFit="cover"
          />
        )}
        <View className="flex-1 p-3 justify-center">
          <Text style={{ color: colors.primary }} className="font-semibold">
            {item.name}
          </Text>
          {item.description && (
            <Text className="text-muted text-sm mt-1" numberOfLines={1}>
              {item.description}
            </Text>
          )}
          <Text style={{ color: colors.success }} className="font-bold mt-1">
            ${price.toFixed(2)}
          </Text>
        </View>
        <View className="justify-center pr-3">
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </View>
      </Pressable>
    );
  };

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="pt-4 pb-2">
        <Text className="text-2xl font-bold text-white">Catalog</Text>
        <Text className="text-white/60 text-sm">Browse bundles and products</Text>
      </View>

      {/* Search */}
      <View
        className="flex-row items-center rounded-xl px-4 py-3 mb-4"
        style={{ backgroundColor: colors.surface }}
      >
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          className="flex-1 ml-3 text-base"
          style={{ color: colors.foreground }}
          placeholder="Search..."
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tabs */}
      <View className="flex-row mb-4">
        <Pressable
          onPress={() => setActiveTab("bundles")}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 20,
            backgroundColor: activeTab === "bundles" ? colors.primary : colors.surface,
            marginRight: 8,
          }}
        >
          <Text
            style={{
              color: activeTab === "bundles" ? "#FFFFFF" : colors.foreground,
              fontWeight: "600",
            }}
          >
            Bundles
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("products")}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 20,
            borderRadius: 20,
            backgroundColor: activeTab === "products" ? colors.primary : colors.surface,
          }}
        >
          <Text
            style={{
              color: activeTab === "products" ? "#FFFFFF" : colors.foreground,
              fontWeight: "600",
            }}
          >
            Products
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activeTab === "bundles" ? filteredBundles : filteredProducts}
          renderItem={activeTab === "bundles" ? renderBundleItem : renderProductItem}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              <IconSymbol
                name={activeTab === "bundles" ? "rectangle.grid.2x2.fill" : "cube.box.fill"}
                size={48}
                color={colors.muted}
              />
              <Text className="text-muted mt-4">
                No {activeTab} found
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
