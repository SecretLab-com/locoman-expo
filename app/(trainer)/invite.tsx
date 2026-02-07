import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Bundle = {
  id: string;
  title: string;
  price: string;
  cadence: string;
};

export default function InviteScreen() {
  const colors = useColors();
  const { isTrainer, isManager, isCoordinator, user } = useAuthContext();
  const { bundleId, bundleTitle, bundlePrice, trainerName } = useLocalSearchParams<{
    bundleId?: string;
    bundleTitle?: string;
    bundlePrice?: string;
    trainerName?: string;
  }>();

  // Fetch bundles from API for selection
  const { data: rawBundles, isLoading: bundlesLoading } = trpc.bundles.list.useQuery(undefined, {
    enabled: !bundleId, // Only fetch if no bundle pre-selected
  });

  // Map API bundles to local type
  const bundles: Bundle[] = (rawBundles || []).map((b: any) => ({
    id: b.id,
    title: b.title,
    price: b.price || "0.00",
    cadence: b.cadence || "monthly",
  }));

  // Invite mutation
  const inviteMutation = trpc.clients.invite.useMutation();

  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(
    bundleId
      ? {
        id: bundleId,
        title: bundleTitle || "Selected Bundle",
        price: bundlePrice || "0.00",
        cadence: "monthly",
      }
      : null
  );
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [assignedTrainer, setAssignedTrainer] = useState(trainerName || user?.name || "");

  // Generate invite link via API
  const generateInviteLink = async () => {
    if (!selectedBundle) {
      Alert.alert("Select Bundle", "Please select a bundle to invite the client to.");
      return;
    }
    if (!isTrainer && !assignedTrainer.trim()) {
      Alert.alert("Assign Trainer", "Please assign a trainer to this bundle invite.");
      return;
    }

    try {
      const result = await inviteMutation.mutateAsync({
        email: clientEmail.trim() || `invite-${Date.now()}@placeholder.com`,
        name: clientName.trim() || undefined,
        bundleDraftId: String(selectedBundle.id),
      });

      const link = `https://locomotivate.com/invite/${result.token}`;
      setInviteLink(link);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to generate invite link. Please try again.");
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
    } catch {
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

  // Send email invite via tRPC
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
      await inviteMutation.mutateAsync({
        email: clientEmail.trim(),
        name: clientName.trim() || undefined,
        bundleDraftId: String(selectedBundle.id),
      });

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
    } catch {
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
        {!bundleId ? (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">
              Select Bundle
            </Text>
            {bundlesLoading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-muted mt-2">Loading bundles...</Text>
              </View>
            ) : bundles.length === 0 ? (
              <View className="bg-surface rounded-xl p-6 items-center border border-border">
                <IconSymbol name="bag.fill" size={32} color={colors.muted} />
                <Text className="text-muted mt-2">No bundles created yet</Text>
                <Text className="text-muted text-sm text-center mt-1">
                  Create a bundle first to invite clients
                </Text>
              </View>
            ) : (
            <View className="gap-3">
              {bundles.map((bundle) => {
                const isSelected = selectedBundle?.id === bundle.id;
                return (
                  <TouchableOpacity
                    key={bundle.id}
                    onPress={() => {
                      setSelectedBundle(bundle);
                      setInviteLink(null);
                    }}
                    className={`p-4 rounded-xl border ${isSelected
                      ? "bg-primary/10 border-primary"
                      : "bg-surface border-border"
                      }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text
                          className={`text-base font-semibold ${isSelected ? "text-primary" : "text-foreground"
                            }`}
                        >
                          {bundle.title}
                        </Text>
                        <Text className="text-sm text-muted">
                          ${bundle.price}/{bundle.cadence === "weekly" ? "week" : "month"}
                        </Text>
                      </View>
                      <View
                        className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-border"
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
            )}
          </View>
        ) : (
          <View className="mb-6 bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <View className="flex-row items-center mb-2">
              <View className="w-8 h-8 rounded-full bg-primary/20 items-center justify-center mr-3">
                <IconSymbol name="cart.fill" size={16} color={colors.primary} />
              </View>
              <Text className="text-lg font-bold text-foreground">
                Bundle Selected
              </Text>
            </View>
            <View className="bg-surface rounded-xl p-3 border border-border">
              <Text className="text-base font-semibold text-foreground">{bundleTitle}</Text>
              <Text className="text-sm text-primary font-medium mt-1">Price: ${bundlePrice}</Text>
            </View>
            <Text className="text-xs text-muted mt-3 italic">
              * This invite is context-locked to the bundle you were viewing.
            </Text>
          </View>
        )}

        {/* Assigned Trainer */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-foreground mb-3">
            Assigned Trainer
          </Text>
          {isTrainer ? (
            <View className="bg-surface border border-border rounded-xl px-4 py-3">
              <Text className="text-foreground font-medium">
                {user?.name || "You"}
              </Text>
              <Text className="text-xs text-muted mt-1">
                Bundles must be assigned to a trainer at invite.
              </Text>
            </View>
          ) : (
            <View>
              <Text className="text-sm font-medium text-foreground mb-1">Trainer Name</Text>
              <TextInput
                value={assignedTrainer}
                onChangeText={setAssignedTrainer}
                placeholder="Assign a trainer"
                placeholderTextColor={colors.muted}
                className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              />
              {trainerName && (
                <View className="flex-row items-center mt-2 px-1">
                  <IconSymbol name="info.circle.fill" size={14} color={colors.primary} />
                  <Text className="text-xs text-primary font-medium ml-1">
                    Pre-assigned from the bundle owner.
                  </Text>
                </View>
              )}
              <Text className="text-xs text-muted mt-2">
                Required for manager/coordinator invites.
              </Text>
            </View>
          )}
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
              className={`py-4 rounded-xl items-center ${selectedBundle ? "bg-primary" : "bg-muted"
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
            className={`py-4 rounded-xl items-center border ${selectedBundle && !isSending
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
                className={`font-semibold ml-2 ${selectedBundle && !isSending ? "text-primary" : "text-muted"
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
            • Include your {"client's"} name for a personal touch{"\n"}
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
