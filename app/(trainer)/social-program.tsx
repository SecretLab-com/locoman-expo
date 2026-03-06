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
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
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
  const { data, isLoading, refetch: refetchStatus, isRefetching: isRefetchingStatus } =
    trpc.socialProgram.myStatus.useQuery();
  const recentPostsQuery = trpc.socialProgram.recentPosts.useQuery(
    { limit: 12, sparklineDays: 10 },
    { enabled: Boolean(data?.profile?.phylloUserId) },
  );
  const ctaPulseAnim = useRef(new Animated.Value(0)).current;
  const orbFloatAnim = useRef(new Animated.Value(0)).current;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [nativeConnectSheet, setNativeConnectSheet] = useState<{
    connectUrl: string;
    callbackPrefix: string;
    returnTo: string;
  } | null>(null);
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [showFirstConnectHelpModal, setShowFirstConnectHelpModal] = useState(false);
  const [syncDoneAt, setSyncDoneAt] = useState<number | null>(null);
  const [isLaunchingConnect, setIsLaunchingConnect] = useState(false);
  const lastCallbackKeyRef = useRef<string>("");
  const hasWebBridgeTokenRetryRef = useRef(false);
  const hasShownFirstConnectHelpRef = useRef(false);

  const isBenignCloseReason = (reason: string) => {
    const normalized = reason.trim().toLowerCase();
    return (
      normalized === "exit_from_platform_selection" ||
      normalized === "back_pressed" ||
      normalized === "user_closed_connect_flow" ||
      normalized === "dismissed" ||
      normalized === "closed"
    );
  };
  const isTokenExpiredReason = (reason: string) => {
    const normalized = reason.trim().toLowerCase();
    return (
      normalized === "token_expired" ||
      normalized === "tokenexpired" ||
      normalized === "token expired" ||
      (normalized.includes("token") && normalized.includes("expired"))
    );
  };

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
  const syncNowMutation = trpc.socialProgram.syncNow.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.myStatus.invalidate(),
        utils.socialProgram.myProgramDashboard.invalidate(),
        utils.socialProgram.recentPosts.invalidate(),
      ]);
      setSyncDoneAt(Date.now());
      setActionError(null);
    },
    onError: (error: any) => {
      setSyncDoneAt(null);
      setActionError(String(error?.message || "Sync failed. Please try again."));
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
  const hasConnectedPlatform = platformStats.length > 0;

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
      if (isBenignCloseReason(callbackReason)) {
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
    if (isTokenExpiredReason(callbackReason)) {
      setActionSuccess(null);
      setActionError(
        "Social connection session expired. Please tap + to retry.",
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
    if (isLoading) return;
    if (isConnected) return;
    if (hasShownFirstConnectHelpRef.current) return;
    hasShownFirstConnectHelpRef.current = true;
    setShowFirstConnectHelpModal(true);
  }, [isLoading, isConnected]);

  useEffect(() => {
    if (!syncDoneAt) return;
    const timer = setTimeout(() => setSyncDoneAt(null), 10000);
    return () => clearTimeout(timer);
  }, [syncDoneAt]);

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

  const buildConnectSheet = (connectSession: {
    sdkToken: string;
    phylloUserId: string;
    connectConfig?: {
      environment?: string;
      clientDisplayName?: string;
      scriptUrl?: string;
    };
  }) => {
    const callbackUrl = Linking.createURL("/phyllo/callback", {
      queryParams: {
        returnTo: encodeURIComponent("/(trainer)/social-program"),
      },
    });
    const connectBridgeUrl =
      `${appApiBase}/api/phyllo/connect` +
      `?token=${encodeURIComponent(connectSession.sdkToken)}` +
      `&userId=${encodeURIComponent(connectSession.phylloUserId)}` +
      `&environment=${encodeURIComponent(
        connectSession.connectConfig?.environment || "sandbox",
      )}` +
      `&clientDisplayName=${encodeURIComponent(
        connectSession.connectConfig?.clientDisplayName || "LocoMotivate",
      )}` +
      `&scriptUrl=${encodeURIComponent(
        connectSession.connectConfig?.scriptUrl ||
          "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js",
      )}` +
      `&returnTo=${encodeURIComponent(callbackUrl)}`;
    return {
      connectUrl: connectBridgeUrl,
      callbackPrefix: callbackUrl.split("?")[0] || callbackUrl,
      returnTo: encodeURIComponent("/(trainer)/social-program"),
    };
  };

  const retryWebBridgeTokenOnce = async () => {
    if (hasWebBridgeTokenRetryRef.current) {
      setActionSuccess(null);
      setActionError("Social connection session expired. Please tap + to retry.");
      return;
    }
    hasWebBridgeTokenRetryRef.current = true;
    setActionError(null);
    setActionSuccess("Refreshing social session...");
    try {
      let refreshedSession: Awaited<
        ReturnType<typeof startConnectMutation.mutateAsync>
      > | null = null;
      try {
        refreshedSession = await startConnectMutation.mutateAsync({
          forceNewUser: false,
        });
      } catch (firstError: any) {
        const firstMessage = String(firstError?.message || "").toLowerCase();
        const shouldForceNewUser =
          firstMessage.includes("incorrect_user_id") ||
          firstMessage.includes("requested user id does not exist");
        if (!shouldForceNewUser) throw firstError;
        refreshedSession = await startConnectMutation.mutateAsync({
          forceNewUser: true,
        });
      }
      if (refreshedSession?.sdkToken && refreshedSession?.phylloUserId) {
        setNativeConnectSheet(buildConnectSheet(refreshedSession));
        return;
      }
    } catch {
      // Show standard retry prompt below.
    }
    setActionSuccess(null);
    setActionError("Social connection session expired. Please tap + to retry.");
  };

  const handleConnectPhyllo = async () => {
    if (isLaunchingConnect) return;
    hasWebBridgeTokenRetryRef.current = false;
    setIsLaunchingConnect(true);
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
        throw new Error("Could not create a social connect session.");
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
                : connectSession.connectConfig?.environment === "staging"
                  ? "staging"
                  : "sandbox",
            userId: connectSession.phylloUserId,
            token: connectSession.sdkToken,
            clientDisplayName:
              connectSession.connectConfig?.clientDisplayName || "LocoMotivate",
          });

        let result = await launchWebConnect(session);
        if (
          result.status === "failed" &&
          isTokenExpiredReason(String(result.reason || ""))
        ) {
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
          if (isBenignCloseReason(reason)) {
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
            isTokenExpiredReason(String(result.reason || ""))
              ? "Social connection session expired. Please retry."
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
                : connectSession.connectConfig?.environment === "staging"
                  ? "staging"
                  : "sandbox",
            userId: connectSession.phylloUserId,
            token: connectSession.sdkToken,
            clientDisplayName:
              connectSession.connectConfig?.clientDisplayName || "LocoMotivate",
          });

        let activeSession = session;
        let result = await launchNativeConnect(session);
        if (__DEV__) {
          console.log("[Phyllo] Native connect result:", {
            status: result.status,
            reason: result.reason || "",
          });
        }
        if (
          result.status === "failed" &&
          isTokenExpiredReason(String(result.reason || ""))
        ) {
          const retryPlans = [false, true] as const;
          for (const forceNewUser of retryPlans) {
            try {
              const refreshedSession = await startConnectMutation.mutateAsync({
                forceNewUser,
              });
              if (refreshedSession?.sdkToken && refreshedSession?.phylloUserId) {
                activeSession = refreshedSession;
                result = await launchNativeConnect(refreshedSession);
                if (__DEV__) {
                  console.log("[Phyllo] Native connect retry result:", {
                    forceNewUser,
                    status: result.status,
                    reason: result.reason || "",
                  });
                }
                if (
                  result.status !== "failed" ||
                  !isTokenExpiredReason(String(result.reason || ""))
                ) {
                  break;
                }
              }
            } catch (retryError: any) {
              if (__DEV__) {
                console.log("[Phyllo] Native connect retry failed:", {
                  forceNewUser,
                  error: String(retryError?.message || retryError || ""),
                });
              }
            }
          }
        }
        if (
          result.status === "failed" &&
          isTokenExpiredReason(String(result.reason || ""))
        ) {
          setActionSuccess(null);
          setActionError("Social connection session expired. Please tap + to retry.");
          return;
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
          if (isBenignCloseReason(reason)) {
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
            isTokenExpiredReason(String(result.reason || ""))
              ? "Social connection session expired. Please retry."
              : result.reason || "Could not connect your social platforms.";
          setActionError(message);
        }
        return;
      }

      setNativeConnectSheet(buildConnectSheet(session));
      return;
    } catch (error: any) {
      const message = String(
        error?.message || "Unable to connect social platforms right now.",
      ).replace(/phyllo/gi, "social");
      setActionError(message);
    } finally {
      setIsLaunchingConnect(false);
    }
  };

  const openRecentPost = async (post: any) => {
    const targetUrl = String(post?.postUrl || post?.fallbackProfileUrl || "").trim();
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      Alert.alert("Link unavailable", "This item does not have a valid web link yet.");
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (!canOpen) {
        Alert.alert("Link unavailable", "Could not open this post link.");
        return;
      }
      await Linking.openURL(targetUrl);
    } catch {
      Alert.alert("Link unavailable", "Could not open this post link.");
    }
  };

  const handleRefresh = async () => {
    await Promise.all([
      refetchStatus(),
      data?.profile?.phylloUserId ? recentPostsQuery.refetch() : Promise.resolve(),
    ]);
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
              onMessage={(event) => {
                const raw = String(event?.nativeEvent?.data || "").trim();
                if (!raw) return;
                try {
                  const parsed = JSON.parse(raw);
                  if (parsed?.type !== "social_connect_result") return;
                  const status = String(parsed?.status || "").toLowerCase();
                  if (status !== "connected" && status !== "cancelled" && status !== "failed") {
                    return;
                  }
                  const reason = String(parsed?.reason || "");
                  if (status === "failed" && isTokenExpiredReason(reason)) {
                    void retryWebBridgeTokenOnce();
                    return;
                  }
                  setNativeConnectSheet(null);
                  router.replace({
                    pathname: "/phyllo/callback",
                    params: {
                      status,
                      reason,
                      returnTo: nativeConnectSheet.returnTo,
                    },
                  } as any);
                } catch {
                  // Ignore malformed bridge messages.
                }
              }}
              onShouldStartLoadWithRequest={(request) => {
                const requestUrl = String(request?.url || "");
                if (!requestUrl) return true;
                const parsed = Linking.parse(requestUrl);
                const parsedPath = String(parsed.path || "").replace(/^\/+/, "");
                const expectedPath = String(
                  Linking.parse(nativeConnectSheet.callbackPrefix).path || "",
                ).replace(/^\/+/, "");
                const isPhylloCallback = Boolean(
                  parsedPath &&
                    expectedPath &&
                    parsedPath.toLowerCase() === expectedPath.toLowerCase(),
                );
                if (!isPhylloCallback) {
                  return true;
                }
                const status = String(parsed.queryParams?.status || "").toLowerCase();
                const reason = String(parsed.queryParams?.reason || "");
                if (status === "failed" && isTokenExpiredReason(reason)) {
                  void retryWebBridgeTokenOnce();
                  return false;
                }
                setNativeConnectSheet(null);
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
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingStatus || recentPostsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{
          paddingBottom: Platform.OS === "web" ? 116 : 92,
        }}
      >
        <ScreenHeader
          title="Get Paid for Social Posts."
          subtitle="Join campaigns, track compliance, and earn from approved social content."
          leftSlot={
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(trainer)/more" as any))}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="social-program-back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
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
              Connect your social accounts, unlock campaign invites, and track your progress
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

          {!hasConnectedPlatform ? (
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
          ) : null}

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
            <SurfaceCard style={{ position: "relative", overflow: "visible" }}>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-semibold text-foreground">
                  Authorized platforms
                </Text>
                <View className="flex-row items-center gap-2">
                  {isConnected ? (
                    <Pressable
                      onPress={() => syncNowMutation.mutate()}
                      disabled={syncNowMutation.isPending}
                      className="px-2.5 py-1 rounded-full border border-border flex-row items-center"
                      style={{
                        backgroundColor: colors.surface,
                        opacity: syncNowMutation.isPending ? 0.7 : 1,
                        borderColor: syncDoneAt ? "rgba(52,211,153,0.45)" : colors.border,
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Sync social stats now"
                      testID="social-status-sync-now"
                    >
                      {syncNowMutation.isPending ? (
                        <ActivityIndicator size="small" color={colors.muted} />
                      ) : (
                        <MaterialCommunityIcons
                          name={syncDoneAt ? "check-circle" : "refresh"}
                          size={12}
                          color={syncDoneAt ? "#34D399" : colors.muted}
                        />
                      )}
                      <Text
                        className="text-[11px] ml-1"
                        style={{ color: syncDoneAt ? "#34D399" : colors.muted }}
                      >
                        {syncNowMutation.isPending
                          ? "Syncing..."
                          : syncDoneAt
                            ? "Synced"
                            : "Sync now"}
                      </Text>
                    </Pressable>
                  ) : null}
                  {hasConnectedPlatform ? (
                    <Pressable
                      onPress={() => setShowRequirementsModal(true)}
                      className="w-7 h-7 rounded-full items-center justify-center border border-border"
                      style={{ backgroundColor: colors.surface }}
                      accessibilityRole="button"
                      accessibilityLabel="Show program requirements"
                      testID="social-status-requirements-help"
                    >
                      <MaterialCommunityIcons
                        name="help-circle-outline"
                        size={16}
                        color={colors.muted}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <Text className="text-sm text-muted">
                Membership:{" "}
                <Text className="text-foreground font-semibold capitalize">
                  {String(membershipStatus).replace(/_/g, " ")}
                </Text>
              </Text>
              <Text className="text-sm text-muted mt-1">
                Social accounts connected:{" "}
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
              <View
                className="gap-2 mt-3"
                style={isConnected ? { paddingBottom: 56 } : undefined}
              >
                {platformStats.length > 0 ? (
                  platformStats.map((row) => {
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
                  })
                ) : (
                  <Text className="text-xs text-muted">None linked yet</Text>
                )}
              </View>
              <Pressable
                onPress={handleConnectPhyllo}
                disabled={isLaunchingConnect}
                style={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isLaunchingConnect ? 0.9 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  isConnected
                    ? "Connect more platforms"
                    : hasPendingInvite
                      ? "Accept invite and connect first platform"
                      : "Connect your first platform"
                }
                testID="social-connect-more-fab"
              >
                {isLaunchingConnect ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                )}
              </Pressable>
            </SurfaceCard>
          )}

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
            onPress={() => router.push("/(trainer)/social-progress" as any)}
            accessibilityRole="button"
            accessibilityLabel="Open dashboard"
            testID="social-open-progress"
          >
            Dashboard
          </ActionButton>

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
                Tip: once accepted, tap (+) to start syncing your social profiles.
              </Text>
            </SurfaceCard>
          ) : null}

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Recent posts
            </Text>
            {!isConnected ? (
              <Text className="text-sm text-muted">
                Connect your first platform to start seeing recent posts.
              </Text>
            ) : recentPostsQuery.isLoading ? (
              <View className="py-3 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-xs text-muted mt-2">Loading recent posts...</Text>
              </View>
            ) : (recentPostsQuery.data || []).length === 0 ? (
              <Text className="text-sm text-muted">
                No synced posts yet. New content will appear here after social events are received.
              </Text>
            ) : (
              <View className="gap-2">
                {(recentPostsQuery.data || []).map((post: any) => {
                  const platformIcon = getSocialPlatformIcon(post.platform || "unknown");
                  const linkTarget = String(
                    post.postUrl || post.fallbackProfileUrl || "",
                  ).trim();
                  const hasLink = /^https?:\/\//i.test(linkTarget);
                  const sparklineRaw = Array.isArray(post.sparkline)
                    ? post.sparkline
                    : [];
                  const sparkline =
                    sparklineRaw.length > 0
                      ? sparklineRaw
                      : [Number(post.latestEngagements || 0)];
                  const sparklineMax = Math.max(1, ...sparkline.map((v: any) => Number(v || 0)));
                  return (
                    <Pressable
                      key={post.id}
                      onPress={() => hasLink && openRecentPost(post)}
                      disabled={!hasLink}
                      className="rounded-xl border border-border px-3 py-2"
                      style={{ opacity: hasLink ? 1 : 0.62 }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        hasLink
                          ? `Open recent post on ${platformIcon.label}`
                          : `Recent post on ${platformIcon.label} has no link yet`
                      }
                      testID={`social-recent-post-${post.id}`}
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                          <View className="flex-row items-center">
                            <MaterialCommunityIcons
                              name={platformIcon.icon as any}
                              size={14}
                              color={platformIcon.color}
                            />
                            <Text className="text-xs text-muted ml-1.5">
                              {platformIcon.label}
                            </Text>
                          </View>
                          <Text className="text-sm text-foreground mt-1" numberOfLines={2}>
                            {post.title ||
                              post.caption ||
                              "Recent social post"}
                          </Text>
                          <Text className="text-[11px] text-muted mt-1">
                            {post.publishedAt
                              ? new Date(post.publishedAt).toLocaleDateString()
                              : "Recently synced"}
                          </Text>
                        </View>
                        <View className="items-end min-w-[92px]">
                          <View className="flex-row items-end h-8">
                            {sparkline.slice(-10).map((point: number, idx: number) => {
                              const h = Math.max(
                                2,
                                Math.round((Number(point || 0) / sparklineMax) * 26),
                              );
                              return (
                                <View
                                  key={`${post.id}-spark-${idx}`}
                                  style={{
                                    width: 4,
                                    height: h,
                                    borderRadius: 2,
                                    marginLeft: idx === 0 ? 0 : 2,
                                    backgroundColor: `${colors.primary}CC`,
                                  }}
                                />
                              );
                            })}
                          </View>
                          <Text className="text-[11px] text-muted mt-1">
                            Eng: {Number(post.latestEngagements || 0).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </SurfaceCard>
        </View>
      </ScrollView>
      <Modal
        visible={showFirstConnectHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFirstConnectHelpModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            justifyContent: "center",
            padding: 16,
          }}
          onPress={() => setShowFirstConnectHelpModal(false)}
          accessibilityRole="button"
          accessibilityLabel="Close connect help modal"
          testID="social-first-connect-help-overlay"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-xl border border-border p-4"
            style={{ backgroundColor: colors.background }}
            accessibilityRole="none"
          >
            <Text className="text-base font-semibold text-foreground mb-2">
              Connect your first platform
            </Text>
            <Text className="text-sm text-muted">
              Tap the <Text className="text-foreground font-semibold">(+)</Text>{" "}
              button in the lower-right of the Authorized platforms card to connect
              your first social media platform.
            </Text>
            <ActionButton
              className="mt-3"
              variant="secondary"
              onPress={() => setShowFirstConnectHelpModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Got it"
              testID="social-first-connect-help-close"
            >
              Got it
            </ActionButton>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        visible={showRequirementsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRequirementsModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            justifyContent: "center",
            padding: 16,
          }}
          onPress={() => setShowRequirementsModal(false)}
          accessibilityRole="button"
          accessibilityLabel="Close requirements modal"
          testID="social-requirements-modal-overlay"
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="rounded-xl border border-border p-4"
            style={{ backgroundColor: colors.background }}
            accessibilityRole="none"
          >
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
            <ActionButton
              className="mt-3"
              variant="secondary"
              onPress={() => setShowRequirementsModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Close program requirements"
              testID="social-requirements-modal-close"
            >
              Close
            </ActionButton>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
