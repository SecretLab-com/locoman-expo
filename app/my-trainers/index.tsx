import { useState } from "react";
import { Text, View, TouchableOpacity, FlatList, Alert } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptics } from "@/hooks/use-haptics";

// Mock data for trainers the client is subscribed to
const MOCK_MY_TRAINERS = [
  {
    id: "1",
    name: "Sarah Johnson",
    avatar: "https://i.pravatar.cc/150?img=1",
    specialty: "Strength & Conditioning",
    activeBundles: 2,
    joinedDate: "Jan 2025",
    isPrimary: true,
  },
  {
    id: "2",
    name: "Emma Wilson",
    avatar: "https://i.pravatar.cc/150?img=5",
    specialty: "Yoga & Mindfulness",
    activeBundles: 1,
    joinedDate: "Feb 2025",
    isPrimary: false,
  },
];

type Trainer = (typeof MOCK_MY_TRAINERS)[0];

function TrainerCard({ trainer, onPress }: { trainer: Trainer; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="bg-surface rounded-xl border border-border p-4 mb-3"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center">
        <Image
          source={{ uri: trainer.avatar }}
          className="w-16 h-16 rounded-full"
          contentFit="cover"
        />
        <View className="flex-1 ml-4">
          <View className="flex-row items-center">
            <Text className="text-lg font-semibold text-foreground">
              {trainer.name}
            </Text>
            {trainer.isPrimary && (
              <View className="bg-primary/20 px-2 py-0.5 rounded-full ml-2">
                <Text className="text-xs font-medium text-primary">Primary</Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-muted mt-1">{trainer.specialty}</Text>
          <View className="flex-row items-center mt-2">
            <IconSymbol name="bag.fill" size={14} color={colors.muted} />
            <Text className="text-sm text-muted ml-1">
              {trainer.activeBundles} active {trainer.activeBundles === 1 ? "bundle" : "bundles"}
            </Text>
            <Text className="text-muted mx-2">•</Text>
            <Text className="text-sm text-muted">Since {trainer.joinedDate}</Text>
          </View>
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.muted} />
      </View>
    </TouchableOpacity>
  );
}

export default function MyTrainersScreen() {
  const colors = useColors();
  const [trainers] = useState(MOCK_MY_TRAINERS);

  const handleTrainerPress = (trainer: Trainer) => {
    router.push(`/trainer/${trainer.id}` as any);
  };

  const handleAddTrainer = async () => {
    await haptics.light();
    router.push("/my-trainers/find" as any);
  };

  const handleMessageTrainer = (trainer: Trainer) => {
    router.push(`/messages/${trainer.id}` as any);
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      <NavigationHeader 
        title="My Trainers" 
        showBack
        showHome
      />
      
      <FlatList
        data={trainers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TrainerCard trainer={item} onPress={() => handleTrainerPress(item)} />
        )}
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={
          <Text className="text-muted text-sm mb-4">
            Trainers you're currently working with
          </Text>
        }
        ListFooterComponent={
          <View className="mt-4">
            {/* Add New Trainer Button */}
            <TouchableOpacity
              className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex-row items-center justify-center"
              onPress={handleAddTrainer}
              activeOpacity={0.7}
            >
              <IconSymbol name="plus.circle.fill" size={24} color={colors.primary} />
              <Text className="text-primary font-semibold ml-2">
                Find New Trainer
              </Text>
            </TouchableOpacity>
            
            <Text className="text-muted text-xs text-center mt-4 px-4">
              Adding a new trainer won't affect your existing programs. 
              You can work with multiple trainers at once.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center py-12">
            <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
              <IconSymbol name="person.2.fill" size={40} color={colors.muted} />
            </View>
            <Text className="text-lg font-semibold text-foreground mb-2">
              No Trainers Yet
            </Text>
            <Text className="text-muted text-center mb-6 px-8">
              Find a trainer to start your fitness journey
            </Text>
            <TouchableOpacity
              className="bg-primary px-6 py-3 rounded-full"
              onPress={handleAddTrainer}
            >
              <Text className="text-background font-semibold">Find a Trainer</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </ScreenContainer>
  );
}
