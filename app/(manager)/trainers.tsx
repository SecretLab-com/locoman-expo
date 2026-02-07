import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type TrainerStatus = "active" | "pending" | "inactive";

const STATUS_COLORS: Record<TrainerStatus, string> = {
  active: "#22C55E",
  pending: "#F59E0B",
  inactive: "#6B7280",
};

export default function TrainersScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TrainerStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const utils = trpc.useUtils();
  const trainersQuery = trpc.catalog.trainers.useQuery();
  const trainers = trainersQuery.data ?? [];

  // Map API data to the expected format for the UI
  const mappedTrainers = useMemo(() => {
    return trainers.map((trainer) => {
      const specialties = Array.isArray(trainer.specialties) ? trainer.specialties : [];
      const status: TrainerStatus = trainer.active === false ? "inactive" : "active";
      return {
        id: trainer.id,
        name: trainer.name ?? "Unknown",
        email: trainer.email ?? "",
        username: trainer.username ?? "",
        status,
        clientCount: 0, // Not available from catalog.trainers
        bundleCount: 0, // Not available from catalog.trainers
        totalEarnings: 0, // Not available from catalog.trainers
        rating: 0, // Not available from catalog.trainers
        specialties: specialties as string[],
        joinedAt: new Date(trainer.createdAt),
      };
    });
  }, [trainers]);

  // Filter trainers
  const filteredTrainers = useMemo(() => {
    return mappedTrainers.filter((trainer) => {
      const matchesSearch =
        trainer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trainer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trainer.username.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === "all" || trainer.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [mappedTrainers, searchQuery, selectedStatus]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await utils.catalog.trainers.invalidate();
    setRefreshing(false);
  };

  // Get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (trainersQuery.isLoading) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Trainers</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading trainers...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (trainersQuery.isError) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Trainers</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
          <Text className="text-foreground font-semibold mt-4 text-center">Failed to load trainers</Text>
          <Text className="text-muted text-sm mt-2 text-center">{trainersQuery.error.message}</Text>
          <TouchableOpacity
            onPress={() => trainersQuery.refetch()}
            className="mt-4 bg-primary px-6 py-3 rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Retry loading trainers"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Trainers</Text>
            <Text className="text-sm text-muted mt-1">
              {filteredTrainers.length} trainers
            </Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View className="px-4 mb-4">
        <View className="flex-row items-center bg-surface rounded-xl px-4 py-3 border border-border">
          <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search trainers..."
            placeholderTextColor={colors.muted}
            className="flex-1 ml-2 text-foreground"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter - horizontal pills with fixed height */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          style={{ maxHeight: 44 }}
        >
          {(["all", "active", "pending", "inactive"] as const).map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setSelectedStatus(status)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: selectedStatus === status ? colors.primary : colors.surface,
                borderWidth: selectedStatus === status ? 0 : 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${status === "all" ? "all statuses" : status}`}
            >
              <Text
                style={{
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  color: selectedStatus === status ? '#FFFFFF' : colors.foreground,
                }}
              >
                {status === "all" ? "All Status" : status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trainers List */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {filteredTrainers.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="figure.run" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No trainers found</Text>
          </View>
        ) : (
          filteredTrainers.map((trainer) => (
            <TouchableOpacity
              key={trainer.id}
              onPress={() => router.push(`/trainer/${trainer.id}` as any)}
              className="bg-surface rounded-xl p-4 mb-3 border border-border"
              accessibilityRole="button"
              accessibilityLabel={`View ${trainer.name}'s profile`}
            >
              {/* Header */}
              <View className="flex-row items-center mb-3">
                {/* Avatar */}
                <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                  <Text className="text-lg font-bold text-primary">
                    {getInitials(trainer.name)}
                  </Text>
                </View>

                {/* Info */}
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center">
                    <Text className="text-foreground font-semibold">{trainer.name}</Text>
                    {trainer.rating > 0 && (
                      <View className="flex-row items-center ml-2">
                        <IconSymbol name="star.fill" size={14} color="#F59E0B" />
                        <Text className="text-sm text-foreground ml-1">{trainer.rating}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-muted">@{trainer.username}</Text>
                </View>

                {/* Status Badge */}
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${STATUS_COLORS[trainer.status]}20` }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{ color: STATUS_COLORS[trainer.status] }}
                  >
                    {trainer.status}
                  </Text>
                </View>
              </View>

              {/* Specialties */}
              {trainer.specialties.length > 0 && (
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {trainer.specialties.map((specialty, index) => (
                    <View key={index} className="bg-background px-2 py-1 rounded">
                      <Text className="text-xs text-muted">{specialty}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Stats */}
              <View className="flex-row border-t border-border pt-3">
                <View className="flex-1 items-center">
                  <Text className="text-lg font-bold text-foreground">{trainer.clientCount}</Text>
                  <Text className="text-xs text-muted">Clients</Text>
                </View>
                <View className="flex-1 items-center border-l border-border">
                  <Text className="text-lg font-bold text-foreground">{trainer.bundleCount}</Text>
                  <Text className="text-xs text-muted">Bundles</Text>
                </View>
                <View className="flex-1 items-center border-l border-border">
                  <Text className="text-lg font-bold text-foreground">
                    ${(trainer.totalEarnings / 1000).toFixed(1)}k
                  </Text>
                  <Text className="text-xs text-muted">Earnings</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
