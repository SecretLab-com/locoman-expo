import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { UserAvatar } from "@/components/AvatarUpload";
import { trpc } from "@/lib/trpc";
import {
  Mail,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Package,
  User,
  Calendar,
  TrendingUp,
  ExternalLink,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  viewed: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-700",
  revoked: "bg-gray-100 text-gray-700",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  viewed: <Eye className="h-3 w-3" />,
  accepted: <CheckCircle className="h-3 w-3" />,
  declined: <XCircle className="h-3 w-3" />,
  expired: <Clock className="h-3 w-3" />,
  revoked: <XCircle className="h-3 w-3" />,
};

export default function Invitations() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch all invitations (manager view)
  const { data: invitations, isLoading } = trpc.admin.getAllInvitations.useQuery();

  // Filter invitations
  const filteredInvitations = (invitations || []).filter((inv) => {
    const matchesSearch =
      searchQuery === "" ||
      inv.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.recipientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.bundleTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.trainerName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    total: invitations?.length || 0,
    pending: invitations?.filter((i) => i.status === "pending").length || 0,
    viewed: invitations?.filter((i) => i.status === "viewed").length || 0,
    accepted: invitations?.filter((i) => i.status === "accepted").length || 0,
    declined: invitations?.filter((i) => i.status === "declined").length || 0,
    expired: invitations?.filter((i) => i.status === "expired").length || 0,
  };

  const conversionRate = stats.total > 0 ? ((stats.accepted / stats.total) * 100).toFixed(1) : "0";

  if (isLoading) {
    return (
      <AppShell title="Manager">
        <div className="container py-4 pb-24">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Manager">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Invitations</h1>
          <p className="text-sm text-muted-foreground">
            Monitor all bundle invitations across the platform
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs text-muted-foreground">Total Sent</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mb-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-xl font-bold">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-xs text-muted-foreground">Accepted</p>
              <p className="text-xl font-bold">{stats.accepted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-xs text-muted-foreground">Conversion</p>
              <p className="text-xl font-bold">{conversionRate}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, bundle, or trainer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invitations List */}
        <div className="space-y-3">
          {filteredInvitations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-foreground mb-1">No invitations found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your filters"
                    : "No invitations have been sent yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredInvitations.map((invitation) => (
              <Card key={invitation.id} className="hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Recipient Avatar */}
                    <UserAvatar
                      photoUrl={invitation.recipientPhotoUrl}
                      name={invitation.recipientName || invitation.email || "?"}
                      size="md"
                    />

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {invitation.recipientName || invitation.email}
                        </h3>
                        <Badge className={statusColors[invitation.status || "pending"]}>
                          {statusIcons[invitation.status || "pending"]}
                          <span className="ml-1">{invitation.status || "pending"}</span>
                        </Badge>
                        {invitation.viewedAt && invitation.status === "pending" && (
                          <Badge variant="outline" className="text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            Viewed
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground truncate mb-2">
                        {invitation.email}
                      </p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {/* Bundle */}
                        <button
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                          onClick={() => setLocation(`/manager/bundles/${invitation.bundleId}`)}
                        >
                          <Package className="h-3 w-3" />
                          <span className="font-medium">{invitation.bundleTitle}</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>

                        {/* Trainer */}
                        <button
                          className="flex items-center gap-1 hover:text-primary transition-colors"
                          onClick={() => setLocation(`/manager/trainers/${invitation.trainerId}`)}
                        >
                          <User className="h-3 w-3" />
                          <span>by {invitation.trainerName}</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>

                        {/* Date */}
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Sent {new Date(invitation.createdAt).toLocaleDateString()}
                        </span>

                        {/* Expiry */}
                        {invitation.expiresAt && invitation.status === "pending" && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Personal Message */}
                      {invitation.message && (
                        <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-muted pl-2 line-clamp-2">
                          "{invitation.message}"
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
