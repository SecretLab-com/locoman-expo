import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  ThumbsUp,
  Flag,
  Loader2,
  CalendarClock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  StatsGridSkeleton,
  DeliveryListSkeleton,
  TabsSkeleton,
  PageHeaderSkeleton,
} from "@/components/skeletons";
import { PullToRefresh } from "@/components/PullToRefresh";
import { SwipeableListItem } from "@/components/SwipeableListItem";
import { triggerHaptic } from "@/hooks/useHaptic";

interface DeliveryItem {
  id: number;
  orderId: number;
  orderItemId: number;
  trainerId: number;
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
  trainerName: string | null;
  orderNumber: string | null;
}

export default function ClientDeliveries() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryItem | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");

  const { data: deliveries, isLoading, refetch } = trpc.productDeliveries.clientList.useQuery({});

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await refetch();
  };

  const utils = trpc.useUtils();

  const confirmReceiptMutation = trpc.productDeliveries.confirmReceipt.useMutation({
    onSuccess: () => {
      triggerHaptic('success');
      toast.success("Delivery confirmed! Thank you.");
      setConfirmDialogOpen(false);
      setSelectedDelivery(null);
      setConfirmNotes("");
      utils.productDeliveries.clientList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reportIssueMutation = trpc.productDeliveries.reportIssue.useMutation({
    onSuccess: () => {
      triggerHaptic('warning');
      toast.success("Issue reported. Your trainer will be notified.");
      setIssueDialogOpen(false);
      setSelectedDelivery(null);
      setIssueNotes("");
      utils.productDeliveries.clientList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const requestRescheduleMutation = trpc.productDeliveries.requestReschedule.useMutation({
    onSuccess: () => {
      triggerHaptic('success');
      toast.success("Reschedule request sent to your trainer.");
      setRescheduleDialogOpen(false);
      setSelectedDelivery(null);
      setRescheduleDate("");
      setRescheduleReason("");
      utils.productDeliveries.clientList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleConfirmReceipt = () => {
    if (!selectedDelivery) return;
    confirmReceiptMutation.mutate({
      deliveryId: selectedDelivery.id,
      notes: confirmNotes || undefined,
    });
  };

  const handleReportIssue = () => {
    if (!selectedDelivery || issueNotes.length < 10) {
      toast.error("Please provide more details about the issue");
      return;
    }
    reportIssueMutation.mutate({
      deliveryId: selectedDelivery.id,
      notes: issueNotes,
    });
  };

  const openConfirmDialog = (delivery: DeliveryItem) => {
    setSelectedDelivery(delivery);
    setConfirmNotes("");
    setConfirmDialogOpen(true);
  };

  const openIssueDialog = (delivery: DeliveryItem) => {
    setSelectedDelivery(delivery);
    setIssueNotes("");
    setIssueDialogOpen(true);
  };

  const openRescheduleDialog = (delivery: DeliveryItem) => {
    setSelectedDelivery(delivery);
    setRescheduleDate("");
    setRescheduleReason("");
    setRescheduleDialogOpen(true);
  };

  const handleRequestReschedule = () => {
    if (!selectedDelivery || !rescheduleDate || rescheduleReason.length < 5) {
      toast.error("Please provide a date and reason for rescheduling");
      return;
    }
    requestRescheduleMutation.mutate({
      deliveryId: selectedDelivery.id,
      proposedDate: new Date(rescheduleDate),
      reason: rescheduleReason,
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3" />, label: "Processing" },
      ready: { color: "bg-blue-100 text-blue-700", icon: <Package className="h-3 w-3" />, label: "Ready for Pickup" },
      delivered: { color: "bg-green-100 text-green-700", icon: <Truck className="h-3 w-3" />, label: "Delivered" },
      confirmed: { color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="h-3 w-3" />, label: "Received" },
      disputed: { color: "bg-red-100 text-red-700", icon: <AlertTriangle className="h-3 w-3" />, label: "Issue Reported" },
    };
    const { color, icon, label } = config[status] || config.pending;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        {icon}
        {label}
      </Badge>
    );
  };

  const getDeliveryMethodLabel = (method: string | null) => {
    const labels: Record<string, string> = {
      in_person: "Handed to you",
      locker: "Left in locker",
      front_desk: "Left at front desk",
      shipped: "Shipped",
    };
    return labels[method || ""] || "In person";
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="container py-6 pb-24 space-y-6">
        <PageHeaderSkeleton showAction={false} />
        <StatsGridSkeleton count={4} columns={2} />
        <TabsSkeleton count={4} />
        <DeliveryListSkeleton count={4} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Please log in to view your deliveries</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingDeliveries = (deliveries || []).filter(d => ["pending", "ready"].includes(d.status));
  const awaitingConfirmation = (deliveries || []).filter(d => d.status === "delivered");
  const confirmedDeliveries = (deliveries || []).filter(d => d.status === "confirmed");
  const disputedDeliveries = (deliveries || []).filter(d => d.status === "disputed");

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
    <div className="container py-6 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Deliveries</h1>
        <p className="text-muted-foreground">Track products from your bundles</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">In Progress</span>
            </div>
            <p className="text-2xl font-bold mt-1">{pendingDeliveries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">To Confirm</span>
            </div>
            <p className="text-2xl font-bold mt-1">{awaitingConfirmation.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Received</span>
            </div>
            <p className="text-2xl font-bold mt-1">{confirmedDeliveries.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Issues</span>
            </div>
            <p className="text-2xl font-bold mt-1">{disputedDeliveries.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">
            In Progress ({pendingDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="delivered">
            To Confirm ({awaitingConfirmation.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Received ({confirmedDeliveries.length})
          </TabsTrigger>
          <TabsTrigger value="issues">
            Issues ({disputedDeliveries.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          ) : pendingDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No deliveries in progress</p>
              </CardContent>
            </Card>
          ) : (
            pendingDeliveries.map((delivery) => (
              <Card key={delivery.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{delivery.productName}</span>
                        <span className="text-muted-foreground">×{delivery.quantity}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/u/${delivery.trainerId}`;
                        }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <User className="h-3 w-3" />
                        <span>From: {delivery.trainerName || "Your Trainer"}</span>
                      </button>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Ordered: {formatDate(delivery.createdAt)}</span>
                      </div>
                      {delivery.scheduledDate && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                          <Calendar className="h-3 w-3" />
                          <span>Scheduled: {formatDate(delivery.scheduledDate)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(delivery.status)}
                      {(delivery.status === "pending" || delivery.status === "ready") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRescheduleDialog(delivery as DeliveryItem)}
                          className="text-xs"
                        >
                          <CalendarClock className="h-3 w-3 mr-1" />
                          Reschedule
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Delivered Tab - Awaiting Confirmation */}
        <TabsContent value="delivered" className="space-y-4">
          {awaitingConfirmation.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No deliveries awaiting your confirmation</p>
              </CardContent>
            </Card>
          ) : (
            awaitingConfirmation.map((delivery) => (
              <SwipeableListItem
                key={delivery.id}
                leftActions={[
                  {
                    icon: <Flag className="h-5 w-5" />,
                    label: "Issue",
                    color: "text-white",
                    bgColor: "bg-orange-500",
                    onClick: () => openIssueDialog(delivery as DeliveryItem),
                  },
                ]}
                rightActions={[
                  {
                    icon: <ThumbsUp className="h-5 w-5" />,
                    label: "Confirm",
                    color: "text-white",
                    bgColor: "bg-green-500",
                    onClick: () => openConfirmDialog(delivery as DeliveryItem),
                  },
                ]}
                className="rounded-lg overflow-hidden mb-2"
              >
                <Card className="border-green-200 border-0 shadow-none">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{delivery.productName}</span>
                          <span className="text-muted-foreground">×{delivery.quantity}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/u/${delivery.trainerId}`;
                          }}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <User className="h-3 w-3" />
                          <span>From: {delivery.trainerName || "Your Trainer"}</span>
                        </button>
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Truck className="h-3 w-3" />
                          <span>Delivered: {formatDate(delivery.deliveredAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{getDeliveryMethodLabel(delivery.deliveryMethod)}</span>
                        </div>
                        {delivery.trainerNotes && (
                          <p className="text-sm text-muted-foreground italic mt-2">
                            Note: "{delivery.trainerNotes}"
                          </p>
                        )}
                        {delivery.trackingNumber && (
                          <p className="text-sm text-blue-600">
                            Tracking: {delivery.trackingNumber}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground mt-1 block">← Swipe for actions →</span>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(delivery.status)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SwipeableListItem>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/u/${delivery.trainerId}`;
                        }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <User className="h-3 w-3" />
                        <span>From: {delivery.trainerName || "Your Trainer"}</span>
                      </button>
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>Received: {formatDate(delivery.confirmedAt)}</span>
                      </div>
                    </div>
                    {getStatusBadge(delivery.status)}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="space-y-4">
          {disputedDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">No delivery issues</p>
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/u/${delivery.trainerId}`;
                        }}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                      >
                        <User className="h-3 w-3" />
                        <span>From: {delivery.trainerName || "Your Trainer"}</span>
                      </button>
                      {delivery.clientNotes && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          <AlertTriangle className="h-4 w-4 inline mr-1" />
                          Your report: {delivery.clientNotes}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground mt-2">
                        Your trainer has been notified and will contact you soon.
                      </p>
                    </div>
                    {getStatusBadge(delivery.status)}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm Receipt Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Receipt</DialogTitle>
            <DialogDescription>
              Confirm that you received {selectedDelivery?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{selectedDelivery?.productName}</span>
                <span className="text-muted-foreground">×{selectedDelivery?.quantity}</span>
              </div>
              <button
                onClick={() => {
                  setConfirmDialogOpen(false);
                  window.location.href = `/u/${selectedDelivery?.trainerId}`;
                }}
                className="text-sm text-muted-foreground mt-1 hover:text-primary transition-colors"
              >
                From: {selectedDelivery?.trainerName}
              </button>
            </div>

            <div className="space-y-2">
              <Label>Feedback (optional)</Label>
              <Textarea
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="Any comments about the delivery..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmReceipt} disabled={confirmReceiptMutation.isPending}>
              {confirmReceiptMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <ThumbsUp className="h-4 w-4 mr-2" />
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              Let us know what went wrong with your delivery
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{selectedDelivery?.productName}</span>
                <span className="text-muted-foreground">×{selectedDelivery?.quantity}</span>
              </div>
              <button
                onClick={() => {
                  setIssueDialogOpen(false);
                  window.location.href = `/u/${selectedDelivery?.trainerId}`;
                }}
                className="text-sm text-muted-foreground mt-1 hover:text-primary transition-colors"
              >
                From: {selectedDelivery?.trainerName}
              </button>
            </div>

            <div className="space-y-2">
              <Label>Describe the issue *</Label>
              <Textarea
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                placeholder="Please describe what went wrong (e.g., wrong item, damaged, not received)..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 10 characters required
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReportIssue} 
              disabled={reportIssueMutation.isPending || issueNotes.length < 10}
            >
              {reportIssueMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Flag className="h-4 w-4 mr-2" />
              Report Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Reschedule</DialogTitle>
            <DialogDescription>
              Propose a new delivery date for your product
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{selectedDelivery?.productName}</span>
                <span className="text-muted-foreground">×{selectedDelivery?.quantity}</span>
              </div>
              <button
                onClick={() => {
                  setRescheduleDialogOpen(false);
                  window.location.href = `/u/${selectedDelivery?.trainerId}`;
                }}
                className="text-sm text-muted-foreground mt-1 hover:text-primary transition-colors"
              >
                From: {selectedDelivery?.trainerName}
              </button>
              {selectedDelivery?.scheduledDate && (
                <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                  <Calendar className="h-3 w-3" />
                  <span>Currently scheduled: {formatDate(selectedDelivery.scheduledDate)}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Preferred new date *</Label>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason for reschedule *</Label>
              <Textarea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                placeholder="Please explain why you need to reschedule..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 5 characters required
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRequestReschedule} 
              disabled={requestRescheduleMutation.isPending || !rescheduleDate || rescheduleReason.length < 5}
            >
              {requestRescheduleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CalendarClock className="h-4 w-4 mr-2" />
              Request Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
}
