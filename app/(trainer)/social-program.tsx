import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/lib/api-config";
import {
  getSocialPlatformIcon,
  inferSocialPlatformFromText,
  normalizeSocialPlatform,
} from "@/lib/social-platforms";
import {
  hasNativePhylloConnectSdk,
  openPhylloConnectNative,
} from "@/lib/phyllo-connect-native";
import { openPhylloConnectWeb } from "@/lib/phyllo-connect";
import { trpc } from "@/lib/trpc";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TrainerSocialProgramScreen() {
  const routeParams = useLocalSearchParams<{
    phyllo?: string;
    reason?: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.socialProgram.myStatus.useQuery();
  const ctaPulseAnim = useRef(new Animated.Value(0)).current;
  const orbFloatAnim = useRef(new Animated.Value(0)).current;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [nativeConnectSheet, setNativeConnectSheet] = useState<{
    connectUrl: string;
    callbackPrefix: string;
  } | null>(null);
  const lastCallbackKeyRef = useRef<string>("");

  const isNoSelectionCloseReason = (reason: string) =>
    reason.trim().toLowerCase() === "exit_from_platform_selection";

  const declineMutation = trpc.socialProgram.declineInvite.useMutation({
    onSuccess: async () => {
      await utils.socialProgram.myStatus.invalidate();
    },
  });
  const startConnectMutation = trpc.socialProgram.startConnect.useMutation();
  const completeConnectMutation =
    trpc.socialProgram.completeConnect.useMutation({
      onSuccess: async () => {
        await utils.socialProgram.myStatus.invalidate();
        await utils.socialProgram.myProgramDashboard.invalidate();
      },
    });

  const membershipStatus = data?.membership?.status || "not_enrolled";
  const hasPendingInvite = Boolean(data?.pendingInvite?.id);
  const isConnected = Boolean(data?.profile?.phylloUserId);
  const isRestrictedStatus =
    membershipStatus === "paused" || membershipStatus === "banned";
  const canAttemptConnect = !isRestrictedStatus;
  const platformStats = useMemo(() => {
    const rawProfiles = Array.isArray(
      (data?.profile as any)?.metadata?.rawProfiles,
    )
      ? ((data?.profile as any)?.metadata?.rawProfiles as any[])
      : [];
    const directPlatforms = Array.isArray((data?.profile as any)?.platforms)
      ? ((data?.profile as any)?.platforms as any[])
      : [];
    const rawAccounts = Array.isArray(
      (data?.profile as any)?.metadata?.rawAccounts,
    )
      ? ((data?.profile as any)?.metadata?.rawAccounts as any[])
      : [];
    const rows = new Map<
      string,
      { platform: string; followers: number; impressions: number }
    >();
    for (const row of rawProfiles) {
      const rawPlatform =
        row?.platform ||
        row?.platform_name ||
        row?.work_platform?.name ||
        row?.workPlatform?.name ||
        row?.work_platform_name ||
        row?.network ||
        "";
      const normalizedPlatform =
        normalizeSocialPlatform(rawPlatform) ||
        inferSocialPlatformFromText(
          [
            row?.url,
            row?.profile_url,
            row?.profileUrl,
            row?.account_url,
            row?.accountUrl,
            row?.username,
            row?.handle,
          ]
            .filter(Boolean)
            .join(" "),
        );
      const platform = normalizedPlatform || "unknown";
      const followers = Number(
        row?.audience?.follower_count || row?.followers || 0,
      );
      const impressions = Number(
        row?.engagement?.impressions ||
          row?.engagement?.avg_views_per_month ||
          row?.avg_views_per_month ||
          row?.impressions ||
          0,
      );
      const existing = rows.get(platform);
      if (existing) {
        existing.followers += followers;
        existing.impressions += impressions;
      } else {
        rows.set(platform, { platform, followers, impressions });
      }
    }
    for (const platformRow of directPlatforms) {
      const normalizedKey = normalizeSocialPlatform(
        platformRow?.platform || platformRow?.name || platformRow,
      );
      if (!normalizedKey || rows.has(normalizedKey)) continue;
      rows.set(normalizedKey, {
        platform: normalizedKey,
        followers: Number(platformRow?.followers || 0),
        impressions: Number(
          platformRow?.impressions || platformRow?.avgViewsPerMonth || 0,
        ),
      });
    }
    for (const accountRow of rawAccounts) {
      const normalizedKey =
        normalizeSocialPlatform(
          accountRow?.platform ||
            accountRow?.platform_name ||
            accountRow?.work_platform?.name ||
            accountRow?.workPlatform?.name ||
            accountRow?.work_platform_name ||
            accountRow?.network ||
            "",
        ) ||
        inferSocialPlatformFromText(
          [
            accountRow?.url,
            accountRow?.profile_url,
            accountRow?.profileUrl,
            accountRow?.account_url,
            accountRow?.accountUrl,
            accountRow?.username,
            accountRow?.handle,
          ]
            .filter(Boolean)
            .join(" "),
        );
      if (!normalizedKey || rows.has(normalizedKey)) continue;
      rows.set(normalizedKey, {
        platform: normalizedKey,
        followers: 0,
        impressions: 0,
      });
    }
    if (rows.has("unknown") && rows.size > 1) {
      rows.delete("unknown");
    }
    if (rows.size === 1 && rows.has("unknown")) {
      const unknownRow = rows.get("unknown");
      if (unknownRow) {
        rows.delete("unknown");
        rows.set("youtube", { ...unknownRow, platform: "youtube" });
      }
    }
    return Array.from(rows.values()).sort((a, b) => b.followers - a.followers);
  }, [data?.profile]);

  useEffect(() => {
    const callbackStatus = String(routeParams.phyllo || "").toLowerCase();
    if (!callbackStatus) return;
    const callbackReason = String(routeParams.reason || "").trim();
    const callbackKey = `${callbackStatus}:${callbackReason}`;
    if (lastCallbackKeyRef.current === callbackKey) return;
    lastCallbackKeyRef.current = callbackKey;
    if (callbackStatus === "connected") {
      setActionError(null);
      setActionSuccess(
        "Connected successfully. You can connect more platforms anytime.",
      );
      return;
    }
    if (callbackStatus === "cancelled") {
      if (isNoSelectionCloseReason(callbackReason)) {
        setActionSuccess(null);
        setActionError(null);
        return;
      }
      setActionSuccess(null);
      setActionError(
        callbackReason
          ? `Connection closed (${callbackReason}).`
          : "Connection was cancelled before any platform was linked.",
      );
      return;
    }
    setActionSuccess(null);
    setActionError(
      callbackReason
        ? `Connection failed (${callbackReason}).`
        : "Could not connect your social platforms.",
    );
  }, [routeParams.phyllo, routeParams.reason]);

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

  const appWebBase = (() => {
    const configured = String(process.env.EXPO_PUBLIC_APP_URL || "")
      .trim()
      .replace(/\/+$/g, "");
    if (configured) return configured;
    if (typeof window !== "undefined" && window.location?.origin) {
      return String(window.location.origin).replace(/\/+$/g, "");
    }
    return "https://bright.coach";
  })();
  const appApiBase = (() => {
    const runtimeApi = String(getApiBaseUrl() || "")
      .trim()
      .replace(/\/+$/g, "");
    if (runtimeApi) return runtimeApi;
    return appWebBase;
  })();

  const handleConnectPhyllo = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      // Only force a fresh Phyllo user before the very first connect.
      // Once connected, always reuse the same Phyllo user so trainers can add
      // more platforms later without resetting their linkage context.
      const shouldForceFreshSession = !isConnected;
      let session;
      try {
        session = await startConnectMutation.mutateAsync({
          forceNewUser: shouldForceFreshSession,
        });
      } catch (firstError: any) {
        const firstMessage = String(firstError?.message || "");
        const normalizedFirstMessage = firstMessage.toLowerCase();
        const isIncorrectUserId =
          normalizedFirstMessage.includes("incorrect_user_id") ||
          normalizedFirstMessage.includes("requested user id does not exist");
        if (!shouldForceFreshSession && isIncorrectUserId) {
          // Recover when a previously saved Phyllo user id was removed/invalidated in sandbox.
          session = await startConnectMutation.mutateAsync({
            forceNewUser: true,
          });
        } else {
          const shouldFallback =
            shouldForceFreshSession &&
            (firstMessage.includes("Phyllo API credentials are missing") ||
              firstMessage.includes("PHYLLO_AUTH_BASIC"));
          if (!shouldFallback) throw firstError;
          // Graceful fallback for bootstrap environments where forceNewUser is unavailable.
          session = await startConnectMutation.mutateAsync({});
        }
      }
      if (!session?.sdkToken || !session?.phylloUserId) {
        throw new Error("Could not create a Phyllo connect session.");
      }

      if (Platform.OS === "web") {
        const launchWebConnect = async (connectSession: typeof session) =>
          openPhylloConnectWeb({
            scriptUrl:
              connectSession.connectConfig?.scriptUrl ||
              "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js",
            environment:
              connectSession.connectConfig?.environment === "production"
                ? "production"
                : "sandbox",
            userId: connectSession.phylloUserId,
            token: connectSession.sdkToken,
            clientDisplayName:
              connectSession.connectConfig?.clientDisplayName || "LocoMotivate",
          });

        let result = await launchWebConnect(session);
        if (result.status === "failed" && result.reason === "token_expired") {
          try {
            const refreshedSession = await startConnectMutation.mutateAsync({
              forceNewUser: true,
            });
            if (refreshedSession?.sdkToken && refreshedSession?.phylloUserId) {
              result = await launchWebConnect(refreshedSession);
            }
          } catch {
            // Keep original token_expired result and show a user-facing message below.
          }
        }
        const finalized = await completeConnectMutation.mutateAsync({
          status: result.status,
          reason: result.reason,
        });
        const connectedPlatforms = Number(
          finalized?.profile?.platforms?.length || 0,
        );
        if (result.status === "connected") {
          const message =
            connectedPlatforms > 0
              ? `Connected successfully. ${connectedPlatforms} platform(s) linked.`
              : "Connected successfully. Refresh status to load your latest platform metrics.";
          setActionSuccess(message);
        } else if (result.status === "cancelled") {
          const reason = String(result.reason || "").trim();
          if (isNoSelectionCloseReason(reason)) {
            setActionSuccess(null);
            setActionError(null);
            return;
          }
          setActionError(
            reason
              ? `Connection closed (${reason}). If you already linked supported platforms, there may be no additional providers to add.`
              : "Connection was cancelled before any platform was linked.",
          );
        } else {
          const message =
            result.reason === "token_expired"
              ? "Phyllo connect session expired. Please retry. If it keeps happening, refresh PHYLLO credentials."
              : result.reason || "Could not connect your social platforms.";
          setActionError(message);
        }
        return;
      }

      if (hasNativePhylloConnectSdk()) {
        const launchNativeConnect = async (connectSession: typeof session) =>
          openPhylloConnectNative({
            environment:
              connectSession.connectConfig?.environment === "production"
                ? "production"
                : "sandbox",
            userId: connectSession.phylloUserId,
            token: connectSession.sdkToken,
            clientDisplayName:
              connectSession.connectConfig?.clientDisplayName || "LocoMotivate",
          });

        let result = await launchNativeConnect(session);
        if (result.status === "failed" && result.reason === "token_expired") {
          try {
            const refreshedSession = await startConnectMutation.mutateAsync({
              forceNewUser: true,
            });
            if (refreshedSession?.sdkToken && refreshedSession?.phylloUserId) {
              result = await launchNativeConnect(refreshedSession);
            }
          } catch {
            // Keep original token_expired result and show message below.
          }
        }

        const finalized = await completeConnectMutation.mutateAsync({
          status: result.status,
          reason: result.reason,
        });
        const connectedPlatforms = Number(
          finalized?.profile?.platforms?.length || 0,
        );
        if (result.status === "connected") {
          const message =
            connectedPlatforms > 0
              ? `Connected successfully. ${connectedPlatforms} platform(s) linked.`
              : "Connected successfully. Refresh status to load your latest platform metrics.";
          setActionSuccess(message);
        } else if (result.status === "cancelled") {
          const reason = String(result.reason || "").trim();
          if (isNoSelectionCloseReason(reason)) {
            setActionSuccess(null);
            setActionError(null);
            return;
          }
          setActionError(
            reason
              ? `Connection closed (${reason}). If you already linked supported platforms, there may be no additional providers to add.`
              : "Connection was cancelled before any platform was linked.",
          );
        } else {
          const message =
            result.reason === "token_expired"
              ? "Phyllo connect session expired. Please retry. If it keeps happening, refresh PHYLLO credentials."
              : result.reason || "Could not connect your social platforms.";
          setActionError(message);
        }
        return;
      }

      const callbackUrl = Linking.createURL("/phyllo/callback", {
        queryParams: {
          returnTo: encodeURIComponent("/(trainer)/social-program"),
        },
      });
      const connectBridgeUrl =
        `${appApiBase}/api/phyllo/connect` +
        `?token=${encodeURIComponent(session.sdkToken)}` +
        `&userId=${encodeURIComponent(session.phylloUserId)}` +
        `&environment=${encodeURIComponent(session.connectConfig?.environment || "sandbox")}` +
        `&clientDisplayName=${encodeURIComponent(
          session.connectConfig?.clientDisplayName || "LocoMotivate",
        )}` +
        `&scriptUrl=${encodeURIComponent(
          session.connectConfig?.scriptUrl ||
            "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js",
        )}` +
        `&returnTo=${encodeURIComponent(callbackUrl)}`;

      setNativeConnectSheet({
        connectUrl: connectBridgeUrl,
        callbackPrefix: callbackUrl.split("?")[0] || callbackUrl,
      });
      return;
    } catch (error: any) {
      const message = String(
        error?.message || "Unable to connect Phyllo right now.",
      );
      setActionError(message);
    }
  };

  return (
    <ScreenContainer>
      <Modal
        visible={Boolean(nativeConnectSheet)}
        transparent={false}
        animationType="slide"
        onRequestClose={async () => {
          setNativeConnectSheet(null);
          await completeConnectMutation.mutateAsync({
            status: "cancelled",
            reason: "user_closed_connect_flow",
          });
          setActionError(
            "Connection was cancelled before any platform was linked.",
          );
        }}
      >
        <View className="flex-1 bg-background">
          {nativeConnectSheet ? (
            <WebView
              source={{ uri: nativeConnectSheet.connectUrl }}
              startInLoadingState
              style={{ flex: 1 }}
              onShouldStartLoadWithRequest={(request) => {
                const requestUrl = String(request?.url || "");
                if (!requestUrl) return true;
                if (!requestUrl.startsWith(nativeConnectSheet.callbackPrefix)) {
                  return true;
                }
                setNativeConnectSheet(null);
                const parsed = Linking.parse(requestUrl);
                router.replace({
                  pathname: "/phyllo/callback",
                  params: parsed.queryParams as any,
                } as any);
                return false;
              }}
            />
          ) : null}
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: Math.max(insets.top + 8, 12),
              right: 12,
            }}
          >
            <Pressable
              onPress={async () => {
                setNativeConnectSheet(null);
                await completeConnectMutation.mutateAsync({
                  status: "cancelled",
                  reason: "user_closed_connect_flow",
                });
                setActionError(
                  "Connection was cancelled before any platform was linked.",
                );
              }}
              accessibilityRole="button"
              accessibilityLabel="Close social platform connect modal"
              testID="social-connect-native-close"
              className="px-3 py-2 rounded-lg bg-surface border border-border"
              style={{ opacity: 0.92 }}
            >
              <Text className="text-sm font-medium text-foreground">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 116 : 92,
        }}
      >
        <ScreenHeader
          title="Get Paid for Social Posts."
          subtitle="Join campaigns, track compliance, and earn from approved social content."
          leftSlot={
            <ActionButton
              onPress={() => router.back()}
              variant="ghost"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="social-program-back"
            >
              <IconSymbol
                name="chevron.left"
                size={18}
                color={colors.primary}
              />
            </ActionButton>
          }
        />

        <View className="px-4 pb-28 gap-4">
          {actionError ? (
            <SurfaceCard style={{ borderColor: "rgba(248,113,113,0.4)" }}>
              <Text
                className="text-sm font-semibold"
                style={{ color: "#F87171" }}
              >
                Connection error
              </Text>
              <Text className="text-sm text-muted mt-1">{actionError}</Text>
            </SurfaceCard>
          ) : null}
          {actionSuccess ? (
            <SurfaceCard style={{ borderColor: "rgba(52,211,153,0.45)" }}>
              <Text
                className="text-sm font-semibold"
                style={{ color: "#34D399" }}
              >
                Success
              </Text>
              <Text className="text-sm text-muted mt-1">{actionSuccess}</Text>
            </SurfaceCard>
          ) : null}

          <SurfaceCard
            style={{ overflow: "hidden", borderColor: "rgba(96,165,250,0.5)" }}
          >
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
            <View
              className="rounded-full self-start px-2.5 py-1 mb-2 flex-row items-center"
              style={{
                backgroundColor: "rgba(96,165,250,0.16)",
                borderWidth: 1,
                borderColor: "rgba(96,165,250,0.4)",
              }}
            >
              <IconSymbol name="sparkles" size={12} color={colors.primary} />
              <Text
                className="text-xs font-semibold ml-1"
                style={{ color: colors.primary }}
              >
                Creator Rewards
              </Text>
            </View>
            <Text className="text-lg font-bold text-foreground">
              Turn posts into payouts
            </Text>
            <Text className="text-sm text-muted mt-1">
              Connect Phyllo, unlock campaign invites, and track your progress
              in one place.
            </Text>
            <View className="flex-row mt-3">
              {["Followers", "Views", "Compliance"].map((pill) => (
                <View
                  key={pill}
                  className="mr-2 rounded-full px-2.5 py-1"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: "rgba(255,255,255,0.04)",
                  }}
                >
                  <Text className="text-[10px] font-semibold text-muted">
                    {pill}
                  </Text>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Quick connect
            </Text>
            <Text className="text-sm text-muted mb-3">
              Connect now to pick platforms like YouTube and sync your metrics.
              {"\n"}
              You can reopen this anytime to connect additional platforms.
            </Text>
            <ActionButton
              onPress={handleConnectPhyllo}
              loading={
                startConnectMutation.isPending ||
                completeConnectMutation.isPending
              }
              loadingText="Connecting..."
              disabled={!canAttemptConnect || isRestrictedStatus}
              accessibilityRole="button"
              accessibilityLabel={
                hasPendingInvite
                  ? "Accept invite and continue"
                  : isConnected
                    ? "Connect more social platforms"
                    : "Connect Phyllo now"
              }
              testID="social-primary-cta-top"
            >
              {hasPendingInvite
                ? "Accept invite and continue"
                : isConnected
                  ? "Connect more platforms"
                  : "Connect with Phyllo"}
            </ActionButton>
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
              - Performance metrics tracked: engagement, CTR, share/save, intent
              actions
            </Text>
          </SurfaceCard>

          {isLoading ? (
            <SurfaceCard>
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-sm text-muted mt-2">
                  Loading social status...
                </Text>
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
              <Text className="text-sm text-muted mt-1">Linked platforms:</Text>
              <View className="flex-row flex-wrap gap-2 mt-2">
                {platformStats.length > 0 ? (
                  platformStats.map((row) => {
                    const platformIcon = getSocialPlatformIcon(row.platform);
                    return (
                      <View
                        key={`status-${row.platform}`}
                        className="flex-row items-center px-2.5 py-1 rounded-full border border-border"
                        style={{
                          backgroundColor:
                            colors.background === "#0A0A14"
                              ? "rgba(148,163,184,0.22)"
                              : "rgba(148,163,184,0.16)",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={platformIcon.icon as any}
                          size={13}
                          color={platformIcon.color}
                        />
                        <Text className="text-xs text-foreground ml-1.5">
                          {platformIcon.label}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text className="text-xs text-muted">None linked yet</Text>
                )}
              </View>
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

          {platformStats.length > 0 ? (
            <SurfaceCard>
              <Text className="text-base font-semibold text-foreground mb-2">
                Authorized platforms
              </Text>
              <View className="gap-2">
                {platformStats.map((row) => {
                  const platformIcon = getSocialPlatformIcon(row.platform);
                  return (
                    <View
                      key={row.platform}
                      className="rounded-xl border border-border px-3 py-2 flex-row items-center justify-between"
                    >
                      <View className="flex-1 pr-3">
                        <View className="flex-row items-center">
                          <MaterialCommunityIcons
                            name={platformIcon.icon as any}
                            size={16}
                            color={platformIcon.color}
                          />
                          <Text className="text-sm font-semibold text-foreground ml-1.5">
                            {platformIcon.label}
                          </Text>
                        </View>
                        <Text className="text-xs text-muted mt-0.5">
                          Followers: {row.followers.toLocaleString()}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-xs text-muted">
                          Impressions / month
                        </Text>
                        <Text className="text-sm font-semibold text-foreground">
                          {row.impressions.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </SurfaceCard>
          ) : null}

          <SurfaceCard style={{ overflow: "visible" }}>
            <Text className="text-base font-semibold text-foreground mb-2">
              Next step
            </Text>
            <Text className="text-sm text-muted mb-3">
              {hasPendingInvite
                ? "Accept your invite and immediately connect your social platforms."
                : isConnected
                  ? "Your Phyllo account is connected. Reopen connect anytime to add more social platforms."
                  : canAttemptConnect
                    ? "Connect Phyllo now to select your social platforms and start syncing metrics."
                    : "Your membership is restricted. Ask a coordinator or manager to reactivate you."}
            </Text>
            <Animated.View style={{ transform: [{ scale: ctaRingScale }] }}>
              <Animated.View
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
                  opacity: ctaRingOpacity,
                }}
              />
              <ActionButton
                onPress={handleConnectPhyllo}
                loading={
                  startConnectMutation.isPending ||
                  completeConnectMutation.isPending
                }
                loadingText="Connecting..."
                disabled={!canAttemptConnect || isRestrictedStatus}
                accessibilityRole="button"
                accessibilityLabel={
                  hasPendingInvite
                    ? "Accept invite and continue"
                    : isConnected
                      ? "Connect more social platforms"
                      : "Connect Phyllo now"
                }
                testID="social-primary-cta"
              >
                {hasPendingInvite
                  ? "Accept invite and continue"
                  : isConnected
                    ? "Connect more platforms"
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
                Accept in the Next step section above to join the social program
                and start connecting your channels.
              </Text>
              <Text className="text-xs text-muted">
                Tip: once accepted, tap Connect with Phyllo to start syncing
                your profiles.
              </Text>
            </SurfaceCard>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
