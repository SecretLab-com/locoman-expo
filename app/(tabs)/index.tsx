import { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Mock data for bundles - in production this would come from tRPC
const MOCK_BUNDLES = [
  {
    id: 1,
    title: "Full Body Transformation",
    description: "Complete 12-week program for total body transformation",
    price: 149.99,
    trainerName: "Sarah Johnson",
    trainerAvatar: "https://i.pravatar.cc/150?img=1",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
    rating: 4.8,
    reviews: 124,
  },
  {
    id: 2,
    title: "HIIT Cardio Blast",
    description: "High-intensity interval training for maximum fat burn",
    price: 79.99,
    trainerName: "Mike Chen",
    trainerAvatar: "https://i.pravatar.cc/150?img=3",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400",
    rating: 4.6,
    reviews: 89,
  },
  {
    id: 3,
    title: "Yoga for Beginners",
    description: "Gentle introduction to yoga practice and mindfulness",
    price: 59.99,
    trainerName: "Emma Wilson",
    trainerAvatar: "https://i.pravatar.cc/150?img=5",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
    rating: 4.9,
    reviews: 256,
  },
  {
    id: 4,
    title: "Strength Training 101",
    description: "Build muscle and strength with proven techniques",
    price: 99.99,
    trainerName: "James Rodriguez",
    trainerAvatar: "https://i.pravatar.cc/150?img=8",
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400",
    rating: 4.7,
    reviews: 178,
  },
  {
    id: 5,
    title: "Marathon Prep",
    description: "16-week program to prepare for your first marathon",
    price: 129.99,
    trainerName: "Lisa Park",
    trainerAvatar: "https://i.pravatar.cc/150?img=9",
    image: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=400",
    rating: 4.5,
    reviews: 67,
  },
  {
    id: 6,
    title: "Core & Abs Focus",
    description: "Targeted workouts for a stronger core",
    price: 49.99,
    trainerName: "David Kim",
    trainerAvatar: "https://i.pravatar.cc/150?img=12",
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400",
    rating: 4.4,
    reviews: 92,
  },
];

type Bundle = (typeof MOCK_BUNDLES)[0];

function BundleCard({ bundle, onPress }: { bundle: Bundle; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="bg-surface rounded-2xl overflow-hidden mb-4 border border-border"
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: bundle.image }}
        className="w-full h-40"
        contentFit="cover"
      />
      <View className="p-4">
        <Text className="text-lg font-semibold text-foreground mb-1" numberOfLines={1}>
          {bundle.title}
        </Text>
        <Text className="text-sm text-muted mb-3" numberOfLines={2}>
          {bundle.description}
        </Text>

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Image
              source={{ uri: bundle.trainerAvatar }}
              className="w-6 h-6 rounded-full mr-2"
            />
            <Text className="text-sm text-muted">{bundle.trainerName}</Text>
          </View>
          <Text className="text-lg font-bold text-primary">${bundle.price}</Text>
        </View>

        <View className="flex-row items-center mt-2">
          <IconSymbol name="star.fill" size={14} color={colors.warning} />
          <Text className="text-sm text-foreground ml-1">{bundle.rating}</Text>
          <Text className="text-sm text-muted ml-1">({bundle.reviews} reviews)</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CatalogScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filteredBundles = MOCK_BUNDLES.filter(
    (bundle) =>
      bundle.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bundle.trainerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleBundlePress = (bundle: Bundle) => {
    router.push(`/bundle/${bundle.id}` as any);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-foreground">Discover</Text>
            <Text className="text-sm text-muted">Find your perfect fitness program</Text>
          </View>
          {!isAuthenticated && (
            <TouchableOpacity
              className="bg-primary px-4 py-2 rounded-full"
              onPress={() => router.push("/login")}
            >
              <Text className="text-background font-semibold">Login</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-foreground"
            placeholder="Search bundles or trainers..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bundle List */}
      <FlatList
        data={filteredBundles}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <BundleCard bundle={item} onPress={() => handleBundlePress(item)} />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <Text className="text-muted text-center">No bundles found</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
