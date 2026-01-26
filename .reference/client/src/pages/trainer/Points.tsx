import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Star,
  TrendingUp,
  Award,
  Target,
  Gift,
  Calendar,
  Loader2,
  Crown,
  Medal,
  Zap,
  ShoppingBag,
  Users,
  Handshake,
  DollarSign,
  Package,
  Eye,
  Percent,
  CheckCircle2,
  Lock,
  ArrowRight,
} from "lucide-react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { UserAvatar } from "@/components/AvatarUpload";
import { Link } from "wouter";

// Status tier configuration - matching server thresholds
const TIERS = {
  bronze: {
    name: "Bronze",
    threshold: 0,
    color: "bg-amber-700",
    borderColor: "border-amber-700",
    textColor: "text-amber-700",
    bgLight: "bg-amber-50",
    icon: Medal,
    marginBonus: 0,
    pointsMultiplier: 1,
    benefits: [
      { label: "Base Commission", value: "10%", included: true },
      { label: "Standard Support", value: "Email", included: true },
      { label: "Priority Support", value: "24h", included: false },
      { label: "Featured Listing", value: "", included: false },
      { label: "Exclusive Products", value: "", included: false },
    ],
  },
  silver: {
    name: "Silver",
    threshold: 5000,
    color: "bg-gray-400",
    borderColor: "border-gray-400",
    textColor: "text-gray-500",
    bgLight: "bg-gray-50",
    icon: Medal,
    marginBonus: 2,
    pointsMultiplier: 1.1,
    benefits: [
      { label: "Base Commission", value: "12%", included: true },
      { label: "Standard Support", value: "Email", included: true },
      { label: "Priority Support", value: "12h", included: true },
      { label: "Featured Listing", value: "", included: false },
      { label: "Exclusive Products", value: "", included: false },
    ],
  },
  gold: {
    name: "Gold",
    threshold: 15000,
    color: "bg-yellow-500",
    borderColor: "border-yellow-500",
    textColor: "text-yellow-600",
    bgLight: "bg-yellow-50",
    icon: Trophy,
    marginBonus: 5,
    pointsMultiplier: 1.25,
    benefits: [
      { label: "Base Commission", value: "15%", included: true },
      { label: "Standard Support", value: "Email", included: true },
      { label: "Priority Support", value: "4h", included: true },
      { label: "Featured Listing", value: "✓", included: true },
      { label: "Exclusive Products", value: "", included: false },
    ],
  },
  platinum: {
    name: "Platinum",
    threshold: 35000,
    color: "bg-slate-700",
    borderColor: "border-slate-700",
    textColor: "text-slate-700",
    bgLight: "bg-slate-50",
    icon: Crown,
    marginBonus: 10,
    pointsMultiplier: 1.5,
    benefits: [
      { label: "Base Commission", value: "18%", included: true },
      { label: "Standard Support", value: "Email", included: true },
      { label: "Priority Support", value: "1h VIP", included: true },
      { label: "Featured Listing", value: "✓", included: true },
      { label: "Exclusive Products", value: "✓", included: true },
    ],
  },
};

type TierKey = keyof typeof TIERS;

function getTierFromPoints(points: number): TierKey {
  if (points >= 35000) return "platinum";
  if (points >= 15000) return "gold";
  if (points >= 5000) return "silver";
  return "bronze";
}

function getPointSourceIcon(source: string) {
  switch (source) {
    case "bundle_sale": return ShoppingBag;
    case "new_client_bonus": return Users;
    case "ad_partnership_sale": return Handshake;
    case "client_retention": return Target;
    case "adjustment": return Zap;
    default: return Star;
  }
}

