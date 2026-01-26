import { useState, useMemo, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";
type UserStatus = "active" | "inactive";

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

export default function UsersScreen() {
  const colors = useColors();
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

  // tRPC query for users with filters
  const usersQuery = trpc.admin.usersWithFilters.useQuery({
    limit: PAGE_SIZE,
    offset: offset,
    role: selectedRole === "all" ? undefined : selectedRole,
    status: selectedStatus === "all" ? undefined : selectedStatus,
    search: searchQuery || undefined,
    joinedAfter: joinedAfter || undefined,
    joinedBefore: joinedBefore || undefined,
  });

  // tRPC mutations
  const updateRoleMutation = trpc.admin.updateUserRole.useMutation();
  const updateStatusMutation = trpc.admin.updateUserStatus.useMutation();
  const bulkUpdateRoleMutation = trpc.admin.bulkUpdateRole.useMutation();
  const bulkUpdateStatusMutation = trpc.admin.bulkUpdateStatus.useMutation();

  const users = usersQuery.data?.users ?? [];
  const totalCount = usersQuery.data?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < totalCount;

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
  };

  // Change user role
  const changeUserRole = async (newRole: UserRole) => {
    if (!selectedUser) return;
    
    try {
      await updateRoleMutation.mutateAsync({
        userId: selectedUser.id,
        role: newRole,
      });
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setSelectedUser((prev) => (prev ? { ...prev, role: newRole } : null));
      usersQuery.refetch();
      
      Alert.alert("Success", `${selectedUser.name}'s role changed to ${newRole}`);
    } catch (error) {
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
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      setSelectedUser((prev) => (prev ? { ...prev, active: newActive } : null));
      usersQuery.refetch();
      
      Alert.alert(
        "Success",
        `${selectedUser.name} has been ${newActive ? "activated" : "deactivated"}`
      );
    } catch (error) {
      Alert.alert("Error", "Failed to update user status");
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
    if (selectedUserIds.size === users.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(users.map((u) => u.id)));
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
    } catch (error) {
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
    } catch (error) {
      Alert.alert("Error", "Failed to update user statuses");
    }
  };

  // Export to CSV
  const exportToCSV = async () => {
    setExporting(true);
    
    try {
      // Create CSV content
      const headers = ["ID", "Name", "Email", "Role", "Status", "Phone", "Joined", "Last Active"];
      const rows = users.map((user) => [
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
        // Web: Create download link
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        Alert.alert("Success", "CSV file downloaded successfully");
      } else {
        // Native: Save to file and share
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

  return (
    <ScreenContainer className="flex-1">
      {/* Header with Export Button */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Users</Text>
          <Text className="text-sm text-muted mt-1">
            {totalCount} users found
          </Text>
        </View>
        <View style={styles.headerButtons}>
          {selectionMode ? (
            <>
              <TouchableOpacity
                onPress={exitSelectionMode}
                style={[styles.headerButton, { backgroundColor: colors.surface }]}
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
              >
                <Text style={{ color: "#fff" }}>
                  Actions ({selectedUserIds.size})
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={() => setSelectionMode(true)}
                style={[styles.headerButton, { backgroundColor: colors.surface }]}
              >
                <IconSymbol name="checkmark.circle.fill" size={16} color={colors.foreground} />
                <Text style={{ color: colors.foreground, marginLeft: 4 }}>Select</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={exportToCSV}
                disabled={exporting}
                style={[
                  styles.exportButton,
                  { backgroundColor: colors.primary, opacity: exporting ? 0.6 : 1 },
                ]}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <IconSymbol name="square.and.arrow.up" size={16} color="#fff" />
                    <Text style={styles.exportButtonText}>Export</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

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
        {/* Status Filter */}
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
          
          {/* Date Filter Toggle */}
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

        {/* Date Filter Inputs */}
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
                  backgroundColor: selectedUserIds.size === users.length ? colors.primary : "transparent",
                  borderColor: selectedUserIds.size === users.length ? colors.primary : colors.border,
                },
              ]}
            >
              {selectedUserIds.size === users.length && (
                <IconSymbol name="checkmark" size={12} color="#fff" />
              )}
            </View>
            <Text style={{ color: colors.foreground, marginLeft: 8 }}>
              {selectedUserIds.size === users.length ? "Deselect All" : "Select All"}
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
        ) : users.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="person.2.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No users found</Text>
          </View>
        ) : (
          <>
            {users.map((user) => (
              <TouchableOpacity
                key={user.id}
                className="bg-surface rounded-xl p-4 mb-3 border border-border flex-row items-center"
                onPress={() => openUserDetail(user)}
                activeOpacity={0.7}
              >
                {/* Checkbox in selection mode */}
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
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${ROLE_COLORS[user.role]}20` }}
                >
                  <Text
                    className="text-lg font-bold"
                    style={{ color: ROLE_COLORS[user.role] }}
                  >
                    {getInitials(user.name)}
                  </Text>
                </View>

                {/* User Info */}
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center">
                    <Text className="text-foreground font-semibold">{user.name || "Unknown"}</Text>
                    {!user.active && (
                      <View
                        className="ml-2 px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${STATUS_COLORS.inactive}20` }}
                      >
                        <Text style={{ color: STATUS_COLORS.inactive, fontSize: 10, fontWeight: "600" }}>
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
            {!hasMore && users.length > 0 && (
              <View className="py-4 items-center">
                <Text className="text-sm text-muted">
                  Showing all {totalCount} users
                </Text>
              </View>
            )}
          </>
        )}

        {/* Bottom padding */}
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
            {selectedUser && (
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

            {/* Change Role Section */}
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
                    <Text
                      style={{
                        color: colors.foreground,
                        fontSize: 13,
                      }}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status Actions */}
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
});
