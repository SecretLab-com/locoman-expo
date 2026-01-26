import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  TrendingUp, 
  Eye, 
  ShoppingCart, 
  DollarSign, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  BarChart3,
} from "lucide-react";
import { Link } from "wouter";

type SortOption = "revenue" | "sales" | "views" | "conversion";

export default function BundlePerformance() {
  const [sortBy, setSortBy] = useState<SortOption>("revenue");
  
  const { data: summary, isLoading: summaryLoading } = trpc.stats.bundlePerformanceSummary.useQuery();
  const { data: bundles, isLoading: bundlesLoading } = trpc.stats.bundlePerformance.useQuery({
    sortBy,
    limit: 20,
  });
  
  const formatCurrency = (amount: number | string | null) => {
    const num = typeof amount === "string" ? parseFloat(amount) : (amount || 0);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };
  
  const formatNumber = (num: number | null) => {
    return new Intl.NumberFormat("en-US").format(num || 0);
  };
  
  const sortOptions: { value: SortOption; label: string; icon: React.ReactNode }[] = [
    { value: "revenue", label: "Revenue", icon: <DollarSign className="h-4 w-4" /> },
    { value: "sales", label: "Sales", icon: <ShoppingCart className="h-4 w-4" /> },
    { value: "views", label: "Views", icon: <Eye className="h-4 w-4" /> },
    { value: "conversion", label: "Conversion", icon: <Target className="h-4 w-4" /> },
  ];
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <Link href="/manager">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Bundle Performance</h1>
              <p className="text-sm text-muted-foreground">Track views, sales, and conversion rates</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container py-6 space-y-6 pb-24">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  {summaryLoading ? (
                    <Skeleton className="h-7 w-20" />
                  ) : (
                    <p className="text-2xl font-bold">{formatNumber(summary?.totalViews || 0)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Total Views</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  {summaryLoading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{formatNumber(summary?.totalSales || 0)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  {summaryLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className="text-2xl font-bold">{formatCurrency(summary?.totalRevenue || 0)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  {summaryLoading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{summary?.avgConversionRate || 0}%</p>
                  )}
                  <p className="text-xs text-muted-foreground">Avg Conversion</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Sort Options */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sortOptions.map((option) => (
            <Button
              key={option.value}
              variant={sortBy === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy(option.value)}
              className="flex items-center gap-2"
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>
        
        {/* Bundle List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top Performing Bundles
            </CardTitle>
            <CardDescription>
              Sorted by {sortOptions.find(o => o.value === sortBy)?.label.toLowerCase()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bundlesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : bundles && bundles.length > 0 ? (
              <div className="space-y-4">
                {bundles.map((bundle, index) => (
                  <div
                    key={bundle.id}
                    className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">#{index + 1}</span>
                    </div>
                    
                    {/* Bundle Image */}
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted overflow-hidden">
                      {bundle.imageUrl ? (
                        <img
                          src={bundle.imageUrl}
                          alt={bundle.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    
                    {/* Bundle Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{bundle.title}</h3>
                        {bundle.conversionRate > 5 && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <ArrowUpRight className="h-3 w-3 mr-1" />
                            High Conversion
                          </Badge>
                        )}
                      </div>
                      
                      {bundle.trainer && (
                        <p className="text-sm text-muted-foreground mb-2">
                          by {bundle.trainer.name}
                        </p>
                      )}
                      
                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Views</p>
                          <p className="font-medium">{formatNumber(bundle.viewCount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Sales</p>
                          <p className="font-medium">{formatNumber(bundle.salesCount)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(bundle.totalRevenue)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Conversion</p>
                          <p className={`font-medium ${
                            bundle.conversionRate > 5 
                              ? "text-green-600 dark:text-green-400" 
                              : bundle.conversionRate > 2 
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-muted-foreground"
                          }`}>
                            {bundle.conversionRate}%
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* View Details */}
                    <Link href={`/manager/bundles/${bundle.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                        <ArrowUpRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No bundle performance data yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Views and sales will appear here once bundles are published
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Tips Card */}
        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <TrendingUp className="h-5 w-5" />
              Performance Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <p><strong>High views, low conversion?</strong> Consider adjusting bundle pricing or improving product descriptions.</p>
            </div>
            <div className="flex items-start gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <p><strong>Low views?</strong> Encourage trainers to share bundle links on social media and with their clients.</p>
            </div>
            <div className="flex items-start gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <p><strong>Track trends:</strong> Monitor which bundle types perform best to guide future template creation.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
