import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  avatar?: string;
};

// Mock data
const MOCK_USERS: User[] = [
  { id: 1, name: "John Doe", email: "john@example.com", role: "client", createdAt: new Date(Date.now() - 86400000 * 30) },
  { id: 2, name: "Jane Smith", email: "jane@example.com", role: "trainer", createdAt: new Date(Date.now() - 86400000 * 60) },
  { id: 3, name: "Mike Johnson", email: "mike@example.com", role: "shopper", createdAt: new Date(Date.now() - 86400000 * 5) },
  { id: 4, name: "Sarah Wilson", email: "sarah@example.com", role: "client", createdAt: new Date(Date.now() - 86400000 * 15) },
  { id: 5, name: "Coach Alex", email: "alex@example.com", role: "trainer", createdAt: new Date(Date.now() - 86400000 * 90) },
  { id: 6, name: "Admin User", email: "admin@example.com", role: "manager", createdAt: new Date(Date.now() - 86400000 * 180) },
];

const ROLE_COLORS: Record<UserRole, string> = {
  shopper: "#6B7280",
  client: "#3B82F6",
  trainer: "#10B981",
  manager: "#F59E0B",
  coordinator: "#8B5CF6",
};

export default function UsersScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  // Filter users
  const filteredUsers = useMemo(() => {
    return MOCK_USERS.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = selectedRole === "all" || user.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [searchQuery, selectedRole]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

  // Get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const roles = ["all", "shopper", "client", "trainer", "manager", "coordinator"] as const;

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Users</Text>
        <Text className="text-sm text-muted mt-1">
          {filteredUsers.length} users found
        </Text>
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

      {/* Role Filter - Using inline styles to fix pill layout */}
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

      {/* Users List */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredUsers.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="person.2.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No users found</Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <TouchableOpacity
              key={user.id}
              className="bg-surface rounded-xl p-4 mb-3 border border-border flex-row items-center"
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
                <Text className="text-foreground font-semibold">{user.name}</Text>
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
          ))
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
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
});
