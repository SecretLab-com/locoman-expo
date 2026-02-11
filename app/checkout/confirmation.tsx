import { useEffect } from "react";
import { Alert, Linking, Text, View, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export default function OrderConfirmationScreen() {
  const colors = useColors();
  const { isClient } = useAuthContext();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const orderIdValue = typeof orderId === "string" ? orderId : undefined;
  const orderQuery = trpc.orders.get.useQuery(
    { id: orderIdValue || "" },
    { enabled: Boolean(orderIdValue) },
  );
  const createPaymentLink = trpc.orders.createPaymentLink.useMutation();
  
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
  }, [buttonsTranslateY, checkScale, textOpacity]);

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
      router.navigate("/(client)" as any);
    } else {
      router.navigate("/(client)/orders" as any);
    }
  };

  const handleContinueShopping = () => {
    router.navigate("/(tabs)" as any);
  };

  const orderNumber = orderId || `LM-${Date.now().toString().slice(-8)}`;
  const paymentStatusRaw = String(orderQuery.data?.paymentStatus || "pending").toLowerCase();
  const paymentStatusLabel = paymentStatusRaw === "paid" ? "Paid" : "Pending";
  const paymentStatusClassName = paymentStatusRaw === "paid" ? "text-success" : "text-warning";

  const handleCompletePayment = async () => {
    if (!orderIdValue) return;
    try {
      const result = await createPaymentLink.mutateAsync({ orderId: orderIdValue });
      const paymentLink = result.payment?.paymentLink;
      if (paymentLink) {
        await Linking.openURL(paymentLink);
        return;
      }

      if (!result.payment?.configured) {
        Alert.alert("Payment Unavailable", "Payment provider is not configured yet. Please try again later.");
        return;
      }

      if (!result.payment?.required) {
        Alert.alert("Payment Complete", "This order is already marked as paid.");
        orderQuery.refetch();
        return;
      }

      Alert.alert("Payment Pending", "Could not create a payment link. Please try again.");
    } catch (error) {
      console.error("[Checkout] Failed to create payment link:", error);
      Alert.alert("Error", "Unable to open payment link. Please try again.");
    }
  };

  if (!isClient) {
    return (
      <ScreenContainer className="items-center justify-center p-8">
        <IconSymbol name="cart.fill" size={64} color={colors.muted} />
        <Text className="text-xl font-semibold text-foreground mt-4">
          Checkout is client-only
        </Text>
        <Text className="text-muted text-center mt-2">
          Coordinators, managers, and trainers can review bundles but cannot purchase them.
        </Text>
        <TouchableOpacity
          className="bg-primary px-6 py-3 rounded-full mt-6"
          onPress={() => router.navigate("/(tabs)" as any)}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          testID="confirmation-back-home"
        >
          <Text className="text-background font-semibold">Back to Home</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

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
          Order Submitted
        </Text>
        <Text className="text-muted text-center mt-2 mb-4">
          Your order is awaiting payment confirmation
        </Text>

        {/* Order Number */}
        <View className="bg-surface border border-border rounded-xl px-6 py-4 items-center">
          <Text className="text-muted text-sm">Order Number</Text>
          <Text className="text-foreground font-bold text-lg mt-1">{orderNumber}</Text>
          <Text className={`mt-2 text-sm font-semibold ${paymentStatusClassName}`}>
            Payment: {paymentStatusLabel}
          </Text>
        </View>

        <Text className="text-muted text-center mt-6 px-4">
          {"You'll receive updates as payment and fulfillment progress."}
        </Text>
      </Animated.View>

      {/* Action Buttons - Clear escape paths */}
      <Animated.View style={buttonsAnimatedStyle} className="w-full mt-8 gap-3">
        {/* Payment CTA */}
        {orderIdValue && paymentStatusRaw !== "paid" && (
          <TouchableOpacity
            className="bg-warning py-4 rounded-xl flex-row items-center justify-center"
            onPress={handleCompletePayment}
            disabled={createPaymentLink.isPending}
          >
            {createPaymentLink.isPending ? (
              <>
                <ActivityIndicator size="small" color={colors.background} />
                <Text className="text-background font-semibold ml-2">Preparing Payment...</Text>
              </>
            ) : (
              <>
                <IconSymbol name="creditcard.fill" size={20} color={colors.background} />
                <Text className="text-background font-semibold ml-2">Complete Payment</Text>
              </>
            )}
          </TouchableOpacity>
        )}

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
            {"We'll notify you when your order is ready"}
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
