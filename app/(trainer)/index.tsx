import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useAuthContext } from "@/contexts/auth-context";
import { trackLaunchEvent } from "@/lib/analytics";
import { getOfferFallbackImageUrl, normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBPFromMinor } from "@/lib/currency";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type NextAction = "invite" | "offer" | "pay" | "done";
type PaymentStatus = "awaiting_payment" | "paid" | "paid_out";
type OfferStatus = "draft" | "in_review" | "published" | "archived";
type PendingPaymentRow = {
  id: string;
  merchantReference: string;
  amountMinor: number;
  description: string | null;
  createdAt: string;
  paymentLink: string | null;
  method: string | null;
  rawStatus?: string | null;
};

type HeroConfig = {
  title: string;
  subtitle: string;
  cta: string;
  ctaIcon: React.ComponentProps<typeof IconSymbol>["name"];
  onPress: () => void;
};

type TierName = "Getting Started" | "Growing" | "Pro" | "Elite";

const TIER_ORDER: TierName[] = ["Getting Started", "Growing", "Pro", "Elite"];
const TIER_MIN_POINTS: Record<TierName, number> = {
  "Getting Started": 0,
  Growing: 1000,
  Pro: 2000,
  Elite: 5000,
};

const TEST_STATE_SEQUENCE: NextAction[] = ["invite", "offer", "pay", "done"];

const DASH = {
  page: "#0A0A14",
  surface: "#151520",
  card: "#171C2B",
  cardSoft: "#141A28",
  primary: "#60A5FA",
  text: "#F8FAFC",
  muted: "#94A3B8",
  border: "rgba(148,163,184,0.22)",
  borderStrong: "rgba(96,165,250,0.5)",
  chipBg: "rgba(96,165,250,0.16)",
  chipText: "#BFDBFE",
};

