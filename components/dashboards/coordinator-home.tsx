import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuthContext, UserRole } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import { haptics } from "@/hooks/use-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

type User = {
  id: number;
  name: string | null;
  email: string;
  role: UserRole;
  photoUrl?: string | null;
  isStarred?: boolean;
};

const ROLE_COLORS: Record<UserRole, string> = {
  shopper: "#6B7280",
  client: "#3B82F6",
  trainer: "#10B981",
  manager: "#F59E0B",
  coordinator: "#8B5CF6",
};

const ROLE_ROUTES: Record<UserRole, string> = {
  shopper: "/(tabs)",
  client: "/(tabs)",
  trainer: "/(tabs)",
  manager: "/(tabs)",
  coordinator: "/(tabs)",
};

const STARRED_USERS_KEY = "locomotivate_starred_users";

export default function CoordinatorHome() {
  const colors = useColors();
  const { startImpersonation, isImpersonating, impersonatedUser, stopImpersonation } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | "all">("all");
  const [starredIds, setStarredIds] = useState<number[]>([]);

  // Load starred users on mount
  useState(() => {
    AsyncStorage.getItem(STARRED_USERS_KEY).then((saved) => {
      if (saved) {
        setStarredIds(JSON.parse(saved));
      }
    }).catch((error) => {
      console.error("Failed to load starred users:", error);
    });
  });

  // Fetch all users from API
  const { data: usersData, isLoading, refetch, isRefetching } = trpc.admin.users.useQuery();

  // Impersonation mutation
  const impersonateMutation = trpc.coordinator.impersonate.useMutation({
    onSuccess: async (data) => {
      const targetUser = data.targetUser;
      await haptics.success();
      
      // Start impersonation in auth context
      startImpersonation({
        id: targetUser.id,
        openId: targetUser.openId || "",
        name: targetUser.name,
        email: targetUser.email,
        phone: targetUser.phone || null,
        photoUrl: targetUser.photoUrl,
        loginMethod: targetUser.loginMethod || null,
        role: (targetUser.role as UserRole) || "shopper",
        username: targetUser.username || null,
        bio: targetUser.bio || null,
        specialties: targetUser.specialties || null,
        socialLinks: targetUser.socialLinks || null,
        trainerId: targetUser.trainerId || null,
        active: targetUser.active ?? true,
        metadata: targetUser.metadata || null,
        createdAt: new Date(targetUser.createdAt),
        updatedAt: new Date(targetUser.updatedAt),
        lastSignedIn: new Date(targetUser.lastSignedIn || targetUser.updatedAt),
      });
      
      // Navigate to the home tab - unified navigation will show the right dashboard
      router.replace("/(tabs)" as any);
    },
    onError: (error) => {
      haptics.error();
      Alert.alert("Error", error.message);
    },
  });

  const users: User[] = useMemo(() => {
    if (!usersData) return [];
    return usersData.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: (u.role as UserRole) || "shopper",
      photoUrl: u.photoUrl,
      isStarred: starredIds.includes(u.id),
    }));
  }, [usersData, starredIds]);

  // Filter users
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        (user.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = selectedRole === "all" || user.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRole]);

  // Starred users
  const starredUsers = useMemo(() => {
    return users.filter((user) => user.isStarred);
  }, [users]);

  // Toggle star
  const handleToggleStar = async (userId: number) => {
    await haptics.light();
    const newStarredIds = starredIds.includes(userId)
      ? starredIds.filter((id) => id !== userId)
      : [...starredIds, userId];
    setStarredIds(newStarredIds);
    await AsyncStorage.setItem(STARRED_USERS_KEY, JSON.stringify(newStarredIds));
  };

  // Impersonate user
  const handleImpersonate = async (user: User) => {
    await haptics.medium();
    
    if (Platform.OS === "web") {
      impersonateMutation.mutate({ userId: user.id });
    } else {
      Alert.alert(
        "Impersonate User",
        `You will now view the app as ${user.name || user.email} (${user.role}). Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Impersonate",
            onPress: () => {
              impersonateMutation.mutate({ userId: user.id });
            },
          },
        ]
      );
    }
  };

  // End impersonation
  const handleEndImpersonation = async () => {
    await haptics.medium();
    stopImpersonation();
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

  // User avatar component
  const UserAvatar = ({ user, size = 40 }: { user: User; size?: number }) => {
    if (user.photoUrl) {
      return (
        <Image
          source={{ uri: user.photoUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      );
    }
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `${ROLE_COLORS[user.role]}20`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontWeight: "bold",
            color: ROLE_COLORS[user.role],
            fontSize: size * 0.4,
          }}
        >
          {getInitials(user.name)}
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Impersonate</Text>
        <Text className="text-sm text-muted mt-1">View the app as any user for testing</Text>
      </View>

      {/* Impersonation Banner */}
      {isImpersonating && impersonatedUser && (
        <View className="bg-warning/20 border-b border-warning px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <IconSymbol name="person.badge.key.fill" size={20} color={colors.warning} />
              <Text className="text-warning font-medium ml-2 flex-1" numberOfLines={1}>
                Viewing as {impersonatedUser.name || impersonatedUser.email}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleEndImpersonation}
              className="bg-warning px-3 py-1.5 rounded-full"
            >
              <Text className="text-white font-semibold text-sm">End</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading users...</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
          }
        >
          {/* Quick Role Simulation */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Quick Role Simulation
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {(["shopper", "client", "trainer", "manager"] as UserRole[]).map((role) => {
                const testUser = users.find((u) => u.role === role);
                return (
                  <TouchableOpacity
                    key={role}
                    onPress={() => testUser && handleImpersonate(testUser)}
                    disabled={!testUser}
                    className="px-4 py-3 rounded-xl flex-row items-center"
                    style={{ 
                      backgroundColor: `${ROLE_COLORS[role]}20`,
                      opacity: testUser ? 1 : 0.5,
                    }}
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
                );
              })}
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
                    <UserAvatar user={user} />
                    <View className="flex-1 ml-3">
                      <Text className="text-foreground font-medium">{user.name || "Unknown"}</Text>
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
                returnKeyType="search"
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
                      <UserAvatar user={user} />
                      <View className="flex-1 ml-3">
                        <Text className="text-foreground font-medium">{user.name || "Unknown"}</Text>
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
      )}
    </ScreenContainer>
  );
}
