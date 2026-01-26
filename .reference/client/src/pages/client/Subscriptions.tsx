import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Calendar,
  Pause,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Subscription = {
  id: number;
  status: string | null;
  subscriptionType: string | null;
  price: string;
  startDate: Date;
  renewalDate: Date | null;
  sessionsIncluded: number | null;
  sessionsUsed: number | null;
  bundleDraftId: number | null;
  bundlePublicationId: number | null;
};

export default function ClientSubscriptions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<number | null>(null);

  // Fetch subscriptions from API
  const { data: subscriptions, isLoading, refetch } = trpc.subscriptions.listByClient.useQuery(
    { clientId: user?.id || 0 },
    { enabled: !!user?.id, staleTime: 30000 }
  );

  // Update subscription mutation
  const updateSubscription = trpc.subscriptions.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handlePause = (subId: number) => {
    updateSubscription.mutate({ id: subId, status: "paused" });
    toast.success("Subscription paused");
  };

  const handleResume = (subId: number) => {
    updateSubscription.mutate({ id: subId, status: "active" });
    toast.success("Subscription resumed");
  };

  const handleCancel = () => {
    if (selectedSubscription) {
      updateSubscription.mutate({ id: selectedSubscription, status: "cancelled" });
    }
    toast.success("Subscription cancelled");
    setCancelDialogOpen(false);
  };

  if (isLoading) {
    return (
      <AppShell title="Subscriptions">
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Subscriptions">
      <div className="container py-4 pb-24 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">My Subscriptions</h1>
          <p className="text-sm text-muted-foreground">Manage your active and paused subscriptions</p>
        </div>

        {subscriptions && subscriptions.length > 0 ? (
          <div className="space-y-4">
            {subscriptions.map((sub: Subscription) => {
              const sessionsProgress =
                (sub.sessionsIncluded || 0) > 0
                  ? ((sub.sessionsUsed || 0) / (sub.sessionsIncluded || 1)) * 100
                  : 0;

              return (
                <Card key={sub.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center flex-shrink-0">
                          <Package className="h-6 w-6 text-orange-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground">
                              Bundle #{sub.bundlePublicationId || sub.bundleDraftId || sub.id}
                            </h3>
                            <Badge
                              className={
                                sub.status === "active"
                                  ? "bg-green-100 text-green-700"
                                  : sub.status === "paused"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-muted text-foreground"
                              }
                            >
                              {sub.status || "active"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {sub.subscriptionType || "monthly"} subscription
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">
                          ${Number(sub.price).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">/{sub.subscriptionType || "month"}</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Dates */}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Started:</span>
                        <span className="font-medium">
                          {new Date(sub.startDate).toLocaleDateString()}
                        </span>
                      </div>
                      {sub.renewalDate && (
                        <div className="flex items-center gap-2 text-sm">
                          <RefreshCw className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Next renewal:</span>
                          <span className="font-medium">
                            {new Date(sub.renewalDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {/* Sessions progress */}
                      {(sub.sessionsIncluded || 0) > 0 && (
                        <div className="pt-2">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Sessions used</span>
                            <span className="font-medium">
                              {sub.sessionsUsed || 0} / {sub.sessionsIncluded}
                            </span>
                          </div>
                          <Progress value={sessionsProgress} className="h-2" />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                      {sub.status === "active" ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePause(sub.id)}
                            disabled={updateSubscription.isPending}
                          >
                            <Pause className="h-4 w-4 mr-1" />
                            Pause
                          </Button>
                          <Dialog open={cancelDialogOpen && selectedSubscription === sub.id} onOpenChange={(open) => {
                            setCancelDialogOpen(open);
                            if (open) setSelectedSubscription(sub.id);
                          }}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Cancel Subscription</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to cancel this subscription?
                                  You'll lose access at the end of your current billing period.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                                  Keep Subscription
                                </Button>
                                <Button variant="destructive" onClick={handleCancel}>
                                  Yes, Cancel
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </>
                      ) : sub.status === "paused" ? (
                        <Button
                          size="sm"
                          onClick={() => handleResume(sub.id)}
                          disabled={updateSubscription.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Resume
                        </Button>
                      ) : null}
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
              <h3 className="font-semibold text-foreground mb-2">No subscriptions yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Browse our catalog to find bundles tailored to your goals
              </p>
              <Button onClick={() => setLocation("/catalog")}>Browse Catalog</Button>
            </CardContent>
          </Card>
        )}

        {/* Browse more */}
        {subscriptions && subscriptions.length > 0 && (
          <Card className="mt-6">
            <CardContent className="p-6 text-center">
              <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <h3 className="font-semibold text-foreground mb-2">Looking for more?</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Browse our catalog to discover new bundles
              </p>
              <Button onClick={() => setLocation("/catalog")}>Browse Catalog</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
