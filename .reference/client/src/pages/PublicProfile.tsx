import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/AvatarUpload";
import { 
  User, 
  Mail,
  Phone,
  Calendar,
  Dumbbell,
  Heart,
  Zap,
  Trophy,
  Target,
  ArrowLeft,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useIsImpersonating } from "@/components/ImpersonationBanner";

const goalIcons: Record<string, React.ElementType> = {
  weight_loss: Heart,
  strength: Dumbbell,
  longevity: Zap,
  power: Trophy,
};

const goalColors: Record<string, string> = {
  weight_loss: "bg-pink-100 text-pink-700",
  strength: "bg-blue-100 text-blue-700",
  longevity: "bg-green-100 text-green-700",
  power: "bg-orange-100 text-orange-700",
};

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const isImpersonating = useIsImpersonating();
  const [copied, setCopied] = useState(false);
  
  const { data: profile, isLoading, error } = trpc.publicProfile.getById.useQuery(
    { userId: parseInt(userId || "0") },
    { enabled: !!userId && !isNaN(parseInt(userId)) }
  );

  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.name || "User"}'s Profile - LocoMotivate`,
          text: profile?.bio || "Check out this profile on LocoMotivate!",
          url,
        });
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Profile link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {isImpersonating && <div className="h-12" />}
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="flex flex-col items-center mb-8">
            <Skeleton className="h-32 w-32 rounded-full mb-4" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        {isImpersonating && <div className="h-12" />}
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <User className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Profile Not Found</h1>
            <p className="text-muted-foreground mb-6">
              This profile doesn't exist or is set to private.
            </p>
            <Link href="/">
              <Button>Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const goals = (profile.goals as string[] | null) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {isImpersonating && <div className="h-12" />}
      
      {/* Header */}
      <header className={`bg-card/80 backdrop-blur-sm border-b border-border sticky z-10 ${isImpersonating ? 'top-12' : 'top-0'}`}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                  <Dumbbell className="h-4 w-4 text-white" />
                </div>
                <span className="font-bold text-foreground">LocoMotivate</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleShare}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Profile Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Profile Card */}
        <Card className="overflow-hidden">
          {/* Cover gradient */}
          <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-700" />
          
          <CardContent className="pt-0 pb-6">
            {/* Avatar - overlapping the cover */}
            <div className="flex justify-center -mt-16 mb-4">
              <div className="ring-4 ring-card rounded-full">
                <UserAvatar
                  photoUrl={profile.photoUrl}
                  name={profile.name}
                  size="xl"
                />
              </div>
            </div>

            {/* Name and Role */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-foreground mb-1">
                {profile.name || "Anonymous User"}
              </h1>
              <Badge className={
                profile.role === "trainer" ? "bg-blue-100 text-blue-700" :
                profile.role === "client" ? "bg-green-100 text-green-700" :
                "bg-muted text-foreground"
              }>
                {profile.role === "trainer" ? "Trainer" :
                 profile.role === "client" ? "Client" :
                 "Member"}
              </Badge>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div className="text-center mb-6">
                <p className="text-muted-foreground">{profile.bio}</p>
              </div>
            )}

            {/* Goals/Specialties */}
            {goals.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-3 text-center">
                  {profile.role === "trainer" ? "Specialties" : "Fitness Goals"}
                </h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {goals.map((goal) => {
                    const Icon = goalIcons[goal] || Target;
                    return (
                      <Badge 
                        key={goal} 
                        variant="secondary"
                        className={goalColors[goal] || "bg-muted text-foreground"}
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {goal.replace(/_/g, " ")}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Member Since */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Trainer-specific: Link to full profile */}
        {profile.role === "trainer" && profile.username && (
          <Card className="mt-4">
            <CardContent className="py-4">
              <Link href={`/t/${profile.username}`}>
                <Button className="w-full">
                  View Full Trainer Profile
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Share Section */}
        <Card className="mt-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Share this profile</h3>
                <p className="text-sm text-muted-foreground">Copy the link to share</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(window.location.href)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6 mt-8">
        <div className="max-w-2xl mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>&copy; {new Date().getFullYear()} LocoMotivate. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
