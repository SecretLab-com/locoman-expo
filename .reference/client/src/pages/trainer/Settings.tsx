import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/AppShell";
import { TrainerMediaGallery } from "@/components/TrainerMediaGallery";
import { trpc } from "@/lib/trpc";
import {
  User,
  AtSign,
  FileText,
  Dumbbell,
  Link as LinkIcon,
  Check,
  X,
  Loader2,
  ExternalLink,
  Save,
  Instagram,
  Twitter,
  Globe,
  Linkedin,
  Moon,
  Sun,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { useTheme } from "@/contexts/ThemeContext";

type SocialLinksType = Record<string, string>;

const SPECIALTY_OPTIONS = [
  { value: "strength", label: "Strength Training", color: "bg-red-100 text-red-700" },
  { value: "weight_loss", label: "Weight Loss", color: "bg-green-100 text-green-700" },
  { value: "power", label: "Power & Performance", color: "bg-orange-100 text-orange-700" },
  { value: "longevity", label: "Longevity & Mobility", color: "bg-blue-100 text-blue-700" },
  { value: "hiit", label: "HIIT & Cardio", color: "bg-purple-100 text-purple-700" },
  { value: "yoga", label: "Yoga & Flexibility", color: "bg-pink-100 text-pink-700" },
  { value: "nutrition", label: "Nutrition Coaching", color: "bg-yellow-100 text-yellow-700" },
  { value: "sports", label: "Sports Performance", color: "bg-cyan-100 text-cyan-700" },
];

export default function TrainerSettings() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // Theme
  const { theme, toggleTheme } = useTheme();

  // Form state
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({
    instagram: "",
    twitter: "",
    linkedin: "",
    website: "",
  });

  // Username validation state
  const debouncedUsername = useDebounce(username, 500);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Check username availability
  const { data: usernameCheck, isFetching: usernameCheckFetching } = trpc.trainerProfile.checkUsername.useQuery(
    { username: debouncedUsername },
    {
      enabled: !!debouncedUsername && debouncedUsername.length >= 3 && debouncedUsername !== user?.username,
    }
  );

  // Update mutation
  const updateMutation = trpc.trainerProfile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setBio(user.bio || "");
      setSpecialties(Array.isArray(user.specialties) ? user.specialties : []);
      const userSocialLinks = (user.socialLinks || {}) as SocialLinksType;
      setSocialLinks({
        instagram: userSocialLinks.instagram || "",
        twitter: userSocialLinks.twitter || "",
        linkedin: userSocialLinks.linkedin || "",
        website: userSocialLinks.website || "",
      });
    }
  }, [user]);

  // Redirect if not authenticated or not a trainer
  useEffect(() => {
    if (!loading && (!isAuthenticated || (user && user.role !== "trainer"))) {
      setLocation("/");
    }
  }, [loading, isAuthenticated, user, setLocation]);

  // Username validation status
  const usernameStatus = useMemo(() => {
    if (!username || username.length < 3) return null;
    if (username === user?.username) return { valid: true, message: "Current username" };
    if (!/^[a-z0-9_-]+$/.test(username)) return { valid: false, message: "Only lowercase letters, numbers, underscores, and hyphens" };
    if (username.length > 30) return { valid: false, message: "Maximum 30 characters" };
    if (usernameCheckFetching) return { valid: null, message: "Checking..." };
    if (usernameCheck?.available) return { valid: true, message: "Available!" };
    if (usernameCheck?.available === false) return { valid: false, message: "Already taken" };
    return null;
  }, [username, user?.username, usernameCheck, usernameCheckFetching]);

  const toggleSpecialty = (value: string) => {
    setSpecialties((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : prev.length < 4
        ? [...prev, value]
        : prev
    );
  };

  const handleSave = () => {
    // Filter out empty social links
    const filteredSocialLinks: Record<string, string> = {};
    Object.entries(socialLinks).forEach(([key, value]) => {
      if (value.trim()) {
        filteredSocialLinks[key] = value.trim();
      }
    });

    updateMutation.mutate({
      username: username || undefined,
      bio: bio || undefined,
      specialties: specialties.length > 0 ? specialties : undefined,
      socialLinks: Object.keys(filteredSocialLinks).length > 0 ? filteredSocialLinks : undefined,
    });
  };

  const hasChanges = useMemo(() => {
    if (!user) return false;
    const currentSocialLinks = (user.socialLinks || {}) as SocialLinksType;
    const socialLinksChanged = Object.keys(socialLinks).some(
      (key) => (socialLinks[key] || "") !== (currentSocialLinks[key] || "")
    );
    const currentSpecialties = Array.isArray(user.specialties) ? [...user.specialties].sort() : [];
    const newSpecialties = [...specialties].sort();
    return (
      username !== (user.username || "") ||
      bio !== (user.bio || "") ||
      JSON.stringify(newSpecialties) !== JSON.stringify(currentSpecialties) ||
      socialLinksChanged
    );
  }, [user, username, bio, specialties, socialLinks]);

  if (loading) {
    return (
      <AppShell title="Profile Settings">
        <div className="container py-4 pb-24">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-slate-200 rounded-xl" />
            <div className="h-48 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile Settings">
      <div className="container py-4 pb-24 space-y-4">
        {/* Media Gallery Section */}
        <TrainerMediaGallery />

        {/* Appearance Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {theme === "dark" ? (
                <Moon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Sun className="h-5 w-5 text-yellow-500" />
              )}
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how LocoMotivate looks to you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">
                  {theme === "dark" ? "Currently enabled" : "Currently disabled"}
                </p>
              </div>
              <Button
                onClick={toggleTheme}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4" />
                    Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" />
                    Dark Mode
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Username Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AtSign className="h-5 w-5 text-blue-500" />
              Username
            </CardTitle>
            <CardDescription>
              Your unique profile URL: locomotivate.com/t/{username || "your-username"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                  placeholder="your_username"
                  className="pr-10"
                  maxLength={30}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameCheckFetching ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : usernameStatus?.valid === true ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : usernameStatus?.valid === false ? (
                    <X className="h-4 w-4 text-red-500" />
                  ) : null}
                </div>
              </div>
              {usernameStatus && (
                <p className={`text-sm ${usernameStatus.valid ? "text-green-600" : usernameStatus.valid === false ? "text-red-600" : "text-muted-foreground"}`}>
                  {usernameStatus.message}
                </p>
              )}
              {user?.username && (
                <a
                  href={`/t/${user.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  View your public profile
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bio Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-500" />
              Bio
            </CardTitle>
            <CardDescription>
              Tell potential clients about yourself and your training philosophy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="I'm a certified personal trainer specializing in..."
                rows={4}
                maxLength={500}
              />
              <p className="text-sm text-muted-foreground text-right">{bio.length}/500</p>
            </div>
          </CardContent>
        </Card>

        {/* Specialties Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-orange-500" />
              Specialties
            </CardTitle>
            <CardDescription>
              Select up to 4 areas of expertise (shown on your profile)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((specialty) => {
                const isSelected = specialties.includes(specialty.value);
                return (
                  <button
                    key={specialty.value}
                    onClick={() => toggleSpecialty(specialty.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      isSelected
                        ? specialty.color + " ring-2 ring-offset-1 ring-current"
                        : "bg-muted text-muted-foreground hover:bg-slate-200"
                    }`}
                  >
                    {specialty.label}
                    {isSelected && <Check className="inline-block h-3 w-3 ml-1" />}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {specialties.length}/4 selected
            </p>
          </CardContent>
        </Card>
        {/* Social Links Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-purple-500" />
              Social Links
            </CardTitle>
            <CardDescription>
              Connect your social profiles (optional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" />
                Instagram
              </Label>
              <Input
                value={socialLinks.instagram}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, instagram: e.target.value }))}
                placeholder="https://instagram.com/yourhandle"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-blue-400" />
                Twitter / X
              </Label>
              <Input
                value={socialLinks.twitter}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, twitter: e.target.value }))}
                placeholder="https://twitter.com/yourhandle"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-blue-600" />
                LinkedIn
              </Label>
              <Input
                value={socialLinks.linkedin}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, linkedin: e.target.value }))}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Website
              </Label>
              <Input
                value={socialLinks.website}
                onChange={(e) => setSocialLinks((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="https://yourwebsite.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="sticky bottom-20 bg-white/80 backdrop-blur-sm py-3 -mx-4 px-4 border-t">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending || usernameStatus?.valid === false}
            className="w-full"
            size="lg"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
