import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Alert,
  Clipboard,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

type Bundle = {
  id: number;
  title: string;
  price: string;
  cadence: string;
};

// Mock bundles
const MOCK_BUNDLES: Bundle[] = [
  { id: 1, title: "Weight Loss Program", price: "149.99", cadence: "monthly" },
  { id: 2, title: "Strength Training", price: "199.99", cadence: "monthly" },
  { id: 3, title: "Nutrition Coaching", price: "99.99", cadence: "weekly" },
];

export default function InviteScreen() {
  const colors = useColors();
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Generate invite link
  const generateInviteLink = () => {
    if (!selectedBundle) {
      Alert.alert("Select Bundle", "Please select a bundle to invite the client to.");
      return;
    }

    // Generate a unique invite code
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const link = `https://locomotivate.com/invite/${inviteCode}`;
    setInviteLink(link);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // Copy link to clipboard
  const copyLink = async () => {
    if (!inviteLink) return;

    try {
      await Clipboard.setString(inviteLink);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Alert.alert("Copied!", "Invite link copied to clipboard.");
    } catch (error) {
      Alert.alert("Error", "Failed to copy link.");
    }
  };

  // Share link
  const shareLink = async () => {
    if (!inviteLink || !selectedBundle) return;

    try {
      const message = personalMessage
        ? `${personalMessage}\n\nJoin my ${selectedBundle.title} program: ${inviteLink}`
        : `I'd like to invite you to join my ${selectedBundle.title} program on LocoMotivate!\n\n${inviteLink}`;

      await Share.share({
        message,
        title: `Join ${selectedBundle.title}`,
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  // Send email invite
  const sendEmailInvite = async () => {
    if (!selectedBundle) {
      Alert.alert("Select Bundle", "Please select a bundle first.");
      return;
    }

    if (!clientEmail.trim()) {
      Alert.alert("Email Required", "Please enter the client's email address.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setIsSending(true);

    try {
      // TODO: Send invite via tRPC
      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Invite Sent!",
        `An invitation has been sent to ${clientEmail} for the ${selectedBundle.title} program.`,
        [
          {
            text: "OK",
            onPress: () => {
              setClientEmail("");
              setClientName("");
              setPersonalMessage("");
              setInviteLink(null);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to send invitation. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Invite Client</Text>
            <Text className="text-sm text-muted mt-1">
              Send personalized invitations to new clients
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Select Bundle */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Select Bundle
          </Text>
          <View className="gap-3">
            {MOCK_BUNDLES.map((bundle) => {
              const isSelected = selectedBundle?.id === bundle.id;
              return (
                <TouchableOpacity
                  key={bundle.id}
                  onPress={() => {
                    setSelectedBundle(bundle);
                    setInviteLink(null);
                  }}
                  className={`p-4 rounded-xl border ${
                    isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text
                        className={`text-base font-semibold ${
                          isSelected ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {bundle.title}
                      </Text>
                      <Text className="text-sm text-muted">
                        ${bundle.price}/{bundle.cadence === "weekly" ? "week" : "month"}
                      </Text>
                    </View>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        isSelected ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {isSelected && (
                        <IconSymbol name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Client Details */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Client Details (Optional)
          </Text>

          {/* Client Name */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-foreground mb-1">Name</Text>
            <TextInput
              value={clientName}
              onChangeText={setClientName}
              placeholder="Client's name"
              placeholderTextColor={colors.muted}
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            />
          </View>

          {/* Client Email */}
          <View className="mb-3">
            <Text className="text-sm font-medium text-foreground mb-1">Email</Text>
            <TextInput
              value={clientEmail}
              onChangeText={setClientEmail}
              placeholder="client@email.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
            />
          </View>

          {/* Personal Message */}
          <View>
            <Text className="text-sm font-medium text-foreground mb-1">
              Personal Message
            </Text>
            <TextInput
              value={personalMessage}
              onChangeText={setPersonalMessage}
              placeholder="Add a personal message to your invitation..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground min-h-[80px]"
            />
          </View>
        </View>

        {/* Generate Link Section */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Invite Link
          </Text>

          {inviteLink ? (
            <View className="bg-surface rounded-xl p-4 border border-border">
              <View className="flex-row items-center bg-background rounded-lg p-3 mb-4">
                <IconSymbol name="link" size={20} color={colors.primary} />
                <Text
                  className="flex-1 text-foreground ml-2"
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {inviteLink}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={copyLink}
                  className="flex-1 bg-surface border border-border py-3 rounded-xl flex-row items-center justify-center"
                >
                  <IconSymbol name="doc.text.fill" size={18} color={colors.foreground} />
                  <Text className="text-foreground font-semibold ml-2">Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={shareLink}
                  className="flex-1 bg-primary py-3 rounded-xl flex-row items-center justify-center"
                >
                  <IconSymbol name="square.and.arrow.up" size={18} color="#fff" />
                  <Text className="text-white font-semibold ml-2">Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={generateInviteLink}
              disabled={!selectedBundle}
              className={`py-4 rounded-xl items-center ${
                selectedBundle ? "bg-primary" : "bg-muted"
              }`}
            >
              <View className="flex-row items-center">
                <IconSymbol name="link" size={20} color="#fff" />
                <Text className="text-white font-semibold ml-2">
                  Generate Invite Link
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Send Email Invite */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Or Send Email Invite
          </Text>

          <TouchableOpacity
            onPress={sendEmailInvite}
            disabled={isSending || !selectedBundle}
            className={`py-4 rounded-xl items-center border ${
              selectedBundle && !isSending
                ? "bg-surface border-primary"
                : "bg-muted/20 border-border"
            }`}
          >
            <View className="flex-row items-center">
              <IconSymbol
                name="envelope.fill"
                size={20}
                color={selectedBundle && !isSending ? colors.primary : colors.muted}
              />
              <Text
                className={`font-semibold ml-2 ${
                  selectedBundle && !isSending ? "text-primary" : "text-muted"
                }`}
              >
                {isSending ? "Sending..." : "Send Email Invitation"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View className="mb-6 bg-primary/10 rounded-xl p-4">
          <View className="flex-row items-center mb-2">
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <Text className="text-primary font-semibold ml-2">Tips</Text>
          </View>
          <Text className="text-foreground text-sm leading-5">
            • Personalized invitations have a higher acceptance rate{"\n"}
            • Include your client's name for a personal touch{"\n"}
            • Share the link via text, email, or social media{"\n"}
            • Links expire after 7 days for security
          </Text>
        </View>

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
