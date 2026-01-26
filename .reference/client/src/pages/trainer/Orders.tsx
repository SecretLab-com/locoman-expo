import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Loader2,
  MapPin,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// Use inferred types from tRPC
type Order = {
  id: number;
  shopifyOrderNumber: string | null;
  customerEmail: string | null;
  customerName: string | null;
  totalAmount: string | null;
  status: string | null;
  fulfillmentStatus: string | null;
  paymentStatus: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  trackingCompany?: string | null;
  estimatedDelivery?: Date | null;
  createdAt: Date;
  [key: string]: unknown;
};

type OrderItem = {
  id: number;
  name: string;
  quantity: number;
  price: string;
  fulfillmentStatus: string | null;
  [key: string]: unknown;
};

type OrderWithItems = Order & {
  items: OrderItem[];
};

export default function TrainerOrders() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const { data: orders, isLoading, refetch } = trpc.orders.listByTrainer.useQuery(undefined, {
    staleTime: 30000,
  });

  const { data: orderDetail, isLoading: detailLoading } = trpc.orders.byId.useQuery(
    { id: selectedOrder?.id || 0 },
    { enabled: !!selectedOrder?.id }
  );

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/");
    }
  }, [loading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (orderDetail) {
      setSelectedOrder(orderDetail as OrderWithItems);
    }
  }, [orderDetail]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-700"><Package className="h-3 w-3 mr-1" />Processing</Badge>;
      case "shipped":
        return <Badge className="bg-purple-100 text-purple-700"><Truck className="h-3 w-3 mr-1" />Shipped</Badge>;
      case "delivered":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status || "Unknown"}</Badge>;
    }
  };

  const getFulfillmentBadge = (status: string | null) => {
    switch (status) {
      case "unfulfilled":
        return <Badge variant="outline" className="border-orange-300 text-orange-700">Unfulfilled</Badge>;
      case "partial":
        return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>;
      case "fulfilled":
        return <Badge className="bg-green-100 text-green-700">Fulfilled</Badge>;
      default:
        return null;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order as OrderWithItems);
    setDetailSheetOpen(true);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <AppShell title="Orders" onRefresh={handleRefresh}>
      <div className="container py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Orders</h1>
            <p className="text-sm text-muted-foreground">Track customer orders and deliveries</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Orders List */}
        {orders && orders.length > 0 ? (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card
                key={order.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleOrderClick(order)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">
                          {order.shopifyOrderNumber || `#${order.id}`}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {order.customerName || order.customerEmail || "Unknown customer"}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{formatDate(order.createdAt)}</span>
                        {order.totalAmount && (
                          <span className="font-medium text-foreground">
                            ${parseFloat(order.totalAmount).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getFulfillmentBadge(order.fulfillmentStatus)}
                      {order.trackingNumber && (
                        <div className="flex items-center text-xs text-blue-600">
                          <Truck className="h-3 w-3 mr-1" />
                          Tracking available
                        </div>
                      )}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">No orders yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Orders from your published bundles will appear here
              </p>
              <Button onClick={() => setLocation("/trainer/bundles")}>
                View Your Bundles
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Order Detail Sheet */}
      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Order {selectedOrder?.shopifyOrderNumber || `#${selectedOrder?.id}`}
            </SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : selectedOrder ? (
            <div className="mt-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedOrder.status)}
                {getFulfillmentBadge(selectedOrder.fulfillmentStatus)}
              </div>

              {/* Customer Info */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Customer</h4>
                <p className="font-medium text-foreground">
                  {selectedOrder.customerName || "Unknown"}
                </p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customerEmail}</p>
              </div>

              {/* Order Total */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Order Total</h4>
                <p className="text-2xl font-bold text-foreground">
                  ${selectedOrder.totalAmount ? parseFloat(selectedOrder.totalAmount).toFixed(2) : "0.00"}
                </p>
              </div>

              {/* Tracking Info */}
              {selectedOrder.trackingNumber && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Truck className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground">Shipment Tracking</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedOrder.trackingCompany || "Carrier"}: {selectedOrder.trackingNumber}
                        </p>
                        {selectedOrder.estimatedDelivery && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3 inline mr-1" />
                            Est. delivery: {formatDate(selectedOrder.estimatedDelivery)}
                          </p>
                        )}
                        {selectedOrder.trackingUrl && (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto mt-2 text-blue-600"
                            onClick={() => window.open(selectedOrder.trackingUrl!, "_blank")}
                          >
                            Track Package <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Order Items */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Items</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {item.name || "Unknown product"}
                          </p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-foreground">
                            ${item.price ? parseFloat(item.price).toFixed(2) : "0.00"}
                          </p>
                          {item.fulfillmentStatus && (
                            <span className="text-xs text-muted-foreground">{item.fulfillmentStatus}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Date */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Order placed: {formatDate(selectedOrder.createdAt)}
                </p>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
