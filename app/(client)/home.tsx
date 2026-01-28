import { Text, View, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useState, useCallback } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
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

export default function ClientHomeScreen() {
  const colors = useColors();
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
          <Text className="text-2xl font-bold text-foreground">My Fitness Hub</Text>
          <Text className="text-sm text-muted mt-1">Track your progress</Text>
        </View>

        {/* Quick Actions */}
        <View className="px-4">
          <Text className="text-lg font-semibold text-foreground mb-3">Quick Actions</Text>
          
          <QuickAction
            icon="chart.bar.fill"
            title="Dashboard"
            subtitle="View your progress and stats"
            onPress={() => router.push("/(client)" as any)}
          />
          
          <QuickAction
            icon="bag.fill"
            title="My Programs"
            subtitle="View your active bundles"
            onPress={() => router.push("/(client)/subscriptions" as any)}
          />
          
          <QuickAction
            icon="shippingbox.fill"
            title="Deliveries"
            subtitle="Track upcoming deliveries"
            onPress={() => router.push("/(client)/deliveries" as any)}
          />
          
          <QuickAction
            icon="dollarsign.circle.fill"
            title="Spending"
            subtitle="View your spending history"
            onPress={() => router.push("/(client)/spending" as any)}
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
