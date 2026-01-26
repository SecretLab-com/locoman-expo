import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  AlertTriangle,
  User,
  Calendar,
  DollarSign,
  FileText,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useGoalTagColors } from "@/hooks/useTagColors";

type BundleDraft = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  price: string | number | null;
  status: string | null;
  trainerId: number;
  createdAt: Date;
};

const statusColors: Record<string, string> = {
  pending_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  published: "bg-blue-100 text-blue-700",
  draft: "bg-muted text-foreground",
};

export default function BundleApprovals() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const utils = trpc.useUtils();

  // Goal tag colors
  const { suggestions: goalSuggestions } = useGoalTagColors();

  // Fetch bundles pending review
  const { data: pendingBundles, isLoading: pendingLoading } = trpc.admin.pendingBundles.useQuery();
  
  // Fetch all bundles for history
  const { data: allBundles, isLoading: allLoading } = trpc.admin.allBundles.useQuery();

  // Approve bundle mutation
  const approveMutation = trpc.admin.approveBundle.useMutation({
    onSuccess: () => {
      toast.success("Bundle approved and published!");
      setIsReviewDialogOpen(false);
      setSelectedBundle(null);
      setReviewNotes("");
      utils.admin.pendingBundles.invalidate();
      utils.admin.allBundles.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to approve bundle");
    },
  });

  // Reject bundle mutation
  const rejectMutation = trpc.admin.rejectBundle.useMutation({
    onSuccess: () => {
      toast.success("Bundle rejected. Trainer has been notified.");
      setIsReviewDialogOpen(false);
      setSelectedBundle(null);
      setReviewNotes("");
      utils.admin.pendingBundles.invalidate();
      utils.admin.allBundles.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject bundle");
    },
  });

  const filteredPending = (pendingBundles || []).filter(
    (bundle: BundleDraft) =>
      bundle.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bundle.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const reviewedBundles = (allBundles || []).filter(
    (bundle: BundleDraft) => bundle.status === "published" || bundle.status === "rejected"
  );

  const filteredReviewed = reviewedBundles.filter(
    (bundle: BundleDraft) =>
      bundle.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bundle.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleReview = (bundle: any) => {
    setSelectedBundle(bundle);
    setReviewNotes("");
    setIsReviewDialogOpen(true);
  };

  const handleApprove = () => {
    if (!selectedBundle) return;
    approveMutation.mutate({
      bundleId: selectedBundle.id,
      notes: reviewNotes || undefined,
    } as any);
  };

  const handleReject = () => {
    if (!selectedBundle) return;
    if (!reviewNotes.trim()) {
      toast.error("Please provide feedback for the trainer");
      return;
    }
    rejectMutation.mutate({
      bundleId: selectedBundle.id,
      reason: reviewNotes,
    } as any);
  };

  const isLoading = pendingLoading || allLoading;

  if (isLoading) {
    return (
      <AppShell title="Bundle Approvals">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Bundle Approvals">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bundle Approvals</h1>
            <p className="text-sm text-muted-foreground">Review and approve trainer bundle submissions</p>
          </div>
          {filteredPending.length > 0 && (
            <Badge className="bg-yellow-100 text-yellow-700 text-base px-4 py-2">
              <Clock className="h-4 w-4 mr-2" />
              {filteredPending.length} Pending Review
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bundles by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Review ({filteredPending.length})
            </TabsTrigger>
            <TabsTrigger value="reviewed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Reviewed ({filteredReviewed.length})
            </TabsTrigger>
          </TabsList>

          {/* Pending Tab */}
          <TabsContent value="pending" className="space-y-4">
            {filteredPending.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">All caught up!</h3>
                <p className="text-muted-foreground">No bundles pending review at the moment.</p>
              </div>
            ) : (
              filteredPending.map((bundle: BundleDraft) => (
                <Card 
                  key={bundle.id} 
                  className="hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => setLocation(`/manager/bundles/${bundle.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      {/* Bundle Image */}
                      <div className="w-40 h-40 rounded-xl bg-muted overflow-hidden shrink-0 shadow-md">
                        {bundle.imageUrl ? (
                          <img
                            src={bundle.imageUrl}
                            alt={bundle.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                            <Package className="h-16 w-16 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      {/* Bundle Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold text-foreground">{bundle.title}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {bundle.description || "No description provided"}
                            </p>
                            {/* Goal tags */}
                            {(bundle as any).goalsJson && Array.isArray((bundle as any).goalsJson) && (bundle as any).goalsJson.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 flex-wrap">
                                {((bundle as any).goalsJson as string[]).map((goal: string) => {
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
                            )}
                          </div>
                          <Badge className={statusColors[bundle.status || "pending_review"]}>
                            {bundle.status?.replace("_", " ") || "pending review"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span>Trainer #{bundle.trainerId}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            <span>${Number(bundle.price || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(bundle.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/trainer/bundles/${bundle.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReview(bundle);
                            }}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Review
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Reviewed Tab */}
          <TabsContent value="reviewed" className="space-y-4">
            {filteredReviewed.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No reviewed bundles</h3>
                <p className="text-muted-foreground">Reviewed bundles will appear here.</p>
              </div>
            ) : (
              filteredReviewed.map((bundle: BundleDraft) => (
                <Card 
                  key={bundle.id} 
                  className="hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setLocation(`/manager/bundles/${bundle.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-xl bg-muted overflow-hidden shrink-0 shadow-sm">
                        {bundle.imageUrl ? (
                          <img
                            src={bundle.imageUrl}
                            alt={bundle.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                            <Package className="h-10 w-10 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate">{bundle.title}</h3>
                          <Badge className={statusColors[bundle.status || "draft"]}>
                            {bundle.status || "draft"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Trainer #{bundle.trainerId} · ${Number(bundle.price || 0).toFixed(2)}
                        </p>
                        {/* Goal tags */}
                        {(bundle as any).goalsJson && Array.isArray((bundle as any).goalsJson) && (bundle as any).goalsJson.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {((bundle as any).goalsJson as string[]).slice(0, 3).map((goal: string) => {
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
                            {((bundle as any).goalsJson as string[]).length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{((bundle as any).goalsJson as string[]).length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {bundle.status === "published" && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        {bundle.status === "rejected" && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Review Bundle</DialogTitle>
              <DialogDescription>
                Review "{selectedBundle?.title}" and provide your decision.
              </DialogDescription>
            </DialogHeader>

            {selectedBundle && (
              <div className="space-y-4 py-4">
                {/* Bundle Preview */}
                <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="w-20 h-20 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                    {selectedBundle.imageUrl ? (
                      <img
                        src={selectedBundle.imageUrl}
                        alt={selectedBundle.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground">{selectedBundle.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {selectedBundle.description}
                    </p>
                    <p className="text-sm font-medium text-blue-600 mt-1">
                      ${Number(selectedBundle.price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Review Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Review Notes / Feedback</Label>
                  <Textarea
                    id="notes"
                    placeholder="Provide feedback for the trainer (required for rejection)..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsReviewDialogOpen(false)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Approve & Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
