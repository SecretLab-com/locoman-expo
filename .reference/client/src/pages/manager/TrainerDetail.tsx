import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/AvatarUpload";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Package,
  Users,
  DollarSign,
  TrendingUp,
  Ban,
  CheckCircle,
  MessageSquare,
  FileText,
  Loader2,
  MoreVertical,
  Eye,
  Edit,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/Breadcrumb";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  approved: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-700",
  rejected: "bg-red-100 text-red-700",
};

export default function TrainerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Fetch trainer data from tRPC
  const { data: trainer, isLoading, error } = trpc.admin.getTrainer.useQuery(
    { trainerId: parseInt(id || "0") },
    { enabled: !!id }
  );

  // Mutations for trainer actions
  const suspendMutation = trpc.trainers.suspend.useMutation({
    onSuccess: () => {
      toast.success(`${trainer?.name} has been suspended`);
      utils.admin.getTrainer.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to suspend trainer: ${error.message}`);
    },
  });

  const reactivateMutation = trpc.trainers.approve.useMutation({
    onSuccess: () => {
      toast.success(`${trainer?.name} has been reactivated`);
      utils.admin.getTrainer.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to reactivate trainer: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Trainer">
        <div className="container py-4 pb-24">
          <Button variant="ghost" onClick={() => setLocation("/manager/trainers")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trainers
          </Button>
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (error || !trainer) {
    return (
      <AppShell title="Trainer">
        <div className="container py-4 pb-24">
          <Button variant="ghost" onClick={() => setLocation("/manager/trainers")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trainers
          </Button>
          <div className="text-center py-16">
            <h3 className="text-lg font-semibold text-foreground mb-2">Trainer not found</h3>
            <p className="text-muted-foreground">The trainer you're looking for doesn't exist or could not be loaded.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const handleSuspend = () => {
    suspendMutation.mutate({ trainerId: trainer.id });
  };

  const handleReactivate = () => {
    reactivateMutation.mutate({ trainerId: trainer.id });
  };

  const handleMessage = () => {
    toast.info("Messaging feature coming soon");
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase();
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const status = trainer.approvalStatus || "pending";
  const isActive = status === "approved";

  return (
    <AppShell title={trainer.name || "Trainer"}>
      <div className="container py-4 pb-24">
        {/* Breadcrumb Navigation */}
        <Breadcrumb
          items={[
            { label: "Trainers", href: "/manager/trainers" },
            { label: trainer.name || "Trainer" },
          ]}
          homeHref="/manager"
          className="mb-4"
        />

        {/* Profile Header */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20">
                {trainer.photoUrl && (
                  <AvatarImage src={trainer.photoUrl} alt={trainer.name || ""} />
                )}
                <AvatarFallback className="text-xl bg-blue-100 text-blue-600">
                  {getInitials(trainer.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-foreground">{trainer.name}</h1>
                  <Badge className={statusColors[status]}>{status}</Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {trainer.email}
                  </div>
                  {trainer.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {trainer.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Joined {formatDate(trainer.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            {/* Bio Section */}
            {trainer.bio && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">{trainer.bio}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={handleMessage}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Message
              </Button>
              {isActive ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600" 
                  onClick={handleSuspend}
                  disabled={suspendMutation.isPending}
                >
                  {suspendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4 mr-2" />
                  )}
                  Suspend
                </Button>
              ) : status === "suspended" ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-green-600" 
                  onClick={handleReactivate}
                  disabled={reactivateMutation.isPending}
                >
                  {reactivateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Reactivate
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{trainer.bundleCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Bundles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{trainer.clientCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Bundles */}
        {trainer.publishedBundles && trainer.publishedBundles.length > 0 && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Published Bundles
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {trainer.publishedBundles.map((bundle: any) => (
                  <div 
                    key={bundle.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors group"
                    onClick={() => setLocation(`/manager/bundles/${bundle.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      {bundle.imageUrl ? (
                        <img 
                          src={bundle.imageUrl} 
                          alt={bundle.title} 
                          className="w-10 h-10 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-foreground text-sm">{bundle.title}</p>
                        <p className="text-xs text-muted-foreground">
                          ${bundle.price} · {bundle.subscriberCount || 0} subscribers
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {bundle.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/manager/bundles/${bundle.id}`);
                          }}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/bundle/${bundle.id}`, '_blank');
                          }}>
                            <Package className="h-4 w-4 mr-2" />
                            View in Catalog
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.info("Feature coming soon");
                            }}
                            className="text-yellow-600"
                          >
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Flag for Review
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Clients */}
        {trainer.recentClients && trainer.recentClients.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recent Clients
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {trainer.recentClients.map((client: any) => (
                  <div 
                    key={client.id} 
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => client.userId && setLocation(`/u/${client.userId}`)}
                  >
                    <UserAvatar 
                      photoUrl={client.photoUrl} 
                      name={client.name} 
                      size="sm" 
                    />
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">{client.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {formatDate(client.createdAt)}
                      </p>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={client.status === "active" ? "bg-green-100 text-green-700" : ""}
                    >
                      {client.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state for no bundles or clients */}
        {(!trainer.publishedBundles || trainer.publishedBundles.length === 0) && 
         (!trainer.recentClients || trainer.recentClients.length === 0) && (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">No bundles or clients yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
