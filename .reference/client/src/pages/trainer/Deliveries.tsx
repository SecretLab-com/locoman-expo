import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Package, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Truck,
  User,
  Calendar,
  MapPin,
  Send,
  Loader2,
  CalendarClock,
  Check,
  X
} from "lucide-react";
import {
  StatsGridSkeleton,
  DeliveryListSkeleton,
  TabsSkeleton,
  PageHeaderSkeleton,
} from "@/components/skeletons";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SwipeableListItem } from "@/components/SwipeableListItem";

type DeliveryMethod = "in_person" | "locker" | "front_desk" | "shipped";

interface DeliveryItem {
  id: number;
  orderId: number;
  orderItemId: number;
  clientId: number;
  productName: string;
  quantity: number;
  status: string;
  scheduledDate: Date | null;
  deliveredAt: Date | null;
  confirmedAt: Date | null;
  trainerNotes: string | null;
  clientNotes: string | null;
  deliveryMethod: string | null;
  trackingNumber: string | null;
  createdAt: Date;
  clientName: string | null;
  clientEmail: string | null;
  orderNumber: string | null;
  rescheduleRequestedAt?: Date | null;
  rescheduleProposedDate?: Date | null;
  rescheduleReason?: string | null;
  rescheduleStatus?: string | null;
}

