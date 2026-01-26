import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft,
  Save,
  Send,
  Package,
  Plus,
  Minus,
  Trash2,
  GripVertical,
  Loader2,
  Check,
  ExternalLink,
  RefreshCw,
  ImageIcon,
  Upload,
  AlertCircle,
  Clock,
  Sparkles,
  Camera,
  Mail,
  Search,
  Filter,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ProductDetailSheet } from "@/components/ProductDetailSheet";
import { useIsImpersonating } from "@/components/ImpersonationBanner";
import { ImageLibraryDialog } from "@/components/ImageLibraryDialog";
import { ImageGuidelines, validateImage } from "@/components/ImageGuidelines";
import { ImageCropper } from "@/components/ImageCropper";
import { TagInput } from "@/components/TagInput";
import { useGoalTagColors, useServiceTagColors, useCreateTagColor } from "@/hooks/useTagColors";
import { InviteBundleDialog } from "@/components/InviteBundleDialog";
import { Breadcrumb } from "@/components/Breadcrumb";

// Service type suggestions are now loaded from database via useServiceTagColors hook

interface ShopifyProduct {
  id: number;
  title: string;
  description: string | null;
  vendor: string;
  productType: string;
  status: string;
  price: string;
  variantId: number;
  sku: string;
  inventory: number;
  imageUrl: string;
}

