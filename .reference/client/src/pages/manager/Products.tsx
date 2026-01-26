import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/AppShell";
import {
  Search,
  MoreVertical,
  Eye,
  RefreshCw,
  Package,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function ManagerProducts() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Fetch products from Shopify
  const { data: shopifyProducts, isLoading, refetch } = trpc.shopify.products.useQuery(undefined, {
    staleTime: 60000,
  });

  // Sync mutation
  const syncMutation = trpc.shopify.sync.useMutation({
    onSuccess: (result) => {
      toast.success(`Synced ${result.synced} products from Shopify`);
      refetch();
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  // Get unique product types for filter
  const productTypes = useMemo(() => {
    if (!shopifyProducts) return [];
    const types = new Set(shopifyProducts.map((p) => p.productType).filter(Boolean));
    return Array.from(types);
  }, [shopifyProducts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!shopifyProducts) return [];
    return shopifyProducts.filter((product) => {
      const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || product.productType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [shopifyProducts, searchQuery, typeFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!shopifyProducts) return { total: 0, inStock: 0, outOfStock: 0 };
    return {
      total: shopifyProducts.length,
      inStock: shopifyProducts.filter((p) => p.inventory > 0).length,
      outOfStock: shopifyProducts.filter((p) => p.inventory === 0).length,
    };
  }, [shopifyProducts]);

  const handleSync = () => {
    syncMutation.mutate();
  };

  const openInShopify = (productId: number) => {
    window.open(
      `https://bright-express-dev.myshopify.com/admin/products/${productId}`,
      "_blank"
    );
  };

  return (
    <AppShell title="Products">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Shopify Products</h1>
            <p className="text-sm text-muted-foreground">
              Real products from bright-express-dev
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncMutation.isPending} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-lg font-bold">{stats.inStock}</p>
              <p className="text-xs text-muted-foreground">In Stock</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-1">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-lg font-bold">{stats.outOfStock}</p>
              <p className="text-xs text-muted-foreground">Out</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-1">
                <ShoppingBag className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xs font-medium">Shopify</p>
              <p className="text-xs text-muted-foreground">Store</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {productTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="mt-2 text-sm text-muted-foreground">Loading products...</span>
          </div>
        )}

        {/* Products List */}
        {!isLoading && (
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="w-14 h-14 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground truncate">{product.title}</h3>
                          <p className="text-sm text-muted-foreground">{product.vendor || "No vendor"}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openInShopify(product.id)}>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View in Shopify
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocation(`/products`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View in Catalog
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {product.productType && (
                            <Badge variant="secondary" className="text-xs">
                              {product.productType}
                            </Badge>
                          )}
                          <Badge
                            className={
                              product.inventory > 0
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }
                          >
                            {product.inventory > 0 ? `${product.inventory} in stock` : "Out of stock"}
                          </Badge>
                        </div>
                        <span className="font-semibold text-foreground">
                          ${parseFloat(product.price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || typeFilter !== "all"
                ? "Try adjusting your search or filter criteria"
                : "No products available from Shopify store"}
            </p>
            {(searchQuery || typeFilter !== "all") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setTypeFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
