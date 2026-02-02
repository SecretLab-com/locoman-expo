import { useState } from "react";
import { Text, View, TouchableOpacity, FlatList, Alert, Platform, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { navigateToHome } from "@/lib/navigation";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";

type MyTrainer = {
  id: number;
  name: string | null;
  photoUrl: string | null;
  specialties: string[] | null;
  bio: string | null;
  activeBundles: number;
  joinedDate: Date | null;
  isPrimary: boolean;
  relationshipId: number;
  relationshipStatus: string;
};

function TrainerCard({ 
  trainer, 
  onPress, 
  onMessage,
  onRemove,
}: { 
  trainer: MyTrainer; 
  onPress: () => void;
  onMessage: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const [showActions, setShowActions] = useState(false);

  const formatDate = (date: Date | null) => {
    if (!date) return "Recently";
    return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

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
        <View className="flex-row items-center">
          <Image
            source={{ uri: trainer.photoUrl || `https://i.pravatar.cc/150?u=${trainer.id}` }}
            className="w-16 h-16 rounded-full"
            contentFit="cover"
          />
          <View className="flex-1 ml-4">
            <View className="flex-row items-center">
              <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                {trainer.name || "Trainer"}
              </Text>
              {trainer.isPrimary && (
                <View className="bg-primary/20 px-2 py-0.5 rounded-full ml-2">
                  <Text className="text-xs font-medium text-primary">Primary</Text>
                </View>
              )}
            </View>
            <Text className="text-sm text-primary mt-0.5">{specialty}</Text>
            <View className="flex-row items-center mt-2">
              <IconSymbol name="bag.fill" size={14} color={colors.muted} />
              <Text className="text-sm text-muted ml-1">
                {trainer.activeBundles} active {trainer.activeBundles === 1 ? "bundle" : "bundles"}
              </Text>
              <Text className="text-muted mx-2">•</Text>
              <Text className="text-sm text-muted">Since {formatDate(trainer.joinedDate)}</Text>
            </View>
          </View>
          <TouchableOpacity
            className="p-2"
            onPress={() => setShowActions(!showActions)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol name="ellipsis" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Action buttons - always visible */}
        <View className="flex-row mt-4 gap-2">
          <TouchableOpacity
            className="flex-1 bg-primary/10 py-2.5 rounded-lg flex-row items-center justify-center"
            onPress={onMessage}
            activeOpacity={0.7}
          >
            <IconSymbol name="message.fill" size={16} color={colors.primary} />
            <Text className="text-primary font-medium ml-2">Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-surface border border-border py-2.5 rounded-lg flex-row items-center justify-center"
            onPress={onPress}
            activeOpacity={0.7}
          >
            <IconSymbol name="person.fill" size={16} color={colors.foreground} />
            <Text className="text-foreground font-medium ml-2">Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Expanded actions */}
        {showActions && (
          <View className="mt-3 pt-3 border-t border-border">
            <TouchableOpacity
              className="flex-row items-center py-2"
              onPress={() => {
                setShowActions(false);
                onRemove();
              }}
            >
              <IconSymbol name="xmark.circle.fill" size={20} color={colors.error} />
              <Text className="text-error ml-3">Remove Trainer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function PendingRequestCard({
  request,
  onCancel,
}: {
  request: {
    id: number;
    trainer?: {
      id: number;
      name: string | null;
      photoUrl: string | null;
      specialties: string[] | null;
    };
    createdAt: Date;
  };
  onCancel: () => void;
}) {
  const trainer = request.trainer;

  if (!trainer) return null;

  const specialty = Array.isArray(trainer.specialties) && trainer.specialties.length > 0
    ? trainer.specialties[0]
    : "Personal Training";

  return (
    <View className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-3">
      <View className="flex-row items-center">
        <Image
          source={{ uri: trainer.photoUrl || `https://i.pravatar.cc/150?u=${trainer.id}` }}
          className="w-12 h-12 rounded-full"
          contentFit="cover"
        />
        <View className="flex-1 ml-3">
          <Text className="text-foreground font-semibold">{trainer.name || "Trainer"}</Text>
          <Text className="text-sm text-muted">{specialty}</Text>
        </View>
        <View className="bg-warning/20 px-2 py-1 rounded-full">
          <Text className="text-xs font-medium text-warning">Pending</Text>
        </View>
      </View>
      <View className="flex-row mt-3 gap-2">
        <TouchableOpacity
          className="flex-1 bg-surface border border-border py-2 rounded-lg"
          onPress={onCancel}
        >
          <Text className="text-muted text-center font-medium">Cancel Request</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-primary py-2 rounded-lg"
          onPress={() => router.push(`/trainer/${trainer.id}` as any)}
        >
          <Text className="text-background text-center font-medium">View Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MyTrainersScreen() {
  const colors = useColors();
  
  // Fetch trainers from API
  const { 
    data: trainers = [], 
    isLoading, 
    refetch,
    isRefetching,
  } = trpc.myTrainers.list.useQuery();
  
  // Fetch pending requests
  const { 
    data: pendingRequests = [],
    refetch: refetchPending,
  } = trpc.myTrainers.pendingRequests.useQuery();
  
  // Remove trainer mutation
  const removeMutation = trpc.myTrainers.remove.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  // Cancel request mutation
  const cancelMutation = trpc.myTrainers.cancelRequest.useMutation({
    onSuccess: () => {
      refetchPending();
    },
  });

  const handleTrainerPress = async (trainer: MyTrainer) => {
    await haptics.light();
    router.push(`/trainer/${trainer.id}` as any);
  };

  const handleAddTrainer = async () => {
    await haptics.light();
    router.push("/my-trainers/find" as any);
  };

  const handleMessageTrainer = async (trainer: MyTrainer) => {
    await haptics.light();
    router.push(`/messages/${trainer.id}` as any);
  };

  const handleRemoveTrainer = (trainer: MyTrainer) => {
    const confirmRemove = () => {
      removeMutation.mutate({ trainerId: trainer.id });
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        `Remove ${trainer.name || "this trainer"}?\n\nYou will no longer see their programs in your dashboard. You can always add them back later.`
      );
      if (confirmed) confirmRemove();
    } else {
      Alert.alert(
        "Remove Trainer",
        `Remove ${trainer.name || "this trainer"}? You will no longer see their programs in your dashboard. You can always add them back later.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: confirmRemove },
        ]
      );
    }
  };

  const handleCancelRequest = (requestId: number) => {
    const confirmCancel = () => {
      cancelMutation.mutate({ requestId });
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Cancel this join request?");
      if (confirmed) confirmCancel();
    } else {
      Alert.alert(
        "Cancel Request",
        "Cancel this join request?",
        [
          { text: "No", style: "cancel" },
          { text: "Yes", style: "destructive", onPress: confirmCancel },
        ]
      );
    }
  };

  const handleRefresh = () => {
    refetch();
    refetchPending();
  };

  const renderHeader = () => (
    <View>
      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <View className="mb-6">
          <Text className="text-foreground font-semibold text-lg mb-3">
            Pending Requests
          </Text>
          {pendingRequests.map((request: any) => (
            <PendingRequestCard
              key={request.id}
              request={request}
              onCancel={() => handleCancelRequest(request.id)}
            />
          ))}
        </View>
      )}

      {/* My Trainers Header */}
      {trainers.length > 0 && (
        <Text className="text-muted text-sm mb-4">
          {"Trainers you're currently working with"}
        </Text>
      )}
    </View>
  );

  const renderFooter = () => (
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
        {"Adding a new trainer won't affect your existing programs. "}
        You can work with multiple trainers at once.
      </Text>
    </View>
  );

  const renderEmpty = () => (
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
        accessibilityRole="button"
        accessibilityLabel="Find a trainer"
        testID="my-trainers-find"
      >
        <Text className="text-background font-semibold">Find a Trainer</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenContainer edges={["left", "right"]}>
      <NavigationHeader 
        title="My Trainers" 
        showBack
        showHome
        onBack={() => navigateToHome()}
      />
      
      <FlatList
        data={trainers as MyTrainer[]}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TrainerCard 
            trainer={item} 
            onPress={() => handleTrainerPress(item)}
            onMessage={() => handleMessageTrainer(item)}
            onRemove={() => handleRemoveTrainer(item)}
          />
        )}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={trainers.length > 0 ? renderFooter : null}
        ListEmptyComponent={!isLoading ? renderEmpty : null}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </ScreenContainer>
  );
}
