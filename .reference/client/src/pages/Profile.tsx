import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { AvatarUpload } from "@/components/AvatarUpload";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  User,
  Mail,
  Shield,
  LogOut,
  Settings,
  Bell,
  CreditCard,
  HelpCircle,
  ChevronRight,
  Pencil,
  Check,
  X,
  Phone,
  FileText,
  Loader2,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Profile() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    bio: "",
  });
  const utils = trpc.useUtils();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      toast.success("Logged out successfully");
      window.location.href = "/";
    },
    onError: () => {
      toast.error("Failed to log out");
    },
  });

  const updateProfileMutation = trpc.userProfile.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated successfully");
      utils.auth.me.invalidate();
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const handleStartEdit = () => {
    setEditForm({
      name: user?.name || "",
      phone: user?.phone || "",
      bio: user?.bio || "",
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({ name: "", phone: "", bio: "" });
  };

  const handleSaveEdit = () => {
    const updates: { name?: string; phone?: string; bio?: string } = {};
    
    if (editForm.name && editForm.name !== user?.name) {
      updates.name = editForm.name;
    }
    if (editForm.phone !== (user?.phone || "")) {
      updates.phone = editForm.phone;
    }
    if (editForm.bio !== (user?.bio || "")) {
      updates.bio = editForm.bio;
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    updateProfileMutation.mutate(updates);
  };

  const menuItems = [
    { icon: Settings, label: "Account Settings", path: "/settings", description: "Manage your account" },
    { icon: Bell, label: "Notifications", path: "/notifications", description: "Notification preferences" },
    { icon: CreditCard, label: "Payment Methods", path: "/payments", description: "Manage payment options" },
    { icon: HelpCircle, label: "Help & Support", path: "/help", description: "Get help and FAQs" },
  ];

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "manager":
        return "bg-purple-100 text-purple-700";
      case "trainer":
        return "bg-blue-100 text-blue-700";
      case "client":
        return "bg-green-100 text-green-700";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case "manager":
        return "Manager";
      case "trainer":
        return "Trainer";
      case "client":
        return "Client";
      default:
        return "Shopper";
    }
  };

  const getPublicProfileUrl = () => {
    if (!user) return "";
    return `${window.location.origin}/u/${user.id}`;
  };

  const handleShareProfile = async () => {
    const url = getPublicProfileUrl();
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${user?.name || "User"}'s Profile - LocoMotivate`,
          text: user?.bio || "Check out my profile on LocoMotivate!",
          url,
        });
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        copyProfileLink();
      }
    } else {
      copyProfileLink();
    }
  };

  const copyProfileLink = () => {
    const url = getPublicProfileUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Profile link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <AppShell title="Profile">
        <div className="container py-4 pb-24">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-slate-200 rounded-xl" />
            <div className="h-48 bg-slate-200 rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Profile">
        <div className="container py-4 pb-24">
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Sign in to view your profile</h2>
              <p className="text-muted-foreground mb-6">Access your account settings and preferences</p>
              <Button onClick={() => setLocation("/")}>
                Go to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile">
      <div className="container py-4 pb-24">
        {/* Profile Header */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AvatarUpload
                currentPhotoUrl={user.photoUrl}
                userName={user.name}
                size="xl"
              />
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="name" className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        id="name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="Your name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-xs text-muted-foreground">Phone</Label>
                      <div className="relative mt-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          placeholder="Your phone number"
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="bio" className="text-xs text-muted-foreground">Bio</Label>
                      <Textarea
                        id="bio"
                        value={editForm.bio}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        placeholder="Tell us about yourself..."
                        className="mt-1 resize-none"
                        rows={3}
                        maxLength={500}
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-right">
                        {editForm.bio.length}/500
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={updateProfileMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-foreground truncate">{user.name || "User"}</h1>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={handleStartEdit}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{user.email || "No email"}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Phone className="h-4 w-4" />
                        <span>{user.phone}</span>
                      </div>
                    )}
                    {user.bio && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2">
                        <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{user.bio}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getRoleBadgeColor(user.role)}>
                        <Shield className="h-3 w-3 mr-1" />
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        {user.role === "trainer" && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Bundles</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Clients</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">$0</p>
                <p className="text-xs text-muted-foreground">Revenue</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Share Profile */}
        <Card className="mb-4">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <Share2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Share Your Profile</p>
                  <p className="text-sm text-muted-foreground">Let others find and connect with you</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyProfileLink}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Link
                    </>
                  )}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleShareProfile}
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </div>
            </div>
            <div className="mt-3 p-2 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground truncate">{getPublicProfileUrl()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card className="mb-4">
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <div key={item.path}>
                <button
                  className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
                  onClick={() => toast.info("Feature coming soon")}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
                {index < menuItems.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Logout Button */}
        <Button
          variant="outline"
          className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {logoutMutation.isPending ? "Logging out..." : "Log Out"}
        </Button>

        {/* App Version */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          LocoMotivate v1.0.0
        </p>
      </div>
    </AppShell>
  );
}
