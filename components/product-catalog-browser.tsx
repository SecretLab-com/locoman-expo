import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export type CatalogProduct = {
  id: string;
  shopifyProductId: number | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  compareAtPrice: string | null;
  brand: string | null;
  category: string | null;
  inventoryQuantity: number | null;
  availability: string | null;
};

type Collection = {
  id: number;
  title: string;
  handle: string;
  imageUrl: string | null;
  productIds?: number[];
};

type BrowseMode = "categories" | "products";

type ProductCatalogBrowserProps = {
  /** Called when a product is tapped. */
  onProductPress: (product: CatalogProduct) => void;
  /** Selection mode: show checkmarks for selected products. */
  selectedIds?: string[];
  /** Called when the toggle checkbox is tapped (selection mode only). */
  onToggle?: (product: CatalogProduct) => void;
  /** Initial browse mode. Default: "categories". */
  initialMode?: BrowseMode;
  /** Initial search query (for deep linking). */
  initialSearch?: string;
  /** Initial category filter. */
  initialCategory?: string;
  /** Hide bundles from the product list. Default: true. */
  excludeBundles?: boolean;
  /** Show a bottom action row per product (e.g. "Add to Cart"). */
  renderProductAction?: (product: CatalogProduct) => React.ReactNode;
};

function normalizeCategoryValue(value: string | null | undefined) {
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
}

