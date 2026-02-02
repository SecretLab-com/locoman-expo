import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { navigateToHome } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";
type UserStatus = "active" | "inactive";
type UserSort = "performance" | "newest" | "active" | "alphabetical";

type User = {
  id: number;
  name: string | null;
  email: string | null;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  lastSignedIn?: Date | null;
  phone?: string | null;
  photoUrl?: string | null;
  openId?: string;
};

type ActivityLogEntry = {
  id: number;
  targetUserId: number;
  performedBy: number;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  notes: string | null;
  createdAt: Date;
};

const PAGE_SIZE = 20;

const ROLE_COLORS: Record<UserRole, string> = {
  shopper: "#6B7280",
  client: "#3B82F6",
  trainer: "#10B981",
  manager: "#F59E0B",
  coordinator: "#8B5CF6",
};

const STATUS_COLORS: Record<UserStatus, string> = {
  active: "#10B981",
  inactive: "#EF4444",
};

const ACTION_LABELS: Record<string, string> = {
  role_changed: "Role Changed",
  status_changed: "Status Changed",
  impersonation_started: "Impersonation Started",
  impersonation_ended: "Impersonation Ended",
  profile_updated: "Profile Updated",
  invited: "Invited",
  deleted: "Deleted",
};

export default function UsersScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams();
  const {
    startImpersonation,
    isCoordinator,
    isAuthenticated,
    loading: authLoading,
    canManage,
    user: currentUser,
    effectiveRole,
  } = useAuthContext();
  const roleBase =
    effectiveRole === "client"
      ? "/(client)"
      : effectiveRole === "trainer"
        ? "/(trainer)"
        : effectiveRole === "manager"
          ? "/(manager)"
          : effectiveRole === "coordinator"
            ? "/(coordinator)"
            : "/(tabs)";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<UserStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  
  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [bulkActionModalVisible, setBulkActionModalVisible] = useState(false);
  
  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [joinedAfter, setJoinedAfter] = useState<string>("");
  const [joinedBefore, setJoinedBefore] = useState<string>("");
  
  // Activity log state
  const [activityLogVisible, setActivityLogVisible] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Invite modal state
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("shopper");
  const [inviting, setInviting] = useState(false);
  
  // Pending invites state
  const [showInvites, setShowInvites] = useState(false);
  const [sortKey, setSortKey] = useState<UserSort>("alphabetical");

  // tRPC query for users with filters
  const usersQuery = trpc.admin.usersWithFilters.useQuery(
    {
      limit: PAGE_SIZE,
      offset: offset,
      role: selectedRole === "all" ? undefined : selectedRole,
      status: selectedStatus === "all" ? undefined : selectedStatus,
      search: searchQuery || undefined,
      joinedAfter: joinedAfter || undefined,
      joinedBefore: joinedBefore || undefined,
    },
    {
      enabled: isAuthenticated && canManage,
    }
  );

  useEffect(() => {
    if (usersQuery.isSuccess) {
      console.log("[Users] usersWithFilters success", {
        count: usersQuery.data?.users?.length ?? 0,
        total: usersQuery.data?.total ?? 0,
      });
    }
    if (usersQuery.isError) {
      console.error("[Users] usersWithFilters error", usersQuery.error);
      console.log("[Users] usersWithFilters input", {
        limit: PAGE_SIZE,
        offset,
        role: selectedRole === "all" ? undefined : selectedRole,
        status: selectedStatus === "all" ? undefined : selectedStatus,
        search: searchQuery || undefined,
        joinedAfter: joinedAfter || undefined,
        joinedBefore: joinedBefore || undefined,
        isAuthenticated,
        canManage,
      });
    }
  }, [
    usersQuery.isSuccess,
    usersQuery.isError,
    usersQuery.data,
    usersQuery.error,
    offset,
    selectedRole,
    selectedStatus,
    searchQuery,
    joinedAfter,
    joinedBefore,
    isAuthenticated,
    canManage,
  ]);
  
  // tRPC query for pending invitations
  const invitationsQuery = trpc.admin.getUserInvitations.useQuery(
    {
      limit: 50,
      status: "pending",
    },
    {
      enabled: isAuthenticated && canManage,
    }
  );

  // tRPC mutations
  const updateRoleMutation = trpc.admin.updateUserRole.useMutation();
  const updateStatusMutation = trpc.admin.updateUserStatus.useMutation();
  const bulkUpdateRoleMutation = trpc.admin.bulkUpdateRole.useMutation();
  const bulkUpdateStatusMutation = trpc.admin.bulkUpdateStatus.useMutation();
  const logActionMutation = trpc.admin.logUserAction.useMutation();
  const createInvitationMutation = trpc.admin.createUserInvitation.useMutation();
  const revokeInvitationMutation = trpc.admin.revokeUserInvitation.useMutation();

  const users = usersQuery.data?.users ?? [];
  const totalCount = usersQuery.data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < totalCount;
  const pendingInvites = invitationsQuery.data?.invitations ?? [];
  const displayUsers = useMemo(() => {
    if (!users.length) return [];
    const ordered = [...users];
    if (sortKey === "newest") {
      ordered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortKey === "active") {
      ordered.sort((a, b) => Number(b.active) - Number(a.active));
    } else if (sortKey === "performance") {
      ordered.sort((a, b) => {
        const aTime = new Date(a.lastSignedIn ?? a.createdAt).getTime();
        const bTime = new Date(b.lastSignedIn ?? b.createdAt).getTime();
        return bTime - aTime;
      });
    } else {
      ordered.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return ordered;
  }, [users, sortKey]);

  useEffect(() => {
    const normalize = (value: string | string[] | undefined) =>
      Array.isArray(value) ? value[0] : value;
    const roleParam = normalize(params.role);
    const statusParam = normalize(params.status);
    const sortParam = normalize(params.sort);
    const queryParam = normalize(params.q);

    if (typeof roleParam === "string") {
      setSelectedRole(roleParam as UserRole | "all");
    }
    if (typeof statusParam === "string") {
      setSelectedStatus(statusParam as UserStatus | "all");
    }
    if (typeof sortParam === "string") {
      const allowed: UserSort[] = ["performance", "newest", "active", "alphabetical"];
      if (allowed.includes(sortParam as UserSort)) {
        setSortKey(sortParam as UserSort);
      }
    }
    if (typeof queryParam === "string") {
      setSearchQuery(queryParam);
    }
  }, [params.role, params.status, params.sort, params.q]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
    setSelectedUserIds(new Set());
  }, [searchQuery, selectedRole, selectedStatus, joinedAfter, joinedBefore]);

  // Load more users
  const loadMore = useCallback(() => {
    if (hasMore && !usersQuery.isFetching) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  }, [hasMore, usersQuery.isFetching]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    setOffset(0);
    await usersQuery.refetch();
    await invitationsQuery.refetch();
    setRefreshing(false);
  };

  // Format date
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Unknown";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format relative time
  const formatRelativeTime = (date: Date | string | null | undefined) => {
    if (!date) return "Unknown";
    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(d);
  };

  // Get initials
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Open user detail modal
  const openUserDetail = (user: User) => {
    if (selectionMode) {
      toggleUserSelection(user.id);
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedUser(user);
    setModalVisible(true);
  };

  // Close modal
  const closeModal = () => {
    setModalVisible(false);
    setSelectedUser(null);
    setActivityLogVisible(false);
    setActivityLogs([]);
  };

  // Load activity logs for user
  const loadActivityLogs = async (userId: number) => {
    setLoadingLogs(true);
    try {
      const utils = trpc.useUtils();
      const logs = await utils.admin.getUserActivityLogs.fetch({ userId, limit: 50 });
      setActivityLogs(logs as ActivityLogEntry[]);
      setActivityLogVisible(true);
    } catch (error) {
      console.error("Failed to load activity logs:", error);
      Alert.alert("Error", "Failed to load activity logs");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Change user role
  const changeUserRole = async (newRole: UserRole) => {
    if (!selectedUser) return;
    
    const previousRole = selectedUser.role;
    
    try {
      await updateRoleMutation.mutateAsync({
        userId: selectedUser.id,
        role: newRole,
      });
      
      // Log the action
      await logActionMutation.mutateAsync({
        targetUserId: selectedUser.id,
        action: "role_changed",
        previousValue: previousRole,
        newValue: newRole,
      });
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setSelectedUser((prev) => (prev ? { ...prev, role: newRole } : null));
      usersQuery.refetch();
      
      Alert.alert("Success", `${selectedUser.name}'s role changed to ${newRole}`);
    } catch {
      Alert.alert("Error", "Failed to change user role");
    }
  };

  // Toggle user status
  const toggleUserStatus = async () => {
    if (!selectedUser) return;
    
    const newActive = !selectedUser.active;
    
    try {
      await updateStatusMutation.mutateAsync({
        userId: selectedUser.id,
        active: newActive,
      });
      
      // Log the action
      await logActionMutation.mutateAsync({
        targetUserId: selectedUser.id,
        action: "status_changed",
        previousValue: selectedUser.active ? "active" : "inactive",
        newValue: newActive ? "active" : "inactive",
      });
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setSelectedUser((prev) => (prev ? { ...prev, active: newActive } : null));
      usersQuery.refetch();
      
      Alert.alert(
        "Success",
        `${selectedUser.name} has been ${newActive ? "activated" : "deactivated"}`
      );
    } catch {
      Alert.alert("Error", "Failed to update user status");
    }
  };

  // Impersonate user
  const impersonateUser = async () => {
    if (!selectedUser || !isCoordinator) return;
    
    try {
      // Log the impersonation
      await logActionMutation.mutateAsync({
        targetUserId: selectedUser.id,
        action: "impersonation_started",
        notes: `Impersonated by ${currentUser?.name || "Manager"}`,
      });
      
      // Start impersonation
      startImpersonation(selectedUser as any);
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      closeModal();
      
      // Navigate to appropriate dashboard based on impersonated user's role
      // Uses role-aware navigation helper for consistency
      navigateToHome({
        isCoordinator: selectedUser.role === "coordinator",
        isManager: selectedUser.role === "manager",
        isTrainer: selectedUser.role === "trainer",
        isClient: selectedUser.role === "client",
      });
      
      Alert.alert("Impersonation Started", `You are now viewing as ${selectedUser.name}`);
    } catch {
      Alert.alert("Error", "Failed to start impersonation");
    }
  };

  // Toggle user selection for bulk actions
  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Select/deselect all visible users
  const toggleSelectAll = () => {
    if (selectedUserIds.size === displayUsers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(displayUsers.map((u) => u.id)));
    }
  };

  // Exit selection mode
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedUserIds(new Set());
  };

  // Bulk change role
  const bulkChangeRole = async (newRole: UserRole) => {
    if (selectedUserIds.size === 0) return;
    
    try {
      await bulkUpdateRoleMutation.mutateAsync({
        userIds: Array.from(selectedUserIds),
        role: newRole,
      });
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      usersQuery.refetch();
      setBulkActionModalVisible(false);
      exitSelectionMode();
      
      Alert.alert("Success", `Updated role to ${newRole} for ${selectedUserIds.size} users`);
    } catch {
      Alert.alert("Error", "Failed to update user roles");
    }
  };

  // Bulk change status
  const bulkChangeStatus = async (active: boolean) => {
    if (selectedUserIds.size === 0) return;
    
    try {
      await bulkUpdateStatusMutation.mutateAsync({
        userIds: Array.from(selectedUserIds),
        active,
      });
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      usersQuery.refetch();
      setBulkActionModalVisible(false);
      exitSelectionMode();
      
      Alert.alert(
        "Success",
        `${active ? "Activated" : "Deactivated"} ${selectedUserIds.size} users`
      );
    } catch {
      Alert.alert("Error", "Failed to update user statuses");
    }
  };

  // Send invitation
  const sendInvitation = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert("Error", "Please enter an email address");
      return;
    }
    
    setInviting(true);
    try {
      await createInvitationMutation.mutateAsync({
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: inviteRole,
      });
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      invitationsQuery.refetch();
      setInviteModalVisible(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("shopper");
      
      Alert.alert("Success", `Invitation sent to ${inviteEmail}`);
    } catch {
      Alert.alert("Error", "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  // Revoke invitation
  const revokeInvitation = async (inviteId: number) => {
    Alert.alert(
      "Revoke Invitation",
      "Are you sure you want to revoke this invitation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              await revokeInvitationMutation.mutateAsync({ id: inviteId });
              invitationsQuery.refetch();
              Alert.alert("Success", "Invitation revoked");
            } catch {
              Alert.alert("Error", "Failed to revoke invitation");
            }
          },
        },
      ]
    );
  };

  // Export to CSV
  const exportToCSV = async () => {
    setExporting(true);
    
    try {
      const headers = ["ID", "Name", "Email", "Role", "Status", "Phone", "Joined", "Last Active"];
      const rows = displayUsers.map((user) => [
        user.id.toString(),
        user.name || "",
        user.email || "",
        user.role,
        user.active ? "active" : "inactive",
        user.phone || "",
        formatDate(user.createdAt),
        user.lastSignedIn ? formatDate(user.lastSignedIn) : "",
      ]);
      
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert("Success", "CSV file downloaded");
      } else {
        const fileName = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.writeAsStringAsync(filePath, csvContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(filePath, {
            mimeType: "text/csv",
            dialogTitle: "Export Users",
          });
        } else {
          Alert.alert("Success", `File saved to ${filePath}`);
        }
      }
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Error", "Failed to export users");
    } finally {
      setExporting(false);
    }
  };

  // Clear date filters
  const clearDateFilters = () => {
    setJoinedAfter("");
    setJoinedBefore("");
    setShowDateFilter(false);
  };

  const roles = ["all", "shopper", "client", "trainer", "manager", "coordinator"] as const;
  const allRoles: UserRole[] = ["shopper", "client", "trainer", "manager", "coordinator"];

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(manager)" as any);
  };

  if (authLoading) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-3">Loading your account...</Text>
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-5">
          <IconSymbol name="person.fill" size={36} color={colors.muted} />
        </View>
        <Text className="text-xl font-semibold text-foreground">Sign in required</Text>
        <Text className="text-muted text-center mt-2 mb-6">
          Please sign in to view and manage users.
        </Text>
        <TouchableOpacity
          className="bg-primary px-8 py-3 rounded-full"
          onPress={() => router.push("/login")}
          accessibilityRole="button"
          accessibilityLabel="Sign in"
          testID="users-sign-in"
        >
          <Text className="text-background font-semibold text-lg">Sign In</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (!canManage) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-5">
          <IconSymbol name="lock.fill" size={36} color={colors.muted} />
        </View>
        <Text className="text-xl font-semibold text-foreground">Manager access required</Text>
        <Text className="text-muted text-center mt-2">
          You don't have permission to view this page.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header with Export Button */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between" style={{ paddingRight: 56 }}>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={handleBack}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="users-back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Users</Text>
            <Text className="text-sm text-muted mt-1">
              {totalCount} users found
            </Text>
          </View>
        </View>
        <View style={styles.headerButtons}>
          {selectionMode ? (
            <>
              <TouchableOpacity
                onPress={exitSelectionMode}
                style={[styles.headerButton, { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Cancel selection"
                testID="users-cancel-selection"
              >
                <Text style={{ color: colors.foreground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBulkActionModalVisible(true)}
                disabled={selectedUserIds.size === 0}
                style={[
                  styles.headerButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: selectedUserIds.size === 0 ? 0.5 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Bulk actions"
                testID="users-bulk-actions"
              >
                <Text style={{ color: "#fff" }}>
                  Actions ({selectedUserIds.size})
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setInviteModalVisible(true)}
                style={[styles.headerButton, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Invite user"
                testID="users-invite"
              >
                <IconSymbol name="plus" size={16} color="#fff" />
                <Text style={{ color: "#fff", marginLeft: 4 }}>Invite</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectionMode(true)}
                style={[styles.headerButton, { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Select users"
                testID="users-select"
              >
                <IconSymbol name="checkmark.circle.fill" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={exportToCSV}
                disabled={exporting}
                style={[
                  styles.headerButton,
                  { backgroundColor: colors.surface, opacity: exporting ? 0.6 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Export users"
                testID="users-export"
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <IconSymbol name="square.and.arrow.up" size={16} color={colors.foreground} />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Pending Invites Toggle */}
      {pendingInvites.length > 0 && (
        <TouchableOpacity
          onPress={() => setShowInvites(!showInvites)}
          style={[styles.invitesToggle, { backgroundColor: colors.warning + "20", borderColor: colors.warning }]}
        >
          <IconSymbol name="envelope.fill" size={16} color={colors.warning} />
          <Text style={{ color: colors.warning, marginLeft: 8, fontWeight: "600" }}>
            {pendingInvites.length} Pending Invite{pendingInvites.length > 1 ? "s" : ""}
          </Text>
          <IconSymbol
            name={showInvites ? "chevron.up" : "chevron.down"}
            size={14}
            color={colors.warning}
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>
      )}

      {/* Pending Invites List */}
      {showInvites && pendingInvites.length > 0 && (
        <View style={[styles.invitesList, { backgroundColor: colors.surface }]}>
          {pendingInvites.map((invite) => (
            <View key={invite.id} style={[styles.inviteItem, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: "500" }}>
                  {invite.name || invite.email}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {invite.email} • {invite.role}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Expires {formatDate(invite.expiresAt)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => revokeInvitation(invite.id)}
                style={[styles.revokeButton, { backgroundColor: colors.error + "15" }]}
              >
                <Text style={{ color: colors.error, fontSize: 12, fontWeight: "500" }}>Revoke</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Search */}
      <View className="px-4 mb-4">
        <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 border border-border">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            placeholderTextColor={colors.muted}
            className="flex-1 ml-2 text-foreground"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Role Filter */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {roles.map((role) => (
            <TouchableOpacity
              key={role}
              onPress={() => setSelectedRole(role)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: selectedRole === role ? colors.primary : colors.surface,
                  borderColor: selectedRole === role ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  {
                    color: selectedRole === role ? "#fff" : colors.foreground,
                  },
                ]}
              >
                {role === "all" ? "All Roles" : role.charAt(0).toUpperCase() + role.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Status and Date Filters */}
      <View style={styles.secondaryFilters}>
        <View style={styles.statusFilterRow}>
          {(["all", "active", "inactive"] as const).map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setSelectedStatus(status)}
              style={[
                styles.statusPill,
                {
                  backgroundColor: selectedStatus === status ? colors.primary : colors.surface,
                  borderColor: selectedStatus === status ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: selectedStatus === status ? "#fff" : colors.foreground,
                  fontSize: 12,
                  fontWeight: "500",
                }}
              >
                {status === "all" ? "All Status" : status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            onPress={() => setShowDateFilter(!showDateFilter)}
            style={[
              styles.statusPill,
              {
                backgroundColor: (joinedAfter || joinedBefore) ? colors.primary : colors.surface,
                borderColor: (joinedAfter || joinedBefore) ? colors.primary : colors.border,
              },
            ]}
          >
            <IconSymbol
              name="calendar"
              size={14}
              color={(joinedAfter || joinedBefore) ? "#fff" : colors.foreground}
            />
            <Text
              style={{
                color: (joinedAfter || joinedBefore) ? "#fff" : colors.foreground,
                fontSize: 12,
                fontWeight: "500",
                marginLeft: 4,
              }}
            >
              Date
            </Text>
          </TouchableOpacity>
        </View>

        {showDateFilter && (
          <View style={styles.dateFilterRow}>
            <View style={styles.dateInputContainer}>
              <Text style={[styles.dateLabel, { color: colors.muted }]}>From:</Text>
              <TextInput
                value={joinedAfter}
                onChangeText={setJoinedAfter}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={[
                  styles.dateInput,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                ]}
              />
            </View>
            <View style={styles.dateInputContainer}>
              <Text style={[styles.dateLabel, { color: colors.muted }]}>To:</Text>
              <TextInput
                value={joinedBefore}
                onChangeText={setJoinedBefore}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
                style={[
                  styles.dateInput,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                ]}
              />
            </View>
            {(joinedAfter || joinedBefore) && (
              <TouchableOpacity onPress={clearDateFilters}>
                <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Selection Mode Header */}
      {selectionMode && (
        <View style={[styles.selectionHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllButton}>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: selectedUserIds.size === displayUsers.length ? colors.primary : "transparent",
                  borderColor: selectedUserIds.size === displayUsers.length ? colors.primary : colors.border,
                },
              ]}
            >
              {selectedUserIds.size === displayUsers.length && (
                <IconSymbol name="checkmark" size={12} color="#fff" />
              )}
            </View>
            <Text style={{ color: colors.foreground, marginLeft: 8 }}>
              {selectedUserIds.size === displayUsers.length ? "Deselect All" : "Select All"}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: colors.muted }}>
            {selectedUserIds.size} selected
          </Text>
        </View>
      )}

      {/* Users List */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
          if (isCloseToBottom && hasMore && !usersQuery.isFetching) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {usersQuery.isLoading && offset === 0 ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-muted mt-2">Loading users...</Text>
          </View>
        ) : usersQuery.isError ? (
          <View className="py-8 items-center">
            <IconSymbol name="exclamationmark.triangle.fill" size={40} color={colors.warning} />
            <Text className="text-foreground font-semibold mt-3">Unable to load users</Text>
            <Text className="text-muted mt-1 text-center">
              Please check your connection and try again.
            </Text>
            <TouchableOpacity
              className="mt-4 px-4 py-2 rounded-full bg-primary"
              onPress={() => usersQuery.refetch()}
              accessibilityRole="button"
              accessibilityLabel="Retry loading users"
              testID="users-retry"
            >
              <Text className="text-background font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : displayUsers.length === 0 ? (
          <View className="py-8 items-center">
            <IconSymbol name="person.2" size={48} color={colors.muted} />
            <Text className="text-muted mt-2">No users found</Text>
          </View>
        ) : (
          <>
            {displayUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                onPress={() => openUserDetail(user)}
                className="flex-row items-center p-4 mb-3 rounded-xl bg-surface border border-border"
              >
                {/* Selection Checkbox */}
                {selectionMode && (
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: selectedUserIds.has(user.id) ? colors.primary : "transparent",
                        borderColor: selectedUserIds.has(user.id) ? colors.primary : colors.border,
                        marginRight: 12,
                      },
                    ]}
                  >
                    {selectedUserIds.has(user.id) && (
                      <IconSymbol name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                )}
                
                {/* Avatar */}
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-3 overflow-hidden"
                  style={{ backgroundColor: `${ROLE_COLORS[user.role]}20` }}
                >
                  {user.photoUrl ? (
                    <Image
                      source={{ uri: user.photoUrl }}
                      style={styles.avatarImage}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Text
                      className="text-base font-bold"
                      style={{ color: ROLE_COLORS[user.role] }}
                    >
                      {getInitials(user.name)}
                    </Text>
                  )}
                </View>

                {/* User Info */}
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-base font-semibold text-foreground">
                      {user.name || "Unknown"}
                    </Text>
                    {!user.active && (
                      <View
                        className="ml-2 px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${STATUS_COLORS.inactive}20` }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: STATUS_COLORS.inactive }}
                        >
                          Inactive
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-muted">{user.email || "No email"}</Text>
                  <Text className="text-xs text-muted mt-1">
                    Joined {formatDate(user.createdAt)}
                  </Text>
                </View>

                {/* Role Badge */}
                <View className="flex-row items-center gap-2">
                  {!selectionMode && (
                    <TouchableOpacity
                      onPress={() => {
                        if (!currentUser?.id) return;
                        const conversationId = [currentUser.id, user.id].sort().join("-");
                        const name = user.name || "User";
                        router.push(
                          `${roleBase}/messages/${conversationId}?participantId=${user.id}&name=${encodeURIComponent(name)}` as any
                        );
                      }}
                      className="w-8 h-8 rounded-full items-center justify-center bg-surface border border-border"
                      accessibilityRole="button"
                      accessibilityLabel={`Message ${user.name || "user"}`}
                      testID={`user-message-${user.id}`}
                    >
                      <IconSymbol name="message.fill" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <View
                    className="px-3 py-1 rounded-full"
                    style={{ backgroundColor: `${ROLE_COLORS[user.role]}20` }}
                  >
                    <Text
                      className="text-xs font-semibold capitalize"
                      style={{ color: ROLE_COLORS[user.role] }}
                    >
                      {user.role}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Load More Indicator */}
            {usersQuery.isFetching && offset > 0 && (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-sm text-muted mt-2">Loading more...</Text>
              </View>
            )}

            {/* End of List */}
            {!hasMore && displayUsers.length > 0 && (
              <View className="py-4 items-center">
                <Text className="text-sm text-muted">
                  Showing all {totalCount} users
                </Text>
              </View>
            )}
          </>
        )}

        <View className="h-24" />
      </ScrollView>

      {/* User Detail Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedUser && !activityLogVisible && (
                <>
                  {/* Modal Header */}
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                      User Details
                    </Text>
                    <TouchableOpacity onPress={closeModal}>
                      <IconSymbol name="xmark" size={24} color={colors.muted} />
                    </TouchableOpacity>
                  </View>

                  {/* User Profile */}
                  <View style={styles.profileSection}>
                    <View
                      style={[
                        styles.largeAvatar,
                        { backgroundColor: `${ROLE_COLORS[selectedUser.role]}20` },
                      ]}
                    >
                      <Text
                        style={[styles.largeAvatarText, { color: ROLE_COLORS[selectedUser.role] }]}
                      >
                        {getInitials(selectedUser.name)}
                      </Text>
                    </View>
                    <Text style={[styles.userName, { color: colors.foreground }]}>
                      {selectedUser.name || "Unknown"}
                    </Text>
                    <View style={styles.statusRow}>
                      <View
                        style={[
                          styles.roleBadge,
                          { backgroundColor: `${ROLE_COLORS[selectedUser.role]}20` },
                        ]}
                      >
                        <Text style={{ color: ROLE_COLORS[selectedUser.role], fontWeight: "600" }}>
                          {selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: `${STATUS_COLORS[selectedUser.active ? "active" : "inactive"]}20` },
                        ]}
                      >
                        <Text style={{ color: STATUS_COLORS[selectedUser.active ? "active" : "inactive"], fontWeight: "600" }}>
                          {selectedUser.active ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* User Info */}
                  <View style={[styles.infoSection, { borderColor: colors.border }]}>
                    <View style={styles.infoRow}>
                      <IconSymbol name="envelope.fill" size={18} color={colors.muted} />
                      <Text style={[styles.infoText, { color: colors.foreground }]}>
                        {selectedUser.email || "No email"}
                      </Text>
                    </View>
                    {selectedUser.phone && (
                      <View style={styles.infoRow}>
                        <IconSymbol name="phone.fill" size={18} color={colors.muted} />
                        <Text style={[styles.infoText, { color: colors.foreground }]}>
                          {selectedUser.phone}
                        </Text>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <IconSymbol name="calendar" size={18} color={colors.muted} />
                      <Text style={[styles.infoText, { color: colors.foreground }]}>
                        Joined {formatDate(selectedUser.createdAt)}
                      </Text>
                    </View>
                    {selectedUser.lastSignedIn && (
                      <View style={styles.infoRow}>
                        <IconSymbol name="clock.fill" size={18} color={colors.muted} />
                        <Text style={[styles.infoText, { color: colors.foreground }]}>
                          Last active {formatRelativeTime(selectedUser.lastSignedIn)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Activity Log Button */}
                  <TouchableOpacity
                    onPress={() => loadActivityLogs(selectedUser.id)}
                    disabled={loadingLogs}
                    style={[styles.activityLogButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    {loadingLogs ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <IconSymbol name="clock.arrow.circlepath" size={18} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontWeight: "600", marginLeft: 8 }}>
                          View Activity Log
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Change Role Section */}
                  <View style={[styles.actionSection, { borderColor: colors.border }]}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      Change Role
                    </Text>
                    <View style={styles.roleGrid}>
                      {allRoles.map((role) => (
                        <TouchableOpacity
                          key={role}
                          onPress={() => changeUserRole(role)}
                          disabled={updateRoleMutation.isPending}
                          style={[
                            styles.roleOption,
                            {
                              backgroundColor:
                                selectedUser.role === role
                                  ? `${ROLE_COLORS[role]}20`
                                  : colors.surface,
                              borderColor:
                                selectedUser.role === role ? ROLE_COLORS[role] : colors.border,
                              opacity: updateRoleMutation.isPending ? 0.5 : 1,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color:
                                selectedUser.role === role ? ROLE_COLORS[role] : colors.foreground,
                              fontWeight: selectedUser.role === role ? "600" : "400",
                              fontSize: 13,
                            }}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.buttonSection}>
                    {/* Impersonate Button (Coordinator only) */}
                    {isCoordinator && (
                      <TouchableOpacity
                        onPress={impersonateUser}
                        style={[
                          styles.actionButton,
                          { backgroundColor: `${ROLE_COLORS.coordinator}15`, marginBottom: 12 },
                        ]}
                      >
                        <IconSymbol name="person.crop.circle.badge.checkmark" size={20} color={ROLE_COLORS.coordinator} />
                        <Text style={{ color: ROLE_COLORS.coordinator, fontWeight: "600", marginLeft: 8 }}>
                          Impersonate User
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity
                      onPress={toggleUserStatus}
                      disabled={updateStatusMutation.isPending}
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor:
                            selectedUser.active
                              ? `${STATUS_COLORS.inactive}15`
                              : `${STATUS_COLORS.active}15`,
                          opacity: updateStatusMutation.isPending ? 0.5 : 1,
                        },
                      ]}
                    >
                      {updateStatusMutation.isPending ? (
                        <ActivityIndicator
                          size="small"
                          color={selectedUser.active ? STATUS_COLORS.inactive : STATUS_COLORS.active}
                        />
                      ) : (
                        <>
                          <IconSymbol
                            name={selectedUser.active ? "xmark.circle.fill" : "checkmark.circle.fill"}
                            size={20}
                            color={
                              selectedUser.active
                                ? STATUS_COLORS.inactive
                                : STATUS_COLORS.active
                            }
                          />
                          <Text
                            style={{
                              color:
                                selectedUser.active
                                  ? STATUS_COLORS.inactive
                                  : STATUS_COLORS.active,
                              fontWeight: "600",
                              marginLeft: 8,
                            }}
                          >
                            {selectedUser.active ? "Deactivate User" : "Activate User"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* Activity Log View */}
              {activityLogVisible && selectedUser && (
                <>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity
                      onPress={() => setActivityLogVisible(false)}
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <IconSymbol name="chevron.left" size={20} color={colors.primary} />
                      <Text style={{ color: colors.primary, marginLeft: 4 }}>Back</Text>
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                      Activity Log
                    </Text>
                    <View style={{ width: 60 }} />
                  </View>

                  <Text style={[styles.activityLogSubtitle, { color: colors.muted }]}>
                    {`${selectedUser.name}'s activity history`}
                  </Text>

                  {activityLogs.length === 0 ? (
                    <View style={styles.emptyLogs}>
                      <IconSymbol name="clock" size={48} color={colors.muted} />
                      <Text style={{ color: colors.muted, marginTop: 12 }}>No activity recorded</Text>
                    </View>
                  ) : (
                    activityLogs.map((log) => (
                      <View
                        key={log.id}
                        style={[styles.logItem, { borderBottomColor: colors.border }]}
                      >
                        <View style={[styles.logIcon, { backgroundColor: colors.primary + "20" }]}>
                          <IconSymbol name="clock.fill" size={16} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.foreground, fontWeight: "500" }}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Text>
                          {log.previousValue && log.newValue && (
                            <Text style={{ color: colors.muted, fontSize: 13 }}>
                              {log.previousValue} → {log.newValue}
                            </Text>
                          )}
                          {log.notes && (
                            <Text style={{ color: colors.muted, fontSize: 13 }}>{log.notes}</Text>
                          )}
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                            {formatRelativeTime(log.createdAt)}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bulk Action Modal */}
      <Modal
        visible={bulkActionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBulkActionModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setBulkActionModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Bulk Actions ({selectedUserIds.size} users)
              </Text>
              <TouchableOpacity onPress={() => setBulkActionModalVisible(false)}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.actionSection, { borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Change Role
              </Text>
              <View style={styles.roleGrid}>
                {allRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    onPress={() => bulkChangeRole(role)}
                    disabled={bulkUpdateRoleMutation.isPending}
                    style={[
                      styles.roleOption,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        opacity: bulkUpdateRoleMutation.isPending ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.foreground, fontSize: 13 }}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.buttonSection}>
              <TouchableOpacity
                onPress={() => bulkChangeStatus(true)}
                disabled={bulkUpdateStatusMutation.isPending}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: `${STATUS_COLORS.active}15`,
                    marginBottom: 12,
                    opacity: bulkUpdateStatusMutation.isPending ? 0.5 : 1,
                  },
                ]}
              >
                <IconSymbol name="checkmark.circle.fill" size={20} color={STATUS_COLORS.active} />
                <Text style={{ color: STATUS_COLORS.active, fontWeight: "600", marginLeft: 8 }}>
                  Activate All Selected
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => bulkChangeStatus(false)}
                disabled={bulkUpdateStatusMutation.isPending}
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: `${STATUS_COLORS.inactive}15`,
                    opacity: bulkUpdateStatusMutation.isPending ? 0.5 : 1,
                  },
                ]}
              >
                <IconSymbol name="xmark.circle.fill" size={20} color={STATUS_COLORS.inactive} />
                <Text style={{ color: STATUS_COLORS.inactive, fontWeight: "600", marginLeft: 8 }}>
                  Deactivate All Selected
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Invite Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setInviteModalVisible(false)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.background }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Invite New User
              </Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.inviteForm}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Email *</Text>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                placeholder="user@example.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[
                  styles.inviteInput,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                ]}
              />

              <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 16 }]}>
                Name (optional)
              </Text>
              <TextInput
                value={inviteName}
                onChangeText={setInviteName}
                placeholder="John Doe"
                placeholderTextColor={colors.muted}
                style={[
                  styles.inviteInput,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
                ]}
              />

              <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 16 }]}>
                Assign Role
              </Text>
              <View style={styles.roleGrid}>
                {allRoles.map((role) => (
                  <TouchableOpacity
                    key={role}
                    onPress={() => setInviteRole(role)}
                    style={[
                      styles.roleOption,
                      {
                        backgroundColor:
                          inviteRole === role ? `${ROLE_COLORS[role]}20` : colors.surface,
                        borderColor: inviteRole === role ? ROLE_COLORS[role] : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: inviteRole === role ? ROLE_COLORS[role] : colors.foreground,
                        fontWeight: inviteRole === role ? "600" : "400",
                        fontSize: 13,
                      }}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={sendInvitation}
                disabled={inviting || !inviteEmail.trim()}
                style={[
                  styles.sendInviteButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: inviting || !inviteEmail.trim() ? 0.5 : 1,
                  },
                ]}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="paperplane.fill" size={18} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 8 }}>
                      Send Invitation
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    ...StyleSheet.absoluteFillObject,
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  invitesToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  invitesList: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  inviteItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  revokeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    height: 36,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: "500",
  },
  secondaryFilters: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statusFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  dateFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dateInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  selectAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  largeAvatarText: {
    fontSize: 28,
    fontWeight: "700",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  infoSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    marginLeft: 12,
  },
  activityLogButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  actionSection: {
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonSection: {
    marginTop: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  activityLogSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  emptyLogs: {
    alignItems: "center",
    paddingVertical: 40,
  },
  logItem: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  inviteForm: {
    paddingTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inviteInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  sendInviteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
});
