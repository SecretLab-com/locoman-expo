import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

export default function TrainerSocialProgramScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.socialProgram.myStatus.useQuery();

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

          {hasPendingInvite ? (
            <SurfaceCard>
              <Text className="text-base font-semibold text-foreground mb-2">
                Invitation received
              </Text>
              <Text className="text-sm text-muted mb-3">
                Accept to join the social program and start connecting your channels.
              </Text>
              <View className="flex-row gap-2">
                <ActionButton
                  className="flex-1"
                  onPress={() =>
                    data?.pendingInvite?.id &&
                    acceptMutation.mutate({ inviteId: data.pendingInvite.id })
                  }
                  loading={acceptMutation.isPending}
                  loadingText="Accepting..."
                  accessibilityRole="button"
                  accessibilityLabel="Accept social invite"
                  testID="social-invite-accept"
                >
                  Accept
                </ActionButton>
                <ActionButton
                  className="flex-1"
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
                  Decline
                </ActionButton>
              </View>
            </SurfaceCard>
          ) : null}

          {membershipStatus === "active" ? (
            <SurfaceCard>
              <Text className="text-base font-semibold text-foreground mb-2">
                Connect your social profile
              </Text>
              <Text className="text-sm text-muted mb-3">
                This links your social account data into LocoMotivate for campaign
                eligibility, performance scoring, and payout tracking.
              </Text>
              <View className="gap-2">
                <ActionButton
                  onPress={() => connectMutation.mutate({})}
                  loading={connectMutation.isPending}
                  loadingText="Connecting..."
                  accessibilityRole="button"
                  accessibilityLabel="Connect Phyllo"
                  testID="social-connect-phyllo"
                >
                  {isConnected ? "Refresh Phyllo connection" : "Connect with Phyllo"}
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
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
