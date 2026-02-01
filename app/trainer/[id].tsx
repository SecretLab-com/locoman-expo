import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/auth-context";

// Specialty labels
const SPECIALTY_LABELS: Record<string, string> = {
  weight_loss: "Weight Loss",
  strength: "Strength Training",
  longevity: "Longevity",
  nutrition: "Nutrition",
  yoga: "Yoga",
  cardio: "Cardio",
  flexibility: "Flexibility",
  sports: "Sports Performance",
};

export default function TrainerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { user } = useAuthContext();
  const [requestSent, setRequestSent] = useState(false);

  // Parse id safely - return 0 if invalid
  const trainerId = id ? parseInt(id, 10) : 0;
  const isValidId = !isNaN(trainerId) && trainerId > 0;

  // Fetch trainer profile
  const { data: trainer, isLoading } = trpc.catalog.trainerProfile.useQuery(
    { id: trainerId },
    { enabled: isValidId }
  );

  // Fetch trainer's bundles
  const { data: bundles } = trpc.catalog.bundles.useQuery();

  // Filter bundles by this trainer
  const trainerBundles = bundles?.filter(
    (b: any) => b.trainerId === trainerId
  ) || [];

  // Handle join request
  const handleJoinRequest = () => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please log in to request to join this trainer.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/login") },
        ]
      );
      return;
    }

    // TODO: Implement actual join request via tRPC
    setRequestSent(true);
    Alert.alert(
      "Request Sent",
      `Your request to join ${trainer?.name || "this trainer"} has been sent. They will review your request shortly.`
    );
  };

  // Handle message trainer
  const handleMessage = () => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "Please log in to message this trainer.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/login") },
        ]
      );
      return;
    }

    router.push(`/messages/${id}` as any);
  };

  // Open social link
  const openSocialLink = (platform: string, url: string) => {
    Linking.openURL(url);
  };

  // Get social links
  const socialLinks = trainer?.socialLinks as Record<string, string> | null;
  const specialties = Array.isArray(trainer?.specialties)
    ? (trainer.specialties as string[])
    : [];

  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-3">Loading profile...</Text>
      </ScreenContainer>
    );
  }

  if (!trainer) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
          <IconSymbol name="person.fill" size={40} color={colors.muted} />
        </View>
        <Text className="text-xl font-bold text-foreground mb-2">Trainer Not Found</Text>
        <Text className="text-muted text-center mb-6">
          {"This trainer profile doesn't exist or has been removed."}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-xl"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          >
            <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="flex-1 text-lg font-semibold text-foreground text-center mr-10">
            Trainer Profile
          </Text>
        </View>

        {/* Profile Header */}
        <View className="items-center px-6 py-6">
          {/* Avatar */}
          <View className="w-28 h-28 rounded-full bg-surface items-center justify-center overflow-hidden border-4 border-primary/20">
            {trainer.photoUrl ? (
              <Image
                source={{ uri: trainer.photoUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <IconSymbol name="person.fill" size={48} color={colors.muted} />
            )}
          </View>

          {/* Name & Username */}
          <Text className="text-2xl font-bold text-foreground mt-4">
            {trainer.name || "Trainer"}
          </Text>
          {trainer.username && (
            <Text className="text-primary text-base">@{trainer.username}</Text>
          )}

          {/* Specialties */}
          {specialties.length > 0 && (
            <View className="flex-row flex-wrap justify-center mt-3 gap-2">
              {specialties.map((spec, index) => (
                <View key={index} className="bg-primary/10 px-3 py-1 rounded-full">
                  <Text className="text-sm text-primary">
                    {SPECIALTY_LABELS[spec] || spec}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Social Links */}
          {socialLinks && Object.keys(socialLinks).length > 0 && (
            <View className="flex-row mt-4 gap-3">
              {socialLinks.instagram && (
                <TouchableOpacity
                  onPress={() => openSocialLink("instagram", socialLinks.instagram)}
                  className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                >
                  <Text className="text-lg">📸</Text>
                </TouchableOpacity>
              )}
              {socialLinks.twitter && (
                <TouchableOpacity
                  onPress={() => openSocialLink("twitter", socialLinks.twitter)}
                  className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                >
                  <Text className="text-lg">🐦</Text>
                </TouchableOpacity>
              )}
              {socialLinks.linkedin && (
                <TouchableOpacity
                  onPress={() => openSocialLink("linkedin", socialLinks.linkedin)}
                  className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                >
                  <Text className="text-lg">💼</Text>
                </TouchableOpacity>
              )}
              {socialLinks.website && (
                <TouchableOpacity
                  onPress={() => openSocialLink("website", socialLinks.website)}
                  className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                >
                  <Text className="text-lg">🌐</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Bio */}
        {trainer.bio && (
          <View className="px-6 mb-6">
            <Text className="text-base font-semibold text-foreground mb-2">About</Text>
            <Text className="text-muted leading-6">{trainer.bio}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View className="px-6 mb-6 gap-3">
          <TouchableOpacity
            onPress={handleJoinRequest}
            disabled={requestSent}
            className={`py-4 rounded-xl items-center ${
              requestSent ? "bg-success" : "bg-primary"
            }`}
          >
            <View className="flex-row items-center">
              <IconSymbol
                name={requestSent ? "checkmark.circle.fill" : "person.badge.plus"}
                size={20}
                color="#fff"
              />
              <Text className="text-white font-semibold ml-2">
                {requestSent ? "Request Sent" : "Request to Join"}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleMessage}
            className="py-4 rounded-xl items-center bg-surface border border-border"
          >
            <View className="flex-row items-center">
              <IconSymbol name="message.fill" size={20} color={colors.foreground} />
              <Text className="text-foreground font-semibold ml-2">Message</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Bundles Section */}
        <View className="px-6 mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">
            Available Bundles ({trainerBundles.length})
          </Text>

          {trainerBundles.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 items-center">
              <IconSymbol name="cube.box" size={32} color={colors.muted} />
              <Text className="text-muted mt-2 text-center">
                No bundles available yet
              </Text>
            </View>
          ) : (
            trainerBundles.map((bundle: any) => (
              <TouchableOpacity
                key={bundle.id}
                onPress={() => router.push(`/bundle/${bundle.id}`)}
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
              >
                <View className="flex-row">
                  {/* Bundle Image */}
                  <View className="w-20 h-20 rounded-lg bg-background items-center justify-center overflow-hidden">
                    {bundle.imageUrl ? (
                      <Image
                        source={{ uri: bundle.imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <IconSymbol name="cube.box" size={32} color={colors.muted} />
                    )}
                  </View>

                  {/* Bundle Info */}
                  <View className="flex-1 ml-4">
                    <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                      {bundle.title}
                    </Text>
                    {bundle.description && (
                      <Text className="text-sm text-muted mt-1" numberOfLines={2}>
                        {bundle.description}
                      </Text>
                    )}
                    <View className="flex-row items-center mt-2">
                      <Text className="text-lg font-bold text-primary">
                        ${parseFloat(bundle.price || "0").toFixed(2)}
                      </Text>
                      {bundle.cadence && bundle.cadence !== "one_time" && (
                        <Text className="text-sm text-muted ml-1">
                          /{bundle.cadence === "weekly" ? "week" : "month"}
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
            ))
          )}
        </View>

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
