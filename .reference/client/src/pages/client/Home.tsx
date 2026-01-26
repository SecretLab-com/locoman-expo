import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/AvatarUpload";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Dumbbell,
  Package,
  MessageSquare,
  ShoppingCart,
  ChevronRight,
  Truck,
  Bell,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function ClientHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch client's subscriptions
  const { data: subscriptions, isLoading: subsLoading } = trpc.subscriptions.listByClient.useQuery({ clientId: user?.id || 0 });
  
  // Fetch client's upcoming sessions
  const { data: sessions, isLoading: sessionsLoading } = trpc.calendar.events.useQuery();
  
  // Fetch client's recent orders
  const { data: orders, isLoading: ordersLoading } = trpc.orders.listByClient.useQuery(
    { clientId: user?.id || 0 },
    { enabled: !!user?.id }
  );
  
  // Fetch products for suggestions
  const { data: products } = trpc.shopify.products.useQuery();

  const isLoading = subsLoading || sessionsLoading || ordersLoading;

  // Get active subscription
  const activeSubscription = subscriptions?.find((s: { status: string | null }) => s.status === "active");
  
  // Get upcoming sessions (next 2)
  const upcomingSessions = (sessions || [])
    .filter((s: { startTime: Date }) => new Date(s.startTime) > new Date())
    .slice(0, 2);
  
  // Get recent orders (last 2)
  const recentOrders = (orders || []).slice(0, 2);
  
  // Get suggested products (first 2)
  const suggestedProducts = (products || []).slice(0, 2);

  const utils = trpc.useUtils();

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([
      utils.subscriptions.listByClient.invalidate(),
      utils.calendar.events.invalidate(),
      utils.orders.listByClient.invalidate(),
      utils.shopify.products.invalidate(),
    ]);
  };

  if (isLoading) {
    return (
      <AppShell title="Home">
        <div className="container py-4 pb-24">
          {/* Header Skeleton */}
          <div className="mb-6 space-y-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Active Subscription Skeleton */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Sessions Skeleton */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Orders Skeleton */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-8 w-20" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Actions Skeleton */}
          <Card>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Home" onRefresh={handleRefresh}>
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">
            Welcome back, {user?.name?.split(" ")[0] || "there"}!
          </h1>
          <p className="text-sm text-muted-foreground">Here's your wellness journey at a glance</p>
        </div>

        {/* Active Subscription */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Subscription</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/client/subscriptions")}>
                Manage
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activeSubscription ? (
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
                  <Package className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">Bundle #{activeSubscription.bundlePublicationId}</h3>
                  <p className="text-sm text-muted-foreground">
                    ${Number(activeSubscription.price).toFixed(2)}/{activeSubscription.subscriptionType}
                  </p>
                  {activeSubscription.renewalDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Renews {new Date(activeSubscription.renewalDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Package className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No active subscription</p>
                <Button size="sm" className="mt-2" onClick={() => setLocation("/catalog")}>
                  Browse Bundles
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Sessions */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Upcoming Sessions</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/client/calendar")}>
                Calendar
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length > 0 ? (
              <div className="space-y-3">
                {upcomingSessions.map((session: { id: number; title: string; startTime: Date; eventType?: string | null }) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      session.eventType === "session" ? "bg-blue-100" : "bg-purple-100"
                    }`}>
                      {session.eventType === "session" ? (
                        <Dumbbell className="h-5 w-5 text-blue-600" />
                      ) : (
                        <MessageSquare className="h-5 w-5 text-purple-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {session.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(session.startTime).toLocaleDateString()} at{" "}
                        {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Dumbbell className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No upcoming sessions</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Orders</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLocation("/client/orders")}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order: { id: number; shopifyOrderId?: number | null; shopifyOrderNumber?: string | null; createdAt: Date; fulfillmentStatus?: string | null }) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        order.fulfillmentStatus === "fulfilled" ? "bg-green-100" : "bg-blue-100"
                      }`}>
                        {order.fulfillmentStatus === "fulfilled" ? (
                          <Package className="h-5 w-5 text-green-600" />
                        ) : (
                          <Truck className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">
                          Order #{order.shopifyOrderNumber || order.id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge className={
                      order.fulfillmentStatus === "fulfilled"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }>
                      {order.fulfillmentStatus || "processing"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Truck className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No recent orders</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suggested Products */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-600" />
              Suggested for You
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suggestedProducts.length > 0 ? (
              <div className="space-y-3">
                {suggestedProducts.map((product) => (
                  <div key={product.id} className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-foreground truncate">{product.title}</div>
                        <div className="text-xs text-blue-600">{product.vendor || "Recommended"}</div>
                      </div>
                      <span className="font-semibold text-sm ml-2">${product.price}</span>
                    </div>
                    <Button size="sm" className="w-full mt-2">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Add to Cart
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No suggestions available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/catalog")}>
              <ShoppingCart className="h-4 w-4 mr-3" />
              Browse Catalog
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/client/subscriptions")}>
              <Package className="h-4 w-4 mr-3" />
              Manage Subscription
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => setLocation("/client/orders")}>
              <Truck className="h-4 w-4 mr-3" />
              Track Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
