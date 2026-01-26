import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Dumbbell,
  Package,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Eye,
  TrendingUp,
  Heart,
  Zap,
  Award,
  Target,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
} from "lucide-react";
import {
  StatsGridSkeleton,
  BundleGridSkeleton,
  FilterBarSkeleton,
  TabsSkeleton,
  PageHeaderSkeleton,
} from "@/components/skeletons";
import { useState } from "react";
import { useLocation } from "wouter";
import { UserAvatar } from "@/components/AvatarUpload";
import { toast } from "sonner";
import { InviteBundleDialog } from "@/components/InviteBundleDialog";
import { BulkInviteDialog } from "@/components/BulkInviteDialog";
import { InvitationAnalytics } from "@/components/InvitationAnalytics";
import { Mail, Send, RefreshCw, XCircle as XCircleIcon, Copy as CopyIcon } from "lucide-react";
import { useGoalTagColors } from "@/hooks/useTagColors";

const goalIcons: Record<string, React.ElementType> = {
  weight_loss: Heart,
  strength: Dumbbell,
  longevity: Award,
  power: Zap,
};

const statusColors: Record<string, string> = {
  draft: "bg-muted text-foreground",
  pending_review: "bg-yellow-100 text-yellow-700",
  pending_update: "bg-orange-100 text-orange-700",
  published: "bg-green-100 text-green-700",
  publishing: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
};

