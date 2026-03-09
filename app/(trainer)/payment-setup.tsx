import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { haptics } from "@/hooks/use-haptics";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { COUNTRY_OPTIONS } from "@/shared/countries";
import {
  getPayoutKycTrackerState,
  getPayoutKycStatusLabel,
  getPayoutKycTrainerMessage,
  PAYOUT_KYC_TRACKER_STEPS,
  type PayoutKycAccountHolderType,
  type PayoutKycStatus,
} from "@/shared/payout-kyc";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function showAlert(title: string, message: string) {
  Alert.alert(title, message);
}

const STEPS = [
  "Fill in your basic details in the app.",
  "Bright.Blue creates your payout/KYC request manually in Adyen.",
  "Adyen runs verification and can request more information or reject the application.",
  "Once verification passes, the payout account becomes active.",
] as const;

type IntakeFormState = {
  accountHolderType: PayoutKycAccountHolderType;
  organizationName: string;
  countryOfRegistration: string;
  firstName: string;
  lastName: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
};

function getStatusTone(status: PayoutKycStatus, colors: ReturnType<typeof useColors>) {
  switch (status) {
    case "active":
      return {
        color: colors.success,
        background: "rgba(34,197,94,0.12)",
        border: "rgba(34,197,94,0.28)",
        icon: "checkmark.circle.fill" as const,
      };
    case "under_review":
      return {
        color: colors.warning,
        background: "rgba(251,191,36,0.12)",
        border: "rgba(251,191,36,0.28)",
        icon: "clock.fill" as const,
      };
    case "details_submitted":
    case "verification_required":
      return {
        color: colors.primary,
        background: "rgba(96,165,250,0.12)",
        border: "rgba(96,165,250,0.28)",
        icon: "clock.fill" as const,
      };
    case "more_information_required":
      return {
        color: "#F59E0B",
        background: "rgba(245,158,11,0.12)",
        border: "rgba(245,158,11,0.28)",
        icon: "exclamationmark.triangle.fill" as const,
      };
    case "verification_failed":
    case "account_rejected":
      return {
        color: "#EF4444",
        background: "rgba(239,68,68,0.12)",
        border: "rgba(239,68,68,0.28)",
        icon: "exclamationmark.triangle.fill" as const,
      };
    case "start_setup":
    default:
      return {
        color: colors.primary,
        background: "rgba(96,165,250,0.12)",
        border: "rgba(96,165,250,0.28)",
        icon: "arrow.right" as const,
      };
  }
}

function buildInitialForm(data: any): IntakeFormState {
  return {
    accountHolderType:
      data?.onboarding?.accountHolderType === "organization"
        ? "organization"
        : "individual",
    organizationName: String(data?.details?.organizationName || ""),
    countryOfRegistration: String(data?.details?.countryOfRegistration || ""),
    firstName: String(data?.details?.firstName || ""),
    lastName: String(data?.details?.lastName || ""),
    country: String(data?.details?.country || ""),
    contactEmail: String(
      data?.details?.contactEmail || data?.trainer?.email || "",
    ),
    contactPhone: String(
      data?.details?.contactPhone || data?.trainer?.phone || "",
    ),
  };
}

function CountryPickerField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold text-foreground mb-2">{label}</Text>
      <TouchableOpacity
        onPress={onPress}
        className="rounded-xl border border-border bg-surface px-4 py-3 flex-row items-center justify-between"
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text className={value ? "text-foreground" : "text-muted"}>
          {value || placeholder}
        </Text>
        <IconSymbol name="chevron.down" size={14} color="#94A3B8" />
      </TouchableOpacity>
    </View>
  );
}

