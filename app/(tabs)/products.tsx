import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import RenderHTML from "react-native-render-html";

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

const ALLOWED_DESCRIPTION_TAGS = [
  "p",
  "strong",
  "b",
  "em",
  "i",
  "ul",
  "ol",
  "li",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

const sanitizeDescriptionHtml = (html: string) => {
  let sanitized = html;
  sanitized = sanitized.replace(
    /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  sanitized = sanitized.replace(
    /<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/\s*>/gi,
    "",
  );
  sanitized = sanitized.replace(/\son\w+="[^"]*"/gi, "");
  sanitized = sanitized.replace(/\son\w+='[^']*'/gi, "");
  sanitized = sanitized.replace(/\sstyle="[^"]*"/gi, "");
  sanitized = sanitized.replace(/\sstyle='[^']*'/gi, "");
  sanitized = sanitized.replace(/<(\/?)(\w+)([^>]*)>/g, (match, slash, tag) => {
    const lowerTag = String(tag).toLowerCase();
    if (!ALLOWED_DESCRIPTION_TAGS.includes(lowerTag)) {
      return "";
    }
    if (!slash && lowerTag === "br") {
      return "<br/>";
    }
    return `<${slash}${lowerTag}>`;
  });
  return sanitized;
};

export default function ProductsScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { canManage, effectiveRole, isClient } = useAuthContext();
  const canPurchase = isClient || effectiveRole === "shopper" || !effectiveRole;
  const { width } = useWindowDimensions();
  const overlayColor = colorScheme === "dark"
    ? "rgba(0, 0, 0, 0.5)"
    : "rgba(15, 23, 42, 0.18)";
  const { addItem } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [imageZoomOpen, setImageZoomOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { sort, q } = useLocalSearchParams();

  useEffect(() => {
    const sortParam = Array.isArray(sort) ? sort[0] : sort;
    if (typeof sortParam === "string") {
      const allowed = ["popular", "price_low", "price_high", "name"];
      if (allowed.includes(sortParam)) {
        setSortBy(sortParam);
      }
    }
    const searchParam = Array.isArray(q) ? q[0] : q;
    if (typeof searchParam === "string" && searchParam.trim().length > 0) {
      setSearchQuery(searchParam);
    }
  }, [sort, q]);

  // Fetch products via tRPC
  const {
    data: products,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = trpc.catalog.products.useQuery(undefined, {
    staleTime: 60000,
  });
  const shopifySync = trpc.shopify.sync.useMutation({
    onSuccess: async (data) => {
      await refetch();
      Alert.alert(
        "Shopify sync complete",
        `Synced ${data.synced} product${data.synced === 1 ? "" : "s"}${data.errors ? `, ${data.errors} errors` : ""}.`,
      );
    },
    onError: (err) => {
      Alert.alert("Shopify sync failed", err.message);
    },
    onSettled: () => {
      setIsSyncing(false);
    },
  });
  const syncInFlight = isSyncing || shopifySync.isPending;

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

  const baseProducts = useMemo(() => {
    if (!products) return [];
    const deduped = new Map<string, Product>();
    for (const product of products) {
      const key = product.shopifyProductId
        ? `shopify:${product.shopifyProductId}`
        : `id:${product.id}`;
      if (!deduped.has(key)) {
        deduped.set(key, product);
      }
    }
    return Array.from(deduped.values());
  }, [products]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    if (!baseProducts.length) return [];

    let result = baseProducts.filter((product: Product) => {
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
  }, [baseProducts, searchQuery, selectedCategory, sortBy]);

  // Handle add to cart
  const handleAddToCart = (product: Product) => {
    if (!canPurchase) return;
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
          accessibilityRole="button"
          accessibilityLabel="Filter products by category"
          testID="products-filter"
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
          accessibilityRole="button"
          accessibilityLabel="Change product sort"
          testID="products-sort"
        >
          <IconSymbol name="arrow.up.arrow.down" size={16} color={colors.foreground} />
          <Text className="text-foreground ml-2 text-sm">
            {sortBy === "popular" ? "Popular" : sortBy === "price_low" ? "Price ↑" : sortBy === "price_high" ? "Price ↓" : "A-Z"}
          </Text>
        </TouchableOpacity>

        {canManage && (
          <TouchableOpacity
            onPress={() => {
              if (syncInFlight) return;
              setIsSyncing(true);
              shopifySync.mutate();
            }}
            className="flex-row items-center bg-surface rounded-lg px-3 py-2 border border-border"
            accessibilityRole="button"
            accessibilityLabel="Sync products from Shopify"
            testID="products-sync-shopify"
            disabled={syncInFlight}
            style={{ opacity: syncInFlight ? 0.6 : 1 }}
          >
            {syncInFlight ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
            <IconSymbol name="refresh" size={16} color={colors.foreground} />
            )}
            <Text className="text-foreground ml-2 text-sm">
              {syncInFlight ? "Syncing..." : "Sync"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Loading State */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-3">Loading products...</Text>
        </View>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <View className="flex-1 items-center justify-center px-6">
          <IconSymbol name="exclamationmark.triangle.fill" size={36} color={colors.error} />
          <Text className="text-lg font-semibold text-foreground mt-3">
            Unable to load products
          </Text>
          <Text className="text-muted text-center mt-2">
            {error.message}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 px-4 py-2 border border-border rounded-lg"
            accessibilityRole="button"
            accessibilityLabel="Retry loading products"
            testID="products-retry"
          >
            <Text className="text-foreground">Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results Count */}
      {!isLoading && !error && (
        <Text className="px-4 text-sm text-muted mb-3">
          Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
        </Text>
      )}

      {/* Product Grid */}
      {!isLoading && !error && (
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
                  className="mb-4 bg-surface rounded-xl overflow-hidden border border-border"
                  style={{
                    opacity: inStock ? 1 : 0.6,
                    width: "46%",
                    maxWidth: 180,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${product.name}`}
                  testID={`product-card-${product.id}`}
                >
                  {/* Image */}
                  <View className="bg-background items-center justify-center" style={{ height: 140 }}>
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
                  <View className="p-2.5">
                    {product.category && (
                      <View className="bg-primary/10 self-start px-2 py-0.5 rounded mb-1">
                        <Text className="text-xs text-primary">{getCategoryLabel(product.category)}</Text>
                      </View>
                    )}
                    
                    <View className="flex-row items-center">
                      <Text className="text-base font-bold text-foreground">${price.toFixed(2)}</Text>
                      {comparePrice && comparePrice > price && (
                        <Text className="text-xs text-muted line-through ml-2">${comparePrice.toFixed(2)}</Text>
                      )}
                    </View>
                    
                    <Text className="text-xs text-foreground mt-1" numberOfLines={2}>
                      {product.name}
                    </Text>

                    {/* Stock status */}
                    <View className="flex-row items-center mt-1.5">
                      <View
                        className={`w-2 h-2 rounded-full ${inStock ? "bg-success" : "bg-error"}`}
                      />
                      <Text
                        className={`text-[11px] ml-1 ${inStock ? "text-success" : "text-error"}`}
                      >
                        {inStock ? `${product.inventoryQuantity} in stock` : "Out of stock"}
                      </Text>
                    </View>

                    {/* Brand */}
                    {product.brand && (
                      <Text className="text-[11px] text-muted mt-1">by {product.brand}</Text>
                    )}
                  </View>

                  {/* Add to Cart Button */}
                  <View className="px-2.5 pb-2.5">
                    {canPurchase ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        disabled={!inStock}
                        className={`py-1.5 rounded-lg items-center ${inStock ? "bg-primary" : "bg-muted"}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${product.name} to cart`}
                        testID={`product-add-${product.id}`}
                      >
                        <Text className={`text-xs font-semibold ${inStock ? "text-white" : "text-foreground"}`}>
                          {inStock ? "Add to Cart" : "Sold Out"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="py-1.5 rounded-lg items-center border border-border bg-surface">
                        <Text className="text-xs font-semibold text-foreground">Review only</Text>
                      </View>
                    )}
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
          className="flex-1 justify-end"
          onPress={() => setFilterModalOpen(false)}
          style={{ backgroundColor: overlayColor }}
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
          className="flex-1 justify-end"
          onPress={() => setDetailModalOpen(false)}
          style={{ backgroundColor: overlayColor }}
        >
          <View
            className="bg-background rounded-t-3xl max-h-[95%]"
            onStartShouldSetResponder={() => true}
          >
            {selectedProduct && (
              <ScrollView>
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-4 pb-3 border-b border-border">
                  <Text className="text-lg font-semibold text-foreground">Product details</Text>
                  <TouchableOpacity onPress={() => setDetailModalOpen(false)}>
                    <IconSymbol name="xmark" size={20} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <View className="p-6">
                  <View className="flex-row items-start">
                    <View className="w-28 h-28 rounded-xl bg-surface items-center justify-center overflow-hidden mr-4">
                      {selectedProduct.imageUrl ? (
                        <Pressable
                          onPress={() => setImageZoomOpen(true)}
                          accessibilityRole="button"
                          accessibilityLabel="Zoom product image"
                          testID="product-image-zoom"
                          className="w-full h-full"
                        >
                          <Image
                            source={{ uri: selectedProduct.imageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        </Pressable>
                      ) : (
                        <IconSymbol name="cube.box" size={36} color={colors.muted} />
                      )}
                    </View>
                    <View className="flex-1">
                      {selectedProduct.category && (
                        <View className="bg-primary/10 self-start px-2 py-0.5 rounded-full mb-2">
                          <Text className="text-xs text-primary">{getCategoryLabel(selectedProduct.category)}</Text>
                        </View>
                      )}
                      <Text className="text-base font-semibold text-foreground mb-1">
                        {selectedProduct.name}
                      </Text>
                      <View className="flex-row items-center mb-2">
                        <Text className="text-lg font-bold text-foreground">
                          ${parseFloat(selectedProduct.price).toFixed(2)}
                        </Text>
                        {selectedProduct.compareAtPrice && parseFloat(selectedProduct.compareAtPrice) > parseFloat(selectedProduct.price) && (
                          <Text className="text-sm text-muted line-through ml-2">
                            ${parseFloat(selectedProduct.compareAtPrice).toFixed(2)}
                          </Text>
                        )}
                      </View>
                      <View className="flex-row items-center">
                        <View
                          className={`w-2 h-2 rounded-full ${
                            selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                              ? "bg-success"
                              : "bg-error"
                          }`}
                        />
                        <Text
                          className={`text-xs ml-2 ${
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
                    </View>
                  </View>

                  {selectedProduct.description && (
                    <View className="mt-5">
                      <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
                      <RenderHTML
                        contentWidth={Math.max(0, width - 48)}
                        source={{ html: sanitizeDescriptionHtml(selectedProduct.description) }}
                        tagsStyles={{
                          p: {
                            color: colors.muted,
                            lineHeight: 20,
                            marginTop: 0,
                            marginBottom: 8,
                          },
                          h1: { color: colors.foreground, fontSize: 18, fontWeight: "600", marginBottom: 8 },
                          h2: { color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 8 },
                          h3: { color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 8 },
                          h4: { color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 8 },
                          h5: { color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 8 },
                          h6: { color: colors.foreground, fontSize: 12, fontWeight: "600", marginBottom: 8 },
                          strong: { color: colors.foreground, fontWeight: "600" },
                          b: { color: colors.foreground, fontWeight: "600" },
                          em: { fontStyle: "italic" },
                          i: { fontStyle: "italic" },
                          ul: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                          ol: { color: colors.muted, marginBottom: 8, paddingLeft: 18 },
                          li: { color: colors.muted, marginBottom: 4 },
                        }}
                      />
                    </View>
                  )}

                  {(selectedProduct.brand || selectedProduct.phase) && (
                    <View className="mt-4 space-y-2">
                      {selectedProduct.brand && (
                        <View className="flex-row items-center">
                          <Text className="text-sm text-muted">Brand: </Text>
                          <Text className="text-sm font-semibold text-foreground">{selectedProduct.brand}</Text>
                        </View>
                      )}
                      {selectedProduct.phase && (
                        <View className="flex-row items-center">
                          <Text className="text-sm text-muted">Best for: </Text>
                          <Text className="text-sm font-semibold text-foreground capitalize">
                            {selectedProduct.phase.replace(/_/g, " ")}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {canPurchase ? (
                    <TouchableOpacity
                      onPress={() => {
                        handleAddToCart(selectedProduct);
                        setDetailModalOpen(false);
                      }}
                      disabled={selectedProduct.availability !== "available" || (selectedProduct.inventoryQuantity || 0) <= 0}
                      className={`mt-6 py-3 rounded-xl items-center flex-row justify-center ${
                        selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    >
                      <IconSymbol
                        name="cart"
                        size={18}
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
                  ) : (
                    <View className="mt-6 py-3 rounded-xl items-center border border-border bg-surface">
                      <Text className="font-semibold text-foreground">Review only</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Image Zoom Modal */}
      <Modal
        visible={imageZoomOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setImageZoomOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          onPress={() => setImageZoomOpen(false)}
          style={{ backgroundColor: overlayColor }}
          accessibilityRole="button"
          accessibilityLabel="Close image zoom"
          testID="product-image-zoom-close"
        >
          {selectedProduct?.imageUrl ? (
            <Image
              source={{ uri: selectedProduct.imageUrl }}
              style={{ width: "90%", height: "90%" }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
