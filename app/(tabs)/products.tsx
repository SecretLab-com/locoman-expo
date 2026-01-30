import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/cart-context";

type Product = {
  id: number;
  shopifyProductId: number | null;
  shopifyVariantId: number | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  compareAtPrice: string | null;
  brand: string | null;
  category: string | null;
  phase: string | null;
  fulfillmentOptions: unknown;
  inventoryQuantity: number | null;
  availability: string | null;
  isApproved: boolean | null;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export default function ProductsScreen() {
  const colors = useColors();
  const { addItem } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // Fetch products via tRPC
  const { data: products, isLoading, refetch, isRefetching } = trpc.catalog.products.useQuery(undefined, {
    staleTime: 60000,
  });

  // Category options
  const categories = [
    { value: "all", label: "All" },
    { value: "protein", label: "Protein" },
    { value: "pre_workout", label: "Pre-Workout" },
    { value: "post_workout", label: "Post-Workout" },
    { value: "recovery", label: "Recovery" },
    { value: "strength", label: "Strength" },
    { value: "wellness", label: "Wellness" },
    { value: "hydration", label: "Hydration" },
    { value: "vitamins", label: "Vitamins" },
  ];

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let result = products.filter((product: Product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.brand || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Sort
    if (sortBy === "price_low") {
      result = [...result].sort(
        (a: Product, b: Product) => parseFloat(a.price) - parseFloat(b.price)
      );
    } else if (sortBy === "price_high") {
      result = [...result].sort(
        (a: Product, b: Product) => parseFloat(b.price) - parseFloat(a.price)
      );
    } else if (sortBy === "name") {
      result = [...result].sort((a: Product, b: Product) => a.name.localeCompare(b.name));
    }

    return result;
  }, [products, searchQuery, selectedCategory, sortBy]);

  // Handle add to cart
  const handleAddToCart = (product: Product) => {
    addItem({
      type: "product",
      title: product.name,
      price: parseFloat(product.price),
      quantity: 1,
      imageUrl: product.imageUrl || undefined,
      productId: product.id,
      fulfillment: "home_ship",
    });
  };

  // Open product detail
  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setDetailModalOpen(true);
  };

  // Get category label
  const getCategoryLabel = (category: string | null) => {
    if (!category) return null;
    const cat = categories.find((c) => c.value === category);
    return cat?.label || category.replace(/_/g, " ");
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Products</Text>
        <Text className="text-sm text-muted mt-1">Browse wellness products</Text>
      </View>

      {/* Search Bar */}
      <View className="px-4 mb-3">
        <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 border border-border">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            placeholder="Search products..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-foreground text-base"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters Row */}
      <View className="flex-row px-4 mb-4 gap-2">
        <TouchableOpacity
          onPress={() => setFilterModalOpen(true)}
          className="flex-row items-center bg-surface rounded-lg px-3 py-2 border border-border"
        >
          <IconSymbol name="line.3.horizontal.decrease" size={16} color={colors.foreground} />
          <Text className="text-foreground ml-2 text-sm">
            {selectedCategory === "all" ? "All Categories" : getCategoryLabel(selectedCategory)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            const sorts = ["popular", "price_low", "price_high", "name"];
            const currentIndex = sorts.indexOf(sortBy);
            setSortBy(sorts[(currentIndex + 1) % sorts.length]);
          }}
          className="flex-row items-center bg-surface rounded-lg px-3 py-2 border border-border"
        >
          <IconSymbol name="arrow.up.arrow.down" size={16} color={colors.foreground} />
          <Text className="text-foreground ml-2 text-sm">
            {sortBy === "popular" ? "Popular" : sortBy === "price_low" ? "Price ↑" : sortBy === "price_high" ? "Price ↓" : "A-Z"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-3">Loading products...</Text>
        </View>
      )}

      {/* Results Count */}
      {!isLoading && (
        <Text className="px-4 text-sm text-muted mb-3">
          Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
        </Text>
      )}

      {/* Product Grid */}
      {!isLoading && (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        >
          <View className="flex-row flex-wrap justify-between pb-24">
            {filteredProducts.map((product: Product) => {
              const price = parseFloat(product.price);
              const comparePrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
              const inStock = product.availability === "available" && (product.inventoryQuantity || 0) > 0;

              return (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => openProductDetail(product)}
                  className="w-[48%] mb-4 bg-surface rounded-xl overflow-hidden border border-border"
                  style={{ opacity: inStock ? 1 : 0.6 }}
                >
                  {/* Image */}
                  <View className="aspect-square bg-background items-center justify-center">
                    {product.imageUrl ? (
                      <Image
                        source={{ uri: product.imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <IconSymbol name="cube.box" size={40} color={colors.muted} />
                    )}
                  </View>

                  {/* Content */}
                  <View className="p-3">
                    {product.category && (
                      <View className="bg-primary/10 self-start px-2 py-0.5 rounded mb-1">
                        <Text className="text-xs text-primary">{getCategoryLabel(product.category)}</Text>
                      </View>
                    )}
                    
                    <View className="flex-row items-center">
                      <Text className="text-lg font-bold text-foreground">${price.toFixed(2)}</Text>
                      {comparePrice && comparePrice > price && (
                        <Text className="text-sm text-muted line-through ml-2">${comparePrice.toFixed(2)}</Text>
                      )}
                    </View>
                    
                    <Text className="text-sm text-foreground mt-1" numberOfLines={2}>
                      {product.name}
                    </Text>

                    {/* Stock status */}
                    <View className="flex-row items-center mt-2">
                      <View
                        className={`w-2 h-2 rounded-full ${inStock ? "bg-success" : "bg-error"}`}
                      />
                      <Text
                        className={`text-xs ml-1 ${inStock ? "text-success" : "text-error"}`}
                      >
                        {inStock ? `${product.inventoryQuantity} in stock` : "Out of stock"}
                      </Text>
                    </View>

                    {/* Brand */}
                    {product.brand && (
                      <Text className="text-xs text-muted mt-1">by {product.brand}</Text>
                    )}
                  </View>

                  {/* Add to Cart Button */}
                  <View className="px-3 pb-3">
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                      disabled={!inStock}
                      className={`py-2 rounded-lg items-center ${inStock ? "bg-primary" : "bg-muted"}`}
                    >
                      <Text className={`font-semibold ${inStock ? "text-white" : "text-foreground"}`}>
                        {inStock ? "Add to Cart" : "Sold Out"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Empty State */}
          {filteredProducts.length === 0 && (
            <View className="items-center py-16">
              <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                <IconSymbol name="magnifyingglass" size={32} color={colors.muted} />
              </View>
              <Text className="text-lg font-semibold text-foreground mb-2">No products found</Text>
              <Text className="text-muted text-center mb-4">
                Try adjusting your search or filter criteria
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="px-4 py-2 border border-border rounded-lg"
              >
                <Text className="text-foreground">Clear filters</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setFilterModalOpen(false)}
        >
          <View className="bg-background rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-foreground mb-4">Filter by Category</Text>
            
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                onPress={() => {
                  setSelectedCategory(cat.value);
                  setFilterModalOpen(false);
                }}
                className={`py-3 px-4 rounded-lg mb-2 ${selectedCategory === cat.value ? "bg-primary" : "bg-surface"}`}
              >
                <Text className={selectedCategory === cat.value ? "text-white font-semibold" : "text-foreground"}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setFilterModalOpen(false)}
              className="py-3 mt-4"
            >
              <Text className="text-center text-muted">Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Product Detail Modal */}
      <Modal
        visible={detailModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setDetailModalOpen(false)}
        >
          <View className="bg-background rounded-t-3xl max-h-[85%]">
            {selectedProduct && (
              <ScrollView>
                {/* Image */}
                <View className="aspect-square bg-surface">
                  {selectedProduct.imageUrl ? (
                    <Image
                      source={{ uri: selectedProduct.imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <IconSymbol name="cube.box" size={60} color={colors.muted} />
                    </View>
                  )}
                </View>

                {/* Content */}
                <View className="p-6">
                  {selectedProduct.category && (
                    <View className="bg-primary/10 self-start px-3 py-1 rounded-full mb-2">
                      <Text className="text-sm text-primary">{getCategoryLabel(selectedProduct.category)}</Text>
                    </View>
                  )}

                  <View className="flex-row items-center mb-1">
                    <Text className="text-2xl font-bold text-foreground">
                      ${parseFloat(selectedProduct.price).toFixed(2)}
                    </Text>
                    {selectedProduct.compareAtPrice && parseFloat(selectedProduct.compareAtPrice) > parseFloat(selectedProduct.price) && (
                      <Text className="text-lg text-muted line-through ml-2">
                        ${parseFloat(selectedProduct.compareAtPrice).toFixed(2)}
                      </Text>
                    )}
                  </View>
                  
                  <Text className="text-lg font-semibold text-foreground mb-3">
                    {selectedProduct.name}
                  </Text>

                  {/* Stock */}
                  <View className="flex-row items-center mb-4">
                    <View
                      className={`w-2 h-2 rounded-full ${
                        selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                          ? "bg-success"
                          : "bg-error"
                      }`}
                    />
                    <Text
                      className={`text-sm ml-2 ${
                        selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                          ? "text-success"
                          : "text-error"
                      }`}
                    >
                      {selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                        ? `${selectedProduct.inventoryQuantity} in stock`
                        : "Out of stock"}
                    </Text>
                  </View>

                  {/* Description */}
                  {selectedProduct.description && (
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
                      <Text className="text-muted leading-5">
                        {selectedProduct.description}
                      </Text>
                    </View>
                  )}

                  {/* Brand */}
                  {selectedProduct.brand && (
                    <View className="flex-row items-center mb-4">
                      <Text className="text-sm text-muted">Brand: </Text>
                      <Text className="text-sm font-semibold text-foreground">{selectedProduct.brand}</Text>
                    </View>
                  )}

                  {/* Phase */}
                  {selectedProduct.phase && (
                    <View className="flex-row items-center mb-4">
                      <Text className="text-sm text-muted">Best for: </Text>
                      <Text className="text-sm font-semibold text-foreground capitalize">
                        {selectedProduct.phase.replace(/_/g, " ")}
                      </Text>
                    </View>
                  )}

                  {/* Add to Cart Button */}
                  <TouchableOpacity
                    onPress={() => {
                      handleAddToCart(selectedProduct);
                      setDetailModalOpen(false);
                    }}
                    disabled={selectedProduct.availability !== "available" || (selectedProduct.inventoryQuantity || 0) <= 0}
                    className={`py-4 rounded-xl items-center flex-row justify-center ${
                      selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  >
                    <IconSymbol
                      name="cart"
                      size={20}
                      color={
                        selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                          ? "#fff"
                          : colors.foreground
                      }
                    />
                    <Text
                      className={`font-semibold ml-2 ${
                        selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                          ? "text-white"
                          : "text-foreground"
                      }`}
                    >
                      {selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                        ? "Add to Cart"
                        : "Sold Out"}
                    </Text>
                  </TouchableOpacity>

                  {/* Close Button */}
                  <TouchableOpacity
                    onPress={() => setDetailModalOpen(false)}
                    className="py-3 mt-3"
                  >
                    <Text className="text-center text-muted">Close</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
