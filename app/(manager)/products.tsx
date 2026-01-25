import { useState, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  inventory: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
  shopifyId?: number;
  sku?: string;
};

// Mock data for fallback
const MOCK_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "Premium Whey Protein",
    description: "High-quality whey protein isolate, 25g protein per serving",
    price: 49.99,
    inventory: 45,
    category: "Supplements",
    imageUrl: "https://placehold.co/200x200/10B981/FFFFFF?text=Protein",
    isActive: true,
    shopifyId: 123456,
  },
  {
    id: 2,
    name: "Pre-Workout Energy",
    description: "Boost your workout with clean energy and focus",
    price: 34.99,
    inventory: 8,
    category: "Supplements",
    imageUrl: "https://placehold.co/200x200/F59E0B/FFFFFF?text=PreWorkout",
    isActive: true,
    shopifyId: 123457,
  },
  {
    id: 3,
    name: "BCAA Recovery",
    description: "Branch chain amino acids for muscle recovery",
    price: 29.99,
    inventory: 0,
    category: "Supplements",
    imageUrl: "https://placehold.co/200x200/3B82F6/FFFFFF?text=BCAA",
    isActive: false,
    shopifyId: 123458,
  },
  {
    id: 4,
    name: "Resistance Bands Set",
    description: "5-piece resistance band set for home workouts",
    price: 24.99,
    inventory: 32,
    category: "Equipment",
    imageUrl: "https://placehold.co/200x200/8B5CF6/FFFFFF?text=Bands",
    isActive: true,
  },
  {
    id: 5,
    name: "Yoga Mat Premium",
    description: "Extra thick, non-slip yoga mat",
    price: 39.99,
    inventory: 15,
    category: "Equipment",
    imageUrl: "https://placehold.co/200x200/EC4899/FFFFFF?text=YogaMat",
    isActive: true,
  },
];

const CATEGORIES = ["All", "Supplements", "Equipment", "Apparel", "Accessories"];

export default function ManagerProductsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);

  // Shopify API hooks
  const shopifyProductsQuery = trpc.shopify.products.useQuery(undefined, {
    enabled: false, // Don't auto-fetch, we'll trigger manually
  });

  // Transform Shopify products when data changes
  const transformShopifyProducts = useCallback((data: typeof shopifyProductsQuery.data) => {
    if (!data) return;
    const shopifyProducts: Product[] = data.map((p) => ({
      id: p.id,
      name: p.title,
      description: p.description || "",
      price: parseFloat(p.price),
      inventory: p.inventory,
      category: p.productType || "Supplements",
      imageUrl: p.imageUrl || "https://placehold.co/200x200/10B981/FFFFFF?text=Product",
      isActive: p.status === "active",
      shopifyId: p.id,
      sku: p.sku,
    }));
    setProducts(shopifyProducts);
  }, []);

  const syncMutation = trpc.shopify.sync.useMutation({
    onSuccess: (result) => {
      Alert.alert(
        "Sync Complete",
        `Successfully synced ${result.synced} products. ${result.errors > 0 ? `${result.errors} errors occurred.` : ""}`
      );
      // Refetch products after sync
      shopifyProductsQuery.refetch();
    },
    onError: (error) => {
      Alert.alert("Sync Failed", error.message);
    },
  });

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await shopifyProductsQuery.refetch();
    } catch (error) {
      console.error("Failed to refresh products:", error);
    } finally {
      setRefreshing(false);
    }
  }, [shopifyProductsQuery]);

  const handleToggleActive = (product: Product) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const handleSyncShopify = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    Alert.alert(
      "Sync with Shopify",
      "This will sync all products from your Shopify store to the database. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync",
          onPress: async () => {
            setSyncing(true);
            try {
              await syncMutation.mutateAsync();
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  };

  const handleFetchFromShopify = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setRefreshing(true);
    try {
      const result = await shopifyProductsQuery.refetch();
      if (result.data) {
        transformShopifyProducts(result.data);
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to fetch products from Shopify");
    } finally {
      setRefreshing(false);
    }
  };

  // Stats
  const stats = {
    total: products.length,
    active: products.filter((p) => p.isActive).length,
    lowStock: products.filter((p) => p.inventory > 0 && p.inventory < 10).length,
    outOfStock: products.filter((p) => p.inventory === 0).length,
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View
      className={`bg-surface rounded-xl p-4 mb-3 border ${
        item.inventory === 0 ? "border-error/50" : "border-border"
      }`}
    >
      <View className="flex-row">
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: 80, height: 80, borderRadius: 12 }}
          contentFit="cover"
        />
        <View className="flex-1 ml-3">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <Text className="text-foreground font-semibold" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="text-muted text-sm" numberOfLines={2}>
                {item.description}
              </Text>
            </View>
            <TouchableOpacity
              className={`w-12 h-6 rounded-full justify-center ${
                item.isActive ? "bg-success" : "bg-muted/30"
              }`}
              onPress={() => handleToggleActive(item)}
            >
              <View
                className={`w-5 h-5 rounded-full bg-white ${
                  item.isActive ? "self-end mr-0.5" : "self-start ml-0.5"
                }`}
              />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center mt-2 gap-3">
            <Text className="text-primary font-bold">${item.price.toFixed(2)}</Text>
            <View
              className={`px-2 py-0.5 rounded-full ${
                item.inventory === 0
                  ? "bg-error/20"
                  : item.inventory < 10
                  ? "bg-warning/20"
                  : "bg-success/20"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  item.inventory === 0
                    ? "text-error"
                    : item.inventory < 10
                    ? "text-warning"
                    : "text-success"
                }`}
              >
                {item.inventory === 0 ? "Out of Stock" : `${item.inventory} in stock`}
              </Text>
            </View>
            {item.shopifyId && (
              <View className="px-2 py-0.5 rounded-full bg-primary/20">
                <Text className="text-xs font-medium text-primary">Shopify</Text>
              </View>
            )}
          </View>

          {item.sku && (
            <Text className="text-muted text-xs mt-1">SKU: {item.sku}</Text>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-foreground">Products</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="bg-surface border border-border px-3 py-2 rounded-xl flex-row items-center"
              onPress={handleFetchFromShopify}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.primary} />
              )}
              <Text className="text-primary font-medium ml-1">Fetch</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-primary px-3 py-2 rounded-xl flex-row items-center"
              onPress={handleSyncShopify}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <IconSymbol name="sync" size={18} color={colors.background} />
              )}
              <Text className="text-background font-medium ml-1">Sync</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border">
            <Text className="text-muted text-xs">Total</Text>
            <Text className="text-foreground text-xl font-bold">{stats.total}</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border">
            <Text className="text-muted text-xs">Active</Text>
            <Text className="text-success text-xl font-bold">{stats.active}</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border">
            <Text className="text-muted text-xs">Low Stock</Text>
            <Text className="text-warning text-xl font-bold">{stats.lowStock}</Text>
          </View>
          <View className="flex-1 bg-surface rounded-xl p-3 border border-border">
            <Text className="text-muted text-xs">Out</Text>
            <Text className="text-error text-xl font-bold">{stats.outOfStock}</Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-3 mb-3">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 py-3 px-2 text-foreground"
            placeholder="Search products..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories */}
        <View className="flex-row gap-2">
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              className={`px-3 py-1.5 rounded-full ${
                selectedCategory === cat ? "bg-primary" : "bg-surface border border-border"
              }`}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedCategory === cat ? "text-background" : "text-foreground"
                }`}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <IconSymbol name="cube.box" size={48} color={colors.muted} />
            <Text className="text-muted mt-2">No products found</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
