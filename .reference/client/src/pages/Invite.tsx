import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { UserAvatar } from "@/components/AvatarUpload";
import {
  Package,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  LogIn,
  ShoppingCart,
  Loader2,
  Gift,
  Star,
  Dumbbell,
  Heart,
  Zap,
  Target,
  Award,
  ChevronRight,
  Share2,
  Copy,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

// Goal type colors
const goalColors: Record<string, { bg: string; text: string; icon: typeof Dumbbell }> = {
  "Weight Loss": { bg: "bg-green-100", text: "text-green-700", icon: Heart },
  "Strength": { bg: "bg-blue-100", text: "text-blue-700", icon: Dumbbell },
  "Longevity": { bg: "bg-purple-100", text: "text-purple-700", icon: Zap },
  "Power": { bg: "bg-orange-100", text: "text-orange-700", icon: Target },
};

type Product = {
  id: string;
  title: string;
  price: string;
  imageUrl?: string;
  quantity?: number;
};

type Service = {
  type: string;
  name: string;
  quantity?: number;
  duration?: number;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [showProducts, setShowProducts] = useState(false);

  const {
    data: invitation,
    isLoading,
    error,
  } = trpc.bundles.getInvitationByToken.useQuery(
    { token: token || "" },
    { enabled: !!token, retry: false }
  );

  const acceptMutation = trpc.bundles.acceptInvitation.useMutation({
    onSuccess: (data) => {
      toast.success("Invitation accepted! You're now connected with your trainer.");
      // Redirect to the bundle detail page
      setLocation(`/bundle/${data.bundleId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to accept invitation");
      setAccepting(false);
    },
  });

  const declineMutation = trpc.bundles.declineInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation declined");
      setDeclined(true);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to decline invitation");
    },
  });

  const handleAccept = () => {
    if (!user) {
      // Store the invitation token and redirect to login
      sessionStorage.setItem("pendingInviteToken", token || "");
      window.location.href = getLoginUrl();
      return;
    }
    setAccepting(true);
    acceptMutation.mutate({ token: token || "" });
  };

  const handleDecline = () => {
    declineMutation.mutate({ token: token || "" });
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: `${invitation?.trainerName} invited you to ${invitation?.bundleTitle}`,
      text: invitation?.personalMessage || `Check out this wellness bundle from ${invitation?.trainerName}!`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      // Fallback to copy link
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  // Check for pending invitation after login
  useEffect(() => {
    if (user && !authLoading) {
      const pendingToken = sessionStorage.getItem("pendingInviteToken");
      if (pendingToken && pendingToken === token) {
        sessionStorage.removeItem("pendingInviteToken");
        // Auto-accept after login
        setAccepting(true);
        acceptMutation.mutate({ token: pendingToken });
      }
    }
  }, [user, authLoading, token]);

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4" />
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
            <CardTitle className="text-xl">Invitation Not Found</CardTitle>
            <CardDescription>
              {error.message || "This invitation may have expired or been removed."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} variant="outline">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Declined state
  if (declined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-10 w-10 text-slate-600" />
            </div>
            <CardTitle className="text-xl">Invitation Declined</CardTitle>
            <CardDescription>
              You've declined this invitation. If you change your mind, ask your trainer to send a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} variant="outline">
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already accepted state
  if (invitation?.status === "accepted") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-xl">Already Accepted</CardTitle>
            <CardDescription>
              This invitation has already been accepted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => setLocation(`/bundle/${invitation.bundleId}`)} className="w-full">
              <ShoppingCart className="h-4 w-4 mr-2" />
              View Bundle & Add to Cart
            </Button>
            <Button onClick={() => setLocation("/catalog")} variant="outline" className="w-full">
              Browse All Bundles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse data
  const goals = invitation?.bundleGoals
    ? (typeof invitation.bundleGoals === "string"
        ? JSON.parse(invitation.bundleGoals)
        : invitation.bundleGoals)
    : [];

  const products: Product[] = invitation?.bundleProductsJson
    ? (typeof invitation.bundleProductsJson === "string"
        ? JSON.parse(invitation.bundleProductsJson)
        : invitation.bundleProductsJson)
    : [];

  const services: Service[] = invitation?.bundleServicesJson
    ? (typeof invitation.bundleServicesJson === "string"
        ? JSON.parse(invitation.bundleServicesJson)
        : invitation.bundleServicesJson)
    : [];

  const specialties = invitation?.trainerSpecialties
    ? (typeof invitation.trainerSpecialties === "string"
        ? JSON.parse(invitation.trainerSpecialties)
        : invitation.trainerSpecialties)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Invitation Badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-primary/20 text-primary px-4 py-2 rounded-full">
            <Gift className="h-4 w-4" />
            <span className="text-sm font-medium">Personal Invitation</span>
          </div>
        </div>

        {/* Trainer Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
            <div className="flex items-start gap-4">
              <UserAvatar
                photoUrl={invitation?.trainerPhoto}
                name={invitation?.trainerName || "Trainer"}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold truncate">
                    {invitation?.trainerName || "Your Trainer"}
                  </h2>
                  <Award className="h-4 w-4 text-primary flex-shrink-0" />
                </div>
                {specialties.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {specialties.slice(0, 3).map((specialty: string) => (
                      <Badge key={specialty} variant="secondary" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                )}
                {invitation?.trainerBio && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {invitation.trainerBio}
                  </p>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Bundle Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex gap-4">
              {invitation?.bundleImageUrl ? (
                <img
                  src={invitation.bundleImageUrl}
                  alt={invitation.bundleTitle || "Bundle"}
                  className="w-28 h-28 rounded-xl object-cover shadow-md flex-shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-28 h-28 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center shadow-md flex-shrink-0">
                  <Package className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl mb-2 line-clamp-2">{invitation?.bundleTitle}</CardTitle>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold text-primary">
                    ${Number(invitation?.bundlePrice || 0).toFixed(2)}
                  </span>
                </div>
                {goals.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {goals.map((goal: string) => {
                      const config = goalColors[goal] || { bg: "bg-gray-100", text: "text-gray-700", icon: Target };
                      const Icon = config.icon;
                      return (
                        <Badge key={goal} className={`${config.bg} ${config.text} text-xs`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {goal}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {invitation?.bundleDescription && (
              <p className="text-sm text-muted-foreground">
                {invitation.bundleDescription}
              </p>
            )}

            {/* Personal Message */}
            {invitation?.personalMessage && (
              <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-2 mb-2">
                  <MessageCircle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Message from {invitation.trainerName?.split(" ")[0] || "your trainer"}
                  </span>
                </div>
                <p className="text-sm italic text-yellow-800 dark:text-yellow-200">
                  "{invitation.personalMessage}"
                </p>
              </div>
            )}

            {/* Products Preview */}
            {products.length > 0 && (
              <div>
                <button
                  onClick={() => setShowProducts(!showProducts)}
                  className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {products.length} Product{products.length !== 1 ? "s" : ""} Included
                  </span>
                  <ChevronRight className={`h-4 w-4 transition-transform ${showProducts ? "rotate-90" : ""}`} />
                </button>
                
                {showProducts && (
                  <div className="mt-2 space-y-2">
                    {products.slice(0, 4).map((product, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="w-10 h-10 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.title}</p>
                          <p className="text-xs text-muted-foreground">
                            ${Number(product.price || 0).toFixed(2)}
                            {product.quantity && product.quantity > 1 && ` × ${product.quantity}`}
                          </p>
                        </div>
                      </div>
                    ))}
                    {products.length > 4 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{products.length - 4} more products
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Services Preview */}
            {services.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {services.map((service, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {service.name || service.type}
                    {service.quantity && service.quantity > 1 && ` ×${service.quantity}`}
                  </Badge>
                ))}
              </div>
            )}

            <Separator />

            {/* Expiry notice */}
            {invitation?.expiresAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  Expires {new Date(invitation.expiresAt).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3 pt-2">
              {!user ? (
                <>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleAccept}
                    disabled={accepting}
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign In to Accept
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    You'll be redirected to sign in, then automatically connected with your trainer
                  </p>
                </>
              ) : (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleAccept}
                  disabled={accepting || acceptMutation.isPending}
                >
                  {accepting || acceptMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Accept Invitation
                    </>
                  )}
                </Button>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleDecline}
                disabled={declineMutation.isPending}
              >
                {declineMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Declining...
                  </>
                ) : (
                  "No thanks, decline invitation"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Trust indicators */}
        <div className="text-center text-xs text-muted-foreground">
          <p>Powered by LocoMotivate • Secure & Private</p>
        </div>
      </div>
    </div>
  );
}
