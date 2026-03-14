import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { ServicePickerModal } from "@/components/service-picker-modal";
import { LogoLoader } from "@/components/ui/logo-loader";
import { withAlpha } from "@/design-system/color-utils";
import { useDesignSystem } from "@/hooks/use-design-system";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { SingleImagePicker } from "@/components/media-picker";
import { haptics } from "@/hooks/use-haptics";
import { CAMPAIGN_COPY } from "@/lib/campaign-copy";
import { normalizeAssetUrl } from "@/lib/asset-url";

// Service types for bundles - matching original locoman
type ServiceItem = {
  id: string;
  type: string;
  name: string;
  count: number;
  duration: number; // in minutes
  price: number;
  unit: string;
};

type CatalogProductItem = {
  id: string;
  shopifyProductId: number | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  brand: string | null;
  category: string | null;
  inventoryQuantity: number | null;
  availability: string | null;
};

type ProductItem = {
  id: string | number;
  title: string;
  description: string | null;
  vendor: string | null;
  productType: string | null;
  status: string;
  price: string;
  variantId?: number;
  sku: string;
  inventory: number;
  imageUrl: string | null;
  quantity?: number;
  source?: "shopify" | "custom";
  productId?: string | number;
  customProductId?: string;
  shopifyProductId?: number | null;
  fulfillmentMethod?: "trainer_delivery" | "home_ship" | "vending" | "cafeteria";
};

type TrainerCustomProductItem = {
  id: string;
  trainerId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  price: string;
  fulfillmentMethod: "trainer_delivery" | "home_ship" | "vending" | "cafeteria";
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

// Product item with quantity (for bundle products)
type BundleProductItem = ProductItem & { quantity: number };

// Bundle form state - matching original locoman
type BundleFormState = {
  title: string;
  description: string;
  price: string;
  cadence: "one_time" | "weekly" | "monthly";
  imageUrl: string;
  imageSource: "ai" | "custom";
  services: ServiceItem[];
  products: BundleProductItem[];
  goals: string[];
  suggestedGoal: string;
  status: "draft" | "pending_review" | "changes_requested" | "published" | "rejected";
  rejectionReason?: string;
  reviewComments?: string;
};

const CADENCE_OPTIONS = [
  { value: "one_time" as const, label: "One-Time" },
  { value: "weekly" as const, label: "Weekly" },
  { value: "monthly" as const, label: "Monthly" },
];

function formatFooterAmount(value: number) {
  return `$${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}`;
}

function countItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function normalizeMoneyString(value: unknown, fallback = "0.00") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  return fallback;
}

function toMoneyNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Goal suggestions - matching original locoman
const GOAL_SUGGESTIONS = [
  "Weight Loss",
  "Muscle Building",
  "Strength Training",
  "Flexibility",
  "Endurance",
  "General Fitness",
  "Sports Performance",
  "Injury Recovery",
  "Stress Relief",
  "Better Sleep",
  "Increased Energy",
  "Body Recomposition",
];

