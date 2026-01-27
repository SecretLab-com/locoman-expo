import { Text, View, TouchableOpacity, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
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
  const textColor = danger ? colors.error : highlight ? colors.primary : colors.foreground;
  const bgColor = highlight ? "bg-primary/10" : "bg-surface";

  return (
    <TouchableOpacity
      className={`flex-row items-center py-4 border-b border-border ${highlight ? "bg-primary/5" : ""}`}
      onPress={onPress}
      activeOpacity={0.7}
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
    </TouchableOpacity>
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
  const colors = useColors();
  
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

export default function ProfileScreen() {
  const colors = useColors();
  const { user, isAuthenticated, logout, loading, role, isTrainer, isClient, isManager, isCoordinator } = useAuthContext();
  const { themePreference, setThemePreference, colorScheme } = useThemeContext();

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
  };

  const handleDashboardPress = async () => {
    await haptics.light();
    if (isCoordinator) {
      router.push("/(coordinator)" as any);
    } else if (isManager) {
      router.push("/(manager)" as any);
    } else if (isTrainer) {
      router.push("/(trainer)" as any);
    } else if (isClient) {
      router.push("/(client)" as any);
    }
  };

  const getDashboardLabel = () => {
    if (isCoordinator) return { title: "Coordinator Dashboard", subtitle: "Manage all aspects of the platform" };
    if (isManager) return { title: "Manager Dashboard", subtitle: "Review bundles and manage trainers" };
    if (isTrainer) return { title: "Trainer Dashboard", subtitle: "Manage clients, bundles, and earnings" };
    if (isClient) return { title: "Client Dashboard", subtitle: "View subscriptions and deliveries" };
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
                Your Dashboard
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

          {/* Account Section */}
          <SectionTitle>Account</SectionTitle>
          <View className="bg-surface rounded-xl px-4">
            <MenuItem
              icon="person.fill"
              title="Edit Profile"
              subtitle="Update your personal information"
              onPress={() => Alert.alert("Coming Soon", "Profile editing coming soon!")}
            />
            <MenuItem
              icon="bag.fill"
              title="My Orders"
              subtitle="View your order history"
              onPress={() => {
                if (isClient) {
                  router.push("/(client)/orders" as any);
                } else {
                  Alert.alert("Coming Soon", "Orders page coming soon!");
                }
              }}
            />
            <MenuItem
              icon="heart.fill"
              title="Favorites"
              subtitle="Your saved bundles"
              onPress={() => Alert.alert("Coming Soon", "Favorites coming soon!")}
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
                  Alert.alert("Coming Soon", "Settings coming soon!");
                }
              }}
            />
            <MenuItem
              icon="info.circle.fill"
              title="Help & Support"
              subtitle="Get help or contact us"
              onPress={() => Alert.alert("Coming Soon", "Help center coming soon!")}
            />
          </View>

          {/* Logout */}
          <View className="mt-6 mb-8">
            <TouchableOpacity
              className="bg-error/10 border border-error rounded-xl py-4 items-center"
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Text className="text-error font-semibold">Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
