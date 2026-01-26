import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/AvatarUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Users,
  Calendar,
  MessageSquare,
  Search,
  MoreVertical,
  Mail,
  Eye,
  Trash2,
  UserPlus,
  DollarSign,
  Clock,
  Loader2,
  Send,
  XCircle,
  CheckCircle,
  Copy,
  UserCheck,
  UserX,
  Inbox,
  Package,
} from "lucide-react";
import {
  StatsGridSkeleton,
  ListSkeleton,
  FilterBarSkeleton,
  TabsSkeleton,
  PageHeaderSkeleton,
} from "@/components/skeletons";
import { SwipeableListItem } from "@/components/SwipeableListItem";
import { InviteToBundleDialog } from "@/components/InviteToBundleDialog";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { triggerHaptic } from "@/hooks/useHaptic";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  inactive: "bg-muted text-foreground",
  removed: "bg-red-100 text-red-700",
};

const invitationStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  expired: "bg-muted text-foreground",
  revoked: "bg-red-100 text-red-700",
};

const requestStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function TrainerClients() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [activeTab, setActiveTab] = useState("clients");
  const [inviteToBundleClient, setInviteToBundleClient] = useState<{
    id: number;
    name: string;
    email: string;
  } | null>(null);

  // Fetch clients from API
  const { data: clients, isLoading: clientsLoading, refetch: refetchClients } = trpc.clients.list.useQuery();
  
  // Fetch invitations
  const { data: invitations, isLoading: invitationsLoading, refetch: refetchInvitations } = trpc.invitations.list.useQuery();
  
  // Fetch join requests
  const { data: joinRequests, isLoading: requestsLoading, refetch: refetchRequests } = trpc.joinRequests.listForTrainer.useQuery();
  
  // Send invitation mutation
  const sendInvitation = trpc.invitations.send.useMutation({
    onSuccess: (data) => {
      triggerHaptic('success');
      toast.success(`Invitation sent to ${inviteEmail}`);
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteMessage("");
      refetchInvitations();
      
      // Copy invitation link to clipboard
      const inviteUrl = `${window.location.origin}/invite/${data.token}`;
      navigator.clipboard.writeText(inviteUrl);
      toast.info("Invitation link copied to clipboard");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  // Revoke invitation mutation
  const revokeInvitation = trpc.invitations.revoke.useMutation({
    onSuccess: () => {
      triggerHaptic('warning');
      toast.success("Invitation revoked");
      refetchInvitations();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke invitation");
    },
  });

  // Delete client mutation
  const deleteClient = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client removed");
      refetchClients();
    },
  });

  // Approve join request mutation
  const approveRequest = trpc.joinRequests.approve.useMutation({
    onSuccess: () => {
      triggerHaptic('success');
      toast.success("Request approved! Client added to your roster.");
      refetchRequests();
      refetchClients();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve request");
    },
  });

  // Reject join request mutation
  const rejectRequest = trpc.joinRequests.reject.useMutation({
    onSuccess: () => {
      triggerHaptic('warning');
      toast.success("Request declined");
      refetchRequests();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject request");
    },
  });

  const filteredClients = (clients || []).filter(
    (client) =>
      client.status !== "removed" &&
      (client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false))
  );

  const filteredInvitations = (invitations || []).filter(
    (invitation) =>
      invitation.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (invitation.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const filteredRequests = (joinRequests || []).filter(
    (request) =>
      (request.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (request.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
  );

  const pendingRequestsCount = (joinRequests || []).filter(r => r.status === "pending").length;

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }
    sendInvitation.mutate({
      email: inviteEmail,
      name: inviteName || undefined,
      message: inviteMessage || undefined,
    });
  };

  const handleRevoke = (invitationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    revokeInvitation.mutate({ id: invitationId });
  };

  const handleRemove = (clientId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteClient.mutate({ id: clientId });
  };

  const handleApproveRequest = (requestId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    approveRequest.mutate({ id: requestId });
  };

  const handleRejectRequest = (requestId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    rejectRequest.mutate({ id: requestId });
  };

  const copyInviteLink = (token: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const inviteUrl = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast.success("Invitation link copied to clipboard");
  };

  // Calculate stats from real data
  const activeCount = filteredClients.filter((c) => c.status === "active").length;
  const pendingInvitesCount = (invitations || []).filter((i) => i.status === "pending").length;
  const totalRevenue = 0; // Would need to join with orders table
  const totalSessions = 0; // Would need to join with sessions table

  const isLoading = clientsLoading || invitationsLoading || requestsLoading;

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await Promise.all([
      refetchClients(),
      refetchInvitations(),
      refetchRequests(),
    ]);
  };

  if (isLoading) {
    return (
      <AppShell title="Clients">
        <div className="container py-4 pb-24">
          <PageHeaderSkeleton className="mb-6" />
          <StatsGridSkeleton count={4} columns={4} className="mb-6" />
          <FilterBarSkeleton className="mb-4" />
          <TabsSkeleton count={3} className="mb-4" />
          <ListSkeleton count={5} showAvatar showBadge showAction />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Clients" onRefresh={handleRefresh}>
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Clients</h1>
            <p className="text-sm text-muted-foreground">Manage your client relationships</p>
          </div>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Client</DialogTitle>
                <DialogDescription>
                  Send an invitation email to add a new client to your roster
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="client@email.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Client Name (optional)</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Hi! I'd love to work with you on your fitness goals..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={sendInvitation.isPending}>
                  {sendInvitation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-1">
                <Users className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-lg font-bold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-1">
                <Send className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-lg font-bold">{pendingInvitesCount}</p>
              <p className="text-xs text-muted-foreground">Invites</p>
            </CardContent>
          </Card>
          <Card className={pendingRequestsCount > 0 ? "ring-2 ring-blue-500" : ""}>
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-1">
                <Inbox className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-lg font-bold">{pendingRequestsCount}</p>
              <p className="text-xs text-muted-foreground">Requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-1">
                <Calendar className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-lg font-bold">{totalSessions}</p>
              <p className="text-xs text-muted-foreground">Sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients, invitations, or requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clients ({filteredClients.length})
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Invites ({filteredInvitations.length})
            </TabsTrigger>
            <TabsTrigger value="requests" className="flex items-center gap-2 relative">
              <Inbox className="h-4 w-4" />
              Requests ({filteredRequests.length})
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                  {pendingRequestsCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-3">
            {filteredClients.map((client) => (
              <SwipeableListItem
                key={client.id}
                leftActions={[
                  {
                    icon: <MessageSquare className="h-5 w-5" />,
                    label: "Message",
                    color: "text-white",
                    bgColor: "bg-blue-500",
                    onClick: () => setLocation(`/trainer/messages?client=${client.id}`),
                  },
                  {
                    icon: <Package className="h-5 w-5" />,
                    label: "Invite to Bundle",
                    color: "text-white",
                    bgColor: "bg-purple-500",
                    onClick: () => setInviteToBundleClient({
                      id: client.id,
                      name: client.name,
                      email: client.email || '',
                    }),
                  },
                ]}
                rightActions={[
                  {
                    icon: <Eye className="h-5 w-5" />,
                    label: "Profile",
                    color: "text-white",
                    bgColor: "bg-slate-500",
                    onClick: () => setLocation(`/trainer/clients/${client.id}`),
                  },
                  {
                    icon: <Trash2 className="h-5 w-5" />,
                    label: "Remove",
                    color: "text-white",
                    bgColor: "bg-red-500",
                    onClick: () => deleteClient.mutate({ id: client.id }),
                  },
                ]}
                className="rounded-lg overflow-hidden"
              >
                <Card
                  className="hover:shadow-md transition-all cursor-pointer border-0 shadow-none"
                  onClick={() => setLocation(`/trainer/clients/${client.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        photoUrl={client.photoUrl}
                        name={client.name}
                        size="lg"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
                          <Badge className={statusColors[client.status || 'pending']}>{client.status || 'pending'}</Badge>
                        </div>
                        {client.email && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />
                              {client.email}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const goals = client.goals as string[] | null;
                          if (goals && Array.isArray(goals) && goals.length > 0) {
                            return (
                              <div className="flex items-center gap-2 mt-2">
                                {goals.map((goal: string) => (
                                  <Badge key={goal} variant="outline" className="text-xs capitalize">
                                    {goal.replace("_", " ")}
                                  </Badge>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <span className="text-xs text-muted-foreground mt-1 block">← Swipe for actions →</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SwipeableListItem>
            ))}

            {/* Empty state for clients */}
            {filteredClients.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No clients found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Invite your first client to get started"}
                </p>
                <Button onClick={() => setIsInviteOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Client
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Invitations Tab */}
          <TabsContent value="invitations" className="space-y-3">
            {filteredInvitations.map((invitation) => (
              <Card key={invitation.id} className="hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {invitation.name || invitation.email}
                        </h3>
                        <Badge className={invitationStatusColors[invitation.status || 'pending']}>
                          {invitation.status || 'pending'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" />
                          {invitation.email}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Sent {new Date(invitation.createdAt).toLocaleDateString()}
                        {invitation.expiresAt && (
                          <> · Expires {new Date(invitation.expiresAt).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {invitation.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => copyInviteLink(invitation.token, e)}
                            title="Copy invitation link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => handleRevoke(invitation.id, e)}
                            title="Revoke invitation"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {invitation.status === "accepted" && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty state for invitations */}
            {filteredInvitations.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Send className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No invitations sent</h3>
                <p className="text-muted-foreground mb-4">
                  Send invitations to grow your client base
                </p>
                <Button onClick={() => setIsInviteOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Send Invitation
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Join Requests Tab */}
          <TabsContent value="requests" className="space-y-3">
            {filteredRequests.map((request) => (
              <Card key={request.id} className={`hover:shadow-md transition-all ${request.status === "pending" ? "border-blue-200 bg-blue-50/30" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      photoUrl={request.user?.photoUrl}
                      name={request.user?.name}
                      size="lg"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">
                          {request.user?.name || request.user?.email || "Unknown User"}
                        </h3>
                        <Badge className={requestStatusColors[request.status || 'pending']}>
                          {request.status || 'pending'}
                        </Badge>
                      </div>
                      {request.user?.email && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 shrink-0" />
                            {request.user.email}
                          </span>
                        </div>
                      )}
                      {request.message && (
                        <p className="text-sm text-muted-foreground mt-2 bg-muted rounded-lg p-2">
                          "{request.message}"
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        Requested {new Date(request.createdAt).toLocaleDateString()}
                        {request.reviewedAt && (
                          <> · Reviewed {new Date(request.reviewedAt).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>

                    {request.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => handleRejectRequest(request.id, e)}
                          disabled={rejectRequest.isPending}
                        >
                          <UserX className="h-4 w-4 mr-1" />
                          Decline
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => handleApproveRequest(request.id, e)}
                          disabled={approveRequest.isPending}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                      </div>
                    )}
                    {request.status === "approved" && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    {request.status === "rejected" && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty state for requests */}
            {filteredRequests.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No join requests</h3>
                <p className="text-muted-foreground">
                  When customers find you in the trainer directory and request to join, they'll appear here
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite to Bundle Dialog */}
      {inviteToBundleClient && (
        <InviteToBundleDialog
          open={!!inviteToBundleClient}
          onOpenChange={(open) => !open && setInviteToBundleClient(null)}
          clientId={inviteToBundleClient.id}
          clientName={inviteToBundleClient.name}
          clientEmail={inviteToBundleClient.email}
        />
      )}
    </AppShell>
  );
}
