import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Users as UsersIcon,
  Search,
  MoreVertical,
  Eye,
  Shield,
  UserPlus,
  Mail,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  CheckCircle,
  Ban,
  Calendar,
  Clock,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const roleColors: Record<string, string> = {
  coordinator: "bg-purple-100 text-purple-800 border-purple-200",
  manager: "bg-blue-100 text-blue-800 border-blue-200",
  trainer: "bg-green-100 text-green-800 border-green-200",
  client: "bg-orange-100 text-orange-800 border-orange-200",
  shopper: "bg-gray-100 text-gray-800 border-gray-200",
};

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
};

type SortField = "name" | "email" | "role" | "createdAt" | "lastSignedIn";
type SortOrder = "asc" | "desc";

export default function ManagerUsers() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(0);
  const limit = 25;
  
  // Role management dialog state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    id: number;
    name: string | null;
    role: string;
  } | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  
  // Invite dialog state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("trainer");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  
  const utils = trpc.useUtils();

  // Fetch users with filters
  const { data, isLoading, refetch } = trpc.admin.listUsers.useQuery({
    search: searchQuery || undefined,
    role: roleFilter as "all" | "shopper" | "client" | "trainer" | "manager" | "coordinator",
    status: statusFilter as "all" | "active" | "suspended" | "pending",
    sortBy,
    sortOrder,
    limit,
    offset: page * limit,
  });

  // Update role mutation
  const updateRole = trpc.auth.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated successfully");
      setRoleDialogOpen(false);
      setSelectedUser(null);
      setNewRole("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  // Invite trainer mutation
  const inviteTrainer = trpc.trainers.invite.useMutation({
    onSuccess: (data) => {
      toast.success("User invited successfully");
      setInviteLink(data.inviteLink);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to invite user");
    },
  });

  // Handle role update
  const handleRoleUpdate = () => {
    if (!selectedUser || !newRole) return;
    updateRole.mutate({
      userId: selectedUser.id,
      role: newRole as "shopper" | "client" | "trainer" | "manager" | "coordinator",
    });
  };

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
    setInviteRole("trainer");
    setInviteLink(null);
    setInviteDialogOpen(false);
  };

  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(0);
  };

  // Format date
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format relative time
  const formatRelativeTime = (date: Date | null | undefined) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  const users = data?.users || [];
  const total = data?.total || 0;
  const roleCounts = data?.roleCounts || { all: 0, shopper: 0, client: 0, trainer: 0, manager: 0, coordinator: 0 };
  const totalPages = Math.ceil(total / limit);

  return (
    <AppShell title="Users">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users</h1>
            <p className="text-sm text-muted-foreground">Manage all user accounts and roles</p>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={(open) => { if (!open) resetInviteDialog(); else setInviteDialogOpen(true); }}>
            <Button className="gap-2" onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an invitation to a new user. They will receive login credentials.
                </DialogDescription>
              </DialogHeader>
              
              {inviteLink ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800 font-medium mb-2">User account created!</p>
                    <p className="text-xs text-green-700">Share this link with the user to let them log in:</p>
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
                      placeholder="user@example.com"
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

        {/* Role Stats */}
        <div className="grid grid-cols-6 gap-2 mb-6">
          {[
            { key: "all", label: "All", count: roleCounts.all, color: "bg-gray-100" },
            { key: "coordinator", label: "Coordinators", count: roleCounts.coordinator, color: "bg-purple-100" },
            { key: "manager", label: "Managers", count: roleCounts.manager, color: "bg-blue-100" },
            { key: "trainer", label: "Trainers", count: roleCounts.trainer, color: "bg-green-100" },
            { key: "client", label: "Clients", count: roleCounts.client, color: "bg-orange-100" },
            { key: "shopper", label: "Shoppers", count: roleCounts.shopper, color: "bg-gray-100" },
          ].map((item) => (
            <Button
              key={item.key}
              variant={roleFilter === item.key ? "default" : "outline"}
              onClick={() => { setRoleFilter(item.key); setPage(0); }}
              className="h-auto flex flex-col items-center justify-center p-2"
            >
              <p className="text-lg font-bold">{item.count}</p>
              <p className="text-xs">{item.label}</p>
            </Button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or username..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          <span>Sort by:</span>
          {[
            { key: "createdAt", label: "Joined" },
            { key: "lastSignedIn", label: "Last Active" },
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
          ].map((item) => (
            <Button
              key={item.key}
              variant="ghost"
              size="sm"
              onClick={() => toggleSort(item.key as SortField)}
              className={`gap-1 ${sortBy === item.key ? "text-foreground font-medium" : ""}`}
            >
              {item.label}
              {sortBy === item.key && (
                sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
              )}
            </Button>
          ))}
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <Card 
                key={user.id} 
                className="hover:shadow-md transition-all cursor-pointer"
                onClick={() => setLocation(`/manager/users/${user.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      {user.photoUrl && <AvatarImage src={user.photoUrl} />}
                      <AvatarFallback>
                        {(user.name || user.email || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{user.name || "Unnamed User"}</h3>
                        <Badge className={roleColors[user.role] || roleColors.shopper}>{user.role}</Badge>
                        {user.status !== "active" && (
                          <Badge className={statusColors[user.status] || statusColors.active}>{user.status}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email || "No email"}
                        </span>
                        {user.username && (
                          <span>@{user.username}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Joined {formatDate(user.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Active {formatRelativeTime(user.lastSignedIn)}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/manager/users/${user.id}`); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUser({ id: user.id, name: user.name, role: user.role });
                          setNewRole("");
                          setRoleDialogOpen(true);
                        }}>
                          <Shield className="h-4 w-4 mr-2" />
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status === "active" && (
                          <DropdownMenuItem className="text-red-600" onClick={(e) => e.stopPropagation()}>
                            <Ban className="h-4 w-4 mr-2" />
                            Suspend User
                          </DropdownMenuItem>
                        )}
                        {user.status === "suspended" && (
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Reactivate User
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && users.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <UsersIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No users found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total} users
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Role Management Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change User Role</DialogTitle>
              <DialogDescription>
                Update the role for {selectedUser?.name || "this user"}. This will change their access permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Current Role</Label>
                <p className="text-sm text-muted-foreground capitalize">{selectedUser?.role}</p>
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
