// import { useBottomNavHeight } from "@/components/role-bottom-nav";
import { SingleImagePicker } from "@/components/media-picker";
import { PlanShoppingProductsWrap } from "@/components/plan-shopping-products-wrap";
import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LogoLoader } from "@/components/ui/logo-loader";
import { ModalHeader } from "@/components/ui/modal-header";
import { useAuthContext } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as FileSystem from "expo-file-system/legacy";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
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

import { getBundleFallbackImageUrl, normalizeAssetUrl } from "@/lib/asset-url";
import { sanitizeHtml, stripHtml } from "@/lib/html-utils";
import { mapBundleDraftToBundleView } from "@/shared/bundle-offer";

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
  image?: string | null;
  productsJson?: unknown;
  price: string | null;
  cadence: "one_time" | "weekly" | "monthly" | null;
  trainerId?: string | null;
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

function guessImageMimeType(uri: string): string {
  const normalized = uri.toLowerCase();
  if (normalized.includes(".png")) return "image/png";
  if (normalized.includes(".webp")) return "image/webp";
  if (normalized.includes(".gif")) return "image/gif";
  if (normalized.includes(".heic")) return "image/heic";
  if (normalized.includes(".heif")) return "image/heif";
  return "image/jpeg";
}

async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    return uri.split(",").pop() || "";
  }

  if (uri.startsWith("file:") || uri.startsWith("content:")) {
    return FileSystem.readAsStringAsync(uri, { encoding: "base64" });
  }

  const response = await fetch(uri);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",").pop() || "");
    };
    reader.readAsDataURL(blob);
  });
}

function extractListItemsFromHtml(description: string): string[] {
  const names: string[] = [];
  const liMatches = description.matchAll(/<li>(.*?)<\/li>/gi);
  for (const match of liMatches) {
    const raw = String(match[1] || "");
    const withoutTags = raw.replace(/<[^>]+>/g, "");
    const withoutQty = withoutTags.replace(/\(x\d+\)/gi, "");
    const cleaned = withoutQty.trim();
    if (cleaned) names.push(cleaned);
  }
  return names;
}

