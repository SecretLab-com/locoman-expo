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

type SocialMemberRow = {
  id: string;
  trainerId: string;
  status: string;
  reason?: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
  pausedAt?: string | null;
  bannedAt?: string | null;
  updatedAt?: string | null;
  trainer?: {
    name?: string | null;
    email?: string | null;
  } | null;
  profile?: {
    followerCount?: number | null;
    avgViewsPerMonth?: number | null;
  } | null;
};

type MemberSortOption = "subscribers" | "views" | "name";

function formatMemberStatusLabel(status: string | null | undefined) {
  const value = String(status || "").trim().replace(/_/g, " ");
  if (!value) return "Unknown";
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function sortSocialMembers(rows: SocialMemberRow[], sort: MemberSortOption) {
  return [...rows].sort((left, right) => {
    if (sort === "name") {
      return String(left.trainer?.name || "").localeCompare(
        String(right.trainer?.name || ""),
      );
    }

    if (sort === "views") {
      const viewDelta =
        Number(right.profile?.avgViewsPerMonth || 0) -
        Number(left.profile?.avgViewsPerMonth || 0);
      if (viewDelta !== 0) return viewDelta;
    }

    const subscriberDelta =
      Number(right.profile?.followerCount || 0) -
      Number(left.profile?.followerCount || 0);
    if (subscriberDelta !== 0) return subscriberDelta;

    return String(left.trainer?.name || "").localeCompare(
      String(right.trainer?.name || ""),
    );
  });
}

export function SocialManagementScreen({ roleLabel }: Props) {
  const colors = useColors();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showExistingMembers, setShowExistingMembers] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [debouncedInviteQuery, setDebouncedInviteQuery] = useState("");
  const [selectedSort, setSelectedSort] =
    useState<MemberSortOption>("subscribers");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberSnapshot, setSelectedMemberSnapshot] =
    useState<SocialMemberRow | null>(null);
  const [operationFeedback, setOperationFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<
    "all" | "invited" | "active" | "paused" | "banned" | "declined"
  >("all");

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteQuery("");
    setDebouncedInviteQuery("");
    setShowExistingMembers(false);
  };

  const closeManageModal = () => {
    setShowManageModal(false);
  };

  const closeMemberModal = () => {
    setSelectedMemberId(null);
    setSelectedMemberSnapshot(null);
  };

  const openMemberModal = (member: SocialMemberRow) => {
    setSelectedMemberId(member.trainerId);
    setSelectedMemberSnapshot(member);
  };

  useEffect(() => {
    if (!showInviteModal) {
      setDebouncedInviteQuery("");
      return;
    }
    const timeout = setTimeout(() => {
      setDebouncedInviteQuery(inviteQuery);
    }, 250);
    return () => clearTimeout(timeout);
  }, [inviteQuery, showInviteModal]);

  const summaryQuery = trpc.socialProgram.managementSummary.useQuery();
  const kycSummaryQuery = trpc.payments.kycSummary.useQuery();
  const kycRequestsQuery = trpc.payments.listOnboardingRequests.useQuery({
    status: "all",
    limit: 500,
  });
  const socialNotificationsQuery = trpc.socialProgram.myNotifications.useQuery({
    limit: 50,
  });
  const membersQuery = trpc.socialProgram.listMembers.useQuery({
    status: selectedStatus,
    search,
    limit: 500,
  });
  const allMembersQuery = trpc.socialProgram.listMembers.useQuery({
    status: "all",
    search: "",
    limit: 500,
  });
  const eligibleQuery = trpc.socialProgram.listEligibleTrainers.useQuery(
    {
      search: debouncedInviteQuery,
      limit: 300,
    },
    {
      enabled: showInviteModal,
    },
  );
  const isEligibleProcedureMissing = String(eligibleQuery.error?.message || "").includes(
    'No procedure found on path "socialProgram.listEligibleTrainers"',
  );
  const eligibleFallbackQuery = trpc.admin.usersWithFilters.useQuery(
    {
      role: "trainer",
      status: "active",
      search: debouncedInviteQuery || undefined,
      limit: 300,
      offset: 0,
    },
    {
      enabled: showInviteModal && isEligibleProcedureMissing,
    },
  );

  const inviteMutation = trpc.socialProgram.inviteTrainer.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.managementSummary.invalidate(),
        utils.socialProgram.listMembers.invalidate(),
        utils.socialProgram.listEligibleTrainers.invalidate(),
        utils.socialProgram.membershipByTrainerIds.invalidate(),
        utils.admin.activityFeed.invalidate(),
      ]);
    },
  });

  const statusMutation = trpc.socialProgram.setMemberStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.managementSummary.invalidate(),
        utils.socialProgram.listMembers.invalidate(),
        utils.socialProgram.listEligibleTrainers.invalidate(),
        utils.socialProgram.membershipByTrainerIds.invalidate(),
        utils.admin.activityFeed.invalidate(),
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
        !["active", "paused"].includes(
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
  const matchingExistingMembers = useMemo(() => {
    const query = debouncedInviteQuery.trim().toLowerCase();
    if (!query) return [];
    return ((allMembersQuery.data || []) as SocialMemberRow[]).filter((member) => {
      const name = String(member.trainer?.name || "").toLowerCase();
      const email = String(member.trainer?.email || "").toLowerCase();
      const status = String(member.status || "").toLowerCase();
      return (
        name.includes(query) ||
        email.includes(query) ||
        formatMemberStatusLabel(status).toLowerCase().includes(query)
      );
    });
  }, [allMembersQuery.data, debouncedInviteQuery]);
  const isEligibleLoading =
    showInviteModal &&
    (isEligibleProcedureMissing ? eligibleFallbackQuery.isLoading : eligibleQuery.isLoading);
  const isEligibleFetching =
    showInviteModal &&
    (isEligibleProcedureMissing ? eligibleFallbackQuery.isFetching : eligibleQuery.isFetching);
  const eligibleError = isEligibleProcedureMissing
    ? eligibleFallbackQuery.error
    : eligibleQuery.error;
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
  const recentAccountConflictNotifications = useMemo(
    () =>
      (socialNotificationsQuery.data || [])
        .filter(
          (notification) =>
            String(notification.metadata?.eventType || "") === "social_program.account_conflict",
        )
        .slice(0, 6),
    [socialNotificationsQuery.data],
  );
  const visibleMembers = useMemo(() => {
    const members = (membersQuery.data || []) as SocialMemberRow[];
    return members.filter((member) => {
      const memberStatus = String(member.status || "").toLowerCase();
      if (selectedStatus === "all") {
        return memberStatus !== "banned" && memberStatus !== "uninvited";
      }
      return memberStatus === selectedStatus;
    });
  }, [membersQuery.data, selectedStatus]);
  const sortedVisibleMembers = useMemo(
    () => sortSocialMembers(visibleMembers, selectedSort),
    [selectedSort, visibleMembers],
  );
  const topSocialMembers = useMemo(() => {
    const members = ((allMembersQuery.data || []) as SocialMemberRow[]).filter(
      (member) => {
        const status = String(member.status || "").toLowerCase();
        return (
          status !== "banned" &&
          status !== "declined" &&
          status !== "uninvited"
        );
      },
    );
    return sortSocialMembers(members, "subscribers").slice(0, 10);
  }, [allMembersQuery.data]);
  const memberByTrainerId = useMemo(() => {
    const rows = [
      ...((allMembersQuery.data || []) as SocialMemberRow[]),
      ...((membersQuery.data || []) as SocialMemberRow[]),
    ];
    return new Map(rows.map((row) => [row.trainerId, row]));
  }, [allMembersQuery.data, membersQuery.data]);
  const selectedMember =
    (selectedMemberId ? memberByTrainerId.get(selectedMemberId) : null) ||
    selectedMemberSnapshot;

  useEffect(() => {
    if (!operationFeedback) return;
    const timeout = setTimeout(() => setOperationFeedback(null), 6000);
    return () => clearTimeout(timeout);
  }, [operationFeedback]);

  const handleInviteTrainer = (item: {
    id: string;
    name: string | null;
  }) => {
    setOperationFeedback(null);
    inviteMutation.mutate(
      {
        trainerId: item.id,
      },
      {
        onSuccess: () => {
          closeInviteModal();
          setSelectedMemberSnapshot((current) =>
            current && current.trainerId === item.id
              ? { ...current, status: "invited", reason: null }
              : current,
          );
          setOperationFeedback({
            tone: "success",
            message: `${item.name || "Trainer"} invited to Social Posts.`,
          });
        },
        onError: (error) => {
          setOperationFeedback({
            tone: "error",
            message: String(error.message || "Could not send the social invite."),
          });
        },
      },
    );
  };

  const handleSetMemberStatus = (
    member: SocialMemberRow,
    status: "active" | "paused" | "banned",
  ) => {
    const trainerName = member.trainer?.name || "Trainer";
    const reason =
      status === "paused"
        ? "Paused by management"
        : status === "banned"
          ? "Removed from Social Posts by management"
          : undefined;
    setOperationFeedback(null);
    statusMutation.mutate(
      {
        trainerId: member.trainerId,
        status,
        reason,
      },
      {
        onSuccess: (result) => {
          const effectiveStatus = String((result as any)?.effectiveStatus || status);
          setSelectedMemberSnapshot((current) =>
            current && current.trainerId === member.trainerId
              ? {
                  ...current,
                  status: effectiveStatus,
                  reason,
                }
              : current,
          );
          setOperationFeedback({
            tone: "success",
            message:
              effectiveStatus === "uninvited"
                ? `${trainerName} was removed from Social Posts and reset to not invited.`
                : status === "paused"
                  ? `${trainerName} was paused successfully.`
                  : `${trainerName} is now active in Social Posts.`,
          });
        },
        onError: (error) => {
          setOperationFeedback({
            tone: "error",
            message: String(error.message || `Could not update ${trainerName}.`),
          });
        },
      },
    );
  };

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

          {operationFeedback ? (
            <SurfaceCard
              style={{
                borderColor:
                  operationFeedback.tone === "success"
                    ? "rgba(52,211,153,0.35)"
                    : "rgba(239,68,68,0.35)",
                backgroundColor:
                  operationFeedback.tone === "success"
                    ? "rgba(52,211,153,0.10)"
                    : "rgba(239,68,68,0.10)",
              }}
            >
              <Text
                className="text-sm font-semibold"
                style={{
                  color: operationFeedback.tone === "success" ? "#34D399" : "#EF4444",
                }}
              >
                {operationFeedback.tone === "success" ? "Updated" : "Action failed"}
              </Text>
              <Text className="text-sm mt-1 text-foreground">{operationFeedback.message}</Text>
            </SurfaceCard>
          ) : null}

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
              Top social members
            </Text>
            <View className="flex-row items-start justify-between mb-3">
              <Text className="text-sm text-muted flex-1 pr-3">
                Top 10 current social members by subscribers. Tap a member to see
                details and actions.
              </Text>
              <ActionButton
                size="sm"
                variant="secondary"
                onPress={() => setShowManageModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Manage social members"
                testID="social-members-manage"
              >
                Manage
              </ActionButton>
            </View>
            {allMembersQuery.isLoading ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : topSocialMembers.length === 0 ? (
              <Text className="text-sm text-muted">No social members yet.</Text>
            ) : (
              topSocialMembers.map((member, index) => (
                <TouchableOpacity
                  key={member.id}
                  onPress={() => openMemberModal(member)}
                  className="flex-row items-center border-b border-border py-3"
                  accessibilityRole="button"
                  accessibilityLabel={`View social member details for ${member.trainer?.name || "trainer"}`}
                  testID={`social-top-member-${member.trainerId}`}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: `${colors.primary}16`,
                      marginRight: 12,
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: colors.primary }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-semibold text-foreground">
                      {member.trainer?.name || "Trainer"}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      {Number(member.profile?.followerCount || 0).toLocaleString()}{" "}
                      subscribers
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      {formatMemberStatusLabel(member.status)} • Avg views{" "}
                      {Number(member.profile?.avgViewsPerMonth || 0).toLocaleString()}
                    </Text>
                  </View>
                  <IconSymbol
                    name="chevron.right"
                    size={16}
                    color={colors.muted}
                  />
                </TouchableOpacity>
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
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-semibold text-foreground">
                Account conflict audit
              </Text>
              {recentAccountConflictNotifications.length > 0 ? (
                <Text className="text-xs text-muted">
                  {recentAccountConflictNotifications.length} recent
                </Text>
              ) : null}
            </View>
            <Text className="text-sm text-muted mb-3">
              Blocked duplicate social-account connection attempts across trainers.
            </Text>
            {socialNotificationsQuery.isLoading ? (
              <Text className="text-sm text-muted">Loading audit alerts...</Text>
            ) : recentAccountConflictNotifications.length === 0 ? (
              <Text className="text-sm text-muted">
                No recent duplicate-account conflicts.
              </Text>
            ) : (
              recentAccountConflictNotifications.map((notification) => {
                const trainerName =
                  String(notification.metadata?.conflictingTrainerName || "").trim() ||
                  String(notification.metadata?.conflictingTrainerEmail || "").trim() ||
                  "another trainer";
                const platform = String(notification.metadata?.platform || "").trim();
                const identityValue = String(notification.metadata?.identityValue || "").trim();
                return (
                  <View
                    key={notification.id}
                    className="border border-border rounded-lg px-3 py-2 mb-2"
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {notification.title}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">{notification.body}</Text>
                    <Text className="text-[11px] text-muted mt-1">
                      {new Date(notification.createdAt).toLocaleString()}{" "}
                      {platform ? `• ${platform}` : ""} {identityValue ? `• ${identityValue}` : ""}
                    </Text>
                    <Text className="text-[11px] text-muted mt-0.5">
                      Existing owner: <Text className="text-foreground">{trainerName}</Text>
                    </Text>
                  </View>
                );
              })
            )}
          </SurfaceCard>

        </View>
      </ScrollView>

      <Modal
        visible={showManageModal}
        animationType="slide"
        transparent
        onRequestClose={closeManageModal}
      >
        <Pressable
          onPress={closeManageModal}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 16,
              maxHeight: "88%",
            }}
          >
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-1 pr-3">
                <Text className="text-base font-semibold text-foreground">
                  Manage social members
                </Text>
                <Text className="text-sm text-muted mt-1">
                  Search, sort, and filter the full member list.
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeManageModal}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
                accessibilityRole="button"
                accessibilityLabel="Close social member management"
                testID="social-manage-close"
              >
                <IconSymbol name="xmark" size={14} color={colors.foreground} />
              </TouchableOpacity>
            </View>

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
                marginBottom: 12,
              }}
              accessibilityLabel="Search social members"
              testID="social-members-search"
            />

            <Text className="text-xs font-semibold text-muted mb-2">Sort</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
              {(
                [
                  { value: "subscribers", label: "Subscribers" },
                  { value: "views", label: "Views" },
                  { value: "name", label: "Name" },
                ] as const
              ).map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setSelectedSort(option.value)}
                  style={{
                    borderWidth: 1,
                    borderColor:
                      selectedSort === option.value ? colors.primary : colors.border,
                    backgroundColor:
                      selectedSort === option.value
                        ? `${colors.primary}22`
                        : colors.surface,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Sort members by ${option.label}`}
                  testID={`social-sort-${option.value}`}
                >
                  <Text
                    style={{
                      color:
                        selectedSort === option.value
                          ? colors.primary
                          : colors.foreground,
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xs font-semibold text-muted mb-2">Filter</Text>
            <View className="flex-row flex-wrap gap-2 mb-3">
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
                      {formatMemberStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {membersQuery.isLoading ? (
                <View className="py-6 items-center">
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : sortedVisibleMembers.length === 0 ? (
                <Text className="text-sm text-muted py-2">
                  No members match this filter.
                </Text>
              ) : (
                sortedVisibleMembers.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    onPress={() => openMemberModal(member)}
                    className="border border-border rounded-lg px-3 py-3 mb-2"
                    accessibilityRole="button"
                    accessibilityLabel={`View social member details for ${member.trainer?.name || "trainer"}`}
                    testID={`social-member-row-${member.trainerId}`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-sm font-semibold text-foreground">
                          {member.trainer?.name || "Trainer"}
                        </Text>
                        <Text className="text-xs text-muted mt-0.5">
                          {member.trainer?.email || "No email"} •{" "}
                          {formatMemberStatusLabel(member.status)}
                        </Text>
                        <Text className="text-xs text-muted mt-0.5">
                          {Number(member.profile?.followerCount || 0).toLocaleString()}{" "}
                          subscribers • Avg views{" "}
                          {Number(member.profile?.avgViewsPerMonth || 0).toLocaleString()}
                        </Text>
                      </View>
                      <IconSymbol
                        name="chevron.right"
                        size={16}
                        color={colors.muted}
                      />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(selectedMember)}
        animationType="slide"
        transparent
        onRequestClose={closeMemberModal}
      >
        <Pressable
          onPress={closeMemberModal}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              padding: 16,
              maxHeight: "88%",
            }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-semibold text-foreground">
                    {selectedMember?.trainer?.name || "Trainer"}
                  </Text>
                  <Text className="text-sm text-muted mt-1">
                    {selectedMember?.trainer?.email || "No email"} •{" "}
                    {formatMemberStatusLabel(selectedMember?.status)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={closeMemberModal}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Close social member details"
                  testID="social-member-close"
                >
                  <IconSymbol name="xmark" size={14} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <SurfaceCard className="mb-3">
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Member details
                </Text>
                {[
                  {
                    label: "Status",
                    value: formatMemberStatusLabel(selectedMember?.status),
                  },
                  {
                    label: "Subscribers",
                    value: Number(
                      selectedMember?.profile?.followerCount || 0,
                    ).toLocaleString(),
                  },
                  {
                    label: "Avg views / month",
                    value: Number(
                      selectedMember?.profile?.avgViewsPerMonth || 0,
                    ).toLocaleString(),
                  },
                  {
                    label: "Payout KYC",
                    value:
                      kycStatusByTrainerId.get(selectedMember?.trainerId || "") ||
                      "Not Started",
                  },
                ].map((row) => (
                  <View
                    key={row.label}
                    className="flex-row items-center justify-between mb-2"
                  >
                    <Text className="text-sm text-muted">{row.label}</Text>
                    <Text className="text-sm text-foreground font-medium">
                      {row.value}
                    </Text>
                  </View>
                ))}
              </SurfaceCard>

              {selectedMember?.reason ? (
                <SurfaceCard className="mb-3">
                  <Text className="text-sm font-semibold text-foreground mb-1">
                    Management note
                  </Text>
                  <Text className="text-sm text-muted">{selectedMember.reason}</Text>
                </SurfaceCard>
              ) : null}

              <SurfaceCard>
                <Text className="text-sm font-semibold text-foreground mb-3">
                  Actions
                </Text>
                {["banned", "declined"].includes(
                  String(selectedMember?.status || "").toLowerCase(),
                ) ? (
                  <ActionButton
                    onPress={() =>
                      selectedMember
                        ? handleInviteTrainer({
                            id: selectedMember.trainerId,
                            name: selectedMember.trainer?.name || null,
                          })
                        : undefined
                    }
                    loading={
                      inviteMutation.isPending &&
                      inviteMutation.variables?.trainerId === selectedMember?.trainerId
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Re-invite ${selectedMember?.trainer?.name || "trainer"} to social program`}
                    testID={`social-reinvite-${selectedMember?.trainerId || "member"}`}
                  >
                    Re-invite to program
                  </ActionButton>
                ) : (
                  <View className="gap-2">
                    {String(selectedMember?.status || "").toLowerCase() !== "active" ? (
                      <ActionButton
                        onPress={() =>
                          selectedMember
                            ? handleSetMemberStatus(selectedMember, "active")
                            : undefined
                        }
                        loading={
                          statusMutation.isPending &&
                          statusMutation.variables?.trainerId === selectedMember?.trainerId &&
                          statusMutation.variables?.status === "active"
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Activate ${selectedMember?.trainer?.name || "trainer"}`}
                        testID={`social-active-${selectedMember?.trainerId || "member"}`}
                      >
                        Activate
                      </ActionButton>
                    ) : null}
                    {String(selectedMember?.status || "").toLowerCase() !== "paused" ? (
                      <ActionButton
                        variant="secondary"
                        onPress={() =>
                          selectedMember
                            ? handleSetMemberStatus(selectedMember, "paused")
                            : undefined
                        }
                        loading={
                          statusMutation.isPending &&
                          statusMutation.variables?.trainerId === selectedMember?.trainerId &&
                          statusMutation.variables?.status === "paused"
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Pause ${selectedMember?.trainer?.name || "trainer"}`}
                        testID={`social-pause-${selectedMember?.trainerId || "member"}`}
                      >
                        Pause
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      variant="danger"
                      onPress={() =>
                        selectedMember
                          ? handleSetMemberStatus(selectedMember, "banned")
                          : undefined
                      }
                      loading={
                        statusMutation.isPending &&
                        statusMutation.variables?.trainerId === selectedMember?.trainerId &&
                        statusMutation.variables?.status === "banned"
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${selectedMember?.trainer?.name || "trainer"} from social program`}
                      testID={`social-ban-${selectedMember?.trainerId || "member"}`}
                    >
                      Remove from program
                    </ActionButton>
                  </View>
                )}
              </SurfaceCard>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
        onRequestClose={closeInviteModal}
      >
        <Pressable
          onPress={closeInviteModal}
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
            {matchingExistingMembers.length > 0 ? (
              <>
                <TouchableOpacity
                  onPress={() => setShowExistingMembers((current) => !current)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.warning,
                    backgroundColor: `${colors.warning}18`,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Toggle already members list"
                  testID="social-existing-members-toggle"
                >
                  <IconSymbol
                    name="person.2.fill"
                    size={16}
                    color={colors.warning}
                  />
                  <Text
                    style={{
                      color: colors.warning,
                      marginLeft: 8,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {matchingExistingMembers.length} Already Member
                    {matchingExistingMembers.length === 1 ? "" : "s"}
                  </Text>
                  <IconSymbol
                    name={showExistingMembers ? "chevron.up" : "chevron.down"}
                    size={14}
                    color={colors.warning}
                    style={{ marginLeft: "auto" }}
                  />
                </TouchableOpacity>

                {showExistingMembers ? (
                  <View
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      marginBottom: 10,
                    }}
                  >
                    {matchingExistingMembers.map((member, index) => (
                      <TouchableOpacity
                        key={member.id}
                        onPress={() => {
                          closeInviteModal();
                          openMemberModal(member);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 12,
                          borderBottomWidth:
                            index === matchingExistingMembers.length - 1 ? 0 : 1,
                          borderBottomColor: colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Open existing social member ${member.trainer?.name || "trainer"}`}
                        testID={`social-existing-member-${member.trainerId}`}
                      >
                        <View style={{ flex: 1, paddingRight: 12 }}>
                          <Text className="text-sm font-semibold text-foreground">
                            {member.trainer?.name || "Trainer"}
                          </Text>
                          <Text className="text-xs text-muted mt-0.5">
                            {member.trainer?.email || "No email"} •{" "}
                            {formatMemberStatusLabel(member.status)}
                          </Text>
                          <Text className="text-xs text-muted mt-0.5">
                            {Number(member.profile?.followerCount || 0).toLocaleString()}{" "}
                            subscribers
                          </Text>
                        </View>
                        <IconSymbol
                          name="chevron.right"
                          size={16}
                          color={colors.muted}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            <FlatList
              data={eligibleRows}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View className="border border-border rounded-lg px-3 py-2 mb-2">
                  <Text className="text-sm font-semibold text-foreground">
                    {item.name || "Trainer"}
                  </Text>
                  <Text className="text-xs text-muted mt-0.5">{item.email || "No email"}</Text>
                  {item.socialMembership?.status ? (
                    <Text className="text-xs text-muted mt-0.5">
                      Current status:{" "}
                      <Text className="capitalize text-foreground">
                        {String(item.socialMembership.status)}
                      </Text>
                    </Text>
                  ) : null}
                  <ActionButton
                    className="mt-2"
                    size="sm"
                    onPress={() => handleInviteTrainer(item)}
                    loading={
                      inviteMutation.isPending &&
                      inviteMutation.variables?.trainerId === item.id
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Invite ${item.name || "trainer"} to social program`}
                    testID={`social-invite-${item.id}`}
                  >
                    {["banned", "declined"].includes(
                      String(item.socialMembership?.status || "").toLowerCase(),
                    )
                      ? "Re-invite"
                      : "Invite"}
                  </ActionButton>
                </View>
              )}
              ListEmptyComponent={
                isEligibleLoading || isEligibleFetching ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text className="text-sm text-muted mt-2">Loading trainers...</Text>
                  </View>
                ) : eligibleError ? (
                  <View className="py-4">
                    <Text className="text-sm text-error">
                      Unable to load trainers. {String(eligibleError.message || "")}
                    </Text>
                  </View>
                ) : matchingExistingMembers.length > 0 ? (
                  <Text className="text-sm text-muted py-4">
                    No eligible trainers found. Matching existing members are listed above.
                  </Text>
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
