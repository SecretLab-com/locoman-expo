import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";

type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isStarred?: boolean;
};

// Mock data
const MOCK_USERS: User[] = [
  { id: 1, name: "John Doe", email: "john@example.com", role: "client", isStarred: true },
  { id: 2, name: "Coach Mike", email: "mike@example.com", role: "trainer", isStarred: true },
  { id: 3, name: "Jane Smith", email: "jane@example.com", role: "shopper" },
  { id: 4, name: "Sarah Wilson", email: "sarah@example.com", role: "client" },
  { id: 5, name: "Coach Alex", email: "alex@example.com", role: "trainer" },
  { id: 6, name: "Admin User", email: "admin@example.com", role: "manager" },
  { id: 7, name: "Super Admin", email: "super@example.com", role: "coordinator" },
];

const ROLE_COLORS: Record<UserRole, string> = {
  shopper: "#6B7280",
  client: "#3B82F6",
  trainer: "#10B981",
  manager: "#F59E0B",
  coordinator: "#8B5CF6",
};

const ROLE_ROUTES: Record<UserRole, string> = {
  shopper: "/(tabs)",
  client: "/(client)",
  trainer: "/(trainer)",
  manager: "/(manager)",
  coordinator: "/(coordinator)",
};

export default function ImpersonateScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);

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

  // Starred users
  const starredUsers = useMemo(() => {
    return users.filter((user) => user.isStarred);
  }, [users]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  // Toggle star
  const handleToggleStar = (userId: number) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, isStarred: !u.isStarred } : u
      )
    );
  };

  // Impersonate user
  const handleImpersonate = async (user: User) => {
    Alert.alert(
      "Impersonate User",
      `You will now view the app as ${user.name} (${user.role}). Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Impersonate",
          onPress: async () => {
            // Store impersonation data
            await AsyncStorage.setItem(
              "impersonation",
              JSON.stringify({
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                startedAt: new Date().toISOString(),
              })
            );

            // Log impersonation
            const logs = JSON.parse(
              (await AsyncStorage.getItem("impersonation_logs")) || "[]"
            );
            logs.unshift({
              userId: user.id,
              userName: user.name,
              userRole: user.role,
              timestamp: new Date().toISOString(),
            });
            await AsyncStorage.setItem("impersonation_logs", JSON.stringify(logs.slice(0, 50)));

            // Navigate to role-specific route
            router.replace(ROLE_ROUTES[user.role] as any);
          },
        },
      ]
    );
  };

  // Quick role simulation
  const handleQuickRoleSimulation = (role: UserRole) => {
    const mockUser: User = {
      id: 0,
      name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      email: `test-${role}@example.com`,
      role,
    };
    handleImpersonate(mockUser);
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

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Impersonate</Text>
        <Text className="text-sm text-muted mt-1">
          View the app as any user for testing
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Role Simulation */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Quick Role Simulation
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(["shopper", "client", "trainer", "manager"] as UserRole[]).map((role) => (
              <TouchableOpacity
                key={role}
                onPress={() => handleQuickRoleSimulation(role)}
                className="px-4 py-3 rounded-xl flex-row items-center"
                style={{ backgroundColor: `${ROLE_COLORS[role]}20` }}
              >
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-2"
                  style={{ backgroundColor: ROLE_COLORS[role] }}
                >
                  <IconSymbol
                    name={
                      role === "shopper"
                        ? "person.fill"
                        : role === "client"
                        ? "person.fill"
                        : role === "trainer"
                        ? "figure.run"
                        : "person.badge.key.fill"
                    }
                    size={16}
                    color="#fff"
                  />
                </View>
                <Text
                  className="font-medium capitalize"
                  style={{ color: ROLE_COLORS[role] }}
                >
                  Test as {role}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Starred Users */}
        {starredUsers.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Starred Users
            </Text>
            <View className="bg-surface rounded-xl divide-y divide-border">
              {starredUsers.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  onPress={() => handleImpersonate(user)}
                  className="flex-row items-center p-4"
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: `${ROLE_COLORS[user.role]}20` }}
                  >
                    <Text
                      className="font-bold"
                      style={{ color: ROLE_COLORS[user.role] }}
                    >
                      {getInitials(user.name)}
                    </Text>
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">{user.name}</Text>
                    <Text className="text-sm text-muted">{user.email}</Text>
                  </View>
                  <View
                    className="px-2 py-1 rounded-full mr-2"
                    style={{ backgroundColor: `${ROLE_COLORS[user.role]}20` }}
                  >
                    <Text
                      className="text-xs font-medium capitalize"
                      style={{ color: ROLE_COLORS[user.role] }}
                    >
                      {user.role}
                    </Text>
                  </View>
                  <IconSymbol name="star.fill" size={20} color="#F59E0B" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Search */}
        <View className="mb-4">
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {(["all", "shopper", "client", "trainer", "manager", "coordinator"] as const).map(
            (role) => (
              <TouchableOpacity
                key={role}
                onPress={() => setSelectedRole(role)}
                className={`px-4 py-2 rounded-full ${
                  selectedRole === role ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`font-medium capitalize ${
                    selectedRole === role ? "text-white" : "text-foreground"
                  }`}
                >
                  {role === "all" ? "All Roles" : role}
                </Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>

        {/* Users List */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            All Users ({filteredUsers.length})
          </Text>

          {filteredUsers.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 items-center">
              <IconSymbol name="person.2.fill" size={32} color={colors.muted} />
              <Text className="text-muted mt-2">No users found</Text>
            </View>
          ) : (
            <View className="bg-surface rounded-xl divide-y divide-border">
              {filteredUsers.map((user) => (
                <View key={user.id} className="flex-row items-center p-4">
                  <TouchableOpacity
                    onPress={() => handleImpersonate(user)}
                    className="flex-row items-center flex-1"
                  >
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center"
                      style={{ backgroundColor: `${ROLE_COLORS[user.role]}20` }}
                    >
                      <Text
                        className="font-bold"
                        style={{ color: ROLE_COLORS[user.role] }}
                      >
                        {getInitials(user.name)}
                      </Text>
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-foreground font-medium">{user.name}</Text>
                      <Text className="text-sm text-muted">{user.email}</Text>
                    </View>
                    <View
                      className="px-2 py-1 rounded-full"
                      style={{ backgroundColor: `${ROLE_COLORS[user.role]}20` }}
                    >
                      <Text
                        className="text-xs font-medium capitalize"
                        style={{ color: ROLE_COLORS[user.role] }}
                      >
                        {user.role}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleToggleStar(user.id)}
                    className="ml-3 p-2"
                  >
                    <IconSymbol
                      name={user.isStarred ? "star.fill" : "star"}
                      size={20}
                      color={user.isStarred ? "#F59E0B" : colors.muted}
                    />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
