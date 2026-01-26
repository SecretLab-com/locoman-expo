import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Users,
  Search,
  MoreVertical,
  Eye,
  Ban,
  CheckCircle,
  Mail,
  DollarSign,
  Loader2,
  UserPlus,
  Shield,
  Copy,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-700",
};

type Trainer = {
  id: number;
  name: string;
  email: string;
  status: string;
  bundles: number;
  clients: number;
  revenue: number;
  joinedAt: string;
};

export default function ManagerTrainers() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const utils = trpc.useUtils();
  
  // Invite trainer dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  
  // Role management dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  // Fetch all trainers
  const { data: allTrainers, isLoading: trainersLoading } = trpc.trainers.list.useQuery();
  
  // Fetch pending trainers
  const { data: pendingTrainers, isLoading: pendingLoading } = trpc.trainers.pending.useQuery();

  // Approve trainer mutation
  const approveTrainer = trpc.trainers.approve.useMutation({
    onSuccess: () => {
      toast.success("Trainer approved");
      utils.trainers.list.invalidate();
      utils.trainers.pending.invalidate();
    },
    onError: () => {
      toast.error("Failed to approve trainer");
    },
  });

  // Reject trainer mutation
  const rejectTrainer = trpc.trainers.reject.useMutation({
    onSuccess: () => {
      toast.success("Trainer application rejected");
      utils.trainers.list.invalidate();
      utils.trainers.pending.invalidate();
    },
    onError: () => {
      toast.error("Failed to reject trainer");
    },
  });

  // Suspend trainer mutation
  const suspendTrainer = trpc.trainers.suspend.useMutation({
    onSuccess: () => {
      toast.success("Trainer suspended");
      utils.trainers.list.invalidate();
    },
    onError: () => {
      toast.error("Failed to suspend trainer");
    },
  });

  // Invite trainer mutation
  const inviteTrainer = trpc.trainers.invite.useMutation({
    onSuccess: (data) => {
      toast.success("Trainer invited successfully");
      setInviteLink(data.inviteLink);
      utils.trainers.list.invalidate();
      utils.trainers.pending.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to invite trainer");
    },
  });

  // Update role mutation
  const updateRole = trpc.auth.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated successfully");
      setRoleDialogOpen(false);
      setSelectedTrainer(null);
      setNewRole("");
      utils.trainers.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  // Handle invite submission
  const handleInviteSubmit = () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    inviteTrainer.mutate({
      email: inviteEmail.trim(),
      name: inviteName.trim() || undefined,
    });
  };

  // Handle role update
  const handleRoleUpdate = () => {
    if (!selectedTrainer || !newRole) return;
    updateRole.mutate({
      userId: selectedTrainer.id,
      role: newRole as "shopper" | "client" | "trainer" | "manager" | "coordinator",
    });
  };

  // Copy invite link to clipboard
  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success("Invite link copied to clipboard");
    }
  };

  // Reset invite dialog
  const resetInviteDialog = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteLink(null);
    setInviteDialogOpen(false);
  };

  // Transform data for display
  const trainers: Trainer[] = useMemo(() => {
    const result: Trainer[] = [];
    
    // Add active trainers (getTrainers returns users directly)
    if (allTrainers) {
      for (const t of allTrainers) {
        result.push({
          id: t.id,
          name: t.name || "Unknown",
          email: t.email || "No email",
          status: "active",
          bundles: 0, // Would need to join with bundles table
          clients: 0, // Would need to join with clients table
          revenue: 0, // Would need to calculate from orders
          joinedAt: t.createdAt?.toISOString().split("T")[0] || "Unknown",
        });
      }
    }
    
    // Add pending trainers (getPendingTrainers returns joined data)
    if (pendingTrainers) {
      for (const t of pendingTrainers) {
        // Avoid duplicates
        if (!result.find(r => r.id === t.users.id)) {
          result.push({
            id: t.users.id,
            name: t.users.name || "Unknown",
            email: t.users.email || "No email",
            status: "pending",
            bundles: 0,
            clients: 0,
            revenue: 0,
            joinedAt: t.trainer_approvals.createdAt?.toISOString().split("T")[0] || "Unknown",
          });
        }
      }
    }
    
    return result;
  }, [allTrainers, pendingTrainers]);

  const filteredTrainers = trainers.filter((trainer) => {
    const matchesSearch =
      trainer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainer.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "active" && trainer.status === "active") ||
      (activeTab === "pending" && trainer.status === "pending") ||
      (activeTab === "suspended" && trainer.status === "suspended");
    return matchesSearch && matchesTab;
  });

  const stats = useMemo(() => ({
    total: trainers.length,
    active: trainers.filter((t) => t.status === "active").length,
    pending: trainers.filter((t) => t.status === "pending").length,
    revenue: trainers.reduce((sum, t) => sum + t.revenue, 0),
  }), [trainers]);

  const isLoading = trainersLoading || pendingLoading;

  return (
    <AppShell title="Trainers">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trainers</h1>
            <p className="text-sm text-muted-foreground">Manage trainer accounts and approvals</p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={(open) => { if (!open) resetInviteDialog(); else setInviteDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Invite Trainer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Trainer</DialogTitle>
                <DialogDescription>
                  Send an invitation to a new trainer. They will receive login credentials.
                </DialogDescription>
              </DialogHeader>
              
              {inviteLink ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium mb-2">Trainer account created!</p>
                    <p className="text-xs text-green-700">Share this link with the trainer to let them log in:</p>
                  </div>
                  <div className="flex gap-2">
                    <Input value={inviteLink} readOnly className="text-xs" />
                    <Button variant="outline" size="icon" onClick={copyInviteLink}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={resetInviteDialog}>Done</Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email Address *</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="trainer@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Name (optional)</Label>
                    <Input
                      id="invite-name"
                      placeholder="John Smith"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleInviteSubmit} disabled={inviteTrainer.isPending}>
                      {inviteTrainer.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Inviting...</>
                      ) : (
                        "Send Invitation"
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <Button
            variant="outline"
            onClick={() => setActiveTab("all")}
            className="h-auto flex flex-col items-center justify-center p-3"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </Button>
          <Button
            variant="outline"
            onClick={() => setActiveTab("active")}
            className="h-auto flex flex-col items-center justify-center p-3"
          >
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-lg font-bold">{stats.active}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </Button>
          <Button
            variant="outline"
            onClick={() => setActiveTab("pending")}
            className="h-auto flex flex-col items-center justify-center p-3"
          >
            <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-lg font-bold">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </Button>
          <Button
            variant="outline"
            onClick={() => setActiveTab("all")}
            className="h-auto flex flex-col items-center justify-center p-3"
          >
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mb-1">
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-lg font-bold">
              ${(stats.revenue / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search trainers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="active" className="flex-1">Active</TabsTrigger>
            <TabsTrigger value="pending" className="flex-1">Pending</TabsTrigger>
            <TabsTrigger value="suspended" className="flex-1">Suspended</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Trainers List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrainers.map((trainer) => (
              <Card 
                key={trainer.id} 
                className="hover:shadow-md transition-all cursor-pointer"
                onClick={() => trainer.status !== "pending" && setLocation(`/manager/trainers/${trainer.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {trainer.name.split(" ").map((n) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{trainer.name}</h3>
                        {/* Hide status badge for pending trainers since approve/reject buttons are shown */}
                        {trainer.status !== "pending" && (
                          <Badge className={statusColors[trainer.status] || statusColors.pending}>{trainer.status}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Mail className="h-3 w-3" />
                        {trainer.email}
                      </div>

                      {trainer.status === "active" && (
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-muted-foreground">
                            <span className="font-semibold">{trainer.bundles}</span> bundles
                          </span>
                          <span className="text-muted-foreground">
                            <span className="font-semibold">{trainer.clients}</span> clients
                          </span>
                          <span className="text-muted-foreground">
                            <span className="font-semibold">${trainer.revenue.toLocaleString()}</span>
                          </span>
                        </div>
                      )}

                      {trainer.status === "pending" && (
                        <div className="flex items-center gap-2 mt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 h-7 text-xs"
                            onClick={(e) => { e.stopPropagation(); rejectTrainer.mutate({ trainerId: trainer.id }); }}
                            disabled={rejectTrainer.isPending}
                          >
                            Reject
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); approveTrainer.mutate({ trainerId: trainer.id }); }} 
                            className="h-7 text-xs"
                            disabled={approveTrainer.isPending}
                          >
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>

                    {trainer.status !== "pending" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/manager/trainers/${trainer.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTrainer(trainer);
                            setNewRole("");
                            setRoleDialogOpen(true);
                          }}>
                            <Shield className="h-4 w-4 mr-2" />
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {trainer.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => suspendTrainer.mutate({ trainerId: trainer.id })}
                              className="text-red-600"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          )}
                          {trainer.status === "suspended" && (
                            <DropdownMenuItem onClick={() => approveTrainer.mutate({ trainerId: trainer.id })}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Reactivate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredTrainers.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No trainers found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Role Management Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Update the role for {selectedTrainer?.name || "this user"}. This will change their access permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Current Role</Label>
                <p className="text-sm text-muted-foreground capitalize">trainer</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">New Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shopper">Shopper (Basic User)</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="coordinator">Coordinator</SelectItem>
                    <SelectItem value="manager">Manager (Admin)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {newRole === "manager" && "⚠️ Managers have full administrative access to the platform."}
                  {newRole === "coordinator" && "Coordinators can manage trainers and view reports."}
                  {newRole === "trainer" && "Trainers can create bundles and manage clients."}
                  {newRole === "client" && "Clients can purchase bundles from trainers."}
                  {newRole === "shopper" && "Shoppers have basic access to browse the platform."}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
              <Button 
                onClick={handleRoleUpdate} 
                disabled={!newRole || updateRole.isPending}
              >
                {updateRole.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
                ) : (
                  "Update Role"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
