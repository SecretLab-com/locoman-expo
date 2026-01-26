import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";

type InvitationData = {
  id: number;
  token: string;
  trainerName: string;
  trainerAvatar?: string;
  bundleTitle: string;
  bundleDescription: string;
  bundlePrice: number;
  bundleDuration: string;
  products: Array<{
    id: number;
    name: string;
    quantity: number;
  }>;
  services: Array<{
    id: number;
    name: string;
    sessions: number;
  }>;
  goals: string[];
  personalMessage?: string;
  expiresAt: Date;
  status: "pending" | "accepted" | "expired" | "declined";
};

// Mock invitation data for testing
const MOCK_INVITATION: InvitationData = {
  id: 1,
  token: "abc123",
  trainerName: "Coach Mike",
  bundleTitle: "Weight Loss Program",
  bundleDescription:
    "A comprehensive 12-week program designed to help you lose weight and build healthy habits. Includes personalized nutrition guidance and workout plans.",
  bundlePrice: 149,
  bundleDuration: "12 weeks",
  products: [
    { id: 1, name: "Protein Powder - Vanilla", quantity: 2 },
    { id: 2, name: "Resistance Bands Set", quantity: 1 },
    { id: 3, name: "Meal Prep Containers", quantity: 1 },
  ],
  services: [
    { id: 1, name: "1-on-1 Training Sessions", sessions: 12 },
    { id: 2, name: "Weekly Check-ins", sessions: 12 },
    { id: 3, name: "Nutrition Consultations", sessions: 4 },
  ],
  goals: [
    "Lose 15-20 lbs",
    "Build sustainable eating habits",
    "Increase energy levels",
    "Improve overall fitness",
  ],
  personalMessage:
    "Hey! I'm excited to work with you on your fitness journey. This program has helped many of my clients achieve amazing results. Let's do this together!",
  expiresAt: new Date(Date.now() + 86400000 * 7),
  status: "pending",
};

