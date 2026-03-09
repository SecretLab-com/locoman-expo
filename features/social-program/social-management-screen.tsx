import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { getPayoutKycStatusLabel } from "@/shared/payout-kyc";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  roleLabel: "Coordinator" | "Manager";
};

export function SocialManagementScreen({ roleLabel }: Props) {
  const colors = useColors();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "invited" | "active" | "paused" | "banned" | "declined"
  >("all");

  const summaryQuery = trpc.socialProgram.managementSummary.useQuery();
  const kycSummaryQuery = trpc.payments.kycSummary.useQuery();
  const kycRequestsQuery = trpc.payments.listOnboardingRequests.useQuery({
    status: "all",
    limit: 500,
  });
  const membersQuery = trpc.socialProgram.listMembers.useQuery({
    status: selectedStatus,
    search,
    limit: 250,
  });
  const allMembersQuery = trpc.socialProgram.listMembers.useQuery({
    status: "all",
    search: "",
    limit: 500,
  });
  const eligibleQuery = trpc.socialProgram.listEligibleTrainers.useQuery({
    search: inviteQuery,
    limit: 300,
  });
  const isEligibleProcedureMissing = String(eligibleQuery.error?.message || "").includes(
    'No procedure found on path "socialProgram.listEligibleTrainers"',
  );
  const eligibleFallbackQuery = trpc.admin.usersWithFilters.useQuery(
    {
      role: "trainer",
      status: "active",
      search: inviteQuery || undefined,
      limit: 300,
      offset: 0,
    },
    {
      enabled: isEligibleProcedureMissing,
    },
  );

  const inviteMutation = trpc.socialProgram.inviteTrainer.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.managementSummary.invalidate(),
        utils.socialProgram.listMembers.invalidate(),
      ]);
    },
  });

  const statusMutation = trpc.socialProgram.setMemberStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.managementSummary.invalidate(),
        utils.socialProgram.listMembers.invalidate(),
      ]);
    },
  });

  const eligibleRows = useMemo(() => {
    const existingTrainerIds = new Set(
      (allMembersQuery.data || []).map((member) => String(member.trainerId || "")).filter(Boolean),
    );

    if (isEligibleProcedureMissing) {
      return (eligibleFallbackQuery.data?.users || []).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        socialMembership: null,
      })).filter((row) => !existingTrainerIds.has(String(row.id)));
    }
    return (eligibleQuery.data || [])
      .filter((row) =>
        !["active", "paused", "banned"].includes(
          String(row?.socialMembership?.status || "").toLowerCase(),
        ),
      )
      .filter((row) => !existingTrainerIds.has(String(row.id)))
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        socialMembership: row.socialMembership,
      }));
  }, [
    allMembersQuery.data,
    isEligibleProcedureMissing,
    eligibleFallbackQuery.data?.users,
    eligibleQuery.data,
  ]);
  const kycStatusByTrainerId = useMemo(
    () =>
      new Map(
        (kycRequestsQuery.data || []).map((row) => [
          row.onboarding.trainerId,
          getPayoutKycStatusLabel(row.onboarding.status),
        ]),
      ),
    [kycRequestsQuery.data],
  );

  useEffect(() => {
    if (!showInviteModal) return;
    // Always refresh list when modal opens to avoid stale empty state.
    if (isEligibleProcedureMissing) {
      eligibleFallbackQuery.refetch();
      return;
    }
    eligibleQuery.refetch();
  }, [showInviteModal, isEligibleProcedureMissing, eligibleFallbackQuery, eligibleQuery]);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Social Management"
          subtitle={`${roleLabel} dashboard for social member performance and compliance.`}
          leftSlot={
            <TouchableOpacity
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace(
                      (roleLabel === "Manager" ? "/(manager)/more" : "/(coordinator)/more") as any,
                    )
              }
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID={`social-management-back-${roleLabel.toLowerCase()}`}
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          }
        />

        <View className="px-4 pb-24 gap-4">
          <ActionButton
            onPress={() =>
              router.push(
                (roleLabel === "Manager"
                  ? "/(manager)/brand-dashboard"
                  : "/(coordinator)/brand-dashboard") as any,
              )
            }
            variant="secondary"
            accessibilityRole="button"
            accessibilityLabel="Open brand dashboard"
            testID="social-brand-dashboard-link"
          >
            Brand Dashboard
          </ActionButton>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-3">
              Program overview
            </Text>
            <View className="flex-row flex-wrap -mx-1">
              {[
                {
                  key: "followers",
                  label: "Followers",
                  value: Number(summaryQuery.data?.summary?.totalFollowers || 0).toLocaleString(),
                },
                {
                  key: "platforms",
                  label: "Platforms",
                  value: String(summaryQuery.data?.summary?.connectedPlatforms || 0),
                },
                {
                  key: "views",
                  label: "V/MO",
                  value: Number(summaryQuery.data?.summary?.avgViewsPerMonth || 0).toLocaleString(),
                },
                {
                  key: "active",
                  label: "Active Members",
                  value: String(summaryQuery.data?.summary?.activeMembers || 0),
                },
                {
                  key: "paused",
                  label: "Paused",
                  value: String(summaryQuery.data?.summary?.pausedMembers || 0),
                },
                {
                  key: "violations",
                  label: "Open Concerns",
                  value: String(summaryQuery.data?.summary?.openViolations || 0),
                },
                {
                  key: "matched-posts",
                  label: "Matched Posts",
                  value: String(summaryQuery.data?.summary?.matchedPosts || 0),
                },
                {
                  key: "review-posts",
                  label: "Needs Review",
                  value: String(summaryQuery.data?.summary?.postsNeedingReview || 0),
                },
                {
                  key: "rejected-posts",
                  label: "Rejected Posts",
                  value: String(summaryQuery.data?.summary?.rejectedPosts || 0),
                },
              ].map((item) => (
                <View key={item.key} className="w-1/2 px-1 mb-2">
                  <View className="border border-border rounded-lg px-3 py-2">
                    <Text className="text-[11px] text-muted">{item.label}</Text>
                    <Text className="text-base font-semibold text-foreground mt-0.5">
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Campaign compliance snapshot
            </Text>
            <Text className="text-sm text-muted mb-3">
              Attribution-backed post states across all social campaigns.
            </Text>
            <View className="flex-row">
              <View className="flex-1 mr-2 border border-border rounded-lg px-3 py-2">
                <Text className="text-xs text-muted">Matched</Text>
                <Text className="text-base font-semibold text-foreground">
                  {Number(summaryQuery.data?.summary?.matchedPosts || 0).toLocaleString()}
                </Text>
              </View>
              <View className="flex-1 mx-2 border border-border rounded-lg px-3 py-2">
                <Text className="text-xs text-muted">Needs review</Text>
                <Text className="text-base font-semibold text-foreground">
                  {Number(summaryQuery.data?.summary?.postsNeedingReview || 0).toLocaleString()}
                </Text>
              </View>
              <View className="flex-1 ml-2 border border-border rounded-lg px-3 py-2">
                <Text className="text-xs text-muted">Rejected</Text>
                <Text className="text-base font-semibold text-foreground">
                  {Number(summaryQuery.data?.summary?.rejectedPosts || 0).toLocaleString()}
                </Text>
              </View>
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-semibold text-foreground">
                Payout KYC
              </Text>
              <ActionButton
                size="sm"
                variant="secondary"
                onPress={() =>
                  router.push(
                    (roleLabel === "Manager"
                      ? "/(manager)/kyc-management"
                      : "/(coordinator)/kyc-management") as any,
                  )
                }
                accessibilityRole="button"
                accessibilityLabel="Open payout KYC management"
                testID="social-open-kyc-management"
              >
                Open queue
              </ActionButton>
            </View>
            <Text className="text-sm text-muted mb-3">
              Manual payout onboarding and Adyen verification tracking.
            </Text>
            <View className="flex-row flex-wrap -mx-1">
              {[
                {
                  key: "awaiting-office",
                  label: "Awaiting office",
                  value: Number(kycSummaryQuery.data?.awaitingOffice || 0),
                },
                {
                  key: "under-review",
                  label: "Under review",
                  value: Number(kycSummaryQuery.data?.underReview || 0),
                },
                {
                  key: "action-required",
                  label: "Action required",
                  value: Number(kycSummaryQuery.data?.actionRequired || 0),
                },
                {
                  key: "active",
                  label: "Active",
                  value: Number(kycSummaryQuery.data?.active || 0),
                },
              ].map((item) => (
                <View key={item.key} className="w-1/2 px-1 mb-2">
                  <View className="border border-border rounded-lg px-3 py-2">
                    <Text className="text-[11px] text-muted">{item.label}</Text>
                    <Text className="text-base font-semibold text-foreground mt-0.5">
                      {item.value.toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Top performers
            </Text>
            {(summaryQuery.data?.topPerformers || []).length === 0 ? (
              <Text className="text-sm text-muted">No performance data yet.</Text>
            ) : (
              (summaryQuery.data?.topPerformers || []).slice(0, 8).map((row) => (
                <View
                  key={row.trainerId}
                  className="flex-row items-center justify-between border-b border-border py-2"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-semibold text-foreground">
                      {row.name || "Trainer"}
                    </Text>
                    <Text className="text-xs text-muted">
                      Followers {Number(row.followerCount || 0).toLocaleString()} • Views{" "}
                      {Number(row.avgViewsPerMonth || 0).toLocaleString()}
                    </Text>
                  </View>
                  <Text className="text-xs text-muted">
                    ER {(Number(row.avgEngagementRate || 0) * 100).toFixed(1)}%
                  </Text>
                </View>
              ))
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Concerns / Violations
            </Text>
            {(summaryQuery.data?.openViolations || []).length === 0 ? (
              <Text className="text-sm text-muted">No open concerns.</Text>
            ) : (
              (summaryQuery.data?.openViolations || []).slice(0, 10).map((row) => (
                <View key={row.id} className="border border-border rounded-lg px-3 py-2 mb-2">
                  <Text className="text-sm font-semibold text-foreground">
                    {row.trainerName || "Trainer"} •{" "}
                    {String(row.type || "concern").replace(/_/g, " ")}
                  </Text>
                  <Text className="text-xs text-muted mt-0.5">{row.message}</Text>
                </View>
              ))
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Member management
            </Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search members..."
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: Platform.OS === "ios" ? 10 : 8,
                color: colors.foreground,
                marginBottom: 10,
              }}
              accessibilityLabel="Search social members"
              testID="social-members-search"
            />
            <View className="flex-row flex-wrap gap-2 mb-2">
              {(["all", "active", "invited", "paused", "banned", "declined"] as const).map(
                (status) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setSelectedStatus(status)}
                    style={{
                      borderWidth: 1,
                      borderColor:
                        selectedStatus === status ? colors.primary : colors.border,
                      backgroundColor:
                        selectedStatus === status ? `${colors.primary}22` : colors.surface,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter ${status}`}
                    testID={`social-filter-${status}`}
                  >
                    <Text
                      style={{
                        color:
                          selectedStatus === status ? colors.primary : colors.foreground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>
            {(membersQuery.data || []).slice(0, 60).map((member) => (
              <View
                key={member.id}
                className="border border-border rounded-lg px-3 py-2 mb-2"
              >
                <Text className="text-sm font-semibold text-foreground">
                  {member.trainer?.name || "Trainer"}
                </Text>
                <Text className="text-xs text-muted mt-0.5">
                  {member.trainer?.email || "No email"} •{" "}
                  <Text className="capitalize">{member.status}</Text>
                </Text>
                <Text className="text-xs text-muted mt-0.5">
                  Payout KYC:{" "}
                  <Text className="text-foreground">
                    {kycStatusByTrainerId.get(member.trainerId) || "Not Started"}
                  </Text>
                </Text>
                <Text className="text-xs text-muted mt-0.5">
                  Followers:{" "}
                  {Number(member.profile?.followerCount || 0).toLocaleString()} • Avg
                  views: {Number(member.profile?.avgViewsPerMonth || 0).toLocaleString()}
                </Text>
                <View className="flex-row gap-2 mt-2">
                  <ActionButton
                    className="flex-1"
                    size="sm"
                    variant="secondary"
                    onPress={() =>
                      statusMutation.mutate({
                        trainerId: member.trainerId,
                        status: "paused",
                        reason: "Paused by management",
                      })
                    }
                    loading={
                      statusMutation.isPending &&
                      statusMutation.variables?.trainerId === member.trainerId &&
                      statusMutation.variables?.status === "paused"
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Pause ${member.trainer?.name || "trainer"}`}
                    testID={`social-pause-${member.trainerId}`}
                  >
                    Pause
                  </ActionButton>
                  <ActionButton
                    className="flex-1"
                    size="sm"
                    variant="danger"
                    onPress={() =>
                      statusMutation.mutate({
                        trainerId: member.trainerId,
                        status: "banned",
                        reason: "Banned by management",
                      })
                    }
                    loading={
                      statusMutation.isPending &&
                      statusMutation.variables?.trainerId === member.trainerId &&
                      statusMutation.variables?.status === "banned"
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Ban ${member.trainer?.name || "trainer"}`}
                    testID={`social-ban-${member.trainerId}`}
                  >
                    Ban
                  </ActionButton>
                  <ActionButton
                    className="flex-1"
                    size="sm"
                    onPress={() =>
                      statusMutation.mutate({
                        trainerId: member.trainerId,
                        status: "active",
                        reason: null as any,
                      })
                    }
                    loading={
                      statusMutation.isPending &&
                      statusMutation.variables?.trainerId === member.trainerId &&
                      statusMutation.variables?.status === "active"
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Activate ${member.trainer?.name || "trainer"}`}
                    testID={`social-active-${member.trainerId}`}
                  >
                    Activate
                  </ActionButton>
                </View>
              </View>
            ))}
          </SurfaceCard>
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={() => setShowInviteModal(true)}
        style={{
          position: "absolute",
          right: 18,
          bottom: 28,
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: "#2563EB",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityRole="button"
        accessibilityLabel="Invite trainer to social program"
        testID="social-invite-fab"
      >
        <IconSymbol name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <Pressable
          onPress={() => setShowInviteModal(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              maxHeight: "85%",
            }}
          >
            <Text className="text-base font-semibold text-foreground mb-2">
              Invite trainers
            </Text>
            <TextInput
              value={inviteQuery}
              onChangeText={setInviteQuery}
              placeholder="Search trainers..."
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: Platform.OS === "ios" ? 10 : 8,
                color: colors.foreground,
                marginBottom: 10,
              }}
              accessibilityLabel="Search trainer list"
              testID="social-invite-search"
            />
            <FlatList
              data={eligibleRows}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View className="border border-border rounded-lg px-3 py-2 mb-2">
                  <Text className="text-sm font-semibold text-foreground">
                    {item.name || "Trainer"}
                  </Text>
                  <Text className="text-xs text-muted mt-0.5">{item.email || "No email"}</Text>
                  <ActionButton
                    className="mt-2"
                    size="sm"
                    onPress={() =>
                      inviteMutation.mutate(
                        {
                          trainerId: item.id,
                        },
                        {
                          onSuccess: () => {
                            setShowInviteModal(false);
                            setInviteQuery("");
                          },
                        },
                      )
                    }
                    loading={
                      inviteMutation.isPending &&
                      inviteMutation.variables?.trainerId === item.id
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Invite ${item.name || "trainer"} to social program`}
                    testID={`social-invite-${item.id}`}
                  >
                    Invite
                  </ActionButton>
                </View>
              )}
              ListEmptyComponent={
                (isEligibleProcedureMissing ? eligibleFallbackQuery.isFetching : eligibleQuery.isFetching) ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text className="text-sm text-muted mt-2">Loading trainers...</Text>
                  </View>
                ) : (isEligibleProcedureMissing ? eligibleFallbackQuery.error : eligibleQuery.error) ? (
                  <View className="py-4">
                    <Text className="text-sm text-error">
                      Unable to load trainers.{" "}
                      {String(
                        (isEligibleProcedureMissing
                          ? eligibleFallbackQuery.error?.message
                          : eligibleQuery.error?.message) || "",
                      )}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-sm text-muted py-4">
                    No eligible trainers found.
                  </Text>
                )
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
