import { useState, useMemo, useCallback } from "react";
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
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";
type UserStatus = "active" | "inactive";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastActive?: Date;
  phone?: string;
  avatar?: string;
};

// Extended mock data for pagination demo
const generateMockUsers = (): User[] => {
  const baseUsers: User[] = [
    { id: 1, name: "John Doe", email: "john@example.com", role: "client", status: "active", createdAt: new Date(Date.now() - 86400000 * 30), lastActive: new Date(Date.now() - 3600000), phone: "+1 555-0101" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", role: "trainer", status: "active", createdAt: new Date(Date.now() - 86400000 * 60), lastActive: new Date(Date.now() - 86400000), phone: "+1 555-0102" },
    { id: 3, name: "Mike Johnson", email: "mike@example.com", role: "shopper", status: "active", createdAt: new Date(Date.now() - 86400000 * 5), lastActive: new Date(Date.now() - 7200000) },
    { id: 4, name: "Sarah Wilson", email: "sarah@example.com", role: "client", status: "active", createdAt: new Date(Date.now() - 86400000 * 15), lastActive: new Date(Date.now() - 172800000), phone: "+1 555-0104" },
    { id: 5, name: "Coach Alex", email: "alex@example.com", role: "trainer", status: "active", createdAt: new Date(Date.now() - 86400000 * 90), lastActive: new Date(Date.now() - 3600000 * 5), phone: "+1 555-0105" },
    { id: 6, name: "Admin User", email: "admin@example.com", role: "manager", status: "active", createdAt: new Date(Date.now() - 86400000 * 180), lastActive: new Date() },
    { id: 7, name: "Emily Brown", email: "emily@example.com", role: "client", status: "inactive", createdAt: new Date(Date.now() - 86400000 * 45), lastActive: new Date(Date.now() - 86400000 * 30) },
    { id: 8, name: "David Lee", email: "david@example.com", role: "shopper", status: "active", createdAt: new Date(Date.now() - 86400000 * 10), lastActive: new Date(Date.now() - 3600000 * 2) },
    { id: 9, name: "Lisa Chen", email: "lisa@example.com", role: "trainer", status: "active", createdAt: new Date(Date.now() - 86400000 * 120), lastActive: new Date(Date.now() - 86400000 * 2), phone: "+1 555-0109" },
    { id: 10, name: "Tom Harris", email: "tom@example.com", role: "client", status: "active", createdAt: new Date(Date.now() - 86400000 * 25), lastActive: new Date(Date.now() - 3600000 * 8) },
    { id: 11, name: "Amy Garcia", email: "amy@example.com", role: "shopper", status: "inactive", createdAt: new Date(Date.now() - 86400000 * 200), lastActive: new Date(Date.now() - 86400000 * 60) },
    { id: 12, name: "Chris Martinez", email: "chris@example.com", role: "client", status: "active", createdAt: new Date(Date.now() - 86400000 * 8), lastActive: new Date(Date.now() - 3600000) },
    { id: 13, name: "Jessica Taylor", email: "jessica@example.com", role: "trainer", status: "active", createdAt: new Date(Date.now() - 86400000 * 75), lastActive: new Date(Date.now() - 86400000), phone: "+1 555-0113" },
    { id: 14, name: "Ryan Anderson", email: "ryan@example.com", role: "shopper", status: "active", createdAt: new Date(Date.now() - 86400000 * 3), lastActive: new Date() },
    { id: 15, name: "Nicole White", email: "nicole@example.com", role: "client", status: "active", createdAt: new Date(Date.now() - 86400000 * 50), lastActive: new Date(Date.now() - 3600000 * 12), phone: "+1 555-0115" },
  ];
  return baseUsers;
};

const MOCK_USERS = generateMockUsers();
const PAGE_SIZE = 10;

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
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = selectedRole === "all" || user.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRole]);

  // Paginated users
  const displayedUsers = useMemo(() => {
    return filteredUsers.slice(0, displayCount);
  }, [filteredUsers, displayCount]);

  const hasMore = displayCount < filteredUsers.length;

  // Load more users
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));
    setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, filteredUsers.length));
    setLoadingMore(false);
  }, [loadingMore, hasMore, filteredUsers.length]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setDisplayCount(PAGE_SIZE);
    setRefreshing(false);
  };

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format relative time
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(date);
  };

  // Get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Open user detail modal
  const openUserDetail = (user: User) => {
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
  const changeUserRole = (newRole: UserRole) => {
    if (!selectedUser) return;
    
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    setUsers((prev) =>
      prev.map((u) => (u.id === selectedUser.id ? { ...u, role: newRole } : u))
    );
    setSelectedUser((prev) => (prev ? { ...prev, role: newRole } : null));
    
    Alert.alert("Success", `${selectedUser.name}'s role changed to ${newRole}`);
  };

  // Toggle user status
  const toggleUserStatus = () => {
    if (!selectedUser) return;
    
    const newStatus: UserStatus = selectedUser.status === "active" ? "inactive" : "active";
    
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    setUsers((prev) =>
      prev.map((u) => (u.id === selectedUser.id ? { ...u, status: newStatus } : u))
    );
    setSelectedUser((prev) => (prev ? { ...prev, status: newStatus } : null));
    
    Alert.alert(
      "Success",
      `${selectedUser.name} has been ${newStatus === "active" ? "activated" : "deactivated"}`
    );
  };

  // Export to CSV
  const exportToCSV = async () => {
    setExporting(true);
    
    try {
      // Create CSV content
      const headers = ["ID", "Name", "Email", "Role", "Status", "Phone", "Joined", "Last Active"];
      const rows = filteredUsers.map((user) => [
        user.id.toString(),
        user.name,
        user.email,
        user.role,
        user.status,
        user.phone || "",
        formatDate(user.createdAt),
        user.lastActive ? formatDate(user.lastActive) : "",
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

  const roles = ["all", "shopper", "client", "trainer", "manager", "coordinator"] as const;
  const allRoles: UserRole[] = ["shopper", "client", "trainer", "manager", "coordinator"];

  return (
    <ScreenContainer className="flex-1">
      {/* Header with Export Button */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Users</Text>
          <Text className="text-sm text-muted mt-1">
            {filteredUsers.length} users found
          </Text>
        </View>
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
      </View>

      {/* Search */}
      <View className="px-4 mb-4">
        <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 border border-border">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setDisplayCount(PAGE_SIZE);
            }}
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
              onPress={() => {
                setSelectedRole(role);
                setDisplayCount(PAGE_SIZE);
              }}
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
          if (isCloseToBottom && hasMore && !loadingMore) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {displayedUsers.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="person.2.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No users found</Text>
          </View>
        ) : (
          <>
            {displayedUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                className="bg-surface rounded-xl p-4 mb-3 border border-border flex-row items-center"
                onPress={() => openUserDetail(user)}
                activeOpacity={0.7}
              >
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
                    <Text className="text-foreground font-semibold">{user.name}</Text>
                    {user.status === "inactive" && (
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
                  <Text className="text-sm text-muted">{user.email}</Text>
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
            {loadingMore && (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-sm text-muted mt-2">Loading more...</Text>
              </View>
            )}

            {/* End of List */}
            {!hasMore && displayedUsers.length > 0 && (
              <View className="py-4 items-center">
                <Text className="text-sm text-muted">
                  Showing all {filteredUsers.length} users
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
                    {selectedUser.name}
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
                        { backgroundColor: `${STATUS_COLORS[selectedUser.status]}20` },
                      ]}
                    >
                      <Text style={{ color: STATUS_COLORS[selectedUser.status], fontWeight: "600" }}>
                        {selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* User Info */}
                <View style={[styles.infoSection, { borderColor: colors.border }]}>
                  <View style={styles.infoRow}>
                    <IconSymbol name="envelope.fill" size={18} color={colors.muted} />
                    <Text style={[styles.infoText, { color: colors.foreground }]}>
                      {selectedUser.email}
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
                  {selectedUser.lastActive && (
                    <View style={styles.infoRow}>
                      <IconSymbol name="clock.fill" size={18} color={colors.muted} />
                      <Text style={[styles.infoText, { color: colors.foreground }]}>
                        Last active {formatRelativeTime(selectedUser.lastActive)}
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
                        style={[
                          styles.roleOption,
                          {
                            backgroundColor:
                              selectedUser.role === role
                                ? `${ROLE_COLORS[role]}20`
                                : colors.surface,
                            borderColor:
                              selectedUser.role === role ? ROLE_COLORS[role] : colors.border,
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
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor:
                          selectedUser.status === "active"
                            ? `${STATUS_COLORS.inactive}15`
                            : `${STATUS_COLORS.active}15`,
                      },
                    ]}
                  >
                    <IconSymbol
                      name={selectedUser.status === "active" ? "xmark.circle.fill" : "checkmark.circle.fill"}
                      size={20}
                      color={
                        selectedUser.status === "active"
                          ? STATUS_COLORS.inactive
                          : STATUS_COLORS.active
                      }
                    />
                    <Text
                      style={{
                        color:
                          selectedUser.status === "active"
                            ? STATUS_COLORS.inactive
                            : STATUS_COLORS.active,
                        fontWeight: "600",
                        marginLeft: 8,
                      }}
                    >
                      {selectedUser.status === "active" ? "Deactivate User" : "Activate User"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
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