function getPointSourceLabel(source: string) {
  switch (source) {
    case "bundle_sale": return "Bundle Sale";
    case "new_client_bonus": return "New Client Bonus";
    case "ad_partnership_sale": return "Ad Partnership";
    case "client_retention": return "Client Retention";
    case "adjustment": return "Adjustment";
    case "vending_sale": return "Vending Sale";
    case "referral_bonus": return "Referral Bonus";
    default: return source.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
}

export default function TrainerStatus() {
  const { user } = useAuth();

  // Points data
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = trpc.trainerPoints.summary.useQuery();
  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = trpc.trainerPoints.transactions.useQuery({ limit: 10 });
  const { data: awards, refetch: refetchAwards } = trpc.trainerPoints.awards.useQuery();

  // Earnings data
  const { data: earningsSummary, isLoading: earningsLoading, refetch: refetchEarnings } = trpc.earnings.summary.useQuery(
    { period: "month" },
    { staleTime: 30000 }
  );
  const { data: yearEarnings, refetch: refetchYearEarnings } = trpc.earnings.summary.useQuery(
    { period: "year" },
    { staleTime: 30000 }
  );

  // Bundle performance data
  const { data: bundles, isLoading: bundlesLoading, refetch: refetchBundles } = trpc.bundles.list.useQuery(
    undefined,
    { staleTime: 30000 }
  );

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([
      refetchSummary(),
      refetchTransactions(),
      refetchAwards(),
      refetchEarnings(),
      refetchYearEarnings(),
      refetchBundles(),
    ]);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount);
  };

  if (!user) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Please log in to view your status.</p>
      </div>
    );
  }

  const currentTier = getTierFromPoints(summary?.lifetimePoints || 0);
  const tierConfig = TIERS[currentTier];
  const TierIcon = tierConfig.icon;

  // Calculate progress for each tier
  const tierProgress = Object.entries(TIERS).map(([key, tier]) => {
    const points = summary?.lifetimePoints || 0;
    const nextTierKey = key === "bronze" ? "silver" : key === "silver" ? "gold" : key === "gold" ? "platinum" : null;
    const nextTier = nextTierKey ? TIERS[nextTierKey as TierKey] : null;
    
    if (points >= tier.threshold) {
      if (!nextTier) return { key, ...tier, progress: 100, achieved: true };
      const progressInTier = points - tier.threshold;
      const tierRange = nextTier.threshold - tier.threshold;
      return { key, ...tier, progress: Math.min(100, (progressInTier / tierRange) * 100), achieved: true };
    }
    return { key, ...tier, progress: 0, achieved: false };
  });

  // Top selling products from bundles
  type ProductWithSales = { id: number; name: string; totalSales: number; bundleId: number };
  const topSellingProducts: ProductWithSales[] = bundles
    ?.flatMap((b: any) => b.products?.map((p: any) => ({ id: p.id, name: p.name, bundleId: b.id, bundleName: b.title, sales: b.salesCount || 0 })) || [])
    .reduce((acc: ProductWithSales[], product: any) => {
      const existing = acc.find((p: ProductWithSales) => p.id === product.id);
      if (existing) {
        existing.totalSales += product.sales;
      } else {
        acc.push({ id: product.id, name: product.name, totalSales: product.sales, bundleId: product.bundleId });
      }
      return acc;
    }, [] as ProductWithSales[])
    .sort((a: ProductWithSales, b: ProductWithSales) => b.totalSales - a.totalSales)
    .slice(0, 5) || [];

  // Top viewed bundles
  const topViewedBundles = [...(bundles || [])]
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, 5);

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen pb-24">
      <div className="container py-6 max-w-4xl">
        {/* Header with User Info */}
        <div className="flex items-center gap-4 mb-6">
          <UserAvatar photoUrl={user.photoUrl} name={user.name} size="lg" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Trainer Status</h1>
            <p className="text-muted-foreground">{user.name}</p>
          </div>
          <div className={`px-4 py-2 rounded-full ${tierConfig.color} text-white flex items-center gap-2`}>
            <TierIcon className="h-5 w-5" />
            <span className="font-semibold">{tierConfig.name}</span>
          </div>
        </div>

        {/* Current Status Card */}
        <Card className={`mb-6 overflow-hidden border-2 ${tierConfig.borderColor}`}>
          <div className={`${tierConfig.color} text-white p-6`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center">
                  <TierIcon className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-sm opacity-80">Current Status</div>
                  <div className="text-3xl font-bold">{tierConfig.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm opacity-80">Lifetime Points</div>
                {summaryLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin ml-auto" />
                ) : (
                  <div className="text-4xl font-bold">{(summary?.lifetimePoints || 0).toLocaleString()}</div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="benefits">Benefits</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Month</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  {earningsLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{formatCurrency(earningsSummary?.totalEarnings || 0)}</div>
                      <p className="text-xs text-muted-foreground">earnings</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Year to Date</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(yearEarnings?.totalEarnings || 0)}</div>
                  <p className="text-xs text-muted-foreground">earnings</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Points Balance</CardTitle>
                  <Star className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  {summaryLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{(summary?.totalPoints || 0).toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">available</p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Commission</CardTitle>
                  <Percent className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {10 + tierConfig.marginBonus}%
                  </div>
                  <p className="text-xs text-muted-foreground">base rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Tier Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Tier Progress
                </CardTitle>
                <CardDescription>Your journey through the tiers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {tierProgress.map((tier, idx) => {
                  const Icon = tier.icon;
                  const isCurrentTier = tier.key === currentTier;
                  return (
                    <div key={tier.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-full ${tier.achieved ? tier.color : 'bg-muted'} flex items-center justify-center`}>
                            {tier.achieved ? (
                              <Icon className="h-5 w-5 text-white" />
                            ) : (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className={`font-medium ${isCurrentTier ? tier.textColor : ''}`}>
                              {tier.name}
                              {isCurrentTier && <Badge variant="outline" className="ml-2 text-xs">Current</Badge>}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {tier.threshold.toLocaleString()} points
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">+{tier.marginBonus}% margin</div>
                          <div className="text-sm text-muted-foreground">{tier.pointsMultiplier}x points</div>
                        </div>
                      </div>
                      <Progress 
                        value={tier.progress} 
                        className={`h-2 ${tier.achieved ? '' : 'opacity-50'}`}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Recent Points Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Recent Points Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (transactions?.length || 0) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No point transactions yet</p>
                    <p className="text-sm">Start selling to earn points!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions?.slice(0, 5).map((tx) => {
                      const SourceIcon = getPointSourceIcon(tx.transactionType);
                      return (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <SourceIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{getPointSourceLabel(tx.transactionType)}</div>
                              <div className="text-sm text-muted-foreground">{formatDate(tx.createdAt)}</div>
                            </div>
                          </div>
                          <div className={`font-bold ${tx.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {tx.points >= 0 ? "+" : ""}{tx.points.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Income Tab */}
          <TabsContent value="income" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(earningsSummary?.totalEarnings || 0)}</div>
                  {earningsSummary?.periodComparison && (
                    <p className={`text-sm flex items-center gap-1 ${earningsSummary.periodComparison.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {earningsSummary.periodComparison.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingUp className="h-4 w-4 rotate-180" />}
                      {Math.abs(earningsSummary.periodComparison.change).toFixed(1)}% vs last month
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Year to Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(yearEarnings?.totalEarnings || 0)}</div>
                  <p className="text-sm text-muted-foreground">Total earnings this year</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Split</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Products</span>
                      <span className="font-medium">{formatCurrency(earningsSummary?.productCommissions || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Services</span>
                      <span className="font-medium">{formatCurrency(earningsSummary?.serviceRevenue || 0)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Earnings Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Earnings Breakdown</CardTitle>
                <CardDescription>How your income is distributed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-blue-500" />
                      <span>Product Commissions</span>
                    </div>
                    <span className="font-bold">{formatCurrency(earningsSummary?.productCommissions || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-green-500" />
                      <span>Service Revenue</span>
                    </div>
                    <span className="font-bold">{formatCurrency(earningsSummary?.serviceRevenue || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Handshake className="h-5 w-5 text-purple-500" />
                      <span>Ad Partnerships</span>
                    </div>
                    <span className="font-bold">{formatCurrency(0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Top Selling Products */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5" />
                      Top Selling Products
                    </CardTitle>
                    <Link href="/trainer/bundles">
                      <span className="text-sm text-primary hover:underline cursor-pointer">View All</span>
                    </Link>
                  </div>
                  <CardDescription>Products with the most sales</CardDescription>
                </CardHeader>
                <CardContent>
                  {bundlesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : topSellingProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No sales data yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topSellingProducts.map((product: ProductWithSales, idx: number) => (
                        <Link key={product.id} href={`/trainer/bundles/${product.bundleId}`}>
                          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate group-hover:text-primary transition-colors">{product.name}</div>
                              <div className="text-sm text-muted-foreground">{product.totalSales} sales</div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Viewed Bundles */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Top Viewed Bundles
                    </CardTitle>
                    <Link href="/trainer/bundles">
                      <span className="text-sm text-primary hover:underline cursor-pointer">View All</span>
                    </Link>
                  </div>
                  <CardDescription>Bundles with the most views</CardDescription>
                </CardHeader>
                <CardContent>
                  {bundlesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : topViewedBundles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No view data yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topViewedBundles.map((bundle, idx) => (
                        <Link key={bundle.id} href={`/trainer/bundles/${bundle.id}`}>
                          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group">
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-500">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate group-hover:text-primary transition-colors">{bundle.title}</div>
                              <div className="text-sm text-muted-foreground">{(bundle.viewCount || 0).toLocaleString()} views</div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Benefits Tab */}
          <TabsContent value="benefits" className="space-y-6">
            {/* Tier Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Tier Benefits Comparison
                </CardTitle>
                <CardDescription>See what you unlock at each tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">Benefit</th>
                        {Object.entries(TIERS).map(([key, tier]) => {
                          const Icon = tier.icon;
                          const isCurrent = key === currentTier;
                          return (
                            <th key={key} className={`text-center py-3 px-2 ${isCurrent ? tier.bgLight : ''}`}>
                              <div className="flex flex-col items-center gap-1">
                                <div className={`h-8 w-8 rounded-full ${tier.color} flex items-center justify-center`}>
                                  <Icon className="h-4 w-4 text-white" />
                                </div>
                                <span className={`text-sm font-medium ${isCurrent ? tier.textColor : ''}`}>
                                  {tier.name}
                                </span>
                                {isCurrent && <Badge variant="outline" className="text-[10px]">You</Badge>}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-3 px-2 font-medium">Points Required</td>
                        {Object.entries(TIERS).map(([key, tier]) => (
                          <td key={key} className={`text-center py-3 px-2 ${key === currentTier ? tier.bgLight : ''}`}>
                            {tier.threshold.toLocaleString()}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-2 font-medium">Commission Rate</td>
                        {Object.entries(TIERS).map(([key, tier]) => (
                          <td key={key} className={`text-center py-3 px-2 font-bold ${key === currentTier ? tier.bgLight : ''}`}>
                            {10 + tier.marginBonus}%
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-2 font-medium">Margin Bonus</td>
                        {Object.entries(TIERS).map(([key, tier]) => (
                          <td key={key} className={`text-center py-3 px-2 ${key === currentTier ? tier.bgLight : ''}`}>
                            +{tier.marginBonus}%
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-2 font-medium">Points Multiplier</td>
                        {Object.entries(TIERS).map(([key, tier]) => (
                          <td key={key} className={`text-center py-3 px-2 ${key === currentTier ? tier.bgLight : ''}`}>
                            {tier.pointsMultiplier}x
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-2 font-medium">Priority Support</td>
                        {Object.entries(TIERS).map(([key, tier]) => {
                          const benefit = tier.benefits.find(b => b.label === "Priority Support");
                          return (
                            <td key={key} className={`text-center py-3 px-2 ${key === currentTier ? tier.bgLight : ''}`}>
                              {benefit?.included ? (
                                <span className="text-green-600 flex items-center justify-center gap-1">
                                  <CheckCircle2 className="h-4 w-4" />
                                  {benefit.value}
                                </span>
                              ) : (
                                <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="border-b">
                        <td className="py-3 px-2 font-medium">Featured Listing</td>
                        {Object.entries(TIERS).map(([key, tier]) => {
                          const benefit = tier.benefits.find(b => b.label === "Featured Listing");
                          return (
                            <td key={key} className={`text-center py-3 px-2 ${key === currentTier ? tier.bgLight : ''}`}>
                              {benefit?.included ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="py-3 px-2 font-medium">Exclusive Products</td>
                        {Object.entries(TIERS).map(([key, tier]) => {
                          const benefit = tier.benefits.find(b => b.label === "Exclusive Products");
                          return (
                            <td key={key} className={`text-center py-3 px-2 ${key === currentTier ? tier.bgLight : ''}`}>
                              {benefit?.included ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
                              ) : (
                                <Lock className="h-4 w-4 text-muted-foreground mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* How to Earn Points */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  How to Earn Points
                </CardTitle>
                <CardDescription>Ways to boost your points and reach the next tier</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Bundle Sales</span>
                    </div>
                    <p className="text-sm text-muted-foreground">£1 commission = 1 point</p>
                    <p className="text-xs text-muted-foreground mt-1">× {tierConfig.pointsMultiplier} at {tierConfig.name}</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-5 w-5 text-green-500" />
                      <span className="font-medium">New Clients</span>
                    </div>
                    <p className="text-sm text-muted-foreground">+100 points per new client</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-purple-500" />
                      <span className="font-medium">Client Retention</span>
                    </div>
                    <p className="text-sm text-muted-foreground">+50 points for repeat purchases</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Handshake className="h-5 w-5 text-amber-500" />
                      <span className="font-medium">Ad Partnerships</span>
                    </div>
                    <p className="text-sm text-muted-foreground">500-5,000 points per partnership</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="h-5 w-5 text-pink-500" />
                      <span className="font-medium">Referrals</span>
                    </div>
                    <p className="text-sm text-muted-foreground">+500 points per trainer referral</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="h-5 w-5 text-yellow-500" />
                      <span className="font-medium">5-Star Reviews</span>
                    </div>
                    <p className="text-sm text-muted-foreground">+50 points per 5-star review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PullToRefresh>
  );
}
