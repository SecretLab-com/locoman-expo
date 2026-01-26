import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  DollarSign,
  Package,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronRight,
  Plus,
  Check,
  Clock,
  Loader2,
  Filter,
  User,
} from "lucide-react";
import {
  EarningsSummarySkeleton,
  StatsGridSkeleton,
  TransactionListSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Period = "week" | "month" | "year" | "all";

export default function TrainerEarnings() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<Period>("month");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");

  // Fetch earnings summary
  const { data: summary, isLoading: summaryLoading } = trpc.earnings.summary.useQuery(
    { period },
    { staleTime: 30000 }
  );

  // Fetch earnings breakdown
  const { data: breakdown, isLoading: breakdownLoading } = trpc.earnings.breakdown.useQuery(
    { period },
    { staleTime: 30000 }
  );

  // Fetch delivery schedule
  const { data: deliveries, isLoading: deliveriesLoading, refetch: refetchDeliveries } = trpc.earnings.deliveries.useQuery(
    { status: deliveryFilter },
    { staleTime: 30000 }
  );

  // Fetch earnings history
  const { data: history } = trpc.earnings.history.useQuery(
    { limit: 10 },
    { staleTime: 30000 }
  );

  const utils = trpc.useUtils();

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([
      utils.earnings.summary.invalidate(),
      utils.earnings.breakdown.invalidate(),
      utils.earnings.deliveries.invalidate(),
      utils.earnings.history.invalidate(),
    ]);
  };

  // Increment delivery mutation
  const incrementDelivery = trpc.earnings.incrementDelivery.useMutation({
    onSuccess: () => {
      refetchDeliveries();
    },
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/");
    }
  }, [loading, isAuthenticated, setLocation]);

  // Calculate revenue split for pie chart visualization
  const revenueSplit = useMemo(() => {
    if (!summary) return { products: 0, services: 0 };
    const total = summary.totalEarnings || 1;
    return {
      products: Math.round((summary.productCommissions / total) * 100),
      services: Math.round((summary.serviceRevenue / total) * 100),
    };
  }, [summary]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getPeriodLabel = (p: Period) => {
    switch (p) {
      case "week": return "This Week";
      case "month": return "This Month";
      case "year": return "This Year";
      case "all": return "All Time";
    }
  };

  if (loading || summaryLoading) {
    return (
      <AppShell title="Earnings">
        <div className="space-y-6 pb-20">
          {/* Period Selector Skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-[140px]" />
          </div>

          {/* Summary Cards Skeleton */}
          <div className="grid grid-cols-2 gap-3">
            <EarningsSummarySkeleton className="col-span-2" />
            <StatsGridSkeleton count={2} columns={2} />
            <Card className="col-span-2">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Split Skeleton */}
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            </CardContent>
          </Card>

          {/* History Skeleton */}
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <TransactionListSkeleton count={5} />
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Earnings Dashboard" onRefresh={handleRefresh}>
      <div className="space-y-6 pb-20">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your Earnings</h2>
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Earnings */}
          <Card className="col-span-2 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Total Earnings</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(summary?.totalEarnings || 0)}
                  </p>
                  {summary?.periodComparison && (
                    <div className="flex items-center gap-1 mt-2">
                      {summary.periodComparison.change >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      <span className="text-sm">
                        {summary.periodComparison.change >= 0 ? "+" : ""}
                        {summary.periodComparison.change.toFixed(1)}% vs last {period}
                      </span>
                    </div>
                  )}
                </div>
                <DollarSign className="h-12 w-12 text-emerald-200" />
              </div>
            </CardContent>
          </Card>

          {/* Product Commissions */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-xs">Products</span>
              </div>
              <p className="text-xl font-semibold">
                {formatCurrency(summary?.productCommissions || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {revenueSplit.products}% of total
              </p>
            </CardContent>
          </Card>

          {/* Service Revenue */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Briefcase className="h-4 w-4" />
                <span className="text-xs">Services</span>
              </div>
              <p className="text-xl font-semibold">
                {formatCurrency(summary?.serviceRevenue || 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {revenueSplit.services}% of total
              </p>
            </CardContent>
          </Card>

          {/* Bundles Sold */}
          <Card className="col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bundles Sold</p>
                  <p className="text-2xl font-bold">{summary?.bundlesSold || 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Avg. per Bundle</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(
                      summary?.bundlesSold
                        ? summary.totalEarnings / summary.bundlesSold
                        : 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Split Visual */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue Split</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Products bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    Products
                  </span>
                  <span className="font-medium">{revenueSplit.products}%</span>
                </div>
                <Progress value={revenueSplit.products} className="h-2 bg-blue-100" />
              </div>
              {/* Services bar */}
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    Services
                  </span>
                  <span className="font-medium">{revenueSplit.services}%</span>
                </div>
                <Progress value={revenueSplit.services} className="h-2 bg-emerald-100" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Breakdown */}
        {breakdown?.byService && breakdown.byService.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Services</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {breakdown.byService.slice(0, 5).map((service, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Briefcase className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {service.quantity} sessions
                        </p>
                      </div>
                    </div>
                    <p className="font-semibold">{formatCurrency(service.revenue)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Earnings Trend */}
        {breakdown?.revenueByDay && breakdown.revenueByDay.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Earnings Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 flex items-end gap-1">
                {breakdown.revenueByDay.slice(-14).map((day, idx) => {
                  const maxTotal = Math.max(...breakdown.revenueByDay.map(d => d.total), 1);
                  const height = (day.total / maxTotal) * 100;
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-emerald-500 rounded-t hover:bg-emerald-600 transition-colors cursor-pointer group relative"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${formatDate(day.date)}: ${formatCurrency(day.total)}`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-popover text-popover-foreground text-xs p-1 rounded shadow whitespace-nowrap">
                        {formatCurrency(day.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>
                  {breakdown.revenueByDay.length > 0
                    ? formatDate(breakdown.revenueByDay[Math.max(0, breakdown.revenueByDay.length - 14)].date)
                    : ""}
                </span>
                <span>
                  {breakdown.revenueByDay.length > 0
                    ? formatDate(breakdown.revenueByDay[breakdown.revenueByDay.length - 1].date)
                    : ""}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Schedule */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Delivery Schedule</CardTitle>
              <Select
                value={deliveryFilter}
                onValueChange={(v) => setDeliveryFilter(v as typeof deliveryFilter)}
              >
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {deliveriesLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : deliveries && deliveries.length > 0 ? (
              <div className="space-y-3">
                {deliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          {delivery.client?.name || "Client"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {delivery.serviceName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {delivery.bundleTitle}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <Badge
                          variant={
                            delivery.status === "completed"
                              ? "default"
                              : delivery.status === "in_progress"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-xs"
                        >
                          {delivery.deliveredQuantity}/{delivery.totalQuantity}
                        </Badge>
                        <Progress
                          value={(delivery.deliveredQuantity / delivery.totalQuantity) * 100}
                          className="h-1 w-16 mt-1"
                        />
                      </div>
                      {delivery.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => incrementDelivery.mutate({ deliveryId: delivery.id })}
                          disabled={incrementDelivery.isPending}
                        >
                          {incrementDelivery.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      {delivery.status === "completed" && (
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Check className="h-4 w-4 text-emerald-600" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No deliveries to show</p>
                <p className="text-xs">Deliveries will appear here when clients purchase your bundles</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        {history && history.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {history.slice(0, 5).map((earning) => (
                  <div
                    key={earning.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {earning.bundleTitle || "Bundle Sale"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {earning.clientName || "Client"} • {formatDate(earning.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600">
                        +{formatCurrency(parseFloat(earning.totalEarnings || "0"))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {earning.status === "paid" ? "Paid" : "Pending"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
