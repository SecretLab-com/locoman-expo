import { Text, View, TouchableOpacity, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { IconSymbol } from "@/components/ui/icon-symbol";

type MenuItemProps = {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  danger?: boolean;
};

function MenuItem({ icon, title, subtitle, onPress, showChevron = true, danger = false }: MenuItemProps) {
  const colors = useColors();
  const textColor = danger ? colors.error : colors.foreground;

  return (
    <TouchableOpacity
      className="flex-row items-center py-4 border-b border-border"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-4">
        <IconSymbol name={icon} size={20} color={danger ? colors.error : colors.primary} />
      </View>
      <View className="flex-1">
        <Text style={{ color: textColor }} className="text-base font-medium">
          {title}
        </Text>
        {subtitle && <Text className="text-sm text-muted mt-0.5">{subtitle}</Text>}
      </View>
      {showChevron && (
        <IconSymbol name="chevron.right" size={20} color={colors.muted} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const { user, isAuthenticated, logout, loading } = useAuth();

  const handleLogout = () => {
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
            {user?.name ? (
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
        </View>

        {/* Menu Sections */}
        <View className="px-4">
          {/* Account Section */}
          <Text className="text-sm font-semibold text-muted uppercase mb-2 mt-4">
            Account
          </Text>
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
              onPress={() => Alert.alert("Coming Soon", "Orders page coming soon!")}
            />
            <MenuItem
              icon="heart.fill"
              title="Favorites"
              subtitle="Your saved bundles"
              onPress={() => Alert.alert("Coming Soon", "Favorites coming soon!")}
            />
          </View>

          {/* Preferences Section */}
          <Text className="text-sm font-semibold text-muted uppercase mb-2 mt-6">
            Preferences
          </Text>
          <View className="bg-surface rounded-xl px-4">
            <MenuItem
              icon="gearshape.fill"
              title="Settings"
              subtitle="App preferences and notifications"
              onPress={() => Alert.alert("Coming Soon", "Settings coming soon!")}
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