export default function InvitationScreen() {
  const colors = useColors();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  // Mock payment form state
  const [cardNumber, setCardNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardholderName, setCardholderName] = useState("");

  // Load invitation data
  useEffect(() => {
    const loadInvitation = async () => {
      // TODO: Fetch from API using token
      await new Promise((resolve) => setTimeout(resolve, 500));
      setInvitation({ ...MOCK_INVITATION, token: token || "abc123" });
      setLoading(false);
    };
    loadInvitation();
  }, [token]);

  // Format card number with spaces
  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, "").replace(/\D/g, "");
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(" ").slice(0, 19) : "";
  };

  // Format expiry date
  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + "/" + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  // Validate payment form
  const isPaymentValid = () => {
    return (
      cardNumber.replace(/\s/g, "").length === 16 &&
      expiryDate.length === 5 &&
      cvv.length >= 3 &&
      cardholderName.trim().length > 0
    );
  };

  // Handle accept - show payment modal
  const handleAccept = () => {
    if (!invitation) return;
    setShowPaymentModal(true);
  };

  // Process mock payment
  const handleProcessPayment = async () => {
    if (!invitation || !isPaymentValid()) return;

    setProcessingPayment(true);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setProcessingPayment(false);
    setPaymentSuccess(true);

    // Show success for a moment, then redirect
    setTimeout(() => {
      setShowPaymentModal(false);
      Alert.alert(
        "Payment Successful!",
        `You've joined ${invitation.trainerName}'s ${invitation.bundleTitle}. Your trainer has been notified and will be in touch soon.`,
        [
          {
            text: "Go to Dashboard",
            onPress: () => router.replace("/(client)" as any),
          },
        ]
      );
    }, 1500);
  };

  // Decline invitation
  const handleDecline = () => {
    Alert.alert(
      "Decline Invitation",
      "Are you sure you want to decline this invitation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            // TODO: Call API to decline
            router.back();
          },
        },
      ]
    );
  };

  // Share invitation
  const handleShare = async () => {
    if (!invitation) return;

    try {
      await Share.share({
        message: `Check out this fitness program: ${invitation.bundleTitle} by ${invitation.trainerName}`,
        url: `https://locomotivate.app/invite/${invitation.token}`,
      });
    } catch (error) {
      console.error("Share failed:", error);
    }
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

  // Format expiry
  const formatExpiry = (date: Date) => {
    const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
    if (days <= 0) return "Expired";
    if (days === 1) return "Expires tomorrow";
    return `Expires in ${days} days`;
  };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading invitation...</Text>
      </ScreenContainer>
    );
  }

  if (!invitation) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-4">
        <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
        <Text className="text-xl font-bold text-foreground mt-4">Invalid Invitation</Text>
        <Text className="text-muted text-center mt-2">
          This invitation link is invalid or has expired.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (invitation.status === "expired") {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-4">
        <IconSymbol name="clock.fill" size={48} color={colors.muted} />
        <Text className="text-xl font-bold text-foreground mt-4">Invitation Expired</Text>
        <Text className="text-muted text-center mt-2">
          This invitation has expired. Please contact {invitation.trainerName} for a new one.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} className="p-2 -mr-2">
            <IconSymbol name="square.and.arrow.up" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Trainer Info */}
        <View className="px-4 items-center mb-6">
          <View className="w-20 h-20 rounded-full bg-primary/20 items-center justify-center mb-3">
            <Text className="text-2xl font-bold text-primary">
              {getInitials(invitation.trainerName)}
            </Text>
          </View>
          <Text className="text-xl font-bold text-foreground">{invitation.trainerName}</Text>
          <Text className="text-muted">invites you to join</Text>
        </View>

        {/* Bundle Card */}
        <View className="mx-4 bg-surface rounded-2xl p-6 mb-6 border border-border">
          <Text className="text-2xl font-bold text-foreground mb-2">
            {invitation.bundleTitle}
          </Text>
          <Text className="text-muted leading-relaxed mb-4">
            {invitation.bundleDescription}
          </Text>

          <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-border">
            <View>
              <Text className="text-3xl font-bold text-primary">
                ${invitation.bundlePrice}
              </Text>
              <Text className="text-sm text-muted">{invitation.bundleDuration}</Text>
            </View>
            <View className="bg-warning/10 px-3 py-1 rounded-full">
              <Text className="text-warning text-sm font-medium">
                {formatExpiry(invitation.expiresAt)}
              </Text>
            </View>
          </View>

          {/* Goals */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-foreground mb-2">Goals</Text>
            <View className="gap-2">
              {invitation.goals.map((goal, index) => (
                <View key={index} className="flex-row items-center">
                  <IconSymbol name="checkmark.circle.fill" size={18} color={colors.success} />
                  <Text className="text-muted ml-2">{goal}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Products */}
        {invitation.products.length > 0 && (
          <View className="mx-4 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Products Included
            </Text>
            <View className="bg-surface rounded-xl divide-y divide-border">
              {invitation.products.map((product) => (
                <View key={product.id} className="flex-row items-center p-4">
                  <View className="w-10 h-10 rounded-lg bg-primary/10 items-center justify-center">
                    <IconSymbol name="cube.box.fill" size={20} color={colors.primary} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">{product.name}</Text>
                    <Text className="text-sm text-muted">Qty: {product.quantity}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Services */}
        {invitation.services.length > 0 && (
          <View className="mx-4 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Services Included
            </Text>
            <View className="bg-surface rounded-xl divide-y divide-border">
              {invitation.services.map((service) => (
                <View key={service.id} className="flex-row items-center p-4">
                  <View className="w-10 h-10 rounded-lg bg-success/10 items-center justify-center">
                    <IconSymbol name="calendar" size={20} color={colors.success} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-foreground font-medium">{service.name}</Text>
                    <Text className="text-sm text-muted">{service.sessions} sessions</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Personal Message */}
        {invitation.personalMessage && (
          <View className="mx-4 mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Message from {invitation.trainerName}
            </Text>
            <View className="bg-primary/5 rounded-xl p-4 border border-primary/20">
              <IconSymbol name="message.fill" size={20} color={colors.primary} />
              <Text className="text-foreground mt-2 leading-relaxed italic">
                "{invitation.personalMessage}"
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View className="px-4 pb-8">
          <TouchableOpacity
            onPress={handleAccept}
            className="bg-primary py-4 rounded-xl items-center mb-3"
          >
            <Text className="text-white font-bold text-lg">Accept & Pay ${invitation.bundlePrice}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDecline}
            className="py-4 rounded-xl items-center"
          >
            <Text className="text-muted font-medium">Decline</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Mock Payment Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => !processingPayment && setShowPaymentModal(false)}
      >
        <View className="flex-1 bg-background">
          {/* Modal Header */}
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
            <TouchableOpacity
              onPress={() => !processingPayment && setShowPaymentModal(false)}
              disabled={processingPayment}
            >
              <Text className={`text-primary font-medium ${processingPayment ? "opacity-50" : ""}`}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text className="text-lg font-semibold text-foreground">Payment</Text>
            <View style={{ width: 50 }} />
          </View>

          {paymentSuccess ? (
            // Success State
            <View className="flex-1 items-center justify-center p-8">
              <View className="w-24 h-24 rounded-full bg-success/20 items-center justify-center mb-6">
                <IconSymbol name="checkmark.circle.fill" size={64} color={colors.success} />
              </View>
              <Text className="text-2xl font-bold text-foreground mb-2">Payment Successful!</Text>
              <Text className="text-muted text-center">
                Your trainer has been notified and will be in touch soon.
              </Text>
            </View>
          ) : (
            // Payment Form
            <ScrollView className="flex-1 p-4">
              {/* Order Summary */}
              <View className="bg-surface rounded-xl p-4 mb-6 border border-border">
                <Text className="text-sm font-semibold text-muted mb-2">ORDER SUMMARY</Text>
                <View className="flex-row justify-between items-center">
                  <Text className="text-foreground font-medium">{invitation?.bundleTitle}</Text>
                  <Text className="text-foreground font-bold">${invitation?.bundlePrice}</Text>
                </View>
                <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-border">
                  <Text className="text-foreground font-semibold">Total</Text>
                  <Text className="text-primary text-xl font-bold">${invitation?.bundlePrice}</Text>
                </View>
              </View>

              {/* Test Mode Banner */}
              <View className="bg-warning/10 border border-warning/30 rounded-xl p-3 mb-6 flex-row items-center">
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.warning} />
                <Text className="text-warning ml-2 flex-1 text-sm">
                  Test Mode - No real payment will be processed. Use any card details.
                </Text>
              </View>

              {/* Card Details */}
              <Text className="text-lg font-semibold text-foreground mb-4">Card Details</Text>

              {/* Cardholder Name */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Cardholder Name</Text>
                <TextInput
                  value={cardholderName}
                  onChangeText={setCardholderName}
                  placeholder="John Doe"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  autoCapitalize="words"
                  editable={!processingPayment}
                />
              </View>

              {/* Card Number */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Card Number</Text>
                <TextInput
                  value={cardNumber}
                  onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                  placeholder="4242 4242 4242 4242"
                  placeholderTextColor={colors.muted}
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  keyboardType="numeric"
                  maxLength={19}
                  editable={!processingPayment}
                />
              </View>

              {/* Expiry and CVV */}
              <View className="flex-row gap-4 mb-6">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground mb-2">Expiry Date</Text>
                  <TextInput
                    value={expiryDate}
                    onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                    placeholder="MM/YY"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    keyboardType="numeric"
                    maxLength={5}
                    editable={!processingPayment}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-foreground mb-2">CVV</Text>
                  <TextInput
                    value={cvv}
                    onChangeText={(text) => setCvv(text.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    placeholderTextColor={colors.muted}
                    className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                    editable={!processingPayment}
                  />
                </View>
              </View>

              {/* Pay Button */}
              <TouchableOpacity
                onPress={handleProcessPayment}
                disabled={!isPaymentValid() || processingPayment}
                className={`py-4 rounded-xl items-center flex-row justify-center ${
                  isPaymentValid() && !processingPayment ? "bg-primary" : "bg-muted/30"
                }`}
              >
                {processingPayment ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text className="text-white font-bold text-lg ml-2">Processing...</Text>
                  </>
                ) : (
                  <>
                    <IconSymbol name="lock.fill" size={18} color="#fff" />
                    <Text className="text-white font-bold text-lg ml-2">
                      Pay ${invitation?.bundlePrice}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Security Note */}
              <View className="flex-row items-center justify-center mt-4">
                <IconSymbol name="lock.fill" size={16} color={colors.muted} />
                <Text className="text-muted text-sm ml-2">
                  Your payment is secure and encrypted
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}
