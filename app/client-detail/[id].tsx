import { EmptyStateCard } from "@/components/empty-state-card";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBP } from "@/lib/currency";
import { getRoleConversationPath } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { getTrpcMutationMessage, isClientStatusHiddenUnsupportedError } from "@/lib/trpc-errors";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function paymentLabel(status: string | null | undefined) {
  const value = (status || "").toLowerCase();
  if (value === "paid") return "Paid";
  if (value === "refunded" || value === "partially_refunded") return "Paid out";
  return "Awaiting payment";
}

function toProgressPercent(used: number, included: number) {
  if (!included || included <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / included) * 100)));
}

function getInitials(name?: string | null) {
  const parts = String(name || "Client")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function ClientPhoto({
  uri,
  name,
  size = 88,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
}) {
  const colors = useColors();
  const [hasError, setHasError] = useState(false);
  const normalizedUri = useMemo(() => normalizeAssetUrl(uri), [uri]);
  const hasImage = typeof normalizedUri === "string" && normalizedUri.trim().length > 0 && !hasError;

  useEffect(() => {
    setHasError(false);
  }, [normalizedUri]);

  return (
    <View
      className="rounded-full overflow-hidden items-center justify-center border border-border"
      style={{
        width: size,
        height: size,
      }}
    >
      {hasImage ? (
        <Image
          source={{ uri: normalizedUri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          onError={() => setHasError(true)}
          accessibilityLabel={`Photo of ${name || "client"}`}
        />
      ) : (
        <View
          className="rounded-full items-center justify-center bg-primary/15"
          style={{
            width: size,
            height: size,
          }}
        >
          <Text className="text-2xl font-bold" style={{ color: colors.primary }}>
            {getInitials(name)}
          </Text>
        </View>
      )}
    </View>
  );
}

function digitsOnlyPhone(value: string) {
  return value.replace(/\D/g, "");
}

/**
 * RN `openURL` resolves `true`/`false` on iOS native; may reject if no handler (common on Simulator).
 * On web, `react-native-web` uses `window.open(mailto, '_blank')` which pop-up blockers often block.
 */
async function tryOpenExternalUrl(url: string): Promise<boolean> {
  if (Platform.OS === "web" && typeof window !== "undefined" && url.toLowerCase().startsWith("mailto:")) {
    try {
      window.location.href = url;
      return true;
    } catch {
      return false;
    }
  }
  try {
    const result = await Linking.openURL(url);
    return result !== false;
  } catch {
    return false;
  }
}

export default function ClientDetailScreen() {
  const colors = useColors();
  const { user, effectiveRole } = useAuthContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.clients.detail.useQuery({ id: id || "" }, { enabled: !!id });
  const updateClientMutation = trpc.clients.update.useMutation({
    onSuccess: async (_data, variables) => {
      setIsEditingContact(false);
      await Promise.all([utils.clients.detail.invalidate({ id: id || "" }), utils.clients.list.invalidate()]);
      if (variables.status === "hidden") {
        router.replace("/(trainer)/clients" as any);
      }
    },
    onError: (err, variables) => {
      if (variables?.status === "hidden" && isClientStatusHiddenUnsupportedError(err)) {
        const clientId = variables.id;
        const s = String(data?.status ?? "pending").toLowerCase();
        if (s === "active" || s === "pending") {
          updateClientMutation.mutate(
            { id: clientId, status: "inactive" },
            {
              onSuccess: async () => {
                await Promise.all([
                  utils.clients.detail.invalidate({ id: id || "" }),
                  utils.clients.list.invalidate(),
                ]);
                router.replace("/(trainer)/clients" as any);
              },
              onError: (e2) =>
                Alert.alert(
                  "Update failed",
                  getTrpcMutationMessage(e2, "Something went wrong. Please try again."),
                ),
            },
          );
        } else {
          Alert.alert(
            "Server update required",
            "Hiding clients requires the latest API and database migration for the \"hidden\" status. Deploy the backend from this repo and run migration 025_client_status_hidden.sql.",
          );
        }
        return;
      }
      Alert.alert(
        "Update failed",
        getTrpcMutationMessage(err, "Something went wrong. Please try again."),
      );
    },
  });

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (!data) return;
    setEditName(data.name || "");
    setEditEmail(data.email || "");
    setEditPhone(data.phone || "");
    setEditNotes(typeof data.notes === "string" ? data.notes : data.notes != null ? String(data.notes) : "");
  }, [data]);

  const validateEmail = (value: string) => {
    const v = value.trim();
    if (!v) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  };

  const handleSaveDetails = () => {
    if (!data?.id) return;
    const name = editName.trim();
    if (!name) {
      Alert.alert("Name required", "Enter the client's name before saving.");
      return;
    }
    const emailTrim = editEmail.trim();
    if (emailTrim && !validateEmail(emailTrim)) {
      Alert.alert("Invalid email", "Enter a valid email or leave it blank.");
      return;
    }
    updateClientMutation.mutate({
      id: data.id,
      name,
      email: emailTrim ? emailTrim : null,
      phone: editPhone.trim() ? editPhone.trim() : null,
      notes: editNotes.trim() ? editNotes.trim() : null,
    });
  };

  const cancelContactEdit = () => {
    if (!data) return;
    setEditName(data.name || "");
    setEditEmail(data.email || "");
    setEditPhone(data.phone || "");
    setEditNotes(typeof data.notes === "string" ? data.notes : data.notes != null ? String(data.notes) : "");
    setIsEditingContact(false);
  };

  const openSendBundleFlow = () => {
    if (!data?.id) return;
    router.push({
      pathname: "/(trainer)/invite",
      params: {
        clientId: data.id,
        clientName: (editName.trim() || data.name || "").trim(),
        clientEmail: editEmail.trim() || data.email || "",
        clientPhone: editPhone.trim() || data.phone || "",
        toOfferChoice: "1",
      },
    } as any);
  };

  const openClientMessage = useCallback(() => {
    if (!data) return;
    const otherId = data.userId ? String(data.userId) : "";
    if (!otherId) {
      Alert.alert(
        "Can't message yet",
        "This client doesn't have a linked account yet. Send a bundle or custom plan invite so they can join, then you can message them in the app.",
      );
      return;
    }
    const conversationId = [String(user?.id || ""), otherId].sort().join("-");
    router.push({
      pathname: getRoleConversationPath(effectiveRole) as any,
      params: {
        id: conversationId,
        name: data.name || "Client",
        participantId: otherId,
      },
    });
  }, [data, effectiveRole, user?.id]);

  const openClientSms = useCallback(async () => {
    if (!data) return;
    const raw = digitsOnlyPhone(data.phone || "");
    if (!raw) {
      Alert.alert("No phone number", "Add a phone number in Contact & notes to send a text.");
      return;
    }
    const url = `sms:${raw}`;
    if (await tryOpenExternalUrl(url)) return;
    try {
      await Clipboard.setStringAsync(raw);
      Alert.alert(
        "Number copied",
        `${raw} is on your clipboard. Paste it into Messages to send a text.`,
      );
    } catch {
      Alert.alert("Can't open Messages", "Texting isn't available on this device.");
    }
  }, [data]);

  const openClientEmail = useCallback(async () => {
    if (!data) return;
    const email = (data.email || "").trim();
    if (!email) {
      Alert.alert("No email", "Add an email address in Contact & notes to send email.");
      return;
    }
    /** Plain `mailto:` first — most reliable across clients; then subject line, then encoded mailbox. */
    const simple = `mailto:${email}`;
    const subject = data.name?.trim() ? `Message for ${data.name.trim()}` : "";
    const withSubject = subject
      ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
      : simple;
    const encodedMailbox = `mailto:${encodeURIComponent(email)}`;

    const attempts =
      subject && withSubject !== simple
        ? [simple, withSubject, encodedMailbox]
        : [simple, encodedMailbox];

    for (const url of attempts) {
      if (await tryOpenExternalUrl(url)) return;
    }

    try {
      await Clipboard.setStringAsync(email);
      Alert.alert(
        "Email copied",
        Platform.OS === "ios"
          ? `${email} is on your clipboard. The iOS Simulator often can’t open Mail — try a device, or paste this into Mail.`
          : `${email} is on your clipboard. Paste it into your mail app to send.`,
      );
    } catch {
      Alert.alert(
        "Can't open mail",
        "Set up the Mail app on this device, or copy the address from Contact & notes.",
      );
    }
  }, [data]);

  if (isLoading) {
    return (
      <ScreenContainer>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!data) {
    return (
      <ScreenContainer>
        <ScreenHeader
          title="Client"
          subtitle="Client details"
          leftSlot={(
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <IconSymbol name="arrow.left" size={18} color={colors.foreground} />
            </TouchableOpacity>
          )}
        />
        <View className="px-4">
          <EmptyStateCard
            icon="person.fill"
            title="Client not found"
            description="This client is unavailable or no longer active."
            ctaLabel="Back to Clients"
            onCtaPress={() => router.replace("/(trainer)/clients" as any)}
          />
        </View>
      </ScreenContainer>
    );
  }

  const goGetPaid = () => router.push("/(trainer)/get-paid" as any);

  const hasLinkedUser = Boolean(data.userId);
  const hasPhone = Boolean(digitsOnlyPhone(data.phone || ""));
  const hasEmail = Boolean((data.email || "").trim());

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="px-4 pt-2 pb-5 border-b border-border">
          {/* Identity row: back + photo + name — no competing actions on the same line */}
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-11 h-11 rounded-full bg-surface items-center justify-center shrink-0 border border-border"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="client-detail-back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <ClientPhoto uri={data.photoUrl} name={editName || data.name} size={64} />
            <View className="flex-1 min-w-0 justify-center py-0.5">
              <Text
                className="text-2xl font-bold text-foreground leading-tight"
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {data.name?.trim() || "Client"}
              </Text>
              <Text className="text-sm text-muted mt-1.5" numberOfLines={1}>
                Profile & activity
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="mt-5 bg-surface border border-border rounded-2xl py-3.5 px-4 items-center"
            onPress={openSendBundleFlow}
            accessibilityRole="button"
            accessibilityLabel={`Send bundle to ${data.name}`}
            testID="client-detail-invite-bundle"
          >
            <Text className="text-foreground font-semibold text-base">Send bundle</Text>
          </TouchableOpacity>

          <View className="flex-row items-stretch justify-between gap-2 mt-5">
            <TouchableOpacity
              className="flex-1 items-center py-2 rounded-xl bg-surface border border-border"
              onPress={openClientMessage}
              accessibilityRole="button"
              accessibilityLabel="Message in app"
              testID="client-detail-action-message"
              style={{ opacity: hasLinkedUser ? 1 : 0.45 }}
            >
              <IconSymbol name="bubble.left.and.bubble.right.fill" size={20} color={colors.primary} />
              <Text className="text-xs font-semibold text-foreground mt-1">Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 items-center py-2 rounded-xl bg-surface border border-border"
              onPress={openClientSms}
              accessibilityRole="button"
              accessibilityLabel="Send text message"
              testID="client-detail-action-text"
              style={{ opacity: hasPhone ? 1 : 0.45 }}
            >
              <IconSymbol name="text.bubble.fill" size={20} color={colors.primary} />
              <Text className="text-xs font-semibold text-foreground mt-1">Text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 items-center py-2 rounded-xl bg-surface border border-border"
              onPress={openClientEmail}
              accessibilityRole="button"
              accessibilityLabel="Send email"
              testID="client-detail-action-email"
              style={{ opacity: hasEmail ? 1 : 0.45 }}
            >
              <IconSymbol name="envelope.fill" size={20} color={colors.primary} />
              <Text className="text-xs font-semibold text-foreground mt-1">Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {(data.status || "") === "hidden" ? (
          <View className="px-4 mb-3">
            <SurfaceCard className="border-warning/40 bg-warning/10">
              <Text className="text-sm font-semibold text-foreground">Hidden client</Text>
              <Text className="text-xs text-muted mt-1 leading-5">
                This client is hidden from your main client list and plan picker. You can still manage them here.
              </Text>
              <TouchableOpacity
                className="mt-3 bg-primary rounded-xl py-3 items-center"
                onPress={() => updateClientMutation.mutate({ id: data.id, status: "inactive" })}
                disabled={updateClientMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Show client in list again"
                testID="client-detail-unhide"
              >
                <Text className="text-background font-semibold">Show in list again</Text>
              </TouchableOpacity>
            </SurfaceCard>
          </View>
        ) : null}

        <View className="px-4 pt-4 mb-3">
          <View className="flex-row items-center justify-between mb-2 gap-2">
            <Text className="text-base font-semibold text-foreground flex-1">Contact & notes</Text>
            {!isEditingContact ? (
              <TouchableOpacity
                className="bg-surface border border-border px-3 py-2 rounded-full flex-row items-center gap-1.5"
                onPress={() => setIsEditingContact(true)}
                accessibilityRole="button"
                accessibilityLabel="Edit contact and notes"
                testID="client-detail-edit-contact"
              >
                <IconSymbol name="square.and.pencil" size={16} color={colors.foreground} />
                <Text className="text-foreground font-semibold">Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="px-3 py-2 rounded-full"
                onPress={cancelContactEdit}
                disabled={updateClientMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Cancel editing contact"
                testID="client-detail-cancel-edit-contact"
              >
                <Text className="text-muted font-semibold">Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
          <SurfaceCard className="mb-3">
            {isEditingContact ? (
              <>
                <Text className="text-sm font-medium text-foreground mb-1">Name</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Client name"
                  placeholderTextColor={colors.muted}
                  accessibilityLabel="Client name"
                  testID="client-detail-edit-name"
                />
                <Text className="text-sm font-medium text-foreground mb-1">Email</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
                  value={editEmail}
                  onChangeText={setEditEmail}
                  placeholder="email@example.com"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Client email"
                  testID="client-detail-edit-email"
                />
                <Text className="text-sm font-medium text-foreground mb-1">Phone</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Phone (optional)"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                  accessibilityLabel="Client phone"
                  testID="client-detail-edit-phone"
                />
                <Text className="text-sm font-medium text-foreground mb-1">Notes</Text>
                <TextInput
                  className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-4 min-h-[88px]"
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Internal notes (optional)"
                  placeholderTextColor={colors.muted}
                  multiline
                  textAlignVertical="top"
                  accessibilityLabel="Client notes"
                  testID="client-detail-edit-notes"
                />
                <TouchableOpacity
                  className="bg-primary rounded-xl py-3.5 items-center"
                  onPress={handleSaveDetails}
                  disabled={updateClientMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Save client details"
                  testID="client-detail-save"
                >
                  {updateClientMutation.isPending ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <Text className="text-background font-semibold">Save changes</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-muted mb-1">Name</Text>
                  <Text
                    className="text-base text-foreground"
                    accessibilityRole="text"
                    accessibilityLabel={`Client name, ${data.name || "Not set"}`}
                    testID="client-detail-read-name"
                  >
                    {data.name?.trim() ? data.name : "—"}
                  </Text>
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-muted mb-1">Email</Text>
                  <Text
                    className="text-base text-foreground"
                    accessibilityRole="text"
                    accessibilityLabel={`Client email, ${data.email || "Not set"}`}
                    testID="client-detail-read-email"
                  >
                    {data.email?.trim() ? data.email : "—"}
                  </Text>
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-muted mb-1">Phone</Text>
                  <Text
                    className="text-base text-foreground"
                    accessibilityRole="text"
                    accessibilityLabel={`Client phone, ${data.phone || "Not set"}`}
                    testID="client-detail-read-phone"
                  >
                    {data.phone?.trim() ? data.phone : "—"}
                  </Text>
                </View>
                <View>
                  <Text className="text-sm font-medium text-muted mb-1">Notes</Text>
                  <Text
                    className="text-base text-foreground leading-6"
                    accessibilityRole="text"
                    accessibilityLabel={
                      data.notes != null && String(data.notes).trim()
                        ? `Client notes, ${String(data.notes)}`
                        : "No notes"
                    }
                    testID="client-detail-read-notes"
                  >
                    {data.notes != null && String(data.notes).trim()
                      ? String(data.notes)
                      : "No notes"}
                  </Text>
                </View>
              </>
            )}
          </SurfaceCard>
        </View>

        <View className="px-4 mb-3">
          <Text className="text-base font-semibold text-foreground mb-2">Current bundle status</Text>
          {data.currentBundle ? (
            <SurfaceCard className="mb-3">
              <Text className="text-base font-semibold text-foreground">
                {data.currentBundle.title || "Active bundle"}
              </Text>
              <View className="mt-3">
                <Text className="text-xs text-muted">
                  Sessions: {Number(data.currentBundle.sessionsUsed || 0)}/{Number(data.currentBundle.sessionsIncluded || 0)}
                </Text>
                <View className="h-2 rounded-full mt-1.5 mb-2 overflow-hidden" style={{ backgroundColor: colors.surface }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${toProgressPercent(
                        Number(data.currentBundle.sessionsUsed || 0),
                        Number(data.currentBundle.sessionsIncluded || 0),
                      )}%`,
                      backgroundColor:
                        toProgressPercent(
                          Number(data.currentBundle.sessionsUsed || 0),
                          Number(data.currentBundle.sessionsIncluded || 0),
                        ) >= 80
                          ? colors.warning
                          : colors.primary,
                    }}
                  />
                </View>

                <Text className="text-xs text-muted">
                  Products: {Number(data.currentBundle.productsUsed || 0)}/{Number(data.currentBundle.productsIncluded || 0)}
                </Text>
                <View className="h-2 rounded-full mt-1.5 overflow-hidden" style={{ backgroundColor: colors.surface }}>
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${toProgressPercent(
                        Number(data.currentBundle.productsUsed || 0),
                        Number(data.currentBundle.productsIncluded || 0),
                      )}%`,
                      backgroundColor:
                        toProgressPercent(
                          Number(data.currentBundle.productsUsed || 0),
                          Number(data.currentBundle.productsIncluded || 0),
                        ) >= 80
                          ? colors.warning
                          : colors.success,
                    }}
                  />
                </View>
              </View>

              {Array.isArray(data.currentBundle.alerts) && data.currentBundle.alerts.length > 0 ? (
                <View className="mt-3">
                  {data.currentBundle.alerts.map((alert: string, index: number) => (
                    <View
                      key={`${alert}-${index}`}
                      className="px-2.5 py-1.5 rounded-full self-start mb-1.5"
                      style={{ backgroundColor: `${colors.warning}20` }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: colors.warning }}>
                        {alert}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </SurfaceCard>
          ) : (
            <SurfaceCard className="mb-3 py-3">
              <View className="flex-row items-start gap-3">
                <View className="w-9 h-9 rounded-full bg-surface border border-border items-center justify-center mt-0.5">
                  <IconSymbol name="bag.fill" size={16} color={colors.muted} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-foreground">No active bundle</Text>
                  <Text className="text-xs text-muted mt-1 leading-5">
                    Send a bundle from the button above, or build a custom plan when you’re ready.
                  </Text>
                </View>
              </View>
            </SurfaceCard>
          )}
        </View>

        {(data.status ?? "pending") === "active" || (data.status ?? "pending") === "pending" ? (
          <View className="px-4 mb-3">
            <SurfaceCard className="border-border py-3">
              <Text className="text-sm font-semibold text-foreground mb-1">List visibility</Text>
              <Text className="text-xs text-muted leading-5 mb-2.5">
                Hide clients you no longer work with. They stay in the Hidden section and won’t appear when you pick a client for a new plan.
              </Text>
              <TouchableOpacity
                className="flex-row items-center justify-center py-3.5 rounded-xl bg-primary"
                onPress={() =>
                  Alert.alert(
                    "Hide client?",
                    `${data.name || "This client"} will move to Hidden. You can restore them anytime from the Hidden section or this profile.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Hide",
                        style: "destructive",
                        onPress: () => updateClientMutation.mutate({ id: data.id, status: "hidden" }),
                      },
                    ],
                  )
                }
                disabled={updateClientMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Hide client from main list"
                testID="client-detail-hide"
              >
                {updateClientMutation.isPending ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <IconSymbol name="eye.slash.fill" size={18} color={colors.background} />
                    <Text className="text-background font-bold text-sm ml-2">Hide from list</Text>
                  </>
                )}
              </TouchableOpacity>
            </SurfaceCard>
          </View>
        ) : null}

        <View className="px-4 pb-8">
          <Text className="text-base font-semibold text-foreground mb-2">Payment history</Text>
          {data.paymentHistory.length === 0 ? (
            <EmptyStateCard
              icon="creditcard.fill"
              title="No payment history"
              description="Charges you take for this client will show up here."
              ctaLabel="Get Paid"
              onCtaPress={goGetPaid}
              testID="client-detail-get-paid"
            />
          ) : (
            <>
              {data.paymentHistory.map((payment: any) => (
                <SurfaceCard key={payment.id} className="mb-2 py-3">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-foreground font-semibold text-sm">{paymentLabel(payment.status)}</Text>
                      <Text className="text-xs text-muted mt-0.5">
                        {new Date(payment.createdAt).toLocaleDateString("en-GB")}
                      </Text>
                    </View>
                    <Text className="text-foreground font-bold">{formatGBP(payment.amount || 0)}</Text>
                  </View>
                </SurfaceCard>
              ))}
              <TouchableOpacity
                className="bg-primary rounded-xl py-3.5 items-center mt-2"
                onPress={goGetPaid}
                accessibilityRole="button"
                accessibilityLabel={`Get paid from ${data.name || "client"}`}
                testID="client-detail-get-paid"
              >
                <Text className="text-background font-semibold">Get Paid</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
