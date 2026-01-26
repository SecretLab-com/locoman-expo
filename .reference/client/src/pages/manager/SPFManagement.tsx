import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Percent, 
  Plus, 
  Search, 
  Calendar,
  Package,
  Trash2,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Award
} from "lucide-react";

interface SPFPromotion {
  id: number;
  shopifyProductId: number;
  productTitle: string;
  productImage?: string;
  spfPercentage: number;
  startDate: string;
  endDate?: string;
  status: "active" | "upcoming" | "expired";
}

export default function SPFManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<{
    id: string;
    title: string;
    image?: string;
  } | null>(null);
  const [spfPercentage, setSpfPercentage] = useState("10");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<SPFPromotion | null>(null);
  
  // Fetch products for search
  const { data: products } = trpc.products.list.useQuery();
  
  // Fetch all SPF promotions
  const { data: allSPFs } = trpc.commission.getAllSPF.useQuery();
  
  // Fetch base commission rate
  const { data: baseRate } = trpc.bundles.getBaseCommissionRate.useQuery();
  
  // Mutations
  const setSPFMutation = trpc.commission.setSPF.useMutation({
    onSuccess: () => {
      toast.success("SPF promotion saved successfully");
      utils.commission.getAllSPF.invalidate();
      setIsCreateDialogOpen(false);
      setEditingPromotion(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Error saving SPF: ${error.message}`);
    },
  });
  
  const deleteSPFMutation = trpc.commission.deleteSPF.useMutation({
    onSuccess: () => {
      toast.success("SPF promotion deleted");
      utils.commission.getAllSPF.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(`Error deleting SPF: ${error.message}`);
    },
  });
  
  const setBaseRateMutation = trpc.commission.setBaseRate.useMutation({
    onSuccess: () => {
      toast.success("Base commission rate updated");
      utils.bundles.getBaseCommissionRate.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(`Error updating base rate: ${error.message}`);
    },
  });
  
  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!products || !searchQuery) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);
  }, [products, searchQuery]);
  
  // Categorize SPF promotions
  const categorizedSPFs = useMemo(() => {
    if (!allSPFs) return { active: [], upcoming: [], expired: [] };
    
    const now = new Date();
    const active: SPFPromotion[] = [];
    const upcoming: SPFPromotion[] = [];
    const expired: SPFPromotion[] = [];
    
    for (const spf of allSPFs) {
      const start = spf.startDate ? new Date(spf.startDate) : new Date();
      const end = spf.endDate ? new Date(spf.endDate) : null;
      
      // Find product info
      const product = products?.find(p => p.shopifyProductId === spf.shopifyProductId);
      
      const promotion: SPFPromotion = {
        id: spf.id,
        shopifyProductId: spf.shopifyProductId,
        productTitle: product?.name || String(spf.shopifyProductId),
        productImage: product?.imageUrl || undefined,
        spfPercentage: Number(spf.spfPercentage),
        startDate: spf.startDate ? new Date(spf.startDate).toISOString() : new Date().toISOString(),
        endDate: spf.endDate?.toISOString(),
        status: "active",
      };
      
      if (start > now) {
        promotion.status = "upcoming";
        upcoming.push(promotion);
      } else if (end && end < now) {
        promotion.status = "expired";
        expired.push(promotion);
      } else {
        promotion.status = "active";
        active.push(promotion);
      }
    }
    
    return { active, upcoming, expired };
  }, [allSPFs, products]);
  
  const resetForm = () => {
    setSelectedProduct(null);
    setSpfPercentage("10");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setSearchQuery("");
  };
  
  const handleSaveSPF = () => {
    if (!selectedProduct) {
      toast.error("Please select a product");
      return;
    }
    
    setSPFMutation.mutate({
      shopifyProductId: parseInt(selectedProduct.id),
      spfPercentage: parseFloat(spfPercentage),
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
    });
  };
  
  const handleEditPromotion = (promotion: SPFPromotion) => {
    setEditingPromotion(promotion);
    setSelectedProduct({
      id: String(promotion.shopifyProductId),
      title: promotion.productTitle,
      image: promotion.productImage,
    });
    setSpfPercentage(promotion.spfPercentage.toString());
    setStartDate(promotion.startDate.split("T")[0]);
    setEndDate(promotion.endDate ? promotion.endDate.split("T")[0] : "");
    setIsCreateDialogOpen(true);
  };
  
  const handleDeletePromotion = (id: number) => {
    if (confirm("Are you sure you want to delete this SPF promotion?")) {
      deleteSPFMutation.mutate({ id });
    }
  };
  
  if (!user || (user.role !== "manager" && user.role !== "coordinator")) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Manager access required</p>
        </div>
      </DashboardLayout>
    );
  }
  
  const PromotionCard = ({ promotion }: { promotion: SPFPromotion }) => (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {promotion.productImage ? (
            <img 
              src={promotion.productImage} 
              alt={promotion.productTitle}
              className="w-16 h-16 object-cover rounded-lg bg-muted"
            />
          ) : (
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-medium truncate">{promotion.productTitle}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant={
                      promotion.status === "active" ? "default" :
                      promotion.status === "upcoming" ? "secondary" : "outline"
                    }
                    className={
                      promotion.status === "active" ? "bg-green-500" :
                      promotion.status === "upcoming" ? "bg-blue-500" : ""
                    }
                  >
                    {promotion.status === "active" && <CheckCircle className="w-3 h-3 mr-1" />}
                    {promotion.status === "upcoming" && <Clock className="w-3 h-3 mr-1" />}
                    {promotion.status === "expired" && <XCircle className="w-3 h-3 mr-1" />}
                    {promotion.status}
                  </Badge>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    <Percent className="w-3 h-3 mr-1" />
                    +{promotion.spfPercentage}% SPF
                  </Badge>
                </div>
              </div>
              
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleEditPromotion(promotion)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleDeletePromotion(promotion.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(promotion.startDate).toLocaleDateString()}
              </span>
              {promotion.endDate && (
                <span>→ {new Date(promotion.endDate).toLocaleDateString()}</span>
              )}
              {!promotion.endDate && (
                <span className="text-green-600">No end date (ongoing)</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SPF Management</h1>
            <p className="text-muted-foreground">
              Manage Special Product Fees (bonus commissions) for trainers
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setEditingPromotion(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add SPF Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPromotion ? "Edit SPF Promotion" : "Create SPF Promotion"}
                </DialogTitle>
                <DialogDescription>
                  Set a bonus commission percentage for a specific product
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Product Search */}
                <div className="space-y-2">
                  <Label>Product</Label>
                  {selectedProduct ? (
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                      {selectedProduct.image ? (
                        <img 
                          src={selectedProduct.image} 
                          alt={selectedProduct.title}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          <Package className="w-4 h-4" />
                        </div>
                      )}
                      <span className="flex-1 truncate">{selectedProduct.title}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedProduct(null)}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search products..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      {filteredProducts.length > 0 && (
                        <div className="border rounded-lg max-h-48 overflow-y-auto">
                          {filteredProducts.map((product) => (
                            <button
                              key={product.id}
                              className="w-full flex items-center gap-3 p-2 hover:bg-muted text-left"
                              onClick={() => {
                                setSelectedProduct({
                                  id: String(product.shopifyProductId || product.id),
                                  title: product.name,
                                  image: product.imageUrl || undefined,
                                });
                                setSearchQuery("");
                              }}
                            >
                              {product.imageUrl ? (
                                <img 
                                  src={product.imageUrl} 
                                  alt={product.name}
                                  className="w-8 h-8 object-cover rounded"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                                  <Package className="w-3 h-3" />
                                </div>
                              )}
                              <span className="truncate text-sm">{product.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* SPF Percentage */}
                <div className="space-y-2">
                  <Label>SPF Percentage (bonus on top of base {baseRate || 10}%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={spfPercentage}
                      onChange={(e) => setSpfPercentage(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-muted-foreground">%</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      Total: {(baseRate || 10) + parseFloat(spfPercentage || "0")}%
                    </span>
                  </div>
                </div>
                
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (optional)</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                    />
                  </div>
                </div>
                
                {!endDate && (
                  <p className="text-sm text-muted-foreground">
                    Leave end date empty for an ongoing promotion
                  </p>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveSPF}
                  disabled={!selectedProduct || setSPFMutation.isPending}
                >
                  {setSPFMutation.isPending ? "Saving..." : "Save Promotion"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{categorizedSPFs.active.length}</p>
                  <p className="text-sm text-muted-foreground">Active Promotions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{categorizedSPFs.upcoming.length}</p>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <XCircle className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{categorizedSPFs.expired.length}</p>
                  <p className="text-sm text-muted-foreground">Expired</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{baseRate || 10}%</p>
                  <p className="text-sm text-muted-foreground">Base Commission</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Base Commission Rate Setting */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="w-5 h-5" />
              Base Commission Rate
            </CardTitle>
            <CardDescription>
              The default commission percentage trainers earn on all product sales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={baseRate || 10}
                  onChange={(e) => {
                    const newRate = parseFloat(e.target.value);
                    if (newRate >= 1 && newRate <= 50) {
                      setBaseRateMutation.mutate({ rate: newRate });
                    }
                  }}
                  className="w-20"
                />
                <span className="text-muted-foreground">%</span>
              </div>
              <p className="text-sm text-muted-foreground">
                SPF promotions add additional percentage on top of this base rate
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Promotions Tabs */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Active ({categorizedSPFs.active.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-2">
              <Clock className="w-4 h-4" />
              Upcoming ({categorizedSPFs.upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="expired" className="gap-2">
              <XCircle className="w-4 h-4" />
              Expired ({categorizedSPFs.expired.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-3">
            {categorizedSPFs.active.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Percent className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No Active Promotions</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create an SPF promotion to incentivize trainers to sell specific products
                  </p>
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add SPF Promotion
                  </Button>
                </CardContent>
              </Card>
            ) : (
              categorizedSPFs.active.map((promotion) => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))
            )}
          </TabsContent>
          
          <TabsContent value="upcoming" className="space-y-3">
            {categorizedSPFs.upcoming.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No upcoming promotions scheduled
                </CardContent>
              </Card>
            ) : (
              categorizedSPFs.upcoming.map((promotion) => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))
            )}
          </TabsContent>
          
          <TabsContent value="expired" className="space-y-3">
            {categorizedSPFs.expired.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No expired promotions
                </CardContent>
              </Card>
            ) : (
              categorizedSPFs.expired.map((promotion) => (
                <PromotionCard key={promotion.id} promotion={promotion} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
