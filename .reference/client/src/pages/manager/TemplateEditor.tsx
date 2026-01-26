
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  Save,
  Package,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Check,
  Heart,
  Dumbbell,
  Award,
  Zap,
  Target,
  Calendar,
  Phone,
  ClipboardList,
  Video,
  RefreshCw,
  ImageIcon,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { ProductDetailSheet } from "@/components/ProductDetailSheet";
import { TagInput } from "@/components/TagInput";
import { useGoalTagColors, useServiceTagColors, useCreateTagColor } from "@/hooks/useTagColors";

const serviceTypes = [
  { value: "training", label: "Personal Training", icon: Dumbbell, defaultDuration: 60 },
  { value: "check_in", label: "Check-in Call", icon: Phone, defaultDuration: 15 },
  { value: "plan_review", label: "Plan Review", icon: ClipboardList, defaultDuration: 30 },
  { value: "call", label: "Coaching Call", icon: Video, defaultDuration: 30 },
];

// Goal types are now loaded from database via useGoalTagColors hook

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

interface ServiceItem {
  type: string;
  count: number;
  duration: number;
}

export default function TemplateEditor() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const isEditing = !!params.id;
  const templateId = params.id ? parseInt(params.id) : null;

  const [activeTab, setActiveTab] = useState("details");
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  // Fetch goal and service tag colors from database
  const { suggestions: goalSuggestions } = useGoalTagColors();
  const { suggestions: serviceSuggestions } = useServiceTagColors();
  const createTagColorMutation = useCreateTagColor();

  // Selected service types (tag-based)
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);

  // Services state
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Products state
  const [selectedProducts, setSelectedProducts] = useState<ShopifyProduct[]>([]);
  const [detailProduct, setDetailProduct] = useState<ShopifyProduct | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const utils = trpc.useUtils();

  // Regenerate image state
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Fetch existing template if editing
  const { data: existingTemplate, isLoading: templateLoading, refetch: refetchTemplate } = trpc.templates.get.useQuery(
    { id: templateId! },
    { enabled: !!templateId }
  );

  // Regenerate image mutation
  const regenerateImage = trpc.templates.regenerateImage.useMutation({
    onSuccess: () => {
      toast.success("Cover image regenerated!");
      refetchTemplate();
      setIsRegenerating(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to regenerate image");
      setIsRegenerating(false);
    },
  });

  const handleRegenerateImage = () => {
    if (!templateId) return;
    setIsRegenerating(true);
    regenerateImage.mutate({ id: templateId });
  };

  // Fetch Shopify products
  const { data: shopifyProducts, isLoading: productsLoading } = trpc.shopify.products.useQuery(undefined, {
    staleTime: 60000,
  });

  // Create mutation
  const createMutation = trpc.templates.create.useMutation({
    onSuccess: () => {
      toast.success("Template created successfully");
      utils.templates.list.invalidate();
      setLocation("/manager/templates");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create template");
    },
  });

  // Update mutation
  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => {
      toast.success("Template updated successfully");
      utils.templates.list.invalidate();
      setLocation("/manager/templates");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update template");
    },
  });

  // Load existing template data
  useEffect(() => {
    if (existingTemplate) {
      setTitle(existingTemplate.title);
      setDescription(existingTemplate.description || "");
      // Load goals - support both old goalType field and new goalsJson array
      if (existingTemplate.goalsJson && Array.isArray(existingTemplate.goalsJson)) {
        setSelectedGoals(existingTemplate.goalsJson as string[]);
      } else if (existingTemplate.goalType) {
        setSelectedGoals([existingTemplate.goalType]);
      }
      
      // Load services
      if (existingTemplate.defaultServices && Array.isArray(existingTemplate.defaultServices)) {
        const loadedServices = existingTemplate.defaultServices as ServiceItem[];
        setServices(loadedServices);
        // Also set selectedServiceTypes from the loaded services
        setSelectedServiceTypes(loadedServices.map((s) => s.type));
      }
      
      // Load products
      if (existingTemplate.defaultProducts && Array.isArray(existingTemplate.defaultProducts)) {
        setSelectedProducts(existingTemplate.defaultProducts as ShopifyProduct[]);
      }
    }
  }, [existingTemplate]);

  // Add service
  const addService = (type: string) => {
    const serviceType = serviceTypes.find((s) => s.value === type);
    if (!serviceType) return;

    const existing = services.find((s) => s.type === type);
    if (existing) {
      setServices(services.map((s) => (s.type === type ? { ...s, count: s.count + 1 } : s)));
    } else {
      setServices([...services, { type, count: 1, duration: serviceType.defaultDuration }]);
    }
  };

  // Update service count
  const updateServiceCount = (type: string, delta: number) => {
    setServices(
      services
        .map((s) => (s.type === type ? { ...s, count: Math.max(0, s.count + delta) } : s))
        .filter((s) => s.count > 0)
    );
  };

  // Remove service
  const removeService = (type: string) => {
    setServices(services.filter((s) => s.type !== type));
  };

  // Toggle product selection
  const toggleProduct = (product: ShopifyProduct) => {
    const isSelected = selectedProducts.some((p) => p.id === product.id);
    if (isSelected) {
      setSelectedProducts(selectedProducts.filter((p) => p.id !== product.id));
    } else {
      setSelectedProducts([...selectedProducts, product]);
    }
  };

  // Calculate totals
  const productValue = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + parseFloat(p.price || "0"), 0);
  }, [selectedProducts]);

  const serviceCount = useMemo(() => {
    return services.reduce((sum, s) => sum + s.count, 0);
  }, [services]);

  // Save template
  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Please enter a template title");
      setActiveTab("details");
      return;
    }
    if (selectedGoals.length === 0) {
      toast.error("Please select at least one goal type");
      setActiveTab("details");
      return;
    }

    setIsSaving(true);

    // Calculate base price automatically from products
    const calculatedBasePrice = selectedProducts.reduce((sum, p) => sum + parseFloat(p.price || "0"), 0);

    // Use first goal as primary goalType for backwards compatibility
    const primaryGoal = selectedGoals[0] as "weight_loss" | "strength" | "longevity" | "power" | undefined;

    const templateData = {
      title,
      description: description || undefined,
      goalType: primaryGoal,
      goalsJson: selectedGoals,
      basePrice: calculatedBasePrice.toFixed(2),
      minPrice: undefined,
      maxPrice: undefined,
      defaultServices: services,
      defaultProducts: selectedProducts,
    };

    if (isEditing && templateId) {
      updateMutation.mutate({ id: templateId, ...templateData });
    } else {
      createMutation.mutate(templateData);
    }
  };

  // Get goal color from suggestions
  const getGoalColor = (type: string) => {
    const suggestion = goalSuggestions.find((g) => g.value === type);
    return suggestion?.color || "#6b7280";
  };

  if (templateLoading) {
    return (
      <AppShell title={isEditing ? "Edit Template" : "New Template"}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={isEditing ? "Edit Template" : "New Template"}>
      <div className="container py-4 pb-24">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/templates")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">
              {isEditing ? "Edit Template" : "Create Template"}
            </h1>
          </div>
          <Button onClick={handleSave} disabled={isSaving || createMutation.isPending || updateMutation.isPending}>
            {(isSaving || createMutation.isPending || updateMutation.isPending) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>

        {/* Large Cover Image Hero */}
        <Card className="mb-6 overflow-hidden">
          <div className="relative aspect-[21/9] bg-slate-900 max-h-[50vh] overflow-y-auto">
            {existingTemplate?.imageUrl ? (
              <>
                <img
                  src={existingTemplate.imageUrl}
                  alt={title || "Template cover"}
                  className="w-full h-full object-cover"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                
                {/* Regenerate button */}
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white border-0 backdrop-blur-sm"
                  onClick={handleRegenerateImage}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate Cover
                    </>
                  )}
                </Button>
                
                {/* Title overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h2 className="text-2xl font-bold text-white mb-1">
                    {title || "Untitled Template"}
                  </h2>
                  {selectedGoals.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedGoals.map((goal) => (
                        <span
                          key={goal}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white/90 capitalize"
                          style={{ backgroundColor: getGoalColor(goal) + "80" }}
                        >
                          {goal.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                {selectedProducts.length > 0 ? (
                  <>
                    {/* Product preview grid */}
                    <div className="grid grid-cols-4 gap-2 mb-4 max-w-xs">
                      {selectedProducts.slice(0, 4).map((p, i) => (
                        <div key={i} className="aspect-square bg-slate-800 rounded-lg overflow-hidden">
                          {p.imageUrl && (
                            <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">AI cover will be generated on save</p>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-12 w-12 mb-2" />
                    <p className="text-sm">Add products to generate a cover image</p>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="products">
              Products {selectedProducts.length > 0 && `(${selectedProducts.length})`}
            </TabsTrigger>
            <TabsTrigger value="services">
              Services {serviceCount > 0 && `(${serviceCount})`}
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Template Information</CardTitle>
                <CardDescription>Basic details about this bundle template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Template Name *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Strength Builder Pro"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this template is for and who it's best suited for..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Goal Types - Tag Input */}
                <div className="space-y-2">
                  <Label>Goal Types *</Label>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Automatic Pricing</CardTitle>
                <CardDescription>Price is calculated from selected products</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Calculated Bundle Price</p>
                    <p className="text-3xl font-bold text-foreground">
                      ${productValue.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""}</p>
                    <p className="text-sm text-muted-foreground">{serviceCount} service{serviceCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Bundle price is automatically calculated from the total value of selected products. Trainers cannot modify pricing.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Default Products</CardTitle>
                <CardDescription>
                  Select products from your Shopify catalog to include by default
                </CardDescription>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : !shopifyProducts || shopifyProducts.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">No products available</p>
                    <p className="text-sm text-muted-foreground">Sync products from your Shopify store first</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shopifyProducts.map((product: ShopifyProduct) => {
                      const isSelected = selectedProducts.some((p) => p.id === product.id);
                      const isOutOfStock = product.inventory <= 0;

                      return (
                        <div
                          key={product.id}
                          onClick={() => {
                            setDetailProduct(product);
                            setDetailSheetOpen(true);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : isOutOfStock
                              ? "border-slate-200 bg-muted/50 opacity-50 cursor-not-allowed"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.title}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate">{product.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {product.vendor} • ${parseFloat(product.price).toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isOutOfStock ? (
                              <Badge variant="outline" className="text-red-600 border-red-200">
                                Out of stock
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                {product.inventory} in stock
                              </Badge>
                            )}
                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Selected Products ({selectedProducts.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="w-8 h-8 rounded object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-sm font-medium">{product.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">${parseFloat(product.price).toFixed(2)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleProduct(product)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Product Value</span>
                    <span className="font-semibold">${productValue.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Service Types</CardTitle>
                <CardDescription>
                  Select the types of services to include in this template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Service Type Tag Input */}
                <div className="space-y-2">
                  <Label>Service Types</Label>
                  <TagInput
                    value={selectedServiceTypes}
                    onChange={(newTypes) => {
                      setSelectedServiceTypes(newTypes);
                      // Add new service types to services list
                      newTypes.forEach((type) => {
                        if (!services.find((s) => s.type === type)) {
                          const suggestion = serviceSuggestions.find((s) => s.value === type);
                          setServices((prev) => [
                            ...prev,
                            { type, count: 1, duration: 30 },
                          ]);
                        }
                      });
                      // Remove service types that were deselected
                      setServices((prev) =>
                        prev.filter((s) => newTypes.includes(s.type))
                      );
                    }}
                    suggestions={serviceSuggestions}
                    placeholder="Select services or type to add..."
                    allowCustom={true}
                    onCustomSubmit={(custom) => {
                      createTagColorMutation.mutate({
                        tag: custom,
                        category: "service",
                        label: custom,
                      });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Select from suggestions or type to create a new service type
                  </p>
                </div>
              </CardContent>
            </Card>

            {services.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Included Services ({serviceCount})</CardTitle>
                  <CardDescription>Adjust quantities and duration for each service type</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {services.map((service) => {
                    const serviceSuggestion = serviceSuggestions.find((s) => s.value === service.type);
                    const serviceLabel = serviceSuggestion?.label || service.type.replace(/_/g, " ");
                    const serviceColor = serviceSuggestion?.color || "#6b7280";

                    return (
                      <div
                        key={service.type}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: serviceColor + "20" }}
                          >
                            <Dumbbell className="h-5 w-5" style={{ color: serviceColor }} />
                          </div>
                          <div>
                            <div className="font-medium text-foreground capitalize">{serviceLabel}</div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="5"
                                max="180"
                                step="5"
                                value={service.duration}
                                onChange={(e) => {
                                  const newDuration = parseInt(e.target.value) || 30;
                                  setServices((prev) =>
                                    prev.map((s) =>
                                      s.type === service.type ? { ...s, duration: newDuration } : s
                                    )
                                  );
                                }}
                                className="w-16 h-6 text-xs px-2"
                              />
                              <span className="text-sm text-muted-foreground">min each</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateServiceCount(service.type, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-medium">{service.count}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateServiceCount(service.type, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => {
                              removeService(service.type);
                              setSelectedServiceTypes((prev) =>
                                prev.filter((t) => t !== service.type)
                              );
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Summary Card - Fixed at bottom */}
        <Card className="fixed bottom-20 left-4 right-4 shadow-lg border-slate-200 z-40">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Cover Image Preview */}
                {existingTemplate?.imageUrl ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-900 flex-shrink-0">
                    <img
                      src={existingTemplate.imageUrl}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : selectedProducts.length > 0 ? (
                  <div className="w-10 h-10 rounded-lg bg-slate-900 flex-shrink-0 grid grid-cols-2 gap-0.5 p-0.5 overflow-hidden">
                    {selectedProducts.slice(0, 4).map((p, i) => (
                      <div key={i} className="bg-slate-800 rounded-sm overflow-hidden">
                        {p.imageUrl && (
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-4 text-sm">
                  {selectedGoals.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {selectedGoals.map((goal) => (
                        <span
                          key={goal}
                          className="inline-flex items-center text-xs px-2 py-0.5 rounded-full capitalize"
                          style={{ backgroundColor: getGoalColor(goal) + "20", color: getGoalColor(goal) }}
                        >
                          {goal.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{selectedProducts.length} products</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{serviceCount} services</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {productValue > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Value: </span>
                    <span className="font-semibold text-foreground">${productValue.toFixed(2)}</span>
                  </div>
                )}
                {selectedProducts.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    AI cover on save
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Detail Sheet */}
      <ProductDetailSheet
        product={detailProduct}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        isSelected={detailProduct ? selectedProducts.some((p) => p.id === detailProduct.id) : false}
        onToggleSelect={toggleProduct}
      />
    </AppShell>
  );
}
