import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { getInviteLink } from "@/lib/invite-links";
import { navigateToHome } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type InvitationData = {
  id: string;
  token: string;
  trainerName: string;
  trainerId: string;
  trainerAvatar?: string | null;
  bundleId?: string | null;
  bundleTitle: string;
  bundleDescription: string;
  bundlePrice: number;
  bundleDuration: string;
  products: {
    id: string;
    name: string;
    quantity: number;
    productId?: string;
  }[];
  services: {
    id: string;
    name: string;
    sessions: number;
  }[];
  goals: string[];
  personalMessage?: string | null;
  expiresAt: string;
  email?: string | null;
  status: "pending" | "accepted" | "expired" | "declined";
};

export default function InvitationScreen() {
  const colors = useColors();
  const { isAuthenticated, isClient, effectiveRole, loading: authLoading } = useAuthContext();
  const { token } = useLocalSearchParams<{ token: string }>();

  useEffect(() => {
    if (!token) return;
    if (authLoading) return;
    if (isAuthenticated) return;
    router.replace({
      pathname: "/register",
      params: { inviteToken: token },
    } as any);
  }, [authLoading, isAuthenticated, token]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    navigateToHome(effectiveRole);
  };

  const invitationQuery = trpc.catalog.invitation.useQuery(
    { token: token || "" },
    { enabled: !!token }
  );
  const invitation = invitationQuery.data as InvitationData | null | undefined;
  const loading = invitationQuery.isLoading;

  const acceptInvitation = trpc.catalog.acceptInvitation.useMutation({
    onSuccess: () => {
      invitationQuery.refetch();
    },
  });
  const declineInvitation = trpc.catalog.declineInvitation.useMutation({
    onSuccess: () => {
      invitationQuery.refetch();
    },
  });

  const handleAccept = async () => {
    if (!invitation) return;
    if (!isClient) {
      Alert.alert("Client Only", "This invitation can only be accepted by a client.");
      return;
    }
    const proceed = async () => {
      try {
        const result = await acceptInvitation.mutateAsync({ token: invitation.token });

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        if (result.payment?.required && result.payment.paymentLink) {
          if (Platform.OS === "web") {
            if (window.confirm("Invitation accepted. Open payment page now?")) {
              await Linking.openURL(result.payment.paymentLink);
            }
          } else {
            Alert.alert(
              "Complete Payment",
              "Invitation accepted. Complete payment now to confirm this order.",
              [
                { text: "Later", style: "cancel" },
                {
                  text: "Pay Now",
                  onPress: () => {
                    void Linking.openURL(result.payment!.paymentLink!);
                  },
                },
              ]
            );
          }
        }

        Alert.alert(
          "Invitation Accepted",
          `You've joined ${invitation.trainerName}'s ${invitation.bundleTitle}. Your order has been created and is awaiting payment confirmation.`,
          [
            {
              text: "Home",
              onPress: () => navigateToHome({ isClient: true }),
            },
          ]
        );
      } catch (error) {
        console.error("Invitation accept failed:", error);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert("Error", "Unable to accept this invitation. Please try again.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Accept ${invitation.bundleTitle} from ${invitation.trainerName}?`)) {
        await proceed();
      }
    } else {
      Alert.alert(
        "Accept Invitation",
        `Join ${invitation.trainerName}'s ${invitation.bundleTitle}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept",
            onPress: () => {
              void proceed();
            },
          },
        ]
      );
    }
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
            if (!invitation) return;
            try {
              await declineInvitation.mutateAsync({ token: invitation.token });
              handleBack();
            } catch (error) {
              console.error("Invitation decline failed:", error);
              Alert.alert("Error", "Failed to decline invitation. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Share invitation
  const handleShare = async () => {
    if (!invitation) return;
    const inviteUrl = getInviteLink(invitation.token);

    try {
      await Share.share({
        message: `Check out this fitness program: ${invitation.bundleTitle} by ${invitation.trainerName}\n\n${inviteUrl}`,
        url: inviteUrl,
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

  const expiresAtDate = useMemo(
    () => (invitation?.expiresAt ? new Date(invitation.expiresAt) : null),
    [invitation?.expiresAt]
  );

  // Format expiry
  const formatExpiry = (date: Date | null) => {
    if (!date) return "No expiry";
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
          onPress={handleBack}
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
          onPress={handleBack}
          className="bg-primary px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (invitation.status === "accepted") {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-4">
        <IconSymbol name="checkmark.circle.fill" size={48} color={colors.success} />
        <Text className="text-xl font-bold text-foreground mt-4">Invitation Accepted</Text>
        <Text className="text-muted text-center mt-2">
          This invitation has already been accepted.
        </Text>
        <TouchableOpacity
          onPress={() => navigateToHome({ isClient: true })}
          className="bg-primary px-6 py-3 rounded-xl mt-6"
        >
          <Text className="text-white font-semibold">Go Home</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (invitation.status === "declined") {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-4">
        <IconSymbol name="xmark.circle.fill" size={48} color={colors.muted} />
        <Text className="text-xl font-bold text-foreground mt-4">Invitation Declined</Text>
        <Text className="text-muted text-center mt-2">
          This invitation has already been declined.
        </Text>
        <TouchableOpacity
          onPress={handleBack}
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
          <TouchableOpacity onPress={handleBack} className="p-2 -ml-2">
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
                {formatExpiry(expiresAtDate)}
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
                {`"${invitation.personalMessage}"`}
              </Text>
            </View>
          </View>
        )}

        {/* Actions */}
        <View className="px-4 pb-8">
          {isAuthenticated ? (
            isClient ? (
              <TouchableOpacity
                onPress={handleAccept}
                disabled={acceptInvitation.isPending}
                className="bg-primary py-4 rounded-xl items-center mb-3 shadow-lg shadow-primary/20"
              >
                {acceptInvitation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-lg">
                    Accept Invitation
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <View className="bg-surface border border-border rounded-xl p-4 mb-3">
                <Text className="text-foreground font-semibold">Client-only invitation</Text>
                <Text className="text-muted mt-1">
                  This invitation can only be accepted and purchased by a client account.
                </Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({
                  pathname: "/register",
                  params: {
                    trainerId: invitation.trainerId,
                    inviteToken: invitation.token
                  }
                });
              }}
              className="bg-primary py-4 rounded-xl items-center mb-3 shadow-lg shadow-primary/20"
            >
              <Text className="text-white font-bold text-lg">
                Sign Up to Accept
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleDecline}
            className="py-4 rounded-xl items-center"
          >
            <Text className="text-muted font-medium">Decline</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
