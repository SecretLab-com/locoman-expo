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
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  inventory: number;
  category: string;
  imageUrl: string;
  isActive: boolean;
  shopifyId?: string;
};

// Mock data
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
    shopifyId: "gid://shopify/Product/1234567890",
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
    shopifyId: "gid://shopify/Product/1234567891",
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
    shopifyId: "gid://shopify/Product/1234567892",
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);

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
    // Sync with Shopify
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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
      "This will sync all products with your Shopify store. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync",
          onPress: () => {
            // Simulate sync
            Alert.alert("Success", "Products synced with Shopify!");
          },
        },
      ]
    );
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
              className={`px-2 py-0.5 rounded ${
                item.inventory === 0
                  ? "bg-error/10"
                  : item.inventory < 10
                  ? "bg-warning/10"
                  : "bg-success/10"
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
            <Text className="text-muted text-xs">{item.category}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="flex-row items-center justify-between py-4">
        <Text className="text-2xl font-bold text-foreground">Products</Text>
        <TouchableOpacity
          className="flex-row items-center bg-primary px-4 py-2 rounded-lg"
          onPress={handleSyncShopify}
        >
          <IconSymbol name="arrow.triangle.2.circlepath" size={16} color="#fff" />
          <Text className="text-background font-medium ml-2">Sync</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View className="flex-row gap-2 mb-4">
        <View className="flex-1 bg-surface rounded-lg p-3 items-center border border-border">
          <Text className="text-xl font-bold text-foreground">{stats.total}</Text>
          <Text className="text-xs text-muted">Total</Text>
        </View>
        <View className="flex-1 bg-success/10 rounded-lg p-3 items-center">
          <Text className="text-xl font-bold text-success">{stats.active}</Text>
          <Text className="text-xs text-muted">Active</Text>
        </View>
        <View className="flex-1 bg-warning/10 rounded-lg p-3 items-center">
          <Text className="text-xl font-bold text-warning">{stats.lowStock}</Text>
          <Text className="text-xs text-muted">Low Stock</Text>
        </View>
        <View className="flex-1 bg-error/10 rounded-lg p-3 items-center">
          <Text className="text-xl font-bold text-error">{stats.outOfStock}</Text>
          <Text className="text-xs text-muted">Out</Text>
        </View>
      </View>

      {/* Search */}
      <View className="mb-4">
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-2 text-foreground"
            placeholder="Search products..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View className="mb-4">
        <FlatList
          horizontal
          data={CATEGORIES}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`px-4 py-2 rounded-full mr-2 ${
                selectedCategory === item ? "bg-primary" : "bg-surface border border-border"
              }`}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedCategory === item ? "text-background" : "text-foreground"
                }`}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item}
        />
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
            <Text className="text-muted mt-4">No products found</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