export default function BundleEditor() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEditing = !!params.id;

  const [activeTab, setActiveTab] = useState("details");
  const [isSaving, setIsSaving] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageSource, setImageSource] = useState<"ai" | "custom">("ai");
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [cadence, setCadence] = useState("one_time");
  const [goalType, setGoalType] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [suggestedGoal, setSuggestedGoal] = useState("");

  // Services state
  const [services, setServices] = useState<
    Array<{ type: string; count: number; duration: number; price: number; unit: string }>
  >([]);

  // Products state - now stores full product info
  const [selectedProducts, setSelectedProducts] = useState<ShopifyProduct[]>([]);
  const [detailProduct, setDetailProduct] = useState<ShopifyProduct | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Product search and filter state
  const [productSearch, setProductSearch] = useState("");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Fetch Shopify products
  const { data: shopifyProducts, isLoading: productsLoading } = trpc.shopify.products.useQuery(undefined, {
    staleTime: 60000,
  });

  // Fetch templates
  const { data: templates } = trpc.templates.list.useQuery();

  // Fetch tag colors from database using hooks
  const { suggestions: goalSuggestions } = useGoalTagColors();
  const { suggestions: serviceSuggestions } = useServiceTagColors();
  const createTagColorMutation = useCreateTagColor();

  // Fetch commission data for selected products
  const productIds = useMemo(() => selectedProducts.map(p => p.id), [selectedProducts]);
  const { data: commissionData } = trpc.bundles.getCommissionData.useQuery(
    { shopifyProductIds: productIds },
    { enabled: productIds.length > 0 }
  );

  // Fetch existing bundle if editing
  const { data: existingBundle, refetch: refetchBundle, isLoading: bundleLoading, error: bundleError } = trpc.bundles.get.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: isEditing }
  );

  // Debug logging
  useEffect(() => {
    console.log("[BundleEditor] isEditing:", isEditing, "params.id:", params.id);
    console.log("[BundleEditor] bundleLoading:", bundleLoading, "bundleError:", bundleError);
    console.log("[BundleEditor] existingBundle:", existingBundle);
  }, [isEditing, params.id, bundleLoading, bundleError, existingBundle]);

  // Populate form when editing - basic fields first
  useEffect(() => {
    if (existingBundle) {
      console.log("[BundleEditor] Loading existing bundle:", existingBundle.id, existingBundle.title);
      setTitle(existingBundle.title);
      setDescription(existingBundle.description || "");
      setPrice(existingBundle.price || "");
      setCadence(existingBundle.cadence || "one_time");
      setCoverImageUrl(existingBundle.imageUrl || null);
      setImageSource((existingBundle.imageSource as "ai" | "custom") || "ai");
      
      // Parse goals from goalsJson
      if (existingBundle.goalsJson) {
        const parsedGoals = existingBundle.goalsJson as string[];
        setSelectedGoals(parsedGoals);
      }
      if (existingBundle.suggestedGoal) {
        setSuggestedGoal(existingBundle.suggestedGoal as string);
      }
      
      // Parse services
      if (existingBundle.servicesJson) {
        const parsedServices = existingBundle.servicesJson as Array<{ type: string; count: number; duration: number; price?: number; unit?: string }>;
        // Add default price and unit for backwards compatibility
        const servicesWithDefaults = parsedServices.map(s => ({
          ...s,
          price: s.price ?? 0,
          unit: s.unit ?? "per session"
        }));
        setServices(servicesWithDefaults);
      }
      
      // Parse products from saved bundle data (don't require Shopify products)
      if (existingBundle.productsJson) {
        const parsedProducts = existingBundle.productsJson as Array<{ id: number; name: string; price: string; imageUrl?: string }>;
        const matchedProducts = parsedProducts.map(p => {
          // Try to find in Shopify products if available, otherwise use saved data
          const shopifyProduct = shopifyProducts?.find(sp => sp.id === p.id);
          return shopifyProduct || {
            id: p.id,
            title: p.name,
            description: null,
            vendor: "",
            productType: "",
            status: "active",
            price: p.price,
            variantId: 0,
            sku: "",
            inventory: 0,
            imageUrl: p.imageUrl || "",
          };
        });
        setSelectedProducts(matchedProducts);
      }
    }
  }, [existingBundle, shopifyProducts]);

  // Publish mutation
  const publishMutation = trpc.shopify.publishBundle.useMutation({
    onSuccess: (result) => {
      if (result) {
        toast.success("Bundle published to Shopify!");
        setLocation("/trainer/bundles");
      } else {
        toast.error("Failed to publish bundle");
      }
    },
    onError: (error) => {
      toast.error(`Publish failed: ${error.message}`);
    },
  });

  // Create bundle draft mutation
  const createBundleMutation = trpc.bundles.create.useMutation({
    onSuccess: () => {
      toast.success("Bundle saved as draft");
    },
    onError: (error) => {
      toast.error(`Save failed: ${error.message}`);
    },
  });

  // Update bundle mutation
  const updateBundleMutation = trpc.bundles.update.useMutation({
    onSuccess: () => {
      toast.success("Bundle updated");
      refetchBundle();
    },
    onError: (error) => {
      toast.error(`Update failed: ${error.message}`);
    },
  });

  // Regenerate image mutation
  const regenerateImageMutation = trpc.bundles.regenerateImage.useMutation({
    onSuccess: (result) => {
      setCoverImageUrl(result.imageUrl);
      toast.success("Cover image regenerated!");
      refetchBundle();
    },
    onError: (error) => {
      toast.error(`Image generation failed: ${error.message}`);
    },
  });

  // Upload cover image mutation
  const uploadCoverImageMutation = trpc.bundles.uploadCoverImage.useMutation({
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  // Save to image library mutation
  const saveToLibraryMutation = trpc.bundles.saveToLibrary.useMutation({
    onSuccess: () => {
      toast.success("Image saved to library");
    },
    onError: () => {
      // Silent fail - not critical
      console.error("Failed to save to library");
    },
  });

  // Submit for review mutation
  const submitForReviewMutation = trpc.bundles.submitForReview.useMutation({
    onSuccess: () => {
      toast.success("Bundle submitted for review! You'll be notified when it's approved.");
      refetchBundle();
    },
    onError: (error) => {
      toast.error(`Submit failed: ${error.message}`);
    },
  });

  // Goal and service suggestions are now loaded from useGoalTagColors and useServiceTagColors hooks

  const handleSubmitForReview = async () => {
    if (!params.id) return;
    if (!title || !price || selectedProducts.length === 0) {
      toast.error("Please fill in title, price, and select at least one product before submitting");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Save first, then submit
      await updateBundleMutation.mutateAsync({
        id: parseInt(params.id),
        title: title || "Untitled Bundle",
        description,
        price,
        cadence: cadence as "one_time" | "weekly" | "monthly",
        productsJson: selectedProducts.map(p => ({ id: p.id, name: p.title, price: p.price, imageUrl: p.imageUrl })),
        servicesJson: services,
        imageSource,
      });
      await submitForReviewMutation.mutateAsync({ id: parseInt(params.id) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit for review - works for both new and existing bundles
  const handleSubmitForReviewNew = async () => {
    if (!title || !price || selectedProducts.length === 0) {
      toast.error("Please fill in title, price, and select at least one product before submitting");
      return;
    }
    
    setIsSubmitting(true);
    try {
      let bundleId: number;
      
      if (isEditing && params.id) {
        // Update existing bundle
        await updateBundleMutation.mutateAsync({
          id: parseInt(params.id),
          title: title || "Untitled Bundle",
          description,
          price,
          cadence: cadence as "one_time" | "weekly" | "monthly",
          productsJson: selectedProducts.map(p => ({ id: p.id, name: p.title, price: p.price, imageUrl: p.imageUrl })),
          servicesJson: services,
          goalsJson: selectedGoals,
          suggestedGoal: suggestedGoal || undefined,
          imageSource,
        });
        bundleId = parseInt(params.id);
      } else {
        // Create new bundle first
        const result = await createBundleMutation.mutateAsync({
          title: title || "Untitled Bundle",
          description,
          price,
          cadence: cadence as "one_time" | "weekly" | "monthly",
          productsJson: selectedProducts.map(p => ({ id: p.id, name: p.title, price: p.price, imageUrl: p.imageUrl })),
          servicesJson: services,
          goalsJson: selectedGoals,
          suggestedGoal: suggestedGoal || undefined,
          imageSource,
        });
        bundleId = result.id;
      }
      
      // Submit for review
      await submitForReviewMutation.mutateAsync({ id: bundleId });
      setLocation("/trainer/bundles");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerateImage = async () => {
    if (!params.id) return;
    setIsRegenerating(true);
    try {
      await regenerateImageMutation.mutateAsync({ id: parseInt(params.id) });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleUploadCoverImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !params.id) return;
    
    // Validate using ImageGuidelines
    const validation = validateImage(file);
    if (!validation.isValid) {
      validation.errors.forEach(err => toast.error(err));
      return;
    }
    validation.warnings.forEach(warn => toast.warning(warn));
    
    // Read file and open cropper
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImageToCrop(base64);
      setShowImageCropper(true);
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBase64: string, mimeType: string) => {
    if (!params.id) return;
    
    setIsUploading(true);
    try {
      const result = await uploadCoverImageMutation.mutateAsync({
        id: parseInt(params.id),
        imageData: croppedBase64,
        fileName: `bundle-cover-${Date.now()}.jpg`,
        mimeType: mimeType,
      });
      setCoverImageUrl(result.imageUrl);
      setImageSource("custom");
      toast.success('Cover image uploaded!');
      
      // Save to library
      saveToLibraryMutation.mutate({
        url: result.imageUrl,
        title: title || 'Bundle Cover',
        mimeType: mimeType,
      });
      
      refetchBundle();
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
      setShowImageCropper(false);
      setImageToCrop(null);
    }
  };

  const handleSelectFromLibrary = async (imageUrl: string) => {
    setCoverImageUrl(imageUrl);
    setImageSource("custom");
    
    // Update the bundle with the selected image
    if (params.id) {
      try {
        await updateBundleMutation.mutateAsync({
          id: parseInt(params.id),
          imageSource: "custom",
        });
        // We need to also update the imageUrl in the database
        // For now, just set it locally - the next save will persist it
        toast.success('Image selected from library!');
      } catch (error) {
        toast.error('Failed to update bundle');
      }
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find((t) => t.id === parseInt(templateId));
    if (template) {
      setTitle(template.title);
      setDescription(template.description || "");
      setPrice(template.basePrice?.toString() || "");
      setGoalType(template.goalType || "");
      
      // Parse default services
      if (template.defaultServices) {
        const defaultServices = template.defaultServices as Array<{ type: string; count: number; duration: number; price?: number; unit?: string }>;
        const servicesWithDefaults = defaultServices.map(s => ({
          ...s,
          price: s.price ?? 0,
          unit: s.unit ?? "per session"
        }));
        setServices(servicesWithDefaults);
      }
      
      // Parse default products (by ID)
      if (template.defaultProducts && shopifyProducts) {
        const defaultProductIds = template.defaultProducts as number[];
        const matchedProducts = shopifyProducts.filter(p => defaultProductIds.includes(p.id));
        setSelectedProducts(matchedProducts);
      }
      
      toast.success("Template applied!");
    }
  };

  const addService = () => {
    setServices([...services, { type: "training", count: 1, duration: 60, price: 0, unit: "per session" }]);
  };

  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const updateService = (index: number, field: string, value: string | number) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  };

  const toggleProduct = (product: ShopifyProduct) => {
    const isSelected = selectedProducts.some(p => p.id === product.id);
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter((p) => p.id !== product.id));
    } else {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  // Calculate product total
  const calculateProductTotal = () => {
    return selectedProducts.reduce((sum, product) => {
      return sum + parseFloat(product.price);
    }, 0);
  };

  // Calculate services total using trainer-specified prices
  const calculateServicesTotal = () => {
    return services.reduce((sum, service) => {
      // Price per unit * count
      return sum + (service.price * service.count);
    }, 0);
  };

  // Calculate total bundle price (products + services)
  const calculateBundlePrice = () => {
    return calculateProductTotal() + calculateServicesTotal();
  };

  // Calculate product commission for a single product
  const getProductCommission = (productId: number, productPrice: number) => {
    const baseRate = commissionData?.baseCommissionRate || 0.10;
    const spfData = commissionData?.productSPF?.find(s => s.shopifyProductId === productId);
    const spfRate = spfData?.spfPercentage || 0;
    const totalRate = baseRate + spfRate;
    return {
      baseCommission: productPrice * baseRate,
      spfCommission: productPrice * spfRate,
      totalCommission: productPrice * totalRate,
      spfRate,
      spfEndDate: spfData?.endDate,
    };
  };

  // Calculate total product commission
  const calculateProductCommission = () => {
    return selectedProducts.reduce((sum, product) => {
      const { totalCommission } = getProductCommission(product.id, parseFloat(product.price));
      return sum + totalCommission;
    }, 0);
  };

  // Calculate total trainer earnings (product commission + service revenue)
  const calculateTotalTrainerEarnings = () => {
    return calculateProductCommission() + calculateServicesTotal();
  };

  // Extract unique product types and vendors for filter dropdowns
  const uniqueProductTypes = useMemo(() => {
    if (!shopifyProducts) return [];
    const types = new Set(shopifyProducts.map(p => p.productType).filter(Boolean));
    return Array.from(types).sort();
  }, [shopifyProducts]);

  const uniqueVendors = useMemo(() => {
    if (!shopifyProducts) return [];
    const vendors = new Set(shopifyProducts.map(p => p.vendor).filter(Boolean));
    return Array.from(vendors).sort();
  }, [shopifyProducts]);

  // Filter products based on search and filters
  const filteredProducts = useMemo(() => {
    if (!shopifyProducts) return [];
    
    return shopifyProducts.filter(product => {
      // Search filter - match title, vendor, or SKU
      const searchLower = productSearch.toLowerCase();
      const matchesSearch = !productSearch || 
        product.title.toLowerCase().includes(searchLower) ||
        (product.vendor && product.vendor.toLowerCase().includes(searchLower)) ||
        (product.sku && product.sku.toLowerCase().includes(searchLower));
      
      // Product type filter
      const matchesType = productTypeFilter === "all" || product.productType === productTypeFilter;
      
      // Vendor filter
      const matchesVendor = vendorFilter === "all" || product.vendor === vendorFilter;
      
      // Stock filter
      const matchesStock = stockFilter === "all" || 
        (stockFilter === "in_stock" && product.inventory > 0) ||
        (stockFilter === "out_of_stock" && product.inventory <= 0);
      
      return matchesSearch && matchesType && matchesVendor && matchesStock;
    });
  }, [shopifyProducts, productSearch, productTypeFilter, vendorFilter, stockFilter]);

  // Auto-update price when products or services change
  useEffect(() => {
    const total = calculateBundlePrice();
    setPrice(total.toFixed(2));
  }, [selectedProducts, services]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isEditing && params.id) {
        await updateBundleMutation.mutateAsync({
          id: parseInt(params.id),
          title: title || "Untitled Bundle",
          description,
          price,
          cadence: cadence as "one_time" | "weekly" | "monthly",
          productsJson: selectedProducts.map(p => ({ id: p.id, name: p.title, price: p.price, imageUrl: p.imageUrl })),
          servicesJson: services,
          goalsJson: selectedGoals,
          suggestedGoal: suggestedGoal || undefined,
          imageSource,
        });
      } else {
        await createBundleMutation.mutateAsync({
          title: title || "Untitled Bundle",
          description,
          price,
          cadence: cadence as "one_time" | "weekly" | "monthly",
          productsJson: selectedProducts.map(p => ({ id: p.id, name: p.title, price: p.price, imageUrl: p.imageUrl })),
          servicesJson: services,
          goalsJson: selectedGoals,
          suggestedGoal: suggestedGoal || undefined,
          imageSource,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishClick = () => {
    if (!title || !price || selectedProducts.length === 0) {
      toast.error("Please fill in title, price, and select at least one product");
      return;
    }
    setShowPublishDialog(true);
  };

  const handlePublishConfirm = () => {
    setShowPublishDialog(false);
    publishMutation.mutate({
      title,
      description,
      price,
      products: selectedProducts.map(p => ({ id: p.id, name: p.title, quantity: 1 })),
    });
  };

  const isImpersonating = useIsImpersonating();

  return (
    <div className="min-h-screen bg-background">
      {/* Spacer for impersonation banner */}
      {isImpersonating && <div className="h-12" />}
      
      {/* Navigation */}
      <nav className={`border-b border-border bg-card sticky z-50 ${isImpersonating ? 'top-12' : 'top-0'}`}>
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/trainer/bundles")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Breadcrumb
              items={[
                { label: "Bundles", href: "/trainer/bundles" },
                { label: isEditing ? (title || "Edit Bundle") : "New Bundle" },
              ]}
              homeHref="/trainer"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave} disabled={isSaving || createBundleMutation.isPending}>
              {isSaving || createBundleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
            {/* Trainers submit for review - show for both new and draft bundles */}
            {user?.role !== "manager" && (
              <Button 
                variant="default" 
                onClick={handleSubmitForReviewNew} 
                disabled={isSubmitting || (!isEditing && (!title || !price || selectedProducts.length === 0))}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit for Review
              </Button>
            )}
            {/* Show status badge for pending review */}
            {isEditing && existingBundle?.status === "pending_review" && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                Pending Review
              </Badge>
            )}
            {isEditing && existingBundle?.status === "rejected" && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                Rejected - See Feedback
              </Badge>
            )}
            {/* Invite Client button for published bundles */}
            {isEditing && existingBundle?.status === "published" && (
              <Button
                variant="outline"
                onClick={() => setInviteDialogOpen(true)}
                className="border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <Mail className="h-4 w-4 mr-2" />
                Invite Client
              </Button>
            )}
            {/* Only admins can directly publish */}
            {user?.role === "manager" && (
              <Button onClick={handlePublishClick} disabled={publishMutation.isPending}>
                {publishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Publish to Shopify
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="container py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Rejection Feedback Alert */}
            {existingBundle?.status === "rejected" && existingBundle?.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-900">Bundle Rejected</h4>
                    <p className="text-sm text-red-700 mt-1">{existingBundle.rejectionReason}</p>
                    <p className="text-xs text-red-600 mt-2">Please address the feedback and resubmit for review.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Pending Review Notice */}
            {existingBundle?.status === "pending_review" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-900">Pending Review</h4>
                    <p className="text-sm text-yellow-700 mt-1">Your bundle is being reviewed by the admin team. You'll be notified once it's approved or if changes are needed.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Template Selection */}
            {!isEditing && templates && templates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Start from Template</CardTitle>
                  <CardDescription>
                    Choose a template to pre-fill your bundle with recommended settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select onValueChange={handleTemplateSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.title} - ${template.basePrice || "0"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="products">
                  Products
                  {selectedProducts.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedProducts.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Bundle Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Bundle Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Strength Week 1"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe what's included in this bundle..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                      />
                    </div>

                    {/* Goal Types - Tag Input */}
                    <div className="space-y-2">
                      <Label>Goal Types</Label>
                      <TagInput
                        value={selectedGoals}
                        onChange={setSelectedGoals}
                        suggestions={goalSuggestions}
                        placeholder="Select goals or type to add..."
                        allowCustom={true}
                        onCustomSubmit={(custom) => {
                          // Persist custom tag to database
                          createTagColorMutation.mutate({
                            tag: custom,
                            category: "goal",
                            label: custom,
                          });
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Select from suggestions or type to create a new goal type
                      </p>
                    </div>

                    {/* Price is auto-calculated - shown in summary */}
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-blue-700">Bundle Price (auto-calculated)</span>
                        <span className="text-lg font-bold text-blue-700">${price || "0.00"}</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        Price = Product Value + Service Fees
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Services Tab */}
              <TabsContent value="services" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Services</CardTitle>
                        <CardDescription>
                          Add training sessions and coaching services
                        </CardDescription>
                      </div>
                      <Button onClick={addService}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Service
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {services.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No services added yet. Click "Add Service" to get started.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {services.map((service, index) => {
                          const isTimeBased = ["per hour", "per session"].includes(service.unit);
                          const serviceInfo = serviceSuggestions.find(s => s.value === service.type);
                          const serviceColor = serviceInfo?.color || "#6b7280";
                          const serviceLabel = serviceInfo?.label || service.type;
                          
                          return (
                            <div
                              key={index}
                              className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted"
                            >
                              <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />

                              {/* Service Type - Tag style */}
                              <div className="flex-1 min-w-[200px]">
                                <TagInput
                                  value={[service.type]}
                                  onChange={(types) => {
                                    if (types.length > 0) {
                                      updateService(index, "type", types[types.length - 1]);
                                    }
                                  }}
                                  suggestions={serviceSuggestions}
                                  placeholder="Service type..."
                                  maxTags={1}
                                  allowCustom={true}
                                  onCustomSubmit={(custom) => {
                                    // Persist custom service type to database
                                    createTagColorMutation.mutate({
                                      tag: custom,
                                      category: "service",
                                      label: custom,
                                    });
                                  }}
                                />
                              </div>

                              {/* Quantity */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Qty:</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    updateService(index, "count", Math.max(1, service.count - 1))
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center font-medium text-sm">{service.count}</span>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => updateService(index, "count", service.count + 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>

                              {/* Duration - only show for time-based units */}
                              {isTimeBased && (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={service.duration}
                                    onChange={(e) =>
                                      updateService(index, "duration", parseInt(e.target.value) || 0)
                                    }
                                    className="w-16 h-8 text-sm"
                                  />
                                  <span className="text-xs text-muted-foreground">min</span>
                                </div>
                              )}

                              {/* Price and Unit */}
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  value={service.price}
                                  onChange={(e) =>
                                    updateService(index, "price", parseFloat(e.target.value) || 0)
                                  }
                                  className="w-16 h-8 text-sm"
                                  placeholder="0"
                                />
                                <Select
                                  value={service.unit}
                                  onValueChange={(v) => updateService(index, "unit", v)}
                                >
                                  <SelectTrigger className="w-28 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="per session">per session</SelectItem>
                                    <SelectItem value="per hour">per hour</SelectItem>
                                    <SelectItem value="each">each</SelectItem>
                                    <SelectItem value="per week">per week</SelectItem>
                                    <SelectItem value="per month">per month</SelectItem>
                                    <SelectItem value="flat rate">flat rate</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-red-500"
                                onClick={() => removeService(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Products Tab - Now uses real Shopify products */}
              <TabsContent value="products" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Shopify Products
                      <Badge variant="outline" className="font-normal">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        bright-express-dev
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Select real products from your Shopify store to include in this bundle
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Search and Filter Controls */}
                    <div className="space-y-4 mb-6">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search products by name, vendor, or SKU..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="pl-10 pr-10"
                        />
                        {productSearch && (
                          <button
                            onClick={() => setProductSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Filter Row */}
                      <div className="flex flex-wrap gap-3">
                        {/* Product Type Filter */}
                        <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                          <SelectTrigger className="w-[180px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Product Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {uniqueProductTypes.map(type => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {/* Vendor Filter */}
                        <Select value={vendorFilter} onValueChange={setVendorFilter}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Vendors</SelectItem>
                            {uniqueVendors.map(vendor => (
                              <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {/* Stock Filter */}
                        <Select value={stockFilter} onValueChange={setStockFilter}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Stock" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Stock</SelectItem>
                            <SelectItem value="in_stock">In Stock</SelectItem>
                            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        {/* Clear Filters Button */}
                        {(productSearch || productTypeFilter !== "all" || vendorFilter !== "all" || stockFilter !== "all") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setProductSearch("");
                              setProductTypeFilter("all");
                              setVendorFilter("all");
                              setStockFilter("all");
                            }}
                            className="text-muted-foreground"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Clear Filters
                          </Button>
                        )}
                      </div>
                      
                      {/* Results Count */}
                      <div className="text-sm text-muted-foreground">
                        Showing {filteredProducts.length} of {shopifyProducts?.length || 0} products
                        {selectedProducts.length > 0 && (
                          <span className="ml-2 text-blue-600 font-medium">
                            ({selectedProducts.length} selected)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {productsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <span className="ml-2 text-muted-foreground">Loading products...</span>
                      </div>
                    ) : filteredProducts.length > 0 ? (
                      <div className="grid md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                        {filteredProducts.map((product) => {
                          const isSelected = selectedProducts.some(p => p.id === product.id);
                          const inStock = product.inventory > 0;
                          return (
                            <div
                              key={product.id}
                              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50"
                                  : inStock
                                  ? "border-slate-200 hover:border-slate-300"
                                  : "border-slate-200 opacity-50"
                              }`}
                              onClick={() => {
                                setDetailProduct(product);
                                setDetailSheetOpen(true);
                              }}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  {product.imageUrl ? (
                                    <img
                                      src={product.imageUrl}
                                      alt={product.title}
                                      className="w-12 h-12 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div
                                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                        isSelected ? "bg-blue-100" : "bg-muted"
                                      }`}
                                    >
                                      <Package
                                        className={`h-6 w-6 ${
                                          isSelected ? "text-blue-600" : "text-muted-foreground"
                                        }`}
                                      />
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-foreground">{product.title}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {product.vendor || "No vendor"}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">${parseFloat(product.price).toFixed(2)}</span>
                                  {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                      <Check className="h-3 w-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {product.productType && (
                                  <Badge variant="outline" className="text-xs">
                                    {product.productType}
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    inStock ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {inStock ? `${product.inventory} in stock` : "Out of stock"}
                                </Badge>
                                {/* Show SPF badge if product has special commission */}
                                {(() => {
                                  const spfData = commissionData?.productSPF?.find(s => s.shopifyProductId === product.id);
                                  if (spfData && spfData.spfPercentage > 0) {
                                    return (
                                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs">
                                        +{(spfData.spfPercentage * 100).toFixed(0)}% SPF Bonus
                                      </Badge>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : shopifyProducts && shopifyProducts.length > 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No products match your search or filters.</p>
                        <Button
                          variant="link"
                          onClick={() => {
                            setProductSearch("");
                            setProductTypeFilter("all");
                            setVendorFilter("all");
                            setStockFilter("all");
                          }}
                          className="mt-2"
                        >
                          Clear all filters
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No products available from Shopify store.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Bundle Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cover Image Section - Compact */}
                <div className="p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {coverImageUrl ? (
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-900 flex-shrink-0">
                          <img
                            src={coverImageUrl}
                            alt="Bundle cover"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium">Cover Image</div>
                        <p className="text-xs text-muted-foreground">
                          {coverImageUrl 
                            ? (imageSource === "ai" ? "AI Generated" : "Custom Upload")
                            : "Will be generated upon save"
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {coverImageUrl && imageSource === "ai" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRegenerateImage}
                          disabled={regenerateImageMutation.isPending || isRegenerating}
                          className="h-8 text-xs"
                        >
                          {regenerateImageMutation.isPending || isRegenerating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><RefreshCw className="h-3 w-3 mr-1" />Regenerate</>
                          )}
                        </Button>
                      )}
                      <label>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadCoverImage}
                          disabled={uploadCoverImageMutation.isPending || isUploading}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 text-xs cursor-pointer"
                        >
                          <span>
                            {uploadCoverImageMutation.isPending || isUploading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><Upload className="h-3 w-3 mr-1" />Upload my own</>
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">Title</div>
                  <div className="font-medium">{title || "Untitled Bundle"}</div>
                </div>

                {goalType && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Goal Type</div>
                    <Badge className="capitalize">{goalType.replace("_", " ")}</Badge>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="text-sm text-muted-foreground mb-2">Services ({services.length})</div>
                  {services.length > 0 ? (
                    <div className="space-y-1">
                      {services.map((service, index) => {
                        const serviceType = serviceSuggestions.find((t) => t.value === service.type);
                        const isTimeBased = ["per hour", "per session"].includes(service.unit);
                        return (
                          <div key={index} className="text-sm flex justify-between">
                            <span>{serviceType?.label || service.type}</span>
                            <span className="text-muted-foreground">
                              {service.count}x ${service.price} {service.unit}
                              {isTimeBased && ` (${service.duration}min)`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No services added</div>
                  )}
                </div>

                <Separator />

                <div>
                  <div className="text-sm text-muted-foreground mb-2">
                    Products ({selectedProducts.length})
                  </div>
                  {selectedProducts.length > 0 ? (
                    <div className="space-y-1">
                      {selectedProducts.map((product) => (
                        <div key={product.id} className="text-sm flex justify-between">
                          <span className="truncate mr-2">{product.title}</span>
                          <span className="text-muted-foreground">${parseFloat(product.price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No products selected</div>
                  )}
                </div>

                <Separator />

                {/* Pricing Breakdown */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Product Value</span>
                    <span>${calculateProductTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Fees</span>
                    <span>${calculateServicesTotal().toFixed(2)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between">
                    <span className="font-medium">Bundle Price</span>
                    <span className="text-xl font-bold text-blue-600">
                      ${price || "0.00"}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Trainer Earnings Section */}
                <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">$</span>
                    </div>
                    <span className="font-semibold text-green-800">Your Earnings Per Sale</span>
                  </div>
                  
                  {/* Product Commissions */}
                  {selectedProducts.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <div className="text-xs font-medium text-green-700 uppercase tracking-wide">Product Commissions</div>
                      {selectedProducts.map((product) => {
                        const commission = getProductCommission(product.id, parseFloat(product.price));
                        const baseRate = commissionData?.baseCommissionRate || 0.10;
                        return (
                          <div key={product.id} className="text-sm flex justify-between items-center">
                            <div className="flex items-center gap-2 truncate mr-2">
                              <span className="truncate">{product.title}</span>
                              {commission.spfRate > 0 && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0">
                                  +{(commission.spfRate * 100).toFixed(0)}% SPF
                                </Badge>
                              )}
                            </div>
                            <span className="text-green-700 font-medium whitespace-nowrap">
                              ${commission.totalCommission.toFixed(2)}
                              <span className="text-xs text-green-600 ml-1">({((baseRate + commission.spfRate) * 100).toFixed(0)}%)</span>
                            </span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between text-sm pt-1 border-t border-green-200">
                        <span className="text-green-700">Product Commission Subtotal</span>
                        <span className="font-medium text-green-700">${calculateProductCommission().toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Service Revenue */}
                  {services.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <div className="text-xs font-medium text-green-700 uppercase tracking-wide">Service Revenue (100% yours)</div>
                      {services.map((service, index) => {
                        const serviceType = serviceSuggestions.find((t) => t.value === service.type);
                        return (
                          <div key={index} className="text-sm flex justify-between">
                            <span>{serviceType?.label || service.type} ({service.count}x)</span>
                            <span className="text-green-700 font-medium">${(service.price * service.count).toFixed(2)}</span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between text-sm pt-1 border-t border-green-200">
                        <span className="text-green-700">Service Revenue Subtotal</span>
                        <span className="font-medium text-green-700">${calculateServicesTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Total Earnings */}
                  <div className="pt-2 border-t-2 border-green-300">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-green-800">Total Earnings Per Sale</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${calculateTotalTrainerEarnings().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-600">
                    Price is automatically calculated from products and services. Payment processing (installments, credit) is handled by Shopify/Adyen.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Product Detail Sheet */}
      <ProductDetailSheet
        product={detailProduct}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        isSelected={detailProduct ? selectedProducts.some((p) => p.id === detailProduct.id) : false}
        onToggleSelect={toggleProduct}
      />

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Bundle to Shopify?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to publish <strong>"{title}"</strong> to your Shopify store.
                This will create a new product listing that customers can purchase.
              </p>
              <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Products included:</span>
                  <span className="font-medium">{selectedProducts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bundle price:</span>
                  <span className="font-medium">${price}</span>
                </div>
                <div className="flex justify-between">
                  <span>Product value:</span>
                  <span className="font-medium">${calculateProductTotal().toFixed(2)}</span>
                </div>
              </div>
              <p className="text-amber-600 text-sm">
                Once published, the bundle will be immediately available for purchase.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublishConfirm}>
              <Send className="h-4 w-4 mr-2" />
              Publish to Shopify
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Library Dialog */}
      <ImageLibraryDialog
        open={showImageLibrary}
        onOpenChange={setShowImageLibrary}
        onSelectImage={handleSelectFromLibrary}
      />

      {/* Image Cropper Dialog */}
      {imageToCrop && (
        <ImageCropper
          open={showImageCropper}
          onClose={() => {
            setShowImageCropper(false);
            setImageToCrop(null);
          }}
          imageSrc={imageToCrop}
          aspectRatio={1}
          onCropComplete={handleCropComplete}
          title="Crop Bundle Cover"
          description="Adjust the crop area to create a perfect square cover image for your bundle."
        />
      )}

      {/* Invite Client Dialog */}
      {isEditing && existingBundle && (
        <InviteBundleDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          bundleId={existingBundle.id}
          bundleTitle={existingBundle.title || title}
        />
      )}
    </div>
  );
}
