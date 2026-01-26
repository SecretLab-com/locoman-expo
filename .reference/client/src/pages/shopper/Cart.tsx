import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getLoginUrl } from "@/const";
import { AppShell } from "@/components/AppShell";
import { useCart, CartItem } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";
import {
  ShoppingCart,
  Trash2,
  Package,
  CreditCard,
  Shield,
  Truck,
  User,
  Store,
  MapPin,
  Minus,
  Plus,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const fulfillmentOptions: Record<
  CartItem["fulfillment"],
  { label: string; icon: React.ElementType; description: string }
> = {
  home_ship: { label: "Home Delivery", icon: Truck, description: "Free shipping" },
  trainer_delivery: { label: "Trainer Delivery", icon: User, description: "Pick up at session" },
  vending: { label: "Vending Pickup", icon: Store, description: "Gym vending machine" },
  cafeteria: { label: "Cafeteria Pickup", icon: MapPin, description: "Gym cafeteria" },
};

const cadenceLabels: Record<string, string> = {
  one_time: "",
  weekly: "/wk",
  monthly: "/mo",
};

export default function Cart() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { items, itemCount, subtotal, removeItem, updateQuantity, updateFulfillment, clearCart } =
    useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  const handleRemoveItem = (itemId: string) => {
    removeItem(itemId);
    toast.success("Item removed from cart");
  };

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to checkout");
      window.location.href = getLoginUrl();
      return;
    }

    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setIsCheckingOut(true);

    try {
      // For bundles with Shopify variant IDs, redirect to Shopify checkout
      const itemsWithVariants = items.filter((item) => item.shopifyVariantId);
      
      if (itemsWithVariants.length > 0) {
        // Build Shopify cart URL with all items
        // Format: /cart/variant_id:quantity,variant_id:quantity
        const cartItems = itemsWithVariants
          .map((item) => `${item.shopifyVariantId}:${item.quantity}`)
          .join(",");
        
        // Redirect to Shopify checkout
        const checkoutUrl = `https://bright-express-dev.myshopify.com/cart/${cartItems}`;
        
        // Clear cart before redirecting
        clearCart();
        
        // Open Shopify checkout in new tab
        window.open(checkoutUrl, "_blank");
        toast.success("Redirecting to Shopify checkout...");
      } else {
        // For bundles without Shopify integration, show coming soon message
        toast.info("Checkout will be available once bundles are published to Shopify");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to process checkout. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <AppShell>
      <div className="container py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Shopping Cart</h1>
          {itemCount > 0 && (
            <span className="text-sm text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
          )}
        </div>

        {items.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground mb-6">
                Browse our catalog to find the perfect wellness bundle for you
              </p>
              <Button onClick={() => setLocation("/catalog")}>Browse Bundles</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Cart items */}
            <div className="space-y-4">
              {items.map((item) => {
                const FulfillmentIcon = fulfillmentOptions[item.fulfillment]?.icon || Truck;
                return (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {/* Bundle image/icon */}
                        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-10 w-10 text-orange-300" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                              <p className="text-sm text-muted-foreground">by {item.trainer}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-red-500 flex-shrink-0"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Fulfillment selector */}
                          <div className="mt-3">
                            <Select
                              value={item.fulfillment}
                              onValueChange={(value) =>
                                updateFulfillment(item.id, value as CartItem["fulfillment"])
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <div className="flex items-center gap-2">
                                  <FulfillmentIcon className="h-3 w-3" />
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(fulfillmentOptions).map(([key, { label, icon: Icon }]) => (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-3 w-3" />
                                      {label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Quantity and price */}
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="text-lg font-semibold text-foreground">
                              ${(item.price * item.quantity).toFixed(2)}
                              {item.cadence !== "one_time" && (
                                <span className="text-sm font-normal text-muted-foreground">
                                  {cadenceLabels[item.cadence]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Order summary */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
                  <span className="font-medium">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Tax</span>
                  <span className="font-medium">${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium text-green-600">Free</span>
                </div>

                <Separator />

                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold">${total.toFixed(2)}</span>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={isCheckingOut || items.length === 0}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Checkout via Shopify
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Secure checkout
                  </div>
                  <div className="flex items-center gap-1">
                    <Truck className="h-3 w-3" />
                    Free shipping
                  </div>
                </div>
              </CardFooter>
            </Card>

            {/* Continue shopping link */}
            <div className="text-center">
              <Button variant="link" onClick={() => setLocation("/catalog")}>
                Continue Shopping
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
