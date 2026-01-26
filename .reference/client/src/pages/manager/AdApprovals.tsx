import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Building2,
  Handshake,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Loader2,
  TrendingUp,
} from "lucide-react";

type BusinessApplication = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  category: string | null;
  contactName: string | null;
  description: string | null;
  createdAt: Date;
  referringTrainer: { id: number; name: string | null; email: string | null } | null;
};

type PartnershipApplication = {
  id: number;
  packageTier: string;
  monthlyFee: string;
  bonusPointsAwarded: number | null;
  notes: string | null;
  createdAt: Date;
  business: { id: number; name: string; email: string; category: string | null } | null;
  trainer: { id: number; name: string | null; email: string | null } | null;
};

export default function AdApprovals() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ type: "business" | "partnership"; id: number } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: stats, isLoading: statsLoading } = trpc.adApprovals.stats.useQuery();
  const { data: pendingBusinesses, isLoading: businessesLoading } = trpc.adApprovals.pendingBusinesses.useQuery();
  const { data: pendingPartnerships, isLoading: partnershipsLoading } = trpc.adApprovals.pendingPartnerships.useQuery();

  const approveBusiness = trpc.adApprovals.approveBusiness.useMutation({
    onSuccess: () => {
      toast.success("Business approved successfully");
      utils.adApprovals.pendingBusinesses.invalidate();
      utils.adApprovals.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectBusiness = trpc.adApprovals.rejectBusiness.useMutation({
    onSuccess: () => {
      toast.success("Business application rejected");
      utils.adApprovals.pendingBusinesses.invalidate();
      utils.adApprovals.stats.invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const approvePartnership = trpc.adApprovals.approvePartnership.useMutation({
    onSuccess: () => {
      toast.success("Partnership approved successfully");
      utils.adApprovals.pendingPartnerships.invalidate();
      utils.adApprovals.stats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const rejectPartnership = trpc.adApprovals.rejectPartnership.useMutation({
    onSuccess: () => {
      toast.success("Partnership application rejected");
      utils.adApprovals.pendingPartnerships.invalidate();
      utils.adApprovals.stats.invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (err) => toast.error(err.message),
  });

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(typeof amount === "string" ? parseFloat(amount) : amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getCategoryLabel = (category: string | null) => {
    const labels: Record<string, string> = {
      sports_nutrition: "Sports Nutrition",
      fitness_equipment: "Fitness Equipment",
      physiotherapy: "Physiotherapy",
      healthy_food: "Healthy Food",
      sports_retail: "Sports Retail",
      wellness_recovery: "Wellness & Recovery",
      gym_studio: "Gym/Studio",
      health_insurance: "Health Insurance",
      sports_events: "Sports Events",
      other: "Other",
    };
    return labels[category || ""] || category || "Unknown";
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "bronze": return "bg-amber-700 text-white";
      case "silver": return "bg-gray-400 text-white";
      case "gold": return "bg-yellow-500 text-white";
      case "platinum": return "bg-slate-700 text-white";
      default: return "bg-muted";
    }
  };

  const handleReject = () => {
    if (!rejectTarget || !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    if (rejectTarget.type === "business") {
      rejectBusiness.mutate({ businessId: rejectTarget.id, reason: rejectReason });
    } else {
      rejectPartnership.mutate({ partnershipId: rejectTarget.id, reason: rejectReason });
    }
  };

  if (!user || user.role !== "manager") {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">
          You don't have permission to access this page.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ad Partnership Approvals</h1>
          <p className="text-muted-foreground">Review and approve business applications and ad partnerships</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Businesses</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{stats?.pendingBusinesses || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Partnerships</CardTitle>
              <Handshake className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{stats?.pendingPartnerships || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Partnerships</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{stats?.activePartnerships || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Businesses and Partnerships */}
        <Tabs defaultValue="businesses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="businesses" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Business Applications
              {(stats?.pendingBusinesses || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">{stats?.pendingBusinesses}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="partnerships" className="flex items-center gap-2">
              <Handshake className="h-4 w-4" />
              Partnership Requests
              {(stats?.pendingPartnerships || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">{stats?.pendingPartnerships}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Business Applications Tab */}
          <TabsContent value="businesses" className="space-y-4">
            {businessesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (pendingBusinesses?.length || 0) === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending business applications</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingBusinesses?.map((business: BusinessApplication) => (
                  <Card key={business.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {business.name}
                            <Badge variant="outline">{getCategoryLabel(business.category)}</Badge>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Applied {formatDate(business.createdAt)}
                            </span>
                            {business.referringTrainer && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                Referred by {business.referringTrainer.name || business.referringTrainer.email}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectTarget({ type: "business", id: business.id });
                              setRejectDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveBusiness.mutate({ businessId: business.id })}
                            disabled={approveBusiness.isPending}
                          >
                            {approveBusiness.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Approve
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {business.email}
                          </div>
                          {business.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {business.phone}
                            </div>
                          )}
                          {business.website && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="h-4 w-4 text-muted-foreground" />
                              <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {business.website}
                              </a>
                            </div>
                          )}
                          {(business.address || business.city) && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              {[business.address, business.city].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </div>
                        {business.description && (
                          <div>
                            <p className="text-sm text-muted-foreground">{business.description}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Partnership Requests Tab */}
          <TabsContent value="partnerships" className="space-y-4">
            {partnershipsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (pendingPartnerships?.length || 0) === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Handshake className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending partnership requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingPartnerships?.map((partnership: PartnershipApplication) => (
                  <Card key={partnership.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {partnership.business?.name || "Unknown Business"}
                            <Badge className={getTierColor(partnership.packageTier)}>
                              {partnership.packageTier.charAt(0).toUpperCase() + partnership.packageTier.slice(1)}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(partnership.monthlyFee)}/month
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Requested {formatDate(partnership.createdAt)}
                            </span>
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRejectTarget({ type: "partnership", id: partnership.id });
                              setRejectDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approvePartnership.mutate({ partnershipId: partnership.id })}
                            disabled={approvePartnership.isPending}
                          >
                            {approvePartnership.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Approve
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {partnership.business?.name} ({getCategoryLabel(partnership.business?.category || null)})
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-muted-foreground" />
                            Trainer: {partnership.trainer?.name || partnership.trainer?.email || "Unknown"}
                          </div>
                          {partnership.bonusPointsAwarded && (
                            <div className="flex items-center gap-2 text-sm text-amber-600">
                              <TrendingUp className="h-4 w-4" />
                              {partnership.bonusPointsAwarded.toLocaleString()} bonus points for trainer
                            </div>
                          )}
                        </div>
                        {partnership.notes && (
                          <div>
                            <p className="text-sm text-muted-foreground">{partnership.notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>
                Please provide a reason for rejecting this {rejectTarget?.type === "business" ? "business application" : "partnership request"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Rejection Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter the reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectBusiness.isPending || rejectPartnership.isPending}
              >
                {(rejectBusiness.isPending || rejectPartnership.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
