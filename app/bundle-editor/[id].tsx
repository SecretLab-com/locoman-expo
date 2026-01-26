import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Pressable,
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
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { SingleImagePicker } from "@/components/media-picker";
import { haptics } from "@/hooks/use-haptics";

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

// Product item for bundles - matching original locoman ShopifyProduct
type ProductItem = {
  id: number;
  title: string;
  description: string | null;
  vendor: string;
  productType: string;
  status: string;
  price: string;
  variantId?: number;
  sku: string;
  inventory: number;
  imageUrl: string | null;
  quantity?: number; // Quantity of this product in the bundle (optional, defaults to 1)
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

// Service type suggestions - matching original locoman
const SERVICE_SUGGESTIONS = [
  "Training Session",
  "Check-In",
  "Video Call",
  "Plan Review",
  "Meal Planning",
  "Progress Photos",
  "Custom Workout",
  "Nutrition Coaching",
];

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNewBundle = id === "new";

  const [loading, setLoading] = useState(!isNewBundle);
  const [saving, setSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "services" | "products" | "goals">("details");
  
  // Product selection modal
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  
  // Barcode scanner
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  
  // Service modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [newServiceType, setNewServiceType] = useState("");
  
  // Goal modal
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [customGoal, setCustomGoal] = useState("");

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

  // Fetch existing bundle if editing
  const { data: existingBundle, refetch: refetchBundle } = trpc.bundles.get.useQuery(
    { id: parseInt(id || "0") },
    { enabled: !isNewBundle && !!id }
  );

  // Cross-platform alert helper (defined early for mutations)
  const platformAlert = (title: string, message: string, buttons?: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }>) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 0) {
        const confirmButton = buttons.find(b => b.text !== 'Cancel') || buttons[0];
        window.alert(`${title}\n\n${message}`);
        confirmButton?.onPress?.();
      } else {
        window.alert(`${title}\n\n${message}`);
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  // Create bundle mutation
  const createBundleMutation = trpc.bundles.create.useMutation({
    onSuccess: () => {
      haptics.success();
      platformAlert("Success", "Bundle saved as draft", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message);
    },
  });

  // Update bundle mutation
  const updateBundleMutation = trpc.bundles.update.useMutation({
    onSuccess: () => {
      haptics.success();
      platformAlert("Success", "Bundle updated", [
        { text: "OK", onPress: () => refetchBundle() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message);
    },
  });

  // Submit for review mutation
  const submitForReviewMutation = trpc.bundles.submitForReview.useMutation({
    onSuccess: () => {
      haptics.success();
      platformAlert("Success", "Bundle submitted for review! You'll be notified when it's approved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      haptics.error();
      platformAlert("Error", error.message);
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existingBundle) {
      setForm({
        title: existingBundle.title || "",
        description: existingBundle.description || "",
        price: existingBundle.price || "0.00",
        cadence: (existingBundle.cadence as "one_time" | "weekly" | "monthly") || "monthly",
        imageUrl: existingBundle.imageUrl || "",
        imageSource: (existingBundle.imageSource as "ai" | "custom") || "ai",
        services: (existingBundle.servicesJson as ServiceItem[]) || [],
        products: [], // Will be populated from productsJson
        goals: (existingBundle.goalsJson as string[]) || [],
        suggestedGoal: (existingBundle.suggestedGoal as string) || "",
        status: (existingBundle.status as BundleFormState["status"]) || "draft",
        rejectionReason: existingBundle.rejectionReason || undefined,
        reviewComments: (existingBundle as any).reviewComments || undefined,
      });

      // Match products from productsJson with Shopify products
      if (existingBundle.productsJson && shopifyProducts) {
        const parsedProducts = existingBundle.productsJson as Array<{ id: number; name: string; price: string; imageUrl?: string; quantity?: number }>;
        const matchedProducts: BundleProductItem[] = parsedProducts.map((p) => {
          const shopifyProduct = shopifyProducts.find((sp: ProductItem) => sp.id === p.id);
          if (shopifyProduct) {
            return {
              ...shopifyProduct,
              quantity: p.quantity || 1,
            };
          }
          return {
            id: p.id,
            title: p.name,
            description: null,
            vendor: "",
            productType: "",
            status: "active",
            price: p.price,
            sku: "",
            inventory: 0,
            imageUrl: p.imageUrl || null,
            quantity: p.quantity || 1,
          };
        });
        setForm((prev) => ({ ...prev, products: matchedProducts }));
      }
      setLoading(false);
    } else if (!isNewBundle) {
      // Still loading
    } else {
      setLoading(false);
    }
  }, [existingBundle, shopifyProducts, isNewBundle]);

  const updateForm = useCallback(<K extends keyof BundleFormState>(key: K, value: BundleFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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

  // Filter products for modal
  const filteredProducts = useMemo(() => {
    if (!shopifyProducts) return [];
    return shopifyProducts.filter((product: ProductItem) => {
      const matchesSearch = !productSearch ||
        product.title.toLowerCase().includes(productSearch.toLowerCase()) ||
        (product.vendor && product.vendor.toLowerCase().includes(productSearch.toLowerCase())) ||
        (product.sku && product.sku.toLowerCase().includes(productSearch.toLowerCase()));
      const matchesType = productTypeFilter === "all" || product.productType === productTypeFilter;
      const matchesVendor = vendorFilter === "all" || product.vendor === vendorFilter;
      return matchesSearch && matchesType && matchesVendor;
    });
  }, [shopifyProducts, productSearch, productTypeFilter, vendorFilter]);

  // Extract unique product types and vendors
  const uniqueProductTypes = useMemo(() => {
    if (!shopifyProducts) return [];
    const types = new Set(shopifyProducts.map((p: ProductItem) => p.productType).filter(Boolean));
    return Array.from(types).sort();
  }, [shopifyProducts]);

  const uniqueVendors = useMemo(() => {
    if (!shopifyProducts) return [];
    const vendors = new Set(shopifyProducts.map((p: ProductItem) => p.vendor).filter(Boolean));
    return Array.from(vendors).sort();
  }, [shopifyProducts]);

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
    setNewServiceType("");
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
    const isSelected = form.products.some((p) => p.id === product.id);
    if (isSelected) {
      updateForm(
        "products",
        form.products.filter((p) => p.id !== product.id)
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
  const updateProductQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) return;
    updateForm(
      "products",
      form.products.map((p) => (p.id === productId ? { ...p, quantity } : p))
    );
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
        // Check if already added
        const existingProduct = form.products.find((p) => p.id === matchedProduct.id);
        if (existingProduct) {
          // Increment quantity
          updateProductQuantity(matchedProduct.id, existingProduct.quantity + 1);
          haptics.success();
          platformAlert(
            "Product Found",
            `Added another ${matchedProduct.title} (now ${existingProduct.quantity + 1} total)`,
            [{ text: "OK", onPress: () => {
              setBarcodeScanned(false);
              setShowBarcodeScanner(false);
            }}]
          );
        } else {
          // Add new product
          const productWithQuantity: BundleProductItem = {
            ...matchedProduct,
            quantity: 1,
          };
          updateForm("products", [...form.products, productWithQuantity]);
          haptics.success();
          platformAlert(
            "Product Added",
            `${matchedProduct.title} added to bundle`,
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
    if (customGoal.trim() && !form.goals.includes(customGoal.trim())) {
      updateForm("goals", [...form.goals, customGoal.trim()]);
      setCustomGoal("");
      haptics.light();
    }
  };

  // Validate form
  // Cross-platform alert helper
  const showAlert = (title: string, message: string, buttons?: Array<{ text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }>) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 1) {
        // For confirmation dialogs
        const confirmButton = buttons.find(b => b.text !== 'Cancel');
        if (window.confirm(`${title}\n\n${message}`)) {
          confirmButton?.onPress?.();
        }
      } else {
        window.alert(`${title}\n\n${message}`);
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const validateForm = (): boolean => {
    if (!form.title.trim()) {
      showAlert("Validation Error", "Please enter a bundle title");
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
      showAlert("Validation Error", "Please enter a bundle title");
      return;
    }

    setSaving(true);
    try {
      const bundleData = {
        title: form.title,
        description: form.description,
        price: form.price,
        cadence: form.cadence,
        imageUrl: form.imageUrl || undefined,
        imageSource: form.imageSource,
        productsJson: form.products.map((p) => ({
          id: p.id,
          name: p.title,
          price: p.price,
          imageUrl: p.imageUrl,
        })),
        servicesJson: form.services,
        goalsJson: form.goals,
        suggestedGoal: form.suggestedGoal || undefined,
      };

      if (isNewBundle) {
        await createBundleMutation.mutateAsync(bundleData);
      } else {
        await updateBundleMutation.mutateAsync({
          id: parseInt(id || "0"),
          ...bundleData,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // Submit for review
  const handleSubmitForReview = async () => {
    if (!validateForm()) return;

    if (form.products.length === 0 && form.services.length === 0) {
      showAlert("Validation Error", "Please add at least one product or service");
      return;
    }

    const doSubmit = async () => {
      setSaving(true);
      try {
        // First save the bundle
        const bundleData = {
          title: form.title,
          description: form.description,
          price: form.price,
          cadence: form.cadence,
          imageUrl: form.imageUrl || undefined,
          imageSource: form.imageSource,
          productsJson: form.products.map((p) => ({
            id: p.id,
            name: p.title,
            price: p.price,
            imageUrl: p.imageUrl,
          })),
          servicesJson: form.services,
          goalsJson: form.goals,
          suggestedGoal: form.suggestedGoal || undefined,
        };

        let bundleId = parseInt(id || "0");
        if (isNewBundle) {
          const result = await createBundleMutation.mutateAsync(bundleData);
          if (result && typeof result === 'object' && 'id' in result) {
            bundleId = (result as { id: number }).id;
          }
        } else {
          await updateBundleMutation.mutateAsync({
            id: bundleId,
            ...bundleData,
          });
        }

        // Then submit for review
        await submitForReviewMutation.mutateAsync({ id: bundleId });
      } finally {
        setSaving(false);
      }
    };

    showAlert(
      "Submit for Review",
      "Your bundle will be reviewed by the admin team. You'll be notified once it's approved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: doSubmit,
        },
      ]
    );
  };

  // Generate AI image
  const handleGenerateImage = async () => {
    if (!form.title.trim()) {
      showAlert("Title Required", "Please enter a bundle title first to generate an image.");
      return;
    }

    setGeneratingImage(true);
    try {
      const result = await generateImageMutation.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        goals: form.goals.length > 0 ? form.goals : undefined,
        style: "fitness",
      });
      if (result.url) {
        updateForm("imageUrl", result.url);
        updateForm("imageSource", "ai");
        haptics.success();
      }
    } catch (error) {
      console.error("Failed to generate image:", error);
      platformAlert("Error", "Failed to generate image. Please try again.");
    } finally {
      setGeneratingImage(false);
    }
  };

  // Delete bundle
  const handleDelete = () => {
    const doDelete = async () => {
      // TODO: Implement delete mutation
      haptics.success();
      router.back();
    };

    platformAlert(
      "Delete Bundle",
      "Are you sure you want to delete this bundle? This action cannot be undone.",
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

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
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
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-foreground">
            {isNewBundle ? "Create Bundle" : "Edit Bundle"}
          </Text>
          <View className="flex-row items-center gap-2">
            {!isNewBundle && (
              <TouchableOpacity onPress={handleDelete} className="p-2">
                <IconSymbol name="trash.fill" size={20} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

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
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#F97316" />
              <Text className="font-medium ml-2" style={{ color: "#F97316" }}>Changes Requested</Text>
            </View>
            <Text className="text-foreground mt-2 text-sm">{form.reviewComments}</Text>
            <Text className="text-muted mt-2 text-xs">Please address the feedback above and resubmit for review.</Text>
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
          {(["details", "services", "products", "goals"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-3 ${activeTab === tab ? "border-b-2 border-primary" : ""}`}
              onPress={() => {
                setActiveTab(tab);
                haptics.light();
              }}
            >
              <Text
                className={`text-center text-sm font-medium capitalize ${
                  activeTab === tab ? "text-primary" : "text-muted"
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Details Tab */}
          {activeTab === "details" && (
            <View className="p-4 gap-4">
              {/* Bundle Image */}
              <View>
                <Text className="text-sm font-medium text-foreground mb-2">Bundle Cover Image</Text>
                <SingleImagePicker
                  image={form.imageUrl || null}
                  onImageChange={(uri) => {
                    updateForm("imageUrl", uri || "");
                    updateForm("imageSource", "custom");
                  }}
                  aspectRatio={[16, 9]}
                  placeholder="Add Bundle Cover Image"
                />

                {/* AI Generate Button */}
                <TouchableOpacity
                  className={`mt-2 flex-row items-center justify-center py-3 rounded-xl border ${
                    generatingImage ? "bg-surface border-border" : "bg-primary/10 border-primary"
                  }`}
                  onPress={handleGenerateImage}
                  disabled={generatingImage}
                >
                  {generatingImage ? (
                    <>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text className="text-primary font-medium ml-2">Generating...</Text>
                    </>
                  ) : (
                    <>
                      <IconSymbol name="sparkles" size={18} color={colors.primary} />
                      <Text className="text-primary font-medium ml-2">Generate with AI</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Title */}
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Bundle Title *</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Enter bundle title"
                  placeholderTextColor={colors.muted}
                  value={form.title}
                  onChangeText={(text) => updateForm("title", text)}
                />
              </View>

              {/* Description */}
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Description</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground min-h-[100px]"
                  placeholder="Describe what's included in this bundle..."
                  placeholderTextColor={colors.muted}
                  value={form.description}
                  onChangeText={(text) => updateForm("description", text)}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Cadence */}
              <View>
                <Text className="text-sm font-medium text-muted mb-2">Billing Cadence</Text>
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

              {/* Price Summary */}
              <View className="bg-surface border border-border rounded-xl p-4">
                <Text className="text-sm font-medium text-foreground mb-3">Price Summary</Text>
                <View className="gap-2">
                  <View className="flex-row justify-between">
                    <Text className="text-muted">Products ({form.products.length})</Text>
                    <Text className="text-foreground">${productTotal.toFixed(2)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-muted">Services ({form.services.length})</Text>
                    <Text className="text-foreground">${servicesTotal.toFixed(2)}</Text>
                  </View>
                  <View className="border-t border-border pt-2 mt-2 flex-row justify-between">
                    <Text className="text-foreground font-semibold">Total Price</Text>
                    <Text className="text-primary font-bold text-lg">${form.price}</Text>
                  </View>
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
                className="bg-primary/10 border border-primary rounded-xl p-4 flex-row items-center justify-center mb-4"
                onPress={() => setShowServiceModal(true)}
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
                Add products from the catalog to include with this bundle.
              </Text>

              {/* Add Product Buttons */}
              <View className="flex-row gap-3 mb-4">
                <TouchableOpacity
                  className="flex-1 bg-primary/10 border border-primary rounded-xl p-4 flex-row items-center justify-center"
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
                  <Text className="text-muted text-sm">Tap the button above to add products</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {form.products.map((product) => (
                    <View
                      key={product.id}
                      className="bg-surface border border-border rounded-xl p-3"
                    >
                      <View className="flex-row items-center">
                        {/* Product Image */}
                        <View style={{ width: 64, height: 64, borderRadius: 8, marginRight: 12, backgroundColor: colors.border, overflow: 'hidden' }}>
                          {product.imageUrl ? (
                            <Image
                              source={{ uri: product.imageUrl }}
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
                          <Text className="text-muted text-sm">{product.vendor}</Text>
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
                            onPress={() => updateProductQuantity(product.id, product.quantity - 1)}
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
                            onPress={() => updateProductQuantity(product.id, product.quantity + 1)}
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

          {/* Goals Tab */}
          {activeTab === "goals" && (
            <View className="p-4">
              <Text className="text-sm text-muted mb-4">
                Select the fitness goals this bundle helps achieve.
              </Text>

              {/* Goal Chips */}
              <View className="flex-row flex-wrap gap-2 mb-4">
                {GOAL_SUGGESTIONS.map((goal) => {
                  const isSelected = form.goals.includes(goal);
                  return (
                    <TouchableOpacity
                      key={goal}
                      className={`px-4 py-2 rounded-full border ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "bg-surface border-border"
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

              {/* Custom Goal Input */}
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

              {/* Selected Goals */}
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

              {/* Suggested Goal */}
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
          )}
        </ScrollView>

        {/* Bottom Action Buttons */}
        <View className="p-4 border-t border-border bg-background">
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {Platform.OS === 'web' ? (
              // Web: Use native button elements for reliable click handling
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: '16px 0',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.5 : 1,
                    fontWeight: 600,
                    color: colors.foreground,
                    fontSize: 16,
                  }}
                >
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  onClick={handleSubmitForReview}
                  disabled={saving}
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    border: 'none',
                    borderRadius: 12,
                    padding: '16px 0',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.5 : 1,
                    fontWeight: 600,
                    color: colors.background,
                    fontSize: 16,
                  }}
                >
                  {saving ? 'Submitting...' : 'Submit for Review'}
                </button>
              </>
            ) : (
              // Native: Use TouchableOpacity
              <>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: 'center',
                    opacity: saving ? 0.5 : 1,
                  }}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.foreground} />
                  ) : (
                    <Text style={{ color: colors.foreground, fontWeight: '600' }}>Save Draft</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    paddingVertical: 16,
                    alignItems: 'center',
                    opacity: saving ? 0.5 : 1,
                  }}
                  onPress={handleSubmitForReview}
                  disabled={saving}
                  activeOpacity={0.7}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <Text style={{ color: colors.background, fontWeight: '600' }}>Submit for Review</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Service Selection Modal */}
        <Modal
          visible={showServiceModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowServiceModal(false)}
        >
          <View className="flex-1 bg-background">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
              <Text className="text-lg font-semibold text-foreground">Add Service</Text>
              <TouchableOpacity onPress={() => setShowServiceModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4">
              <Text className="text-sm text-muted mb-4">Select a service type or create a custom one</Text>

              {/* Suggested Services */}
              <View className="gap-2 mb-4">
                {SERVICE_SUGGESTIONS.map((service) => (
                  <TouchableOpacity
                    key={service}
                    className="bg-surface border border-border rounded-xl p-4 flex-row items-center justify-between"
                    onPress={() => addService(service)}
                  >
                    <Text className="text-foreground font-medium">{service}</Text>
                    <IconSymbol name="plus" size={20} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Service Input */}
              <View className="flex-row gap-2">
                <TextInput
                  className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Custom service name..."
                  placeholderTextColor={colors.muted}
                  value={newServiceType}
                  onChangeText={setNewServiceType}
                />
                <TouchableOpacity
                  className="bg-primary rounded-xl px-4 items-center justify-center"
                  onPress={() => {
                    if (newServiceType.trim()) {
                      addService(newServiceType.trim());
                    }
                  }}
                  disabled={!newServiceType.trim()}
                >
                  <IconSymbol name="plus" size={20} color={colors.background} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>

        {/* Product Selection Modal */}
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

              {/* Search Bar */}
              <View className="px-4 py-3">
                <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-2">
                  <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                  <TextInput
                    className="flex-1 ml-2 text-foreground"
                    placeholder="Search products..."
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
              {uniqueProductTypes.length > 0 && (
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
                      color: productTypeFilter === "all" ? '#FFFFFF' : colors.foreground,
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
                        color: productTypeFilter === type ? '#FFFFFF' : colors.foreground,
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
              {productsLoading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <FlatList
                  data={filteredProducts}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={{ padding: 16 }}
                  renderItem={({ item }) => {
                    const isSelected = form.products.some((p) => p.id === item.id);
                    return (
                      <TouchableOpacity
                        className={`bg-surface border rounded-xl p-3 mb-2 flex-row items-center ${
                          isSelected ? "border-primary" : "border-border"
                        }`}
                        onPress={() => toggleProduct(item)}
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
                        <View className="flex-1">
                          <Text className="text-foreground font-medium" numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text className="text-muted text-sm">{item.vendor}</Text>
                          <View className="flex-row items-center mt-1">
                            <Text className="text-primary font-semibold">${item.price}</Text>
                            <Text className="text-muted text-xs ml-2">
                              {item.inventory > 0 ? `${item.inventory} in stock` : "Out of stock"}
                            </Text>
                          </View>
                        </View>
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
                    );
                  }}
                  ListEmptyComponent={
                    <View className="items-center py-8">
                      <IconSymbol name="bag.fill" size={40} color={colors.muted} />
                      <Text className="text-muted mt-2">No products found</Text>
                    </View>
                  }
                />
              )}

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

        {/* Barcode Scanner Modal */}
        <Modal
          visible={showBarcodeScanner}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowBarcodeScanner(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }} edges={["top"]}>
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              {/* Header */}
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                paddingHorizontal: 16, 
                paddingVertical: 16,
                backgroundColor: 'rgba(0,0,0,0.8)'
              }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#fff' }}>Scan Product Barcode</Text>
                <TouchableOpacity onPress={() => setShowBarcodeScanner(false)}>
                  <IconSymbol name="xmark" size={24} color="#fff" />
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
                    color: '#fff', 
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
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
