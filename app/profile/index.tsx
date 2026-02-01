import { Text, View, TouchableOpacity, ScrollView, Alert, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { navigateToHome } from "@/lib/navigation";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { useColors } from "@/hooks/use-colors";
import { useAuthContext } from "@/contexts/auth-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptics } from "@/hooks/use-haptics";
import { useThemeContext } from "@/lib/theme-provider";

type MenuItemProps = {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  danger?: boolean;
  highlight?: boolean;
};

function MenuItem({ icon, title, subtitle, onPress, showChevron = true, danger = false, highlight = false }: MenuItemProps) {
  const colors = useColors();
  // All menu item titles should be blue (primary color) for better visibility on dark theme
  const textColor = danger ? colors.error : colors.primary;
  const bgColor = highlight ? "bg-primary/10" : "bg-surface";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed 
          ? (highlight ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.08)") 
          : (highlight ? "rgba(59, 130, 246, 0.05)" : "transparent"),
      })}
    >
      <View className={`w-10 h-10 rounded-full ${bgColor} items-center justify-center mr-4`}>
        <IconSymbol name={icon} size={20} color={danger ? colors.error : highlight ? colors.primary : colors.primary} />
      </View>
      <View className="flex-1">
        <Text style={{ color: textColor }} className="text-base font-medium">
          {title}
        </Text>
        {subtitle && <Text className="text-sm text-muted mt-0.5">{subtitle}</Text>}
      </View>
      {showChevron && (
        <IconSymbol name="chevron.right" size={20} color={highlight ? colors.primary : colors.muted} />
      )}
    </Pressable>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { colorScheme } = useThemeContext();
  // Use dark text in light mode, light text with opacity in dark mode
  const textClass = colorScheme === "dark" 
    ? "text-white/80" 
    : "text-foreground/70";
  
  return (
    <Text className={`text-sm font-semibold ${textClass} uppercase tracking-wider mb-2 mt-6`}>
      {children}
    </Text>
  );
}

function RoleBadge({ role }: { role: string }) {
  const getRoleStyle = () => {
    switch (role) {
      case "trainer":
        return { bg: "bg-success/20", text: "text-success", label: "Trainer" };
      case "client":
        return { bg: "bg-primary/20", text: "text-primary", label: "Client" };
      case "manager":
        return { bg: "bg-warning/20", text: "text-warning", label: "Manager" };
      case "coordinator":
        return { bg: "bg-error/20", text: "text-error", label: "Coordinator" };
      default:
        return { bg: "bg-muted/20", text: "text-muted", label: "Shopper" };
    }
  };

  const style = getRoleStyle();

  return (
    <View className={`px-3 py-1 rounded-full ${style.bg} mt-2`}>
      <Text className={`text-sm font-medium ${style.text}`}>{style.label}</Text>
    </View>
  );
}