export default function PaymentSetupScreen() {
  const colors = useColors();
  const utils = trpc.useUtils();
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = trpc.payments.getOnboardingStatus.useQuery();
  const submitMutation = trpc.payments.submitOnboardingIntake.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.payments.getOnboardingStatus.invalidate(),
        utils.payments.payoutSetup.invalidate(),
        utils.payments.payoutSummary.invalidate(),
      ]);
      setShowEditForm(false);
    },
    onError: (error) => {
      showAlert("Unable to submit", error.message || "Please try again.");
    },
  });
  const updateMutation = trpc.payments.updateOnboardingIntake.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.payments.getOnboardingStatus.invalidate(),
        utils.payments.payoutSetup.invalidate(),
        utils.payments.payoutSummary.invalidate(),
      ]);
      setShowEditForm(false);
    },
    onError: (error) => {
      showAlert("Unable to update", error.message || "Please try again.");
    },
  });
  const [form, setForm] = useState<IntakeFormState>({
    accountHolderType: "individual",
    organizationName: "",
    countryOfRegistration: "",
    firstName: "",
    lastName: "",
    country: "",
    contactEmail: "",
    contactPhone: "",
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [countryTarget, setCountryTarget] = useState<
    "country" | "countryOfRegistration" | null
  >(null);
  const [countrySearch, setCountrySearch] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm(buildInitialForm(data));
  }, [data]);

  const status = (data?.status || "start_setup") as PayoutKycStatus;
  const canEdit = Boolean(data?.canEditIntake);
  const canRequestPayments = Boolean(data?.canRequestPayments);
  const statusTone = getStatusTone(status, colors);
  const isSaving = submitMutation.isPending || updateMutation.isPending;
  const shouldShowForm = status === "start_setup" || showEditForm;
  const visibleCountries = useMemo(() => {
    const search = countrySearch.trim().toLowerCase();
    if (!search) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((country) =>
      country.toLowerCase().includes(search),
    );
  }, [countrySearch]);

  const setFormValue = <K extends keyof IntakeFormState>(
    key: K,
    value: IntakeFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    await haptics.light();
    const payload = {
      accountHolderType: form.accountHolderType,
      organizationName: form.organizationName,
      countryOfRegistration: form.countryOfRegistration,
      firstName: form.firstName,
      lastName: form.lastName,
      country: form.country,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
    };
    if (status === "start_setup") {
      submitMutation.mutate(payload);
      return;
    }
    updateMutation.mutate(payload);
  };

  const selectCountry = (country: string) => {
    if (!countryTarget) return;
    setFormValue(countryTarget, country);
    setCountryTarget(null);
    setCountrySearch("");
  };

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <ScreenContainer>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
        >
          <ScreenHeader
            title="Payment setup"
            subtitle="Submit your payout details to Bright.Blue and track your KYC progress."
            leftSlot={
              <TouchableOpacity
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/(trainer)/get-paid" as any)
                }
                className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="payment-setup-back"
              >
                <IconSymbol
                  name="arrow.left"
                  size={20}
                  color={colors.foreground}
                />
              </TouchableOpacity>
            }
          />

          {isLoading ? (
            <View className="px-4 py-10 items-center">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-sm text-muted mt-3">
                Loading payout setup...
              </Text>
            </View>
          ) : (
            <>
              <View className="px-4 mb-4">
                <View
                  style={{
                    backgroundColor: statusTone.background,
                    borderWidth: 1,
                    borderColor: statusTone.border,
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                >
                  <IconSymbol
                    name={statusTone.icon}
                    size={20}
                    color={statusTone.color}
                  />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text
                      className="font-semibold text-sm"
                      style={{ color: statusTone.color }}
                    >
                      {getPayoutKycStatusLabel(status)}
                    </Text>
                    <Text className="text-sm text-muted mt-0.5">
                      {getPayoutKycTrainerMessage(status)}
                    </Text>
                  </View>
                </View>
              </View>

              <View className="px-4 mb-4">
                <SurfaceCard>
                  <Text className="text-sm font-semibold text-foreground mb-3">
                    Account setup status
                  </Text>
                  <View className="gap-3">
                    {PAYOUT_KYC_TRACKER_STEPS.map((step, index) => {
                      const state = getPayoutKycTrackerState(status, step.id);
                      const completed = state === "completed";
                      const current = state === "current";
                      return (
                        <View key={step.id} className="flex-row items-center">
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: completed || current
                                ? `${colors.primary}22`
                                : colors.surface,
                              borderWidth: 1,
                              borderColor: completed || current
                                ? colors.primary
                                : colors.border,
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                            }}
                          >
                            <Text
                              style={{
                                color: completed || current
                                  ? colors.primary
                                  : colors.muted,
                                fontSize: 11,
                                fontWeight: "700",
                              }}
                            >
                              {completed ? "✓" : index + 1}
                            </Text>
                          </View>
                          <Text
                            className="text-sm"
                            style={{
                              color: completed || current
                                ? colors.foreground
                                : colors.muted,
                              fontWeight: current ? "700" : "500",
                            }}
                          >
                            {step.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {data?.onboarding?.currentStepNote ? (
                    <Text className="text-xs text-muted mt-4">
                      Note: {data.onboarding.currentStepNote}
                    </Text>
                  ) : null}
                  {data?.onboarding?.blockingReason ? (
                    <Text className="text-xs mt-2" style={{ color: "#EF4444" }}>
                      {data.onboarding.blockingReason}
                    </Text>
                  ) : null}
                </SurfaceCard>
              </View>

              {shouldShowForm ? (
                <View className="px-4 mb-4">
                  <SurfaceCard>
                    <Text className="text-sm font-semibold text-foreground mb-2">
                      {status === "start_setup"
                        ? "Complete your setup"
                        : "Update your details"}
                    </Text>
                    <Text className="text-sm text-muted leading-5 mb-4">
                      Bright.Blue uses this information to create your payout and
                      KYC request manually in Adyen.
                    </Text>
                    <Text className="text-xs text-muted mb-4">
                      Contact email on file: {data?.trainer?.email || "Not available"}
                    </Text>

                    <Text className="text-sm font-semibold text-foreground mb-2">
                      Account holder type
                    </Text>
                    <View className="flex-row gap-2 mb-4">
                      {([
                        { value: "organization", label: "Organization" },
                        { value: "individual", label: "Individual" },
                      ] as const).map((option) => {
                        const active = form.accountHolderType === option.value;
                        return (
                          <TouchableOpacity
                            key={option.value}
                            onPress={() =>
                              setForm((current) => ({
                                ...current,
                                accountHolderType: option.value,
                              }))
                            }
                            style={{
                              flex: 1,
                              borderWidth: 1,
                              borderColor: active ? colors.primary : colors.border,
                              backgroundColor: active
                                ? `${colors.primary}18`
                                : colors.surface,
                              borderRadius: 12,
                              paddingVertical: 12,
                              paddingHorizontal: 10,
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Select ${option.label}`}
                            testID={`payment-setup-${option.value}`}
                          >
                            <Text
                              className="text-sm text-center font-semibold"
                              style={{
                                color: active ? colors.primary : colors.foreground,
                              }}
                            >
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {form.accountHolderType === "organization" ? (
                      <>
                        <Text className="text-sm font-semibold text-foreground mb-2">
                          Organization name
                        </Text>
                        <TextInput
                          value={form.organizationName}
                          onChangeText={(value) =>
                            setFormValue("organizationName", value)
                          }
                          placeholder="Organization name"
                          placeholderTextColor={colors.muted}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: Platform.OS === "ios" ? 12 : 10,
                            color: colors.foreground,
                            marginBottom: 16,
                          }}
                          accessibilityLabel="Organization name"
                          testID="payment-setup-organization-name"
                        />
                        <CountryPickerField
                          label="Country or region of registration"
                          value={form.countryOfRegistration}
                          placeholder="Select country or region"
                          onPress={() => setCountryTarget("countryOfRegistration")}
                        />
                      </>
                    ) : (
                      <>
                        <Text className="text-sm font-semibold text-foreground mb-2">
                          First name
                        </Text>
                        <TextInput
                          value={form.firstName}
                          onChangeText={(value) => setFormValue("firstName", value)}
                          placeholder="First name"
                          placeholderTextColor={colors.muted}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: Platform.OS === "ios" ? 12 : 10,
                            color: colors.foreground,
                            marginBottom: 16,
                          }}
                          accessibilityLabel="First name"
                          testID="payment-setup-first-name"
                        />
                        <Text className="text-sm font-semibold text-foreground mb-2">
                          Last name
                        </Text>
                        <TextInput
                          value={form.lastName}
                          onChangeText={(value) => setFormValue("lastName", value)}
                          placeholder="Last name"
                          placeholderTextColor={colors.muted}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: Platform.OS === "ios" ? 12 : 10,
                            color: colors.foreground,
                            marginBottom: 16,
                          }}
                          accessibilityLabel="Last name"
                          testID="payment-setup-last-name"
                        />
                        <CountryPickerField
                          label="Country or region"
                          value={form.country}
                          placeholder="Select country or region"
                          onPress={() => setCountryTarget("country")}
                        />
                      </>
                    )}

                    <Text className="text-sm font-semibold text-foreground mb-2">
                      Email address
                    </Text>
                    <TextInput
                      value={form.contactEmail}
                      onChangeText={(value) => setFormValue("contactEmail", value)}
                      placeholder="Email address"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={colors.muted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: Platform.OS === "ios" ? 12 : 10,
                        color: colors.foreground,
                        marginBottom: 16,
                      }}
                      accessibilityLabel="Email address"
                      testID="payment-setup-contact-email"
                    />
                    <Text className="text-sm font-semibold text-foreground mb-2">
                      Phone number
                    </Text>
                    <TextInput
                      value={form.contactPhone}
                      onChangeText={(value) => setFormValue("contactPhone", value)}
                      placeholder="Phone number"
                      keyboardType="phone-pad"
                      placeholderTextColor={colors.muted}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        paddingVertical: Platform.OS === "ios" ? 12 : 10,
                        color: colors.foreground,
                        marginBottom: 16,
                      }}
                      accessibilityLabel="Phone number"
                      testID="payment-setup-contact-phone"
                    />

                    <ActionButton
                      onPress={handleSubmit}
                      loading={isSaving}
                      accessibilityRole="button"
                      accessibilityLabel={
                        status === "start_setup"
                          ? "Submit payout onboarding details"
                          : "Save payout onboarding details"
                      }
                      testID="payment-setup-submit"
                    >
                      {status === "start_setup"
                        ? "Submit to Bright.Blue"
                        : "Save details"}
                    </ActionButton>
                    {showEditForm && status !== "start_setup" ? (
                      <ActionButton
                        className="mt-3"
                        variant="secondary"
                        onPress={() => {
                          setForm(buildInitialForm(data));
                          setShowEditForm(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel editing payout details"
                        testID="payment-setup-cancel-edit"
                      >
                        Cancel
                      </ActionButton>
                    ) : null}
                  </SurfaceCard>
                </View>
              ) : (
                <View className="px-4 mb-4">
                  <SurfaceCard>
                    <Text className="text-sm font-semibold text-foreground mb-2">
                      Submitted details
                    </Text>
                    <Text className="text-sm text-muted">
                      Account holder type:{" "}
                      <Text className="text-foreground font-semibold capitalize">
                        {data?.onboarding?.accountHolderType || "individual"}
                      </Text>
                    </Text>
                    {data?.details?.organizationName ? (
                      <Text className="text-sm text-muted mt-2">
                        Organization:{" "}
                        <Text className="text-foreground">
                          {data.details.organizationName}
                        </Text>
                      </Text>
                    ) : null}
                    {data?.details?.firstName || data?.details?.lastName ? (
                      <Text className="text-sm text-muted mt-2">
                        Name:{" "}
                        <Text className="text-foreground">
                          {[data?.details?.firstName, data?.details?.lastName]
                            .filter(Boolean)
                            .join(" ")}
                        </Text>
                      </Text>
                    ) : null}
                    {data?.details?.countryOfRegistration ? (
                      <Text className="text-sm text-muted mt-2">
                        Registration country:{" "}
                        <Text className="text-foreground">
                          {data.details.countryOfRegistration}
                        </Text>
                      </Text>
                    ) : null}
                    {data?.details?.country ? (
                      <Text className="text-sm text-muted mt-2">
                        Country:{" "}
                        <Text className="text-foreground">
                          {data.details.country}
                        </Text>
                      </Text>
                    ) : null}
                    <Text className="text-sm text-muted mt-2">
                      Email:{" "}
                      <Text className="text-foreground">
                        {data?.details?.contactEmail || data?.trainer?.email || "—"}
                      </Text>
                    </Text>
                    <Text className="text-sm text-muted mt-2">
                      Phone:{" "}
                      <Text className="text-foreground">
                        {data?.details?.contactPhone || data?.trainer?.phone || "—"}
                      </Text>
                    </Text>
                    <View className="gap-3 mt-4">
                      {canEdit ? (
                        <ActionButton
                          onPress={() => setShowEditForm(true)}
                          variant="secondary"
                          accessibilityRole="button"
                          accessibilityLabel="Update payout details"
                          testID="payment-setup-edit-details"
                        >
                          Update details
                        </ActionButton>
                      ) : null}
                      {canRequestPayments ? (
                        <ActionButton
                          onPress={() => router.replace("/(trainer)/get-paid" as any)}
                          accessibilityRole="button"
                          accessibilityLabel="Go to Get Paid dashboard"
                          testID="payment-setup-go-to-get-paid"
                        >
                          Go to Get Paid
                        </ActionButton>
                      ) : null}
                      <ActionButton
                        onPress={() =>
                          showAlert(
                            "Contact Bright.Blue",
                            "Please message the coordinator or manager if you need help with your payout setup.",
                          )
                        }
                        variant="secondary"
                        accessibilityRole="button"
                        accessibilityLabel="Contact support"
                        testID="payment-setup-contact-support"
                      >
                        Contact Support
                      </ActionButton>
                    </View>
                  </SurfaceCard>
                </View>
              )}

              <View className="px-4 mb-4">
                <SurfaceCard>
                  <Text className="text-sm font-semibold text-foreground mb-3">
                    How it works
                  </Text>
                  <View className="gap-3">
                    {STEPS.map((step, index) => (
                      <View key={step} className="flex-row items-start">
                        <View className="h-7 w-7 rounded-full bg-primary/10 items-center justify-center mr-3 mt-0.5">
                          <Text className="text-primary text-xs font-bold">
                            {index + 1}
                          </Text>
                        </View>
                        <Text className="text-sm text-muted flex-1 leading-5">
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
                </SurfaceCard>
              </View>
            </>
          )}

          <View className="pb-8" />
        </ScrollView>
      </ScreenContainer>

      <Modal
        visible={Boolean(countryTarget)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCountryTarget(null);
          setCountrySearch("");
        }}
      >
        <Pressable
          onPress={() => {
            setCountryTarget(null);
            setCountrySearch("");
          }}
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
              maxHeight: "80%",
            }}
          >
            <Text className="text-base font-semibold text-foreground mb-3">
              Select country or region
            </Text>
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search countries..."
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
              accessibilityLabel="Search countries"
            />
            <FlatList
              data={visibleCountries}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => selectCountry(item)}
                  className="px-2 py-3 border-b border-border"
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${item}`}
                >
                  <Text className="text-sm text-foreground">{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text className="text-sm text-muted py-4">
                  No countries found.
                </Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
