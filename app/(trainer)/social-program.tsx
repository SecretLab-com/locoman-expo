import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Easing, ScrollView, Text, View } from "react-native";

export default function TrainerSocialProgramScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.socialProgram.myStatus.useQuery();
  const ctaPulseAnim = useRef(new Animated.Value(0)).current;
  const orbFloatAnim = useRef(new Animated.Value(0)).current;

  const acceptMutation = trpc.socialProgram.acceptInvite.useMutation({
    onSuccess: async () => {
      await utils.socialProgram.myStatus.invalidate();
    },
  });
  const declineMutation = trpc.socialProgram.declineInvite.useMutation({
    onSuccess: async () => {
      await utils.socialProgram.myStatus.invalidate();
    },
  });
  const connectMutation = trpc.socialProgram.connectPhyllo.useMutation({
    onSuccess: async () => {
      await utils.socialProgram.myStatus.invalidate();
      await utils.socialProgram.myProgramDashboard.invalidate();
    },
  });

  const membershipStatus = data?.membership?.status || "not_enrolled";
  const hasPendingInvite = Boolean(data?.pendingInvite?.id);
  const isConnected = Boolean(data?.profile?.phylloUserId);
  const canAttemptConnect =
    membershipStatus === "active" ||
    membershipStatus === "invited" ||
    membershipStatus === "not_enrolled";
  const isRestrictedStatus = membershipStatus === "paused" || membershipStatus === "banned";

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulseAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(orbFloatAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(orbFloatAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    floatLoop.start();
    return () => {
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [ctaPulseAnim, orbFloatAnim]);

  const ctaRingScale = ctaPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.09],
  });
  const ctaRingOpacity = ctaPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.5],
  });
  const orbFloatY = orbFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Get Paid for Social Posts"
          subtitle="Join campaigns, track compliance, and earn from approved social content."
          leftSlot={
            <ActionButton
              onPress={() => router.back()}
              variant="ghost"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="social-program-back"
            >
              <IconSymbol name="chevron.left" size={18} color={colors.primary} />
            </ActionButton>
          }
        />

        <View className="px-4 pb-8 gap-4">
          <SurfaceCard style={{ overflow: "hidden", borderColor: "rgba(96,165,250,0.5)" }}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -32,
                right: -26,
                width: 130,
                height: 130,
                borderRadius: 65,
                backgroundColor: "rgba(96,165,250,0.2)",
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: -30,
                left: -16,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: "rgba(167,139,250,0.15)",
                transform: [{ translateY: orbFloatY }],
              }}
            />
            <View className="rounded-full self-start px-2.5 py-1 mb-2 flex-row items-center" style={{ backgroundColor: "rgba(96,165,250,0.16)", borderWidth: 1, borderColor: "rgba(96,165,250,0.4)" }}>
              <IconSymbol name="sparkles" size={12} color={colors.primary} />
              <Text className="text-xs font-semibold ml-1" style={{ color: colors.primary }}>
                Creator Rewards
              </Text>
            </View>
            <Text className="text-lg font-bold text-foreground">Turn posts into payouts</Text>
            <Text className="text-sm text-muted mt-1">
              Connect Phyllo, unlock campaign invites, and track your progress in one place.
            </Text>
            <View className="flex-row mt-3">
              {["Followers", "Views", "Compliance"].map((pill) => (
                <View
                  key={pill}
                  className="mr-2 rounded-full px-2.5 py-1"
                  style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.04)" }}
                >
                  <Text className="text-[10px] font-semibold text-muted">{pill}</Text>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Program requirements
            </Text>
            <Text className="text-sm text-muted mb-1">
              - Minimum 10k followers for campaign eligibility
            </Text>
            <Text className="text-sm text-muted mb-1">
              - On-time posting target: 95%+
            </Text>
            <Text className="text-sm text-muted mb-1">
              - Tag and approved creative compliance: 98%+
            </Text>
            <Text className="text-sm text-muted mb-1">
              - Average views target: 1,000+ per post
            </Text>
            <Text className="text-sm text-muted">
              - Performance metrics tracked: engagement, CTR, share/save, intent actions
            </Text>
          </SurfaceCard>

          {isLoading ? (
            <SurfaceCard>
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-sm text-muted mt-2">Loading social status...</Text>
              </View>
            </SurfaceCard>
          ) : (
            <SurfaceCard>
              <Text className="text-base font-semibold text-foreground mb-2">
                Your status
              </Text>
              <Text className="text-sm text-muted">
                Membership:{" "}
                <Text className="text-foreground font-semibold capitalize">
                  {String(membershipStatus).replace(/_/g, " ")}
                </Text>
              </Text>
              <Text className="text-sm text-muted mt-1">
                Phyllo connected:{" "}
                <Text className="text-foreground font-semibold">
                  {isConnected ? "Yes" : "No"}
                </Text>
              </Text>
              {data?.invitedBy?.name ? (
                <Text className="text-sm text-muted mt-1">
                  Invited by:{" "}
                  <Text className="text-foreground font-semibold">
                    {data.invitedBy.name}
                  </Text>
                </Text>
              ) : null}
            </SurfaceCard>
          )}

          <SurfaceCard style={{ overflow: "visible" }}>
            <Text className="text-base font-semibold text-foreground mb-2">
              Next step
            </Text>
            <Text className="text-sm text-muted mb-3">
              {hasPendingInvite
                ? "Accept your invite to activate social program enrollment."
                : isConnected
                  ? "Your Phyllo account is connected. You can refresh the connection or view progress."
                  : canAttemptConnect
                    ? "Connect Phyllo now to start pulling social metrics for campaign eligibility."
                    : "Your membership is restricted. Ask a coordinator or manager to reactivate you."}
            </Text>
            <Animated.View style={{ transform: [{ scale: ctaRingScale }], opacity: ctaRingOpacity }}>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: -6,
                  left: -6,
                  right: -6,
                  bottom: -6,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: "rgba(96,165,250,0.5)",
                }}
              />
              <ActionButton
                onPress={() =>
                  hasPendingInvite && data?.pendingInvite?.id
                    ? acceptMutation.mutate({ inviteId: data.pendingInvite.id })
                    : connectMutation.mutate({})
                }
                loading={hasPendingInvite ? acceptMutation.isPending : connectMutation.isPending}
                loadingText={hasPendingInvite ? "Accepting..." : "Connecting..."}
                disabled={!hasPendingInvite && (!canAttemptConnect || isRestrictedStatus)}
                accessibilityRole="button"
                accessibilityLabel={hasPendingInvite ? "Accept invite and continue" : "Connect Phyllo now"}
                testID="social-primary-cta"
              >
                {hasPendingInvite
                  ? "Accept invite and continue"
                  : isConnected
                    ? "Refresh Phyllo connection"
                    : "Connect with Phyllo"}
              </ActionButton>
            </Animated.View>
            <View className="mt-2 gap-2">
              {hasPendingInvite ? (
                <ActionButton
                  variant="danger"
                  onPress={() =>
                    data?.pendingInvite?.id &&
                    declineMutation.mutate({ inviteId: data.pendingInvite.id })
                  }
                  loading={declineMutation.isPending}
                  loadingText="Declining..."
                  accessibilityRole="button"
                  accessibilityLabel="Decline social invite"
                  testID="social-invite-decline"
                >
                  Decline invite
                </ActionButton>
              ) : null}
              <ActionButton
                variant="secondary"
                onPress={() => utils.socialProgram.myStatus.invalidate()}
                accessibilityRole="button"
                accessibilityLabel="Refresh social status"
                testID="social-refresh-status"
              >
                Refresh status
              </ActionButton>
              <ActionButton
                variant="secondary"
                onPress={() => router.push("/(trainer)/social-progress" as any)}
                accessibilityRole="button"
                accessibilityLabel="Open social progress"
                testID="social-open-progress"
              >
                Open progress dashboard
              </ActionButton>
            </View>
          </SurfaceCard>

          {hasPendingInvite ? (
            <SurfaceCard>
              <Text className="text-base font-semibold text-foreground mb-2">
                Invitation received
              </Text>
              <Text className="text-sm text-muted mb-3">
                Accept in the Next step section above to join the social program and
                start connecting your channels.
              </Text>
              <Text className="text-xs text-muted">
                Tip: once accepted, tap Connect with Phyllo to start syncing your profiles.
              </Text>
            </SurfaceCard>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