export default function TrainerBundles() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [bulkInviteDialogOpen, setBulkInviteDialogOpen] = useState(false);
  const [selectedBundleForInvite, setSelectedBundleForInvite] = useState<{ id: number; title: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  // Fetch bundles from API
  const { data: bundles, isLoading, refetch } = trpc.bundles.list.useQuery();

  // Goal tag colors
  const { suggestions: goalSuggestions } = useGoalTagColors();

  // Fetch bundle invitations
  const { data: bundleInvitations, refetch: refetchInvitations } = trpc.bundles.getMyInvitations.useQuery(undefined, {
    enabled: activeTab === "invitations",
  });

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await refetch();
  };

  // Delete bundle mutation
  const deleteBundleMutation = trpc.bundles.delete.useMutation({
    onSuccess: () => {
      toast.success("Bundle deleted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete bundle");
    },
  });

  // Resend invitation mutation
  const resendInvitationMutation = trpc.bundles.resendInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation resent successfully");
      refetchInvitations();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });

  // Revoke invitation mutation
  const revokeInvitationMutation = trpc.bundles.revokeInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation revoked");
      refetchInvitations();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke invitation");
    },
  });

  const handleResendInvitation = (invitationId: number) => {
    resendInvitationMutation.mutate({ invitationId });
  };

  const handleRevokeInvitation = (invitationId: number) => {
    if (window.confirm("Are you sure you want to revoke this invitation?")) {
      revokeInvitationMutation.mutate({ invitationId });
    }
  };

  const filteredBundles = (bundles || []).filter((bundle) => {
    const matchesSearch = bundle.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || bundle.status === statusFilter;
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "published" && bundle.status === "published") ||
      (activeTab === "drafts" && bundle.status === "draft") ||
      (activeTab === "pending" && (bundle.status === "pending_review" || bundle.status === "pending_update")) ||
      (activeTab === "rejected" && bundle.status === "rejected");
    return matchesSearch && matchesStatus && matchesTab;
  });

  const handleDuplicate = (bundleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.info("Duplicate feature coming soon");
  };

  const handleDelete = (bundleId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteBundleMutation.mutate({ id: bundleId });
  };

  // Calculate stats from real data
  const publishedCount = (bundles || []).filter((b) => b.status === "published").length;
  const draftCount = (bundles || []).filter((b) => b.status === "draft").length;
  const pendingCount = (bundles || []).filter((b) => b.status === "pending_review" || b.status === "pending_update").length;
  const rejectedCount = (bundles || []).filter((b) => b.status === "rejected").length;
  const totalRevenue = 0; // Would need to join with orders table

  if (isLoading) {
    return (
      <AppShell title="Bundles">
        <div className="container py-4 pb-24">
          <PageHeaderSkeleton className="mb-6" />
          <StatsGridSkeleton count={3} columns={3} className="mb-6" />
          <FilterBarSkeleton className="mb-4" />
          <TabsSkeleton count={5} className="mb-4" />
          <BundleGridSkeleton count={4} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Bundles" onRefresh={handleRefresh}>
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Bundles</h1>
            <p className="text-sm text-muted-foreground">Create and manage your wellness bundles</p>
          </div>
          <Button onClick={() => setLocation("/trainer/bundles/new")} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <Package className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-xs text-muted-foreground">Published</p>
              <p className="text-xl font-bold">{publishedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <Edit className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Drafts</p>
              <p className="text-xl font-bold">{draftCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-lg font-bold">
                ${totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(1)}k` : totalRevenue}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="publishing">Publishing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="w-full grid grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="rejected" className="relative">
              Rejected
              {rejectedCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {rejectedCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="invitations" className="relative">
              Invites
              {(bundleInvitations || []).filter((i) => i.status === "pending").length > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {(bundleInvitations || []).filter((i) => i.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Bundle List */}
        <div className="space-y-3">
          {filteredBundles.map((bundle) => {
            const GoalIcon = Target; // Goal type stored in template

            return (
              <Card
                key={bundle.id}
                className="group hover:shadow-md transition-all cursor-pointer"
                onClick={() => setLocation(`/trainer/bundles/${bundle.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shrink-0 overflow-hidden shadow-md">
                      {bundle.imageUrl ? (
                        <img
                          src={bundle.imageUrl}
                          alt={bundle.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <GoalIcon className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground truncate">{bundle.title}</h3>
                          {/* One-time purchase - no cadence display */}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/trainer/bundles/${bundle.id}`);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {bundle.status === "published" && (
                              <>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/catalog/${bundle.id}`);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View in Catalog
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBundleForInvite({ id: bundle.id, title: bundle.title });
                                  setInviteDialogOpen(true);
                                }}>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Invite Client
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBundleForInvite({ id: bundle.id, title: bundle.title });
                                  setBulkInviteDialogOpen(true);
                                }}>
                                  <Users className="h-4 w-4 mr-2" />
                                  Bulk Invite
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={(e) => handleDuplicate(bundle.id, e)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => handleDelete(bundle.id, e)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{bundle.description}</p>
                      {/* Goal tags */}
                      {(() => {
                        const goals = bundle.goalsJson as string[] | null;
                        if (!goals || !Array.isArray(goals) || goals.length === 0) return null;
                        return (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {goals.map((goal: string) => {
                              const tagColor = goalSuggestions.find(s => s.value.toLowerCase() === goal.toLowerCase());
                              return (
                                <Badge
                                  key={goal}
                                  className="text-xs capitalize"
                                  style={{
                                    backgroundColor: tagColor?.color ? `${tagColor.color}20` : undefined,
                                    color: tagColor?.color || undefined,
                                    borderColor: tagColor?.color || undefined,
                                  }}
                                  variant={tagColor ? "outline" : "secondary"}
                                >
                                  {goal.replace("_", " ")}
                                </Badge>
                              );
                            })}
                          </div>
                        );
                      })()}
                      {/* Rejection reason alert */}
                      {bundle.status === "rejected" && bundle.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                          <strong>Feedback:</strong> {bundle.rejectionReason}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${statusColors[bundle.status || "draft"]} flex items-center gap-1`}>
                            {bundle.status === "published" && <CheckCircle className="h-3 w-3" />}
                            {bundle.status === "pending_review" && <Clock className="h-3 w-3" />}
                            {bundle.status === "pending_update" && <Clock className="h-3 w-3" />}
                            {bundle.status === "publishing" && <Clock className="h-3 w-3" />}
                            {bundle.status === "rejected" && <AlertCircle className="h-3 w-3" />}
                            {bundle.status === "failed" && <AlertCircle className="h-3 w-3" />}
                            {bundle.status?.replace("_", " ") || "draft"}
                          </Badge>
                          {bundle.status === "published" && bundle.shopifyProductId && (
                            <a
                              href={`https://${import.meta.env.VITE_SHOPIFY_STORE_NAME || 'your-store'}.myshopify.com/admin/products/${bundle.shopifyProductId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View in Shopify
                            </a>
                          )}
                          <span className="text-sm font-semibold text-foreground">
                            ${Number(bundle.price || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Invitations List */}
        {activeTab === "invitations" && (
          <div className="space-y-4">
            {/* Analytics Dashboard */}
            <InvitationAnalytics className="mb-2" />
            
            {/* Invitations List */}
            <h3 className="text-sm font-medium text-muted-foreground">Recent Invitations</h3>
            {(bundleInvitations || []).length > 0 ? (
              (bundleInvitations || []).map((invitation) => (
                <Card key={invitation.id} className="hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        photoUrl={invitation.recipientPhotoUrl}
                        name={invitation.recipientName || invitation.email}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground truncate">
                            {invitation.recipientName || invitation.email}
                          </h3>
                          <Badge className={
                            {
                              pending: "bg-yellow-100 text-yellow-700",
                              viewed: "bg-blue-100 text-blue-700",
                              accepted: "bg-green-100 text-green-700",
                              declined: "bg-red-100 text-red-700",
                              expired: "bg-gray-100 text-gray-700",
                              revoked: "bg-gray-100 text-gray-700",
                            }[invitation.status || "pending"] || "bg-gray-100 text-gray-700"
                          }>
                            {invitation.status || "pending"}
                          </Badge>
                          {invitation.viewedAt && invitation.status === "pending" && (
                            <Badge variant="outline" className="text-xs">
                              <Eye className="h-3 w-3 mr-1" />
                              Viewed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {invitation.email}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Bundle: <span className="font-medium">{invitation.bundleTitle}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sent {new Date(invitation.createdAt).toLocaleDateString()}
                          {invitation.expiresAt && invitation.status === "pending" && (
                            <> · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {invitation.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                const url = `${window.location.origin}/invite/${invitation.token}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Invite link copied!");
                              }}
                              title="Copy invite link"
                            >
                              <CopyIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => handleRevokeInvitation(invitation.id)}
                              disabled={revokeInvitationMutation.isPending}
                              title="Revoke invitation"
                            >
                              <XCircleIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {(invitation.status === "expired" || invitation.status === "declined") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-500 hover:text-blue-600"
                            onClick={() => handleResendInvitation(invitation.id)}
                            disabled={resendInvitationMutation.isPending}
                            title="Resend invitation"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Send className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No invitations sent</h3>
                <p className="text-muted-foreground mb-4">
                  Invite clients to your bundles to see them here
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {activeTab !== "invitations" && filteredBundles.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No bundles found</h3>
            <p className="text-muted-foreground mb-4">
              {activeTab === "drafts" && "You don't have any draft bundles"}
              {activeTab === "pending" && "No bundles are pending review"}
              {activeTab === "published" && "You don't have any published bundles yet"}
              {activeTab === "rejected" && "No rejected bundles - great job!"}
              {activeTab === "all" && "Create your first bundle to get started"}
            </p>
            <Button onClick={() => setLocation("/trainer/bundles/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create Bundle
            </Button>
          </div>
        )}
      </div>
      {/* Invite Dialog */}
      {selectedBundleForInvite && (
        <InviteBundleDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          bundleId={selectedBundleForInvite.id}
          bundleTitle={selectedBundleForInvite.title}
        />
      )}
      {/* Bulk Invite Dialog */}
      {selectedBundleForInvite && (
        <BulkInviteDialog
          open={bulkInviteDialogOpen}
          onOpenChange={setBulkInviteDialogOpen}
          bundleId={selectedBundleForInvite.id}
          bundleTitle={selectedBundleForInvite.title}
        />
      )}
    </AppShell>
  );
}
