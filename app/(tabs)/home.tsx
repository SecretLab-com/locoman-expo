import { Text, View, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useState, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuthContext } from "@/contexts/auth-context";
import { useBadgeContext } from "@/contexts/badge-context";
import { haptics } from "@/hooks/use-haptics";

type QuickActionProps = {
  icon: Parameters<typeof IconSymbol>[0]["name"];
  title: string;
  subtitle: string;
  onPress: () => void;
};

function QuickAction({ icon, title, subtitle, onPress }: QuickActionProps) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={async () => {
        await haptics.light();
        onPress();
      }}
      className="bg-surface rounded-xl p-4 mb-3 border border-border"
      activeOpacity={0.7}
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
          <IconSymbol name={icon} size={24} color={colors.primary} />
        </View>
        <View className="flex-1 ml-4">
          <Text className="text-base font-semibold text-foreground">{title}</Text>
          <Text className="text-sm text-muted mt-0.5">{subtitle}</Text>
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.muted} />
      </View>
    </TouchableOpacity>
  );
}

export default function ShopperHomeScreen() {
  const colors = useColors();
  const { isAuthenticated, isTrainer, isClient, isManager, isCoordinator } = useAuthContext();
  const { refetch } = useBadgeContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  const getDashboardInfo = () => {
    if (isCoordinator) return { title: "Coordinator Dashboard", subtitle: "Manage platform operations" };
    if (isManager) return { title: "Manager Dashboard", subtitle: "Review bundles and manage trainers" };
    if (isTrainer) return { title: "Trainer Dashboard", subtitle: "Manage clients and earnings" };
    if (isClient) return { title: "Client Dashboard", subtitle: "View your programs and progress" };
    return null;
  };

  const dashboardInfo = getDashboardInfo();

  return (
    <ScreenContainer>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-6">
          <Text className="text-2xl font-bold text-foreground">Welcome to LocoMotivate</Text>
          <Text className="text-sm text-muted mt-1">Your wellness marketplace</Text>
        </View>

        {/* Quick Actions */}
        <View className="px-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
          
          {/* Role-based dashboard access */}
          {dashboardInfo && (
            <QuickAction
              icon="chart.bar.fill"
              title={dashboardInfo.title}
              subtitle={dashboardInfo.subtitle}
              onPress={handleDashboardPress}
            />
          )}
          
          <QuickAction
            icon="rectangle.grid.2x2.fill"
            title="Browse Bundles"
            subtitle="Discover fitness programs"
            onPress={() => router.push("/(tabs)" as any)}
          />
          
          <QuickAction
            icon="cube.box.fill"
            title="Browse Products"
            subtitle="Shop wellness products"
            onPress={() => router.push("/(tabs)/products" as any)}
          />
          
          <QuickAction
            icon="person.2.fill"
            title="Find Trainers"
            subtitle="Connect with professionals"
            onPress={() => router.push("/(tabs)/trainers" as any)}
          />
          
          <QuickAction
            icon="cart.fill"
            title="View Cart"
            subtitle="Review your selections"
            onPress={() => router.push("/(tabs)/cart" as any)}
          />
          
          <QuickAction
            icon="person.fill"
            title="Profile"
            subtitle={isAuthenticated ? "View your account" : "Sign in to your account"}
            onPress={() => router.push("/(tabs)/profile" as any)}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
