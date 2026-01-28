import { useEffect } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

export default function OrderConfirmationScreen() {
  const colors = useColors();
  const { isClient, isTrainer, isManager, isCoordinator } = useAuthContext();
  
  const checkScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const buttonsTranslateY = useSharedValue(50);

  useEffect(() => {
    // Trigger success haptic
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Animate elements
    checkScale.value = withSpring(1, { damping: 10, stiffness: 100 });
    textOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    buttonsTranslateY.value = withDelay(500, withSpring(0, { damping: 15 }));
  }, []);

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonsTranslateY.value }],
    opacity: buttonsTranslateY.value === 50 ? 0 : 1,
  }));

  const handleViewProgram = () => {
    // Navigate to client's program if they're a client, otherwise to orders
    if (isClient) {
      router.replace("/(client)" as any);
    } else {
      router.replace("/(client)/orders" as any);
    }
  };

  const handleGoHome = () => {
    // Navigate to the appropriate dashboard based on user role
    if (isCoordinator) {
      router.replace("/(coordinator)" as any);
    } else if (isManager) {
      router.replace("/(manager)" as any);
    } else if (isTrainer) {
      router.replace("/(trainer)" as any);
    } else if (isClient) {
      router.replace("/(client)" as any);
    } else {
      router.replace("/(tabs)" as any);
    }
  };

  const handleContinueShopping = () => {
    router.replace("/(tabs)" as any);
  };

  // Generate a random order number
  const orderNumber = `LM-${Date.now().toString().slice(-8)}`;

  return (
    <ScreenContainer className="items-center justify-center p-8">
      {/* Success Icon */}
      <Animated.View
        style={checkAnimatedStyle}
        className="w-24 h-24 rounded-full bg-success items-center justify-center mb-6"
      >
        <IconSymbol name="checkmark" size={48} color={colors.background} />
      </Animated.View>

      {/* Success Message */}
      <Animated.View style={textAnimatedStyle} className="items-center">
        <Text className="text-2xl font-bold text-foreground text-center">
          Order Placed!
        </Text>
        <Text className="text-muted text-center mt-2 mb-4">
          Thank you for your purchase
        </Text>

        {/* Order Number */}
        <View className="bg-surface border border-border rounded-xl px-6 py-4 items-center">
          <Text className="text-muted text-sm">Order Number</Text>
          <Text className="text-foreground font-bold text-lg mt-1">{orderNumber}</Text>
        </View>

        <Text className="text-muted text-center mt-6 px-4">
          You'll receive a confirmation email shortly with your order details and tracking information.
        </Text>
      </Animated.View>

      {/* Action Buttons - Clear escape paths */}
      <Animated.View style={buttonsAnimatedStyle} className="w-full mt-8 gap-3">
        {/* Primary CTA - Go to program/home */}
        <TouchableOpacity
          className="bg-primary py-4 rounded-xl flex-row items-center justify-center"
          onPress={handleViewProgram}
        >
          <IconSymbol name="house.fill" size={20} color={colors.background} />
          <Text className="text-background font-semibold ml-2">
            {isClient ? "View My Program" : "Go Home"}
          </Text>
        </TouchableOpacity>

        {/* Secondary CTA - Continue shopping */}
        <TouchableOpacity
          className="bg-surface border border-border py-4 rounded-xl flex-row items-center justify-center"
          onPress={handleContinueShopping}
        >
          <IconSymbol name="magnifyingglass" size={20} color={colors.foreground} />
          <Text className="text-foreground font-semibold ml-2">Browse More Programs</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Additional Info */}
      <View className="mt-8 bg-primary/10 rounded-xl p-4 w-full">
        <View className="flex-row items-center">
          <IconSymbol name="bell.fill" size={20} color={colors.primary} />
          <Text className="text-foreground font-medium ml-3 flex-1">
            We'll notify you when your order is ready
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
