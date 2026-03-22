import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { savePendingOnboardingContext } from "@/lib/onboarding-context";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function TrainerStoreScreen() {
  const colors = useColors();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { isAuthenticated, user } = useAuthContext();
  const attributionSet = useRef(false);

  const trainerQuery = trpc.catalog.trainerBySlug.useQuery(
    { slug: slug || "" },
    { enabled: Boolean(slug) },
  );
  const setAttributionMutation = trpc.attribution.setAttribution.useMutation();
  const trainer = trainerQuery.data;

  useEffect(() => {
    if (!trainer?.id) return;

    if (isAuthenticated && user && !attributionSet.current) {
      attributionSet.current = true;
      setAttributionMutation.mutate({
        trainerId: trainer.id,
        source: "store_link",
      });
    } else if (!isAuthenticated) {
      void savePendingOnboardingContext({ trainerId: trainer.id });
    }
  }, [trainer?.id, isAuthenticated, user]);

  const handleBrowseStore = () => {
    if (trainer?.id) {
      router.push({
        pathname: "/(tabs)/products",
        params: { ref: trainer.id },
      } as any);
    }
  };

  const trainerPhotoUrl = normalizeAssetUrl(trainer?.photoUrl);
  const specialties = Array.isArray(trainer?.specialties)
    ? (trainer.specialties as string[])
    : [];

  if (trainerQuery.isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading store...</Text>
      </ScreenContainer>
    );
  }

  if (!trainer) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <View className="w-20 h-20 rounded-full bg-surface items-center justify-center mb-4">
          <IconSymbol name="person.fill" size={40} color={colors.muted} />
        </View>
        <Text className="text-xl font-bold text-foreground mb-2">
          Store Not Found
        </Text>
        <Text className="text-muted text-center mb-6">
          This trainer store link is not valid or the trainer is no longer
          active.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/")}
          className="bg-primary px-6 py-3 rounded-xl"
          accessibilityRole="button"
          accessibilityLabel="Go to home"
          testID="store-not-found-home"
        >
          <Text className="text-white font-semibold">Go Home</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View className="flex-1 justify-center items-center px-6">
        {/* Trainer identity */}
        <View className="w-24 h-24 rounded-full bg-surface items-center justify-center overflow-hidden border-4 border-primary/20 mb-4">
          {trainerPhotoUrl ? (
            <Image
              source={{ uri: trainerPhotoUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <IconSymbol name="person.fill" size={40} color={colors.muted} />
          )}
        </View>

        <Text className="text-2xl font-bold text-foreground text-center">
          {trainer.name || "Trainer"}
        </Text>
        {trainer.username && (
          <Text className="text-primary text-base mt-1">
            @{trainer.username}
          </Text>
        )}

        {trainer.bio ? (
          <Text className="text-muted text-center mt-3 leading-6 px-4">
            {trainer.bio.length > 160
              ? `${trainer.bio.slice(0, 160)}...`
              : trainer.bio}
          </Text>
        ) : null}

        {specialties.length > 0 && (
          <View className="flex-row flex-wrap justify-center mt-4 gap-2">
            {specialties.slice(0, 4).map((spec, index) => (
              <View key={index} className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-sm text-primary">{spec}</Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          onPress={handleBrowseStore}
          className="bg-primary px-8 py-4 rounded-xl mt-8 w-full max-w-sm items-center"
          accessibilityRole="button"
          accessibilityLabel="Browse store"
          testID="store-landing-browse"
        >
          <Text className="text-white font-semibold text-lg">Browse Store</Text>
        </TouchableOpacity>

        <Text className="text-xs text-muted text-center mt-4 px-8">
          Products you purchase will be attributed to {trainer.name || "this trainer"}.
        </Text>
      </View>
    </ScreenContainer>
  );
}
