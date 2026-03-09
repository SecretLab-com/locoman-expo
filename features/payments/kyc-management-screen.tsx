import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import {
  getPayoutKycStatusLabel,
  normalizePayoutKycStatus,
  PAYOUT_KYC_STATUS_OPTIONS,
  PAYOUT_KYC_WORKFLOW_STATUSES,
  type PayoutKycStatus,
} from "@/shared/payout-kyc";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function KycManagementScreen({ roleLabel }: Props) {
  const colors = useColors();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<"all" | PayoutKycStatus>("all");
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [blockingReason, setBlockingReason] = useState("");
  const [nextStatus, setNextStatus] = useState<PayoutKycStatus>("details_submitted");

  const summaryQuery = trpc.payments.kycSummary.useQuery();
  const requestsQuery = trpc.payments.listOnboardingRequests.useQuery({
    status: selectedStatus,
    search,
    limit: 250,
  });
  const detailQuery = trpc.payments.getOnboardingRequest.useQuery(
    { trainerId: selectedTrainerId || "" },
    { enabled: Boolean(selectedTrainerId) },
  );

  const statusMutation = trpc.payments.updateOnboardingStatus.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.payments.kycSummary.invalidate(),
        utils.payments.listOnboardingRequests.invalidate(),
        utils.payments.getOnboardingRequest.invalidate(),
      ]);
      setStatusNote("");
      setBlockingReason("");
    },
  });
  const noteMutation = trpc.payments.addOnboardingNote.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.payments.listOnboardingRequests.invalidate(),
        utils.payments.getOnboardingRequest.invalidate(),
      ]);
      setStatusNote("");
    },
  });

  const counts = summaryQuery.data;
  const requestRows = requestsQuery.data || [];
  const detail = detailQuery.data;

  const closeModal = () => {
    setSelectedTrainerId(null);
    setStatusNote("");
    setBlockingReason("");
  };

  const openModal = (trainerId: string, status: PayoutKycStatus) => {
    setSelectedTrainerId(trainerId);
    setNextStatus(status);
    setStatusNote("");
    setBlockingReason("");
  };

  const detailRows = useMemo(
    () =>
      [
        {
          label: "Account holder type",
          value: detail?.onboarding?.accountHolderType
            ? String(detail.onboarding.accountHolderType)
                .charAt(0)
                .toUpperCase() +
              String(detail.onboarding.accountHolderType).slice(1)
            : "—",
        },
        {
          label: "Organization name",
          value: detail?.details?.organizationName || "—",
        },
        {
          label: "Country of registration",
          value: detail?.details?.countryOfRegistration || "—",
        },
        {
          label: "First name",
          value: detail?.details?.firstName || "—",
        },
        {
          label: "Last name",
          value: detail?.details?.lastName || "—",
        },
        {
          label: "Country / region",
          value: detail?.details?.country || "—",
        },
        {
          label: "Contact email",
          value: detail?.details?.contactEmail || detail?.trainer?.email || "—",
        },
        {
          label: "Contact phone",
          value: detail?.details?.contactPhone || detail?.trainer?.phone || "—",
        },
      ].filter(Boolean),
    [detail],
  );

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Payout KYC"
          subtitle={`${roleLabel} workflow for trainer payout onboarding and manual Adyen tracking.`}
          leftSlot={
            <TouchableOpacity
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace(
                      (roleLabel === "Manager"
                        ? "/(manager)/more"
                        : "/(coordinator)/more") as any,
                    )
              }
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID={`kyc-management-back-${roleLabel.toLowerCase()}`}
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          }
        />

        <View className="px-4 pb-24 gap-4">
          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-3">
              KYC overview
            </Text>
            <View className="flex-row flex-wrap -mx-1">
              {[
                { key: "submitted", label: "Submitted", value: counts?.awaitingOffice || 0 },
                { key: "under-review", label: "Under Review", value: counts?.underReview || 0 },
                { key: "action", label: "Action Required", value: counts?.actionRequired || 0 },
                { key: "active", label: "Active", value: counts?.active || 0 },
              ].map((item) => (
                <View key={item.key} className="w-1/2 px-1 mb-2">
                  <View className="border border-border rounded-lg px-3 py-2">
                    <Text className="text-[11px] text-muted">{item.label}</Text>
                    <Text className="text-base font-semibold text-foreground mt-0.5">
                      {Number(item.value || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Requests
            </Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
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
              accessibilityLabel="Search payout KYC requests"
              testID="kyc-management-search"
            />
            <View className="flex-row flex-wrap gap-2 mb-2">
              {PAYOUT_KYC_STATUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setSelectedStatus(option.value)}
                  style={{
                    borderWidth: 1,
                    borderColor:
                      selectedStatus === option.value ? colors.primary : colors.border,
                    backgroundColor:
                      selectedStatus === option.value
                        ? `${colors.primary}22`
                        : colors.surface,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter ${option.label}`}
                  testID={`kyc-filter-${option.value}`}
                >
                  <Text
                    style={{
                      color:
                        selectedStatus === option.value
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
            {requestsQuery.isLoading ? (
              <View className="py-6 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : requestRows.length === 0 ? (
              <Text className="text-sm text-muted py-4">
                No payout onboarding requests found.
              </Text>
            ) : (
              requestRows.map((row) => {
                const status = normalizePayoutKycStatus(
                  row.onboarding.status || "start_setup",
                );
                return (
                  <View
                    key={row.onboarding.id}
                    className="border border-border rounded-lg px-3 py-3 mb-2"
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-sm font-semibold text-foreground">
                          {row.trainer?.name || "Trainer"}
                        </Text>
                        <Text className="text-xs text-muted mt-0.5">
                          {row.trainer?.email || "No email"} • {getPayoutKycStatusLabel(status)}
                        </Text>
                        <Text className="text-xs text-muted mt-1">
                          Submitted: {formatDateLabel(row.onboarding.submittedAt)}
                        </Text>
                      </View>
                      <ActionButton
                        size="sm"
                        variant="secondary"
                        onPress={() => openModal(row.onboarding.trainerId, status)}
                        accessibilityRole="button"
                        accessibilityLabel={`Manage payout onboarding for ${row.trainer?.name || "trainer"}`}
                        testID={`kyc-manage-${row.onboarding.trainerId}`}
                      >
                        Manage
                      </ActionButton>
                    </View>
                  </View>
                );
              })
            )}
          </SurfaceCard>
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selectedTrainerId)}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <Pressable
          onPress={closeModal}
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
              <Text className="text-base font-semibold text-foreground mb-1">
                {detail?.trainer?.name || "Trainer"}
              </Text>
              <Text className="text-sm text-muted mb-3">
                {detail?.trainer?.email || "No email"} •{" "}
                {getPayoutKycStatusLabel(detail?.status || nextStatus)}
              </Text>

              <SurfaceCard className="mb-3">
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Submitted details
                </Text>
                {detailRows.map((row) => (
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

              <SurfaceCard className="mb-3">
                <Text className="text-sm font-semibold text-foreground mb-2">
                  Update status
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {PAYOUT_KYC_WORKFLOW_STATUSES.map((status) => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => setNextStatus(status)}
                      style={{
                        borderWidth: 1,
                        borderColor:
                          nextStatus === status ? colors.primary : colors.border,
                        backgroundColor:
                          nextStatus === status
                            ? `${colors.primary}22`
                            : colors.surface,
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Set status to ${getPayoutKycStatusLabel(status)}`}
                      testID={`kyc-status-option-${status}`}
                    >
                      <Text
                        style={{
                          color:
                            nextStatus === status ? colors.primary : colors.foreground,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {getPayoutKycStatusLabel(status)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={statusNote}
                  onChangeText={setStatusNote}
                  placeholder="Coordinator note"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: Platform.OS === "ios" ? 10 : 8,
                    color: colors.foreground,
                    minHeight: 84,
                    textAlignVertical: "top",
                    marginBottom: 10,
                  }}
                  accessibilityLabel="Coordinator note"
                  testID="kyc-management-note"
                />
                {nextStatus === "more_information_required" ||
                nextStatus === "verification_failed" ||
                nextStatus === "account_rejected" ? (
                  <TextInput
                    value={blockingReason}
                    onChangeText={setBlockingReason}
                    placeholder="Reason shown to trainer"
                    placeholderTextColor={colors.muted}
                    multiline
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: Platform.OS === "ios" ? 10 : 8,
                      color: colors.foreground,
                      minHeight: 72,
                      textAlignVertical: "top",
                      marginBottom: 10,
                    }}
                    accessibilityLabel="Blocking reason"
                    testID="kyc-management-blocking-reason"
                  />
                ) : null}
                <ActionButton
                  onPress={() =>
                    selectedTrainerId &&
                    statusMutation.mutate({
                      trainerId: selectedTrainerId,
                      status: nextStatus,
                      note: statusNote.trim() || undefined,
                      blockingReason: blockingReason.trim() || undefined,
                    })
                  }
                  loading={statusMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Save KYC status update"
                  testID="kyc-management-save-status"
                >
                  Save status update
                </ActionButton>
                <ActionButton
                  className="mt-3"
                  variant="secondary"
                  onPress={() =>
                    selectedTrainerId &&
                    noteMutation.mutate({
                      trainerId: selectedTrainerId,
                      note: statusNote.trim(),
                    })
                  }
                  loading={noteMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Add KYC note"
                  testID="kyc-management-add-note"
                >
                  Add note only
                </ActionButton>
              </SurfaceCard>

              <SurfaceCard>
                <Text className="text-sm font-semibold text-foreground mb-2">
                  History
                </Text>
                {(detail?.events || []).length === 0 ? (
                  <Text className="text-sm text-muted">No activity yet.</Text>
                ) : (
                  (detail?.events || []).map((event) => (
                    <View
                      key={event.id}
                      className="border border-border rounded-lg px-3 py-2 mb-2"
                    >
                      <Text className="text-sm font-semibold text-foreground">
                        {String(event.eventType || "note")
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (char) => char.toUpperCase())}
                      </Text>
                      {event.note ? (
                        <Text className="text-xs text-muted mt-1">{event.note}</Text>
                      ) : null}
                      <Text className="text-[11px] text-muted mt-1">
                        {formatDateLabel(event.createdAt)}
                      </Text>
                    </View>
                  ))
                )}
              </SurfaceCard>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