function ProductsScreenInner({ planShopEmbedded = false }: { planShopEmbedded?: boolean }) {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { canManage, effectiveRole, effectiveUser, isClient, isCoordinator, isManager, isTrainer } = useAuthContext();
  const isAdmin = isCoordinator || isManager;
  // const bottomNavHeight = useBottomNavHeight();
  const canPurchase = isClient || isTrainer || effectiveRole === "shopper" || !effectiveRole;
  const { width, height: windowHeight } = useWindowDimensions();
  const overlayColor = "rgba(0,0,0,0.85)";
  const detailSheetMaxHeight = Math.min(windowHeight * 0.88, 820);
  const { addItem, proposalContext } = useCart();
  const isPlanShopping = isTrainer && !!proposalContext?.clientRecordId;
  const canShowCustomTab = isTrainer && isPlanShopping;
  const [viewMode, setViewMode] = useState<"bundles" | "categories" | "products" | "custom">("categories");
  const [showHiddenBundles, setShowHiddenBundles] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [customSearchQuery, setCustomSearchQuery] = useState("");
  const [bundleSearchQuery, setBundleSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [editingCustomProduct, setEditingCustomProduct] = useState<{
    id: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    price: string | number;
    fulfillmentMethod?: string | null;
  } | null>(null);
  const [customProductName, setCustomProductName] = useState("");
  const [customProductPrice, setCustomProductPrice] = useState("");
  const [customProductDescription, setCustomProductDescription] = useState("");
  const [customProductImageUrl, setCustomProductImageUrl] = useState("");
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<{ type: "image" | "video"; uri: string }[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const { q, productId: productIdParam, id: legacyProductIdParam } = useLocalSearchParams();

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

  useEffect(() => {
    if (viewMode !== "custom") {
      setCustomSearchQuery("");
    }
  }, [viewMode]);

  useEffect(() => {
    if (!canShowCustomTab && viewMode === "custom") {
      setViewMode("categories");
    }
  }, [canShowCustomTab, viewMode]);

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
  const {
    data: bundles,
    isLoading: publicBundlesLoading,
    isRefetching: publicBundlesRefetching,
    refetch: refetchPublicBundles,
  } = trpc.catalog.bundles.useQuery(undefined, {
    staleTime: 60000,
    enabled: !(isPlanShopping && isTrainer),
  });
  /** Same source as trainer bundles (`/(trainer)/bundles`); plan builder only lists published bundles. */
  const {
    data: trainerBundlesForPlan,
    isLoading: trainerBundlesForPlanLoading,
    isRefetching: trainerBundlesForPlanRefetching,
    refetch: refetchTrainerBundlesForPlan,
  } = trpc.bundles.list.useQuery(undefined, {
    staleTime: 60000,
    enabled: isPlanShopping && isTrainer,
  });
  const { data: allBundles } = trpc.catalog.allBundles.useQuery(undefined, {
    staleTime: 60000,
    enabled: isAdmin,
  });
  const {
    data: customProducts = [],
    isLoading: customProductsLoading,
    isRefetching: customProductsRefetching,
    refetch: refetchCustomProducts,
  } = trpc.customProducts.list.useQuery(undefined, {
    staleTime: 60000,
    enabled: canShowCustomTab,
  });
  const { data: collections = [] } = trpc.catalog.collections.useQuery(undefined, {
    staleTime: 60000,
  });
  const createCustomProductMutation = trpc.customProducts.create.useMutation();
  const updateCustomProductMutation = trpc.customProducts.update.useMutation();
  const deleteCustomProductMutation = trpc.customProducts.delete.useMutation();
  const uploadAttachmentMutation = trpc.messages.uploadAttachment.useMutation();
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

  useEffect(() => {
    const rawProductId = productIdParam ?? legacyProductIdParam;
    if (rawProductId && products) {
      const pid = Array.isArray(rawProductId) ? rawProductId[0] : rawProductId;
      const match = products.find((p) => p.id === pid);
      if (match) {
        setSelectedProduct(match);
        setDetailModalOpen(true);
      }
    }
  }, [legacyProductIdParam, productIdParam, products]);

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

  const productImageByName = useMemo(() => {
    const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const imageMap = new Map<string, string>();
    for (const product of baseProducts) {
      if (!product?.name || !product.imageUrl) continue;
      const normalized = normalizeName(product.name);
      const normalizedImageUrl = normalizeAssetUrl(product.imageUrl);
      if (!normalizedImageUrl) continue;
      if (!imageMap.has(normalized)) {
        imageMap.set(normalized, normalizedImageUrl);
      }
    }
    return imageMap;
  }, [baseProducts]);
  const productImageEntries = useMemo(() => Array.from(productImageByName.entries()), [productImageByName]);

  const resolveBundleImageUrl = useCallback(
    (bundle: Bundle) => {
      const offer = mapBundleDraftToBundleView(bundle as any);
      const directImageUrl = normalizeAssetUrl(bundle.imageUrl || bundle.image || offer.imageUrl);
      if (directImageUrl) return directImageUrl;

      const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
      const candidates = new Set<string>();
      if (offer.title) candidates.add(normalizeName(offer.title));
      for (const included of offer.included) {
        if (included) candidates.add(normalizeName(included));
      }
      if (offer.description) {
        for (const extracted of extractListItemsFromHtml(offer.description)) {
          candidates.add(normalizeName(extracted));
        }
      }

      for (const name of candidates) {
        const match = productImageByName.get(name);
        if (match) return match;
      }

      for (const name of candidates) {
        for (const [productName, imageUrl] of productImageEntries) {
          if (name.includes(productName) || productName.includes(name)) {
            return imageUrl;
          }
        }
      }

      return getBundleFallbackImageUrl(offer.title);
    },
    [productImageByName, productImageEntries],
  );

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
    const source = (() => {
      if (isPlanShopping && isTrainer) {
        const raw = (trainerBundlesForPlan ?? []) as Bundle[];
        return raw.filter((b) => String((b as any).status || "").toLowerCase() === "published");
      }
      return ((isAdmin && showHiddenBundles ? allBundles : bundles) as Bundle[] | undefined) ?? [];
    })();
    let all = (source ?? []).map((bundle) => ({
      ...bundle,
      imageUrl: resolveBundleImageUrl(bundle),
    }));
    if (!bundleSearchQuery.trim()) return all;
    const term = bundleSearchQuery.toLowerCase();
    return all.filter(
      (b) =>
        b.title.toLowerCase().includes(term) ||
        (b.description || "").toLowerCase().includes(term),
    );
  }, [
    bundles,
    allBundles,
    trainerBundlesForPlan,
    bundleSearchQuery,
    isAdmin,
    showHiddenBundles,
    isPlanShopping,
    isTrainer,
    resolveBundleImageUrl,
  ]);

  const bundlesCatalogLoading =
    isPlanShopping && isTrainer ? trainerBundlesForPlanLoading : publicBundlesLoading;

  const filteredCustomProducts = useMemo(() => {
    const term = customSearchQuery.trim().toLowerCase();
    if (!term) return customProducts;
    return customProducts.filter((product) => {
      const haystack = [product.name, product.description || ""].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [customProducts, customSearchQuery]);

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

  const productAddRefs = useRef<Record<string, RefObject<View | null>>>({});
  const customProductAddRefs = useRef<Record<string, RefObject<View | null>>>({});
  const detailAddButtonRef = useRef<View | null>(null);
  const createCustomProductButtonRef = useRef<View | null>(null);

  const getProductAddRef = useCallback((productId: string) => {
    if (!productAddRefs.current[productId]) {
      productAddRefs.current[productId] = createRef<View>();
    }
    return productAddRefs.current[productId];
  }, []);

  const getCustomProductAddRef = useCallback((productId: string) => {
    if (!customProductAddRefs.current[productId]) {
      customProductAddRefs.current[productId] = createRef<View>();
    }
    return customProductAddRefs.current[productId];
  }, []);

  const closeCustomProductModal = () => {
    setShowCustomProductModal(false);
    setEditingCustomProduct(null);
    setCustomProductName("");
    setCustomProductPrice("");
    setCustomProductDescription("");
    setCustomProductImageUrl("");
  };

  const openCreateCustomProductModal = () => {
    setEditingCustomProduct(null);
    setCustomProductName("");
    setCustomProductPrice("");
    setCustomProductDescription("");
    setCustomProductImageUrl("");
    setShowCustomProductModal(true);
  };

  const openEditCustomProductModal = (product: {
    id: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    price: string | number;
    fulfillmentMethod?: string | null;
  }) => {
    setEditingCustomProduct(product);
    setCustomProductName(product.name || "");
    setCustomProductPrice(String(product.price || ""));
    setCustomProductDescription(product.description || "");
    setCustomProductImageUrl(product.imageUrl || "");
    setShowCustomProductModal(true);
  };

  // Handle add to cart
  const handleAddToCart = (
    product: Product,
    options?: {
      flyFromRef?: RefObject<View | null>;
      closeAfterAdd?: boolean;
    },
  ) => {
    if (!canPurchase) return;
    const imageUrl = normalizeAssetUrl(product.imageUrl) ?? undefined;
    addItem({
      type: "product",
      title: product.name,
      price: parseFloat(product.price),
      quantity: 1,
      imageUrl,
      productId: product.id,
      fulfillment: "home_ship",
    }, {
      flyFromRef: options?.flyFromRef,
      imageUri: imageUrl,
    });
    if (options?.closeAfterAdd) {
      setDetailModalOpen(false);
    }
  };

  const handleAddCustomProductToCart = (
    product: {
      id: string;
      name: string;
      description?: string | null;
      price: string | number;
      imageUrl?: string | null;
      fulfillmentMethod?: string | null;
    },
    options?: {
      flyFromRef?: RefObject<View | null>;
    },
  ) => {
    const imageUrl = normalizeAssetUrl(product.imageUrl) ?? undefined;
    addItem(
      {
        type: "custom_product",
        title: product.name,
        description: product.description || undefined,
        customProductId: product.id,
        trainer: effectiveUser?.name || "Trainer",
        trainerId: effectiveUser?.id,
        price: Number.parseFloat(String(product.price || "0")),
        quantity: 1,
        imageUrl,
        cadence: "one_time",
        fulfillment: (product.fulfillmentMethod as any) || "trainer_delivery",
      },
      {
        flyFromRef: options?.flyFromRef,
        imageUri: imageUrl,
      },
    );
  };

  const handleCreateCustomProduct = async () => {
    try {
      const parsedPrice = Number.parseFloat(customProductPrice || "0");
      if (!customProductName.trim()) {
        Alert.alert("Product name required", "Enter a custom product name.");
        return;
      }
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        Alert.alert("Valid price required", "Enter a valid custom product price.");
        return;
      }
      let uploadedImageUrl: string | undefined;
      const rawImageValue = customProductImageUrl.trim();
      if (rawImageValue && !/^https?:\/\//i.test(rawImageValue)) {
        const base64 = await uriToBase64(rawImageValue);
        if (!base64) {
          Alert.alert("Image unavailable", "Could not read this image. Try another photo.");
          return;
        }
        const mimeType = guessImageMimeType(rawImageValue);
        const ext = mimeType.split("/")[1] || "jpg";
        const uploadResult = await uploadAttachmentMutation.mutateAsync({
          fileName: `custom-product-${Date.now()}.${ext}`,
          fileData: base64,
          mimeType,
        });
        uploadedImageUrl = uploadResult.url;
      }

      const effectiveImageUrl =
        uploadedImageUrl ?? (rawImageValue.length > 0 ? rawImageValue : undefined);

      const payload = {
        name: customProductName.trim(),
        description: customProductDescription.trim() || undefined,
        imageUrl: effectiveImageUrl,
        price: parsedPrice.toFixed(2),
      };
      if (editingCustomProduct) {
        await updateCustomProductMutation.mutateAsync({
          id: editingCustomProduct.id,
          ...payload,
        });
        await refetchCustomProducts();
        closeCustomProductModal();
        return;
      }
      const created = await createCustomProductMutation.mutateAsync(payload);
      await refetchCustomProducts();
      handleAddCustomProductToCart(created, { flyFromRef: createCustomProductButtonRef });
      closeCustomProductModal();
    } catch (error) {
      Alert.alert(
        editingCustomProduct ? "Save failed" : "Create failed",
        error instanceof Error ? error.message : "Unable to save this custom product.",
      );
    }
  };

  const handleDeleteCustomProduct = async () => {
    if (!editingCustomProduct) return;
    Alert.alert(
      "Delete custom product",
      `Remove ${editingCustomProduct.name} from your custom products list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteCustomProductMutation.mutateAsync({
                  id: editingCustomProduct.id,
                });
                await refetchCustomProducts();
                closeCustomProductModal();
              } catch (error) {
                Alert.alert(
                  "Delete failed",
                  error instanceof Error ? error.message : "Unable to delete this custom product.",
                );
              }
            })();
          },
        },
      ],
    );
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
  const isCustomMode = viewMode === "custom";
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

  if (isPlanShopping && !planShopEmbedded) {
    return (
      <PlanShoppingProductsWrap>
        <ProductsScreenInner planShopEmbedded />
      </PlanShoppingProductsWrap>
    );
  }

  return (
    <ScreenContainer className="flex-1" edges={isPlanShopping ? ["left", "right"] : ["top", "left", "right"]}>
      {/* Header — hidden when trainer plan shopping (shell provides chrome) */}
      {!isPlanShopping && (
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
      )}

      {/* Browse Mode Tabs — explicit RN styles for selected state so highlight syncs on first tap (NativeWind conditional classes can lag). */}
      <View className="px-4 mb-3">
        <View
          className="flex-row bg-surface border border-border rounded-xl p-1"
          accessibilityRole="tablist"
        >
          <Pressable
            onPress={() => setViewMode("bundles")}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === "bundles" }}
            accessibilityLabel="Browse trainer bundles"
            testID="products-tab-bundles"
            android_ripple={{ color: `${colors.primary}33` }}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: viewMode === "bundles" ? colors.primary : "transparent",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "600",
                fontSize: 15,
                color: viewMode === "bundles" ? colors["primary-foreground"] : colors.foreground,
              }}
            >
              Bundles
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode("categories")}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === "categories" }}
            accessibilityLabel="Browse by category"
            testID="products-tab-categories"
            android_ripple={{ color: `${colors.primary}33` }}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: viewMode === "categories" ? colors.primary : "transparent",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "600",
                fontSize: 15,
                color: viewMode === "categories" ? colors["primary-foreground"] : colors.foreground,
              }}
            >
              Categories
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setSelectedCategory("all");
              setViewMode("products");
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === "products" }}
            accessibilityLabel="Browse all products"
            testID="products-tab-products"
            android_ripple={{ color: `${colors.primary}33` }}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: viewMode === "products" ? colors.primary : "transparent",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: "600",
                fontSize: 15,
                color: viewMode === "products" ? colors["primary-foreground"] : colors.foreground,
              }}
            >
              Products
            </Text>
          </Pressable>
          {canShowCustomTab ? (
            <Pressable
              onPress={() => setViewMode("custom")}
              accessibilityRole="tab"
              accessibilityState={{ selected: viewMode === "custom" }}
              accessibilityLabel="Browse trainer custom products"
              testID="products-tab-custom"
              android_ripple={{ color: `${colors.primary}33` }}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: viewMode === "custom" ? colors.primary : "transparent",
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "600",
                  fontSize: 15,
                  color: viewMode === "custom" ? colors["primary-foreground"] : colors.foreground,
                }}
              >
                Custom
              </Text>
            </Pressable>
          ) : null}
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
          {isAdmin && (
            <TouchableOpacity
              onPress={() => setShowHiddenBundles(!showHiddenBundles)}
              className="flex-row items-center mt-2"
              accessibilityRole="button"
              accessibilityLabel={showHiddenBundles ? "Hide withdrawn bundles" : "Show withdrawn bundles"}
            >
              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: showHiddenBundles ? colors.primary : colors.muted, backgroundColor: showHiddenBundles ? colors.primary : "transparent", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
                {showHiddenBundles && <IconSymbol name="checkmark" size={12} color="#fff" />}
              </View>
              <Text className="text-sm text-muted">Show hidden / withdrawn bundles</Text>
            </TouchableOpacity>
          )}
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

      {isCustomMode && (
        <View className="px-4 mb-3">
          <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 border border-border">
            <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
            <TextInput
              placeholder="Search custom products..."
              placeholderTextColor={colors.muted}
              value={customSearchQuery}
              onChangeText={setCustomSearchQuery}
              className="flex-1 ml-3 text-foreground text-base"
              returnKeyType="search"
            />
            {customSearchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setCustomSearchQuery("")}>
                <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {viewMode === "bundles" && !bundlesCatalogLoading && !error && (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={
                isRefetching ||
                (isPlanShopping && isTrainer
                  ? trainerBundlesForPlanRefetching
                  : publicBundlesRefetching)
              }
              onRefresh={async () => {
                await refetch();
                if (isPlanShopping && isTrainer) await refetchTrainerBundlesForPlan();
                else await refetchPublicBundles();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <View className="pb-24">
            {filteredBundles.map((bundle) => (
              (() => {
                const bundleImageKey = `bundle-${bundle.id}-${bundle.imageUrl || "none"}`;
                return (
              <TouchableOpacity
                key={bundle.id}
                onPress={() => {
                  if (isClient) {
                    router.push({ pathname: "/(client)/bundle/[id]", params: { id: bundle.id } } as any);
                    return;
                  }
                  if (isTrainer && isPlanShopping) {
                    router.push({ pathname: "/bundle/[id]", params: { id: bundle.id } } as any);
                    return;
                  }
                  if (isTrainer) {
                    router.push(`/(trainer)/bundle/${bundle.id}` as any);
                    return;
                  }
                  router.push({ pathname: "/bundle/[id]", params: { id: bundle.id } } as any);
                }}
                className="mb-6 bg-surface rounded-2xl overflow-hidden border border-border"
                accessibilityRole="button"
                accessibilityLabel={`View ${bundle.title} bundle`}
                testID={`bundle-card-${bundle.id}`}
              >
                <View className="bg-background items-center justify-center" style={{ height: 210 }}>
                  {bundle.imageUrl && !failedImages[bundleImageKey] ? (
                    <Image
                      source={{ uri: bundle.imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                      onError={() => markImageFailed(bundleImageKey)}
                    />
                  ) : (
                    <IconSymbol name="cube.box" size={48} color={colors.muted} />
                  )}
                </View>
                <View className="p-4">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-lg font-semibold text-foreground flex-1 mr-2" numberOfLines={2}>
                      {bundle.title}
                    </Text>
                    {isAdmin && showHiddenBundles && (bundle as any).status !== "published" && (
                      <View style={{
                        backgroundColor: (bundle as any).status === "archived" ? "rgba(248,113,113,0.15)" : "rgba(250,204,21,0.15)",
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: "600", color: (bundle as any).status === "archived" ? "#F87171" : "#FACC15", textTransform: "capitalize" }}>
                          {((bundle as any).status || "draft").replace(/_/g, " ")}
                        </Text>
                      </View>
                    )}
                  </View>
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
                );
              })()
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

      {viewMode === "bundles" && bundlesCatalogLoading && !error && (
        <View className="flex-1 items-center justify-center py-16 px-4" accessibilityLabel="Loading bundles">
          <LogoLoader size={48} />
          <Text className="text-muted mt-4 text-sm">Loading bundles…</Text>
        </View>
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

      {isCustomMode && !customProductsLoading && (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={customProductsRefetching}
              onRefresh={() => void refetchCustomProducts()}
              tintColor={colors.primary}
            />
          }
        >
          <View className="pb-24">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-semibold text-foreground">Custom Products</Text>
                <Text className="text-sm text-muted mt-1">
                  Add your trainer-owned products directly into this plan.
                </Text>
              </View>
              <TouchableOpacity
                className="bg-primary rounded-full px-4 py-2"
                onPress={openCreateCustomProductModal}
                accessibilityRole="button"
                accessibilityLabel="Create custom product"
                testID="products-custom-create"
              >
                <Text className="text-background font-semibold">Create</Text>
              </TouchableOpacity>
            </View>

            {filteredCustomProducts.length === 0 ? (
              <View className="items-center py-16">
                <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                  <IconSymbol name="bag.fill" size={32} color={colors.muted} />
                </View>
                <Text className="text-lg font-semibold text-foreground mb-2">
                  {customSearchQuery.trim() ? "No custom products found" : "No custom products yet"}
                </Text>
                <Text className="text-muted text-center mb-4">
                  {customSearchQuery.trim()
                    ? "Try a different search term."
                    : "Create trainer-delivered custom products such as tennis balls or gloves."}
                </Text>
                <TouchableOpacity
                  className="bg-primary rounded-full px-6 py-3"
                  onPress={openCreateCustomProductModal}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new custom product"
                  testID="products-custom-empty-create"
                >
                  <Text className="text-background font-semibold">Create Custom Product</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row flex-wrap justify-between pb-24">
                {filteredCustomProducts.map((product) => {
                  const customProductAddRef = getCustomProductAddRef(product.id);
                  const customImageKey = `custom-product-${product.id}`;
                  const customImageUrl = normalizeAssetUrl(product.imageUrl);
                  return (
                    <View
                      key={product.id}
                      className="mb-4 bg-surface rounded-xl overflow-hidden border border-border"
                      style={{ width: "46%", maxWidth: 180 }}
                    >
                      <View className="bg-background items-center justify-center" style={{ height: 140 }}>
                        {customImageUrl && !failedImages[customImageKey] ? (
                          <Image
                            source={{ uri: customImageUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                            onError={() => markImageFailed(customImageKey)}
                          />
                        ) : (
                          <IconSymbol name="bag.fill" size={40} color={colors.muted} />
                        )}
                      </View>

                      <View className="p-2.5">
                        <View className="flex-row items-start justify-between gap-2">
                          <Text className="text-xs text-foreground flex-1" numberOfLines={2}>
                            {product.name}
                          </Text>
                          <TouchableOpacity
                            className="w-8 h-8 rounded-full bg-surface border border-border items-center justify-center"
                            onPress={() => openEditCustomProductModal(product)}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit custom product ${product.name}`}
                            testID={`products-custom-edit-${product.id}`}
                          >
                            <IconSymbol name="pencil" size={14} color={colors.foreground} />
                          </TouchableOpacity>
                        </View>

                        <View className="bg-primary/10 self-start px-2 py-0.5 rounded mt-1 mb-1">
                          <Text className="text-xs text-primary">Custom</Text>
                        </View>

                        {product.description ? (
                          <Text className="text-[11px] text-muted mt-0.5" numberOfLines={2}>
                            {product.description}
                          </Text>
                        ) : null}

                        <Text className="text-base font-bold text-foreground mt-2">
                          £{Number(product.price || 0).toFixed(2)}
                        </Text>
                      </View>

                      <View className="px-2.5 pb-2.5">
                        <View ref={customProductAddRef} collapsable={false}>
                          <TouchableOpacity
                            className="py-1.5 rounded-lg items-center bg-primary"
                            onPress={() =>
                              handleAddCustomProductToCart(product, {
                                flyFromRef: customProductAddRef,
                              })
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Add custom product ${product.name} to plan`}
                            testID={`products-custom-add-${product.id}`}
                          >
                            <Text className="text-xs font-semibold text-white">Add to Cart</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      {/* Loading State */}
      {isLoading && viewMode !== "custom" && (
        <View className="flex-1 items-center justify-center">
          <LogoLoader size={72} />
          <Text className="text-muted mt-3">Loading products...</Text>
        </View>
      )}

      {isCustomMode && customProductsLoading ? (
        <View className="flex-1 items-center justify-center">
          <LogoLoader size={72} />
          <Text className="text-muted mt-3">Loading custom products...</Text>
        </View>
      ) : null}

      {/* Error State */}
      {!isLoading && !isCustomMode && error && (
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
                    const productAddButtonRef = getProductAddRef(product.id);

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
                            <View
                              ref={productAddButtonRef}
                              collapsable={false}
                            >
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleAddToCart(product, { flyFromRef: productAddButtonRef });
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
                            </View>
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
            style={{
              backgroundColor: colors.background,
              maxHeight: detailSheetMaxHeight,
              flexShrink: 1,
            }}
          >
            {selectedProduct && (
              <ScrollView
                style={{ backgroundColor: colors.background, maxHeight: detailSheetMaxHeight }}
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
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
                    <View ref={detailAddButtonRef} collapsable={false}>
                      <TouchableOpacity
                        onPress={() =>
                          handleAddToCart(selectedProduct, {
                            flyFromRef: detailAddButtonRef,
                            closeAfterAdd: true,
                          })
                        }
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
                    </View>
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
          onPress={() => setMediaModalOpen(false)}
          style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: overlayColor }}
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

      <Modal
        visible={showCustomProductModal}
        transparent
        animationType="slide"
        onRequestClose={closeCustomProductModal}
      >
        <View className="flex-1">
          <Pressable
            className="flex-1 bg-black/50"
            onPress={closeCustomProductModal}
            accessibilityLabel="Dismiss custom product creation"
            accessibilityRole="button"
          />
          <View className="bg-background rounded-t-3xl">
            <View className="px-4 pt-4 pb-2">
              <ModalHeader
                title={editingCustomProduct ? "Edit Custom Product" : "Create Custom Product"}
                subtitle={
                  editingCustomProduct
                    ? "Update this trainer-owned custom product or remove it if you no longer use it."
                    : "This product is reusable, trainer-owned, and delivered by you through the app."
                }
                onClose={closeCustomProductModal}
              />
            </View>
            <ScrollView
              className="px-4 pb-4"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <TextInput
                className="border border-border rounded-lg px-4 py-3 text-foreground mb-2"
                value={customProductName}
                onChangeText={setCustomProductName}
                placeholder="Name"
                placeholderTextColor={colors.muted}
              />
              <TextInput
                className="border border-border rounded-lg px-4 py-3 text-foreground mb-2"
                value={customProductPrice}
                onChangeText={setCustomProductPrice}
                placeholder="Price"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
              />
              <TextInput
                className="border border-border rounded-lg px-4 py-3 text-foreground mb-3"
                value={customProductDescription}
                onChangeText={setCustomProductDescription}
                placeholder="Description"
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
              />
              <SingleImagePicker
                image={customProductImageUrl || null}
                onImageChange={(uri) => setCustomProductImageUrl(uri || "")}
                aspectRatio={[1, 1]}
                compactWhenEmpty
                emptyButtonLabel="Upload product image"
                placeholder="Upload custom product image"
                accessibilityLabel="Upload custom product image"
                testID="products-custom-image-upload"
              />
              <Text className="text-xs text-muted mt-2 mb-3">
                Pick a photo from your library or camera. It will upload when you save this product.
              </Text>
              <View className="flex-row gap-2">
                {editingCustomProduct ? (
                  <TouchableOpacity
                    className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 items-center"
                    onPress={() => void handleDeleteCustomProduct()}
                    accessibilityRole="button"
                    accessibilityLabel="Delete custom product"
                    testID="products-custom-modal-delete"
                  >
                    <Text className="text-error font-semibold">Delete</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border rounded-xl py-3 items-center"
                  onPress={closeCustomProductModal}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel custom product creation"
                  testID="products-custom-modal-cancel"
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </TouchableOpacity>
                <View ref={createCustomProductButtonRef} collapsable={false} className="flex-1">
                  <TouchableOpacity
                    className="bg-primary rounded-xl py-3 items-center"
                    onPress={() => void handleCreateCustomProduct()}
                    disabled={
                      createCustomProductMutation.isPending ||
                      updateCustomProductMutation.isPending ||
                      uploadAttachmentMutation.isPending
                    }
                    style={{
                      opacity:
                        createCustomProductMutation.isPending ||
                        updateCustomProductMutation.isPending ||
                        uploadAttachmentMutation.isPending
                          ? 0.7
                          : 1,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      editingCustomProduct
                        ? "Save custom product changes"
                        : "Create custom product and add to plan"
                    }
                    testID="products-custom-modal-create"
                  >
                    <Text className="text-background font-semibold">
                      {uploadAttachmentMutation.isPending
                        ? "Uploading..."
                        : createCustomProductMutation.isPending
                        ? "Creating..."
                        : updateCustomProductMutation.isPending
                          ? "Saving..."
                          : editingCustomProduct
                            ? "Save Changes"
                            : "Create and Add"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
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

export default function ProductsScreen(props?: { planShopEmbedded?: boolean }) {
  return <ProductsScreenInner planShopEmbedded={props?.planShopEmbedded ?? false} />;
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
