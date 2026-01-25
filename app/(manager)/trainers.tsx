import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type TrainerStatus = "active" | "pending" | "inactive";

type Trainer = {
  id: number;
  name: string;
  email: string;
  username: string;
  status: TrainerStatus;
  clientCount: number;
  bundleCount: number;
  totalEarnings: number;
  rating: number;
  specialties: string[];
  joinedAt: Date;
};

// Mock data
const MOCK_TRAINERS: Trainer[] = [
  {
    id: 1,
    name: "Coach Mike",
    email: "mike@example.com",
    username: "coachmike",
    status: "active",
    clientCount: 24,
    bundleCount: 5,
    totalEarnings: 12450,
    rating: 4.8,
    specialties: ["Weight Loss", "HIIT"],
    joinedAt: new Date(Date.now() - 86400000 * 180),
  },
  {
    id: 2,
    name: "Coach Sarah",
    email: "sarah@example.com",
    username: "coachsarah",
    status: "active",
    clientCount: 18,
    bundleCount: 3,
    totalEarnings: 8900,
    rating: 4.9,
    specialties: ["Yoga", "Nutrition"],
    joinedAt: new Date(Date.now() - 86400000 * 120),
  },
  {
    id: 3,
    name: "Coach Alex",
    email: "alex@example.com",
    username: "coachalex",
    status: "pending",
    clientCount: 0,
    bundleCount: 1,
    totalEarnings: 0,
    rating: 0,
    specialties: ["Strength Training"],
    joinedAt: new Date(Date.now() - 86400000 * 5),
  },
  {
    id: 4,
    name: "Coach Emma",
    email: "emma@example.com",
    username: "coachemma",
    status: "inactive",
    clientCount: 12,
    bundleCount: 2,
    totalEarnings: 5600,
    rating: 4.5,
    specialties: ["Pilates", "Flexibility"],
    joinedAt: new Date(Date.now() - 86400000 * 300),
  },
];

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

  // Filter trainers
  const filteredTrainers = useMemo(() => {
    return MOCK_TRAINERS.filter((trainer) => {
      const matchesSearch =
        trainer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trainer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trainer.username.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === "all" || trainer.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, selectedStatus]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Trainers</Text>
        <Text className="text-sm text-muted mt-1">
          {filteredTrainers.length} trainers
        </Text>
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
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-4 mb-4"
        contentContainerStyle={{ gap: 8 }}
      >
        {(["all", "active", "pending", "inactive"] as const).map((status) => (
          <TouchableOpacity
            key={status}
            onPress={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-full ${
              selectedStatus === status ? "bg-primary" : "bg-surface border border-border"
            }`}
          >
            <Text
              className={`font-medium capitalize ${
                selectedStatus === status ? "text-white" : "text-foreground"
              }`}
            >
              {status === "all" ? "All Status" : status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Trainers List */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
              <View className="flex-row flex-wrap gap-2 mb-3">
                {trainer.specialties.map((specialty, index) => (
                  <View key={index} className="bg-background px-2 py-1 rounded">
                    <Text className="text-xs text-muted">{specialty}</Text>
                  </View>
                ))}
              </View>

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
