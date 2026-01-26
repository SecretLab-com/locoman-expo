import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SingleImageViewer } from "@/components/ImageViewer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Package,
  User,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Database,
  Cloud,
  ChevronRight,
} from "lucide-react";
import { useParams, useLocation, Link, useSearch } from "wouter";
import { toast } from "sonner";

export default function BundleDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const bundleId = parseInt(id || "0");
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const searchParams = new URLSearchParams(useSearch());
  const highlightLowInventory = searchParams.get('highlight_low_inventory') === 'true';
  const utils = trpc.useUtils();

  // Approve bundle mutation
  const approveMutation = trpc.admin.approveBundle.useMutation({
    onSuccess: () => {
      toast.success("Bundle approved and published!");
      setIsReviewDialogOpen(false);
      setReviewNotes("");
      utils.admin.bundleDetails.invalidate({ bundleId });
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
      setReviewNotes("");
      utils.admin.bundleDetails.invalidate({ bundleId });
      utils.admin.pendingBundles.invalidate();
      utils.admin.allBundles.invalidate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reject bundle");
    },
  });

  const handleApprove = () => {
    approveMutation.mutate({ bundleId, notes: reviewNotes || undefined });
  };

  const handleReject = () => {
    if (!reviewNotes.trim()) {
      toast.error("Please provide feedback for the trainer");
      return;
    }
    rejectMutation.mutate({ bundleId, reason: reviewNotes });
  };

  // Keyboard shortcuts for review dialog
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle shortcuts when review dialog is open and not typing in textarea
    if (!isReviewDialogOpen) return;
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
    
    // Prevent shortcuts when mutations are pending
    if (approveMutation.isPending || rejectMutation.isPending) return;
    
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      handleApprove();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      // Focus the notes textarea to encourage feedback before rejecting
      const textarea = document.querySelector('textarea[placeholder*="feedback"]') as HTMLTextAreaElement;
      if (textarea && !reviewNotes.trim()) {
        textarea.focus();
        toast.info("Please provide feedback before rejecting");
      } else {
        handleReject();
      }
    }
  }, [isReviewDialogOpen, reviewNotes, approveMutation.isPending, rejectMutation.isPending]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fetch bundle details
  const { data: bundle, isLoading, refetch } = trpc.admin.bundleDetails.useQuery(
    { bundleId },
    { enabled: bundleId > 0 }
  );

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "published":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle className="h-3 w-3 mr-1" />
            Published
          </Badge>
        );
      case "pending_review":
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Package className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
          <div className="container py-4">
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="container py-6 space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Bundle not found</h2>
          <Link href="/manager/bundles">
            <Button variant="outline">Back to Bundles</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/manager/bundles">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold">{bundle.title}</h1>
                  {/* Only show status badge when not in review state (Review & Approve button handles that) */}
                  {bundle.status !== "pending_review" && bundle.status !== "pending_update" && getStatusBadge(bundle.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Bundle #{bundle.id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bundle && (bundle.status === "pending_review" || bundle.status === "pending_update") && (
                <Button 
                  size="sm" 
                  onClick={() => setIsReviewDialogOpen(true)}
                  className="bg-amber-500 hover:bg-amber-600"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Review & Approve
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6 space-y-6 pb-24">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bundle Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Bundle Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Large Bundle Image */}
              {bundle.imageUrl ? (
                <div className="relative">
                  <img
                    src={bundle.imageUrl}
                    alt={bundle.title}
                    className="w-full aspect-video rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                    onClick={() => setFullscreenImage(bundle.imageUrl)}
                    title="Click to view full size"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                    Click to enlarge
                  </div>
                </div>
              ) : (
                <div className="w-full aspect-video rounded-xl bg-muted flex items-center justify-center">
                  <Package className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              {/* Price and Cadence */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-2xl">
                    ${Number(bundle.price || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {bundle.cadence?.replace("_", " ") || "One-time"}
                  </p>
                </div>
              </div>
              {bundle.description && (
                <p className="text-sm text-muted-foreground">
                  {bundle.description}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Trainer Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Created By
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bundle.trainer ? (
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 -m-2 p-2 rounded-lg transition-colors"
                  onClick={() => setLocation(`/manager/trainers/${bundle.trainer!.id}`)}
                >
                  {bundle.trainer.photoUrl ? (
                    <img
                      src={bundle.trainer.photoUrl}
                      alt={bundle.trainer.name || "Trainer"}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-primary hover:underline">{bundle.trainer.name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">
                      {bundle.trainer.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trainer #{bundle.trainer.id}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : (
                <p className="text-muted-foreground">Trainer info not available</p>
              )}
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Created:</span>
                <span>{formatDate(bundle.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Updated:</span>
                <span>{formatDate(bundle.updatedAt)}</span>
              </div>
              {bundle.publication?.lastSyncedAt && (
                <div className="flex items-center gap-2 text-sm">
                  <Cloud className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Synced:</span>
                  <span>{formatDate(bundle.publication.lastSyncedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bundle Components */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Bundle Components
              <Badge variant="secondary" className="ml-2">
                {bundle.products.length} items
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bundle.products.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Quantity</TableHead>
                    <TableHead className="text-center">Inventory</TableHead>
                    <TableHead className="text-right">Shopify ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.products.map((product, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Link 
                          href={`/manager/products/${product.id}`}
                          className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
                        >
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium group-hover:text-primary transition-colors">{product.name}</p>
                            {product.price && (
                              <p className="text-sm text-muted-foreground">
                                ${product.price}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">x{product.quantity}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {product.inventory !== undefined ? (
                          <Badge 
                            variant={product.inventory === 0 ? "destructive" : product.inventory < 10 ? "secondary" : "outline"}
                            className={`${highlightLowInventory && product.inventory < 10 ? 'animate-pulse ring-2 ring-orange-500' : ''}`}
                          >
                            {product.inventory}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {product.id > 0 ? product.id : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No products in this bundle</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shopify Integration */}
        {bundle.shopify && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Shopify Integration
                <Badge className="bg-green-100 text-green-700 ml-2">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Published
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Product ID</p>
                  <p className="font-mono">{bundle.shopify.productId}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Variant ID</p>
                  <p className="font-mono">{bundle.shopify.variantId}</p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(bundle.shopify?.adminUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Shopify Admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(bundle.shopify?.publicUrl, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on Storefront
                </Button>
              </div>

              {/* Metafields */}
              {bundle.shopify.metafields && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Shopify Metafields
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      {bundle.shopify.metafields.trainerId && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">locomotivate.trainer_id</span>
                          <span className="font-mono">{bundle.shopify.metafields.trainerId}</span>
                        </div>
                      )}
                      {bundle.shopify.metafields.trainerName && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">locomotivate.trainer_name</span>
                          <span>{bundle.shopify.metafields.trainerName}</span>
                        </div>
                      )}
                      {bundle.shopify.metafields.components && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">
                            locomotivate.bundle_components
                          </p>
                          <pre className="text-xs bg-background rounded p-2 overflow-x-auto">
                            {JSON.stringify(bundle.shopify.metafields.components, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Database Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Bundle ID</p>
                <p className="font-mono">{bundle.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="capitalize">{bundle.status}</p>
              </div>
              {bundle.publication && (
                <>
                  <div>
                    <p className="text-muted-foreground">Publication ID</p>
                    <p className="font-mono">{bundle.publication.id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sync Status</p>
                    <Badge variant={bundle.publication.syncStatus === "synced" ? "default" : "secondary"}>
                      {bundle.publication.syncStatus}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fullscreen Image Viewer */}
      <SingleImageViewer
        image={fullscreenImage}
        open={!!fullscreenImage}
        onOpenChange={(open) => !open && setFullscreenImage(null)}
        alt="Bundle image"
      />

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Bundle</DialogTitle>
            <DialogDescription>
              Review "{bundle?.title}" and provide your decision.
            </DialogDescription>
          </DialogHeader>

          {bundle && (
            <div className="space-y-4 py-4">
              {/* Bundle Preview */}
              <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="w-20 h-20 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                  {bundle.imageUrl ? (
                    <img
                      src={bundle.imageUrl}
                      alt={bundle.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground">{bundle.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {bundle.description}
                  </p>
                  <p className="text-sm font-medium text-blue-600 mt-1">
                    ${Number(bundle.price || 0).toFixed(2)}
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

          <DialogFooter className="flex flex-col gap-2">
            <div className="flex gap-2 w-full justify-end">
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
                <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-red-200 rounded">R</kbd>
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
                <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-primary-foreground/20 rounded">A</kbd>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Press A to approve or R to reject (when not typing)</p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
