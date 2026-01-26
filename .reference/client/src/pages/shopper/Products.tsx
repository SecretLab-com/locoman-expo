import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Search,
  Filter,
  Loader2,
  Package,
  ExternalLink,
  ShoppingCart,
  Eye,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

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

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [selectedProduct, setSelectedProduct] = useState<ShopifyProduct | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  // Fetch products from Shopify
  const { data: shopifyProducts, isLoading } = trpc.shopify.products.useQuery(undefined, {
    staleTime: 60000, // Cache for 1 minute
  });

  // Get unique product types for filter
  const productTypes = useMemo(() => {
    if (!shopifyProducts) return [];
    const types = new Set(shopifyProducts.map((p) => p.productType).filter(Boolean));
    return Array.from(types);
  }, [shopifyProducts]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    if (!shopifyProducts) return [];

    let result = shopifyProducts.filter((product) => {
      const matchesSearch =
        product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        selectedType === "all" || product.productType === selectedType;
      return matchesSearch && matchesType;
    });

    // Sort
    if (sortBy === "price_low") {
      result = [...result].sort(
        (a, b) => parseFloat(a.price) - parseFloat(b.price)
      );
    } else if (sortBy === "price_high") {
      result = [...result].sort(
        (a, b) => parseFloat(b.price) - parseFloat(a.price)
      );
    } else if (sortBy === "name") {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [shopifyProducts, searchQuery, selectedType, sortBy]);

  // Handle checkout
  const handleBuyNow = (variantId: number) => {
    const checkoutUrl = `https://bright-express-dev.myshopify.com/cart/${variantId}:1`;
    window.open(checkoutUrl, "_blank");
  };

  // Open product detail
  const openProductDetail = (product: ShopifyProduct) => {
    setSelectedProduct(product);
    setDetailSheetOpen(true);
  };

  // Strip HTML tags from description
  const stripHtml = (html: string | null) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "");
  };

  return (
    <AppShell title="Products">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Product Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Browse wellness products from our Shopify store
          </p>
          <Badge variant="outline" className="mt-2">
            <Package className="h-3 w-3 mr-1" />
            Powered by Shopify
          </Badge>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="flex-1">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {productTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="mt-2 text-sm text-muted-foreground">Loading products...</span>
          </div>
        )}

        {/* Results count */}
        {!isLoading && (
          <div className="text-sm text-muted-foreground mb-4">
            Showing {filteredProducts.length} product
            {filteredProducts.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* Product Grid */}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => {
              const price = parseFloat(product.price);
              const inStock = product.inventory > 0;

              return (
                <Card
                  key={product.id}
                  className="group hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
                  onClick={() => openProductDetail(product)}
                >
                  {/* Image */}
                  <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden relative">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-muted-foreground/50" />
                    )}
                    {/* Quick view overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white rounded-full p-2">
                        <Eye className="h-5 w-5 text-foreground" />
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-3">
                    {product.productType && (
                      <Badge variant="secondary" className="text-xs mb-1">
                        {product.productType}
                      </Badge>
                    )}
                    <div className="text-lg font-bold text-foreground">
                      ${price.toFixed(2)}
                    </div>
                    <h3 className="text-sm font-medium text-foreground line-clamp-2 mt-1">
                      {product.title}
                    </h3>

                    {/* Stock status */}
                    <div className="flex items-center gap-1 mt-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          inStock ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <span
                        className={`text-xs ${
                          inStock ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {inStock ? `${product.inventory} in stock` : "Out of stock"}
                      </span>
                    </div>

                    {/* Vendor */}
                    {product.vendor && (
                      <div className="text-xs text-muted-foreground mt-1">
                        by {product.vendor}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="p-3 pt-0">
                    <Button
                      className="w-full"
                      size="sm"
                      disabled={!inStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBuyNow(product.variantId);
                      }}
                    >
                      {inStock ? "Buy Now" : "Sold Out"}
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No products found
            </h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search or filter criteria
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setSelectedType("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {/* Product Detail Sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedProduct && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="text-xl">{selectedProduct.title}</SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {selectedProduct.vendor}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Product Image */}
                <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  {selectedProduct.imageUrl ? (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                {/* Price and Status */}
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-foreground">
                    ${parseFloat(selectedProduct.price).toFixed(2)}
                  </span>
                  <Badge
                    variant={selectedProduct.inventory <= 0 ? "secondary" : "default"}
                    className={
                      selectedProduct.inventory <= 0
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }
                  >
                    {selectedProduct.inventory <= 0
                      ? "Out of stock"
                      : `${selectedProduct.inventory} in stock`}
                  </Badge>
                </div>

                <Separator />

                {/* Product Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Product Details</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Product Type</p>
                      <p className="font-medium text-foreground">
                        {selectedProduct.productType || "General"}
                      </p>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Vendor</p>
                      <p className="font-medium text-foreground">{selectedProduct.vendor}</p>
                    </div>

                    {selectedProduct.sku && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">SKU</p>
                        <p className="font-medium text-foreground">{selectedProduct.sku}</p>
                      </div>
                    )}

                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Inventory</p>
                      <p className="font-medium text-foreground">
                        {selectedProduct.inventory > 0
                          ? `${selectedProduct.inventory} units`
                          : "Out of stock"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {selectedProduct.description && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-foreground">Description</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {stripHtml(selectedProduct.description)}
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                {/* Action Buttons */}
                <div className="space-y-3 pt-2">
                  <Button
                    className="w-full h-12 text-base"
                    disabled={selectedProduct.inventory <= 0}
                    onClick={() => {
                      handleBuyNow(selectedProduct.variantId);
                      setDetailSheetOpen(false);
                    }}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    {selectedProduct.inventory > 0 ? "Buy Now" : "Out of Stock"}
                  </Button>

                  {selectedProduct.inventory <= 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                      This product is currently out of stock
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
