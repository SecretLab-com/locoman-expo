import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TrainerCardSkeleton,
  PageHeaderSkeleton,
  FilterBarSkeleton,
} from "@/components/skeletons";
import { UserAvatar } from "@/components/AvatarUpload";
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
import {
  Search,
  Users,
  Package,
  UserPlus,
  Star,
  ArrowRight,
  Loader2,
  CheckCircle,
  Clock,
  Dumbbell,
  Heart,
  Zap,
  Trophy,
  Home,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useIsImpersonating } from "@/components/ImpersonationBanner";
import { PullToRefresh } from "@/components/PullToRefresh";
import { triggerHaptic } from "@/hooks/useHaptic";

const specialtyIcons: Record<string, React.ElementType> = {
  weight_loss: Heart,
  strength: Dumbbell,
  longevity: Zap,
  power: Trophy,
};

const specialtyColors: Record<string, string> = {
  weight_loss: "bg-pink-100 text-pink-700",
  strength: "bg-blue-100 text-blue-700",
  longevity: "bg-green-100 text-green-700",
  power: "bg-orange-100 text-orange-700",
};

export default function TrainerDirectory() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const isImpersonating = useIsImpersonating();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);

  // Fetch trainers
  const { data: trainers, isLoading: trainersLoading, refetch: refetchTrainers } = trpc.trainers.directory.useQuery();

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([refetchTrainers(), user ? refetchRequests() : Promise.resolve()]);
  };
  
  // Fetch user's existing requests
  const { data: myRequests, refetch: refetchRequests } = trpc.joinRequests.myRequests.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Create join request mutation
  const createRequest = trpc.joinRequests.create.useMutation({
    onSuccess: () => {
      triggerHaptic('success');
      toast.success("Request sent! The trainer will review your request.");
      setIsRequestDialogOpen(false);
      setRequestMessage("");
      setSelectedTrainer(null);
      refetchRequests();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send request");
    },
  });

  const filteredTrainers = (trainers || []).filter(trainer =>
    trainer.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trainer.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (trainer.specialties as string[] | null)?.some(s => 
      s.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleRequestToJoin = (trainerId: number) => {
    if (!user) {
      // Redirect to login
      sessionStorage.setItem("redirectAfterLogin", window.location.pathname);
      window.location.href = getLoginUrl();
      return;
    }
    setSelectedTrainer(trainerId);
    setIsRequestDialogOpen(true);
  };

  const handleSubmitRequest = () => {
    if (!selectedTrainer) return;
    createRequest.mutate({
      trainerId: selectedTrainer,
      message: requestMessage || undefined,
    });
  };

  const getRequestStatus = (trainerId: number) => {
    if (!myRequests) return null;
    return myRequests.find(r => r.trainerId === trainerId);
  };

  const isLoading = trainersLoading || authLoading;

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen bg-background">
      {/* Spacer for impersonation banner */}
      {isImpersonating && <div className="h-12" />}
      
      {/* Header */}
      <header className={`bg-card border-b border-border sticky z-10 ${isImpersonating ? 'top-12' : 'top-0'}`}>
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                  <Dumbbell className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold text-foreground">LocoMotivate</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </Link>
              {user ? (
                <Link href="/client">
                  <Button size="sm">My Dashboard</Button>
                </Link>
              ) : (
                <Button size="sm" onClick={() => window.location.href = getLoginUrl()}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Find Your Perfect Trainer</h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Browse our network of certified fitness trainers and find the perfect match for your goals
          </p>
          
          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search by name, specialty, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-foreground bg-card border-0 shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Trainers Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <>
            <div className="flex items-center justify-between mb-6">
              <PageHeaderSkeleton showAction={false} />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <TrainerCardSkeleton key={i} />
              ))}
            </div>
          </>
        ) : filteredTrainers.length === 0 ? (
          <div className="text-center py-16">
            <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Trainers Found</h2>
            <p className="text-muted-foreground">
              {searchQuery ? "Try adjusting your search" : "No trainers are available at the moment"}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">
                {filteredTrainers.length} Trainer{filteredTrainers.length !== 1 ? "s" : ""} Available
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTrainers.map((trainer) => {
                const specialties = (trainer.specialties as string[] | null) || [];
                const requestStatus = getRequestStatus(trainer.id);
                
                return (
                  <Card key={trainer.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-4">
                        <UserAvatar
                          photoUrl={trainer.photoUrl}
                          name={trainer.name}
                          size="lg"
                        />
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{trainer.name || "Trainer"}</CardTitle>
                          {trainer.username && (
                            <CardDescription className="truncate">@{trainer.username}</CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      {trainer.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{trainer.bio}</p>
                      )}
                      
                      {/* Specialties */}
                      {specialties.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {specialties.slice(0, 3).map((specialty) => {
                            const Icon = specialtyIcons[specialty] || Star;
                            return (
                              <Badge 
                                key={specialty} 
                                variant="secondary"
                                className={specialtyColors[specialty] || "bg-muted text-foreground"}
                              >
                                <Icon className="h-3 w-3 mr-1" />
                                {specialty.replace(/_/g, " ")}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-4 w-4" />
                          {(trainer as any).bundleCount || 0} bundle{(trainer as any).bundleCount !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {(trainer as any).clientCount || 0} client{(trainer as any).clientCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        {trainer.username ? (
                          <Link href={`/t/${trainer.username}`} className="flex-1">
                            <Button variant="outline" className="w-full" size="sm">
                              View Profile
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="outline" className="flex-1" size="sm" disabled>
                            No Profile
                          </Button>
                        )}
                        
                        {requestStatus ? (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            disabled
                            className={
                              requestStatus.status === "approved" 
                                ? "bg-green-100 text-green-700"
                                : requestStatus.status === "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }
                          >
                            {requestStatus.status === "approved" && <CheckCircle className="h-4 w-4 mr-1" />}
                            {requestStatus.status === "pending" && <Clock className="h-4 w-4 mr-1" />}
                            {requestStatus.status === "approved" ? "Joined" : 
                             requestStatus.status === "rejected" ? "Declined" : "Pending"}
                          </Button>
                        ) : (
                          <Button 
                            size="sm"
                            onClick={() => handleRequestToJoin(trainer.id)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Join
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Request Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request to Join Trainer</DialogTitle>
            <DialogDescription>
              Send a request to join this trainer's client roster. They will review your request and get back to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message (optional)</Label>
              <Textarea
                id="message"
                placeholder="Tell the trainer about your fitness goals and why you'd like to work with them..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRequest} disabled={createRequest.isPending}>
              {createRequest.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>&copy; {new Date().getFullYear()} LocoMotivate. All rights reserved.</p>
        </div>
      </footer>
    </PullToRefresh>
  );
}
