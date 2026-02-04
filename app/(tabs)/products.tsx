import { useBottomNavHeight } from "@/components/role-bottom-nav";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useVideoPlayer, VideoView } from "expo-video";
import { router, useLocalSearchParams } from "expo-router";
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
  media?: unknown;
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

type Bundle = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
  cadence: "one_time" | "weekly" | "monthly" | null;
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
  const bottomNavHeight = useBottomNavHeight();
  const canPurchase = isClient || effectiveRole === "shopper" || !effectiveRole;
  const { width } = useWindowDimensions();
  const overlayColor = colorScheme === "dark"
    ? "rgba(0, 0, 0, 0.5)"
    : "rgba(15, 23, 42, 0.18)";
  const { addItem } = useCart();
  const [viewMode, setViewMode] = useState<"categories" | "az">("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<Array<{ type: "image" | "video"; uri: string }>>([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
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
      setViewMode("az");
      setSearchQuery(searchParam);
    }
  }, [sort, q]);

  useEffect(() => {
    if (viewMode === "categories") {
      setSelectedCategory("bundle");
      setSearchQuery("");
    } else {
      setSelectedCategory("all");
      setSortBy("name");
    }
  }, [viewMode]);

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
  const { data: bundles } = trpc.catalog.bundles.useQuery(undefined, {
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

  const filteredBundles = useMemo(() => {
    return (bundles as Bundle[] | undefined) ?? [];
  }, [bundles]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const product of baseProducts) {
      const key = product.category || "other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [baseProducts]);

  const categoryProducts = useMemo(() => {
    if (!baseProducts.length) return [];
    let result = baseProducts;
    if (selectedCategory !== "all") {
      result = result.filter((product) => product.category === selectedCategory);
    }
    if (sortBy === "price_low") {
      result = [...result].sort(
        (a: Product, b: Product) => parseFloat(a.price) - parseFloat(b.price),
      );
    } else if (sortBy === "price_high") {
      result = [...result].sort(
        (a: Product, b: Product) => parseFloat(b.price) - parseFloat(a.price),
      );
    } else if (sortBy === "name") {
      result = [...result].sort((a: Product, b: Product) => a.name.localeCompare(b.name));
    }
    return result;
  }, [baseProducts, selectedCategory, sortBy]);

  const alphaProducts = useMemo(() => {
    if (!baseProducts.length) return [];
    let result = baseProducts;
    if (searchQuery.trim().length > 0) {
      const term = searchQuery.toLowerCase();
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(term) ||
          (product.description || "").toLowerCase().includes(term) ||
          (product.brand || "").toLowerCase().includes(term),
      );
    }
    return [...result].sort((a: Product, b: Product) => a.name.localeCompare(b.name));
  }, [baseProducts, searchQuery]);

  const alphaBundles = useMemo(() => {
    const list = (filteredBundles as Bundle[]) ?? [];
    if (!list.length) return [];
    let result = list;
    if (searchQuery.trim().length > 0) {
      const term = searchQuery.toLowerCase();
      result = result.filter(
        (bundle) =>
          bundle.title.toLowerCase().includes(term) ||
          (bundle.description || "").toLowerCase().includes(term),
      );
    }
    return [...result].sort((a: Bundle, b: Bundle) => a.title.localeCompare(b.title));
  }, [filteredBundles, searchQuery]);

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
    if (category === "bundle") return "Bundles";
    if (category === "all") return "All Products";
    const cat = categories.find((c) => c.value === category);
    return cat?.label || category.replace(/_/g, " ");
  };

  const showingBundles = viewMode === "categories" && selectedCategory === "bundle";
  const isAzMode = viewMode === "az";
  const azResults = useMemo(() => {
    return [
      ...alphaBundles.map((bundle) => ({ type: "bundle" as const, bundle })),
      ...alphaProducts.map((product) => ({ type: "product" as const, product })),
    ];
  }, [alphaBundles, alphaProducts]);
  const productsToShow = viewMode === "az" ? alphaProducts : categoryProducts;
  const featuredProductsByCategory = useMemo(() => {
    const featured = new Map<string, Product>();
    for (const product of baseProducts) {
      if (product.category && !featured.has(product.category)) {
        featured.set(product.category, product);
      }
    }
    return featured;
  }, [baseProducts]);
  const featuredBundle = filteredBundles[0];

  const markImageFailed = (key: string) => {
    setFailedImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  };

  const normalizeMedia = (media: Product["media"]): { images: string[]; videos: string[] } => {
    if (!media) return { images: [], videos: [] };
    if (typeof media === "string") {
      try {
        const parsed = JSON.parse(media) as { images?: string[]; videos?: string[] };
        return { images: parsed.images ?? [], videos: parsed.videos ?? [] };
      } catch {
        return { images: [], videos: [] };
      }
    }
    if (typeof media === "object") {
      const record = media as { images?: string[]; videos?: string[] };
      return { images: record.images ?? [], videos: record.videos ?? [] };
    }
    return { images: [], videos: [] };
  };

  const getMediaItems = (product: Product) => {
    const { images, videos } = normalizeMedia(product.media);
    const set = new Set<string>();
    const items: Array<{ type: "image" | "video"; uri: string }> = [];
    if (product.imageUrl) {
      set.add(product.imageUrl);
      items.push({ type: "image", uri: product.imageUrl });
    }
    for (const url of images) {
      if (url && !set.has(url)) {
        set.add(url);
        items.push({ type: "image", uri: url });
      }
    }
    for (const url of videos) {
      if (url && !set.has(url)) {
        set.add(url);
        items.push({ type: "video", uri: url });
      }
    }
    return items;
  };

  const openMediaViewer = (product: Product, initialUrl?: string | null) => {
    const items = getMediaItems(product);
    if (!items.length) return;
    const index = initialUrl ? items.findIndex((item) => item.uri === initialUrl) : 0;
    setMediaItems(items);
    setMediaIndex(index >= 0 ? index : 0);
    setMediaModalOpen(true);
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Products</Text>
        <Text className="text-sm text-muted mt-1">Browse wellness products</Text>
      </View>

      {/* Browse Mode Tabs */}
      <View className="px-4 mb-3">
        <View className="flex-row bg-surface border border-border rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setViewMode("categories")}
            className={`flex-1 py-2 rounded-lg ${viewMode === "categories" ? "bg-primary" : ""}`}
            accessibilityRole="button"
            accessibilityLabel="Browse by category"
            testID="products-tab-categories"
          >
            <Text
              className={`text-center font-medium ${
                viewMode === "categories" ? "text-background" : "text-foreground"
              }`}
            >
              Categories
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode("az")}
            className={`flex-1 py-2 rounded-lg ${viewMode === "az" ? "bg-primary" : ""}`}
            accessibilityRole="button"
            accessibilityLabel="Browse products alphabetically"
            testID="products-tab-az"
          >
            <Text
              className={`text-center font-medium ${
                viewMode === "az" ? "text-background" : "text-foreground"
              }`}
            >
              A-Z
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {viewMode === "az" && (
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
      )}

      {viewMode === "categories" && (
        <View className="px-4 mb-4">
          <Text className="text-sm font-semibold text-muted uppercase mb-2">Browse by category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
            <View className="flex-row gap-3">
              {[
                { value: "bundle", label: "Bundles", count: filteredBundles.length },
                ...categories.map((cat) => ({
                  value: cat.value,
                  label: cat.label,
                  count: categoryCounts[cat.value] ?? 0,
                })),
                { value: "all", label: "All Products", count: baseProducts.length },
              ].map((category) => {
                const isSelected = selectedCategory === category.value;
                const featuredProduct =
                  category.value !== "bundle" && category.value !== "all"
                    ? featuredProductsByCategory.get(category.value)
                    : undefined;
                const imageUrl =
                  category.value === "bundle"
                    ? featuredBundle?.imageUrl || null
                    : featuredProduct?.imageUrl || null;
                return (
                  <TouchableOpacity
                    key={category.value}
                    onPress={() => setSelectedCategory(category.value)}
                    className={`rounded-full border px-3 py-2 flex-row items-center gap-2 ${
                      isSelected ? "border-primary bg-primary/10" : "border-border bg-surface"
                    }`}
                    accessibilityRole="button"
                    accessibilityLabel={`Browse ${category.label}`}
                    testID={`products-category-${category.value}`}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        if (category.value === "bundle" && featuredBundle) {
                          router.push(`/bundle/${featuredBundle.id}` as any);
                          return;
                        }
                        if (featuredProduct) {
                          openProductDetail(featuredProduct);
                        }
                      }}
                      className="bg-background items-center justify-center rounded-full overflow-hidden"
                      accessibilityRole="button"
                      accessibilityLabel={`Open featured ${category.label}`}
                      testID={`products-category-featured-${category.value}`}
                      disabled={category.value === "all" || (!featuredProduct && !featuredBundle)}
                      style={{ width: 36, height: 36 }}
                    >
                    {imageUrl && !failedImages[`category-${category.value}`] ? (
                        <Image
                          source={{ uri: imageUrl }}
                          className="w-full h-full"
                          resizeMode="cover"
                          onError={() => markImageFailed(`category-${category.value}`)}
                        />
                      ) : (
                        <IconSymbol name="cube.box" size={28} color={colors.muted} />
                      )}
                    </TouchableOpacity>
                    <View>
                      <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                        {category.label}
                      </Text>
                      <Text className="text-xs text-muted">{category.count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}

      {canManage && (
        <View className="flex-row px-4 mb-4">
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
        </View>
      )}

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
          {showingBundles
            ? `Showing ${filteredBundles.length} bundle${filteredBundles.length !== 1 ? "s" : ""}`
            : isAzMode
              ? `Showing ${azResults.length} result${azResults.length !== 1 ? "s" : ""}`
              : `Showing ${productsToShow.length} product${productsToShow.length !== 1 ? "s" : ""}`}
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
          {showingBundles ? (
            <View className="gap-3 pb-24">
              {filteredBundles.map((bundle) => (
                <TouchableOpacity
                  key={bundle.id}
                  onPress={() => router.push(`/bundle/${bundle.id}` as any)}
                  className="bg-surface rounded-xl overflow-hidden border border-border flex-row"
                  accessibilityRole="button"
                  accessibilityLabel={`View ${bundle.title}`}
                  testID={`bundle-card-${bundle.id}`}
                >
                  <View className="w-24 h-24 bg-background items-center justify-center">
                    {bundle.imageUrl && !failedImages[`bundle-${bundle.id}`] ? (
                      <Image
                        source={{ uri: bundle.imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                        onError={() => markImageFailed(`bundle-${bundle.id}`)}
                      />
                    ) : (
                      <IconSymbol name="cube.box" size={32} color={colors.muted} />
                    )}
                  </View>
                  <View className="flex-1 p-3">
                    <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
                      {bundle.title}
                    </Text>
                    {bundle.price && (
                      <Text className="text-sm font-semibold text-primary mt-1">
                        ${parseFloat(bundle.price).toFixed(2)}
                        {bundle.cadence && bundle.cadence !== "one_time" ? ` / ${bundle.cadence}` : ""}
                      </Text>
                    )}
                    {bundle.description && (
                      <Text className="text-xs text-muted mt-1" numberOfLines={2}>
                        {bundle.description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}

              {filteredBundles.length === 0 && (
                <View className="items-center py-16">
                  <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                    <IconSymbol name="cube.box" size={32} color={colors.muted} />
                  </View>
                  <Text className="text-lg font-semibold text-foreground mb-2">No bundles found</Text>
                  <Text className="text-muted text-center mb-4">
                    New bundles will appear here once published.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <>
              <View className="flex-row flex-wrap justify-between pb-24">
                {(isAzMode ? azResults : productsToShow.map((product) => ({ type: "product" as const, product }))).map(
                  (item) => {
                    if (item.type === "bundle") {
                      const bundle = item.bundle;
                      return (
                        <TouchableOpacity
                          key={`bundle-${bundle.id}`}
                          onPress={() => router.push(`/bundle/${bundle.id}` as any)}
                          className="mb-4 bg-surface rounded-xl overflow-hidden border border-border"
                          style={{ width: "46%", maxWidth: 180 }}
                          accessibilityRole="button"
                          accessibilityLabel={`View ${bundle.title}`}
                          testID={`bundle-card-${bundle.id}`}
                        >
                          <View className="bg-background items-center justify-center" style={{ height: 140 }}>
                            {bundle.imageUrl && !failedImages[`bundle-${bundle.id}`] ? (
                              <Image
                                source={{ uri: bundle.imageUrl }}
                                className="w-full h-full"
                                resizeMode="cover"
                                onError={() => markImageFailed(`bundle-${bundle.id}`)}
                              />
                            ) : (
                              <IconSymbol name="cube.box" size={40} color={colors.muted} />
                            )}
                          </View>

                          <View className="p-2.5">
                            <View className="bg-primary/10 self-start px-2 py-0.5 rounded mb-1">
                              <Text className="text-xs text-primary">Bundle</Text>
                            </View>

                            {bundle.price && (
                              <Text className="text-base font-bold text-foreground">
                                ${parseFloat(bundle.price).toFixed(2)}
                              </Text>
                            )}

                            <Text className="text-xs text-foreground mt-1" numberOfLines={2}>
                              {bundle.title}
                            </Text>
                          </View>

                          <View className="px-2.5 pb-2.5">
                            <View className="py-1.5 rounded-lg items-center border border-border bg-surface">
                              <Text className="text-xs font-semibold text-foreground">Review only</Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    }

                    const product = item.product;
                    const price = parseFloat(product.price);
                    const comparePrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
                    const inStock =
                      product.availability === "available" && (product.inventoryQuantity || 0) > 0;

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
                          {product.imageUrl && !failedImages[`product-${product.id}`] ? (
                            <Image
                              source={{ uri: product.imageUrl }}
                              className="w-full h-full"
                              resizeMode="cover"
                              onError={() => markImageFailed(`product-${product.id}`)}
                            />
                          ) : (
                            <IconSymbol name="cube.box" size={40} color={colors.muted} />
                          )}
                        </View>

                        {/* Content */}
                        <View className="p-2.5">
                          {product.category && (
                            <View className="bg-primary/10 self-start px-2 py-0.5 rounded mb-1">
                              <Text className="text-xs text-primary">
                                {getCategoryLabel(product.category)}
                              </Text>
                            </View>
                          )}

                          <View className="flex-row items-center">
                            <Text className="text-base font-bold text-foreground">${price.toFixed(2)}</Text>
                            {comparePrice && comparePrice > price && (
                              <Text className="text-xs text-muted line-through ml-2">
                                ${comparePrice.toFixed(2)}
                              </Text>
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
                              className={`py-1.5 rounded-lg items-center ${
                                inStock ? "bg-primary" : "bg-muted"
                              }`}
                              accessibilityRole="button"
                              accessibilityLabel={`Add ${product.name} to cart`}
                              testID={`product-add-${product.id}`}
                            >
                              <Text
                                className={`text-xs font-semibold ${
                                  inStock ? "text-white" : "text-foreground"
                                }`}
                              >
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
                  },
                )}
              </View>

              {/* Empty State */}
              {(isAzMode ? azResults.length === 0 : productsToShow.length === 0) && (
                <View className="items-center py-16">
                  <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                    <IconSymbol name="magnifyingglass" size={32} color={colors.muted} />
                  </View>
                  <Text className="text-lg font-semibold text-foreground mb-2">
                    No {isAzMode ? "results" : "products"} found
                  </Text>
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
            </>
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
                      {selectedProduct.imageUrl && !failedImages[`product-${selectedProduct.id}`] ? (
                        <Pressable
                          onPress={() => openMediaViewer(selectedProduct, selectedProduct.imageUrl)}
                          accessibilityRole="button"
                          accessibilityLabel="Zoom product image"
                          testID="product-image-zoom"
                          className="w-full h-full"
                        >
                          <Image
                            source={{ uri: selectedProduct.imageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                            onError={() => markImageFailed(`product-${selectedProduct.id}`)}
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

      {/* Media Viewer Modal */}
      <Modal
        visible={mediaModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMediaModalOpen(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          onPress={() => setMediaModalOpen(false)}
          style={{ backgroundColor: overlayColor }}
          accessibilityRole="button"
          accessibilityLabel="Close media viewer"
          testID="product-media-close"
        >
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: mediaIndex * Math.max(width, 1), y: 0 }}
            style={{ width: "100%" }}
          >
            {mediaItems.map((item, idx) => (
              <View key={`${item.type}-${item.uri}-${idx}`} style={{ width: Math.max(width, 1), height: "100%" }}>
                <MediaSlide item={item} width={Math.max(width, 1)} height={Math.max(width, 1)} />
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Modal>

      {canManage && (
        <TouchableOpacity
          onPress={() => router.push("/bundle-editor/new" as any)}
          className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
          style={{ right: 16, bottom: 16 - bottomNavHeight }}
          accessibilityRole="button"
          accessibilityLabel="Create a new bundle"
          testID="products-new-bundle-fab"
        >
          <IconSymbol name="plus" size={24} color={colors.background} />
        </TouchableOpacity>
      )}
    </ScreenContainer>
  );
}

function MediaSlide({
  item,
  width,
  height,
}: {
  item: { type: "image" | "video"; uri: string };
  width: number;
  height: number;
}) {
  if (item.type === "video") {
    const player = useVideoPlayer(item.uri, (video) => {
      video.loop = true;
      video.play();
    });
    return (
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="contain"
        nativeControls={false}
      />
    );
  }
  return (
    <Image
      source={{ uri: item.uri }}
      style={{ width, height }}
      resizeMode="contain"
    />
  );
}
