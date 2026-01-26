import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Building2, 
  DollarSign, 
  Copy, 
  Plus, 
  ExternalLink,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Share2,
  Mail,
  Phone,
  Globe,
  MapPin
} from "lucide-react";

const PACKAGE_INFO = {
  bronze: { name: "Bronze", fee: "£99/month", commission: "15%", points: 500, color: "bg-amber-700" },
  silver: { name: "Silver", fee: "£249/month", commission: "18%", points: 1000, color: "bg-gray-400" },
  gold: { name: "Gold", fee: "£499/month", commission: "20%", points: 2000, color: "bg-yellow-500" },
  platinum: { name: "Platinum", fee: "£999/month", commission: "25%", points: 5000, color: "bg-purple-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
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

export default function AdPartnerships() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [showAddBusiness, setShowAddBusiness] = useState(false);
  const [showCreatePartnership, setShowCreatePartnership] = useState(false);
  const [selectedBusinessId, setSelectedBusinessId] = useState<number | null>(null);
  
  // Form state for new business
  const [businessForm, setBusinessForm] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    category: "other" as const,
    contactName: "",
    description: "",
  });
  
  const [partnershipForm, setPartnershipForm] = useState({
    packageTier: "bronze" as "bronze" | "silver" | "gold" | "platinum",
    notes: "",
  });

  // Queries
  const { data: referralCode } = trpc.ads.getReferralCode.useQuery();
  const { data: partnerships, isLoading: partnershipsLoading } = trpc.ads.myPartnerships.useQuery();
  const { data: businesses, isLoading: businessesLoading } = trpc.ads.myBusinesses.useQuery();
  const { data: earningsSummary } = trpc.ads.earningsSummary.useQuery();
  const { data: earningsHistory } = trpc.ads.earningsHistory.useQuery();

  // Mutations
  const submitBusinessMutation = trpc.ads.submitBusiness.useMutation({
    onSuccess: () => {
      toast.success("Business submitted for review!");
      setShowAddBusiness(false);
      setBusinessForm({
        name: "", email: "", phone: "", website: "", address: "",
        city: "", category: "other", contactName: "", description: "",
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createPartnershipMutation = trpc.ads.createPartnership.useMutation({
    onSuccess: () => {
      toast.success("Partnership proposal submitted!");
      setShowCreatePartnership(false);
      setSelectedBusinessId(null);
      setPartnershipForm({ packageTier: "bronze", notes: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const copyReferralLink = () => {
    if (referralCode?.code) {
      const link = `${window.location.origin}/partner/${referralCode.code}`;
      navigator.clipboard.writeText(link);
      toast.success("Referral link copied to clipboard!");
    }
  };

  const handleSubmitBusiness = () => {
    if (!businessForm.name || !businessForm.email) {
      toast.error("Please fill in required fields");
      return;
    }
    submitBusinessMutation.mutate(businessForm);
  };

  const handleCreatePartnership = () => {
    if (!selectedBusinessId) return;
    createPartnershipMutation.mutate({
      businessId: selectedBusinessId,
      packageTier: partnershipForm.packageTier,
      notes: partnershipForm.notes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "paused":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Paused</Badge>;
      case "cancelled":
      case "expired":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Ad Partnerships</h1>
          <p className="text-muted-foreground">
            Earn commissions by connecting local businesses with LocoMotivate
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyReferralLink}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Referral Link
          </Button>
          <Dialog open={showAddBusiness} onOpenChange={setShowAddBusiness}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Business
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add a Local Business</DialogTitle>
                <DialogDescription>
                  Submit a business you'd like to partner with for advertising
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Business Name *</Label>
                    <Input
                      value={businessForm.name}
                      onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
                      placeholder="Acme Fitness"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select
                      value={businessForm.category}
                      onValueChange={(v) => setBusinessForm({ ...businessForm, category: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={businessForm.email}
                      onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                      placeholder="contact@business.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={businessForm.phone}
                      onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
                      placeholder="+44 123 456 7890"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={businessForm.contactName}
                    onChange={(e) => setBusinessForm({ ...businessForm, contactName: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input
                    value={businessForm.website}
                    onChange={(e) => setBusinessForm({ ...businessForm, website: e.target.value })}
                    placeholder="https://www.business.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      value={businessForm.city}
                      onChange={(e) => setBusinessForm({ ...businessForm, city: e.target.value })}
                      placeholder="London"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input
                      value={businessForm.address}
                      onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                      placeholder="123 High Street"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={businessForm.description}
                    onChange={(e) => setBusinessForm({ ...businessForm, description: e.target.value })}
                    placeholder="Brief description of the business..."
                    rows={3}
                  />
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleSubmitBusiness}
                  disabled={submitBusinessMutation.isPending}
                >
                  {submitBusinessMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
                  ) : (
                    "Submit Business"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Referral Code Card */}
      <Card className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Share2 className="w-5 h-5 text-violet-500" />
                Your Referral Code
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Share this link with local businesses to earn commissions when they sign up
              </p>
            </div>
            <div className="flex items-center gap-3">
              <code className="px-4 py-2 bg-background rounded-lg font-mono text-lg">
                {referralCode?.code || "Loading..."}
              </code>
              <Button variant="outline" size="icon" onClick={copyReferralLink}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-xl font-bold">£{earningsSummary?.totalEarnings?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold">£{earningsSummary?.pendingEarnings?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Award className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bonus Points</p>
                <p className="text-xl font-bold">{earningsSummary?.totalBonusPoints?.toLocaleString() || "0"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Building2 className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Partners</p>
                <p className="text-xl font-bold">{earningsSummary?.activePartnerships || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="businesses">My Businesses</TabsTrigger>
          <TabsTrigger value="partnerships">Partnerships</TabsTrigger>
          <TabsTrigger value="earnings">Earnings History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Package Info */}
          <Card>
            <CardHeader>
              <CardTitle>Ad Packages</CardTitle>
              <CardDescription>
                Commission rates and bonus points for each advertising tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(PACKAGE_INFO).map(([tier, info]) => (
                  <div key={tier} className="p-4 rounded-lg border bg-card">
                    <div className={`w-8 h-8 rounded-full ${info.color} mb-3`} />
                    <h4 className="font-semibold">{info.name}</h4>
                    <p className="text-lg font-bold">{info.fee}</p>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p>Commission: {info.commission}</p>
                      <p>Bonus: {info.points.toLocaleString()} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Partnerships */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Partnerships</CardTitle>
            </CardHeader>
            <CardContent>
              {partnershipsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : partnerships && partnerships.length > 0 ? (
                <div className="space-y-3">
                  {partnerships.slice(0, 5).map((partnership: any) => (
                    <div key={partnership.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${PACKAGE_INFO[partnership.packageTier as keyof typeof PACKAGE_INFO]?.color}`} />
                        <div>
                          <p className="font-medium">{partnership.business?.name || "Unknown Business"}</p>
                          <p className="text-sm text-muted-foreground">
                            {PACKAGE_INFO[partnership.packageTier as keyof typeof PACKAGE_INFO]?.name} Package
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(partnership.status)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No partnerships yet</p>
                  <p className="text-sm">Add a business to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="businesses" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>My Referred Businesses</CardTitle>
              <CardDescription>
                Businesses you've submitted for advertising partnerships
              </CardDescription>
            </CardHeader>
            <CardContent>
              {businessesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : businesses && businesses.length > 0 ? (
                <div className="space-y-4">
                  {businesses.map((business: any) => (
                    <div key={business.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{business.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {CATEGORY_LABELS[business.category] || business.category}
                          </p>
                        </div>
                        {getStatusBadge(business.status)}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {business.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />{business.email}
                          </span>
                        )}
                        {business.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />{business.phone}
                          </span>
                        )}
                        {business.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />{business.city}
                          </span>
                        )}
                        {business.website && (
                          <a 
                            href={business.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Globe className="w-4 h-4" />Website
                          </a>
                        )}
                      </div>
                      {business.status === "active" && (
                        <div className="mt-3">
                          <Button 
                            size="sm" 
                            onClick={() => {
                              setSelectedBusinessId(business.id);
                              setShowCreatePartnership(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Create Partnership
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No businesses added yet</p>
                  <Button className="mt-3" onClick={() => setShowAddBusiness(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Business
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partnerships" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Partnerships</CardTitle>
              <CardDescription>
                Track the status of your advertising partnerships
              </CardDescription>
            </CardHeader>
            <CardContent>
              {partnershipsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : partnerships && partnerships.length > 0 ? (
                <div className="space-y-4">
                  {partnerships.map((partnership: any) => (
                    <div key={partnership.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${PACKAGE_INFO[partnership.packageTier as keyof typeof PACKAGE_INFO]?.color} flex items-center justify-center text-white font-bold`}>
                            {partnership.business?.name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <h4 className="font-semibold">{partnership.business?.name || "Unknown Business"}</h4>
                            <p className="text-sm text-muted-foreground">
                              {PACKAGE_INFO[partnership.packageTier as keyof typeof PACKAGE_INFO]?.name} Package • {PACKAGE_INFO[partnership.packageTier as keyof typeof PACKAGE_INFO]?.fee}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(partnership.status)}
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Your Commission</p>
                          <p className="font-semibold">
                            £{(parseFloat(partnership.monthlyFee) * parseFloat(partnership.trainerCommissionRate)).toFixed(2)}/mo
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bonus Points</p>
                          <p className="font-semibold">{partnership.bonusPointsAwarded?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Started</p>
                          <p className="font-semibold">
                            {partnership.startDate ? new Date(partnership.startDate).toLocaleDateString() : "Pending"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No partnerships yet</p>
                  <p className="text-sm">Create a partnership after a business is approved</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="earnings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Earnings History</CardTitle>
              <CardDescription>
                Your commission payments from ad partnerships
              </CardDescription>
            </CardHeader>
            <CardContent>
              {earningsHistory && earningsHistory.length > 0 ? (
                <div className="space-y-3">
                  {earningsHistory.map((earning: any) => (
                    <div key={earning.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{earning.businessName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(earning.periodStart).toLocaleDateString()} - {new Date(earning.periodEnd).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">+£{parseFloat(earning.commissionEarned).toFixed(2)}</p>
                        {earning.bonusPoints > 0 && (
                          <p className="text-sm text-violet-600">+{earning.bonusPoints} pts</p>
                        )}
                        {getStatusBadge(earning.status)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No earnings yet</p>
                  <p className="text-sm">Earnings will appear here once partnerships are active</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Partnership Dialog */}
      <Dialog open={showCreatePartnership} onOpenChange={setShowCreatePartnership}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Partnership Proposal</DialogTitle>
            <DialogDescription>
              Select a package tier for this business partnership
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Package Tier</Label>
              <Select
                value={partnershipForm.packageTier}
                onValueChange={(v) => setPartnershipForm({ ...partnershipForm, packageTier: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PACKAGE_INFO).map(([tier, info]) => (
                    <SelectItem key={tier} value={tier}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${info.color}`} />
                        {info.name} - {info.fee} ({info.commission} commission)
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={partnershipForm.notes}
                onChange={(e) => setPartnershipForm({ ...partnershipForm, notes: e.target.value })}
                placeholder="Any additional notes about this partnership..."
                rows={3}
              />
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium">Your Earnings</p>
              <p className="text-lg font-bold text-green-600">
                £{(
                  (partnershipForm.packageTier === "bronze" ? 99 :
                   partnershipForm.packageTier === "silver" ? 249 :
                   partnershipForm.packageTier === "gold" ? 499 : 999) *
                  (partnershipForm.packageTier === "bronze" ? 0.15 :
                   partnershipForm.packageTier === "silver" ? 0.18 :
                   partnershipForm.packageTier === "gold" ? 0.20 : 0.25)
                ).toFixed(2)}/month
              </p>
              <p className="text-sm text-violet-600">
                +{PACKAGE_INFO[partnershipForm.packageTier].points.toLocaleString()} bonus points
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={handleCreatePartnership}
              disabled={createPartnershipMutation.isPending}
            >
              {createPartnershipMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : (
                "Submit Partnership Proposal"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
