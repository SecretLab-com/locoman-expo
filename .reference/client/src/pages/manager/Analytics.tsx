import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, DollarSign, Package, Users, Calendar, Download, FileText, Loader2, Clock } from "lucide-react";
import { Link } from "wouter";
import { toast } from "@/lib/toast";

export default function Analytics() {
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "1y" | "all">("30d");
  const utils = trpc.useUtils();
  
  const queryInput = useMemo(() => {
    const now = new Date();
    switch (dateRange) {
      case "7d":
        return { startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() };
      case "30d":
        return { startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() };
      case "90d":
        return { startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString() };
      case "1y":
        return { startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString() };
      default:
        return undefined;
    }
  }, [dateRange]);
  
  const { data: analytics, isLoading } = trpc.stats.analytics.useQuery(queryInput);
  const { data: recentReports } = trpc.stats.recentReports.useQuery({ limit: 5 });
  
  const generateReportMutation = trpc.stats.generateReport.useMutation({
    onSuccess: (data) => {
      toast.success("Report generated successfully!");
      utils.stats.recentReports.invalidate();
      // Auto-download the report
      window.open(data.fileUrl, "_blank");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate report");
    },
  });
  
  const handleDownloadReport = () => {
    generateReportMutation.mutate({
      dateRange,
      reportType: "full",
    });
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };
  
  const maxRevenue = analytics?.revenueByMonth
    ? Math.max(...analytics.revenueByMonth.map(m => m.revenue), 1)
    : 1;
  
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
            <div className="flex-1">
              <h1 className="text-xl font-bold">Revenue Analytics</h1>
              <p className="text-sm text-muted-foreground">Track performance and trends</p>
            </div>
            <Button
              onClick={handleDownloadReport}
              disabled={generateReportMutation.isPending || isLoading}
              className="gap-2"
            >
              {generateReportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download Report
            </Button>
          </div>
        </div>
      </div>
      
      <div className="container py-6 space-y-6 pb-24">
        {/* Date Range Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { value: "7d", label: "7 Days" },
            { value: "30d", label: "30 Days" },
            { value: "90d", label: "90 Days" },
            { value: "1y", label: "1 Year" },
            { value: "all", label: "All Time" },
          ].map((option) => (
            <Button
              key={option.value}
              variant={dateRange === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setDateRange(option.value as typeof dateRange)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-24" />
                  ) : (
                    <p className="text-2xl font-bold">{formatCurrency(analytics?.totalRevenue || 0)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  {isLoading ? (
                    <Skeleton className="h-7 w-16" />
                  ) : (
                    <p className="text-2xl font-bold">{analytics?.orderCount || 0}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Monthly revenue over the past 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-48 flex items-end gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="flex-1 h-full" style={{ height: `${Math.random() * 100}%` }} />
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-end gap-1">
                {analytics?.revenueByMonth.map((month, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-primary/80 hover:bg-primary rounded-t transition-colors"
                      style={{ height: `${(month.revenue / maxRevenue) * 100}%`, minHeight: month.revenue > 0 ? "4px" : "0" }}
                      title={`${month.month}: ${formatCurrency(month.revenue)}`}
                    />
                    <span className="text-[10px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                      {month.month}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top Selling Products
            </CardTitle>
            <CardDescription>Best performing products by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : analytics?.topProducts && analytics.topProducts.length > 0 ? (
              <div className="space-y-3">
                {analytics.topProducts.map((product, i) => (
                  <div key={product.productId} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.quantity} sold</p>
                    </div>
                    <p className="font-semibold text-green-600">{formatCurrency(product.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No sales data yet</p>
            )}
          </CardContent>
        </Card>
        
        {/* Trainer Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Trainer Performance
            </CardTitle>
            <CardDescription>Revenue contribution by trainer</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : analytics?.trainerPerformance && analytics.trainerPerformance.length > 0 ? (
              <div className="space-y-3">
                {analytics.trainerPerformance.map((perf, i) => (
                  <div key={perf.trainerId} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <span className="text-lg font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {perf.trainer?.photoUrl ? (
                        <img src={perf.trainer.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <Users className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{perf.trainer?.name || "Unknown Trainer"}</p>
                      <p className="text-sm text-muted-foreground">{perf.bundlesSold} bundles</p>
                    </div>
                    <p className="font-semibold text-green-600">{formatCurrency(perf.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No trainer data yet</p>
            )}
          </CardContent>
        </Card>
        
        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Reports
            </CardTitle>
            <CardDescription>Previously generated analytics reports</CardDescription>
          </CardHeader>
          <CardContent>
            {recentReports && recentReports.length > 0 ? (
              <div className="space-y-3">
                {recentReports.map((report) => (
                  <div key={report.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {report.dateRangeLabel === "all" ? "All Time" : report.dateRangeLabel} Report
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{formatCurrency(Number(report.totalRevenue || 0))} revenue</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(report.fileUrl, "_blank")}
                      className="gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No reports generated yet. Click "Download Report" to create your first report.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
