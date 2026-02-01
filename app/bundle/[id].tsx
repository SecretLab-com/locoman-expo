import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

// Mock bundle data - in production this would come from tRPC
const MOCK_BUNDLES: Record<string, any> = {
  "1": {
    id: 1,
    title: "Full Body Transformation",
    description:
      "Complete 12-week program for total body transformation. This comprehensive program includes strength training, cardio, flexibility work, and nutrition guidance to help you achieve your fitness goals.",
    price: 149.99,
    trainerName: "Sarah Johnson",
    trainerAvatar: "https://i.pravatar.cc/150?img=1",
    trainerBio: "Certified Personal Trainer with 10+ years of experience",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800",
    rating: 4.8,
    reviews: 124,
    duration: "12 weeks",
    level: "Intermediate",
    includes: [
      "36 workout videos",
      "Nutrition plan",
      "Weekly check-ins",
      "Community access",
      "Progress tracking",
    ],
  },
  "2": {
    id: 2,
    title: "HIIT Cardio Blast",
    description:
      "High-intensity interval training for maximum fat burn. Short, intense workouts that fit into any schedule while delivering incredible results.",
    price: 79.99,
    trainerName: "Mike Chen",
    trainerAvatar: "https://i.pravatar.cc/150?img=3",
    trainerBio: "HIIT Specialist and Former Olympic Athlete",
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800",
    rating: 4.6,
    reviews: 89,
    duration: "8 weeks",
    level: "Advanced",
    includes: [
      "24 HIIT workouts",
      "Fat-burning meal plans",
      "Recovery protocols",
      "Live Q&A sessions",
    ],
  },
  "3": {
    id: 3,
    title: "Yoga for Beginners",
    description:
      "Gentle introduction to yoga practice and mindfulness. Perfect for those new to yoga or looking to establish a consistent practice.",
    price: 59.99,
    trainerName: "Emma Wilson",
    trainerAvatar: "https://i.pravatar.cc/150?img=5",
    trainerBio: "Registered Yoga Teacher (RYT-500)",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800",
    rating: 4.9,
    reviews: 256,
    duration: "6 weeks",
    level: "Beginner",
    includes: [
      "30 yoga sessions",
      "Meditation guides",
      "Breathing exercises",
      "Pose library",
      "Flexibility tracking",
    ],
  },
};

export default function BundleDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [isFavorite, setIsFavorite] = useState(false);

  const bundle = MOCK_BUNDLES[id || "1"] || MOCK_BUNDLES["1"];

  const handleAddToCart = () => {
    Alert.alert("Added to Cart", `${bundle.title} has been added to your cart!`);
  };

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View className="relative">
          <Image
            source={{ uri: bundle.image }}
            className="w-full h-72"
            contentFit="cover"
          />
          {/* Back Button */}
          <TouchableOpacity
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/80 items-center justify-center"
            onPress={() => router.back()}
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          {/* Favorite Button */}
          <TouchableOpacity
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background/80 items-center justify-center"
            onPress={handleToggleFavorite}
          >
            <IconSymbol
              name={isFavorite ? "heart.fill" : "heart"}
              size={20}
              color={isFavorite ? colors.error : colors.foreground}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="px-4 py-6">
          {/* Title and Price */}
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-1 mr-4">
              <Text className="text-2xl font-bold text-foreground">{bundle.title}</Text>
              <View className="flex-row items-center mt-2">
                <IconSymbol name="star.fill" size={16} color={colors.warning} />
                <Text className="text-foreground ml-1 font-medium">{bundle.rating}</Text>
                <Text className="text-muted ml-1">({bundle.reviews} reviews)</Text>
              </View>
            </View>
            <Text className="text-2xl font-bold text-primary">${bundle.price}</Text>
          </View>

          {/* Trainer Info */}
          <TouchableOpacity className="flex-row items-center bg-surface rounded-xl p-4 mb-6">
            <Image
              source={{ uri: bundle.trainerAvatar }}
              className="w-12 h-12 rounded-full"
            />
            <View className="ml-4 flex-1">
              <Text className="text-base font-semibold text-foreground">
                {bundle.trainerName}
              </Text>
              <Text className="text-sm text-muted">{bundle.trainerBio}</Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.muted} />
          </TouchableOpacity>

          {/* Quick Info */}
          <View className="flex-row mb-6">
            <View className="flex-1 bg-surface rounded-xl p-4 mr-2 items-center">
              <IconSymbol name="clock.fill" size={24} color={colors.primary} />
              <Text className="text-sm text-muted mt-2">Duration</Text>
              <Text className="text-base font-semibold text-foreground">{bundle.duration}</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-4 ml-2 items-center">
              <IconSymbol name="chart.bar.fill" size={24} color={colors.primary} />
              <Text className="text-sm text-muted mt-2">Level</Text>
              <Text className="text-base font-semibold text-foreground">{bundle.level}</Text>
            </View>
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-2">About</Text>
            <Text className="text-base text-muted leading-6">{bundle.description}</Text>
          </View>

          {/* What's Included */}
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">{"What's Included"}</Text>
            {bundle.includes.map((item: string, index: number) => (
              <View key={index} className="flex-row items-center mb-2">
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
                <Text className="text-base text-foreground ml-3">{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 pt-4 pb-8">
        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center"
          onPress={handleAddToCart}
          activeOpacity={0.8}
        >
          <Text className="text-background font-semibold text-lg">
            Add to Cart - ${bundle.price}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