export function ProductCatalogBrowser({
  onProductPress,
  selectedIds,
  onToggle,
  initialMode = "categories",
  initialSearch = "",
  initialCategory = "all",
  excludeBundles = true,
  renderProductAction,
}: ProductCatalogBrowserProps) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const [viewMode, setViewMode] = useState<BrowseMode>(initialMode);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const {
    data: rawProducts,
    isLoading,
    isRefetching,
    refetch,
  } = trpc.catalog.products.useQuery(undefined, { staleTime: 60000 });
  const { data: collections = [] } = trpc.catalog.collections.useQuery(undefined, { staleTime: 60000 });

  useEffect(() => {
    if (viewMode !== "products") {
      setSelectedCategory("all");
      setSearchQuery("");
    }
  }, [viewMode]);

  const markImageFailed = useCallback((key: string) => {
    setFailedImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const baseProducts = useMemo(() => {
    if (!rawProducts) return [];
    const deduped = new Map<string, CatalogProduct>();
    for (const product of rawProducts as CatalogProduct[]) {
      if (excludeBundles && String(product.category || "").toLowerCase() === "bundle") continue;
      const key = product.shopifyProductId
        ? `shopify:${product.shopifyProductId}`
        : `id:${product.id}`;
      if (!deduped.has(key)) deduped.set(key, product);
    }
    return Array.from(deduped.values());
  }, [rawProducts, excludeBundles]);

  const categories = useMemo(() => {
    const fromCollections = (collections as Collection[])
      .map((c) => {
        const value = normalizeCategoryValue(c.handle || c.title);
        if (!value) return null;
        return {
          value,
          label: c.title || value.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
        };
      })
      .filter((item): item is { value: string; label: string } => Boolean(item));

    const byValue = new Map<string, { value: string; label: string }>();
    for (const item of fromCollections) {
      if (!byValue.has(item.value)) byValue.set(item.value, item);
    }
    if (byValue.size === 0) {
      for (const product of baseProducts) {
        const value = normalizeCategoryValue(product.category);
        if (!value || byValue.has(value)) continue;
        byValue.set(value, {
          value,
          label: value.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase()),
        });
      }
    }
    return Array.from(byValue.values());
  }, [baseProducts, collections]);

  const featuredProductsByCategory = useMemo(() => {
    const featured = new Map<string, CatalogProduct>();
    for (const product of baseProducts) {
      const key = normalizeCategoryValue(product.category);
      if (key && !featured.has(key)) featured.set(key, product);
    }
    return featured;
  }, [baseProducts]);

  const categorySections = useMemo(() => {
    const collectionsByValue = new Map<string, Collection>();
    for (const c of collections as Collection[]) {
      const key = normalizeCategoryValue(c.handle || c.title);
      if (!key || collectionsByValue.has(key)) continue;
      collectionsByValue.set(key, c);
    }
    const tokenized = (value: string) => value.split("_").map((t) => t.trim()).filter(Boolean);
    const categoryMatches = (ck: string, pk: string) => {
      if (!ck || !pk) return false;
      if (ck === pk || ck.includes(pk) || pk.includes(ck)) return true;
      const ct = tokenized(ck);
      const pt = tokenized(pk);
      return ct.length > 0 && pt.length > 0 && ct.some((t) => pt.includes(t));
    };

    const productsByCategory = new Map<string, CatalogProduct[]>();
    for (const product of baseProducts) {
      const key = normalizeCategoryValue(product.category);
      if (!key) continue;
      const list = productsByCategory.get(key) ?? [];
      list.push(product);
      productsByCategory.set(key, list);
    }

    return categories
      .map((category) => {
        const categoryTokens = tokenized(category.value).filter((t) => t.length > 2);
        const collection = collectionsByValue.get(category.value);
        const collectionProductIds = new Set(
          (collection?.productIds || []).map(Number).filter((id) => Number.isFinite(id) && id > 0),
        );
        const collectionMatches = collectionProductIds.size
          ? baseProducts.filter((p) => {
              const sid = Number(p.shopifyProductId);
              return Number.isFinite(sid) && collectionProductIds.has(sid);
            })
          : [];
        const directMatches = productsByCategory.get(category.value) ?? [];
        const fallbackMatches = directMatches.length
          ? []
          : baseProducts.filter((p) => {
              const productKey = normalizeCategoryValue(p.category);
              if (categoryMatches(category.value, productKey)) return true;
              if (!categoryTokens.length) return false;
              const haystack = `${p.name} ${p.brand || ""} ${p.description || ""}`.toLowerCase();
              return categoryTokens.some((t) => haystack.includes(t.replace(/_/g, " ")));
            });
        const previewProducts = [
          ...(collectionMatches.length ? collectionMatches : directMatches.length ? directMatches : fallbackMatches),
        ].sort((a, b) => a.name.localeCompare(b.name));
        const fallbackProduct = featuredProductsByCategory.get(category.value);
        return {
          value: category.value,
          label: category.label,
          imageUrl: collection?.imageUrl || fallbackProduct?.imageUrl || null,
          previewProducts,
        };
      })
      .filter((s) => s.previewProducts.length > 0);
  }, [baseProducts, categories, collections, featuredProductsByCategory]);

  const categoryProductIdsByValue = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const section of categorySections) {
      map.set(section.value, new Set(section.previewProducts.map((p) => p.id)));
    }
    return map;
  }, [categorySections]);

  useEffect(() => {
    if (viewMode !== "products" || selectedCategory === "all") return;
    if (!categories.some((c) => c.value === selectedCategory)) setSelectedCategory("all");
  }, [categories, selectedCategory, viewMode]);

  const filteredProducts = useMemo(() => {
    if (!baseProducts.length) return [];
    let result = baseProducts;
    if (selectedCategory !== "all") {
      const ids = categoryProductIdsByValue.get(selectedCategory);
      result = ids?.size
        ? result.filter((p) => ids.has(p.id))
        : result.filter((p) => normalizeCategoryValue(p.category) === selectedCategory);
    }
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.description || "").toLowerCase().includes(term) ||
          (p.brand || "").toLowerCase().includes(term),
      );
    }
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [baseProducts, categoryProductIdsByValue, searchQuery, selectedCategory]);

  const isProductsMode = viewMode === "products";
  const isSelectionMode = Boolean(selectedIds && onToggle);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Categories / Products toggle */}
      <View className="px-4 mb-3">
        <View className="flex-row bg-surface border border-border rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setViewMode("categories")}
            className={`flex-1 py-2 rounded-lg ${viewMode === "categories" ? "bg-primary" : ""}`}
            accessibilityRole="button"
            accessibilityLabel="Browse by category"
          >
            <Text className={`text-center font-medium ${viewMode === "categories" ? "text-background" : "text-foreground"}`}>
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
          >
            <Text className={`text-center font-medium ${viewMode === "products" ? "text-background" : "text-foreground"}`}>
              Products
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar (products mode only) */}
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

      {/* Category filter pills (products mode only) */}
      {isProductsMode && categories.length > 0 && (
        <View className="px-4 mb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setSelectedCategory("all")}
                className={`px-3 py-2 rounded-full border ${selectedCategory === "all" ? "bg-primary border-primary" : "bg-surface border-border"}`}
              >
                <Text className={`text-xs font-medium ${selectedCategory === "all" ? "text-background" : "text-foreground"}`}>
                  All Products
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => setSelectedCategory(cat.value)}
                  className={`px-3 py-2 rounded-full border ${selectedCategory === cat.value ? "bg-primary border-primary" : "bg-surface border-border"}`}
                >
                  <Text className={`text-xs font-medium ${selectedCategory === cat.value ? "text-background" : "text-foreground"}`}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Results count (products mode) */}
      {isProductsMode && (
        <Text className="px-4 text-sm text-muted mb-3">
          {`Showing ${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`}
        </Text>
      )}

      {/* Categories view */}
      {viewMode === "categories" && (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        >
          <View className="pb-16">
            {categorySections.map((section) => {
              const cardBgKey = `cat-bg-${section.value}`;
              const hasCardImage = Boolean(section.imageUrl && !failedImages[cardBgKey]);
              return (
                <View
                  key={section.value}
                  className="mb-5 rounded-2xl overflow-hidden"
                  style={{
                    borderWidth: 1,
                    borderColor: colorScheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                  }}
                >
                  <ImageBackground
                    source={hasCardImage && section.imageUrl ? { uri: section.imageUrl } : undefined}
                    resizeMode="cover"
                    onError={() => markImageFailed(cardBgKey)}
                    style={{ backgroundColor: colors.surface }}
                    imageStyle={{ opacity: 0.55 }}
                  >
                    <View
                      className="absolute inset-0"
                      style={{
                        backgroundColor:
                          colorScheme === "dark" ? "rgba(2,6,23,0.48)" : "rgba(248,250,252,0.55)",
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
                            const imgKey = `cat-prev-${section.value}-${product.id}`;
                            const previewUrl = product.imageUrl || section.imageUrl;
                            const hasImg = Boolean(previewUrl && !failedImages[imgKey]);
                            return (
                              <TouchableOpacity
                                key={product.id}
                                onPress={() => onProductPress(product)}
                                style={{ width: 100, height: 100, borderRadius: 14, overflow: "hidden" }}
                              >
                                <View
                                  className="flex-1 items-center justify-center"
                                  style={{
                                    backgroundColor: colorScheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)",
                                    borderRadius: 14,
                                  }}
                                >
                                  {hasImg && previewUrl ? (
                                    <Image
                                      source={{ uri: previewUrl }}
                                      style={{ width: 100, height: 100, borderRadius: 14 }}
                                      resizeMode="cover"
                                      onError={() => markImageFailed(imgKey)}
                                    />
                                  ) : (
                                    <IconSymbol name="cube.box" size={28} color={colors.muted} />
                                  )}
                                  {isSelectionMode && selectedIds?.includes(product.id) && (
                                    <View className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary items-center justify-center">
                                      <IconSymbol name="checkmark" size={12} color={colors.background} />
                                    </View>
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
                        <Text className="text-white/60 text-xs" numberOfLines={1}>{section.label}</Text>
                        {section.previewProducts[0] && (
                          <Text className="text-white text-base font-bold mt-0.5" numberOfLines={2}>
                            {section.previewProducts[0].name}
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
            {categorySections.length === 0 && (
              <View className="items-center py-16">
                <IconSymbol name="cube.box" size={32} color={colors.muted} />
                <Text className="text-lg font-semibold text-foreground mt-3 mb-2">No collections found</Text>
                <Text className="text-muted text-center">Sync Shopify to load collection cards.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Products list view */}
      {isProductsMode && (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        >
          <View className="pb-16">
            {filteredProducts.map((product) => {
              const isSelected = selectedIds?.includes(product.id) ?? false;
              const price = parseFloat(product.price);
              const inStock = product.availability === "available" && (product.inventoryQuantity || 0) > 0;
              return (
                <View
                  key={product.id}
                  className={`bg-surface border rounded-xl p-3 mb-2 flex-row items-center ${isSelected ? "border-primary" : "border-border"}`}
                >
                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                    onPress={() => onProductPress(product)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12, overflow: "hidden" }}>
                      {product.imageUrl && !failedImages[`prod-${product.id}`] ? (
                        <Image
                          source={{ uri: product.imageUrl }}
                          style={{ width: 56, height: 56 }}
                          resizeMode="cover"
                          onError={() => markImageFailed(`prod-${product.id}`)}
                        />
                      ) : (
                        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.border }}>
                          <IconSymbol name="bag.fill" size={22} color={colors.muted} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className="text-foreground font-medium" numberOfLines={1}>{product.name}</Text>
                      {product.brand && <Text className="text-muted text-xs">{product.brand}</Text>}
                      <View className="flex-row items-center mt-1">
                        <Text className="text-primary font-semibold">${price.toFixed(2)}</Text>
                        <View className={`w-1.5 h-1.5 rounded-full ml-2 ${inStock ? "bg-success" : "bg-error"}`} />
                        <Text className={`text-xs ml-1 ${inStock ? "text-success" : "text-error"}`}>
                          {inStock ? `${product.inventoryQuantity} in stock` : "Out of stock"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {isSelectionMode && onToggle && (
                    <TouchableOpacity style={{ padding: 12, marginRight: -8 }} onPress={() => onToggle(product)} activeOpacity={0.7}>
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                        {isSelected && <IconSymbol name="checkmark" size={14} color={colors.background} />}
                      </View>
                    </TouchableOpacity>
                  )}

                  {renderProductAction && !isSelectionMode && (
                    <View>{renderProductAction(product)}</View>
                  )}
                </View>
              );
            })}

            {filteredProducts.length === 0 && (
              <View className="items-center py-16">
                <IconSymbol name="magnifyingglass" size={32} color={colors.muted} />
                <Text className="text-lg font-semibold text-foreground mt-3 mb-2">No products found</Text>
                <Text className="text-muted text-center mb-4">Try adjusting your search or filter</Text>
                <TouchableOpacity
                  onPress={() => { setSearchQuery(""); setSelectedCategory("all"); }}
                  className="px-4 py-2 border border-border rounded-lg"
                >
                  <Text className="text-foreground">Clear filters</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
