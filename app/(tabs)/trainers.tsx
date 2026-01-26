import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

// Specialty options
const SPECIALTIES = [
  { value: "all", label: "All Specialties" },
  { value: "weight_loss", label: "Weight Loss" },
  { value: "strength", label: "Strength Training" },
  { value: "longevity", label: "Longevity" },
  { value: "nutrition", label: "Nutrition" },
  { value: "yoga", label: "Yoga" },
  { value: "cardio", label: "Cardio" },
  { value: "flexibility", label: "Flexibility" },
  { value: "sports", label: "Sports Performance" },
];

type Trainer = {
  id: number;
  name: string | null;
  photoUrl: string | null;
  username: string | null;
  bio: string | null;
  specialties: unknown;
  socialLinks: unknown;
  bundleCount?: number;
  clientCount?: number;
  rating?: number;
};

export default function TrainersScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch trainers via tRPC
  const { data: trainers, isLoading, refetch } = trpc.catalog.trainers.useQuery(undefined, {
    staleTime: 60000,
  });

  // Filter trainers
  const filteredTrainers = useMemo(() => {
    if (!trainers) return [];

    return trainers.filter((trainer: Trainer) => {
      const matchesSearch =
        (trainer.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trainer.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (trainer.bio || "").toLowerCase().includes(searchQuery.toLowerCase());

      const specs = Array.isArray(trainer.specialties) ? trainer.specialties as string[] : [];
      const matchesSpecialty =
        selectedSpecialty === "all" ||
        specs.includes(selectedSpecialty);

      return matchesSearch && matchesSpecialty;
    });
  }, [trainers, searchQuery, selectedSpecialty]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Navigate to trainer profile
  const openTrainerProfile = (trainer: Trainer) => {
    router.push(`/trainer/${trainer.id}` as any);
  };

  // Get specialty label
  const getSpecialtyLabel = (value: string) => {
    const spec = SPECIALTIES.find((s) => s.value === value);
    return spec?.label || value.replace(/_/g, " ");
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Hero Section */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Find Your Trainer</Text>
        <Text className="text-sm text-muted mt-1">
          Connect with certified wellness professionals
        </Text>
      </View>

      {/* Search Bar */}
      <View className="px-4 mb-3">
        <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 border border-border">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            placeholder="Search trainers..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 ml-3 text-foreground text-base"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Specialty Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: 'row', alignItems: 'center' }}
        style={{ maxHeight: 44, marginBottom: 16 }}
      >
        {SPECIALTIES.map((specialty) => (
          <TouchableOpacity
            key={specialty.value}
            onPress={() => setSelectedSpecialty(specialty.value)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: selectedSpecialty === specialty.value ? colors.primary : colors.surface,
              borderWidth: selectedSpecialty === specialty.value ? 0 : 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: selectedSpecialty === specialty.value ? '#FFFFFF' : colors.foreground,
                fontWeight: selectedSpecialty === specialty.value ? '600' : '400',
              }}
            >
              {specialty.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Loading State */}
      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-3">Loading trainers...</Text>
        </View>
      )}

      {/* Results Count */}
      {!isLoading && (
        <Text className="px-4 text-sm text-muted mb-3">
          {filteredTrainers.length} trainer{filteredTrainers.length !== 1 ? "s" : ""} found
        </Text>
      )}

      {/* Trainer List */}
      {!isLoading && (
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredTrainers.map((trainer: Trainer) => (
            <TouchableOpacity
              key={trainer.id}
              onPress={() => openTrainerProfile(trainer)}
              className="bg-surface rounded-xl p-4 mb-3 border border-border"
            >
              <View className="flex-row">
                {/* Avatar */}
                <View className="w-16 h-16 rounded-full bg-background items-center justify-center overflow-hidden">
                  {trainer.photoUrl ? (
                    <Image
                      source={{ uri: trainer.photoUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <IconSymbol name="person.fill" size={32} color={colors.muted} />
                  )}
                </View>

                {/* Info */}
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center">
                    <Text className="text-lg font-semibold text-foreground">
                      {trainer.name || "Trainer"}
                    </Text>
                    {trainer.rating && (
                      <View className="flex-row items-center ml-2">
                        <IconSymbol name="star.fill" size={14} color="#F59E0B" />
                        <Text className="text-sm text-foreground ml-1">
                          {trainer.rating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {trainer.username && (
                    <Text className="text-sm text-primary">@{trainer.username}</Text>
                  )}

                  {trainer.bio && (
                    <Text className="text-sm text-muted mt-1" numberOfLines={2}>
                      {trainer.bio}
                    </Text>
                  )}

                  {/* Specialties */}
                  {Array.isArray(trainer.specialties) && trainer.specialties.length > 0 && (
                    <View className="flex-row flex-wrap mt-2 gap-1">
                      {(trainer.specialties as string[]).slice(0, 3).map((spec: string, index: number) => (
                        <View
                          key={index}
                          className="bg-primary/10 px-2 py-0.5 rounded"
                        >
                          <Text className="text-xs text-primary">
                            {getSpecialtyLabel(spec)}
                          </Text>
                        </View>
                      ))}
                      {(trainer.specialties as string[]).length > 3 && (
                        <View className="bg-muted/20 px-2 py-0.5 rounded">
                          <Text className="text-xs text-muted">
                            +{(trainer.specialties as string[]).length - 3}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Stats */}
                  <View className="flex-row mt-2 gap-4">
                    {trainer.bundleCount !== undefined && (
                      <Text className="text-xs text-muted">
                        {trainer.bundleCount} bundle{trainer.bundleCount !== 1 ? "s" : ""}
                      </Text>
                    )}
                    {trainer.clientCount !== undefined && (
                      <Text className="text-xs text-muted">
                        {trainer.clientCount} client{trainer.clientCount !== 1 ? "s" : ""}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Chevron */}
                <View className="justify-center">
                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Empty State */}
          {filteredTrainers.length === 0 && (
            <View className="items-center py-16">
              <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                <IconSymbol name="person.fill" size={32} color={colors.muted} />
              </View>
              <Text className="text-lg font-semibold text-foreground mb-2">
                No trainers found
              </Text>
              <Text className="text-muted text-center mb-4">
                Try adjusting your search or filter criteria
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setSelectedSpecialty("all");
                }}
                className="px-4 py-2 border border-border rounded-lg"
              >
                <Text className="text-foreground">Clear filters</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom padding for tab bar */}
          <View className="h-24" />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
