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
import { toast } from "sonner";
import { Link } from "wouter";
import { 
  Package, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Truck,
  User,
  Calendar,
  RefreshCw,
  DollarSign,
  XCircle,
  Loader2,
  ChevronRight,
  FileText
} from "lucide-react";
import {
  StatsGridSkeleton,
  DeliveryListSkeleton,
  TabsSkeleton,
  PageHeaderSkeleton,
} from "@/components/skeletons";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppShell } from "@/components/AppShell";

type ResolutionType = "refund" | "redeliver" | "close" | "escalate";

interface DeliveryItem {
  id: number;
  orderId: number;
  orderItemId: number;
  clientId: number;
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
  clientName: string | null;
  clientEmail: string | null;
  trainerName: string | null;
  orderNumber: string | null;
  resolvedAt?: Date | null;
  resolvedBy?: number | null;
  resolutionType?: string | null;
  resolutionNotes?: string | null;
}

export default function ManagerDeliveries() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("disputed");
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryItem | null>(null);
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [resolutionType, setResolutionType] = useState<ResolutionType>("close");
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: deliveries, isLoading, refetch } = trpc.productDeliveries.managerList.useQuery({});

  const utils = trpc.useUtils();

  const resolveMutation = trpc.productDeliveries.resolveDispute.useMutation({
    onSuccess: () => {
      toast.success("Dispute resolved successfully");
      setResolutionDialogOpen(false);
      setSelectedDelivery(null);
      setResolutionNotes("");
      utils.productDeliveries.managerList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleRefresh = async () => {
    await refetch();
  };

  const openResolutionDialog = (delivery: DeliveryItem) => {
    setSelectedDelivery(delivery);
    setResolutionType("close");
    setResolutionNotes("");
    setResolutionDialogOpen(true);
  };

  const handleResolve = () => {
    if (!selectedDelivery) return;
    
    resolveMutation.mutate({
      deliveryId: selectedDelivery.id,
      resolutionType,
      notes: resolutionNotes || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: { color: "bg-yellow-100 text-yellow-700", icon: <Clock className="h-3 w-3" /> },
      ready: { color: "bg-blue-100 text-blue-700", icon: <Package className="h-3 w-3" /> },
      delivered: { color: "bg-green-100 text-green-700", icon: <Truck className="h-3 w-3" /> },
      confirmed: { color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle className="h-3 w-3" /> },
      disputed: { color: "bg-red-100 text-red-700", icon: <AlertTriangle className="h-3 w-3" /> },
      resolved: { color: "bg-gray-100 text-gray-700", icon: <FileText className="h-3 w-3" /> },
    };
    const { color, icon } = config[status] || config.pending;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        {icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getResolutionBadge = (type: string | null | undefined) => {
    if (!type) return null;
    const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      refund: { color: "bg-purple-100 text-purple-700", icon: <DollarSign className="h-3 w-3" />, label: "Refunded" },
      redeliver: { color: "bg-blue-100 text-blue-700", icon: <RefreshCw className="h-3 w-3" />, label: "Redelivered" },
      close: { color: "bg-gray-100 text-gray-700", icon: <XCircle className="h-3 w-3" />, label: "Closed" },
      escalate: { color: "bg-orange-100 text-orange-700", icon: <AlertTriangle className="h-3 w-3" />, label: "Escalated" },
    };
    const { color, icon, label } = config[type] || config.close;
    return (
      <Badge className={`${color} flex items-center gap-1`}>
        {icon}
        {label}
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

  if (isLoading) {
    return (
      <AppShell title="Deliveries">
        <div className="container py-6 pb-24 space-y-6">
          <PageHeaderSkeleton showAction={false} />
          <StatsGridSkeleton count={4} columns={2} />
          <TabsSkeleton count={3} />
          <DeliveryListSkeleton count={4} />
        </div>
      </AppShell>
    );
  }

  if (!user || !["manager", "coordinator"].includes(user.role)) {
    return (
      <AppShell title="Deliveries">
        <div className="container py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Manager access required</p>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  const disputedDeliveries = (deliveries || []).filter((d: DeliveryItem) => d.status === "disputed");
  const resolvedDeliveries = (deliveries || []).filter((d: DeliveryItem) => d.status === "resolved");
  const allDeliveries = deliveries || [];

  // Stats
  const stats = {
    total: allDeliveries.length,
    disputed: disputedDeliveries.length,
    resolved: resolvedDeliveries.length,
    pending: allDeliveries.filter((d: DeliveryItem) => d.status === "pending").length,
  };

  return (
    <AppShell title="Deliveries">
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
    <div className="container py-6 pb-24 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Delivery Management</h1>
        <p className="text-muted-foreground">Review and resolve delivery disputes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className={stats.disputed > 0 ? "border-red-200" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${stats.disputed > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <span className="text-sm text-muted-foreground">Disputed</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${stats.disputed > 0 ? "text-red-600" : ""}`}>{stats.disputed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Resolved</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.resolved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="disputed" className="relative">
            Disputes
            {stats.disputed > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {stats.disputed}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({stats.resolved})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({stats.total})
          </TabsTrigger>
        </TabsList>

        {/* Disputed Tab */}
        <TabsContent value="disputed" className="space-y-4">
          {disputedDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">No active disputes</p>
              </CardContent>
            </Card>
          ) : (
            disputedDeliveries.map((delivery: DeliveryItem) => (
              <Card key={delivery.id} className="border-red-200">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{delivery.productName}</span>
                        <span className="text-muted-foreground">×{delivery.quantity}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <Link href={`/manager/clients/${delivery.clientId}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <User className="h-3 w-3" />
                          <span>{delivery.clientName || "Unknown Client"}</span>
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                        <Link href={`/manager/trainers/${delivery.trainerId}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <User className="h-3 w-3" />
                          <span>{delivery.trainerName || "Unknown Trainer"}</span>
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Delivered: {formatDate(delivery.deliveredAt)}</span>
                      </div>

                      {delivery.clientNotes && (
                        <div className="mt-2 p-3 bg-red-50 rounded-lg text-sm">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                            <div>
                              <p className="font-medium text-red-800">Client Issue:</p>
                              <p className="text-red-700">{delivery.clientNotes}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {delivery.trainerNotes && (
                        <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                          <p className="font-medium text-blue-800">Trainer Notes:</p>
                          <p className="text-blue-700">{delivery.trainerNotes}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(delivery.status)}
                      <Button 
                        size="sm" 
                        onClick={() => openResolutionDialog(delivery as DeliveryItem)}
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Resolved Tab */}
        <TabsContent value="resolved" className="space-y-4">
          {resolvedDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No resolved disputes yet</p>
              </CardContent>
            </Card>
          ) : (
            resolvedDeliveries.map((delivery: DeliveryItem) => (
              <Card key={delivery.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{delivery.productName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{delivery.clientName}</span>
                        <span>•</span>
                        <span>{delivery.trainerName}</span>
                      </div>
                      {delivery.resolutionNotes && (
                        <p className="text-sm text-muted-foreground italic">
                          "{delivery.resolutionNotes}"
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Resolved: {formatDate(delivery.resolvedAt ?? null)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(delivery.status)}
                      {getResolutionBadge(delivery.resolutionType)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* All Tab */}
        <TabsContent value="all" className="space-y-4">
          {allDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No deliveries found</p>
              </CardContent>
            </Card>
          ) : (
            allDeliveries.map((delivery: DeliveryItem) => (
              <Card key={delivery.id} className={delivery.status === "disputed" ? "border-red-200" : ""}>
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
                        <span>{delivery.clientName}</span>
                        <span>→</span>
                        <span>{delivery.trainerName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(delivery.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(delivery.status)}
                      {delivery.status === "disputed" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openResolutionDialog(delivery as DeliveryItem)}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Resolution Dialog */}
      <Dialog open={resolutionDialogOpen} onOpenChange={setResolutionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              Choose a resolution for the dispute regarding {selectedDelivery?.productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dispute Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Product:</span>
                <span className="font-medium">{selectedDelivery?.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Client:</span>
                <span className="font-medium">{selectedDelivery?.clientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Trainer:</span>
                <span className="font-medium">{selectedDelivery?.trainerName}</span>
              </div>
              {selectedDelivery?.clientNotes && (
                <div className="pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Issue:</span>
                  <p className="text-sm mt-1">{selectedDelivery.clientNotes}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Resolution Type</Label>
              <Select value={resolutionType} onValueChange={(v) => setResolutionType(v as ResolutionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refund">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <span>Issue Refund</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="redeliver">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      <span>Arrange Redelivery</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="close">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      <span>Close Without Action</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="escalate">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Escalate to Support</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add notes about this resolution..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResolutionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Resolve Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
    </AppShell>
  );
}