export default function TrainerDeliveries() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryItem | null>(null);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("in_person");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleDelivery, setRescheduleDelivery] = useState<DeliveryItem | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.productDeliveries.trainerStats.useQuery();
  const { data: pendingDeliveries, isLoading: pendingLoading, refetch: refetchPending } = trpc.productDeliveries.trainerPending.useQuery();
  const { data: allDeliveries, isLoading: allLoading, refetch: refetchAll } = trpc.productDeliveries.trainerList.useQuery({});

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([
      refetchStats(),
      refetchPending(),
      refetchAll(),
    ]);
  };

  const utils = trpc.useUtils();

  const markReadyMutation = trpc.productDeliveries.markReady.useMutation({
    onSuccess: () => {
      toast.success("Delivery marked as ready");
      utils.productDeliveries.trainerPending.invalidate();
      utils.productDeliveries.trainerList.invalidate();
      utils.productDeliveries.trainerStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const markDeliveredMutation = trpc.productDeliveries.markDelivered.useMutation({
    onSuccess: () => {
      toast.success("Product marked as delivered");
      setDeliveryDialogOpen(false);
      setSelectedDelivery(null);
      setDeliveryNotes("");
      setTrackingNumber("");
      utils.productDeliveries.trainerPending.invalidate();
      utils.productDeliveries.trainerList.invalidate();
      utils.productDeliveries.trainerStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const approveRescheduleMutation = trpc.productDeliveries.approveReschedule.useMutation({
    onSuccess: () => {
      toast.success("Reschedule approved - delivery date updated");
      setRescheduleDialogOpen(false);
      setRescheduleDelivery(null);
      utils.productDeliveries.trainerPending.invalidate();
      utils.productDeliveries.trainerList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectRescheduleMutation = trpc.productDeliveries.rejectReschedule.useMutation({
    onSuccess: () => {
      toast.success("Reschedule request rejected");
      setRescheduleDialogOpen(false);
      setRescheduleDelivery(null);
      utils.productDeliveries.trainerPending.invalidate();
      utils.productDeliveries.trainerList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleMarkDelivered = () => {
    if (!selectedDelivery) return;
    
    markDeliveredMutation.mutate({
      deliveryId: selectedDelivery.id,
      notes: deliveryNotes || undefined,
      deliveryMethod,
      trackingNumber: deliveryMethod === "shipped" ? trackingNumber : undefined,
    });
  };

  const openDeliveryDialog = (delivery: DeliveryItem) => {
    setSelectedDelivery(delivery);
    setDeliveryMethod("in_person");
    setDeliveryNotes("");
    setTrackingNumber("");
    setDeliveryDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: { color: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3" /> },
      ready: { color: "bg-blue-100 text-blue-700", icon: <Package className="h-3 w-3" /> },
      delivered: { color: "bg-green-100 text-green-700", icon: <Truck className="h-3 w-3" /> },
      confirmed: { color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="h-3 w-3" /> },
      disputed: { color: "bg-red-100 text-red-700", icon: <AlertTriangle className="h-3 w-3" /> },
    };
    const { color, icon } = config[status] || config.pending;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isLoading = statsLoading || pendingLoading || allLoading;

  if (isLoading) {
    return (
      <div className="container py-6 pb-24 space-y-6">
        <PageHeaderSkeleton showAction={false} />
        <StatsGridSkeleton count={5} columns={2} />
        <TabsSkeleton count={4} />
        <DeliveryListSkeleton count={4} />
      </div>
    );
  }

  if (!user || user.role !== "trainer") {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Trainer access required</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deliveredDeliveries = (allDeliveries || []).filter(d => d.status === "delivered");
  const confirmedDeliveries = (allDeliveries || []).filter(d => d.status === "confirmed");
  const disputedDeliveries = (allDeliveries || []).filter(d => d.status === "disputed");

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
    <div className="container py-6 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Product Deliveries</h1>
        <p className="text-muted-foreground">Manage product handoffs to your clients</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.pending || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Ready</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.ready || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Delivered</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.delivered || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Confirmed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.confirmed || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Disputed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.disputed || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">
            Pending ({(pendingDeliveries || []).length})
          </TabsTrigger>
          <TabsTrigger value="delivered">
            Delivered ({deliveredDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmed ({confirmedDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="disputed">
            Issues ({disputedDeliveries.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-4">
          {pendingLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          ) : (pendingDeliveries || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">All caught up! No pending deliveries.</p>
              </CardContent>
            </Card>
          ) : (
            (pendingDeliveries || []).map((delivery) => (
              <SwipeableListItem
                key={delivery.id}
                rightActions={[
                  {
                    icon: <Package className="h-5 w-5" />,
                    label: "Ready",
                    color: "text-white",
                    bgColor: "bg-blue-500",
                    onClick: () => markReadyMutation.mutate({ deliveryId: delivery.id }),
                  },
                  {
                    icon: <Send className="h-5 w-5" />,
                    label: "Deliver",
                    color: "text-white",
                    bgColor: "bg-green-500",
                    onClick: () => openDeliveryDialog(delivery as DeliveryItem),
                  },
                ]}
                className="rounded-lg overflow-hidden mb-2"
              >
                <Card className="border-0 shadow-none">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{delivery.productName}</span>
                          <span className="text-muted-foreground">×{delivery.quantity}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{delivery.clientName || "Unknown Client"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Ordered: {formatDate(delivery.createdAt)}</span>
                        </div>
                        {delivery.orderNumber && (
                          <div className="text-xs text-muted-foreground">
                            Order #{delivery.orderNumber}
                          </div>
                        )}
                        {(delivery as DeliveryItem).rescheduleStatus === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRescheduleDelivery(delivery as DeliveryItem);
                              setRescheduleDialogOpen(true);
                            }}
                            className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded mt-1 hover:bg-orange-100 transition-colors"
                          >
                            <CalendarClock className="h-3 w-3" />
                            <span>Reschedule requested</span>
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(delivery.status)}
                        <span className="text-xs text-muted-foreground">← Swipe for actions</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SwipeableListItem>
            ))
          )}
        </TabsContent>

        {/* Delivered Tab */}
        <TabsContent value="delivered" className="space-y-4">
          {deliveredDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No deliveries awaiting confirmation</p>
              </CardContent>
            </Card>
          ) : (
            deliveredDeliveries.map((delivery) => (
              <Card key={delivery.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{delivery.productName}</span>
                        <span className="text-muted-foreground">×{delivery.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{delivery.clientName || "Unknown Client"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Truck className="h-3 w-3" />
                        <span>Delivered: {formatDate(delivery.deliveredAt)}</span>
                      </div>
                      {delivery.trainerNotes && (
                        <p className="text-sm text-muted-foreground italic">
                          "{delivery.trainerNotes}"
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(delivery.status)}
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {delivery.deliveryMethod?.replace("_", " ") || "In person"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Confirmed Tab */}
        <TabsContent value="confirmed" className="space-y-4">
          {confirmedDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No confirmed deliveries yet</p>
              </CardContent>
            </Card>
          ) : (
            confirmedDeliveries.map((delivery) => (
              <Card key={delivery.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{delivery.productName}</span>
                        <span className="text-muted-foreground">×{delivery.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{delivery.clientName || "Unknown Client"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>Confirmed: {formatDate(delivery.confirmedAt)}</span>
                      </div>
                      {delivery.clientNotes && (
                        <p className="text-sm text-muted-foreground italic">
                          Client: "{delivery.clientNotes}"
                        </p>
                      )}
                    </div>
                    {getStatusBadge(delivery.status)}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Disputed Tab */}
        <TabsContent value="disputed" className="space-y-4">
          {disputedDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">No delivery issues reported</p>
              </CardContent>
            </Card>
          ) : (
            disputedDeliveries.map((delivery) => (
              <Card key={delivery.id} className="border-red-200">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{delivery.productName}</span>
                        <span className="text-muted-foreground">×{delivery.quantity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{delivery.clientName || "Unknown Client"}</span>
                      </div>
                      {delivery.clientNotes && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          <AlertTriangle className="h-4 w-4 inline mr-1" />
                          Issue: {delivery.clientNotes}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(delivery.status)}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Reschedule Review Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Request</DialogTitle>
            <DialogDescription>
              {rescheduleDelivery?.clientName} has requested to reschedule delivery of {rescheduleDelivery?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Current Date:</span>
                <span className="font-medium">{formatDate(rescheduleDelivery?.scheduledDate ?? null)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Proposed Date:</span>
                <span className="font-medium text-orange-600">
                  {rescheduleDelivery?.rescheduleProposedDate 
                    ? formatDate(new Date(rescheduleDelivery.rescheduleProposedDate))
                    : 'Not specified'}
                </span>
              </div>
              {rescheduleDelivery?.rescheduleReason && (
                <div className="pt-2 border-t">
                  <span className="text-sm text-muted-foreground block mb-1">Reason:</span>
                  <p className="text-sm italic">"{rescheduleDelivery.rescheduleReason}"</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Rejection Note (optional)</Label>
              <Textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Reason for rejecting (if declining)..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setRescheduleDialogOpen(false);
                setRescheduleDelivery(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => rescheduleDelivery && rejectRescheduleMutation.mutate({ 
                deliveryId: rescheduleDelivery.id,
                note: rejectNote || "Unable to accommodate this reschedule request"
              })}
              disabled={rejectRescheduleMutation.isPending}
            >
              {rejectRescheduleMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <X className="h-4 w-4 mr-2" />}
              Reject
            </Button>
            <Button 
              onClick={() => rescheduleDelivery && approveRescheduleMutation.mutate({ deliveryId: rescheduleDelivery.id })}
              disabled={approveRescheduleMutation.isPending}
            >
              {approveRescheduleMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Dialog */}
      <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Delivered</DialogTitle>
            <DialogDescription>
              Confirm delivery of {selectedDelivery?.productName} to {selectedDelivery?.clientName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delivery Method</Label>
              <Select value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as DeliveryMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="locker">Left in Locker</SelectItem>
                  <SelectItem value="front_desk">Left at Front Desk</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deliveryMethod === "shipped" && (
              <div className="space-y-2">
                <Label>Tracking Number (optional)</Label>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Any notes about the delivery..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkDelivered} disabled={markDeliveredMutation.isPending}>
              {markDeliveredMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}
