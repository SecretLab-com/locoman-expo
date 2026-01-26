import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Check,
  Plus,
  Minus,
  Store,
  Tag,
  Barcode,
  Box,
  X,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

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

interface ProductDetailSheetProps {
  product: ShopifyProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSelected: boolean;
  onToggleSelect: (product: ShopifyProduct) => void;
}

export function ProductDetailSheet({
  product,
  open,
  onOpenChange,
  isSelected,
  onToggleSelect,
}: ProductDetailSheetProps) {
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchCurrentY = useRef<number>(0);

  // Reset confirm state when sheet closes
  useEffect(() => {
    if (!open) {
      setShowConfirmRemove(false);
    }
  }, [open]);

  // Handle swipe to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const swipeDistance = touchCurrentY.current - touchStartY.current;
    // If swiped down more than 100px, close the sheet
    if (swipeDistance > 100) {
      onOpenChange(false);
    }
    touchStartY.current = 0;
    touchCurrentY.current = 0;
  };

  if (!product) return null;

  const isOutOfStock = product.inventory <= 0 && product.status !== "active";
  const price = parseFloat(product.price || "0");

  const handleRemoveClick = () => {
    if (isSelected) {
      setShowConfirmRemove(true);
    }
  };

  const handleConfirmRemove = () => {
    onToggleSelect(product);
    setShowConfirmRemove(false);
    onOpenChange(false); // Close sheet after removing
  };

  const handleCancelRemove = () => {
    setShowConfirmRemove(false);
  };

  const handleAddClick = () => {
    onToggleSelect(product);
    onOpenChange(false); // Close sheet after adding
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-full sm:max-w-lg overflow-y-auto px-6 pb-8"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        ref={contentRef}
      >
        {/* Swipe indicator */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <SheetHeader className="text-left">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-xl">{product.title}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                {product.vendor}
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2 -mt-1"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Product Image */}
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted shadow-sm">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
            {isSelected && (
              <div className="absolute top-3 right-3 bg-blue-600 text-white rounded-full p-1.5">
                <Check className="h-4 w-4" />
              </div>
            )}
          </div>

          {/* Price and Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-foreground">
                ${price.toFixed(2)}
              </span>
            </div>
            <Badge
              variant={isOutOfStock ? "secondary" : "default"}
              className={
                isOutOfStock
                  ? "bg-red-100 text-red-700"
                  : "bg-green-100 text-green-700"
              }
            >
              {isOutOfStock ? "Out of stock" : `${product.inventory} in stock`}
            </Badge>
          </div>

          <Separator />

          {/* Product Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Product Details</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
                <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Product Type</p>
                  <p className="font-medium text-foreground">
                    {product.productType || "General"}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
                <Store className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Vendor</p>
                  <p className="font-medium text-foreground">{product.vendor}</p>
                </div>
              </div>
              
              {product.sku && (
                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
                  <Barcode className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">SKU</p>
                    <p className="font-medium text-foreground">{product.sku}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
                <Box className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Inventory</p>
                  <p className="font-medium text-foreground">
                    {product.inventory > 0 ? `${product.inventory} units` : "Out of stock"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">Description</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {product.description}
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="pt-4 pb-2 space-y-3">
            {showConfirmRemove ? (
              // Confirmation UI for removal
              <div className="space-y-3">
                <p className="text-center text-muted-foreground font-medium">
                  Remove "{product.title}" from bundle?
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12"
                    onClick={handleCancelRemove}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 h-12"
                    onClick={handleConfirmRemove}
                  >
                    <Minus className="h-5 w-5 mr-2" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : isSelected ? (
              // Already selected - show remove option
              <div className="space-y-3">
                <Button
                  className="w-full h-12 text-base"
                  variant="outline"
                  onClick={handleRemoveClick}
                >
                  <Minus className="h-5 w-5 mr-2" />
                  Remove from Bundle
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-10 text-muted-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  Keep in Bundle
                </Button>
              </div>
            ) : (
              // Not selected - show add option
              <div className="space-y-3">
                <Button
                  className="w-full h-12 text-base"
                  variant="default"
                  disabled={isOutOfStock}
                  onClick={handleAddClick}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add to Bundle
                </Button>
                <Button
                  variant="ghost"
                  className="w-full h-10 text-muted-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
            
            {isOutOfStock && !isSelected && (
              <p className="text-center text-sm text-muted-foreground mt-2">
                This product is currently out of stock
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
