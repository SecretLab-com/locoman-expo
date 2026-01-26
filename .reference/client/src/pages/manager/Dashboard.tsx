import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Users,
  Package,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  UserCog,
  Shield,
  RefreshCw,
  Store,
  AlertTriangle,
  Bell,
  BarChart3,
  ArrowRight,
  ExternalLink,
  X,
  Mail,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// LocalStorage key for dismissed alerts
const DISMISSED_ALERTS_KEY = "locomotivate_dismissed_inventory_alerts";

// Helper to get dismissed alerts from localStorage
function getDismissedAlerts(): Set<number> {
  try {
    const stored = localStorage.getItem(DISMISSED_ALERTS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Set(parsed);
    }
  } catch (e) {
    console.error("Failed to read dismissed alerts from localStorage", e);
  }
  return new Set();
}

// Helper to save dismissed alerts to localStorage
function saveDismissedAlerts(dismissed: Set<number>) {
  try {
    localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify(Array.from(dismissed)));
  } catch (e) {
    console.error("Failed to save dismissed alerts to localStorage", e);
  }
}

// Swipeable Alert Item Component
function SwipeableAlertItem({
  bundle,
  onDismiss,
  onNavigate,
  onAlert,
  isAlertPending,
}: {
  bundle: { bundleId: number; bundleTitle: string; lowInventoryProducts: Array<{ productId: number; productName: string; inventory: number }> };
  onDismiss: () => void;
  onNavigate: () => void;
  onAlert: () => void;
  isAlertPending: boolean;
}) {
  const [translateX, setTranslateX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const startX = React.useRef(0);
  const startY = React.useRef(0);
  const isHorizontalSwipe = React.useRef<boolean | null>(null);
  const threshold = 80;
  const maxSwipe = 100;

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    // Only handle horizontal swipes (left swipe to dismiss)
    if (isHorizontalSwipe.current === false) {
      setIsDragging(false);
      return;
    }

    if (isHorizontalSwipe.current === true) {
      e.preventDefault();
      // Only allow left swipe (negative delta)
      let newTranslateX = Math.min(0, Math.max(deltaX, -maxSwipe - 20));
      // Add resistance at the edge
      if (newTranslateX < -maxSwipe) {
        newTranslateX = -maxSwipe - (Math.abs(newTranslateX) - maxSwipe) * 0.2;
      }
      setTranslateX(newTranslateX);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    isHorizontalSwipe.current = null;

    if (translateX < -threshold) {
      // Dismiss the alert
      setTranslateX(-300); // Animate off screen
      setTimeout(onDismiss, 200);
    } else {
      // Snap back
      setTranslateX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Dismiss action background */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-red-500 px-4">
        <div className="flex flex-col items-center text-white">
          <X className="h-5 w-5" />
          <span className="text-xs mt-1">Dismiss</span>
        </div>
      </div>
      
      {/* Main content */}
      <div
        className={`flex items-center justify-between p-4 bg-background border border-orange-500/20 group relative shadow-sm hover:shadow-md transition-shadow ${
          isDragging ? "" : "transition-transform duration-200 ease-out"
        }`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className="absolute top-1 right-1 p-1.5 rounded-full hover:bg-orange-500/20 bg-orange-500/10 md:bg-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          title="Dismiss this alert"
        >
          <X className="h-4 w-4 text-orange-600" />
        </button>
        <div 
          className="flex-1 min-w-0 cursor-pointer hover:opacity-80"
          onClick={onNavigate}
        >
          <p className="font-medium text-sm text-foreground truncate group-hover:text-orange-600">
            {bundle.bundleTitle}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {bundle.lowInventoryProducts.slice(0, 2).map((product) => (
              <span
                key={product.productId}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  product.inventory === 0
                    ? "bg-red-500/20 text-red-600 dark:text-red-400"
                    : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                }`}
              >
                {product.productName}: {product.inventory}
              </span>
            ))}
            {bundle.lowInventoryProducts.length > 2 && (
              <span className="text-xs text-muted-foreground">
                +{bundle.lowInventoryProducts.length - 2} more
              </span>
            )}
          </div>
        </div>
        <Button
          size="default"
          variant="outline"
          className="ml-3 gap-2 text-orange-600 border-orange-500/40 hover:bg-orange-500/20 font-medium"
          onClick={onAlert}
          disabled={isAlertPending}
        >
          <Bell className="h-4 w-4" />
          Alert Trainer
        </Button>
      </div>
    </div>
  );
}

// Low Inventory Alerts Component
function LowInventoryAlerts() {
  const [, setLocation] = useLocation();
  // Initialize from localStorage
  const [dismissedBundles, setDismissedBundles] = React.useState<Set<number>>(() => getDismissedAlerts());
  const utils = trpc.useUtils();
  
  // Fetch bundles with low inventory
  const { data: lowInventoryBundles, isLoading } = trpc.admin.lowInventoryBundles.useQuery(
    { threshold: 10 },
    { staleTime: 60000 }
  );
  
  // Send alert mutation
  const sendAlert = trpc.admin.sendLowInventoryAlert.useMutation({
    onSuccess: () => {
      toast.success("Low inventory alert sent");
    },
    onError: () => {
      toast.error("Failed to send alert");
    },
  });
  
  // Dismiss a single bundle
  const dismissBundle = (bundleId: number) => {
    setDismissedBundles(prev => {
      const newSet = new Set([...Array.from(prev), bundleId]);
      saveDismissedAlerts(newSet);
      return newSet;
    });
    toast.success("Alert dismissed");
  };
  
  // Dismiss all visible bundles
  const dismissAll = () => {
    const allBundleIds = lowInventoryBundles?.map(b => b.bundleId) || [];
    setDismissedBundles(prev => {
      const newSet = new Set([...Array.from(prev), ...allBundleIds]);
      saveDismissedAlerts(newSet);
      return newSet;
    });
    toast.success("All alerts dismissed");
  };
  
  const visibleBundles = lowInventoryBundles?.filter(b => !dismissedBundles.has(b.bundleId)) || [];
  
  if (isLoading) return null;
  if (visibleBundles.length === 0) return null;
  
  return (
    <Card className="mb-6 border-orange-500/50 bg-gradient-to-r from-orange-500/15 to-red-500/15 dark:from-orange-500/15 dark:to-red-500/15 shadow-lg shadow-orange-500/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse">
              <AlertTriangle className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-orange-600 dark:text-orange-400">
                Low Inventory Alerts
              </CardTitle>
              <p className="text-sm text-orange-600/80 dark:text-orange-400/80">
                {visibleBundles.length} bundle{visibleBundles.length > 1 ? "s" : ""} need attention
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {visibleBundles.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-500/20"
                onClick={dismissAll}
              >
                Dismiss All
              </Button>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 font-semibold text-sm">
              <Package className="h-4 w-4" />
              {visibleBundles.reduce((sum, b) => sum + b.lowInventoryProducts.length, 0)} items
            </div>
          </div>
        </div>
        {/* Swipe hint for mobile */}
        <p className="text-xs text-orange-600/60 dark:text-orange-400/60 mt-2 md:hidden">
          Swipe left to dismiss alerts
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleBundles.slice(0, 3).map((bundle) => (
            <SwipeableAlertItem
              key={bundle.bundleId}
              bundle={bundle}
              onDismiss={() => dismissBundle(bundle.bundleId)}
              onNavigate={() => setLocation(`/manager/bundles/${bundle.bundleId}?highlight_low_inventory=true`)}
              onAlert={() => sendAlert.mutate({
                bundleId: bundle.bundleId,
                bundleTitle: bundle.bundleTitle,
                lowInventoryProducts: bundle.lowInventoryProducts,
              })}
              isAlertPending={sendAlert.isPending}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Fetch manager stats from API
  const { data: apiStats, isLoading: statsLoading } = trpc.stats.manager.useQuery(undefined, {
    staleTime: 60000,
  });

  // Fetch pending trainers
  const { data: pendingTrainers, isLoading: pendingLoading } = trpc.trainers.pending.useQuery(undefined, {
    staleTime: 30000,
  });

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading } = trpc.activity.recent.useQuery(
    { limit: 5 },
    { staleTime: 30000 }
  );

  // Fetch Shopify sync status
  const { data: syncStatus } = trpc.shopify.getBundleSyncStatus.useQuery(undefined, {
    staleTime: 60000,
  });

  // Approve trainer mutation
  const approveTrainer = trpc.trainers.approve.useMutation({
    onSuccess: () => {
      toast.success("Trainer approved successfully");
      utils.trainers.pending.invalidate();
      utils.stats.manager.invalidate();
    },
    onError: () => {
      toast.error("Failed to approve trainer");
    },
  });

  // Reject trainer mutation
  const rejectTrainer = trpc.trainers.reject.useMutation({
    onSuccess: () => {
      toast.success("Trainer application rejected");
      utils.trainers.pending.invalidate();
      utils.stats.manager.invalidate();
    },
    onError: () => {
      toast.error("Failed to reject trainer");
    },
  });

  // Display stats from API
  const displayStats = {
    totalTrainers: apiStats?.totalTrainers ?? 0,
    activeTrainers: apiStats?.activeTrainers ?? 0,
    pendingApprovals: apiStats?.pendingApprovals ?? 0,
    totalBundles: apiStats?.totalBundles ?? 0,
    publishedBundles: apiStats?.publishedBundles ?? 0,
    totalRevenue: apiStats?.totalRevenue ?? 0,
    monthlyGrowth: 12.5,
  };

  // Transform pending trainers for display
  const displayPendingApprovals = (pendingTrainers || []).map((t) => ({
    id: t.users.id,
    name: t.users.name || "Unknown",
    email: t.users.email || "No email",
    appliedAt: t.trainer_approvals.createdAt?.toISOString().split("T")[0] || "Unknown",
  }));

  // Transform activity for display
  const displayActivity = (recentActivity || []).map((a) => ({
    id: a.id,
    type: a.action?.includes("publish") ? "bundle_published" : a.action?.includes("approve") ? "trainer_approved" : "order_completed",
    trainer: "User",
    bundle: a.entityType || "",
    client: "",
    amount: 0,
    time: a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "Recently",
    entityType: a.entityType,
    entityId: a.entityId,
    action: a.action,
  }));

  // Get navigation link for activity item
  const getActivityLink = (activity: typeof displayActivity[0]) => {
    if (!activity.entityId) return null;
    if (activity.entityType === "bundle") return `/manager/bundles/${activity.entityId}`;
    if (activity.entityType === "trainer" || activity.action?.includes("trainer")) return `/manager/trainers/${activity.entityId}`;
    if (activity.entityType === "order") return `/manager/orders/${activity.entityId}`;
    if (activity.entityType === "user") return `/manager/trainers/${activity.entityId}`;
    return null;
  };

  if (statsLoading) {
    return (
      <AppShell title="Manager">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Manager">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Manager Dashboard</h1>
          <p className="text-sm text-muted-foreground">Platform overview & tasks</p>
        </div>

        {/* Coordinator Tools - Only visible to coordinators */}
        {user?.role === "coordinator" && (
          <Card className="mb-6 border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 dark:from-purple-500/10 dark:to-indigo-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-600 dark:text-purple-400">Superadmin Tools</h3>
                    <p className="text-sm text-purple-600/80 dark:text-purple-400/80">Test the app as any user</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setLocation("/dev/impersonate")}
                  className="bg-purple-600 hover:bg-purple-700 gap-2"
                >
                  <UserCog className="h-4 w-4" />
                  Impersonate
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid - 2x2 on mobile - All cards are clickable */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow hover:border-blue-300"
            onClick={() => setLocation("/manager/trainers")}
          >
            <CardContent className="p-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-lg font-bold">{displayStats.activeTrainers}</p>
              <p className="text-xs text-muted-foreground">Active Trainers</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow hover:border-green-300"
            onClick={() => setLocation("/manager/approvals")}
          >
            <CardContent className="p-4">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
                <Package className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-lg font-bold">{displayStats.publishedBundles}</p>
              <p className="text-xs text-muted-foreground">Published Bundles</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow hover:border-purple-300"
            onClick={() => setLocation("/manager/analytics")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex items-center text-xs text-green-500">
                  <TrendingUp className="h-3 w-3" />
                  +{displayStats.monthlyGrowth}%
                </div>
              </div>
              <p className="text-lg font-bold">${Number(displayStats.totalRevenue).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </CardContent>
          </Card>

          <Card 
            className="border-yellow-500/30 bg-yellow-500/10 cursor-pointer hover:shadow-md transition-shadow hover:border-yellow-500/50 dark:border-yellow-500/30 dark:bg-yellow-500/10"
            onClick={() => setLocation("/manager/approvals")}
          >
            <CardContent className="p-4">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center mb-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </div>
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{displayStats.pendingApprovals}</p>
              <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">Pending Approvals</p>
            </CardContent>
          </Card>
        </div>

        {/* Low Inventory Alerts */}
        <LowInventoryAlerts />

        {/* Bundle Performance Quick Link */}
        <Card 
          className="mb-6 cursor-pointer hover:shadow-md transition-shadow border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5"
          onClick={() => setLocation("/manager/bundle-performance")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Bundle Performance</h3>
                  <p className="text-sm text-muted-foreground">View analytics, conversion rates & top bundles</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Invitations Overview */}
        <Card 
          className="mb-6 cursor-pointer hover:shadow-md transition-shadow border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5"
          onClick={() => setLocation("/manager/invitations")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Bundle Invitations</h3>
                  <p className="text-sm text-muted-foreground">Track trainer invitations & conversion rates</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Shopify Sync Status */}
        {syncStatus && (syncStatus.synced > 0 || syncStatus.pending > 0 || syncStatus.failed > 0) && (
          <Card 
            className="mb-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setLocation("/manager/settings")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Store className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Shopify Sync Status</h3>
                    <p className="text-sm text-muted-foreground">Bundle synchronization with Shopify</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {syncStatus.synced > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-medium">
                      <CheckCircle className="h-3 w-3" />
                      {syncStatus.synced} Synced
                    </div>
                  )}
                  {syncStatus.pending > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-medium">
                      <RefreshCw className="h-3 w-3" />
                      {syncStatus.pending} Pending
                    </div>
                  )}
                  {syncStatus.failed > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium">
                      <AlertCircle className="h-3 w-3" />
                      {syncStatus.failed} Failed
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Approvals */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Pending Approvals</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/manager/trainers")}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pendingLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : displayPendingApprovals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>No pending approvals</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayPendingApprovals.slice(0, 3).map((trainer) => (
                  <div
                    key={trainer.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {trainer.name.split(" ").map((n: string) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-foreground truncate">{trainer.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{trainer.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          rejectTrainer.mutate({ trainerId: trainer.id });
                        }}
                        disabled={rejectTrainer.isPending}
                      >
                        Reject
                      </Button>
                      <Button 
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          approveTrainer.mutate({ trainerId: trainer.id });
                        }}
                        disabled={approveTrainer.isPending}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : displayActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 text-muted-foreground/50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayActivity.slice(0, 4).map((activity) => {
                  const link = getActivityLink(activity);
                  return (
                    <div 
                      key={activity.id} 
                      className={`flex items-start gap-3 ${link ? 'cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors' : ''}`}
                      onClick={() => link && setLocation(link)}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          activity.type === "bundle_published"
                            ? "bg-green-100"
                            : activity.type === "trainer_approved"
                            ? "bg-blue-100"
                            : "bg-purple-100"
                        }`}
                      >
                        {activity.type === "bundle_published" ? (
                          <Package className="h-4 w-4 text-green-600" />
                        ) : activity.type === "trainer_approved" ? (
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-foreground ${link ? 'group-hover:text-primary' : ''}`}>
                          {activity.type === "bundle_published" && (
                            <>Bundle published</>
                          )}
                          {activity.type === "trainer_approved" && (
                            <>User was approved as a trainer</>
                          )}
                          {activity.type === "order_completed" && (
                            <>Order completed</>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {activity.time}
                        </p>
                      </div>
                      {link && <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