export default function SharedProfileScreen() {
  const colors = useColors();
  const { user, isAuthenticated, logout, role, isTrainer, isClient, isManager, isCoordinator } = useAuthContext();
  const { themePreference, setThemePreference, colorScheme } = useThemeContext();

  // Navigate back to the user's role-specific home (initial landing page)
  const handleGoHome = async () => {
    await haptics.light();
    navigateToHome({ isCoordinator, isManager, isTrainer, isClient });
  };

  // Go back to previous screen
  const handleBack = async () => {
    await haptics.light();
    if (router.canGoBack()) {
      router.back();
    } else {
      handleGoHome();
    }
  };

  const cycleTheme = async () => {
    await haptics.light();
    const themes = ["system", "light", "dark"] as const;
    const currentIndex = themes.indexOf(themePreference as typeof themes[number]);
    const nextIndex = (currentIndex + 1) % themes.length;
    setThemePreference(themes[nextIndex]);
  };

  const getThemeLabel = () => {
    if (themePreference === "system") return `System (${colorScheme})`;
    return themePreference === "light" ? "Light" : "Dark";
  };

  const getThemeIcon = (): Parameters<typeof IconSymbol>[0]["name"] => {
    if (themePreference === "system") return "gearshape.fill";
    return themePreference === "light" ? "sun.max.fill" : "moon.fill";
  };

  const handleLogout = async () => {
    await haptics.medium();
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to logout?")) {
        await logout();
        router.replace("/(tabs)");
      }
    } else {
      Alert.alert(
        "Logout",
        "Are you sure you want to logout?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Logout",
            style: "destructive",
            onPress: async () => {
              await logout();
              router.replace("/(tabs)");
            },
          },
        ]
      );
    }
  };

  // Navigate to home - same as handleGoHome for consistency
  const handleDashboardPress = async () => {
    await haptics.light();
    navigateToHome({ isCoordinator, isManager, isTrainer, isClient });
  };

  const getDashboardLabel = () => {
    if (isCoordinator) return { title: "Home", subtitle: "Coordinator dashboard" };
    if (isManager) return { title: "Home", subtitle: "Manager dashboard" };
    if (isTrainer) return { title: "Home", subtitle: "Trainer dashboard" };
    if (isClient) return { title: "Home", subtitle: "Client dashboard" };
    return null;
  };

  const dashboardInfo = getDashboardLabel();

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <View className="w-24 h-24 rounded-full bg-surface items-center justify-center mb-6">
          <IconSymbol name="person.fill" size={48} color={colors.muted} />
        </View>
        <Text className="text-xl font-semibold text-foreground">
          Welcome to LocoMotivate
        </Text>
        <Text className="text-muted text-center mt-2 mb-6">
          Sign in to access your profile, orders, and personalized recommendations
        </Text>
        <TouchableOpacity
          className="bg-primary px-8 py-4 rounded-full mb-4"
          onPress={() => router.push("/login")}
        >
          <Text className="text-background font-semibold text-lg">Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/register" as any)}>
          <Text className="text-primary font-semibold">Create Account</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <NavigationHeader
          title="Profile"
          showBack
          showHome
          onBack={handleBack}
          homeTestID="profile-home"
          backTestID="profile-back"
        />

        {/* Profile Header */}
        <View className="items-center py-6 px-4">
          <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-4">
            {user?.photoUrl ? (
              <Image
                source={{ uri: user.photoUrl }}
                className="w-24 h-24 rounded-full"
                contentFit="cover"
              />
            ) : user?.name ? (
              <Text className="text-4xl font-bold text-background">
                {user.name.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <IconSymbol name="person.fill" size={48} color={colors.background} />
            )}
          </View>
          <Text className="text-xl font-bold text-foreground">
            {user?.name || "User"}
          </Text>
          <Text className="text-muted mt-1">{user?.email || ""}</Text>
          <RoleBadge role={role || "shopper"} />
        </View>

        {/* Menu Sections */}
        <View className="px-4">
          {/* Role-Based Dashboard Access */}
          {dashboardInfo && (
            <>
              <Text className={`text-sm font-semibold ${colorScheme === "dark" ? "text-white/80" : "text-foreground/70"} uppercase tracking-wider mb-2 mt-4`}>
                Your Home
              </Text>
              <View className="bg-surface rounded-xl px-4">
                <MenuItem
                  icon={isCoordinator ? "person.badge.key.fill" : isManager ? "chart.bar.fill" : isTrainer ? "dumbbell.fill" : "person.fill"}
                  title={dashboardInfo.title}
                  subtitle={dashboardInfo.subtitle}
                  onPress={handleDashboardPress}
                  highlight
                />
              </View>
            </>
          )}

          {/* My Trainers Section - Only for clients */}
          {isClient && (
            <>
              <SectionTitle>My Trainers</SectionTitle>
              <View className="bg-surface rounded-xl px-4">
                <MenuItem
                  icon="person.2.fill"
                  title="My Trainers"
                  subtitle="View and manage your trainers"
                  onPress={() => router.push("/my-trainers" as any)}
                  highlight
                />
              </View>
            </>
          )}

          {/* Account Section */}
          <SectionTitle>Account</SectionTitle>
          <View className="bg-surface rounded-xl px-4">
            <MenuItem
              icon="person.fill"
              title="Edit Profile"
              subtitle="Update your personal information"
              onPress={() => {
                if (Platform.OS === "web") {
                  alert("Profile editing coming soon!");
                } else {
                  Alert.alert("Coming Soon", "Profile editing coming soon!");
                }
              }}
            />
            <MenuItem
              icon="bag.fill"
              title="My Orders"
              subtitle="View your order history"
              onPress={() => {
                if (isClient) {
                  router.push("/(client)/orders" as any);
                } else {
                  if (Platform.OS === "web") {
                    alert("Orders page coming soon!");
                  } else {
                    Alert.alert("Coming Soon", "Orders page coming soon!");
                  }
                }
              }}
            />
            <MenuItem
              icon="heart.fill"
              title="Favorites"
              subtitle="Your saved bundles"
              onPress={() => {
                if (Platform.OS === "web") {
                  alert("Favorites coming soon!");
                } else {
                  Alert.alert("Coming Soon", "Favorites coming soon!");
                }
              }}
            />
          </View>

          {/* Trainer Quick Actions */}
          {isTrainer && (
            <>
              <SectionTitle>Trainer Actions</SectionTitle>
              <View className="bg-surface rounded-xl px-4">
                <MenuItem
                  icon="plus.circle.fill"
                  title="Create New Bundle"
                  subtitle="Design a new fitness program"
                  onPress={() => router.push("/bundle-editor/new" as any)}
                />
                <MenuItem
                  icon="person.badge.plus"
                  title="Invite Client"
                  subtitle="Send invitation to a new client"
                  onPress={() => router.push("/(trainer)/invite" as any)}
                />
                <MenuItem
                  icon="bag.fill"
                  title="My Bundles"
                  subtitle="View and manage your bundles"
                  onPress={() => router.push("/(trainer)/bundles" as any)}
                />
              </View>
            </>
          )}

          {/* Manager Quick Actions */}
          {isManager && (
            <>
              <SectionTitle>Manager Actions</SectionTitle>
              <View className="bg-surface rounded-xl px-4">
                <MenuItem
                  icon="checkmark.circle.fill"
                  title="Pending Approvals"
                  subtitle="Review submitted bundles"
                  onPress={() => router.push("/(manager)/approvals" as any)}
                />
                <MenuItem
                  icon="person.2.fill"
                  title="Manage Users"
                  subtitle="View and manage user accounts"
                  onPress={() => router.push("/(manager)/users" as any)}
                />
              </View>
            </>
          )}

          {/* Coordinator Quick Actions */}
          {isCoordinator && (
            <>
              <SectionTitle>Coordinator Actions</SectionTitle>
              <View className="bg-surface rounded-xl px-4">
                <MenuItem
                  icon="person.badge.key.fill"
                  title="Impersonate User"
                  subtitle="View the app as any user"
                  onPress={() => router.push("/(coordinator)" as any)}
                />
                <MenuItem
                  icon="doc.text.fill"
                  title="System Logs"
                  subtitle="View activity and audit logs"
                  onPress={() => router.push("/(coordinator)/logs" as any)}
                />
              </View>
            </>
          )}

          {/* Preferences Section */}
          <SectionTitle>Preferences</SectionTitle>
          <View className="bg-surface rounded-xl px-4">
            <MenuItem
              icon={getThemeIcon()}
              title="Theme"
              subtitle={getThemeLabel()}
              onPress={cycleTheme}
              showChevron={false}
            />
            <MenuItem
              icon="gearshape.fill"
              title="Settings"
              subtitle="App preferences and notifications"
              onPress={() => {
                if (isTrainer) {
                  router.push("/(trainer)/settings" as any);
                } else {
                  if (Platform.OS === "web") {
                    alert("Settings coming soon!");
                  } else {
                    Alert.alert("Coming Soon", "Settings coming soon!");
                  }
                }
              }}
            />
            <MenuItem
              icon="info.circle.fill"
              title="Help & Support"
              subtitle="Get help or contact us"
              onPress={() => {
                if (Platform.OS === "web") {
                  alert("Help center coming soon!");
                } else {
                  Alert.alert("Coming Soon", "Help center coming soon!");
                }
              }}
            />
          </View>

          {/* Logout */}
          <View className="mt-6 mb-8">
            <View className="bg-surface rounded-xl px-4">
              <MenuItem
                icon="rectangle.portrait.and.arrow.right"
                title="Logout"
                subtitle="Sign out of your account"
                onPress={handleLogout}
                showChevron={false}
                danger
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
