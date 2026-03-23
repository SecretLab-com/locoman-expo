import { router } from "expo-router";
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { SignedOutGate } from "@/components/signed-out-gate";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ListRow } from "@/components/ui/list-row";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { useThemeContext } from "@/lib/theme-provider";
import { Image } from "expo-image";

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

  return (
    <ListRow
      onPress={onPress}
      icon={icon}
      title={title}
      subtitle={subtitle}
      danger={danger}
      highlight={highlight}
      showChevron={showChevron}
      style={{
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    />
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-sm font-semibold text-muted uppercase tracking-wider mb-2 mt-6">
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

export default function ProfileScreen() {
  const colors = useColors();
  const { user, effectiveUser, isAuthenticated, logout, role, isTrainer, isClient, isManager, effectiveRole, isCoordinator } =
    useAuthContext();
  const displayedRole = effectiveRole ?? role;
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
  const managerBase = isCoordinator ? "/(coordinator)" : "/(manager)";
  const { themePreference, setThemePreference, colorScheme } = useThemeContext();
  const profileUser = effectiveUser ?? user;
  const profilePhotoUrlRaw = normalizeAssetUrl(profileUser?.photoUrl);
  const profilePhotoUrl =
    profilePhotoUrlRaw && profileUser?.updatedAt
      ? `${profilePhotoUrlRaw}${profilePhotoUrlRaw.includes("?") ? "&" : "?"}v=${encodeURIComponent(String(profileUser.updatedAt))}`
      : profilePhotoUrlRaw;


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
          },
        },
      ]
    );
  };

  const handleSupport = async () => {
    const mailtoUrl = "mailto:support@locomotivate.app?subject=LocoMotivate%20Support";
    const fallbackUrl = "https://locomotivate.app/support";
    try {
      const canOpenMail = await Linking.canOpenURL(mailtoUrl);
      await Linking.openURL(canOpenMail ? mailtoUrl : fallbackUrl);
    } catch {
      Alert.alert("Support", "Please contact support@locomotivate.app");
    }
  };



  if (!isAuthenticated) {
    return (
      <SignedOutGate
        icon="person.fill"
        title="Welcome to LocoMotivate"
        description="Sign in to access your profile, orders, and personalized recommendations"
        primaryLabel="Sign In"
        onPrimaryPress={() => router.push("/login")}
        secondaryLabel="Create Account"
        onSecondaryPress={() => router.push("/register" as any)}
      />
    );
  }

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Profile" subtitle="Manage your account" />

        {/* Profile Header */}
        <View className="items-center py-6 px-4">
          <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-4">
            {profilePhotoUrl ? (
              <Image
                source={{ uri: profilePhotoUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            ) : profileUser?.name ? (
              <Text className="text-4xl font-bold text-background">
                {profileUser.name.charAt(0).toUpperCase()}
              </Text>
            ) : (
              <IconSymbol name="person.fill" size={48} color={colors.background} />
            )}
          </View>
          <Text className="text-xl font-bold text-foreground">
            {profileUser?.name || "User"}
          </Text>
          <Text className="text-muted mt-1">{profileUser?.email || ""}</Text>
          {displayedRole ? (
            <RoleBadge role={displayedRole} />
          ) : (
            <Text className="text-sm text-muted mt-2">Syncing role...</Text>
          )}
        </View>

        {/* Menu Sections */}
        <View className="px-4">

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
              onPress={() => router.push(`${roleBase}/settings` as any)}
            />
            {isClient && (
              <MenuItem
                icon="bag.fill"
                title="My Orders"
                subtitle="View your order history"
                onPress={() => router.push("/(client)/orders" as any)}
              />
            )}
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
                  title="Add Client"
                  subtitle="Create a client, then send a bundle or custom plan"
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
                  onPress={() => router.push(`${managerBase}/approvals` as any)}
                />
                <MenuItem
                  icon="person.2.fill"
                  title="Manage Users"
                  subtitle="View and manage user accounts"
                  onPress={() => router.push(`${managerBase}/users` as any)}
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
              onPress={() => router.push(`${roleBase}/settings` as any)}
            />
            <MenuItem
              icon="info.circle.fill"
              title="Help & Support"
              subtitle="Get help or contact us"
              onPress={handleSupport}
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
