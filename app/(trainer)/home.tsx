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

export default function TrainerHomeScreen() {
  const colors = useColors();
  const { user } = useAuthContext();
  const { refetch } = useBadgeContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
          <Text className="text-2xl font-bold text-foreground">Welcome, {user?.name || "Trainer"}!</Text>
          <Text className="text-sm text-muted mt-1">Your trainer hub</Text>
        </View>

        {/* Quick Actions */}
        <View className="px-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
          
          <QuickAction
            icon="chart.bar.fill"
            title="Dashboard"
            subtitle="View your stats and overview"
            onPress={() => router.push("/(trainer)" as any)}
          />
          
          <QuickAction
            icon="person.2.fill"
            title="My Clients"
            subtitle="Manage your client roster"
            onPress={() => router.push("/(trainer)/clients" as any)}
          />
          
          <QuickAction
            icon="rectangle.grid.2x2.fill"
            title="My Bundles"
            subtitle="Create and manage programs"
            onPress={() => router.push("/(trainer)/bundles" as any)}
          />
          
          <QuickAction
            icon="shippingbox.fill"
            title="Deliveries"
            subtitle="Track pending deliveries"
            onPress={() => router.push("/(trainer)/deliveries" as any)}
          />
          
          <QuickAction
            icon="person.badge.plus"
            title="Invite Clients"
            subtitle="Send invitations to new clients"
            onPress={() => router.push("/(trainer)/invite" as any)}
          />
        </View>

        {/* Back to Main App */}
        <View className="px-4 mt-6 mb-8">
          <TouchableOpacity
            onPress={async () => {
              await haptics.light();
              router.replace("/(tabs)");
            }}
            className="bg-surface rounded-xl p-4 border border-border"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center justify-center">
              <IconSymbol name="arrow.left" size={20} color={colors.primary} />
              <Text className="text-primary font-semibold ml-2">Back to Main App</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
