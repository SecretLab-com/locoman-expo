import { useState } from "react";
import { Text, View, TouchableOpacity, FlatList, TextInput, Alert, Platform, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";

type DiscoverableTrainer = {
  id: number;
  name: string | null;
  photoUrl: string | null;
  specialties: string[] | null;
  bio: string | null;
  bundleCount: number;
};

const SPECIALTIES = [
  "All",
  "Weight Loss",
  "Strength Training",
  "HIIT",
  "Yoga",
  "Nutrition",
  "Bodybuilding",
  "Cardio",
  "Flexibility",
];

function TrainerDiscoveryCard({ 
  trainer, 
  onPress, 
  onRequestJoin,
  isRequesting,
}: { 
  trainer: DiscoverableTrainer; 
  onPress: () => void;
  onRequestJoin: () => void;
  isRequesting: boolean;
}) {
  const colors = useColors();

  const specialty = Array.isArray(trainer.specialties) && trainer.specialties.length > 0
    ? trainer.specialties[0]
    : "Personal Training";

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl border border-border overflow-hidden mb-3"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="p-4">
        <View className="flex-row items-start">
          <Image
            source={{ uri: trainer.photoUrl || `https://i.pravatar.cc/150?u=${trainer.id}` }}
            className="w-16 h-16 rounded-full"
            contentFit="cover"
          />
          <View className="flex-1 ml-4">
            <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
              {trainer.name || "Trainer"}
            </Text>
            <Text className="text-sm text-primary mt-0.5">{specialty}</Text>
            {trainer.bio && (
              <Text className="text-sm text-muted mt-1" numberOfLines={2}>
                {trainer.bio}
              </Text>
            )}
            <View className="flex-row items-center mt-2">
              <IconSymbol name="cube.box.fill" size={14} color={colors.muted} />
              <Text className="text-sm text-muted ml-1">
                {trainer.bundleCount} {trainer.bundleCount === 1 ? "program" : "programs"} available
              </Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row mt-4 gap-2">
          <TouchableOpacity
            className="flex-1 bg-surface border border-border py-2.5 rounded-lg flex-row items-center justify-center"
            onPress={onPress}
            activeOpacity={0.7}
          >
            <IconSymbol name="person.fill" size={16} color={colors.foreground} />
            <Text className="text-foreground font-medium ml-2">View Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-primary py-2.5 rounded-lg flex-row items-center justify-center"
            onPress={onRequestJoin}
            activeOpacity={0.7}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <IconSymbol name="person.badge.plus" size={16} color={colors.background} />
                <Text className="text-background font-medium ml-2">Request to Join</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function FindTrainerScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All");
  const [requestingTrainerId, setRequestingTrainerId] = useState<number | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Simple debounce using timeout
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    // Clear previous timeout and set new one
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(text);
    }, 300);
    return () => clearTimeout(timeoutId);
  };
  
  // Fetch available trainers from API
  const { 
    data: trainers = [], 
    isLoading, 
    refetch,
    isRefetching,
  } = trpc.myTrainers.discover.useQuery({
    search: debouncedSearch || undefined,
    specialty: selectedSpecialty !== "All" ? selectedSpecialty : undefined,
  });
  
  // Request to join mutation
  const requestMutation = trpc.myTrainers.requestToJoin.useMutation({
    onSuccess: () => {
      refetch();
      if (Platform.OS === "web") {
        alert("Request sent! The trainer will review your request.");
      } else {
        Alert.alert(
          "Request Sent",
          "The trainer will review your request and get back to you soon.",
          [{ text: "OK" }]
        );
      }
    },
    onError: (error) => {
      if (Platform.OS === "web") {
        alert(error.message || "Failed to send request");
      } else {
        Alert.alert("Error", error.message || "Failed to send request");
      }
    },
    onSettled: () => {
      setRequestingTrainerId(null);
    },
  });

  const handleTrainerPress = async (trainer: DiscoverableTrainer) => {
    await haptics.light();
    router.push(`/trainer/${trainer.id}` as any);
  };

  const handleRequestJoin = async (trainer: DiscoverableTrainer) => {
    await haptics.light();
    
    const sendRequest = () => {
      setRequestingTrainerId(trainer.id);
      requestMutation.mutate({ trainerId: trainer.id });
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Request to join ${trainer.name || "this trainer"}?\n\nThey will be notified and can approve your request.`
      );
      if (confirmed) sendRequest();
    } else {
      Alert.alert(
        "Request to Join",
        `Request to join ${trainer.name || "this trainer"}? They will be notified and can approve your request.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Send Request", onPress: sendRequest },
        ]
      );
    }
  };

  const renderSpecialtyFilter = () => (
    <View className="mb-4">
      <FlatList
        horizontal
        data={SPECIALTIES}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            className={`px-4 py-2 rounded-full mr-2 ${
              selectedSpecialty === item
                ? "bg-primary"
                : "bg-surface border border-border"
            }`}
            onPress={() => setSelectedSpecialty(item)}
          >
            <Text
              className={`font-medium ${
                selectedSpecialty === item ? "text-background" : "text-foreground"
              }`}
            >
              {item}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      />
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center py-12">
      <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
        <IconSymbol name="magnifyingglass" size={40} color={colors.muted} />
      </View>
      <Text className="text-lg font-semibold text-foreground mb-2">
        No Trainers Found
      </Text>
      <Text className="text-muted text-center px-8">
        {searchQuery || selectedSpecialty !== "All"
          ? "Try adjusting your search or filters"
          : "No trainers are currently available"}
      </Text>
    </View>
  );

  return (
    <ScreenContainer edges={["left", "right"]}>
      <NavigationHeader 
        title="Find a Trainer" 
        showBack
        showHome
      />
      
      {/* Search Bar */}
      <View className="px-4 pt-2 pb-4">
        <View className="bg-surface border border-border rounded-xl flex-row items-center px-4">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            className="flex-1 py-3 px-3 text-foreground"
            placeholder="Search trainers..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery("");
              setDebouncedSearch("");
            }}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Specialty Filter */}
      {renderSpecialtyFilter()}

      {/* Results */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Finding trainers...</Text>
        </View>
      ) : (
        <FlatList
          data={trainers as DiscoverableTrainer[]}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TrainerDiscoveryCard 
              trainer={item} 
              onPress={() => handleTrainerPress(item)}
              onRequestJoin={() => handleRequestJoin(item)}
              isRequesting={requestingTrainerId === item.id}
            />
          )}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          ListHeaderComponent={
            trainers.length > 0 ? (
              <View className="mb-4">
                <Text className="text-foreground font-semibold text-lg">
                  Available Trainers
                </Text>
                <Text className="text-muted text-sm mt-1">
                  {trainers.length} trainer{trainers.length !== 1 ? "s" : ""} found
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </ScreenContainer>
  );
}
