import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  unfulfilled: { color: "bg-blue-100 text-blue-700", icon: Clock, label: "Processing" },
  partial: { color: "bg-yellow-100 text-yellow-700", icon: Truck, label: "Partially Shipped" },
  fulfilled: { color: "bg-green-100 text-green-700", icon: CheckCircle, label: "Delivered" },
  restocked: { color: "bg-muted text-foreground", icon: Package, label: "Restocked" },
};

type Order = {
  id: number;
  shopifyOrderNumber?: string | null;
  totalPrice?: string | null;
  fulfillmentStatus?: string | null;
  financialStatus?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  createdAt: Date;
};

export default function ClientOrders() {
  const [, setLocation] = useLocation();

  // Fetch orders for the current client
  const { data: orders, isLoading } = trpc.orders.listByTrainer.useQuery();

  const activeOrders = (orders || []).filter((o: Order) => o.fulfillmentStatus !== "fulfilled");
  const pastOrders = (orders || []).filter((o: Order) => o.fulfillmentStatus === "fulfilled");

  if (isLoading) {
    return (
      <AppShell title="My Orders">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="My Orders">
      <div className="container py-4 pb-24 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">My Orders</h1>
          <p className="text-sm text-muted-foreground">Track your orders and view order history</p>
        </div>

        <Tabs defaultValue="active">
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              Active ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              History ({pastOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            {activeOrders.length > 0 ? (
              <div className="space-y-4">
                {activeOrders.map((order: Order) => {
                  const status = statusConfig[order.fulfillmentStatus || "unfulfilled"] || statusConfig.unfulfilled;
                  const StatusIcon = status.icon;

                  return (
                    <Card key={order.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">
                                Order #{order.shopifyOrderNumber || order.id}
                              </h3>
                              <Badge className={status.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Placed on {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-foreground">
                              ${Number(order.totalPrice || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Tracking info */}
                        {order.trackingNumber && (
                          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Truck className="h-4 w-4 text-blue-600" />
                                  <span className="font-medium text-sm text-blue-900">
                                    Tracking: {order.trackingNumber}
                                  </span>
                                </div>
                              </div>
                              {order.trackingUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(order.trackingUrl!, "_blank")}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                        {!order.trackingNumber && (
                          <div className="p-3 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                Tracking info will be available once shipped
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="font-semibold text-foreground mb-2">No active orders</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Your orders will appear here once you make a purchase
                  </p>
                  <Button onClick={() => setLocation("/catalog")}>Browse Catalog</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {pastOrders.length > 0 ? (
              <div className="space-y-4">
                {pastOrders.map((order: Order) => {
                  const status = statusConfig[order.fulfillmentStatus || "fulfilled"] || statusConfig.fulfilled;
                  const StatusIcon = status.icon;

                  return (
                    <Card key={order.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground">
                                Order #{order.shopifyOrderNumber || order.id}
                              </h3>
                              <Badge className={status.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Placed on {new Date(order.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-foreground">
                              ${Number(order.totalPrice || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Delivered
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <Button variant="outline" size="sm" onClick={() => setLocation("/catalog")}>
                            Reorder
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="font-semibold text-foreground mb-2">No order history</h3>
                  <p className="text-muted-foreground text-sm">Your completed orders will appear here</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
