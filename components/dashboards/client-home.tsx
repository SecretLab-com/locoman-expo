import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Mock data for client dashboard
const MOCK_ACTIVE_BUNDLES = [
  {
    id: 1,
    title: "Full Body Transformation",
    trainerName: "Sarah Johnson",
    trainerAvatar: "https://i.pravatar.cc/150?img=1",
    progress: 65,
    nextSession: "Today at 3:00 PM",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
  },
  {
    id: 2,
    title: "Yoga for Beginners",
    trainerName: "Emma Wilson",
    trainerAvatar: "https://i.pravatar.cc/150?img=5",
    progress: 30,
    nextSession: "Tomorrow at 9:00 AM",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
  },
];

const MOCK_UPCOMING_DELIVERIES = [
  { id: 1, bundleTitle: "Full Body Transformation", item: "Week 8 Workout Plan", date: "Mar 22" },
  { id: 2, bundleTitle: "Yoga for Beginners", item: "Meditation Guide", date: "Mar 23" },
];

type ActiveBundle = (typeof MOCK_ACTIVE_BUNDLES)[0];

function ActiveBundleCard({ bundle, onPress }: { bundle: ActiveBundle; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="bg-surface rounded-2xl overflow-hidden mr-4 border border-border"
      style={{ width: 280 }}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: bundle.image }}
        className="w-full h-32"
        contentFit="cover"
      />
      <View className="p-4">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {bundle.title}
        </Text>
        
        <View className="flex-row items-center mt-2">
          <Image
            source={{ uri: bundle.trainerAvatar }}
            className="w-6 h-6 rounded-full"
          />
          <Text className="text-sm text-muted ml-2">{bundle.trainerName}</Text>
        </View>

        {/* Progress Bar */}
        <View className="mt-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-xs text-muted">Progress</Text>
            <Text className="text-xs font-medium text-foreground">{bundle.progress}%</Text>
          </View>
          <View className="h-2 bg-border rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${bundle.progress}%` }}
            />
          </View>
        </View>

        <View className="flex-row items-center mt-3">
          <IconSymbol name="clock.fill" size={14} color={colors.primary} />
          <Text className="text-sm text-primary ml-1">{bundle.nextSession}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ClientHome() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isLight = colorScheme === "light";
  const statBlue = isLight
    ? ["#DBEAFE", "#EFF6FF"] as const
    : ["#1E3A5F", "#0F2744"] as const;
  const statGreen = isLight
    ? ["#DCFCE7", "#ECFDF5"] as const
    : ["#065F46", "#047857"] as const;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  return (
    <ScreenContainer>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View className="px-4 pt-2 pb-4">
          <Text className="text-2xl font-bold text-foreground">Welcome Back!</Text>
          <Text className="text-sm text-muted">{"Let's continue your fitness journey"}</Text>
        </View>

        {/* Quick Stats */}
        <View className="flex-row px-4 mb-6">
          <View className="flex-1 rounded-xl overflow-hidden mr-2">
            <LinearGradient
              colors={statBlue}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-4"
            >
              <IconSymbol name="bag.fill" size={24} color={colors.primary} />
              <Text className="text-2xl font-bold text-foreground mt-2">
                {MOCK_ACTIVE_BUNDLES.length}
              </Text>
              <Text className="text-sm text-muted">Active Bundles</Text>
            </LinearGradient>
          </View>
          <View className="flex-1 rounded-xl overflow-hidden ml-2">
            <LinearGradient
              colors={statGreen}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="p-4"
            >
              <IconSymbol name="checkmark.circle.fill" size={24} color={colors.success} />
              <Text className="text-2xl font-bold text-foreground mt-2">12</Text>
              <Text className="text-sm text-muted">Completed</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Active Bundles */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between px-4 mb-3">
            <Text className="text-lg font-semibold text-foreground">Active Programs</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/activity" as any)}>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {MOCK_ACTIVE_BUNDLES.map((bundle) => (
              <ActiveBundleCard
                key={bundle.id}
                bundle={bundle}
                onPress={() => router.push(`/bundle/${bundle.id}` as any)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Upcoming Deliveries */}
        <View className="px-4 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-semibold text-foreground">Upcoming Deliveries</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/activity" as any)}>
              <Text className="text-primary font-medium">View All</Text>
            </TouchableOpacity>
          </View>
          <View className="bg-surface rounded-xl border border-border">
            {MOCK_UPCOMING_DELIVERIES.map((delivery, index) => (
              <View
                key={delivery.id}
                className={`flex-row items-center p-4 ${
                  index < MOCK_UPCOMING_DELIVERIES.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
                  <IconSymbol name="shippingbox.fill" size={20} color={colors.primary} />
                </View>
                <View className="flex-1 ml-4">
                  <Text className="text-base font-medium text-foreground">{delivery.item}</Text>
                  <Text className="text-sm text-muted">{delivery.bundleTitle}</Text>
                </View>
                <Text className="text-sm font-medium text-primary">{delivery.date}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Browse More */}
        <View className="px-4 mb-8">
          <TouchableOpacity
            className="bg-surface border border-border rounded-xl p-4 flex-row items-center"
            onPress={() => router.push("/(tabs)/discover" as any)}
          >
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
              <IconSymbol name="magnifyingglass" size={24} color={colors.primary} />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-base font-semibold text-foreground">Discover More</Text>
              <Text className="text-sm text-muted">Browse new fitness programs</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
