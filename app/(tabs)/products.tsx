// import { useBottomNavHeight } from "@/components/role-bottom-nav";
import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import RenderHTML from "react-native-render-html";

import { sanitizeHtml, stripHtml } from "@/lib/html-utils";

type Product = {
  id: string;
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
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Bundle = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: string | null;
  cadence: "one_time" | "weekly" | "monthly" | null;
};

type Collection = {
  id: number;
  title: string;
  handle: string;
  imageUrl: string | null;
  productIds?: number[];
  channels?: string[];
  updatedAt: string | null;
};

export default function ProductsScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { canManage, effectiveRole, isClient } = useAuthContext();
  // const bottomNavHeight = useBottomNavHeight();
  const canPurchase = isClient || effectiveRole === "shopper" || !effectiveRole;
  const { width, height: windowHeight } = useWindowDimensions();
  const overlayColor = colorScheme === "dark"
    ? "rgba(0, 0, 0, 0.5)"
    : "rgba(15, 23, 42, 0.18)";
  const { addItem } = useCart();
  const [viewMode, setViewMode] = useState<"bundles" | "categories" | "products">("categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [bundleSearchQuery, setBundleSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<{ type: "image" | "video"; uri: string }[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const { q } = useLocalSearchParams();

  useEffect(() => {
    const searchParam = Array.isArray(q) ? q[0] : q;
    if (typeof searchParam === "string" && searchParam.trim().length > 0) {
      setViewMode("products");
      setSearchQuery(searchParam);
    }
  }, [q]);

  useEffect(() => {
    if (viewMode !== "products") {
      setSelectedCategory("all");
      setSearchQuery("");
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
  const { data: collections = [] } = trpc.catalog.collections.useQuery(undefined, {
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

  // Spinning animation for sync icon
  const spinAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (syncInFlight) {
      spinAnim.setValue(0);
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [syncInFlight, spinAnim]);
  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  // Category options
  const normalizeCategoryValue = useCallback((value: string | null | undefined) => {
    const raw = String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!raw) return "";
    const aliases: Record<string, string> = {
      preworkout: "pre_workout",
      pre_workout: "pre_workout",
      postworkout: "post_workout",
      post_workout: "post_workout",
      amino_acids: "recovery",
      hydration_electrolytes: "hydration",
    };
    return aliases[raw] || raw;
  }, []);

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

  const categories = useMemo(() => {
    const fromCollections = (collections as Collection[])
      .map((collection) => {
        const value = normalizeCategoryValue(collection.handle || collection.title);
        if (!value) return null;
        return {
          value,
          label: collection.title || value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        };
      })
      .filter((item): item is { value: string; label: string } => Boolean(item));

    const byValue = new Map<string, { value: string; label: string }>();
    for (const item of fromCollections) {
      if (!byValue.has(item.value)) byValue.set(item.value, item);
    }

    // Fallback to inferred categories from synced product data if collections are unavailable.
    if (byValue.size === 0) {
      for (const product of baseProducts) {
        const value = normalizeCategoryValue(product.category);
        if (!value || byValue.has(value)) continue;
        byValue.set(value, {
          value,
          label: value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        });
      }
    }

    return Array.from(byValue.values());
  }, [baseProducts, collections, normalizeCategoryValue]);

  const featuredProductsByCategory = useMemo(() => {
    const featured = new Map<string, Product>();
    for (const product of baseProducts) {
      const key = normalizeCategoryValue(product.category);
      if (key && !featured.has(key)) {
        featured.set(key, product);
      }
    }
    return featured;
  }, [baseProducts, normalizeCategoryValue]);

  const categorySections = useMemo(() => {
    const collectionsByValue = new Map<string, Collection>();
    for (const collection of collections as Collection[]) {
      const key = normalizeCategoryValue(collection.handle || collection.title);
      if (!key || collectionsByValue.has(key)) continue;
      collectionsByValue.set(key, collection);
    }

    const tokenized = (value: string) =>
      value
        .split("_")
        .map((token) => token.trim())
        .filter((token) => token.length > 0);

    const categoryMatches = (collectionKey: string, productCategoryKey: string) => {
      if (!collectionKey || !productCategoryKey) return false;
      if (collectionKey === productCategoryKey) return true;
      if (collectionKey.includes(productCategoryKey) || productCategoryKey.includes(collectionKey)) return true;
      const collectionTokens = tokenized(collectionKey);
      const productTokens = tokenized(productCategoryKey);
      if (collectionTokens.length === 0 || productTokens.length === 0) return false;
      return collectionTokens.some((token) => productTokens.includes(token));
    };

    const productsByCategory = new Map<string, Product[]>();
    for (const product of baseProducts) {
      const key = normalizeCategoryValue(product.category);
      if (!key) continue;
      const list = productsByCategory.get(key) ?? [];
      list.push(product);
      productsByCategory.set(key, list);
    }

    return categories.map((category) => {
      const categoryTokens = tokenized(category.value).filter((token) => token.length > 2);
      const collection = collectionsByValue.get(category.value);
      const collectionProductIds = new Set(
        (collection?.productIds || [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      );
      const collectionMatches = collectionProductIds.size
        ? baseProducts.filter((product) => {
            const shopifyId = Number(product.shopifyProductId);
            return Number.isFinite(shopifyId) && collectionProductIds.has(shopifyId);
          })
        : [];
      const directMatches = productsByCategory.get(category.value) ?? [];
      const fallbackMatches = directMatches.length
        ? []
        : baseProducts.filter((product) => {
            const productKey = normalizeCategoryValue(product.category);
            if (categoryMatches(category.value, productKey)) return true;
            if (!categoryTokens.length) return false;
            const haystack = `${product.name} ${product.brand || ""} ${product.description || ""}`.toLowerCase();
            return categoryTokens.some((token) => haystack.includes(token.replace(/_/g, " ")));
          });
      const previewProducts = [
        ...(collectionMatches.length
          ? collectionMatches
          : directMatches.length
            ? directMatches
            : fallbackMatches),
      ].sort(
        (a, b) => a.name.localeCompare(b.name),
      );
      const fallbackProduct = featuredProductsByCategory.get(category.value);
      return {
        value: category.value,
        label: category.label,
        imageUrl: collection?.imageUrl || fallbackProduct?.imageUrl || null,
        previewProducts,
      };
    }).filter((section) => section.previewProducts.length > 0);
  }, [baseProducts, categories, collections, featuredProductsByCategory, normalizeCategoryValue]);

  const categoryProductIdsByValue = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const section of categorySections) {
      map.set(
        section.value,
        new Set(section.previewProducts.map((product) => product.id)),
      );
    }
    return map;
  }, [categorySections]);

  useEffect(() => {
    if (viewMode !== "categories") return;
    if (selectedCategory === "all") return;
    if (categories.some((category) => category.value === selectedCategory)) return;
    setSelectedCategory("all");
  }, [categories, selectedCategory, viewMode]);

  const filteredBundles = useMemo(() => {
    const all = (bundles as Bundle[] | undefined) ?? [];
    if (!bundleSearchQuery.trim()) return all;
    const term = bundleSearchQuery.toLowerCase();
    return all.filter(
      (b) =>
        b.title.toLowerCase().includes(term) ||
        (b.description || "").toLowerCase().includes(term),
    );
  }, [bundles, bundleSearchQuery]);

  const filteredProducts = useMemo(() => {
    if (!baseProducts.length) return [];
    let result = baseProducts;
    if (selectedCategory !== "all") {
      const selectedCategoryProductIds = categoryProductIdsByValue.get(selectedCategory);
      if (selectedCategoryProductIds && selectedCategoryProductIds.size > 0) {
        result = result.filter((product) => selectedCategoryProductIds.has(product.id));
      } else {
        result = result.filter((product) => normalizeCategoryValue(product.category) === selectedCategory);
      }
    }
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
  }, [baseProducts, categoryProductIdsByValue, normalizeCategoryValue, searchQuery, selectedCategory]);

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
    if (category === "all") return "All Products";
    const normalized = normalizeCategoryValue(category);
    const cat = categories.find((c) => c.value === normalized);
    return cat?.label || normalized.replace(/_/g, " ");
  };

  const isProductsMode = viewMode === "products";
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
    const items: { type: "image" | "video"; uri: string }[] = [];
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
        <View className="flex-row items-center">
          <Text className="text-2xl font-bold text-foreground">Products</Text>
          {effectiveRole === "coordinator" && (
            <TouchableOpacity
              onPress={() => {
                if (syncInFlight) return;
                setIsSyncing(true);
                shopifySync.mutate();
              }}
              className="flex-row items-center ml-3"
              accessibilityRole="button"
              accessibilityLabel="Sync products from Shopify"
              testID="products-sync-shopify"
              disabled={syncInFlight}
              style={{ opacity: syncInFlight ? 0.6 : 1 }}
            >
              <Animated.View style={syncInFlight ? { transform: [{ rotate: spinInterpolate }] } : undefined}>
                <IconSymbol
                  name="arrow.triangle.2.circlepath"
                  size={14}
                  color={syncInFlight ? colors.primary : colors.muted}
                />
              </Animated.View>
              <Text className={`ml-1.5 text-sm ${syncInFlight ? "text-primary font-medium" : "text-muted"}`}>
                {syncInFlight ? "Syncing..." : "Sync"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Text className="text-sm text-muted mt-1">Browse wellness products</Text>
      </View>

      {/* Browse Mode Tabs */}
      <View className="px-4 mb-3">
        <View className="flex-row bg-surface border border-border rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setViewMode("bundles")}
            className={`flex-1 py-2 rounded-lg ${viewMode === "bundles" ? "bg-primary" : ""}`}
            accessibilityRole="button"
            accessibilityLabel="Browse trainer bundles"
            testID="products-tab-bundles"
          >
            <Text
              className={`text-center font-medium ${
                viewMode === "bundles" ? "text-background" : "text-foreground"
              }`}
            >
              Bundles
            </Text>
          </TouchableOpacity>
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
            onPress={() => {
              setSelectedCategory("all");
              setViewMode("products");
            }}
            className={`flex-1 py-2 rounded-lg ${viewMode === "products" ? "bg-primary" : ""}`}
            accessibilityRole="button"
            accessibilityLabel="Browse all products"
            testID="products-tab-products"
          >
            <Text
              className={`text-center font-medium ${
                viewMode === "products" ? "text-background" : "text-foreground"
              }`}
            >
              Products
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar - Bundles mode */}
      {viewMode === "bundles" && (
        <View className="px-4 mb-3">
          <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 border border-border">
            <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
            <TextInput
              placeholder="Search bundles..."
              placeholderTextColor={colors.muted}
              value={bundleSearchQuery}
              onChangeText={setBundleSearchQuery}
              className="flex-1 ml-3 text-foreground text-base"
              returnKeyType="search"
            />
            {bundleSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setBundleSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Search Bar - Products mode */}
      {isProductsMode && (
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

      {viewMode === "bundles" && !isLoading && !error && (
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
          <View className="pb-24">
            {filteredBundles.map((bundle) => (
              <TouchableOpacity
                key={bundle.id}
                onPress={() => router.push(`/bundle/${bundle.id}` as any)}
                className="mb-6 bg-surface rounded-2xl overflow-hidden border border-border"
                accessibilityRole="button"
                accessibilityLabel={`View ${bundle.title} bundle`}
                testID={`bundle-card-${bundle.id}`}
              >
                <View className="bg-background items-center justify-center" style={{ height: 210 }}>
                  {bundle.imageUrl && !failedImages[`bundle-${bundle.id}`] ? (
                    <Image
                      source={{ uri: bundle.imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                      onError={() => markImageFailed(`bundle-${bundle.id}`)}
                    />
                  ) : (
                    <IconSymbol name="cube.box" size={48} color={colors.muted} />
                  )}
                </View>
                <View className="p-4">
                  <Text className="text-lg font-semibold text-foreground" numberOfLines={2}>
                    {bundle.title}
                  </Text>
                  {bundle.price ? (
                    <Text className="text-base font-bold text-foreground mt-2">
                      ${parseFloat(bundle.price).toFixed(2)}
                    </Text>
                  ) : null}
                  {bundle.description ? (
                    <Text className="text-sm text-muted mt-2" numberOfLines={2}>
                      {stripHtml(bundle.description)}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}

            {filteredBundles.length === 0 && (
              <View className="items-center py-16">
                <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                  <IconSymbol name={bundleSearchQuery ? "magnifyingglass" : "cube.box"} size={32} color={colors.muted} />
                </View>
                <Text className="text-lg font-semibold text-foreground mb-2">
                  {bundleSearchQuery ? "No matching bundles" : "No bundles available"}
                </Text>
                <Text className="text-muted text-center">
                  {bundleSearchQuery
                    ? "Try a different search term."
                    : "Trainer bundles will appear here when published."}
                </Text>
                {bundleSearchQuery ? (
                  <TouchableOpacity
                    onPress={() => setBundleSearchQuery("")}
                    className="mt-3 px-4 py-2 border border-border rounded-lg"
                  >
                    <Text className="text-foreground text-sm">Clear search</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {isProductsMode && (
        <View className="px-4 mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setSelectedCategory("all")}
                className={`px-3 py-2 rounded-full border ${
                  selectedCategory === "all" ? "bg-primary border-primary" : "bg-surface border-border"
                }`}
                accessibilityRole="button"
                accessibilityLabel="Show all products"
                testID="products-filter-all"
              >
                <Text className={`text-xs font-medium ${selectedCategory === "all" ? "text-background" : "text-foreground"}`}>
                  All Products
                </Text>
              </TouchableOpacity>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.value}
                  onPress={() => setSelectedCategory(category.value)}
                  className={`px-3 py-2 rounded-full border ${
                    selectedCategory === category.value ? "bg-primary border-primary" : "bg-surface border-border"
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter products by ${category.label}`}
                  testID={`products-filter-${category.value}`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      selectedCategory === category.value ? "text-background" : "text-foreground"
                    }`}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {viewMode === "categories" && !isLoading && !error && (
        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          <View className="pb-24">
            {categorySections.map((section) => {
              const cardBackgroundKey = `category-card-bg-${section.value}`;
              const hasCardImage = Boolean(section.imageUrl && !failedImages[cardBackgroundKey]);
              const featuredProduct = section.previewProducts[0] ?? null;
              return (
                <View
                  key={section.value}
                  className="mb-6 rounded-2xl overflow-hidden"
                  style={{
                    width: "100%",
                    maxWidth: 600,
                    alignSelf: "center",
                    borderWidth: 1,
                    borderColor: colorScheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                  }}
                >
                  <ImageBackground
                    source={hasCardImage && section.imageUrl ? { uri: section.imageUrl } : undefined}
                    resizeMode="cover"
                    onError={() => markImageFailed(cardBackgroundKey)}
                    style={{ backgroundColor: colors.surface }}
                    imageStyle={{ opacity: 0.55 }}
                  >
                    <View
                      className="absolute inset-0"
                      style={{
                        backgroundColor:
                          colorScheme === "dark" ? "rgba(2, 6, 23, 0.48)" : "rgba(248, 250, 252, 0.55)",
                      }}
                    />

                    <View className="px-4 pt-4 pb-3">
                      <Text
                        className="text-white font-semibold"
                        style={{ fontSize: 13, letterSpacing: 3 }}
                        numberOfLines={1}
                      >
                        {section.label.toUpperCase()}
                      </Text>
                    </View>

                    {section.previewProducts.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
                      >
                        <View className="flex-row gap-3">
                          {section.previewProducts.slice(0, 6).map((product) => {
                            const imageKey = `category-preview-${section.value}-${product.id}`;
                            const fallbackImageKey = `category-hero-${section.value}`;
                            const previewImageUrl =
                              product.imageUrl ||
                              (failedImages[fallbackImageKey] ? null : section.imageUrl);
                            const hasPreviewImage = Boolean(previewImageUrl && !failedImages[imageKey]);
                            return (
                              <TouchableOpacity
                                key={product.id}
                                onPress={() => openProductDetail(product)}
                                style={{ width: 100, height: 100, borderRadius: 14, overflow: "hidden" }}
                                accessibilityRole="button"
                                accessibilityLabel={`View ${product.name} in ${section.label}`}
                                testID={`products-category-preview-${section.value}-${product.id}`}
                              >
                                <View
                                  className="flex-1 items-center justify-center"
                                  style={{
                                    backgroundColor:
                                      colorScheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
                                    borderRadius: 14,
                                  }}
                                >
                                  {hasPreviewImage && previewImageUrl ? (
                                    <Image
                                      source={{ uri: previewImageUrl }}
                                      style={{ width: 100, height: 100, borderRadius: 14 }}
                                      resizeMode="cover"
                                      onError={() => {
                                        markImageFailed(imageKey);
                                        if (!product.imageUrl) markImageFailed(fallbackImageKey);
                                      }}
                                    />
                                  ) : (
                                    <IconSymbol name="cube.box" size={28} color={colors.muted} />
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    ) : (
                      <View className="mx-4 mb-3 h-24 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                        <Text className="text-sm text-muted">No products yet</Text>
                      </View>
                    )}

                    <View className="flex-row items-end justify-between px-4 pb-4">
                      <View className="flex-1 pr-3">
                        <Text className="text-white/60 text-xs" numberOfLines={1}>
                          {section.label}
                        </Text>
                        {featuredProduct && (
                          <Text className="text-white text-base font-bold mt-0.5" numberOfLines={2}>
                            {featuredProduct.name}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedCategory(section.value);
                          setViewMode("products");
                          setSearchQuery("");
                        }}
                        style={{
                          paddingHorizontal: 18,
                          paddingVertical: 10,
                          borderRadius: 24,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.45)",
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`See all products in ${section.label}`}
                        testID={`products-collection-see-all-${section.value}`}
                      >
                        <View className="flex-row items-center">
                          <Text className="text-white font-semibold mr-1.5">See All</Text>
                          <IconSymbol name="arrow.right" size={13} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    </View>
                  </ImageBackground>
                </View>
              );
            })}
          </View>
          {categorySections.length === 0 && (
            <View className="items-center py-16">
              <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                <IconSymbol name="cube.box" size={32} color={colors.muted} />
              </View>
              <Text className="text-lg font-semibold text-foreground mb-2">No collections found</Text>
              <Text className="text-muted text-center">Sync Shopify to load collection cards.</Text>
            </View>
          )}
        </ScrollView>
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
      {!isLoading && !error && isProductsMode && (
        <Text className="px-4 text-sm text-muted mb-3">
          {`Showing ${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`}
        </Text>
      )}

      {/* Product Grid */}
      {!isLoading && !error && isProductsMode && (
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
          <>
            <View className="flex-row flex-wrap justify-between pb-24">
              {filteredProducts.map((product) => {
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
                          ) : null}
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
          </>
        </ScrollView>
      )}

      {/* Product Detail Modal */}
      <Modal
        visible={detailModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: overlayColor }}>
          {/* Tappable top area — closes the modal */}
          <Pressable
            style={{ flex: 1, minHeight: 60 }}
            onPress={() => setDetailModalOpen(false)}
          />
          {/* Sheet — anchored to bottom, above the nav */}
          <SwipeDownSheet
            visible={detailModalOpen}
            onClose={() => setDetailModalOpen(false)}
            className="rounded-t-3xl overflow-hidden"
            style={{ backgroundColor: colors.background }}
          >
            {selectedProduct && (
              <ScrollView style={{ backgroundColor: colors.background }}>
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-4 pb-3 border-b border-border">
                  <Text className="text-lg font-semibold text-foreground">Product details</Text>
                  <TouchableOpacity onPress={() => setDetailModalOpen(false)}>
                    <IconSymbol name="xmark" size={20} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={{ backgroundColor: colors.background }}>
                  {/* Product Image — full width, tap to zoom */}
                  <Pressable
                    onPress={() => openMediaViewer(selectedProduct, selectedProduct.imageUrl)}
                    className="w-full bg-surface items-center justify-center overflow-hidden"
                    style={{ height: 240 }}
                    accessibilityRole="button"
                    accessibilityLabel="View product images"
                    testID="product-image-zoom"
                  >
                    {selectedProduct.imageUrl && !failedImages[`product-${selectedProduct.id}`] ? (
                      <Image
                        source={{ uri: selectedProduct.imageUrl }}
                        className="w-full h-full"
                        resizeMode="contain"
                        onError={() => markImageFailed(`product-${selectedProduct.id}`)}
                      />
                    ) : (
                      <IconSymbol name="cube.box" size={48} color={colors.muted} />
                    )}
                  </Pressable>

                  {/* Product Info */}
                  <View className="px-6 pt-4">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-1 mr-3">
                        <Text className="text-lg font-bold text-foreground">
                          {selectedProduct.name}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-foreground">
                          ${parseFloat(selectedProduct.price).toFixed(2)}
                        </Text>
                        {selectedProduct.compareAtPrice && parseFloat(selectedProduct.compareAtPrice) > parseFloat(selectedProduct.price) && (
                          <Text className="text-sm text-muted line-through">
                            ${parseFloat(selectedProduct.compareAtPrice).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between mb-3">
                      {selectedProduct.category ? (
                        <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                          <Text className="text-xs text-primary">{getCategoryLabel(selectedProduct.category)}</Text>
                        </View>
                      ) : <View />}
                      <View className="flex-row items-center">
                        <View
                          className={`w-2 h-2 rounded-full ${
                            selectedProduct.availability === "available" && (selectedProduct.inventoryQuantity || 0) > 0
                              ? "bg-success"
                              : "bg-error"
                          }`}
                        />
                        <Text
                          className={`text-xs ml-1.5 ${
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
                    <View className="mt-3 px-6">
                      <Text className="text-sm font-semibold text-foreground mb-2">Description</Text>
                      <RenderHTML
                        contentWidth={Math.max(0, width - 48)}
                        source={{ html: sanitizeHtml(selectedProduct.description) }}
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
                    <View className="mt-4 px-6 space-y-2">
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
                      className={`mt-6 mx-6 py-3 rounded-xl items-center flex-row justify-center ${
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
                  ) : null}
                </View>
              </ScrollView>
            )}
          </SwipeDownSheet>
        </View>
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
            contentOffset={{ x: mediaIndex * Math.round(width * 0.8), y: 0 }}
            style={{ width: Math.round(width * 0.8), alignSelf: "center" }}
            contentContainerStyle={{ alignItems: "center" }}
          >
            {mediaItems.map((item, idx) => {
              const slideSize = Math.round(Math.min(width, windowHeight) * 0.8);
              return (
                <View key={`${item.type}-${item.uri}-${idx}`} style={{ width: Math.round(width * 0.8), justifyContent: "center", alignItems: "center" }}>
                  <MediaSlide item={item} width={slideSize} height={slideSize} />
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Modal>

      {canManage && (
        <TouchableOpacity
          onPress={() => router.push("/bundle-editor/new" as any)}
          className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
          style={{ right: 16, bottom: 16 }}
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
    return <VideoSlide uri={item.uri} width={width} height={height} />;
  }
  return (
    <Image
      source={{ uri: item.uri }}
      style={{ width, height }}
      resizeMode="contain"
    />
  );
}

function VideoSlide({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (video) => {
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
