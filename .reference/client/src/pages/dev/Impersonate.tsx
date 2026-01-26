import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, UserCog, Shield, Users, ShoppingBag, Dumbbell, Building2, Crown, 
  AlertTriangle, Star, StarOff, History, Zap, Play, ArrowLeft, Home
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type RoleFilter = "all" | "shopper" | "client" | "trainer" | "manager" | "coordinator";

const roleConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  coordinator: { label: "Coordinator", color: "bg-purple-500", icon: <Crown className="h-3 w-3" /> },
  manager: { label: "Manager", color: "bg-blue-500", icon: <Building2 className="h-3 w-3" /> },
  trainer: { label: "Trainer", color: "bg-green-500", icon: <Dumbbell className="h-3 w-3" /> },
  client: { label: "Client", color: "bg-orange-500", icon: <Users className="h-3 w-3" /> },
  shopper: { label: "Shopper", color: "bg-gray-500", icon: <ShoppingBag className="h-3 w-3" /> },
};

export default function ImpersonatePage() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [activeTab, setActiveTab] = useState("users");
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.impersonate.listUsers.useQuery(
    { search: search || undefined, role: roleFilter },
    { enabled: user?.role === "coordinator" }
  );

  const { data: shortcuts, isLoading: shortcutsLoading } = trpc.impersonate.shortcuts.useQuery(
    undefined,
    { enabled: user?.role === "coordinator" }
  );

  const { data: logsData, isLoading: logsLoading } = trpc.impersonate.logs.useQuery(
    { limit: 50 },
    { enabled: user?.role === "coordinator" && activeTab === "logs" }
  );

  const startImpersonation = trpc.impersonate.start.useMutation({
    onSuccess: (result) => {
      toast.success(`Now impersonating ${result.impersonatedUser.name || result.impersonatedUser.email}`);
      utils.auth.me.invalidate();
      const role = result.impersonatedUser.role;
      if (role === "trainer") {
        navigate("/trainer");
      } else if (role === "manager") {
        navigate("/manager");
      } else if (role === "client") {
        navigate("/client");
      } else {
        navigate("/");
      }
    },
    onError: (error) => {
      toast.error(`Failed to impersonate: ${error.message}`);
    },
  });

  const startRoleSimulation = trpc.impersonate.startRoleSimulation.useMutation({
    onSuccess: (result) => {
      toast.success(`Now simulating ${result.role} role as ${result.impersonatedUser.name}`);
      utils.auth.me.invalidate();
      const role = result.role;
      if (role === "trainer") {
        navigate("/trainer");
      } else if (role === "manager") {
        navigate("/manager");
      } else if (role === "client") {
        navigate("/client");
      } else {
        navigate("/");
      }
    },
    onError: (error) => {
      toast.error(`Failed to simulate role: ${error.message}`);
    },
  });

  const addShortcut = trpc.impersonate.addShortcut.useMutation({
    onSuccess: () => {
      toast.success("Added to shortcuts");
      utils.impersonate.shortcuts.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to add shortcut: ${error.message}`);
    },
  });

  const removeShortcut = trpc.impersonate.removeShortcut.useMutation({
    onSuccess: () => {
      toast.success("Removed from shortcuts");
      utils.impersonate.shortcuts.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to remove shortcut: ${error.message}`);
    },
  });

  // Show loading state
  if (authLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Check if user is coordinator
  if (!user || user.role !== "coordinator") {
    return (
      <div className="container max-w-4xl py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This page is only accessible to coordinators for testing purposes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/")}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "?";
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isInShortcuts = (userId: number) => {
    return shortcuts?.some(s => s.targetUserId === userId);
  };

  const getShortcutId = (userId: number) => {
    return shortcuts?.find(s => s.targetUserId === userId)?.id;
  };

  return (
    <div className="container max-w-4xl py-8">
      {/* Navigation */}
      <div className="flex items-center gap-2 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.history.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/manager")}
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Dashboard
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <UserCog className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">User Impersonation</h1>
            <p className="text-muted-foreground">
              Test the app as any user. Your admin session will be preserved.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <Shield className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            Logged in as <strong>{user.name || user.email}</strong> (Coordinator)
          </span>
        </div>
      </div>

      {/* Quick Role Simulation */}
      <Card className="mb-6 border-dashed border-2 border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Quick Role Simulation
          </CardTitle>
          <CardDescription>
            Instantly test as any role without selecting a specific user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(["shopper", "client", "trainer", "manager"] as const).map((role) => (
              <Button
                key={role}
                variant="outline"
                size="sm"
                onClick={() => startRoleSimulation.mutate({ role })}
                disabled={startRoleSimulation.isPending}
                className="gap-2"
              >
                <Play className="h-3 w-3" />
                {roleConfig[role]?.icon}
                Test as {roleConfig[role]?.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Shortcuts */}
      {shortcuts && shortcuts.length > 0 && (
        <Card className="mb-6 border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              Quick Switch Shortcuts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {shortcuts.map((shortcut) => (
                <Button
                  key={shortcut.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => startImpersonation.mutate({ userId: shortcut.targetUserId })}
                  disabled={startImpersonation.isPending}
                  className="gap-2"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={shortcut.targetUser?.photoUrl || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(shortcut.targetUser?.name || null, shortcut.targetUser?.email || null)}
                    </AvatarFallback>
                  </Avatar>
                  {shortcut.label || shortcut.targetUser?.name || shortcut.targetUser?.email}
                  <Badge variant="outline" className="text-[10px] px-1">
                    {shortcut.targetUser?.role}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            All Users
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          {/* Search and Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or username..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Role Filter Chips */}
                <div className="flex flex-wrap gap-2">
                  {(["all", "coordinator", "manager", "trainer", "client", "shopper"] as const).map((role) => (
                    <Button
                      key={role}
                      variant={roleFilter === role ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRoleFilter(role)}
                      className="gap-1"
                    >
                      {role !== "all" && roleConfig[role]?.icon}
                      {role === "all" ? "All Roles" : roleConfig[role]?.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Users {data?.total !== undefined && `(${data.total})`}
              </CardTitle>
              <CardDescription>
                Click "Become User" to start impersonating, or star to add to shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : data?.users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No users found matching your criteria
                </div>
              ) : (
                <div className="space-y-3">
                  {data?.users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      {/* Avatar */}
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={u.photoUrl || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(u.name, u.email)}
                        </AvatarFallback>
                      </Avatar>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {u.name || "Unnamed User"}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`${roleConfig[u.role]?.color} text-white text-xs gap-1`}
                          >
                            {roleConfig[u.role]?.icon}
                            {roleConfig[u.role]?.label}
                          </Badge>
                          {u.id === user.id && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {u.email || "No email"}
                          {u.username && ` • @${u.username}`}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last active: {formatDate(u.lastSignedIn)}
                        </div>
                      </div>

                      {/* Shortcut Button */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => {
                          if (isInShortcuts(u.id)) {
                            const shortcutId = getShortcutId(u.id);
                            if (shortcutId) removeShortcut.mutate({ id: shortcutId });
                          } else {
                            addShortcut.mutate({ userId: u.id });
                          }
                        }}
                        disabled={addShortcut.isPending || removeShortcut.isPending}
                      >
                        {isInShortcuts(u.id) ? (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>

                      {/* Action Button */}
                      <Button
                        size="sm"
                        variant={u.id === user.id ? "outline" : "default"}
                        disabled={u.id === user.id || startImpersonation.isPending}
                        onClick={() => startImpersonation.mutate({ userId: u.id })}
                      >
                        {startImpersonation.isPending ? "..." : u.id === user.id ? "Current" : "Become User"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Load More */}
              {data?.hasMore && (
                <div className="mt-4 text-center">
                  <Button variant="outline" size="sm">
                    Load More
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Impersonation Audit Log
              </CardTitle>
              <CardDescription>
                All impersonation sessions are logged for security compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : logsData?.logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No impersonation logs yet
                </div>
              ) : (
                <div className="space-y-3">
                  {logsData?.logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-3 rounded-lg border bg-muted/30"
                    >
                      <div className={`p-2 rounded-full ${
                        log.action === "start" ? "bg-green-100 text-green-600" :
                        log.action === "stop" ? "bg-red-100 text-red-600" :
                        "bg-blue-100 text-blue-600"
                      }`}>
                        {log.action === "start" ? <Play className="h-4 w-4" /> :
                         log.action === "stop" ? <History className="h-4 w-4" /> :
                         <Zap className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {log.adminUser?.name || "Unknown Admin"}
                          </span>
                          <span className="text-muted-foreground">
                            {log.action === "start" ? "started" : log.action === "stop" ? "stopped" : "switched"}
                          </span>
                          {log.mode === "role" ? (
                            <Badge variant="secondary" className="gap-1">
                              <Zap className="h-3 w-3" />
                              Role Simulation: {log.targetRole}
                            </Badge>
                          ) : (
                            <span className="font-medium">
                              {log.targetUser?.name || "Unknown User"}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatDateTime(log.createdAt)}
                          {log.ipAddress && ` • IP: ${log.ipAddress}`}
                        </div>
                        {log.notes && (
                          <div className="text-sm text-muted-foreground mt-1 italic">
                            "{log.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <Card className="mt-6 bg-muted/30">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">How Impersonation Works</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Your admin session is stored securely in a separate cookie</li>
            <li>• You'll see a banner at the top of every page while impersonating</li>
            <li>• Click "Exit Impersonation" in the banner to return to your admin account</li>
            <li>• Impersonation automatically expires after 4 hours</li>
            <li>• All actions you take will be logged for audit purposes</li>
            <li>• Use Quick Role Simulation to test a role without selecting a specific user</li>
            <li>• Star users to add them to your Quick Switch shortcuts</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