export default function BundleEditorScreen() {
  const colors = useColors();
  const ds = useDesignSystem();
  const { id, admin: adminParam, templateId } = useLocalSearchParams<{ id: string; admin?: string; templateId?: string }>();
  const isNewBundle = id === "new";
  const isAdminMode = adminParam === "1";
  const entityLabel = isAdminMode ? "Bundle" : "Offer";
  const entityLabelLower = entityLabel.toLowerCase();
  
  // Parse id safely
  const bundleIdParam = (id && id !== "new") ? id : "";
  const isValidBundleId = bundleIdParam.length > 0;

  const [loading, setLoading] = useState(!isNewBundle);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  type BuilderTab = "campaign" | "details" | "services" | "products";
  const [activeTab, setActiveTab] = useState<BuilderTab>(isNewBundle ? "campaign" : "details");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    templateId ? String(templateId) : null,
  );
  const [campaignMode, setCampaignMode] = useState<"scratch" | "template">(
    templateId ? "template" : "scratch",
  );
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [tabErrorVisibility, setTabErrorVisibility] = useState<Set<BuilderTab>>(new Set());
  const [pendingFocusTarget, setPendingFocusTarget] = useState<string | null>(null);
  const [currentBuilderField, setCurrentBuilderFieldState] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollPositionRef = useRef(0);
  const titleInputRef = useRef<TextInput>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const currentBuilderFieldRef = useRef<string | null>(null);
  const fieldOffsetsRef = useRef<Record<string, number>>({});
  const missingProductAlertKeyRef = useRef("");
  
  // Product selection modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [productSourceFilter, setProductSourceFilter] = useState<"shopify" | "custom">("shopify");
  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [customProductName, setCustomProductName] = useState("");
  const [customProductDescription, setCustomProductDescription] = useState("");
  const [customProductPrice, setCustomProductPrice] = useState("");
  const [customProductImageUrl, setCustomProductImageUrl] = useState("");
  
  // Barcode scanner
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  // Service modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  
  const [customGoal, setCustomGoal] = useState("");

  // Product detail modal
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState<ProductItem | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [showDetailBarcodeScanner, setShowDetailBarcodeScanner] = useState(false);
  const [reopenProductPickerAfterDetail, setReopenProductPickerAfterDetail] = useState(false);
  const [showPriceBreakdownModal, setShowPriceBreakdownModal] = useState(false);
  const [campaignPreviewTemplate, setCampaignPreviewTemplate] = useState<any | null>(null);
  const [showReviewResponseModal, setShowReviewResponseModal] = useState(false);
  const [reviewResponse, setReviewResponse] = useState("");
  const builderTabs: BuilderTab[] = ["campaign", "details", "services", "products"];

  const closeProductDetail = () => {
    setShowProductDetail(false);
    setDetailQuantity(1);
    if (reopenProductPickerAfterDetail) {
      setReopenProductPickerAfterDetail(false);
      setShowProductModal(true);
    }
  };

  // AI image generation mutation
  const generateImageMutation = trpc.ai.generateBundleImage.useMutation();

  const [form, setForm] = useState<BundleFormState>({
    title: "",
    description: "",
    price: "0.00",
    cadence: "monthly",
    imageUrl: "",
    imageSource: "ai",
    services: [],
    products: [],
    goals: [],
    suggestedGoal: "",
    status: "draft",
  });

  // Fetch products from Shopify/database
  const { data: shopifyProducts, isLoading: productsLoading } = trpc.shopify.products.useQuery(undefined, {
    staleTime: 60000,
  });
  const { data: catalogProducts } = trpc.catalog.products.useQuery(undefined, {
    staleTime: 60000,
  });
  const {
    data: templates = [],
    isLoading: templatesLoading,
    isRefetching: templatesRefetching,
    refetch: refetchTemplates,
  } = trpc.bundles.templates.useQuery();
  const customProductsQuery = trpc.customProducts.list.useQuery(undefined, {
    staleTime: 60000,
  });
  const createCustomProductMutation = trpc.customProducts.create.useMutation({
    onSuccess: async (created) => {
      await customProductsQuery.refetch();
      addCustomProductWithQuantity(created, 1);
      setCustomProductName("");
      setCustomProductDescription("");
      setCustomProductPrice("");
      setCustomProductImageUrl("");
      setShowCustomProductModal(false);
      setProductSourceFilter("custom");
      haptics.success();
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Unable to create custom product", error.message);
    },
  });

  // Fetch existing bundle if editing
  const { data: existingBundle, refetch: refetchBundle } = trpc.bundles.get.useQuery(
    { id: bundleIdParam },
    { enabled: !isNewBundle && isValidBundleId && !isAdminMode }
  );
  const { data: existingAdminBundle, refetch: refetchAdminBundle } = trpc.admin.getBundle.useQuery(
    { id: bundleIdParam },
    { enabled: !isNewBundle && isValidBundleId && isAdminMode }
  );
  const effectiveBundle = isAdminMode ? existingAdminBundle : existingBundle;
  const effectiveRefetch = isAdminMode ? refetchAdminBundle : refetchBundle;

  // Cross-platform alert helper (defined early for mutations)
  const platformAlert = (title: string, message: string, buttons?: { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void }[]) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 0) {
        const confirmButton = buttons.find(b => b.text !== 'Cancel') || buttons[0];
        Alert.alert(title, message);
        confirmButton?.onPress?.();
      } else {
        Alert.alert(title, message);
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  // Create bundle mutation (trainer)
  const trainerCreateMutation = trpc.bundles.create.useMutation({
    onSuccess: () => {
      haptics.success();
      platformAlert("Success", `${entityLabel} saved as draft`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message);
    },
  });

  // Create bundle mutation (admin)
  const adminCreateMutation = trpc.admin.createBundle.useMutation({
    onSuccess: (newBundleId) => {
      haptics.success();
      if (isAdminMode) {
        promptTemplatePromotion(typeof newBundleId === "string" ? newBundleId : "");
      } else {
        platformAlert("Success", `${entityLabel} saved as draft`, [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message);
    },
  });

  const createBundleMutation = isAdminMode ? adminCreateMutation : trainerCreateMutation;

  // Update bundle mutation (trainer)
  const trainerUpdateMutation = trpc.bundles.update.useMutation({
    onSuccess: () => {
      haptics.success();
      platformAlert("Success", `${entityLabel} updated`, [
        { text: "OK", onPress: () => effectiveRefetch() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message);
    },
  });

  // Update bundle mutation (admin)
  const adminUpdateMutation = trpc.admin.updateBundle.useMutation({
    onSuccess: () => {
      haptics.success();
      platformAlert("Success", `${entityLabel} updated`, [
        { text: "OK", onPress: () => effectiveRefetch() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message);
    },
  });

  const updateBundleMutation = isAdminMode ? adminUpdateMutation : trainerUpdateMutation;

  const promptTemplatePromotion = (bundleId: string) => {
    if (Platform.OS === "web") {
      const yes = window.confirm(`${entityLabel} saved!\n\nWould you like to make this a template?`);
      if (yes && bundleId) {
        router.replace({ pathname: "/(coordinator)/template-settings", params: { bundleId } } as any);
      } else {
        router.back();
      }
    } else {
      Alert.alert(`${entityLabel} Saved`, "Would you like to make this a template?", [
        { text: "Not Now", style: "cancel", onPress: () => router.back() },
        {
          text: "Yes, Make Template",
          onPress: () => {
            if (bundleId) {
              router.replace({ pathname: "/(coordinator)/template-settings", params: { bundleId } } as any);
            } else {
              router.back();
            }
          },
        },
      ]);
    }
  };

  // Submit for review mutation
  const submitForReviewMutation = trpc.bundles.submitForReview.useMutation({
    onSuccess: () => {
      haptics.success();
      platformAlert("Success", `${entityLabel} submitted for review! You'll be notified when it's approved.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message);
    },
  });

  const respondToReviewMutation = trpc.bundles.respondToReview.useMutation({
    onSuccess: () => {
      haptics.success();
      setShowReviewResponseModal(false);
      setReviewResponse("");
      platformAlert("Response Sent", "Your response has been sent to the reviewer.", [
        { text: "OK", onPress: () => effectiveRefetch() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message || "Failed to send response.");
    },
  });

  // Delete bundle mutation
  const deleteBundleMutation = trpc.bundles.delete.useMutation({
    onSuccess: () => {
      haptics.success();
      platformAlert("Deleted", `${entityLabel} deleted successfully.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message || "Failed to delete bundle.");
    },
  });

  const activeTemplateId = selectedCampaignId || null;

  const parseTemplateArray = useCallback(<T,>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template: any) => String(template.id) === String(activeTemplateId || "")) || null,
    [activeTemplateId, templates]
  );

  // Populate form when editing
  useEffect(() => {
    if (effectiveBundle) {
      if (effectiveBundle.templateId) {
        setSelectedCampaignId((current) => current ?? effectiveBundle.templateId ?? null);
        setCampaignMode("template");
      }
      setForm({
        title: effectiveBundle.title || "",
        description: effectiveBundle.description || "",
        price: normalizeMoneyString(effectiveBundle.price, "0.00"),
        cadence: (effectiveBundle.cadence as "one_time" | "weekly" | "monthly") || "monthly",
        imageUrl: effectiveBundle.imageUrl || "",
        imageSource: (effectiveBundle.imageSource as "ai" | "custom") || "ai",
        services: (effectiveBundle.servicesJson as ServiceItem[]) || [],
        products: [],
        goals: (effectiveBundle.goalsJson as string[]) || [],
        suggestedGoal: (effectiveBundle.suggestedGoal as string) || "",
        status: (effectiveBundle.status as BundleFormState["status"]) || "draft",
        rejectionReason: effectiveBundle.rejectionReason || undefined,
        reviewComments: (effectiveBundle as any).reviewComments || undefined,
      });

      if (effectiveBundle.productsJson) {
        const parsedProducts = effectiveBundle.productsJson as Array<Record<string, any>>;
        const missingNames: string[] = [];
        const matchedProducts: BundleProductItem[] = parsedProducts
          .map((product) => {
            const mapped = mapStoredBundleProductToForm(product);
            if (!mapped) {
              missingNames.push(String(product.name || product.title || "Unknown product"));
            }
            return mapped;
          })
          .filter(Boolean) as BundleProductItem[];
        setForm((prev) => ({ ...prev, products: matchedProducts }));
        if (missingNames.length > 0) {
          const uniqueNames = Array.from(new Set(missingNames));
          const alertKey = `bundle:${bundleIdParam}:${uniqueNames.join("|")}`;
          if (missingProductAlertKeyRef.current !== alertKey) {
            missingProductAlertKeyRef.current = alertKey;
            platformAlert(
              "Products removed",
              `Some saved products were not found in the catalog and were removed: ${uniqueNames.join(", ")}.`
            );
          }
        }
      }
      setLoading(false);
    } else if (!isNewBundle) {
      // Still loading
    } else {
      setLoading(false);
    }
  }, [bundleIdParam, effectiveBundle, isNewBundle, mapStoredBundleProductToForm]);

  const updateForm = useCallback(<K extends keyof BundleFormState>(key: K, value: BundleFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const selectImageSource = useCallback((nextSource: BundleFormState["imageSource"]) => {
    currentBuilderFieldRef.current = "image-upload";
    setCurrentBuilderFieldState("image-upload");
    setForm((prev) => {
      if (prev.imageSource === nextSource) return prev;
      return {
        ...prev,
        imageSource: nextSource,
        imageUrl: "",
      };
    });
  }, []);

  // Calculate product total
  const productTotal = useMemo(() => {
    return form.products.reduce((sum, product) => sum + (parseFloat(product.price || "0") * product.quantity), 0);
  }, [form.products]);

  // Calculate services total
  const servicesTotal = useMemo(() => {
    return form.services.reduce((sum, service) => sum + (service.price * service.count), 0);
  }, [form.services]);

  // Calculate bundle price (auto-update)
  useEffect(() => {
    const total = productTotal + servicesTotal;
    updateForm("price", total.toFixed(2));
  }, [productTotal, servicesTotal, updateForm]);

  const getBundleProductKey = useCallback(
    (product: {
      id?: string | number;
      productId?: string | number;
      customProductId?: string | null;
      source?: string | null;
      shopifyProductId?: number | null;
    }) => {
      if (product.source === "custom" || product.customProductId) {
        return `custom:${String(product.customProductId || product.id || "")}`;
      }
      return `shopify:${String(product.productId || product.shopifyProductId || product.id || "")}`;
    },
    [],
  );

  const catalogProductOptions: ProductItem[] = useMemo(() => {
    return ((catalogProducts || []) as CatalogProductItem[]).map((product) => ({
      id: product.id,
      productId: product.id,
      shopifyProductId: product.shopifyProductId,
      source: "shopify" as const,
      title: product.name,
      description: product.description,
      vendor: product.brand,
      productType: product.category,
      status: product.availability === "available" ? "active" : "draft",
      price: product.price || "0.00",
      sku: "",
      inventory: Number(product.inventoryQuantity || 0),
      imageUrl: product.imageUrl,
      fulfillmentMethod: "trainer_delivery" as const,
    }));
  }, [catalogProducts]);

  const customProductOptions: ProductItem[] = useMemo(() => {
    return ((customProductsQuery.data || []) as TrainerCustomProductItem[]).map((product) => ({
      id: product.id,
      productId: undefined,
      customProductId: product.id,
      shopifyProductId: null,
      source: "custom" as const,
      title: product.name,
      description: product.description,
      vendor: "My custom product",
      productType: "custom",
      status: product.active ? "active" : "draft",
      price: product.price || "0.00",
      sku: "",
      inventory: 0,
      imageUrl: product.imageUrl,
      fulfillmentMethod: "trainer_delivery" as const,
    }));
  }, [customProductsQuery.data]);

  function mapStoredBundleProductToForm(product: {
      id?: string | number;
      productId?: string | number;
      customProductId?: string;
      name?: string;
      title?: string;
      price?: string;
      imageUrl?: string | null;
      quantity?: number;
      source?: string;
    }): BundleProductItem | null {
      const isCustom = product.source === "custom" || Boolean(product.customProductId);
      if (isCustom) {
        const match = customProductOptions.find(
          (item) =>
            String(item.customProductId || item.id) ===
            String(product.customProductId || product.id || ""),
        );
        if (!match) {
          return null;
        }
        return {
          ...match,
          quantity: Number(product.quantity) || 1,
        };
      }

      const lookupValue = String(product.productId || product.id || "");
      const match = catalogProductOptions.find(
        (item) =>
          String(item.productId || "") === lookupValue ||
          String(item.id) === lookupValue ||
          String(item.shopifyProductId || "") === lookupValue ||
          String(item.shopifyProductId || "") === String(product.id || ""),
      );
      if (!match) {
        return null;
      }
      return {
        ...match,
        quantity: Number(product.quantity) || 1,
      };
    }

  const hydratedTemplateProducts = useMemo(() => {
    const missingNames: string[] = [];
    const products = parseTemplateArray<Record<string, any>>(selectedTemplate?.defaultProducts);
    const items = products
      .map((product) => {
        const mapped = mapStoredBundleProductToForm(product);
        if (!mapped) {
          missingNames.push(String(product.name || product.title || "Unknown product"));
        }
        return mapped;
      })
      .filter(Boolean) as BundleProductItem[];
    return {
      items,
      missingNames: Array.from(new Set(missingNames)),
    };
  }, [mapStoredBundleProductToForm, parseTemplateArray, selectedTemplate?.defaultProducts]);

  // Populate form from the selected campaign/template when creating a new bundle
  useEffect(() => {
    if (!isNewBundle || !selectedTemplate || !activeTemplateId) return;

    const templateServices = parseTemplateArray<ServiceItem>(selectedTemplate.defaultServices);
    const templateGoals = parseTemplateArray<string>(selectedTemplate.goalsJson);

    setForm((prev) => ({
      ...prev,
      title: selectedTemplate.title || prev.title,
      description: selectedTemplate.description || prev.description,
      price: normalizeMoneyString(selectedTemplate.basePrice, prev.price),
      cadence:
        (((selectedTemplate as any).cadence as "one_time" | "weekly" | "monthly" | undefined) ??
          prev.cadence),
      imageUrl: selectedTemplate.imageUrl || prev.imageUrl,
      services: templateServices,
      products: hydratedTemplateProducts.items,
      goals: templateGoals,
      suggestedGoal: ((selectedTemplate as any).suggestedGoal as string | undefined) || prev.suggestedGoal,
    }));
    if (hydratedTemplateProducts.missingNames.length > 0) {
      const alertKey = `template:${activeTemplateId}:${hydratedTemplateProducts.missingNames.join("|")}`;
      if (missingProductAlertKeyRef.current !== alertKey) {
        missingProductAlertKeyRef.current = alertKey;
        platformAlert(
          "Products removed",
          `Some template products were not found in the catalog and were removed: ${hydratedTemplateProducts.missingNames.join(", ")}.`
        );
      }
    }
    setLoading(false);
  }, [
    activeTemplateId,
    hydratedTemplateProducts,
    isNewBundle,
    parseTemplateArray,
    selectedTemplate,
  ]);

  const mapShopifyProductToBundleItem = useCallback(
    (product: ProductItem): ProductItem => {
      const catalogMatch = catalogProductOptions.find(
        (item) =>
          item.shopifyProductId != null &&
          String(item.shopifyProductId) === String(product.id),
      );
      return (
        catalogMatch || {
          ...product,
          source: "shopify",
          productId:
            typeof product.productId === "string" ? product.productId : undefined,
          shopifyProductId: Number(product.id) || null,
          fulfillmentMethod: "trainer_delivery",
        }
      );
    },
    [catalogProductOptions],
  );

  // Filter products for modal (bundles are shown but disabled)
  const filteredProducts = useMemo(() => {
    return catalogProductOptions.filter((product: ProductItem) => {
      const matchesSearch = !productSearch ||
        product.title.toLowerCase().includes(productSearch.toLowerCase()) ||
        (product.vendor && product.vendor.toLowerCase().includes(productSearch.toLowerCase())) ||
        (product.sku && product.sku.toLowerCase().includes(productSearch.toLowerCase()));
      const matchesType = productTypeFilter === "all" || product.productType === productTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [catalogProductOptions, productSearch, productTypeFilter]);

  const filteredCustomProducts = useMemo(() => {
    return customProductOptions.filter((product) => {
      const search = productSearch.trim().toLowerCase();
      if (!search) return true;
      return (
        product.title.toLowerCase().includes(search) ||
        (product.description || "").toLowerCase().includes(search)
      );
    });
  }, [customProductOptions, productSearch]);

  // Extract unique product types and vendors
  const uniqueProductTypes = useMemo(() => {
    const types = new Set(
      catalogProductOptions
        .map((p: ProductItem) => p.productType)
        .filter((type): type is string => Boolean(type))
    );
    return Array.from(types).sort();
  }, [catalogProductOptions]);

  // Add service
  const addService = (type: string) => {
    const newService: ServiceItem = {
      id: Date.now().toString(),
      type,
      name: type,
      count: 1,
      duration: 60,
      price: 0,
      unit: "per session",
    };
    updateForm("services", [...form.services, newService]);
    haptics.light();
    setShowServiceModal(false);
  };

  // Update service
  const updateService = (id: string, updates: Partial<ServiceItem>) => {
    updateForm(
      "services",
      form.services.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  // Remove service
  const removeService = (id: string) => {
    updateForm(
      "services",
      form.services.filter((s) => s.id !== id)
    );
    haptics.medium();
  };

  // Toggle product selection
  const toggleProduct = (product: ProductItem) => {
    const productKey = getBundleProductKey(product);
    const isSelected = form.products.some((p) => getBundleProductKey(p) === productKey);
    if (isSelected) {
      updateForm(
        "products",
        form.products.filter((p) => getBundleProductKey(p) !== productKey)
      );
    } else {
      // Add product with default quantity of 1
      const productWithQuantity: BundleProductItem = {
        ...product,
        quantity: 1,
      };
      updateForm("products", [...form.products, productWithQuantity]);
    }
    haptics.light();
  };

  // Update product quantity
  const updateProductQuantity = (productKey: string, quantity: number) => {
    if (quantity < 1) return;
    updateForm(
      "products",
      form.products.map((p) =>
        getBundleProductKey(p) === productKey ? { ...p, quantity } : p
      )
    );
  };

  // Add product with specific quantity (for detail modal)
  const addProductWithQuantity = (product: ProductItem, quantity: number) => {
    const productKey = getBundleProductKey(product);
    const isSelected = form.products.some((p) => getBundleProductKey(p) === productKey);
    if (isSelected) {
      // Update quantity if already selected
      updateProductQuantity(productKey, quantity);
    } else {
      // Add new product with specified quantity
      const productWithQuantity: BundleProductItem = {
        ...product,
        quantity: Math.max(1, quantity),
      };
      updateForm("products", [...form.products, productWithQuantity]);
    }
    haptics.light();
  };

  const addCustomProductWithQuantity = (
    product: TrainerCustomProductItem | ProductItem,
    quantity: number,
  ) => {
    const normalized: ProductItem =
      "title" in product
        ? product
        : {
            id: product.id,
            customProductId: product.id,
            source: "custom",
            title: product.name,
            description: product.description,
            vendor: "My custom product",
            productType: "custom",
            status: product.active ? "active" : "draft",
            price: product.price,
            sku: "",
            inventory: 0,
            imageUrl: product.imageUrl,
            fulfillmentMethod: "trainer_delivery",
          };
    addProductWithQuantity(normalized, quantity);
  };

  // Get recommended products based on current product
  const getRecommendedProducts = (product: ProductItem) => {
    return catalogProductOptions
      .filter((p: ProductItem) => {
        // Exclude current product and bundles
        if (getBundleProductKey(p) === getBundleProductKey(product)) return false;
        if (p.productType && p.productType.toLowerCase() === 'bundle') return false;
        // Match by type or vendor
        return p.productType === product.productType || p.vendor === product.vendor;
      })
      .slice(0, 4); // Limit to 4 recommendations
  };

  // Handle barcode scan
  const handleBarcodeScan = (result: BarcodeScanningResult) => {
    if (barcodeScanned) return; // Prevent double-fires
    
    setBarcodeScanned(true);
    const scannedCode = result.data;
    
    // Search for product by SKU
    if (shopifyProducts) {
      const matchedProduct = shopifyProducts.find(
        (p: ProductItem) => p.sku && p.sku.toLowerCase() === scannedCode.toLowerCase()
      );
      
      if (matchedProduct) {
        const normalizedProduct = mapShopifyProductToBundleItem(matchedProduct);
        // Check if already added
        const existingProduct = form.products.find(
          (p) => getBundleProductKey(p) === getBundleProductKey(normalizedProduct),
        );
        if (existingProduct) {
          // Increment quantity
          updateProductQuantity(
            getBundleProductKey(existingProduct),
            existingProduct.quantity + 1,
          );
          haptics.success();
          platformAlert(
            "Product Found",
            `Added another ${normalizedProduct.title} (now ${existingProduct.quantity + 1} total)`,
            [{ text: "OK", onPress: () => {
              setBarcodeScanned(false);
              setShowBarcodeScanner(false);
            }}]
          );
        } else {
          // Add new product
          const productWithQuantity: BundleProductItem = {
            ...normalizedProduct,
            quantity: 1,
          };
          updateForm("products", [...form.products, productWithQuantity]);
          haptics.success();
          platformAlert(
            "Product Added",
            `${normalizedProduct.title} added to bundle`,
            [{ text: "OK", onPress: () => {
              setBarcodeScanned(false);
              setShowBarcodeScanner(false);
            }}]
          );
        }
      } else {
        haptics.error();
        platformAlert(
          "Product Not Found",
          `No product found with SKU: ${scannedCode}`,
          [{ text: "Scan Again", onPress: () => setBarcodeScanned(false) },
           { text: "Cancel", onPress: () => {
             setBarcodeScanned(false);
             setShowBarcodeScanner(false);
           }}]
        );
      }
    }
  };

  // Open barcode scanner
  const openBarcodeScanner = async () => {
    if (Platform.OS === "web") {
      platformAlert("Not Available", "Barcode scanning is not available on web. Please use the search function.");
      return;
    }
    
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        platformAlert("Permission Required", "Camera permission is required to scan barcodes.");
        return;
      }
    }
    
    setBarcodeScanned(false);
    setShowBarcodeScanner(true);
  };

  // Toggle goal
  const toggleGoal = (goal: string) => {
    currentBuilderFieldRef.current = "goals";
    setCurrentBuilderFieldState("goals");
    if (form.goals.includes(goal)) {
      updateForm(
        "goals",
        form.goals.filter((g) => g !== goal)
      );
    } else {
      updateForm("goals", [...form.goals, goal]);
    }
    haptics.light();
  };

  // Add custom goal
  const addCustomGoal = () => {
    currentBuilderFieldRef.current = "goals";
    setCurrentBuilderFieldState("goals");
    if (customGoal.trim() && !form.goals.includes(customGoal.trim())) {
      updateForm("goals", [...form.goals, customGoal.trim()]);
      setCustomGoal("");
      haptics.light();
    }
  };

  const handleSelectCampaign = async (campaignId: string) => {
    currentBuilderFieldRef.current = "campaign";
    setCurrentBuilderFieldState("campaign");
    await haptics.light();
    setCampaignMode("template");
    setSelectedCampaignId(campaignId);
  };

  const handleStartFromScratch = async () => {
    currentBuilderFieldRef.current = "campaign";
    setCurrentBuilderFieldState("campaign");
    await haptics.light();
    setCampaignMode("scratch");
    setSelectedCampaignId(null);
  };

  const handleOpenCampaignPreview = useCallback(
    async (template: any) => {
      currentBuilderFieldRef.current = "campaign";
      setCurrentBuilderFieldState("campaign");
      setCampaignPreviewTemplate(template);
      await haptics.light();
    },
    []
  );

  const handleCreateCustomProduct = async () => {
    const trimmedName = customProductName.trim();
    const parsedPrice = Number.parseFloat(customProductPrice.trim());
    if (!trimmedName) {
      platformAlert("Custom product name required", "Enter a product name.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      platformAlert("Custom product price required", "Enter a valid product price greater than 0.");
      return;
    }
    await createCustomProductMutation.mutateAsync({
      name: trimmedName,
      description: customProductDescription.trim() || undefined,
      imageUrl: customProductImageUrl.trim() || undefined,
      price: parsedPrice.toFixed(2),
    });
  };

  const reviewValidation = useMemo(() => {
    const tabErrors = new Set<BuilderTab>();
    const firstInvalidFieldByTab: Partial<Record<BuilderTab, string>> = {};
    let firstInvalidTab: BuilderTab | null = null;
    let firstInvalidField: string | null = null;

    const setFirstInvalid = (tab: BuilderTab, field: string) => {
      if (!firstInvalidFieldByTab[tab]) {
        firstInvalidFieldByTab[tab] = field;
      }
      if (!firstInvalidTab) {
        firstInvalidTab = tab;
        firstInvalidField = field;
      }
      tabErrors.add(tab);
    };

    if (form.imageSource === "custom" && !form.imageUrl.trim()) {
      setFirstInvalid("details", "image-upload");
    }

    if (!form.title.trim()) {
      setFirstInvalid("details", "title");
    }

    if (form.services.length === 0 && form.products.length === 0) {
      setFirstInvalid("services", "services-entry");
      tabErrors.add("products");
    }

    return {
      tabErrors,
      firstInvalidFieldByTab,
      firstInvalidTab,
      firstInvalidField,
      tabComplete: {
        campaign: campaignMode === "scratch" || Boolean(selectedCampaignId),
        details: form.title.trim().length > 0 && (form.imageSource === "ai" || form.imageUrl.trim().length > 0),
        services: form.services.length > 0,
        products: form.products.length > 0,
      } satisfies Record<BuilderTab, boolean>,
    };
  }, [campaignMode, form.imageSource, form.imageUrl, form.products.length, form.services.length, form.title, selectedCampaignId]);

  const recordFieldOffset = (key: string) => (event: any) => {
    fieldOffsetsRef.current[key] = event.nativeEvent.layout.y;
  };

  const tabFieldOrder: Record<BuilderTab, string[]> = useMemo(
    () => ({
      campaign: ["campaign"],
      details: ["image-upload", "title", "description", "cadence", "goals"],
      services: ["services-entry"],
      products: ["products-entry"],
    }),
    []
  );

  const revealTabError = useCallback((tab: BuilderTab) => {
    setTabErrorVisibility((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const setCurrentBuilderField = useCallback((field: string | null) => {
    currentBuilderFieldRef.current = field;
    setCurrentBuilderFieldState(field);
  }, []);

  const isCurrentBuilderField = useCallback(
    (field: string) => currentBuilderField === field,
    [currentBuilderField]
  );

  const activeFieldLabelStyle = useCallback(
    (field: string, baseColor: string) =>
      isCurrentBuilderField(field)
        ? { color: colors.primary, textDecorationLine: "underline" as const }
        : { color: baseColor },
    [colors.primary, isCurrentBuilderField]
  );

  const activeFieldBorderStyle = useCallback(
    (field: string) =>
      isCurrentBuilderField(field)
        ? { borderColor: colors.primary, borderWidth: 2 }
        : undefined,
    [colors.primary, isCurrentBuilderField]
  );

  const getNextFieldForTab = useCallback(
    (tab: BuilderTab) => {
      const fields = tabFieldOrder[tab];
      const currentField = currentBuilderFieldRef.current;
      if (currentField) {
        const currentIndex = fields.indexOf(currentField);
        if (currentIndex >= 0) {
          return fields[currentIndex + 1] ?? null;
        }
      }
      return fields[0] ?? null;
    },
    [tabFieldOrder]
  );

  const jumpToValidationTarget = useCallback((tab: BuilderTab | null, field: string | null) => {
    if (!tab) return;
    if (field) {
      setCurrentBuilderField(field);
    }
    setActiveTab(tab);
    setPendingFocusTarget(field);
  }, [setCurrentBuilderField]);

  const handleTabPress = useCallback(
    async (nextTab: BuilderTab) => {
      if (nextTab === activeTab) return;
      if (nextTab !== activeTab && reviewValidation.firstInvalidFieldByTab[activeTab]) {
        revealTabError(activeTab);
      }
      jumpToValidationTarget(nextTab, tabFieldOrder[nextTab][0] ?? null);
      await haptics.light();
    },
    [activeTab, jumpToValidationTarget, revealTabError, reviewValidation.firstInvalidFieldByTab, tabFieldOrder]
  );

  useEffect(() => {
    const fields = tabFieldOrder[activeTab];
    if (!fields.includes(currentBuilderFieldRef.current || "")) {
      setCurrentBuilderField(fields[0] ?? null);
    }
  }, [activeTab, setCurrentBuilderField, tabFieldOrder]);

  useEffect(() => {
    if (!pendingFocusTarget) return;
    const target = pendingFocusTarget;
    const run = () => {
      const y = fieldOffsetsRef.current[target] ?? 0;
      scrollViewRef.current?.scrollTo({ y, animated: true });
      if (target === "title") {
        titleInputRef.current?.focus();
      } else if (target === "description") {
        descriptionInputRef.current?.focus();
      }
      setPendingFocusTarget(null);
    };
    const timer = setTimeout(run, 120);
    return () => clearTimeout(timer);
  }, [activeTab, pendingFocusTarget]);

  // Validate form
  // Cross-platform alert helper
  const showAlert = (title: string, message: string, buttons?: { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void }[]) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 1) {
        // For confirmation dialogs
        const confirmButton = buttons.find(b => b.text !== 'Cancel');
        if (window.confirm(`${title}\n\n${message}`)) {
          confirmButton?.onPress?.();
        }
      } else {
        Alert.alert(title, message);
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const validateForm = (): boolean => {
    if (!form.title.trim()) {
      showAlert("Validation Error", `Please enter a ${entityLabelLower} title`);
      return false;
    }
    if (!form.price || parseFloat(form.price) <= 0) {
      showAlert("Validation Error", "Please add products or services to set a price");
      return false;
    }
    return true;
  };

  // Save as draft
  const handleSave = async () => {
    if (!form.title.trim()) {
      showAlert("Validation Error", `Please enter a ${entityLabelLower} title`);
      return;
    }

    setSaving(true);
    try {
      const imageUrl = form.imageUrl.trim() || undefined;
      const bundleData = {
        title: form.title,
        description: form.description,
        price: normalizeMoneyString(form.price),
        cadence: form.cadence,
        imageUrl,
        imageSource: form.imageSource,
        productsJson: form.products.map((p) => ({
          id: p.id,
          source: p.source || "shopify",
          productId: p.productId || undefined,
          customProductId: p.customProductId || undefined,
          shopifyProductId: p.shopifyProductId || undefined,
          name: p.title,
          price: p.price,
          imageUrl: p.imageUrl,
          fulfillmentMethod: p.fulfillmentMethod || "trainer_delivery",
          quantity: p.quantity || 1,
        })),
        servicesJson: form.services,
        goalsJson: form.goals,
        suggestedGoal: form.suggestedGoal || undefined,
      };

      if (isNewBundle) {
        await createBundleMutation.mutateAsync({ ...bundleData, ...(activeTemplateId ? { templateId: activeTemplateId } : {}) });
      } else {
        await updateBundleMutation.mutateAsync({
          id: bundleIdParam,
          ...bundleData,
        });
      }
    } catch (error) {
      // Prevent unhandled promise rejections from mutateAsync.
      console.error("[bundle-editor] handleSave failed:", error);
    } finally {
      setSaving(false);
    }
  };

  // Submit for review (trainers) / Save & optionally promote (admins)
  const handleSubmitForReview = async () => {
    setSubmitAttempted(true);
    if (reviewValidation.firstInvalidTab) {
      haptics.error();
      jumpToValidationTarget(
        reviewValidation.firstInvalidTab,
        reviewValidation.firstInvalidField,
      );
      showAlert("Missing information", "Please fix the highlighted tab before submitting for review.");
      return;
    }

    const doSubmit = async () => {
      setSaving(true);
      try {
        let imageUrl = form.imageUrl.trim() || undefined;
        if (form.imageSource === "ai") {
          try {
            imageUrl = await ensureAiCoverImage();
          } catch (error) {
            console.error("Failed to prepare AI cover image:", error);
            platformAlert("Unable to generate image", "Please make sure the title is filled in and try again.");
            haptics.error();
            return;
          }
        }

        const bundleData = {
          title: form.title,
          description: form.description,
          price: normalizeMoneyString(form.price),
          cadence: form.cadence,
          imageUrl,
          imageSource: form.imageSource,
          productsJson: form.products.map((p) => ({
            id: p.id,
            source: p.source || "shopify",
            productId: p.productId || undefined,
            customProductId: p.customProductId || undefined,
            shopifyProductId: p.shopifyProductId || undefined,
            name: p.title,
            price: p.price,
            imageUrl: p.imageUrl,
            fulfillmentMethod: p.fulfillmentMethod || "trainer_delivery",
            quantity: p.quantity || 1,
          })),
          servicesJson: form.services,
          goalsJson: form.goals,
          suggestedGoal: form.suggestedGoal || undefined,
        };

        let bundleId = bundleIdParam;
        if (isNewBundle) {
          const result = await createBundleMutation.mutateAsync({
            ...bundleData,
            ...(activeTemplateId ? { templateId: activeTemplateId } : {}),
          });
          if (typeof result === "string") {
            bundleId = result;
          } else if (result && typeof result === "object" && "id" in result) {
            bundleId = (result as { id: string }).id;
          }
        } else {
          await updateBundleMutation.mutateAsync({
            id: bundleId,
            ...bundleData,
          });
        }

        if (isAdminMode) {
          promptTemplatePromotion(bundleId);
        } else {
          await submitForReviewMutation.mutateAsync({ id: bundleId });
        }
      } catch (error) {
        console.error("[bundle-editor] submitForReview failed:", error);
      } finally {
        setSaving(false);
      }
    };

    if (isAdminMode) {
      showAlert(
        `Save ${entityLabel}`,
        `Save this ${entityLabelLower} and optionally promote it to a template?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save", onPress: doSubmit },
        ],
      );
    } else {
      showAlert(
        "Submit for Review",
        `Your ${entityLabelLower} will be reviewed by the admin team. You'll be notified once it's approved.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Submit", onPress: doSubmit },
        ],
      );
    }
  };

  const ensureAiCoverImage = useCallback(async () => {
    if (form.imageSource !== "ai") {
      return form.imageUrl.trim() || undefined;
    }

    const existingImageUrl = form.imageUrl.trim();
    if (existingImageUrl) {
      return existingImageUrl;
    }

    if (!form.title.trim()) {
      throw new Error(`Please enter a ${entityLabelLower} title before generating an image.`);
    }

    setGeneratingImage(true);
    try {
      const result = await generateImageMutation.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        goals: form.goals.length > 0 ? form.goals : undefined,
        style: "fitness",
      });

      const generatedUrl = result.url?.trim();
      if (!generatedUrl) {
        throw new Error("No image was returned.");
      }

      updateForm("imageUrl", generatedUrl);
      return generatedUrl;
    } finally {
      setGeneratingImage(false);
    }
  }, [
    entityLabelLower,
    form.description,
    form.goals,
    form.imageSource,
    form.imageUrl,
    form.title,
    generateImageMutation,
    updateForm,
  ]);

  // Delete bundle
  const handleDelete = () => {
    const doDelete = async () => {
      if (!isValidBundleId) return;
      await deleteBundleMutation.mutateAsync({ id: bundleIdParam });
    };

    platformAlert(
      `Delete ${entityLabel}`,
      `Are you sure you want to delete this ${entityLabelLower}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: doDelete,
        },
      ]
    );
  };

  const handleSendReviewResponse = async (resubmit: boolean) => {
    if (!bundleIdParam) return;
    const trimmed = reviewResponse.trim();
    if (!trimmed) {
      platformAlert("Response required", "Please enter your response before sending.");
      return;
    }
    try {
      await respondToReviewMutation.mutateAsync({
        id: bundleIdParam,
        response: trimmed,
        resubmit,
      });
    } catch (error) {
      console.error("[bundle-editor] respondToReview failed:", error);
    }
  };

  const isFinalBuilderTab = activeTab === builderTabs[builderTabs.length - 1];
  const cadenceLabel = CADENCE_OPTIONS.find((option) => option.value === form.cadence)?.label ?? form.cadence;

  const handlePrimaryBuilderAction = async () => {
    if (!isFinalBuilderTab) {
      const nextField = getNextFieldForTab(activeTab);
      if (nextField) {
        jumpToValidationTarget(activeTab, nextField);
        await haptics.light();
        return;
      }

      if (reviewValidation.firstInvalidFieldByTab[activeTab]) {
        revealTabError(activeTab);
      }

      const currentIndex = builderTabs.indexOf(activeTab);
      const nextTab = builderTabs[Math.min(currentIndex + 1, builderTabs.length - 1)];
      jumpToValidationTarget(nextTab, tabFieldOrder[nextTab][0] ?? null);
      await haptics.light();
      return;
    }
    await handleSubmitForReview();
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <LogoLoader size={84} />
        <Text className="text-muted mt-4">Loading bundle...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header with confirmation for unsaved changes */}
        <NavigationHeader
          title={isNewBundle ? `Create ${entityLabel}` : `Edit ${entityLabel}`}
          showBack
          showHome
          confirmBack={{
            title: "Discard Changes?",
            message: "You have unsaved changes. Are you sure you want to leave?",
            confirmText: "Discard",
            cancelText: "Keep Editing",
          }}
          rightAction={!isNewBundle ? {
            icon: "trash.fill",
            onPress: handleDelete,
            label: "Delete bundle",
            testID: "bundle-delete",
          } : undefined}
        />

        {/* Status Badges */}
        {form.status === "pending_review" && (
          <View className="mx-4 mt-3 bg-warning/10 border border-warning/30 rounded-xl p-3 flex-row items-center">
            <IconSymbol name="clock.fill" size={18} color={colors.warning} />
            <Text className="text-warning ml-2 flex-1">Pending Review - Your bundle is being reviewed by the admin team.</Text>
          </View>
        )}

        {form.status === "changes_requested" && form.reviewComments && (
          <View className="mx-4 mt-3 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
            <View className="flex-row items-center">
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
              <Text className="font-medium ml-2" style={{ color: colors.warning }}>Changes Requested</Text>
            </View>
            <Text className="text-foreground mt-2 text-sm">{form.reviewComments}</Text>
            <Text className="text-muted mt-2 text-xs">Please address the feedback above and resubmit for review.</Text>
            <View className="flex-row gap-2 mt-3">
              <TouchableOpacity
                className="bg-surface border border-border rounded-lg px-3 py-2"
                onPress={() => setShowReviewResponseModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Respond to reviewer"
                testID="bundle-review-respond"
              >
                <Text className="text-foreground text-sm font-medium">Respond to reviewer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {form.status === "rejected" && form.rejectionReason && (
          <View className="mx-4 mt-3 bg-error/10 border border-error/30 rounded-xl p-3">
            <View className="flex-row items-center">
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
              <Text className="text-error font-medium ml-2">Bundle Rejected</Text>
            </View>
            <Text className="text-error/80 mt-1 text-sm">{form.rejectionReason}</Text>
            <Text className="text-error/60 mt-1 text-xs">Please address the feedback and resubmit for review.</Text>
          </View>
        )}

        {/* Tab Navigation */}
        <View className="flex-row bg-surface border-b border-border">
          {(
            [
              { key: "campaign", label: "Campaign" },
              { key: "details", label: "Details" },
              { key: "services", label: "Services" },
              { key: "products", label: "Products" },
            ] as const
          ).map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              className={`flex-1 py-3 ${activeTab === key ? "border-b-2 border-primary" : ""}`}
              onPress={() => {
                void handleTabPress(key);
              }}
            >
              <View className="flex-row items-center justify-center">
                <Text
                  className={`text-center text-sm font-medium ${
                    activeTab === key ? "text-primary" : "text-muted"
                  }`}
                >
                  {label}
                </Text>
                {(submitAttempted || tabErrorVisibility.has(key)) && reviewValidation.tabErrors.has(key) ? (
                  <IconSymbol name="exclamationmark.triangle.fill" size={14} color={colors.error} />
                ) : reviewValidation.tabComplete[key] ? (
                  <IconSymbol name="checkmark.circle.fill" size={14} color={colors.success} />
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          onScroll={(event) => {
            scrollPositionRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          {/* Campaign Tab */}
          {activeTab === "campaign" && (
            <View className="p-4" onLayout={recordFieldOffset("campaign")}>
              {campaignPreviewTemplate ? (() => {
                const preview = campaignPreviewTemplate;
                const basePrice = toMoneyNumber(preview.basePrice);
                const discountValue = toMoneyNumber(preview.discountValue);
                const trainerBonus = toMoneyNumber((preview as any).totalTrainerBonus) ?? 0;
                const hasPercentageDiscount = preview.discountType === "percentage" && discountValue != null;
                const hasFixedDiscount = preview.discountType === "fixed" && discountValue != null;
                const promoPrice =
                  basePrice == null
                    ? null
                    : hasPercentageDiscount
                      ? Math.max(0, basePrice - basePrice * (discountValue! / 100))
                      : hasFixedDiscount
                        ? Math.max(0, basePrice - discountValue!)
                        : basePrice;
                const serviceCount = countItems(preview.defaultServices);
                const productCount = countItems(preview.defaultProducts);
                const isSelected = selectedCampaignId === preview.id;
                return (
                  <>
                    <TouchableOpacity
                      className="flex-row items-center self-start mb-4"
                      onPress={() => setCampaignPreviewTemplate(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Back to campaign gallery"
                      testID="bundle-campaign-preview-back"
                    >
                      <IconSymbol name="chevron.left" size={16} color={colors.primary} />
                      <Text className="text-sm font-medium text-primary ml-1">Back to campaigns</Text>
                    </TouchableOpacity>

                    {preview.imageUrl ? (
                      <Image
                        source={{ uri: preview.imageUrl }}
                        style={{ width: "100%", height: 220, borderRadius: 20 }}
                        contentFit="cover"
                      />
                    ) : null}

                    <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
                      <View className="flex-row items-start justify-between">
                        <Text className="text-2xl font-bold text-foreground flex-1 pr-3">
                          {preview.title}
                        </Text>
                        {isSelected ? (
                          <View className="px-3 py-1 rounded-full bg-primary/15 border border-primary/30">
                            <Text className="text-xs font-semibold text-primary">Selected</Text>
                          </View>
                        ) : null}
                      </View>

                      {preview.description ? (
                        <Text className="text-sm text-muted mt-3">{preview.description}</Text>
                      ) : null}

                      <View className="flex-row flex-wrap gap-x-4 gap-y-2 mt-4">
                        <View className="flex-row items-center">
                          <IconSymbol name="calendar" size={14} color={colors.muted} />
                          <Text className="text-xs text-muted ml-1">
                            {serviceCount} {serviceCount === 1 ? "service" : "services"}
                          </Text>
                        </View>
                        <View className="flex-row items-center">
                          <IconSymbol name="bag.fill" size={14} color={colors.muted} />
                          <Text className="text-xs text-muted ml-1">
                            {productCount} {productCount === 1 ? "product" : "products"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
                      <Text className="text-sm font-semibold text-foreground mb-3">Offer Economics</Text>

                      <View className="flex-row items-center justify-between">
                        <Text className="text-muted">Base price</Text>
                        <Text className="text-foreground font-semibold">
                          {basePrice != null ? `£${basePrice.toFixed(2)}` : "Not set"}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between mt-3">
                        <Text className="text-muted">Promotional discount</Text>
                        <Text className="text-foreground font-semibold">
                          {preview.discountType && discountValue != null
                            ? preview.discountType === "percentage"
                              ? `${discountValue}% off`
                              : `£${discountValue.toFixed(2)} off`
                            : "None"}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between mt-3">
                        <Text className="text-muted">Promotional price</Text>
                        <Text className="text-primary font-semibold">
                          {promoPrice != null ? `£${promoPrice.toFixed(2)}` : "Not set"}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between mt-3">
                        <Text className="text-muted">Trainer cash bonus</Text>
                        <Text className="text-success font-semibold">
                          {trainerBonus > 0 ? `+£${trainerBonus.toFixed(2)}` : "None"}
                        </Text>
                      </View>

                      <View className="flex-row items-center justify-between mt-3">
                        <Text className="text-muted">Trainer points bonus</Text>
                        <Text className="text-foreground font-semibold">Not configured</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      className="bg-primary rounded-xl py-4 items-center justify-center mt-4"
                      onPress={async () => {
                        await handleSelectCampaign(String(preview.id));
                        setCampaignPreviewTemplate(null);
                        jumpToValidationTarget("details", tabFieldOrder.details[0] ?? null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Join campaign ${preview.title}`}
                      testID={`bundle-campaign-join-${preview.id}`}
                    >
                      <Text className="text-background font-semibold text-base">
                        {CAMPAIGN_COPY.useCta}
                      </Text>
                    </TouchableOpacity>
                  </>
                );
              })() : (
                <>
                  <Text
                    className="text-sm mb-4"
                    style={activeFieldLabelStyle("campaign", colors.muted)}
                  >
                    {CAMPAIGN_COPY.gallerySubtitle}
                  </Text>

                  <TouchableOpacity
                    className={`bg-surface border rounded-xl p-4 mb-4 ${
                      !selectedCampaignId ? "border-primary" : "border-border"
                    }`}
                    onPress={handleStartFromScratch}
                    accessibilityRole="button"
                    accessibilityLabel="Start from scratch without a campaign"
                    testID="bundle-campaign-scratch"
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-foreground font-semibold">Start from scratch</Text>
                        <Text className="text-sm text-muted mt-1">
                          Build an offer manually without preloading a campaign template.
                        </Text>
                      </View>
                      {!selectedCampaignId ? (
                        <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                      ) : (
                        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                      )}
                    </View>
                  </TouchableOpacity>

                  {templatesLoading ? (
                    <View className="items-center py-16">
                      <LogoLoader size={72} />
                    </View>
                  ) : (
                    <>
                      {templates.map((template: any) => {
                        const serviceCount = countItems(template.defaultServices);
                        const productCount = countItems(template.defaultProducts);
                        const selected = selectedCampaignId === template.id;
                        return (
                          <TouchableOpacity
                            key={template.id}
                            className={`bg-surface border rounded-xl overflow-hidden mb-3 ${
                              selected ? "border-primary" : "border-border"
                            }`}
                            onPress={() => {
                              void handleOpenCampaignPreview(template);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Open campaign ${template.title}`}
                            testID={`bundle-campaign-${template.id}`}
                          >
                            {template.imageUrl ? (
                              <Image
                                source={{ uri: template.imageUrl }}
                                style={{ width: "100%", height: 140 }}
                                contentFit="cover"
                              />
                            ) : null}
                            <View className="p-4">
                              <View className="flex-row items-start justify-between">
                                <Text className="text-foreground font-semibold text-base flex-1 pr-3">
                                  {template.title}
                                </Text>
                                {selected ? (
                                  <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                                ) : null}
                              </View>
                              {template.description ? (
                                <Text className="text-sm text-muted mt-1" numberOfLines={2}>
                                  {template.description}
                                </Text>
                              ) : null}
                              <View className="flex-row items-center flex-wrap gap-x-4 gap-y-1 mt-3">
                                {template.basePrice ? (
                                  <View className="flex-row items-center">
                                    <IconSymbol name="dollarsign.circle.fill" size={13} color={colors.success} />
                                    <Text className="text-xs text-muted ml-1">
                                      From {template.basePrice} GBP
                                    </Text>
                                  </View>
                                ) : null}
                                {serviceCount > 0 ? (
                                  <View className="flex-row items-center">
                                    <IconSymbol name="calendar" size={13} color={colors.muted} />
                                    <Text className="text-xs text-muted ml-1">
                                      {serviceCount} {serviceCount === 1 ? "service" : "services"}
                                    </Text>
                                  </View>
                                ) : null}
                                {productCount > 0 ? (
                                  <View className="flex-row items-center">
                                    <IconSymbol name="bag.fill" size={13} color={colors.muted} />
                                    <Text className="text-xs text-muted ml-1">
                                      {productCount} {productCount === 1 ? "product" : "products"}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}

                      {!templatesLoading && templates.length === 0 ? (
                        <View className="items-center py-10">
                          <IconSymbol name="rectangle.grid.2x2.fill" size={32} color={colors.muted} />
                          <Text className="text-foreground font-semibold mt-3">
                            {CAMPAIGN_COPY.noneAvailableTitle}
                          </Text>
                          <Text className="text-sm text-muted mt-1 text-center">
                            {CAMPAIGN_COPY.noneAvailableSubtitle}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {/* Details Tab */}
          {activeTab === "details" && (
            <View className="p-4 gap-4">
              {/* Bundle Image */}
              <View onLayout={recordFieldOffset("image-upload")}>
                <Text
                  className="text-sm font-medium mb-2"
                  style={activeFieldLabelStyle("image-upload", colors.foreground)}
                >
                  {entityLabel} Cover Image
                </Text>
                <View className="flex-row gap-2 mb-3">
                  <TouchableOpacity
                    className={`flex-1 rounded-xl border px-4 py-3 ${
                      form.imageSource === "ai" ? "border-primary bg-primary/10" : "border-border bg-surface"
                    }`}
                    onPress={() => selectImageSource("ai")}
                    accessibilityRole="button"
                    accessibilityLabel={`Use AI to create the ${entityLabelLower} cover image`}
                    testID="bundle-image-source-ai"
                  >
                    <Text
                      className={`text-center font-medium ${
                        form.imageSource === "ai" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      Generate with AI
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 rounded-xl border px-4 py-3 ${
                      form.imageSource === "custom" ? "border-primary bg-primary/10" : "border-border bg-surface"
                    }`}
                    onPress={() => selectImageSource("custom")}
                    accessibilityRole="button"
                    accessibilityLabel={`Upload a custom ${entityLabelLower} cover image`}
                    testID="bundle-image-source-upload"
                  >
                    <Text
                      className={`text-center font-medium ${
                        form.imageSource === "custom" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      Upload an Image
                    </Text>
                  </TouchableOpacity>
                </View>

                {form.imageSource === "ai" ? (
                  form.imageUrl ? (
                    <View className="rounded-xl overflow-hidden border border-border bg-surface">
                      <Image
                        source={{ uri: form.imageUrl }}
                        style={{ width: "100%", aspectRatio: 16 / 9 }}
                        contentFit="cover"
                      />
                    </View>
                  ) : (
                    <View className="rounded-xl border border-border bg-surface px-4 py-3">
                      <View className="flex-row items-center">
                        {generatingImage ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <IconSymbol name="sparkles" size={18} color={colors.primary} />
                        )}
                        <Text className="text-sm font-medium text-foreground ml-2">
                          {generatingImage ? "Generating image..." : "Will be generated on submit"}
                        </Text>
                      </View>
                    </View>
                  )
                ) : (
                  <>
                    <SingleImagePicker
                      image={form.imageUrl || null}
                      onImageChange={(uri) => {
                        updateForm("imageUrl", uri || "");
                      }}
                      aspectRatio={[16, 9]}
                      compactWhenEmpty
                      emptyButtonLabel="Upload cover image"
                      placeholder={`Upload a ${entityLabelLower} cover image`}
                      accessibilityLabel={`Upload ${entityLabelLower} cover image`}
                      testID="bundle-cover-image-upload"
                    />
                    {submitAttempted && !form.imageUrl.trim() ? (
                      <Text className="text-xs text-error mt-2">
                        Upload a cover image or switch back to Generate with AI.
                      </Text>
                    ) : (
                      <Text className="text-xs text-muted mt-2">
                        Uploaded images are shown here and used instead of AI generation.
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* Title */}
              <View onLayout={recordFieldOffset("title")}>
                <Text
                  className="text-sm font-medium mb-2"
                  style={activeFieldLabelStyle("title", colors.muted)}
                >
                  {entityLabel} Title *
                </Text>
                <TextInput
                  ref={titleInputRef}
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  style={activeFieldBorderStyle("title")}
                  placeholder={`Enter ${entityLabelLower} title`}
                  placeholderTextColor={colors.muted}
                  value={form.title}
                  onChangeText={(text) => updateForm("title", text)}
                  onFocus={() => setCurrentBuilderField("title")}
                />
              </View>

              {/* Description */}
              <View onLayout={recordFieldOffset("description")}>
                <Text
                  className="text-sm font-medium mb-2"
                  style={activeFieldLabelStyle("description", colors.muted)}
                >
                  Description
                </Text>
                <TextInput
                  ref={descriptionInputRef}
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground min-h-[100px]"
                  style={activeFieldBorderStyle("description")}
                  placeholder="Describe what's included in this bundle..."
                  placeholderTextColor={colors.muted}
                  value={form.description}
                  onChangeText={(text) => updateForm("description", text)}
                  onFocus={() => setCurrentBuilderField("description")}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Cadence */}
              <View onLayout={recordFieldOffset("cadence")}>
                <Text
                  className="text-sm font-medium mb-2"
                  style={activeFieldLabelStyle("cadence", colors.muted)}
                >
                  Billing Cadence
                </Text>
                <View className="flex-row gap-2">
                  {CADENCE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      className={`flex-1 py-3 rounded-xl border ${
                        form.cadence === option.value
                          ? "bg-primary border-primary"
                          : "bg-surface border-border"
                      }`}
                      onPress={() => {
                        setCurrentBuilderField("cadence");
                        updateForm("cadence", option.value);
                        haptics.light();
                      }}
                    >
                      <Text
                        className={`text-center font-medium ${
                          form.cadence === option.value ? "text-background" : "text-foreground"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Goals moved into details */}
              <View onLayout={recordFieldOffset("goals")}>
                <Text
                  className="text-sm font-medium mb-2"
                  style={activeFieldLabelStyle("goals", colors.muted)}
                >
                  Goals
                </Text>
                <Text className="text-sm text-muted mb-4">
                  Select the fitness goals this bundle helps achieve.
                </Text>

                <View className="flex-row flex-wrap gap-2 mb-4">
                  {GOAL_SUGGESTIONS.map((goal) => {
                    const isSelected = form.goals.includes(goal);
                    return (
                      <TouchableOpacity
                        key={goal}
                        className={`px-4 py-2 rounded-full border ${
                          isSelected ? "bg-primary border-primary" : "bg-surface border-border"
                        }`}
                        onPress={() => toggleGoal(goal)}
                      >
                        <Text
                          className={`text-sm font-medium ${
                            isSelected ? "text-background" : "text-foreground"
                          }`}
                        >
                          {goal}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View className="flex-row gap-2">
                  <TextInput
                    className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    placeholder="Add custom goal..."
                    placeholderTextColor={colors.muted}
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    onSubmitEditing={addCustomGoal}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    className="bg-primary rounded-xl px-4 items-center justify-center"
                    onPress={addCustomGoal}
                    disabled={!customGoal.trim()}
                  >
                    <IconSymbol name="plus" size={20} color={colors.background} />
                  </TouchableOpacity>
                </View>

                {form.goals.length > 0 && (
                  <View className="mt-4">
                    <Text className="text-sm font-medium text-foreground mb-2">Selected Goals</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {form.goals.map((goal) => (
                        <View
                          key={goal}
                          className="bg-primary/10 border border-primary/30 rounded-full px-3 py-1 flex-row items-center"
                        >
                          <Text className="text-primary text-sm">{goal}</Text>
                          <TouchableOpacity
                            onPress={() => toggleGoal(goal)}
                            className="ml-2"
                          >
                            <IconSymbol name="xmark" size={14} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View className="mt-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Primary Goal (Optional)</Text>
                  <TextInput
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    placeholder="What's the main goal clients will achieve?"
                    placeholderTextColor={colors.muted}
                    value={form.suggestedGoal}
                    onChangeText={(text) => updateForm("suggestedGoal", text)}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Services Tab */}
          {activeTab === "services" && (
            <View className="p-4">
              <Text className="text-sm text-muted mb-4">
                Add services included in this bundle. Set the price per service and quantity.
                Sessions will be tracked for usage.
              </Text>

              {/* Add Service Button */}
              <TouchableOpacity
                onLayout={recordFieldOffset("services-entry")}
                className="bg-primary/10 border border-primary rounded-xl p-4 flex-row items-center justify-center mb-4"
                style={activeFieldBorderStyle("services-entry")}
                onPress={() => setShowServiceModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Add Service"
                testID="add-service-button"
              >
                <IconSymbol name="plus" size={20} color={colors.primary} />
                <Text className="text-primary font-medium ml-2">Add Service</Text>
              </TouchableOpacity>

              {/* Service List */}
              {form.services.length === 0 ? (
                <View className="items-center py-8 bg-surface rounded-xl">
                  <IconSymbol name="calendar" size={40} color={colors.muted} />
                  <Text className="text-muted mt-2">No services added yet</Text>
                  <Text className="text-muted text-sm">Tap the button above to add services</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {form.services.map((service) => (
                    <View
                      key={service.id}
                      className="bg-surface border border-border rounded-xl p-4"
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <Text className="text-foreground font-medium">{service.name}</Text>
                        <TouchableOpacity onPress={() => removeService(service.id)}>
                          <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
                        </TouchableOpacity>
                      </View>

                      <View className="flex-row gap-3">
                        {/* Quantity */}
                        <View className="flex-1">
                          <Text className="text-xs text-muted mb-1">Quantity</Text>
                          <View className="flex-row items-center bg-background rounded-lg border border-border">
                            <TouchableOpacity
                              className="p-2"
                              onPress={() =>
                                updateService(service.id, {
                                  count: Math.max(1, service.count - 1),
                                })
                              }
                            >
                              <IconSymbol name="minus" size={16} color={colors.foreground} />
                            </TouchableOpacity>
                            <Text className="flex-1 text-center text-foreground font-medium">
                              {service.count}
                            </Text>
                            <TouchableOpacity
                              className="p-2"
                              onPress={() =>
                                updateService(service.id, { count: service.count + 1 })
                              }
                            >
                              <IconSymbol name="plus" size={16} color={colors.foreground} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Price per unit */}
                        <View className="flex-1">
                          <Text className="text-xs text-muted mb-1">Price per session</Text>
                          <View className="flex-row items-center bg-background rounded-lg border border-border px-2">
                            <Text className="text-foreground">$</Text>
                            <TextInput
                              className="flex-1 py-2 text-foreground text-center"
                              value={service.price.toString()}
                              onChangeText={(text) =>
                                updateService(service.id, {
                                  price: parseFloat(text) || 0,
                                })
                              }
                              keyboardType="decimal-pad"
                              placeholder="0"
                              placeholderTextColor={colors.muted}
                            />
                          </View>
                        </View>

                        {/* Duration */}
                        <View className="flex-1">
                          <Text className="text-xs text-muted mb-1">Duration (min)</Text>
                          <View className="flex-row items-center bg-background rounded-lg border border-border px-2">
                            <TextInput
                              className="flex-1 py-2 text-foreground text-center"
                              value={service.duration.toString()}
                              onChangeText={(text) =>
                                updateService(service.id, {
                                  duration: parseInt(text) || 60,
                                })
                              }
                              keyboardType="number-pad"
                              placeholder="60"
                              placeholderTextColor={colors.muted}
                            />
                          </View>
                        </View>
                      </View>

                      <View className="mt-2 pt-2 border-t border-border flex-row justify-between">
                        <Text className="text-muted text-sm">Subtotal</Text>
                        <Text className="text-foreground font-medium">
                          ${(service.price * service.count).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
            <View className="p-4">
              <Text className="text-sm text-muted mb-4">
                {`Add products from the catalog to include with this ${entityLabelLower}.`}
              </Text>

              {/* Add Product Buttons */}
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  onLayout={recordFieldOffset("products-entry")}
                  className="flex-1 bg-primary/10 border border-primary rounded-xl p-4 flex-row items-center justify-center"
                  style={activeFieldBorderStyle("products-entry")}
                  onPress={() => setShowProductModal(true)}
                >
                  <IconSymbol name="plus" size={20} color={colors.primary} />
                  <Text className="text-primary font-medium ml-2">Browse</Text>
                </TouchableOpacity>
                
                {Platform.OS !== "web" && (
                  <TouchableOpacity
                    className="flex-1 bg-surface border border-border rounded-xl p-4 flex-row items-center justify-center"
                    onPress={openBarcodeScanner}
                  >
                    <IconSymbol name="barcode.viewfinder" size={20} color={colors.foreground} />
                    <Text className="text-foreground font-medium ml-2">Scan</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Selected Products */}
              {form.products.length === 0 ? (
                <View className="items-center py-8 bg-surface rounded-xl">
                  <IconSymbol name="bag.fill" size={40} color={colors.muted} />
                  <Text className="text-muted mt-2">No products added yet</Text>
                    <Text className="text-muted text-sm">{`Tap the button above to add products to this ${entityLabelLower}`}</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {form.products.map((product) => (
                    <View
                      key={getBundleProductKey(product)}
                      className="bg-surface border border-border rounded-xl p-3"
                    >
                      <View className="flex-row items-center">
                        {/* Product Image */}
                        <View style={{ width: 64, height: 64, borderRadius: 8, marginRight: 12, backgroundColor: colors.border, overflow: 'hidden' }}>
                          {normalizeAssetUrl(product.imageUrl) ? (
                            <Image
                              source={{ uri: normalizeAssetUrl(product.imageUrl) as string }}
                              style={{ width: 64, height: 64 }}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                              <IconSymbol name="bag.fill" size={24} color={colors.muted} />
                            </View>
                          )}
                        </View>
                        <View className="flex-1">
                          <Text className="text-foreground font-medium" numberOfLines={1}>
                            {product.title}
                          </Text>
                          <View className="flex-row items-center mt-1">
                            <Text className="text-muted text-sm">
                              {product.vendor || "Product"}
                            </Text>
                            {product.source === "custom" ? (
                              <View className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                                <Text className="text-[11px] text-primary font-medium">Custom</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text className="text-primary font-semibold">${product.price}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => toggleProduct(product)}
                          className="p-2"
                        >
                          <IconSymbol name="xmark.circle.fill" size={22} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                      
                      {/* Quantity Controls */}
                      <View className="mt-3 pt-3 border-t border-border flex-row items-center justify-between">
                        <Text className="text-muted text-sm">Quantity</Text>
                        <View className="flex-row items-center gap-3">
                          <TouchableOpacity
                            onPress={() => updateProductQuantity(getBundleProductKey(product), product.quantity - 1)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: product.quantity <= 1 ? colors.surface : colors.primary + '20',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: product.quantity <= 1 ? colors.border : colors.primary,
                            }}
                            disabled={product.quantity <= 1}
                          >
                            <IconSymbol 
                              name="minus" 
                              size={16} 
                              color={product.quantity <= 1 ? colors.muted : colors.primary} 
                            />
                          </TouchableOpacity>
                          <Text className="text-foreground font-semibold text-lg w-8 text-center">
                            {product.quantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => updateProductQuantity(getBundleProductKey(product), product.quantity + 1)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: colors.primary + '20',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderWidth: 1,
                              borderColor: colors.primary,
                            }}
                          >
                            <IconSymbol name="plus" size={16} color={colors.primary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      {/* Subtotal */}
                      <View className="mt-2 pt-2 border-t border-border flex-row justify-between">
                        <Text className="text-muted text-sm">Subtotal</Text>
                        <Text className="text-foreground font-medium">
                          ${(parseFloat(product.price) * product.quantity).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

        </ScrollView>

        {/* Bottom Action Buttons */}
        <View className="px-3 py-3 border-t border-border bg-background">
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <TouchableOpacity
              className="rounded-xl border border-border bg-surface px-3"
              style={{
                flex: 1,
                minWidth: 0,
                height: 44,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onPress={() => setShowPriceBreakdownModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Open total price breakdown"
              testID="bundle-total-breakdown"
              activeOpacity={0.8}
            >
              <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                  <Text className="text-[9px] text-muted">P</Text>
                  <Text className="text-[10px] font-semibold text-foreground" numberOfLines={1}>
                    {form.products.length} {formatFooterAmount(productTotal)}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                  <Text className="text-[9px] text-muted">S</Text>
                  <Text className="text-[10px] font-semibold text-foreground" numberOfLines={1}>
                    {form.services.length} {formatFooterAmount(servicesTotal)}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
                  <Text className="text-[9px] text-muted">T</Text>
                  <Text className="text-[11px] font-bold text-primary" numberOfLines={1}>
                    {formatFooterAmount(Number.parseFloat(form.price || "0") || 0)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconSymbol name="chevron.right" size={12} color={colors.muted} />
              </View>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
              {Platform.OS === 'web' ? (
                // Web: Use native button elements for reliable click handling
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      width: 100,
                      maxWidth: 126,
                      height: 44,
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      padding: '0 12px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.5 : 1,
                      fontWeight: 600,
                      color: colors.foreground,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                  <button
                    onClick={handlePrimaryBuilderAction}
                    disabled={saving}
                    style={{
                      width: isFinalBuilderTab ? 126 : 84,
                      maxWidth: 126,
                      height: 44,
                      backgroundColor: colors.primary,
                      border: 'none',
                      borderRadius: 12,
                      padding: '0 12px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.5 : 1,
                      fontWeight: 600,
                      color: colors.background,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {saving
                      ? (isFinalBuilderTab ? 'Submitting...' : 'Moving...')
                      : (isFinalBuilderTab ? 'Submit for Review' : 'Next')}
                  </button>
                </>
              ) : (
                // Native: Use TouchableOpacity
                <>
                  <TouchableOpacity
                    style={{
                      width: 100,
                      maxWidth: 126,
                      height: 44,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: saving ? 0.5 : 1,
                    }}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.7}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.foreground} />
                    ) : (
                      <Text style={{ color: colors.foreground, fontWeight: '600', fontSize: 13 }}>Save Draft</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      width: isFinalBuilderTab ? 126 : 84,
                      maxWidth: 126,
                      height: 44,
                      backgroundColor: colors.primary,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: saving ? 0.5 : 1,
                    }}
                    onPress={handlePrimaryBuilderAction}
                    disabled={saving}
                    activeOpacity={0.7}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <Text numberOfLines={1} style={{ color: colors.background, fontWeight: '600', fontSize: 13 }}>
                        {isFinalBuilderTab ? 'Submit for Review' : 'Next'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        <ServicePickerModal
          visible={showServiceModal}
          onClose={() => setShowServiceModal(false)}
          onSelect={addService}
          presentation="pageSheet"
        />

        {/* Price Breakdown Modal */}
        <Modal
          visible={showPriceBreakdownModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPriceBreakdownModal(false)}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 16,
              backgroundColor: ds.colors.overlay.scrim,
            }}
          >
            <View className="bg-surface rounded-2xl p-6 w-full max-w-md">
              <View className="flex-row items-start justify-between mb-4">
                <View className="flex-1 pr-4">
                  <Text className="text-xl font-bold text-foreground">Price Breakdown</Text>
                  <Text className="text-muted mt-1">
                    Review the offer total and billing details.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowPriceBreakdownModal(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close price breakdown"
                  testID="bundle-price-breakdown-close"
                >
                  <IconSymbol name="xmark" size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <View className="rounded-xl border border-border bg-background px-4 py-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-muted">Products ({form.products.length})</Text>
                  <Text className="text-foreground font-semibold">${productTotal.toFixed(2)}</Text>
                </View>
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="text-muted">Services ({form.services.length})</Text>
                  <Text className="text-foreground font-semibold">${servicesTotal.toFixed(2)}</Text>
                </View>
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="text-muted">Payment Type</Text>
                  <Text className="text-foreground font-semibold">{cadenceLabel}</Text>
                </View>
                <View className="mt-3 pt-3 border-t border-border flex-row items-center justify-between">
                  <Text className="text-foreground font-semibold">Total</Text>
                  <Text className="text-primary font-bold text-lg">${form.price}</Text>
                </View>
              </View>

              <TouchableOpacity
                className="mt-4 bg-primary rounded-lg py-3 items-center"
                onPress={() => setShowPriceBreakdownModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Done viewing price breakdown"
                testID="bundle-price-breakdown-done"
              >
                <Text className="text-background font-semibold">Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Review Response Modal */}
        <Modal
          visible={showReviewResponseModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReviewResponseModal(false)}
        >
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 16,
              backgroundColor: ds.colors.overlay.scrim,
            }}
          >
            <View className="bg-surface rounded-2xl p-6 w-full max-w-md">
              <Text className="text-xl font-bold text-foreground mb-2">
                Respond to Review
              </Text>
              <Text className="text-muted mb-4">
                Send a response to the coordinator/manager with a deep link back to this bundle.
              </Text>
              <TextInput
                className="bg-background border border-border rounded-lg p-4 text-foreground min-h-[120px] mb-4"
                placeholder="Describe what you changed or ask a clarifying question..."
                placeholderTextColor={colors.muted}
                value={reviewResponse}
                onChangeText={setReviewResponse}
                multiline
                textAlignVertical="top"
              />
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-surface border border-border py-3 rounded-lg items-center"
                  onPress={() => {
                    setShowReviewResponseModal(false);
                    setReviewResponse("");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel review response"
                >
                  <Text className="text-foreground font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary py-3 rounded-lg items-center"
                  onPress={() => handleSendReviewResponse(false)}
                  disabled={respondToReviewMutation.isPending || !reviewResponse.trim()}
                  style={{
                    opacity:
                      respondToReviewMutation.isPending || !reviewResponse.trim()
                        ? 0.6
                        : 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Send response"
                  testID="bundle-review-send-response"
                >
                  {respondToReviewMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text className="text-background font-semibold">Send response</Text>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                className="mt-3 bg-warning rounded-lg py-3 items-center"
                onPress={() => handleSendReviewResponse(true)}
                disabled={respondToReviewMutation.isPending || !reviewResponse.trim()}
                style={{
                  opacity:
                    respondToReviewMutation.isPending || !reviewResponse.trim()
                      ? 0.6
                      : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Send response and resubmit for review"
                testID="bundle-review-send-and-resubmit"
              >
                <Text className="text-background font-semibold">
                  Send and resubmit for review
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showProductModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowProductModal(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
            <View className="flex-1 bg-background">
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                <Text className="text-lg font-semibold text-foreground">Select Products</Text>
                <TouchableOpacity onPress={() => setShowProductModal(false)}>
                  <IconSymbol name="xmark" size={24} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              {/* Source Filter */}
              <View className="px-4 pt-3">
                <View className="flex-row bg-surface border border-border rounded-xl p-1">
                  <TouchableOpacity
                    onPress={() => setProductSourceFilter("shopify")}
                    className={`flex-1 py-2 rounded-lg ${productSourceFilter === "shopify" ? "bg-primary" : ""}`}
                    accessibilityRole="button"
                    accessibilityLabel="Show Shopify synced products"
                    testID="bundle-products-source-shopify"
                  >
                    <Text
                      className={`text-center font-medium ${
                        productSourceFilter === "shopify" ? "text-background" : "text-foreground"
                      }`}
                    >
                      Shopify Products
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setProductSourceFilter("custom")}
                    className={`flex-1 py-2 rounded-lg ${productSourceFilter === "custom" ? "bg-primary" : ""}`}
                    accessibilityRole="button"
                    accessibilityLabel="Show my custom products"
                    testID="bundle-products-source-custom"
                  >
                    <Text
                      className={`text-center font-medium ${
                        productSourceFilter === "custom" ? "text-background" : "text-foreground"
                      }`}
                    >
                      My Custom Products
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search Bar */}
              <View className="px-4 py-3">
                <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-2">
                  <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                  <TextInput
                    className="flex-1 ml-2 text-foreground"
                    placeholder={productSourceFilter === "custom" ? "Search custom products..." : "Search products..."}
                    placeholderTextColor={colors.muted}
                    value={productSearch}
                    onChangeText={setProductSearch}
                  />
                  {productSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setProductSearch("")}>
                      <IconSymbol name="xmark" size={18} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Category Filter */}
              {productSourceFilter === "shopify" && uniqueProductTypes.length > 0 && (
                <View style={{ paddingBottom: 12 }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' }}
                    style={{ height: 44 }}
                  >
                  <TouchableOpacity
                    onPress={() => setProductTypeFilter("all")}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: productTypeFilter === "all" ? colors.primary : colors.surface,
                      borderWidth: productTypeFilter === "all" ? 0 : 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      color: productTypeFilter === "all" ? colors["primary-foreground"] : colors.foreground,
                      fontWeight: productTypeFilter === "all" ? '600' : '400',
                    }}>
                      All Types
                    </Text>
                  </TouchableOpacity>
                  {uniqueProductTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setProductTypeFilter(type)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: productTypeFilter === type ? colors.primary : colors.surface,
                        borderWidth: productTypeFilter === type ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{
                        fontSize: 14,
                        color: productTypeFilter === type ? colors["primary-foreground"] : colors.foreground,
                        fontWeight: productTypeFilter === type ? '600' : '400',
                      }}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  </ScrollView>
                </View>
              )}

              {/* Product List */}
              {productSourceFilter === "shopify" && productsLoading ? (
                <View className="flex-1 items-center justify-center">
                  <LogoLoader size={72} />
                </View>
              ) : productSourceFilter === "custom" && customProductsQuery.isLoading ? (
                <View className="flex-1 items-center justify-center">
                  <LogoLoader size={72} />
                </View>
              ) : (
                <FlatList
                  data={productSourceFilter === "custom" ? filteredCustomProducts : filteredProducts}
                  keyExtractor={(item) => String(getBundleProductKey(item))}
                  contentContainerStyle={{ padding: 16 }}
                  renderItem={({ item }) => {
                    const itemKey = getBundleProductKey(item);
                    const isSelected = form.products.some((p) => getBundleProductKey(p) === itemKey);
                    const isBundle = item.productType?.toLowerCase() === "bundle";
                    return (
                      <View
                        className={`bg-surface border rounded-xl p-3 mb-2 flex-row items-center ${
                          isSelected ? "border-primary" : "border-border"
                        } ${isBundle ? "opacity-60" : ""}`}
                      >
                        {isBundle && (
                          <View className="absolute inset-0 bg-background/80 items-center justify-center rounded-xl">
                            <Text className="text-xs font-semibold text-muted text-center px-3">
                              Bundles Cannot Be Part of Other Bundles
                            </Text>
                          </View>
                        )}
                        {/* Left side - clickable for detail view */}
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          onPress={() => {
                            setSelectedProductDetail(item);
                            // iOS pageSheet modals can fail to present a second modal on top.
                            // Close picker first, then present detail and reopen picker on close.
                            setReopenProductPickerAfterDetail(true);
                            setShowProductModal(false);
                            setTimeout(() => setShowProductDetail(true), 100);
                            haptics.light();
                          }}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`View details for ${item.title}`}
                          testID={`bundle-product-detail-${itemKey}`}
                        >
                          {/* Product Image - always show with placeholder fallback */}
                          <View style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
                            {item.imageUrl ? (
                              <Image
                                source={{ uri: item.imageUrl }}
                                style={{ width: 56, height: 56 }}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border }}>
                                <IconSymbol name="bag.fill" size={24} color={colors.muted} />
                              </View>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text className="text-foreground font-medium" numberOfLines={1}>
                              {item.title}
                            </Text>
                            <View className="flex-row items-center mt-0.5">
                              <Text className="text-muted text-sm">{item.vendor}</Text>
                              {item.source === "custom" ? (
                                <View className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                                  <Text className="text-[10px] font-medium text-primary">Custom</Text>
                                </View>
                              ) : null}
                            </View>
                            <View className="flex-row items-center mt-1">
                              <Text className="text-primary font-semibold">${item.price}</Text>
                              {item.source === "custom" ? (
                                <Text className="text-muted text-xs ml-2">Trainer delivery only</Text>
                              ) : (
                                <Text className="text-muted text-xs ml-2">
                                  {item.inventory > 0 ? `${item.inventory} in stock` : "Out of stock"}
                                </Text>
                              )}
                            </View>
                          </View>
                        </TouchableOpacity>
                        
                        {/* Right side - checkbox for selection */}
                        <TouchableOpacity
                          style={{ padding: 12, marginRight: -8 }}
                          onPress={() => {
                            if (!isBundle) {
                              if (item.source === "custom") {
                                isSelected
                                  ? updateForm(
                                      "products",
                                      form.products.filter(
                                        (product) =>
                                          getBundleProductKey(product) !== itemKey,
                                      ),
                                    )
                                  : addCustomProductWithQuantity(item, 1);
                                haptics.light();
                              } else {
                                toggleProduct(item);
                              }
                            }
                          }}
                          activeOpacity={0.7}
                          disabled={isBundle}
                        >
                          <View
                            className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                              isSelected ? "bg-primary border-primary" : "border-border"
                            }`}
                          >
                            {isSelected && (
                              <IconSymbol name="checkmark" size={14} color={colors.background} />
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <View className="items-center py-8">
                      <IconSymbol name="bag.fill" size={40} color={colors.muted} />
                      <Text className="text-muted mt-2">
                        {productSourceFilter === "custom"
                          ? "No custom products yet"
                          : "No products found"}
                      </Text>
                      {productSourceFilter === "custom" ? (
                        <Text className="text-muted text-sm mt-1 text-center">
                          Create trainer-delivered custom products such as tennis balls or gloves.
                        </Text>
                      ) : null}
                    </View>
                  }
                />
              )}

              {productSourceFilter === "custom" ? (
                <TouchableOpacity
                  onPress={() => setShowCustomProductModal(true)}
                  style={{
                    position: "absolute",
                    right: 16,
                    bottom: 96,
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Create custom product"
                  testID="bundle-products-add-custom-fab"
                >
                  <IconSymbol name="plus" size={24} color={colors.background} />
                </TouchableOpacity>
              ) : null}

              {/* Done Button */}
              <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.background }}>
                <View className="p-4 border-t border-border">
                  <TouchableOpacity
                    className="bg-primary rounded-xl py-4 items-center"
                    onPress={() => setShowProductModal(false)}
                  >
                    <Text className="text-background font-semibold">
                      Done ({form.products.length} selected)
                    </Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </View>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={showCustomProductModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCustomProductModal(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              paddingHorizontal: 16,
              backgroundColor: "rgba(0,0,0,0.75)",
            }}
          >
            <View className="bg-surface rounded-2xl p-5 border border-border">
              <Text className="text-xl font-bold text-foreground">Create Custom Product</Text>
              <Text className="text-sm text-muted mt-1 mb-4">
                This product is reusable, trainer-owned, and delivered by you through the app.
              </Text>

              <Text className="text-sm font-medium text-muted mb-2">Name</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
                placeholder="e.g. Tennis balls"
                placeholderTextColor={colors.muted}
                value={customProductName}
                onChangeText={setCustomProductName}
              />

              <Text className="text-sm font-medium text-muted mb-2">Price</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
                placeholder="e.g. 12.50"
                placeholderTextColor={colors.muted}
                value={customProductPrice}
                onChangeText={setCustomProductPrice}
                keyboardType="decimal-pad"
              />

              <Text className="text-sm font-medium text-muted mb-2">Description (optional)</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground min-h-[88px] mb-3"
                placeholder="Describe the product and what the trainer delivers."
                placeholderTextColor={colors.muted}
                value={customProductDescription}
                onChangeText={setCustomProductDescription}
                multiline
                textAlignVertical="top"
              />

              <Text className="text-sm font-medium text-muted mb-2">Image URL (optional)</Text>
              <TextInput
                className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
                placeholder="https://..."
                placeholderTextColor={colors.muted}
                value={customProductImageUrl}
                onChangeText={setCustomProductImageUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-background border border-border rounded-xl py-3 items-center"
                  onPress={() => setShowCustomProductModal(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel custom product creation"
                  testID="bundle-custom-product-cancel"
                >
                  <Text className="text-foreground font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-primary rounded-xl py-3 items-center"
                  onPress={handleCreateCustomProduct}
                  disabled={createCustomProductMutation.isPending}
                  style={{ opacity: createCustomProductMutation.isPending ? 0.7 : 1 }}
                  accessibilityRole="button"
                  accessibilityLabel="Save custom product"
                  testID="bundle-custom-product-save"
                >
                  {createCustomProductMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text className="text-background font-semibold">Save Product</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Barcode Scanner Modal */}
        <Modal
          visible={showBarcodeScanner}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowBarcodeScanner(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              {/* Header */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                paddingHorizontal: 16, 
                paddingVertical: 16,
                backgroundColor: ds.colors.overlay.scrim
              }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors["foreground-inverse"] }}>Scan Product Barcode</Text>
                <TouchableOpacity onPress={() => setShowBarcodeScanner(false)}>
                  <IconSymbol name="xmark" size={24} color={colors["foreground-inverse"]} />
                </TouchableOpacity>
              </View>

              {/* Camera View */}
              <View style={{ flex: 1 }}>
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'codabar', 'itf14', 'qr'],
                  }}
                  onBarcodeScanned={barcodeScanned ? undefined : handleBarcodeScan}
                />
                
                {/* Scan Overlay */}
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <View style={{
                    width: 280,
                    height: 150,
                    borderWidth: 2,
                    borderColor: colors.primary,
                    borderRadius: 12,
                    backgroundColor: 'transparent',
                  }} />
                  <Text style={{ 
                    color: colors["foreground-inverse"], 
                    marginTop: 20, 
                    fontSize: 14,
                    textAlign: 'center',
                    paddingHorizontal: 40,
                  }}>
                    Position the barcode within the frame
                  </Text>
                </View>
              </View>

              {/* Instructions */}
              <SafeAreaView edges={["bottom"]} style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                <View style={{ padding: 16 }}>
                  <Text style={{ color: '#999', fontSize: 12, textAlign: 'center' }}>
                    Scan product barcodes to quickly add items to your bundle.
                    Products are matched by SKU.
                  </Text>
                </View>
              </SafeAreaView>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Product Detail Modal */}
        <Modal
          visible={showProductDetail}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeProductDetail}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
            <View className="flex-1 bg-background">
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
                <TouchableOpacity
                  onPress={closeProductDetail}
                  className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
                </TouchableOpacity>
                <Text className="text-lg font-semibold text-foreground">Product Details</Text>
                <TouchableOpacity 
                  onPress={() => {
                    setShowDetailBarcodeScanner(true);
                    haptics.light();
                  }}
                  style={{ padding: 4 }}
                  disabled={selectedProductDetail?.source === "custom"}
                >
                  <IconSymbol
                    name="barcode.viewfinder"
                    size={24}
                    color={selectedProductDetail?.source === "custom" ? colors.muted : colors.foreground}
                  />
                </TouchableOpacity>
              </View>

              {selectedProductDetail && (
                <ScrollView className="flex-1">
                  {/* Product Image */}
                  <View style={{ width: '100%', height: 300, backgroundColor: colors.surface }}>
                    {selectedProductDetail!.imageUrl ? (
                      <Image
                        source={{ uri: selectedProductDetail!.imageUrl || undefined }}
                        style={{ width: '100%', height: 300 }}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border }}>
                        <IconSymbol name="bag.fill" size={64} color={colors.muted} />
                      </View>
                    )}
                  </View>

                  {/* Product Info */}
                  <View className="p-4">
                    <Text className="text-2xl font-bold text-foreground mb-1">
                        {selectedProductDetail!.title}
                    </Text>
                    <Text className="text-muted text-base mb-4">
                        {selectedProductDetail!.vendor}
                    </Text>

                    {/* Price and Stock */}
                    <View className="flex-row items-center mb-4">
                      <Text className="text-2xl font-bold text-primary">
                        ${selectedProductDetail!.price}
                      </Text>
                      <View className={`ml-3 px-3 py-1 rounded-full ${
                        selectedProductDetail!.inventory > 0 ? 'bg-success/20' : 'bg-error/20'
                      }`}>
                        <Text className={`text-sm font-medium ${
                          selectedProductDetail!.inventory > 0 ? 'text-success' : 'text-error'
                        }`}>
                          {selectedProductDetail!.inventory > 0 
                            ? `${selectedProductDetail!.inventory} in stock` 
                            : 'Out of stock'}
                        </Text>
                      </View>
                    </View>

                    {/* Quantity Selector */}
                    <View className="bg-surface rounded-xl p-4 mb-4">
                      <Text className="text-foreground font-semibold mb-3">Quantity</Text>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-muted">How many to add to bundle?</Text>
                        <View className="flex-row items-center">
                          <TouchableOpacity
                            onPress={() => {
                              if (detailQuantity > 1) {
                                setDetailQuantity(detailQuantity - 1);
                                haptics.light();
                              }
                            }}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: detailQuantity > 1 ? colors.primary : colors.border,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            disabled={detailQuantity <= 1}
                          >
                            <IconSymbol name="minus" size={18} color={detailQuantity > 1 ? colors.background : colors.muted} />
                          </TouchableOpacity>
                          <Text className="text-foreground text-xl font-bold mx-4" style={{ minWidth: 40, textAlign: 'center' }}>
                            {detailQuantity}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              if (detailQuantity < selectedProductDetail!.inventory || selectedProductDetail!.inventory === 0) {
                                setDetailQuantity(detailQuantity + 1);
                                haptics.light();
                              }
                            }}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: colors.primary,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <IconSymbol name="plus" size={18} color={colors.background} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      {(() => {
                        const selectedKey = getBundleProductKey(selectedProductDetail!);
                        const existingProduct = form.products.find(
                          (p) => getBundleProductKey(p) === selectedKey,
                        );
                        if (existingProduct) {
                          return (
                            <Text className="text-primary text-sm mt-2">
                              Currently in bundle: {existingProduct.quantity}
                            </Text>
                          );
                        }
                        return null;
                      })()}
                    </View>

                    {/* Product Details */}
                    <View className="bg-surface rounded-xl p-4 mb-4">
                      <Text className="text-foreground font-semibold mb-3">Product Information</Text>
                      
                      <View className="flex-row justify-between py-2 border-b border-border">
                        <Text className="text-muted">Type</Text>
                        <Text className="text-foreground">{selectedProductDetail!.productType || 'N/A'}</Text>
                      </View>
                      
                      <View className="flex-row justify-between py-2 border-b border-border">
                        <Text className="text-muted">SKU</Text>
                        <Text className="text-foreground">{selectedProductDetail!.sku || 'N/A'}</Text>
                      </View>
                      
                      <View className="flex-row justify-between py-2 border-b border-border">
                        <Text className="text-muted">Vendor</Text>
                        <Text className="text-foreground">{selectedProductDetail!.vendor || 'N/A'}</Text>
                      </View>
                      
                      <View className="flex-row justify-between py-2">
                        <Text className="text-muted">Status</Text>
                        <Text className="text-foreground capitalize">{selectedProductDetail!.status || 'active'}</Text>
                      </View>
                    </View>

                    {/* Description */}
                    {selectedProductDetail!.description && (
                      <View className="mb-4">
                        <Text className="text-foreground font-semibold mb-2">Description</Text>
                        <Text className="text-muted leading-6">
                          {selectedProductDetail!.description}
                        </Text>
                      </View>
                    )}

                    {/* Product Recommendations */}
                    {(() => {
                      const recommendations = getRecommendedProducts(selectedProductDetail!);
                      if (recommendations.length === 0) return null;
                      return (
                        <View className="mb-4">
                          <Text className="text-foreground font-semibold mb-3">You Might Also Like</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {recommendations.map((rec: ProductItem) => (
                              <TouchableOpacity
                                key={rec.id}
                                onPress={() => {
                                  setSelectedProductDetail(rec);
                                  setDetailQuantity(1);
                                  haptics.light();
                                }}
                                style={{
                                  width: 140,
                                  marginRight: 12,
                                  backgroundColor: colors.surface,
                                  borderRadius: 12,
                                  overflow: 'hidden',
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                }}
                              >
                                <View style={{ width: 140, height: 100, backgroundColor: colors.border }}>
                                  {rec.imageUrl ? (
                                    <Image
                                      source={{ uri: rec.imageUrl }}
                                      style={{ width: 140, height: 100 }}
                                      contentFit="cover"
                                    />
                                  ) : (
                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                      <IconSymbol name="bag.fill" size={24} color={colors.muted} />
                                    </View>
                                  )}
                                </View>
                                <View style={{ padding: 8 }}>
                                  <Text className="text-foreground text-sm font-medium" numberOfLines={1}>
                                    {rec.title}
                                  </Text>
                                  <Text className="text-primary text-sm font-semibold">
                                    ${rec.price}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      );
                    })()}
                  </View>
                </ScrollView>
              )}

              {/* Add to Bundle Button with Quantity */}
              <SafeAreaView edges={["bottom"]} style={{ backgroundColor: colors.background }}>
                <View className="p-4 border-t border-border">
                  {selectedProductDetail && (() => {
                    const selectedKey = getBundleProductKey(selectedProductDetail!);
                    const existingProduct = form.products.find(
                      (p) => getBundleProductKey(p) === selectedKey,
                    );
                    const isSelected = !!existingProduct;
                    return (
                      <View>
                        <TouchableOpacity
                          className="bg-primary rounded-xl py-4 items-center mb-2"
                          onPress={() => {
                            addProductWithQuantity(selectedProductDetail!, detailQuantity);
                            closeProductDetail();
                          }}
                        >
                          <Text className="text-background font-semibold">
                            {isSelected 
                              ? `Update Quantity (${detailQuantity})` 
                              : `Add ${detailQuantity} to ${entityLabel}`}
                          </Text>
                        </TouchableOpacity>
                        {isSelected && (
                          <TouchableOpacity
                            className="bg-error rounded-xl py-4 items-center"
                            onPress={() => {
                              toggleProduct(selectedProductDetail!);
                              closeProductDetail();
                            }}
                          >
                            <Text className="text-background font-semibold">
                              {`Remove from ${entityLabel}`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </SafeAreaView>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Detail Modal Barcode Scanner */}
        <Modal
          visible={showDetailBarcodeScanner}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowDetailBarcodeScanner(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              {/* Header */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                paddingHorizontal: 16, 
                paddingVertical: 16,
                backgroundColor: ds.colors.overlay.scrim
              }}>
                <TouchableOpacity onPress={() => setShowDetailBarcodeScanner(false)}>
                  <IconSymbol name="xmark" size={24} color={colors["foreground-inverse"]} />
                </TouchableOpacity>
                <Text style={{ color: colors["foreground-inverse"], fontSize: 18, fontWeight: '600' }}>Scan Product</Text>
                <View style={{ width: 24 }} />
              </View>

              {/* Camera */}
              {cameraPermission?.granted ? (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  barcodeScannerSettings={{
                    barcodeTypes: ["qr", "ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
                  }}
                  onBarcodeScanned={(result) => {
                    const scannedCode = result.data;
                    if (shopifyProducts) {
                      const matchedProduct = shopifyProducts.find(
                        (p: ProductItem) => p.sku && p.sku.toLowerCase() === scannedCode.toLowerCase()
                      );
                      if (matchedProduct) {
                        haptics.success();
                        setSelectedProductDetail(mapShopifyProductToBundleItem(matchedProduct));
                        setDetailQuantity(1);
                        setShowDetailBarcodeScanner(false);
                      } else {
                        haptics.error();
                        platformAlert("Not Found", `No product found with SKU: ${scannedCode}`);
                      }
                    }
                  }}
                >
                  {/* Scanning Frame Overlay */}
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{
                      width: 250,
                      height: 250,
                      borderWidth: 2,
                      borderColor: withAlpha(colors["foreground-inverse"], 0.5),
                      borderRadius: 16,
                    }} />
                    <Text style={{ 
                      color: colors["foreground-inverse"], 
                      marginTop: 20, 
                      fontSize: 14,
                      textAlign: 'center',
                    }}>
                      Position barcode within frame
                    </Text>
                  </View>
                </CameraView>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors["foreground-inverse"], marginBottom: 16 }}>Camera permission required</Text>
                  <TouchableOpacity
                    onPress={requestCameraPermission}
                    style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Grant Permission</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
