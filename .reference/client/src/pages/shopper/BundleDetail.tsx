import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useCart, CartItem } from "@/contexts/CartContext";
import {
  Dumbbell,
  Heart,
  Zap,
  Award,
  Target,
  User,
  ChevronLeft,
  Check,
  Package,
  Calendar,
  Truck,
  Store,
  MapPin,
  Loader2,
  ShoppingCart,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ImageViewer } from "@/components/ImageViewer";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/Breadcrumb";

const goalIcons: Record<string, React.ElementType> = {
  weight_loss: Heart,
  strength: Dumbbell,
  longevity: Award,
  power: Zap,
};

const fulfillmentLabels: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  home_ship: { label: "Home Delivery", icon: Truck, description: "Free shipping to your address" },
  trainer_delivery: { label: "Trainer Delivery", icon: User, description: "Pick up at your next session" },
  vending: { label: "Vending Pickup", icon: Store, description: "Collect from gym vending machine" },
  cafeteria: { label: "Cafeteria Pickup", icon: MapPin, description: "Pick up at gym cafeteria" },
};

export default function BundleDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const bundleId = parseInt(params.id || "0");
  const [selectedFulfillment, setSelectedFulfillment] = useState<CartItem["fulfillment"]>("home_ship");
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  
  const { addItem, isInCart } = useCart();
  const alreadyInCart = isInCart(bundleId);
  
  // Image lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Fetch bundle details from API
  const { data: bundleData, isLoading } = trpc.catalog.bundleDetail.useQuery(
    { id: bundleId },
    { enabled: bundleId > 0 }
  );

  const handleAddToCart = async () => {
    if (!bundleData) return;
    
    if (alreadyInCart) {
      setLocation("/cart");
      return;
    }

    setIsAddingToCart(true);
    
    // Small delay for UX feedback
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const price = parseFloat(bundleData.price || "0");
    
    addItem({
      bundleId: bundleData.id,
      title: bundleData.title,
      trainer: "Trainer", // Would come from trainer data in production
      trainerId: bundleData.trainerId,
      price,
      cadence: (bundleData.cadence as CartItem["cadence"]) || "monthly",
      fulfillment: selectedFulfillment,
      quantity: 1,
      imageUrl: bundleData.imageUrl || undefined,
      // Shopify IDs would come from bundle publication if published
      shopifyVariantId: undefined,
      shopifyProductId: undefined,
    });
    
    setIsAddingToCart(false);
    toast.success("Bundle added to cart!");
  };

  if (isLoading) {
    return (
      <AppShell title="Bundle Details">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  if (!bundleData) {
    return (
      <AppShell title="Bundle Details">
        <div className="container py-8 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Bundle not found</h2>
          <p className="text-muted-foreground mb-4">This bundle may have been removed or doesn't exist.</p>
          <Button onClick={() => setLocation("/catalog")}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Catalog
          </Button>
        </div>
      </AppShell>
    );
  }

  const bundle = bundleData;
  const goalType = "strength"; // Default since we don't have template data here
  const GoalIcon = goalIcons[goalType] || Target;
  const price = parseFloat(bundle.price || "0");
  
  // Parse services and products from JSON
  const services = (bundle.servicesJson as Array<{ type: string; count: number }>) || [];
  const products = (bundle.productsJson as Array<{ shopifyProductId: string; title: string; price: number; imageUrl?: string; quantity?: number }>) || [];

  return (
    <AppShell title={bundle.title}>
      <div className="container py-4 pb-24">
        {/* Breadcrumb Navigation */}
        <Breadcrumb
          items={[
            { label: "Catalog", href: "/catalog" },
            { label: bundle.title },
          ]}
          homeHref="/"
          className="mb-4"
        />

        {/* Bundle header */}
        <Card className="mb-4 overflow-hidden">
          <div 
            className={`w-full max-h-[500px] min-h-[200px] flex items-center justify-center p-4 ${bundle.imageUrl ? 'bg-black cursor-pointer hover:opacity-90 transition-opacity' : 'bg-gradient-to-br from-orange-100 to-red-100'}`}
            onClick={() => {
              if (bundle.imageUrl) {
                setLightboxImages([bundle.imageUrl]);
                setLightboxIndex(0);
                setLightboxOpen(true);
              }
            }}
          >
            {bundle.imageUrl ? (
              <img 
                src={bundle.imageUrl} 
                alt={bundle.title} 
                className="max-w-full max-h-[468px] object-contain" 
              />
            ) : (
              <GoalIcon className="h-16 w-16 text-orange-300" />
            )}
          </div>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-orange-100 text-orange-700">
                <GoalIcon className="h-3 w-3 mr-1" />
                {goalType.replace("_", " ")}
              </Badge>
              <Badge variant="outline">{bundle.cadence || "monthly"}</Badge>
              {alreadyInCart && (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  In Cart
                </Badge>
              )}
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">{bundle.title}</h1>
            <p className="text-muted-foreground text-sm">{bundle.description}</p>
          </CardContent>
        </Card>

        {/* Services */}
        {services.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Services Included
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {services.map((service, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-foreground">{service.type}</div>
                      <div className="text-xs text-muted-foreground">{service.count}x included</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products */}
        {products.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-green-600" />
                Products Included
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {products.map((product, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div 
                      className={`w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden ${product.imageUrl ? 'cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all' : ''}`}
                      onClick={() => {
                        if (product.imageUrl) {
                          const productImages = products
                            .filter(p => p.imageUrl)
                            .map(p => p.imageUrl as string);
                          const clickedIndex = productImages.indexOf(product.imageUrl);
                          setLightboxImages(productImages);
                          setLightboxIndex(clickedIndex >= 0 ? clickedIndex : 0);
                          setLightboxOpen(true);
                        }
                      }}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-foreground">{product.title}</div>
                      <div className="text-xs text-muted-foreground">
                        ${Number(product.price || 0).toFixed(2)}
                        {product.quantity && product.quantity > 1 && (
                          <span className="ml-1">× {product.quantity}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fulfillment Options */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Delivery Method</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedFulfillment} onValueChange={(v) => setSelectedFulfillment(v as CartItem["fulfillment"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(fulfillmentLabels).map(([key, { label, description }]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Purchase Card - Fixed at bottom */}
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-card border-t shadow-lg">
          <div className="container max-w-lg mx-auto flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">
                ${price.toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">
                  /{bundle.cadence || "month"}
                </span>
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleAddToCart}
              disabled={isAddingToCart}
              className="gap-2"
              variant={alreadyInCart ? "outline" : "default"}
            >
              {isAddingToCart ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : alreadyInCart ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  View Cart
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Product Image Lightbox */}
      <ImageViewer
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        alt="Product"
      />
    </AppShell>
  );
}