const CARD_STYLE = { backgroundColor: DASH.card, borderColor: DASH.border };
const CARD_SOFT_STYLE = { backgroundColor: DASH.cardSoft, borderColor: DASH.border };
const HERO_STYLE = { backgroundColor: "#312E81", borderColor: "rgba(167,139,250,0.65)" };
const SECTION_SPACING_CLASS = "px-6 mb-7";
const ACTION_ICON_WRAP_STYLE = { backgroundColor: "rgba(96,165,250,0.2)" };
const ACTION_TILE_STYLE = { backgroundColor: "rgba(21,21,32,0.94)", borderColor: "rgba(148,163,184,0.22)" };
const ACTION_TILE_FIXED_HEIGHT = 140;
const HERO_GLOW_MAIN_STYLE = { backgroundColor: "rgba(168,85,247,0.5)" };
const HERO_GLOW_SECOND_STYLE = { backgroundColor: "rgba(59,130,246,0.38)" };
const CHIP_STYLE = { backgroundColor: "rgba(167,139,250,0.22)", borderColor: "rgba(196,181,253,0.44)" };
const MUTED_BADGE_STYLE = { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" };

const ACTIVITY_STATUS_STYLE: Record<PaymentStatus, { bg: string; text: string; label: string }> = {
  awaiting_payment: { bg: "rgba(250,204,21,0.15)", text: "#FACC15", label: "Awaiting payment" },
  paid: { bg: "rgba(52,211,153,0.18)", text: "#34D399", label: "Paid" },
  paid_out: { bg: "rgba(96,165,250,0.18)", text: DASH.primary, label: "Paid out" },
};

const OFFER_STATUS_STYLE: Record<OfferStatus, { bg: string; border: string; text: string; label: string }> = {
  draft: { bg: "rgba(250,204,21,0.15)", border: "rgba(250,204,21,0.3)", text: "#FACC15", label: "Draft" },
  in_review: { bg: "rgba(96,165,250,0.2)", border: "rgba(96,165,250,0.34)", text: DASH.primary, label: "In review" },
  published: { bg: "rgba(52,211,153,0.18)", border: "rgba(52,211,153,0.35)", text: "#34D399", label: "Published" },
  archived: { bg: "rgba(248,113,113,0.16)", border: "rgba(248,113,113,0.32)", text: "#F87171", label: "Archived" },
};

function formatDateShort(value: string | Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatOfferType(value: string | undefined) {
  if (!value) return "Offer";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getNameInitials(name: unknown): string {
  const parts = String(name || "Client")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function toUsagePercent(used: unknown, included: unknown): number {
  const usedValue = Number(used || 0);
  const includedValue = Number(included || 0);
  if (!Number.isFinite(usedValue) || !Number.isFinite(includedValue) || includedValue <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((usedValue / includedValue) * 100)));
}

function extractListItemsFromHtml(description: string): string[] {
  const names: string[] = [];
  const liMatches = description.matchAll(/<li>(.*?)<\/li>/gi);
  for (const match of liMatches) {
    const raw = String(match[1] || "");
    const withoutTags = raw.replace(/<[^>]+>/g, "");
    const withoutQty = withoutTags.replace(/\(x\d+\)/gi, "");
    const cleaned = withoutQty.trim();
    if (cleaned) names.push(cleaned);
  }
  return names;
}

function toFirstName(value: string | null | undefined) {
  if (!value) return "there";
  const first = value.trim().split(/\s+/)[0];
  return first || "there";
}

function SectionHeader({
  title,
  actionLabel,
  onActionPress,
}: {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}) {
  return (
    <View className="px-6 mb-4 flex-row items-center justify-between">
      <Text className="text-lg font-bold" style={{ color: DASH.text }}>
        {title}
      </Text>
      {actionLabel && onActionPress ? (
        <TouchableOpacity
          className="px-1 py-1"
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-sm font-bold" style={{ color: DASH.primary }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function QuickActionButton({
  icon,
  label,
  subtitle,
  value,
  onPress,
  testID,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  label: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <View className="w-1/2 p-1.5">
      <TouchableOpacity
        className="rounded-xl border p-4 items-center justify-center"
        style={{ ...ACTION_TILE_STYLE, height: ACTION_TILE_FIXED_HEIGHT }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
      >
        <View className={`w-12 h-12 rounded-full items-center justify-center ${subtitle || value ? "mb-1.5" : "mb-2"}`} style={ACTION_ICON_WRAP_STYLE}>
          <IconSymbol name={icon} size={20} color={DASH.primary} />
        </View>
        <Text className="text-sm font-semibold text-center" style={{ color: DASH.text }} numberOfLines={1}>
          {label}
        </Text>
        {subtitle ? (
          <Text className="text-[11px] mt-1 text-center" style={{ color: DASH.muted }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {value ? (
          <Text className="text-[11px] mt-0.5 text-center font-semibold" style={{ color: DASH.primary }} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

function EmptyModuleCard({
  icon,
  description,
  cta,
  onPress,
}: {
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  description: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <SurfaceCard style={CARD_STYLE}>
      <View className="items-center py-4">
        <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
          <IconSymbol name={icon} size={28} color="#64748B" />
        </View>
        <Text className="text-sm text-center leading-5 px-2" style={{ color: "#A7B5CC" }}>
          {description}
        </Text>
        <TouchableOpacity
          className="mt-3 px-5 py-2 rounded-full border"
          style={MUTED_BADGE_STYLE}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={cta}
        >
          <Text className="text-sm font-bold" style={{ color: DASH.text }}>
            {cta}
          </Text>
        </TouchableOpacity>
      </View>
    </SurfaceCard>
  );
}

function StepPill({
  label,
  isDone,
  isCurrent,
}: {
  label: string;
  isDone: boolean;
  isCurrent: boolean;
}) {
  return (
    <View
      className="flex-row items-center rounded-full px-2.5 py-1 border"
      style={{
        backgroundColor: isDone || isCurrent ? "rgba(96,165,250,0.16)" : "rgba(255,255,255,0.05)",
        borderColor: isDone || isCurrent ? "rgba(96,165,250,0.36)" : "rgba(255,255,255,0.12)",
      }}
    >
      <View
        className="w-4 h-4 rounded-full items-center justify-center mr-1.5"
        style={{ backgroundColor: isDone || isCurrent ? "rgba(96,165,250,0.24)" : "rgba(148,163,184,0.25)" }}
      >
        {isDone ? (
          <IconSymbol name="checkmark" size={10} color={DASH.primary} />
        ) : (
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isCurrent ? DASH.primary : "#94A3A0" }} />
        )}
      </View>
      <Text className="text-[11px] font-medium" style={{ color: isDone || isCurrent ? DASH.text : DASH.muted }}>
        {label}
      </Text>
    </View>
  );
}

export default function TrainerHomeScreen() {
  const { effectiveUser } = useAuthContext();
  const utils = trpc.useUtils();
  const [testStateOverride, setTestStateOverride] = useState<NextAction | null>(null);
  const [earningsExpanded, setEarningsExpanded] = useState(false);
  const [pendingPaymentsVisible, setPendingPaymentsVisible] = useState(false);
  const heroScaleAnim = useRef(new Animated.Value(1)).current;
  const ctaScaleAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const stepProgressAnim = useRef(new Animated.Value(1)).current;
  const glowFloatAnim = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(0)).current;

  const {
    data: clients = [],
    isLoading: clientsLoading,
    isRefetching: clientsRefetching,
    refetch: refetchClients,
  } = trpc.clients.list.useQuery();
  const {
    data: offers = [],
    isLoading: offersLoading,
    isRefetching: offersRefetching,
    refetch: refetchOffers,
  } = trpc.offers.list.useQuery();
  const { data: products = [] } = trpc.catalog.products.useQuery();
  const {
    data: paymentStats,
    isLoading: statsLoading,
    isRefetching: statsRefetching,
    refetch: refetchStats,
  } = trpc.payments.stats.useQuery();
  const {
    data: invitations = [],
    isLoading: invitationsLoading,
    isRefetching: invitationsRefetching,
    refetch: refetchInvitations,
  } = trpc.clients.invitations.useQuery();
  const {
    data: payoutSummary,
    isLoading: payoutLoading,
    isRefetching: payoutRefetching,
    refetch: refetchPayouts,
  } = trpc.payments.payoutSummary.useQuery();
  const {
    data: recentActivity = [],
    isLoading: activityLoading,
    isRefetching: activityRefetching,
    refetch: refetchActivity,
  } = trpc.payments.history.useQuery({ limit: 6 });
  const {
    data: pendingPaymentHistory = [],
    isLoading: pendingPaymentsLoading,
    isRefetching: pendingPaymentsRefetching,
    refetch: refetchPendingPayments,
  } = trpc.payments.history.useQuery({ limit: 100, status: "awaiting_payment" });
  const {
    data: pointsData,
    isLoading: pointsLoading,
    isRefetching: pointsRefetching,
    refetch: refetchPoints,
  } = trpc.trainerDashboard.points.useQuery();

  const isRefetching =
    clientsRefetching ||
    offersRefetching ||
    statsRefetching ||
    invitationsRefetching ||
    payoutRefetching ||
    activityRefetching ||
    pendingPaymentsRefetching ||
    pointsRefetching;

  const hasClient = clients.length > 0;
  const hasPendingInvite = invitations.some((invite) => {
    const status = (invite.status || "pending").toLowerCase();
    return status === "pending";
  });
  const hasClientOrInvite = hasClient || hasPendingInvite;
  const hasOffer = offers.length > 0;
  const hasPayment = (paymentStats?.paid || 0) > 0 || (paymentStats?.paidOut || 0) > 0;
  const liveNextAction: NextAction = !hasClientOrInvite ? "invite" : !hasOffer ? "offer" : !hasPayment ? "pay" : "done";
  const nextAction: NextAction = testStateOverride ?? liveNextAction;
  const displayHasPayment = nextAction === "done";
  const totalPoints = pointsData?.totalPoints || 0;
  const statusTier = (pointsData?.statusTier as TierName | undefined) || "Getting Started";
  const currentTierIndex = Math.max(0, TIER_ORDER.indexOf(statusTier));
  const nextTier = currentTierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentTierIndex + 1] : null;
  const currentTierMin = TIER_MIN_POINTS[statusTier];
  const nextTierMin = nextTier ? TIER_MIN_POINTS[nextTier] : currentTierMin;
  const tierRange = Math.max(1, nextTierMin - currentTierMin);
  const rawTierProgress = nextTier ? (totalPoints - currentTierMin) / tierRange : 1;
  const tierProgress = Math.max(0, Math.min(1, rawTierProgress));
  const pointsToNextTier = nextTier ? Math.max(0, nextTierMin - totalPoints) : 0;
  const pendingPaymentRows = useMemo(() => {
    return (pendingPaymentHistory as PendingPaymentRow[]).filter((payment) => {
      const method = (payment.method || "").toLowerCase();
      const rawStatus = (payment.rawStatus || "").toLowerCase();
      if (method !== "link") return false;
      return rawStatus === "created" || rawStatus === "pending";
    });
  }, [pendingPaymentHistory]);
  const pendingPaymentsCount = pendingPaymentRows.length;
  const pendingPaymentsTotalMinor = useMemo(
    () => pendingPaymentRows.reduce((sum, payment) => sum + (payment.amountMinor || 0), 0),
    [pendingPaymentRows],
  );

  const cancelPendingPayment = trpc.payments.cancelLink.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.payments.history.invalidate(),
        utils.payments.stats.invalidate(),
      ]);
    },
  });

  const previewClients = (clients.filter((client) => client.status === "active").length > 0
    ? clients.filter((client) => client.status === "active")
    : clients
  ).slice(0, 3);

  const previewOffers = (offers.filter((offer) => offer.status === "published").length > 0
    ? offers.filter((offer) => offer.status === "published")
    : offers
  ).slice(0, 2);

  const productImageByName = useMemo(() => {
    const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const imageMap = new Map<string, string>();
    for (const product of products as any[]) {
      if (!product?.name || !product?.imageUrl) continue;
      const normalizedName = normalizeName(String(product.name));
      const normalizedImage = normalizeAssetUrl(String(product.imageUrl));
      if (!normalizedImage) continue;
      if (!imageMap.has(normalizedName)) imageMap.set(normalizedName, normalizedImage);
    }
    return imageMap;
  }, [products]);

  const productImageEntries = useMemo(() => Array.from(productImageByName.entries()), [productImageByName]);

  const getOfferImageUrl = (offer: any): string => {
    const directImage = normalizeAssetUrl(offer?.imageUrl);
    if (directImage) return directImage;

    const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
    const candidates = new Set<string>();

    if (offer?.title) candidates.add(normalizeName(String(offer.title)));
    if (Array.isArray(offer?.included)) {
      for (const included of offer.included) {
        if (typeof included === "string" && included.trim()) {
          candidates.add(normalizeName(included));
        }
      }
    }
    if (typeof offer?.description === "string" && offer.description.trim()) {
      for (const item of extractListItemsFromHtml(offer.description)) {
        candidates.add(normalizeName(item));
      }
    }

    for (const name of candidates) {
      const exactMatch = productImageByName.get(name);
      if (exactMatch) return exactMatch;
    }

    for (const name of candidates) {
      for (const [productName, imageUrl] of productImageEntries) {
        if (name.includes(productName) || productName.includes(name)) {
          return imageUrl;
        }
      }
    }

    return getOfferFallbackImageUrl(offer?.title);
  };

  const heroStep = nextAction === "invite" ? 1 : nextAction === "offer" ? 2 : 3;

  const heroConfig: HeroConfig = (() => {
    if (nextAction === "invite") {
      return {
        title: "You’re 2 steps away from your first payout",
        subtitle: "Invite your first client and set up an offer to start earning.",
        cta: "Invite client",
        ctaIcon: "person.badge.plus",
        onPress: () => {
          trackLaunchEvent("trainer_home_next_action_tapped", { step: "invite" });
          router.push("/(trainer)/invite" as any);
        },
      };
    }
    if (nextAction === "offer") {
      return {
        title: "Create your first offer",
        subtitle: "Package your expertise into a clear, client-ready plan.",
        cta: "Create offer",
        ctaIcon: "sparkles",
        onPress: () => {
          trackLaunchEvent("trainer_home_next_action_tapped", { step: "offer" });
          router.push("/(trainer)/offers/new" as any);
        },
      };
    }
    if (nextAction === "pay") {
      return {
        title: "Share your payment link",
        subtitle: "Get paid online or in person in under a minute.",
        cta: "Get paid",
        ctaIcon: "square.and.arrow.up",
        onPress: () => {
          trackLaunchEvent("trainer_home_next_action_tapped", { step: "pay" });
          router.push("/(trainer)/get-paid" as any);
        },
      };
    }
    return {
      title: `You’ve earned ${formatGBPFromMinor(paymentStats?.totalPaidMinor || 0)}`,
      subtitle: "Bonus status unlocked. Track your tier progress and climb to the next level.",
      cta: "Open rewards",
      ctaIcon: "star.fill",
      onPress: () => {
        trackLaunchEvent("trainer_home_next_action_tapped", { step: "bonus" });
        router.push("/(trainer)/rewards" as any);
      },
    };
  })();

  const onRefresh = async () => {
    await Promise.all([
      refetchClients(),
      refetchOffers(),
      refetchStats(),
      refetchInvitations(),
      refetchPayouts(),
      refetchActivity(),
      refetchPendingPayments(),
      refetchPoints(),
    ]);
  };

  const handleAdvanceTestState = () => {
    setTestStateOverride((prev) => {
      const current = prev ?? liveNextAction;
      const index = TEST_STATE_SEQUENCE.indexOf(current);
      const nextIndex =
        index >= 0 && index < TEST_STATE_SEQUENCE.length - 1 ? index + 1 : TEST_STATE_SEQUENCE.length - 1;
      return TEST_STATE_SEQUENCE[nextIndex];
    });
  };

  const handleResetTestState = () => {
    setTestStateOverride("invite");
  };

  useEffect(() => {
    stepProgressAnim.setValue(heroStep - 0.4);
    sparkleAnim.setValue(0);
    Animated.parallel([
      Animated.timing(stepProgressAnim, {
        toValue: heroStep,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(heroScaleAnim, {
          toValue: 1.03,
          duration: 170,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(heroScaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(ctaScaleAnim, {
          toValue: 1.08,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaScaleAnim, {
          toValue: 1,
          duration: 190,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(sparkleAnim, {
        toValue: 1,
        duration: 650,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [ctaScaleAnim, heroScaleAnim, heroStep, sparkleAnim, stepProgressAnim]);

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowFloatAnim, {
          toValue: 1,
          duration: 4400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowFloatAnim, {
          toValue: 0,
          duration: 4400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulseAnim, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulseAnim, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    floatLoop.start();
    pulseLoop.start();
    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [glowFloatAnim, glowPulseAnim]);

  const sparkleRotate = sparkleAnim.interpolate({
    inputRange: [0, 0.35, 0.7, 1],
    outputRange: ["0deg", "22deg", "-16deg", "0deg"],
  });
  const sparkleY = sparkleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -7, 0],
  });
  const topGlowTranslateX = glowFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });
  const topGlowTranslateY = glowFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -14],
  });
  const topGlowScale = glowPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.16],
  });
  const bottomGlowTranslateX = glowFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -16],
  });
  const bottomGlowTranslateY = glowFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 14],
  });
  const bottomGlowScale = glowPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.14],
  });

  const openGetPaid = (source: string, mode?: "tap" | "link") => {
    trackLaunchEvent("trainer_home_next_action_tapped", { step: source, mode: mode || "default" });
    router.push({
      pathname: "/(trainer)/get-paid",
      ...(mode ? { params: { mode } } : {}),
    } as any);
  };

  const handleSendReminder = async (payment: PendingPaymentRow) => {
    if (!payment.paymentLink) {
      Alert.alert("No payment link", "This payment does not have a shareable link.");
      return;
    }
    const amount = formatGBPFromMinor(payment.amountMinor || 0);
    const message = `Friendly reminder: ${payment.description || "Training payment"} (${amount}) is still pending.\n\n${payment.paymentLink}`;
    await Share.share({ message, url: payment.paymentLink });
  };

  const handleCancelPendingPayment = (payment: PendingPaymentRow) => {
    Alert.alert(
      "Cancel payment link?",
      "The client will no longer be able to pay using this link.",
      [
        { text: "Keep link", style: "cancel" },
        {
          text: "Cancel link",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelPendingPayment.mutateAsync({ merchantReference: payment.merchantReference });
            } catch (error: any) {
              Alert.alert("Unable to cancel", error?.message || "Please try again.");
            }
          },
        },
      ],
    );
  };

  const totalEarned = formatGBPFromMinor(paymentStats?.totalPaidMinor || 0);
  const availableEarnings = formatGBPFromMinor(Math.round((payoutSummary?.available || 0) * 100));
  const pendingEarnings = formatGBPFromMinor(Math.round((payoutSummary?.pending || 0) * 100));
  const firstName = useMemo(() => toFirstName(effectiveUser?.name), [effectiveUser?.name]);

  const quickActions = [
    {
      icon: "person.badge.plus" as const,
      label: "Invite",
      onPress: () => router.push("/(trainer)/invite" as any),
      testID: "trainer-quick-invite",
    },
    {
      icon: "sparkles" as const,
      label: "Create offer",
      onPress: () => {
        trackLaunchEvent("trainer_home_next_action_tapped", { step: "offer" });
        router.push("/(trainer)/offers/new" as any);
      },
      testID: "trainer-quick-offer",
    },
    {
      icon: "creditcard.fill" as const,
      label: "Get paid",
      onPress: () => openGetPaid("get_paid"),
      testID: "trainer-quick-get-paid",
    },
    {
      icon: "clock" as const,
      label: "Pending payments",
      subtitle: pendingPaymentsLoading ? "Loading..." : `${pendingPaymentsCount} outstanding`,
      value: formatGBPFromMinor(pendingPaymentsTotalMinor),
      onPress: () => setPendingPaymentsVisible(true),
      testID: "trainer-quick-pending-payments",
    },
  ];

  const activityRows = recentActivity.slice(0, 5);
  const hasAnyLoading =
    clientsLoading ||
    offersLoading ||
    statsLoading ||
    invitationsLoading ||
    payoutLoading ||
    activityLoading ||
    pendingPaymentsLoading ||
    pointsLoading;

  return (
    <ScreenContainer
      containerClassName="bg-[#0A0A14]"
      safeAreaClassName="bg-[#0A0A14]"
      className="bg-[#0A0A14]"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={DASH.primary} />}
      >
        <View className="px-6 pt-3 pb-4">
          <View className="pr-24">
            <Text className="text-3xl font-bold tracking-tight" style={{ color: DASH.text }}>
              Hi, {firstName} 👋
            </Text>
            <Text className="text-sm mt-1" style={{ color: DASH.muted }}>
              Let’s get you paid.
            </Text>
          </View>
        </View>

        <View className={SECTION_SPACING_CLASS}>
          <Animated.View style={{ transform: [{ scale: heroScaleAnim }] }}>
            <SurfaceCard className="relative overflow-hidden" style={HERO_STYLE}>
            <Animated.View
              pointerEvents="none"
              style={[
                HERO_GLOW_MAIN_STYLE,
                {
                  position: "absolute",
                  top: -70,
                  right: -62,
                  width: 190,
                  height: 190,
                  borderRadius: 999,
                  transform: [
                    { translateX: topGlowTranslateX },
                    { translateY: topGlowTranslateY },
                    { scale: topGlowScale },
                  ],
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                HERO_GLOW_SECOND_STYLE,
                {
                  position: "absolute",
                  bottom: -72,
                  left: -52,
                  width: 172,
                  height: 172,
                  borderRadius: 999,
                  transform: [
                    { translateX: bottomGlowTranslateX },
                    { translateY: bottomGlowTranslateY },
                    { scale: bottomGlowScale },
                  ],
                },
              ]}
            />

            <View className="self-start flex-row items-center px-3 py-1 rounded-full border mb-3" style={CHIP_STYLE}>
              <Text className="text-[11px] font-bold tracking-[1px]" style={{ color: DASH.chipText }}>
                WHAT IS NEXT
              </Text>
              <Animated.Text
                style={{
                  marginLeft: 6,
                  transform: [{ rotate: sparkleRotate }, { translateY: sparkleY }],
                }}
              >
                ✨
              </Animated.Text>
            </View>

            <Text className="text-[12px] uppercase tracking-[1px] mb-1" style={{ color: "#A7B4CA" }}>
              Progress
            </Text>
            <Text className="text-xl font-bold mb-2" style={{ color: DASH.text }}>
              {heroConfig.title}
            </Text>
            <Text className="text-sm mb-5" style={{ color: "#B6C2D6" }}>
              {heroConfig.subtitle}
            </Text>

            <View className="flex-row items-center gap-2 mb-6">
              {[1, 2, 3].map((step) => (
                <Animated.View
                  key={step}
                  className="flex-1 h-2 rounded-full"
                  style={{
                    backgroundColor: step <= heroStep ? DASH.primary : "rgba(255,255,255,0.10)",
                    opacity: stepProgressAnim.interpolate({
                      inputRange: [step - 0.5, step],
                      outputRange: [0.5, 1],
                      extrapolate: "clamp",
                    }),
                    transform: [
                      {
                        scaleY: stepProgressAnim.interpolate({
                          inputRange: [step - 0.5, step],
                          outputRange: [0.86, 1.18],
                          extrapolate: "clamp",
                        }),
                      },
                    ],
                  }}
                />
              ))}
              <Text className="text-xs font-bold ml-2" style={{ color: DASH.primary }}>
                {heroStep}/3
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-2 mb-5">
              <StepPill label="Invite client" isDone={heroStep > 1} isCurrent={heroStep === 1} />
              <StepPill label="Create offer" isDone={heroStep > 2} isCurrent={heroStep === 2} />
              <StepPill label={nextAction === "done" ? "Bonus status" : "Get paid"} isDone={nextAction === "done"} isCurrent={heroStep === 3} />
            </View>

            {nextAction === "done" ? (
              <View
                className="rounded-xl border px-3 py-3 mb-5"
                style={{ backgroundColor: "rgba(15,23,42,0.28)", borderColor: "rgba(167,139,250,0.35)" }}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold" style={{ color: DASH.text }}>
                    Rating
                  </Text>
                  <View className="flex-row items-center">
                    <IconSymbol name="star.fill" size={14} color="#FBBF24" />
                    <Text className="text-sm font-semibold ml-1" style={{ color: "#FDE68A" }}>
                      {statusTier}
                    </Text>
                  </View>
                </View>
                <View className="mt-2 h-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                  <View
                    className="h-2 rounded-full"
                    style={{ width: `${Math.round(tierProgress * 100)}%`, backgroundColor: "#A78BFA" }}
                  />
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs" style={{ color: "#C4B5FD" }}>
                    {totalPoints.toLocaleString()} pts
                  </Text>
                  <Text className="text-xs" style={{ color: "#C4B5FD" }}>
                    {nextTier ? `${pointsToNextTier.toLocaleString()} pts to ${nextTier}` : "Top tier reached"}
                  </Text>
                </View>
              </View>
            ) : null}

            <Animated.View style={{ transform: [{ scale: ctaScaleAnim }] }}>
              <TouchableOpacity
                className="w-full rounded-lg py-4 flex-row items-center justify-center"
                style={{ backgroundColor: DASH.primary }}
                onPress={heroConfig.onPress}
                accessibilityRole="button"
                accessibilityLabel={heroConfig.cta}
                testID="trainer-state-machine-primary"
              >
                <IconSymbol name={heroConfig.ctaIcon} size={18} color="#0B1020" />
                <Text className="font-bold ml-2" style={{ color: "#0B1020" }}>
                  {heroConfig.cta}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity
              className="w-full rounded-lg py-4 mt-3 border items-center"
              style={{ borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)" }}
              onPress={() => openGetPaid("hero_secondary")}
              accessibilityRole="button"
              accessibilityLabel="Take payment now"
              testID="trainer-state-machine-secondary"
            >
              <Text className="font-semibold" style={{ color: DASH.text }}>
                💰Skip to Take Payment NOW
              </Text>
            </TouchableOpacity>

            {__DEV__ ? (
              <View className="mt-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
                <Text className="text-xs mb-2" style={{ color: DASH.muted }}>
                  Testing controls
                  {testStateOverride ? ` (${testStateOverride})` : " (live)"}
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className="flex-1 rounded-xl py-2.5 items-center border"
                    style={MUTED_BADGE_STYLE}
                    onPress={handleAdvanceTestState}
                    accessibilityRole="button"
                    accessibilityLabel="Advance trainer state for testing"
                    testID="trainer-state-advance"
                  >
                    <Text className="text-xs font-semibold" style={{ color: DASH.text }}>
                      Next state
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-1 rounded-xl py-2.5 items-center border"
                    style={MUTED_BADGE_STYLE}
                    onPress={handleResetTestState}
                    accessibilityRole="button"
                    accessibilityLabel="Reset trainer state walkthrough"
                    testID="trainer-state-reset"
                  >
                    <Text className="text-xs font-semibold" style={{ color: DASH.text }}>
                      Reset walkthrough
                    </Text>
                  </TouchableOpacity>
                </View>
                {testStateOverride ? (
                  <TouchableOpacity
                    className="mt-2 rounded-xl py-2.5 items-center border"
                    style={MUTED_BADGE_STYLE}
                    onPress={() => setTestStateOverride(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Use live trainer state"
                    testID="trainer-state-live"
                  >
                    <Text className="text-xs font-semibold" style={{ color: DASH.text }}>
                      Use live state
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
            </SurfaceCard>
          </Animated.View>
        </View>

        <SectionHeader title="Quick actions" />
        <View className={SECTION_SPACING_CLASS}>
          <View className="flex-row flex-wrap -m-1.5">
            {quickActions.map((action) => (
              <QuickActionButton
                key={action.testID}
                icon={action.icon}
                label={action.label}
                subtitle={action.subtitle}
                value={action.value}
                onPress={action.onPress}
                testID={action.testID}
              />
            ))}
          </View>
        </View>

        <SectionHeader title="Earnings" />
        <View className={SECTION_SPACING_CLASS}>
          {!displayHasPayment ? (
            <SurfaceCard
              style={{
                backgroundColor: "rgba(23,28,43,0.75)",
                borderColor: "rgba(96,165,250,0.22)",
                borderStyle: "dashed",
              }}
            >
              <View className="items-center py-2">
                <View className="w-14 h-14 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                  <IconSymbol name="lock.fill" size={24} color="#64748B" />
                </View>
                <Text className="text-3xl font-bold mt-3" style={{ color: "#64748B" }}>
                  £0.00
                </Text>
                <Text className="text-[10px] uppercase tracking-[2px] mt-1" style={{ color: "#64748B" }}>
                  Pending setup
                </Text>
                <TouchableOpacity className="mt-3 flex-row items-center" onPress={() => router.push("/(trainer)/get-paid" as any)}>
                  <Text className="text-sm font-bold" style={{ color: DASH.primary }}>
                    Connect payouts
                  </Text>
                  <IconSymbol name="chevron.right" size={14} color={DASH.primary} />
                </TouchableOpacity>
              </View>
            </SurfaceCard>
          ) : (
            <SurfaceCard style={CARD_SOFT_STYLE}>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold" style={{ color: DASH.text }}>
                  Payout overview
                </Text>
                <TouchableOpacity
                  className="rounded-full px-3 py-1.5 border"
                  style={MUTED_BADGE_STYLE}
                  onPress={() => setEarningsExpanded((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={earningsExpanded ? "Hide earnings details" : "Show earnings details"}
                >
                  <Text className="text-xs font-semibold" style={{ color: DASH.text }}>
                    {earningsExpanded ? "Hide" : "Show"}
                  </Text>
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center justify-between mt-3">
                <Text style={{ color: DASH.muted }}>Total earned</Text>
                <Text className="font-semibold" style={{ color: DASH.text }}>
                  {totalEarned}
                </Text>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <Text style={{ color: DASH.muted }}>Next payout</Text>
                <Text className="font-semibold" style={{ color: DASH.text }}>
                  {payoutSummary?.nextPayoutDate || "—"}
                </Text>
              </View>
              {earningsExpanded ? (
                <>
                  <View className="h-px my-3" style={{ backgroundColor: "rgba(255,255,255,0.10)" }} />
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm" style={{ color: DASH.muted }}>
                      Available
                    </Text>
                    <Text className="font-semibold" style={{ color: DASH.text }}>
                      {availableEarnings}
                    </Text>
                  </View>
                  <View className="flex-row items-center justify-between mt-2">
                    <Text className="text-sm" style={{ color: DASH.muted }}>
                      Pending
                    </Text>
                    <Text className="font-semibold" style={{ color: DASH.text }}>
                      {pendingEarnings}
                    </Text>
                  </View>
                </>
              ) : null}
            </SurfaceCard>
          )}
        </View>

        <SectionHeader
          title="Clients"
          actionLabel={clients.length > 0 ? "See all" : "Add"}
          onActionPress={() => router.push((clients.length > 0 ? "/(trainer)/clients" : "/(trainer)/invite") as any)}
        />
        <View className={SECTION_SPACING_CLASS}>
          {clientsLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color={DASH.primary} />
            </View>
          ) : previewClients.length === 0 ? (
            <EmptyModuleCard
              icon="person.2.fill"
              description="Build your roster and track progress in one place."
              cta="Add client"
              onPress={() => router.push("/(trainer)/invite" as any)}
            />
          ) : (
            <SurfaceCard style={CARD_STYLE}>
              {previewClients.map((client, index) => (
                <TouchableOpacity
                  key={client.id}
                  className={index < previewClients.length - 1 ? "pb-3 mb-3 border-b" : ""}
                  style={index < previewClients.length - 1 ? { borderColor: "rgba(255,255,255,0.10)" } : undefined}
                  onPress={() => router.push(`/client-detail/${client.id}` as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${client.name} status`}
                  testID={`trainer-dashboard-client-${client.id}`}
                >
                  {(() => {
                    const avatarUrl = normalizeAssetUrl(client.photoUrl);
                    const hasAvatar = typeof avatarUrl === "string" && avatarUrl.trim().length > 0;
                    const bundle = client.currentBundle;
                    const sessionsUsed = Number(bundle?.sessionsUsed || 0);
                    const sessionsIncluded = Number(bundle?.sessionsIncluded || 0);
                    const productsUsed = Number(bundle?.productsUsed || 0);
                    const productsIncluded = Number(bundle?.productsIncluded || 0);
                    const sessionsPct = toUsagePercent(sessionsUsed, sessionsIncluded);
                    const productsPct = toUsagePercent(productsUsed, productsIncluded);
                    const firstAlert =
                      Array.isArray(bundle?.alerts) && bundle.alerts.length > 0 ? String(bundle.alerts[0]) : "";

                    return (
                      <View>
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center flex-1 pr-2">
                            <View
                              className="w-10 h-10 rounded-full overflow-hidden items-center justify-center mr-3 border"
                              style={{ borderColor: "rgba(96,165,250,0.35)" }}
                            >
                              {hasAvatar ? (
                                <Image
                                  source={{ uri: avatarUrl }}
                                  style={{ width: "100%", height: "100%" }}
                                  contentFit="cover"
                                />
                              ) : (
                                <View
                                  className="w-10 h-10 rounded-full items-center justify-center"
                                  style={{ backgroundColor: "rgba(96,165,250,0.22)" }}
                                >
                                  <Text className="text-xs font-bold" style={{ color: DASH.primary }}>
                                    {getNameInitials(client.name)}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <View className="flex-1">
                              <View className="flex-row items-center">
                                <View
                                  className="w-2 h-2 rounded-full mr-2"
                                  style={{ backgroundColor: client.status === "active" ? DASH.primary : "#64748B" }}
                                />
                                <Text className="font-medium" style={{ color: DASH.text }} numberOfLines={1}>
                                  {client.name}
                                </Text>
                              </View>
                              <Text className="text-[11px] mt-1" style={{ color: DASH.muted }} numberOfLines={1}>
                                {bundle?.bundleTitle || "No active bundle"}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-xs" style={{ color: DASH.muted }}>
                            {client.activeBundles || 0} active
                          </Text>
                        </View>

                        {bundle ? (
                          <View className="mt-3">
                            <Text className="text-[11px]" style={{ color: DASH.muted }}>
                              Sessions: {sessionsUsed}/{sessionsIncluded}
                            </Text>
                            <View className="h-1.5 rounded-full mt-1 mb-2 overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                              <View
                                className="h-full rounded-full"
                                style={{ width: `${sessionsPct}%`, backgroundColor: sessionsPct >= 80 ? "#F59E0B" : DASH.primary }}
                              />
                            </View>
                            <Text className="text-[11px]" style={{ color: DASH.muted }}>
                              Products: {productsUsed}/{productsIncluded}
                            </Text>
                            <View className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                              <View
                                className="h-full rounded-full"
                                style={{ width: `${productsPct}%`, backgroundColor: productsPct >= 80 ? "#F59E0B" : "#34D399" }}
                              />
                            </View>
                            {firstAlert ? (
                              <Text className="text-[11px] mt-2" style={{ color: "#FBBF24" }} numberOfLines={1}>
                                {firstAlert}
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          <Text className="text-[11px] mt-3" style={{ color: "#FBBF24" }}>
                            No active bundle yet. Tap to invite.
                          </Text>
                        )}
                      </View>
                    );
                  })()}
                </TouchableOpacity>
              ))}
            </SurfaceCard>
          )}
        </View>

        <SectionHeader
          title="Offers"
          actionLabel={offers.length > 0 ? "Manage" : "New"}
          onActionPress={() => router.push((offers.length > 0 ? "/(trainer)/offers" : "/(trainer)/offers/new") as any)}
        />
        <View className={SECTION_SPACING_CLASS}>
          {offersLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color={DASH.primary} />
            </View>
          ) : previewOffers.length === 0 ? (
            <EmptyModuleCard
              icon="cube.box.fill"
              description="Package your expertise into professional training plans."
              cta="New offer"
              onPress={() => router.push("/(trainer)/offers/new" as any)}
            />
          ) : (
            <SurfaceCard style={CARD_STYLE}>
              {previewOffers.map((offer, index) => (
                <View
                  key={offer.id}
                  className={index < previewOffers.length - 1 ? "pb-3 mb-3 border-b" : ""}
                  style={index < previewOffers.length - 1 ? { borderColor: "rgba(255,255,255,0.10)" } : undefined}
                >
                  {(() => {
                    const offerImageUrl = getOfferImageUrl(offer);
                    return (
                  <View className="flex-row items-start">
                    <View className="w-12 h-12 rounded-lg bg-surface border border-border overflow-hidden items-center justify-center mr-3">
                      {offerImageUrl ? (
                        <Image
                          source={{ uri: offerImageUrl }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      ) : (
                        <IconSymbol name="photo" size={16} color={DASH.muted} />
                      )}
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center justify-between">
                        <Text className="font-medium flex-1 pr-2" style={{ color: DASH.text }} numberOfLines={1}>
                          {offer.title}
                        </Text>
                        <Text className="font-semibold" style={{ color: DASH.text }}>
                          {formatGBPFromMinor(offer.priceMinor || 0)}
                        </Text>
                      </View>
                      <View className="flex-row items-center mt-2">
                        <View className="px-2 py-1 rounded-full border mr-2" style={MUTED_BADGE_STYLE}>
                          <Text className="text-[11px]" style={{ color: DASH.muted }}>
                            {formatOfferType(offer.type)}
                          </Text>
                        </View>
                        <View
                          className="px-2 py-1 rounded-full border"
                          style={{
                            backgroundColor: (OFFER_STATUS_STYLE[(offer.status as OfferStatus) || "draft"] || OFFER_STATUS_STYLE.draft).bg,
                            borderColor: (OFFER_STATUS_STYLE[(offer.status as OfferStatus) || "draft"] || OFFER_STATUS_STYLE.draft).border,
                          }}
                        >
                          <Text
                            className="text-[11px] font-medium"
                            style={{ color: (OFFER_STATUS_STYLE[(offer.status as OfferStatus) || "draft"] || OFFER_STATUS_STYLE.draft).text }}
                          >
                            {(OFFER_STATUS_STYLE[(offer.status as OfferStatus) || "draft"] || OFFER_STATUS_STYLE.draft).label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                    );
                  })()}
                </View>
              ))}
            </SurfaceCard>
          )}
        </View>

        <SectionHeader title="Recent activity" />
        <View className={SECTION_SPACING_CLASS}>
          {activityLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color={DASH.primary} />
            </View>
          ) : activityRows.length === 0 ? (
            <SurfaceCard style={{ ...CARD_STYLE, paddingVertical: 28 }}>
              <View className="items-center">
                <IconSymbol name="clock.arrow.circlepath" size={34} color="#475569" />
                <Text className="text-sm text-center mt-3 px-3" style={{ color: "#B6C2D6" }}>
                  Your activity will appear here once you start growing your business.
                </Text>
              </View>
            </SurfaceCard>
          ) : (
            <SurfaceCard style={CARD_STYLE}>
              {activityRows.map((item, index) => {
                const status = (item.status as PaymentStatus) || "awaiting_payment";
                const statusStyle = ACTIVITY_STATUS_STYLE[status] || ACTIVITY_STATUS_STYLE.awaiting_payment;
                const methodLabel = item.method === "link" ? "Payment Link" : "Tap to Pay";
                return (
                  <View
                    key={item.id}
                    className={index < activityRows.length - 1 ? "pb-3 mb-3 border-b" : ""}
                    style={index < activityRows.length - 1 ? { borderColor: "rgba(255,255,255,0.10)" } : undefined}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="font-medium" style={{ color: DASH.text }} numberOfLines={1}>
                          {item.description || "Training session"}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <View className="px-2 py-1 rounded-full mr-2 border" style={MUTED_BADGE_STYLE}>
                            <Text className="text-[11px]" style={{ color: DASH.muted }}>
                              {methodLabel}
                            </Text>
                          </View>
                          <Text className="text-xs" style={{ color: DASH.muted }}>
                            {formatDateShort(item.createdAt)}
                          </Text>
                        </View>
                      </View>
                      <Text className="font-semibold" style={{ color: DASH.text }}>
                        {formatGBPFromMinor(item.amountMinor || 0)}
                      </Text>
                    </View>
                    <View className="self-start mt-2 px-2 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg }}>
                      <Text className="text-[11px] font-medium" style={{ color: statusStyle.text }}>
                        {statusStyle.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </SurfaceCard>
          )}
        </View>

        {!displayHasPayment ? (
          <View className="px-6 pb-8">
            <SurfaceCard style={CARD_STYLE}>
              <View className="flex-row items-start">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: "rgba(96,165,250,0.16)" }}>
                  <IconSymbol name="sparkles" size={14} color={DASH.primary} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold" style={{ color: DASH.text }}>
                    Rewards unlock after first payment
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: DASH.muted }}>
                    Keep focus on Invite, Offer, and Get Paid. Rewards appear automatically after your first successful payment.
                  </Text>
                </View>
              </View>
            </SurfaceCard>
          </View>
        ) : (
          <View className="pb-8" />
        )}

        {hasAnyLoading ? (
          <View className="items-center pb-8">
            <ActivityIndicator size="small" color={DASH.primary} />
          </View>
        ) : null}
      </ScrollView>
      <Modal
        visible={pendingPaymentsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingPaymentsVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" }}>
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={() => setPendingPaymentsVisible(false)}
          />
          <SwipeDownSheet
            visible={pendingPaymentsVisible}
            onClose={() => setPendingPaymentsVisible(false)}
            className="rounded-t-3xl"
            style={{ backgroundColor: "#0F172A", borderTopColor: DASH.border, borderTopWidth: 1 }}
          >
            <View className="px-6 pt-4 pb-6">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text className="text-xl font-bold" style={{ color: DASH.text }}>
                  Pending Payments
                </Text>
                <Text className="text-xs mt-1" style={{ color: DASH.muted }}>
                  {pendingPaymentsCount} outstanding · {formatGBPFromMinor(pendingPaymentsTotalMinor)} total
                </Text>
              </View>
              <TouchableOpacity
                className="px-2 py-1"
                onPress={() => setPendingPaymentsVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close pending payments"
                testID="pending-payments-close"
              >
                <IconSymbol name="xmark" size={18} color={DASH.muted} />
              </TouchableOpacity>
            </View>

            {pendingPaymentsLoading ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="small" color={DASH.primary} />
              </View>
            ) : pendingPaymentRows.length === 0 ? (
              <View
                className="mt-4 rounded-2xl border p-4"
                style={{ borderColor: "rgba(148,163,184,0.2)", backgroundColor: "rgba(15,23,42,0.6)" }}
              >
                <Text className="text-sm" style={{ color: DASH.muted }}>
                  No pending payment links right now.
                </Text>
              </View>
            ) : (
              <ScrollView className="mt-4" showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
                {pendingPaymentRows.map((payment, index) => (
                  <View
                    key={payment.id}
                    className="rounded-2xl border p-4 mb-3"
                    style={{
                      borderColor: "rgba(148,163,184,0.22)",
                      backgroundColor: "rgba(15,23,42,0.78)",
                      marginBottom: index === pendingPaymentRows.length - 1 ? 0 : 12,
                    }}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-sm font-semibold" style={{ color: DASH.text }} numberOfLines={1}>
                          {payment.description || "Training payment"}
                        </Text>
                        <Text className="text-xs mt-1" style={{ color: DASH.muted }}>
                          Sent {formatDateShort(payment.createdAt)}
                        </Text>
                      </View>
                      <Text className="text-sm font-semibold" style={{ color: DASH.text }}>
                        {formatGBPFromMinor(payment.amountMinor || 0)}
                      </Text>
                    </View>
                    <View className="flex-row items-center mt-3">
                      <TouchableOpacity
                        className="flex-1 rounded-xl border px-3 py-2 mr-2"
                        style={MUTED_BADGE_STYLE}
                        onPress={() => handleCancelPendingPayment(payment)}
                        disabled={cancelPendingPayment.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`Cancel ${payment.description || "payment link"}`}
                        testID={`pending-payment-cancel-${payment.id}`}
                      >
                        <Text className="text-center text-xs font-semibold" style={{ color: "#FCA5A5" }}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-1 rounded-xl border px-3 py-2"
                        style={{ borderColor: "rgba(96,165,250,0.5)", backgroundColor: "rgba(96,165,250,0.14)" }}
                        onPress={() => handleSendReminder(payment)}
                        accessibilityRole="button"
                        accessibilityLabel={`Send reminder for ${payment.description || "payment link"}`}
                        testID={`pending-payment-reminder-${payment.id}`}
                      >
                        <Text className="text-center text-xs font-semibold" style={{ color: DASH.primary }}>
                          Send Reminder
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
            </View>
          </SwipeDownSheet>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
