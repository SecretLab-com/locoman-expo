import { useState } from "react";
import { Text, View, TouchableOpacity, FlatList, TextInput } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptics } from "@/hooks/use-haptics";

// Mock data for available trainers to discover
const MOCK_AVAILABLE_TRAINERS = [
  {
    id: "3",
    name: "Mike Chen",
    avatar: "https://i.pravatar.cc/150?img=11",
    specialty: "HIIT & Cardio",
    rating: 4.9,
    reviewCount: 127,
    bundleCount: 8,
    bio: "Certified personal trainer specializing in high-intensity workouts",
  },
  {
    id: "4",
    name: "Lisa Park",
    avatar: "https://i.pravatar.cc/150?img=9",
    specialty: "Pilates & Core",
    rating: 4.8,
    reviewCount: 89,
    bundleCount: 5,
    bio: "Pilates instructor with 10+ years of experience",
  },
  {
    id: "5",
    name: "James Wilson",
    avatar: "https://i.pravatar.cc/150?img=12",
    specialty: "Bodybuilding",
    rating: 4.7,
    reviewCount: 203,
    bundleCount: 12,
    bio: "Former competitive bodybuilder, now helping others achieve their goals",
  },
  {
    id: "6",
    name: "Ana Rodriguez",
    avatar: "https://i.pravatar.cc/150?img=23",
    specialty: "Dance Fitness",
    rating: 4.9,
    reviewCount: 156,
    bundleCount: 6,
    bio: "Make fitness fun with dance-based workouts",
  },
];

type Trainer = (typeof MOCK_AVAILABLE_TRAINERS)[0];

function TrainerDiscoveryCard({ trainer, onPress }: { trainer: Trainer; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl border border-border overflow-hidden mb-3"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="p-4">
        <View className="flex-row">
          <Image
            source={{ uri: trainer.avatar }}
            className="w-20 h-20 rounded-xl"
            contentFit="cover"
          />
          <View className="flex-1 ml-4">
            <Text className="text-lg font-semibold text-foreground">
              {trainer.name}
            </Text>
            <Text className="text-sm text-primary mt-0.5">{trainer.specialty}</Text>
            
            {/* Rating */}
            <View className="flex-row items-center mt-2">
              <IconSymbol name="star.fill" size={14} color={colors.warning} />
              <Text className="text-sm font-medium text-foreground ml-1">
                {trainer.rating}
              </Text>
              <Text className="text-sm text-muted ml-1">
                ({trainer.reviewCount} reviews)
              </Text>
            </View>
            
            {/* Bundle count */}
            <View className="flex-row items-center mt-1">
              <IconSymbol name="bag.fill" size={14} color={colors.muted} />
              <Text className="text-sm text-muted ml-1">
                {trainer.bundleCount} programs available
              </Text>
            </View>
          </View>
        </View>
        
        <Text className="text-sm text-muted mt-3" numberOfLines={2}>
          {trainer.bio}
        </Text>
        
        <TouchableOpacity
          className="bg-primary mt-4 py-3 rounded-xl"
          onPress={onPress}
          activeOpacity={0.8}
        >
          <Text className="text-background font-semibold text-center">View Profile</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function FindTrainerScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [trainers] = useState(MOCK_AVAILABLE_TRAINERS);

  const filteredTrainers = trainers.filter(
    (trainer) =>
      trainer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trainer.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTrainerPress = async (trainer: Trainer) => {
    await haptics.light();
    router.push(`/trainer/${trainer.id}` as any);
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <NavigationHeader 
        title="Find a Trainer" 
        showBack
        showHome
      />
      
      {/* Search Bar */}
      <View className="px-4 pb-4">
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-foreground text-base"
            placeholder="Search trainers or specialties..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      <FlatList
        data={filteredTrainers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TrainerDiscoveryCard 
            trainer={item} 
            onPress={() => handleTrainerPress(item)} 
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View className="mb-4">
            <Text className="text-foreground font-semibold text-lg">
              Recommended Trainers
            </Text>
            <Text className="text-muted text-sm mt-1">
              Based on your interests and goals
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <IconSymbol name="magnifyingglass" size={48} color={colors.muted} />
            <Text className="text-lg font-semibold text-foreground mt-4">
              No trainers found
            </Text>
            <Text className="text-muted text-center mt-2">
              Try a different search term
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
