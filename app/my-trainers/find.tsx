import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import RenderHTML from "react-native-render-html";
import { ActivityIndicator, Alert, FlatList, Platform, RefreshControl, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";

type DiscoverableTrainer = {
  id: string;
  name: string | null;
  photoUrl: string | null;
  specialties: string[] | null;
  bio: string | null;
  bundleCount: number;
  presentationHtml?: string | null;
  bundles?: Array<{
    id: string;
    title: string;
    imageUrl: string | null;
    price: string | null;
    cadence: "one_time" | "weekly" | "monthly" | null;
  }>;
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

import { sanitizeHtml } from "@/lib/html-utils";

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
  const { width } = useWindowDimensions();

  const specialty = Array.isArray(trainer.specialties) && trainer.specialties.length > 0
    ? trainer.specialties[0]
    : "Personal Training";

  const descriptionHtml = trainer.presentationHtml || trainer.bio;

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl border border-border overflow-hidden mb-3"
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View ${trainer.name || "trainer"} profile`}
      testID={`trainer-card-${trainer.id}`}
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
            {descriptionHtml && (
              <View style={{ maxHeight: 64, overflow: "hidden" }}>
                <RenderHTML
                  contentWidth={Math.max(0, width - 64)}
                  source={{ html: sanitizeHtml(descriptionHtml) }}
                  tagsStyles={{
                    p: { color: colors.muted, lineHeight: 18, marginTop: 0, marginBottom: 6 },
                    h1: { color: colors.foreground, fontSize: 16, fontWeight: "600", marginBottom: 6 },
                    h2: { color: colors.foreground, fontSize: 15, fontWeight: "600", marginBottom: 6 },
                    h3: { color: colors.foreground, fontSize: 14, fontWeight: "600", marginBottom: 6 },
                    h4: { color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 },
                    h5: { color: colors.foreground, fontSize: 12, fontWeight: "600", marginBottom: 6 },
                    h6: { color: colors.foreground, fontSize: 11, fontWeight: "600", marginBottom: 6 },
                    strong: { color: colors.foreground, fontWeight: "600" },
                    b: { color: colors.foreground, fontWeight: "600" },
                    em: { fontStyle: "italic" },
                    i: { fontStyle: "italic" },
                    ul: { color: colors.muted, marginBottom: 6, paddingLeft: 16 },
                    ol: { color: colors.muted, marginBottom: 6, paddingLeft: 16 },
                    li: { color: colors.muted, marginBottom: 4 },
                  }}
                />
              </View>
            )}
            {trainer.bundles && trainer.bundles.length > 0 ? (
              <View className="flex-row flex-wrap mt-2 gap-2">
                {trainer.bundles.map((bundle) => (
                  <View key={bundle.id} className="flex-row items-center bg-background border border-border rounded-lg px-2 py-1 max-w-[160px]">
                    <View className="w-6 h-6 rounded-md bg-surface items-center justify-center overflow-hidden mr-2">
                      {bundle.imageUrl ? (
                        <Image source={{ uri: bundle.imageUrl }} className="w-6 h-6" contentFit="cover" />
                      ) : (
                        <IconSymbol name="cube.box" size={14} color={colors.muted} />
                      )}
                    </View>
                    <Text className="text-xs text-foreground" numberOfLines={1}>
                      {bundle.title}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-xs text-muted mt-2">No bundles yet</Text>
            )}
            <View className="flex-row items-center mt-2">
              <IconSymbol name="cube.box.fill" size={14} color={colors.muted} />
              <Text className="text-sm text-muted ml-1">
                {trainer.bundleCount} {trainer.bundleCount === 1 ? "program" : "programs"} available
              </Text>
            </View>
          </View>
        </View>

        {/* Action button */}
        <View className="mt-4 items-start">
          <TouchableOpacity
            className="bg-primary py-2.5 rounded-lg flex-row items-center justify-center px-4"
            onPress={onRequestJoin}
            activeOpacity={0.7}
            disabled={isRequesting}
            accessibilityRole="button"
            accessibilityLabel={`Request to join ${trainer.name || "this trainer"}`}
            testID={`trainer-request-${trainer.id}`}
            style={{ maxWidth: 220 }}
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
  const [requestingTrainerId, setRequestingTrainerId] = useState<string | null>(null);
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
          keyExtractor={(item) => item.id}
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
