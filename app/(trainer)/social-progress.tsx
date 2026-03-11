import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useAuthContext } from "@/contexts/auth-context";
import {
  getCachedTrainerSocialPreviewMode,
  setCachedTrainerSocialPreviewMode,
} from "@/lib/social-status-cache";
import { useColors } from "@/hooks/use-colors";
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
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

function pct(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return `${(numeric * 100).toFixed(1)}%`;
}

function normalizeSocialPlatformLabel(value: string) {
  const cleaned = String(value || '')
    .trim()
    .replace(/_/g, ' ');
  if (!cleaned) return '';
  if (cleaned.toLowerCase() === 'x') return 'X';
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPostingWindow(start?: string | null, end?: string | null) {
  if (!start && !end) return "Any time";
  const startLabel = start ? new Date(start).toLocaleDateString() : "Any time";
  const endLabel = end ? new Date(end).toLocaleDateString() : "Open";
  return `${startLabel} - ${endLabel}`;
}

function getComplianceLabel(state: string) {
  switch (state) {
    case "matched_post":
      return "Matched post";
    case "needs_review":
      return "Needs review";
    case "missing_hashtag":
      return "Missing hashtag";
    case "missing_mention":
      return "Missing mention";
    case "missing_link":
      return "Missing link";
    case "platform_mismatch":
      return "Wrong platform";
    case "outside_window":
      return "Outside window";
    case "rules_not_set":
      return "Rules not set";
    default:
      return "Awaiting post";
  }
}

function getComplianceColor(state: string) {
  switch (state) {
    case "matched_post":
      return "#22C55E";
    case "needs_review":
      return "#F59E0B";
    case "missing_hashtag":
    case "missing_mention":
    case "missing_link":
    case "platform_mismatch":
    case "outside_window":
      return "#EF4444";
    case "rules_not_set":
      return "#94A3B8";
    default:
      return "#60A5FA";
  }
}

function isBenignCloseReason(reason: string) {
  const normalized = reason.trim().toLowerCase();
  return (
    normalized === "exit_from_platform_selection" ||
    normalized.startsWith("exit_from_platform_") ||
    normalized === "back_pressed" ||
    normalized === "user_closed_connect_flow" ||
    normalized === "dismissed" ||
    normalized === "closed"
  );
}

function isTokenExpiredReason(reason: string) {
  const normalized = reason.trim().toLowerCase();
  return (
    normalized === "token_expired" ||
    normalized === "tokenexpired" ||
    normalized === "token expired" ||
    (normalized.includes("token") && normalized.includes("expired"))
  );
}

type DevSocialPreviewData = {
  followers: number;
  viewsPerMonth: number;
  engagementRate: number;
  ctr: number;
  platforms: string[];
  momentum: number[];
  latestPostSummary: string;
};

const DASH = {
  text: '#F8FAFC',
  muted: '#94A3B8',
  primary: '#60A5FA',
  borderStrong: 'rgba(96,165,250,0.5)',
  cardSoft: '#141A28',
};

const CARD_SOFT_STYLE = {
  backgroundColor: DASH.cardSoft,
  borderColor: DASH.borderStrong,
};

const DEV_SOCIAL_PREVIEW_OWNER_EMAILS = [
  'jason@secretlab.com',
  'trainer@secretlab.com',
];

const DEV_SOCIAL_PREVIEW_DATA: DevSocialPreviewData = {
  followers: 13840,
  viewsPerMonth: 18400,
  engagementRate: 0.064,
  ctr: 0.021,
  platforms: ['instagram', 'youtube', 'tiktok'],
  momentum: [220, 310, 420, 390, 560, 680, 740, 910, 1120, 1360],
  latestPostSummary: 'Latest post: 1.8k engagements',
};

const SOCIAL_VIZ_ANIMATION_MS = 1500;
const DIAL_START_ANGLE = 240;
const DIAL_SWEEP_ANGLE = 240;
const DIAL_SEGMENT_GAP_ANGLE = 8;
const DIAL_SEGMENT_COLORS = ['#F87171', '#FBBF24', '#34D399'] as const;

function formatCompactNumber(value: number) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return '0';
  if (Math.abs(numeric) >= 1_000_000) {
    return `${(numeric / 1_000_000).toFixed(numeric >= 10_000_000 ? 0 : 1)}M`;
  }
  if (Math.abs(numeric) >= 1_000) {
    return `${(numeric / 1_000).toFixed(numeric >= 10_000 ? 0 : 1)}k`;
  }
  return numeric.toLocaleString();
}

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    start.x,
    start.y,
    'A',
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(' ');
}

function getDialAccentColor(progress: number) {
  if (progress < 0.34) return DIAL_SEGMENT_COLORS[0];
  if (progress < 0.67) return DIAL_SEGMENT_COLORS[1];
  return DIAL_SEGMENT_COLORS[2];
}

function SocialMetricDial({
  label,
  value,
  helper,
  progress,
  animationProgress = 1,
}: {
  label: string;
  value: string;
  helper?: string;
  progress: number;
  animationProgress?: number;
}) {
  const size = 92;
  const strokeWidth = 8;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const clampedProgress = Math.max(0, Math.min(1, progress * animationProgress));
  const accentColor = getDialAccentColor(clampedProgress);
  const segmentSweep = DIAL_SWEEP_ANGLE / DIAL_SEGMENT_COLORS.length;
  const progressEndAngle = DIAL_START_ANGLE + clampedProgress * DIAL_SWEEP_ANGLE;
  const progressEndPoint = polarToCartesian(center, center, radius, progressEndAngle);
  return (
    <View
      className='flex-1 rounded-xl border px-2 py-3 items-center'
      style={{
        backgroundColor: 'rgba(11,16,32,0.4)',
        borderColor: 'rgba(148,163,184,0.18)',
        minHeight: 148,
      }}
    >
      <Text
        className='text-[9px] font-semibold uppercase tracking-[0.4px]'
        style={{ color: '#93C5FD' }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
      <View
        style={{
          width: size,
          height: size,
          marginTop: 6,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={size} height={size}>
          {DIAL_SEGMENT_COLORS.map((segmentColor, index) => {
            const startAngle =
              DIAL_START_ANGLE + index * segmentSweep + DIAL_SEGMENT_GAP_ANGLE / 2;
            const endAngle =
              DIAL_START_ANGLE +
              (index + 1) * segmentSweep -
              DIAL_SEGMENT_GAP_ANGLE / 2;
            return (
              <Path
                key={`${label}-segment-${segmentColor}`}
                d={describeArc(center, center, radius, startAngle, endAngle)}
                stroke={segmentColor}
                strokeWidth={strokeWidth}
                strokeLinecap='round'
                fill='none'
                opacity={0.45}
              />
            );
          })}
          {clampedProgress > 0 ? (
            <Path
              d={describeArc(center, center, radius, DIAL_START_ANGLE, progressEndAngle)}
              stroke={accentColor}
              strokeWidth={strokeWidth}
              strokeLinecap='round'
              fill='none'
            />
          ) : null}
          <Circle cx={progressEndPoint.x} cy={progressEndPoint.y} r={3.5} fill={accentColor} />
        </Svg>
        <View
          pointerEvents='none'
          style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}
        >
          <Text className='text-xl font-bold' style={{ color: DASH.text }}>
            {value}
          </Text>
        </View>
      </View>
      {helper ? (
        <Text
          className='text-[10px] mt-1 text-center'
          style={{ color: DASH.muted, minHeight: 28 }}
          numberOfLines={2}
        >
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number) {
  if (points.length === 0) return '';
  const linePath = buildLinePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${linePath} L ${lastPoint.x.toFixed(2)} ${baselineY.toFixed(2)} L ${firstPoint.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

function getResponsiveSocialChartHeight(width: number) {
  return Math.max(88, Math.min(156, Math.round(width * 0.24)));
}

function buildSocialChartPlaceholderPoints(params: {
  width: number;
  baselineY: number;
  chartHeight: number;
  paddingX: number;
}) {
  const usableWidth = Math.max(1, params.width - params.paddingX * 2);
  const xRatios = [0.02, 0.18, 0.34, 0.5, 0.68, 0.84, 0.98];
  const yRatios = [0.18, 0.28, 0.34, 0.32, 0.46, 0.54, 0.74];
  return xRatios.map((ratio, index) => ({
    x: params.paddingX + usableWidth * ratio,
    y: params.baselineY - params.chartHeight * yRatios[index],
  }));
}

function SocialLineChart({
  values,
  animationProgress = 1,
}: {
  values: number[];
  animationProgress?: number;
}) {
  const [chartWidth, setChartWidth] = useState(280);
  const width = Math.max(1, Math.round(chartWidth || 280));
  const height = getResponsiveSocialChartHeight(width);
  const paddingX = 8;
  const paddingTop = 10;
  const paddingBottom = 10;
  const baselineY = height - paddingBottom;
  const chartHeight = height - paddingTop - paddingBottom;
  const numericValues = values.map((value) => Number(value || 0));
  const minValue = numericValues.length > 0 ? Math.min(...numericValues) : 0;
  const maxValue = numericValues.length > 0 ? Math.max(...numericValues) : 0;
  const domainPadding =
    maxValue > minValue
      ? (maxValue - minValue) * 0.2
      : Math.max(maxValue * 0.18, 1);
  const domainMin = Math.max(0, minValue - domainPadding);
  const domainMax = maxValue + domainPadding;
  const domainRange = Math.max(1, domainMax - domainMin);
  const points = numericValues.map((value, index) => {
    const x =
      numericValues.length === 1
        ? width / 2
        : paddingX + (index / (numericValues.length - 1)) * (width - paddingX * 2);
    const y = baselineY - ((value - domainMin) / domainRange) * chartHeight;
    return { x, y };
  });
  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, baselineY);
  const lastPoint = points[points.length - 1];
  const clampedProgress = Math.max(0, Math.min(1, animationProgress));
  const revealWidth = Math.max(0, width * clampedProgress);
  return (
    <View
      onLayout={(event) => {
        const nextWidth = Math.max(1, Math.round(event.nativeEvent.layout.width - 8));
        setChartWidth((currentWidth) =>
          Math.abs(currentWidth - nextWidth) < 2 ? currentWidth : nextWidth,
        );
      }}
      style={{
        height,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(15,23,42,0.42)',
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.14)',
        paddingHorizontal: 4,
        paddingVertical: 4,
      }}
    >
      <Svg width='100%' height='100%' viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id='socialProgressMomentumFill' x1='0' y1='0' x2='0' y2='1'>
            <Stop offset='0%' stopColor='#60A5FA' stopOpacity='0.35' />
            <Stop offset='100%' stopColor='#60A5FA' stopOpacity='0.02' />
          </LinearGradient>
          <LinearGradient id='socialProgressMomentumLine' x1='0' y1='0' x2='1' y2='0'>
            <Stop offset='0%' stopColor='#60A5FA' />
            <Stop offset='100%' stopColor='#A78BFA' />
          </LinearGradient>
          <ClipPath id='socialProgressMomentumReveal'>
            <Rect x={0} y={0} width={revealWidth} height={height} />
          </ClipPath>
        </Defs>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingTop + chartHeight * ratio;
          return (
            <Path
              key={`social-progress-grid-${ratio}`}
              d={`M ${paddingX} ${y.toFixed(2)} L ${width - paddingX} ${y.toFixed(2)}`}
              stroke='rgba(148,163,184,0.16)'
              strokeWidth={1}
              strokeDasharray='4 6'
              fill='none'
            />
          );
        })}
        {areaPath ? (
          <Path d={areaPath} fill='url(#socialProgressMomentumFill)' clipPath='url(#socialProgressMomentumReveal)' />
        ) : null}
        {linePath ? (
          <Path
            d={linePath}
            stroke='url(#socialProgressMomentumLine)'
            strokeWidth={3}
            strokeLinecap='round'
            strokeLinejoin='round'
            fill='none'
            clipPath='url(#socialProgressMomentumReveal)'
          />
        ) : null}
        {lastPoint && clampedProgress > 0.96 ? (
          <>
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={6} fill='rgba(167,139,250,0.24)' />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={3.5} fill='#A78BFA' />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

function SocialLineChartPlaceholder() {
  const [chartWidth, setChartWidth] = useState(280);
  const width = Math.max(1, Math.round(chartWidth || 280));
  const height = getResponsiveSocialChartHeight(width);
  const paddingX = 8;
  const paddingTop = 10;
  const paddingBottom = 10;
  const baselineY = height - paddingBottom;
  const chartHeight = height - paddingTop - paddingBottom;
  const placeholderPoints = useMemo(
    () =>
      buildSocialChartPlaceholderPoints({
        width,
        baselineY,
        chartHeight,
        paddingX,
      }),
    [baselineY, chartHeight, paddingX, width],
  );
  return (
    <View
      onLayout={(event) => {
        const nextWidth = Math.max(1, Math.round(event.nativeEvent.layout.width - 8));
        setChartWidth((currentWidth) =>
          Math.abs(currentWidth - nextWidth) < 2 ? currentWidth : nextWidth,
        );
      }}
      style={{
        height,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(15,23,42,0.42)',
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.14)',
        paddingHorizontal: 4,
        paddingVertical: 4,
        justifyContent: 'center',
      }}
    >
      <Svg width='100%' height='100%' viewBox={`0 0 ${width} ${height}`}>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingTop + (height - paddingTop - paddingBottom) * ratio;
          return (
            <Path
              key={`social-progress-placeholder-grid-${ratio}`}
              d={`M ${paddingX} ${y.toFixed(2)} L ${width - paddingX} ${y.toFixed(2)}`}
              stroke='rgba(148,163,184,0.08)'
              strokeWidth={1}
              strokeDasharray='4 6'
              fill='none'
            />
          );
        })}
        <Path d={buildAreaPath(placeholderPoints, baselineY)} fill='rgba(148,163,184,0.05)' />
        <Path
          d={buildLinePath(placeholderPoints)}
          stroke='rgba(148,163,184,0.18)'
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
          fill='none'
        />
      </Svg>
      <View
        pointerEvents='none'
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 7,
            backgroundColor: 'rgba(15,23,42,0.6)',
            borderWidth: 1,
            borderColor: 'rgba(148,163,184,0.14)',
          }}
        >
          <Text className='text-xs font-medium' style={{ color: 'rgba(148,163,184,0.72)' }}>
            No data available.. Yet.
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function TrainerSocialProgressScreen() {
  const { user } = useAuthContext();
  const colors = useColors();
  const utils = trpc.useUtils();
  const params = useLocalSearchParams<{ bundleId?: string; templateId?: string }>();
  const [showDevSocialPreview, setShowDevSocialPreview] = useState(false);
  const devSocialPreviewInitialized = useRef(false);
  const [devSocialPreviewHydrated, setDevSocialPreviewHydrated] = useState(false);
  const socialVizProgressAnim = useRef(new Animated.Value(0)).current;
  const [socialVizProgress, setSocialVizProgress] = useState(0);
  const { data } = trpc.socialProgram.myProgramDashboard.useQuery();
  const recentPostsQuery = trpc.socialProgram.recentPosts.useQuery({
    limit: 12,
    sparklineDays: 10,
  });
  const syncNowMutation = trpc.socialProgram.syncNow.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.myStatus.invalidate(),
        utils.socialProgram.myProgramDashboard.invalidate(),
        utils.socialProgram.recentPosts.invalidate(),
        utils.socialProgram.campaignMetrics.invalidate(),
      ]);
      setSyncDoneAt(Date.now());
    },
  });
  const startConnectMutation = trpc.socialProgram.startConnect.useMutation();
  const completeConnectMutation = trpc.socialProgram.completeConnect.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.myStatus.invalidate(),
        utils.socialProgram.myProgramDashboard.invalidate(),
        utils.socialProgram.recentPosts.invalidate(),
      ]);
    },
  });
  const acceptInviteMutation = trpc.socialProgram.acceptInvite.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.myStatus.invalidate(),
        utils.socialProgram.myProgramDashboard.invalidate(),
        utils.socialProgram.recentPosts.invalidate(),
        utils.socialProgram.campaignMetrics.invalidate(),
      ]);
    },
  });
  const declineInviteMutation = trpc.socialProgram.declineInvite.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.socialProgram.myStatus.invalidate(),
        utils.socialProgram.myProgramDashboard.invalidate(),
        utils.socialProgram.recentPosts.invalidate(),
        utils.socialProgram.campaignMetrics.invalidate(),
      ]);
    },
  });
  const bundlesQuery = trpc.bundles.list.useQuery();
  const membership = data?.membership;
  const pendingInvite = data?.pendingInvite;
  const invitedBy = data?.invitedBy;
  const profile = data?.profile;
  const progress = data?.progress;
  const commitment = data?.commitment;
  const violations = data?.violations || [];
  const [syncDoneAt, setSyncDoneAt] = useState<number | null>(null);
  const [isLaunchingConnect, setIsLaunchingConnect] = useState(false);
  const [connectActionError, setConnectActionError] = useState<string | null>(null);
  const [connectActionSuccess, setConnectActionSuccess] = useState<string | null>(null);
  const bundles = bundlesQuery.data || [];
  const campaignBundles = useMemo(
    () => bundles.filter((bundle: any) => Boolean(bundle.templateId)),
    [bundles],
  );
  const routeBundleId = String(params.bundleId || "").trim();
  const routeTemplateId = String(params.templateId || "").trim();
  const [selectedBundleId, setSelectedBundleId] = useState<string | null>(
    routeBundleId || null,
  );
  const routeMatchedBundleId = useMemo(() => {
    if (routeBundleId) return routeBundleId;
    if (!routeTemplateId) return null;
    const matching = campaignBundles.find(
      (bundle: any) => String(bundle.templateId || "") === routeTemplateId,
    );
    return matching ? String(matching.id) : null;
  }, [campaignBundles, routeBundleId, routeTemplateId]);
  const activeBundleId =
    selectedBundleId ||
    routeMatchedBundleId ||
    (campaignBundles.length > 0 ? String(campaignBundles[0].id) : null);
  const campaignMetricsQuery = trpc.socialProgram.campaignMetrics.useQuery(
    activeBundleId ? { bundleId: activeBundleId } : undefined,
    { enabled: Boolean(activeBundleId) },
  );
  const campaignRows = campaignMetricsQuery.data || [];
  const campaignComplianceRows = useMemo(
    () =>
      campaignRows.map((row: any) => {
        const metadata = row?.metadata || {};
        const rules = metadata?.campaignPostingRules || {};
        const statusCounts = metadata?.attributionStatusCounts || {};
        const ruleMissCounts = metadata?.ruleMissCounts || {};
        const complianceState = String(metadata?.complianceState || "awaiting_post");
        return {
          id: `${row?.campaignAccountId || "campaign"}-${row?.metricDate || "latest"}`,
          campaignAccountName: row?.campaignAccountName || "Campaign account",
          complianceState,
          complianceLabel: getComplianceLabel(complianceState),
          requiredPosts: Number(row?.requiredPosts || 0),
          matchedPosts: Number(statusCounts?.matched || 0),
          needsReviewPosts: Number(statusCounts?.needsReview || 0),
          rejectedPosts: Number(statusCounts?.rejected || 0),
          requiredHashtags: Array.isArray(rules?.requiredHashtags) ? rules.requiredHashtags : [],
          requiredMentions: Array.isArray(rules?.requiredMentions) ? rules.requiredMentions : [],
          allowedPlatforms: Array.isArray(rules?.allowedPlatforms) ? rules.allowedPlatforms : [],
          requiredLinkSlug: String(rules?.requiredLinkSlug || "").trim() || null,
          postingWindowStart: rules?.postingWindowStart || null,
          postingWindowEnd: rules?.postingWindowEnd || null,
          ruleMissCounts,
        };
      }),
    [campaignRows],
  );
  const complianceTotals = useMemo(
    () =>
      campaignComplianceRows.reduce(
        (acc, row) => {
          acc.matched += row.matchedPosts;
          acc.needsReview += row.needsReviewPosts;
          acc.rejected += row.rejectedPosts;
          acc.required += row.requiredPosts;
          return acc;
        },
        { matched: 0, needsReview: 0, rejected: 0, required: 0 },
      ),
    [campaignComplianceRows],
  );

  const [avgOrderValue, setAvgOrderValue] = useState("49");
  const [clickToIntentRate, setClickToIntentRate] = useState("18");
  const [intentToConversionRate, setIntentToConversionRate] = useState("22");
  const [targetCpc, setTargetCpc] = useState("8");

  const measured = useMemo(() => {
    const views = campaignRows.reduce((sum: number, row: any) => sum + Number(row?.views || 0), 0);
    const clicks = campaignRows.reduce(
      (sum: number, row: any) => sum + Number(row?.clicks || 0),
      0,
    );
    const engagements = campaignRows.reduce(
      (sum: number, row: any) => sum + Number(row?.engagements || 0),
      0,
    );
    const fallbackClicks = Math.round(views * Number(profile?.avgCtr || 0));
    return {
      views,
      clicks: clicks > 0 ? clicks : fallbackClicks,
      engagements,
      ctr: views > 0 ? (clicks > 0 ? clicks : fallbackClicks) / views : Number(profile?.avgCtr || 0),
    };
  }, [campaignRows, profile?.avgCtr]);

  const modeled = useMemo(() => {
    const aov = Number(avgOrderValue || 0);
    const clickIntent = Number(clickToIntentRate || 0) / 100;
    const intentConv = Number(intentToConversionRate || 0) / 100;
    const projectedIntents = Math.round(measured.clicks * clickIntent);
    const projectedConversions = Math.round(projectedIntents * intentConv);
    const projectedRevenue = projectedConversions * aov;
    const effectiveCpc = measured.clicks > 0 ? measured.views / measured.clicks : 0;
    const cpcDelta = effectiveCpc - Number(targetCpc || 0);
    return {
      projectedIntents,
      projectedConversions,
      projectedRevenue,
      effectiveCpc,
      cpcDelta,
    };
  }, [
    avgOrderValue,
    clickToIntentRate,
    intentToConversionRate,
    measured.clicks,
    measured.views,
    targetCpc,
  ]);

  const trendRows = useMemo(
    () =>
      (data?.recentMetrics || [])
        .slice()
        .reverse()
        .slice(-14)
        .map((row: any) => ({
          date: String(row?.metricDate || ""),
          views: Number(row?.views || 0),
          clicks: Number(row?.clicks || 0),
        })),
    [data?.recentMetrics],
  );

  const connectedPlatforms = useMemo(() => {
    const keys = new Set<string>();
    const rows = Array.isArray((profile as any)?.metadata?.rawProfiles)
      ? ((profile as any).metadata.rawProfiles as any[])
      : [];
    for (const row of rows) {
      const key =
        normalizeSocialPlatform(row?.platform || row?.platform_name) ||
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
      if (key) keys.add(key);
    }
    const direct = Array.isArray((profile as any)?.platforms)
      ? ((profile as any).platforms as any[])
      : [];
    for (const row of direct) {
      const key = normalizeSocialPlatform(row?.platform || row?.name || row);
      if (key) keys.add(key);
    }
    const accounts = Array.isArray((profile as any)?.metadata?.rawAccounts)
      ? ((profile as any).metadata.rawAccounts as any[])
      : [];
    for (const row of accounts) {
      const key =
        normalizeSocialPlatform(
          row?.platform ||
            row?.platform_name ||
            row?.work_platform?.name ||
            row?.workPlatform?.name ||
            row?.work_platform_name ||
            row?.network ||
            "",
        ) ||
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
      if (key) keys.add(key);
    }
    if (keys.size === 1 && keys.has("unknown")) {
      keys.delete("unknown");
      keys.add("youtube");
    }
    return Array.from(keys);
  }, [profile]);
  const membershipStatus = membership?.status || 'not_enrolled';
  const hasPendingInvite = Boolean(pendingInvite?.id);
  const isConnected = Boolean(profile?.phylloUserId);
  const isRestrictedStatus =
    membershipStatus === 'paused' || membershipStatus === 'banned';
  const canAttemptConnect =
    !isRestrictedStatus &&
    (membershipStatus === 'active' || isConnected);
  const platformStats = useMemo(() => {
    const rawProfiles = Array.isArray((profile as any)?.metadata?.rawProfiles)
      ? ((profile as any)?.metadata?.rawProfiles as any[])
      : [];
    const directPlatforms = Array.isArray((profile as any)?.platforms)
      ? ((profile as any)?.platforms as any[])
      : [];
    const rawAccounts = Array.isArray((profile as any)?.metadata?.rawAccounts)
      ? ((profile as any)?.metadata?.rawAccounts as any[])
      : [];
    const rows = new Map<
      string,
      { platform: string; followers: number; impressions: number }
    >();
    const recentPosts = Array.isArray(recentPostsQuery.data) ? recentPostsQuery.data : [];
    for (const row of rawProfiles) {
      const rawPlatform =
        row?.platform ||
        row?.platform_name ||
        row?.work_platform?.name ||
        row?.workPlatform?.name ||
        row?.work_platform_name ||
        row?.network ||
        '';
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
            .join(' '),
        );
      const platform = normalizedPlatform || 'unknown';
      const followers = Number(
        row?.audience?.follower_count ||
          row?.audience?.followers_count ||
          row?.audience?.subscriber_count ||
          row?.followers ||
          row?.followers_count ||
          row?.subscriber_count ||
          row?.subscribers ||
          row?.reputation?.subscriber_count ||
          row?.reputation?.follower_count ||
          0,
      );
      const impressions = Number(
        row?.engagement?.impressions ||
          row?.engagement?.avg_views_per_month ||
          row?.avg_views_per_month ||
          row?.reputation?.view_count ||
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
        impressions: Number(platformRow?.impressions || platformRow?.avgViewsPerMonth || 0),
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
            '',
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
            .join(' '),
        );
      if (!normalizedKey || rows.has(normalizedKey)) continue;
      rows.set(normalizedKey, {
        platform: normalizedKey,
        followers: 0,
        impressions: 0,
      });
    }
    for (const post of recentPosts as any[]) {
      const normalizedKey = normalizeSocialPlatform(post?.platform || '');
      if (!normalizedKey) continue;
      const impressions = Number(post?.latestViews || 0);
      const existing = rows.get(normalizedKey);
      if (existing) {
        existing.impressions = Math.max(existing.impressions, impressions);
      } else {
        rows.set(normalizedKey, {
          platform: normalizedKey,
          followers: 0,
          impressions,
        });
      }
    }
    if (rows.has('unknown') && rows.size > 1) rows.delete('unknown');
    if (rows.size === 1 && rows.has('unknown')) {
      const unknownRow = rows.get('unknown');
      if (unknownRow) {
        rows.delete('unknown');
        rows.set('youtube', { ...unknownRow, platform: 'youtube' });
      }
    }
    return Array.from(rows.values()).sort((a, b) => b.followers - a.followers);
  }, [profile, recentPostsQuery.data]);
  useEffect(() => {
    if (!syncDoneAt) return;
    const timer = setTimeout(() => setSyncDoneAt(null), 10000);
    return () => clearTimeout(timer);
  }, [syncDoneAt]);
  useEffect(() => {
    if (!connectActionSuccess) return;
    const timer = setTimeout(() => setConnectActionSuccess(null), 10000);
    return () => clearTimeout(timer);
  }, [connectActionSuccess]);
  useEffect(() => {
    if (!connectActionError) return;
    const matchedReason = connectActionError.match(/\(([^)]+)\)/);
    if (matchedReason && isBenignCloseReason(matchedReason[1] || '')) {
      setConnectActionError(null);
    }
  }, [connectActionError]);

  const handleConnectPhyllo = async () => {
    if (isLaunchingConnect) return;
    setIsLaunchingConnect(true);
    setConnectActionError(null);
    setConnectActionSuccess(null);
    try {
      const shouldForceFreshSession = !isConnected;
      let session;
      try {
        session = await startConnectMutation.mutateAsync({
          forceNewUser: shouldForceFreshSession,
        });
      } catch (firstError: any) {
        const firstMessage = String(firstError?.message || "").toLowerCase();
        const isIncorrectUserId =
          firstMessage.includes("incorrect_user_id") ||
          firstMessage.includes("requested user id does not exist");
        if (!shouldForceFreshSession && isIncorrectUserId) {
          session = await startConnectMutation.mutateAsync({
            forceNewUser: true,
          });
        } else {
          throw firstError;
        }
      }

      if (!session?.sdkToken || !session?.phylloUserId) {
        throw new Error("Could not create a social connect session.");
      }

      let result;
      if (Platform.OS === "web") {
        result = await openPhylloConnectWeb({
          scriptUrl:
            session.connectConfig?.scriptUrl ||
            "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js",
          environment:
            session.connectConfig?.environment === "production"
              ? "production"
              : session.connectConfig?.environment === "staging"
                ? "staging"
                : "sandbox",
          userId: session.phylloUserId,
          token: session.sdkToken,
          clientDisplayName:
            session.connectConfig?.clientDisplayName || "LocoMotivate",
        });
      } else if (hasNativePhylloConnectSdk()) {
        result = await openPhylloConnectNative({
          environment:
            session.connectConfig?.environment === "production"
              ? "production"
              : session.connectConfig?.environment === "staging"
                ? "staging"
                : "sandbox",
          userId: session.phylloUserId,
          token: session.sdkToken,
          clientDisplayName:
            session.connectConfig?.clientDisplayName || "LocoMotivate",
        });
      } else {
        setConnectActionError("Social connection is unavailable in this build.");
        return;
      }

      const finalized = await completeConnectMutation.mutateAsync({
        status: result.status,
        reason: result.reason,
      });
      const connectedCount = Number(finalized?.profile?.platforms?.length || 0);
      if (result.status === "connected") {
        setConnectActionSuccess(
          connectedCount > 0
            ? `Connected successfully. ${connectedCount} platform(s) linked.`
            : "Connected successfully. Refresh status to load your latest platform metrics.",
        );
      } else if (result.status === "cancelled") {
        const reason = String(result.reason || "").trim();
        if (isBenignCloseReason(reason)) {
          setConnectActionError(null);
          setConnectActionSuccess(null);
        } else {
          setConnectActionError(
            reason
              ? `Connection closed (${reason}).`
              : "Connection was cancelled before any platform was linked.",
          );
        }
      } else {
        setConnectActionError(
          isTokenExpiredReason(String(result.reason || ""))
            ? "Social connection session expired. Please retry."
            : String(result.reason || "Could not connect your social platforms."),
        );
      }
    } catch (error: any) {
      setConnectActionError(
        String(error?.message || "Unable to connect social platforms right now.").replace(
          /phyllo/gi,
          "social",
        ),
      );
    } finally {
      setIsLaunchingConnect(false);
    }
  };
  const canUseDevSocialPreview =
    __DEV__ &&
    DEV_SOCIAL_PREVIEW_OWNER_EMAILS.includes(
      String(user?.email || '').trim().toLowerCase(),
    );
  const socialFollowers = Number(profile?.followerCount || 0);
  const socialEngagementRate = Number(profile?.avgEngagementRate || 0);
  const socialCtr = Number(profile?.avgCtr || 0);
  const socialFollowerTarget = Math.max(1, Number(commitment?.minimumFollowers || 10000));
  const socialViewsTarget = Math.max(1, Number(commitment?.minimumAvgViews || 1000));
  const socialOpenViolationsCount = violations.length;
  const recentSocialPosts = recentPostsQuery.data || [];
  const socialViewsPerMonthFromPosts = recentSocialPosts.reduce(
    (sum: number, post: any) => sum + Number(post?.latestViews || 0),
    0,
  );
  const socialViewsPerMonth = Math.max(
    Number(profile?.avgViewsPerMonth || 0),
    socialViewsPerMonthFromPosts,
  );
  const recentSocialMomentum = useMemo(() => {
    const rows = recentSocialPosts
      .map((post: any) =>
        Array.isArray(post?.sparkline)
          ? post.sparkline.map((value: any) => Number(value || 0))
          : [],
      )
      .filter((values) => values.length > 0);
    if (rows.length === 0) return [] as number[];
    const maxLength = Math.max(...rows.map((values) => values.length));
    const totals = Array.from({ length: maxLength }, () => 0);
    for (const values of rows as number[][]) {
      const offset = maxLength - values.length;
      values.forEach((value: number, index: number) => {
        totals[offset + index] += value;
      });
    }
    return totals.slice(-10);
  }, [recentSocialPosts]);
  const latestSocialPost = recentSocialPosts[0] || null;
  const latestSocialPostSummary = latestSocialPost
    ? `Latest post: ${formatCompactNumber(Number(latestSocialPost.latestEngagements || 0))} engagements`
    : 'No data available.. Yet.';
  const socialPlatformSummary = connectedPlatforms
    .slice(0, 2)
    .map((platform) => normalizeSocialPlatformLabel(platform))
    .join(' · ');
  const platformDialTarget = 3;
  const shouldAutoEnableDevPreview =
    canUseDevSocialPreview &&
    connectedPlatforms.length > 0 &&
    socialFollowers === 0 &&
    socialViewsPerMonth === 0 &&
    recentSocialMomentum.length === 0;
  useEffect(() => {
    const userId = String(user?.id || "").trim();
    let isCancelled = false;
    if (!canUseDevSocialPreview) {
      setShowDevSocialPreview(false);
      devSocialPreviewInitialized.current = false;
      setDevSocialPreviewHydrated(true);
      return;
    }
    if (connectedPlatforms.length === 0 || !userId || devSocialPreviewInitialized.current) return;
    setDevSocialPreviewHydrated(false);
    getCachedTrainerSocialPreviewMode(userId).then((savedMode) => {
      if (isCancelled) return;
      setShowDevSocialPreview(
        savedMode == null ? shouldAutoEnableDevPreview : savedMode,
      );
      devSocialPreviewInitialized.current = true;
      setDevSocialPreviewHydrated(true);
    });
    return () => {
      isCancelled = true;
    };
  }, [canUseDevSocialPreview, connectedPlatforms.length, shouldAutoEnableDevPreview, user?.id]);
  const displayConnectedPlatforms = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.platforms
    : connectedPlatforms;
  const displaySocialFollowers = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.followers
    : socialFollowers;
  const displaySocialViewsPerMonth = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.viewsPerMonth
    : socialViewsPerMonth;
  const displaySocialEngagementRate = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.engagementRate
    : socialEngagementRate;
  const displaySocialCtr = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.ctr
    : socialCtr;
  const displaySocialOpenViolationsCount = showDevSocialPreview
    ? 0
    : socialOpenViolationsCount;
  const displaySocialFollowerProgressPct = Math.max(
    0,
    Math.min(100, Math.round((displaySocialFollowers / socialFollowerTarget) * 100)),
  );
  const displaySocialViewsProgressPct = Math.max(
    0,
    Math.min(100, Math.round((displaySocialViewsPerMonth / socialViewsTarget) * 100)),
  );
  const displaySocialReadinessPct = Math.round(
    (displaySocialFollowerProgressPct + displaySocialViewsProgressPct) / 2,
  );
  const displaySocialFollowerGap = Math.max(
    0,
    socialFollowerTarget - displaySocialFollowers,
  );
  const displaySocialViewsGap = Math.max(
    0,
    socialViewsTarget - displaySocialViewsPerMonth,
  );
  const displaySocialReadinessColor =
    displaySocialOpenViolationsCount > 0
      ? '#F59E0B'
      : displaySocialReadinessPct >= 100
        ? '#34D399'
        : DASH.primary;
  const displaySocialReadinessMessage =
    displaySocialOpenViolationsCount > 0
      ? `${displaySocialOpenViolationsCount} open concern${displaySocialOpenViolationsCount === 1 ? '' : 's'} to review`
      : displaySocialFollowerGap <= 0 && displaySocialViewsGap <= 0
        ? 'Ready for campaign review'
        : displaySocialFollowerProgressPct <= displaySocialViewsProgressPct
          ? `Needs ${formatCompactNumber(displaySocialFollowerGap)} more followers`
          : `Needs ${formatCompactNumber(displaySocialViewsGap)} more monthly views`;
  const displaySocialStatusLine =
    displaySocialOpenViolationsCount > 0
      ? 'Momentum is strong, but there is a compliance issue to resolve.'
      : showDevSocialPreview
        ? `Connected from ${displayConnectedPlatforms.length} platforms with rising example engagement.`
        : `Connected from ${displayConnectedPlatforms.length} platform${displayConnectedPlatforms.length === 1 ? '' : 's'} with live Phyllo sync.`;
  const displayRecentSocialMomentum = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.momentum
    : recentSocialMomentum;
  const displayLatestSocialPostSummary = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.latestPostSummary
    : latestSocialPostSummary;
  const displaySocialPlatformSummary = displayConnectedPlatforms
    .slice(0, 2)
    .map((platform) => normalizeSocialPlatformLabel(platform))
    .join(' · ');
  const socialVizAnimationKey = useMemo(
    () =>
      JSON.stringify({
        showDevSocialPreview,
        followers: displaySocialFollowers,
        views: displaySocialViewsPerMonth,
        platforms: displayConnectedPlatforms.length,
        momentum: displayRecentSocialMomentum,
      }),
    [
      showDevSocialPreview,
      displaySocialFollowers,
      displaySocialViewsPerMonth,
      displayConnectedPlatforms.length,
      displayRecentSocialMomentum,
    ],
  );
  useEffect(() => {
    const listenerId = socialVizProgressAnim.addListener(({ value }) => {
      setSocialVizProgress(value);
    });
    return () => {
      socialVizProgressAnim.removeListener(listenerId);
    };
  }, [socialVizProgressAnim]);
  useEffect(() => {
    socialVizProgressAnim.stopAnimation();
    socialVizProgressAnim.setValue(0);
    const animation = Animated.timing(socialVizProgressAnim, {
      toValue: 1,
      duration: SOCIAL_VIZ_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      socialVizProgressAnim.stopAnimation();
    };
  }, [socialVizAnimationKey, socialVizProgressAnim]);

  const accessStateCard = useMemo(() => {
    if (membershipStatus === 'banned') {
      return {
        title: 'Social access removed',
        body: 'Your social program access is currently banned. Please contact your coordinator if this looks incorrect.',
        color: '#EF4444',
      };
    }
    if (membershipStatus === 'paused') {
      return {
        title: 'Social access paused',
        body: 'Your social program access is paused right now. Your coordinator can reactivate it when you are ready.',
        color: '#F59E0B',
      };
    }
    if (!isConnected && hasPendingInvite) {
      return {
        title: 'Invite waiting',
        body: invitedBy?.name
          ? `${invitedBy.name} invited you to Social Posts. Accept or decline the invitation below.`
          : 'You have a pending Social Posts invitation waiting for your response.',
        color: '#60A5FA',
      };
    }
    if (!isConnected && (membershipStatus === 'uninvited' || membershipStatus === 'declined' || membershipStatus === 'not_enrolled')) {
      return {
        title: 'Invite required',
        body: 'You are not currently invited to Social Posts. Once a coordinator invites you, connection controls will become available here.',
        color: '#94A3B8',
      };
    }
    return null;
  }, [hasPendingInvite, invitedBy?.name, isConnected, membershipStatus]);
  const shouldHideProgramDetails =
    membershipStatus === 'invited' ||
    membershipStatus === 'uninvited' ||
    membershipStatus === 'declined' ||
    membershipStatus === 'not_enrolled' ||
    membershipStatus === 'banned';

  const handleAcceptInvite = async () => {
    const inviteId = String(pendingInvite?.id || '').trim();
    if (!inviteId || acceptInviteMutation.isPending) return;
    try {
      await acceptInviteMutation.mutateAsync({ inviteId });
      setConnectActionError(null);
      setConnectActionSuccess('Invite accepted. Connect your first platform when you are ready.');
    } catch (error: any) {
      Alert.alert(
        'Could not accept invite',
        String(error?.message || 'Unable to accept your Social Posts invite right now.'),
      );
    }
  };

  const handleDeclineInvite = async () => {
    const inviteId = String(pendingInvite?.id || '').trim();
    if (!inviteId || declineInviteMutation.isPending) return;
    try {
      await declineInviteMutation.mutateAsync({ inviteId });
      setConnectActionSuccess(null);
      setConnectActionError(null);
      Alert.alert(
        'Invite declined',
        'Your Social Posts invitation was declined. Membership details will stay hidden until you are invited again.',
      );
    } catch (error: any) {
      Alert.alert(
        'Could not decline invite',
        String(error?.message || 'Unable to decline your Social Posts invite right now.'),
      );
    }
  };

  if (shouldHideProgramDetails) {
    return (
      <ScreenContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenHeader
            title="Social Program Progress"
            subtitle="Track your commitments, KPI performance, and compliance status."
            leftSlot={
              <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(trainer)" as any))}
                className="w-10 h-10 rounded-full bg-surface items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Go back"
                testID="social-progress-back"
              >
                <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
              </TouchableOpacity>
            }
          />
          <View className="px-4 pb-8 gap-4">
            {accessStateCard ? (
              <SurfaceCard
                style={{
                  borderColor: `${accessStateCard.color}55`,
                  backgroundColor: `${accessStateCard.color}12`,
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: accessStateCard.color }}
                >
                  {accessStateCard.title}
                </Text>
                <Text className="text-sm mt-1" style={{ color: colors.foreground }}>
                  {accessStateCard.body}
                </Text>
              </SurfaceCard>
            ) : null}
            <SurfaceCard>
              <Text className="text-base font-semibold text-foreground">
                {hasPendingInvite ? 'Review your Social Posts invite' : 'Social Posts is invite-only'}
              </Text>
              <Text className="text-sm text-muted mt-2">
                {hasPendingInvite
                  ? 'Accept the invitation to unlock social connection, campaign tracking, and program details.'
                  : 'Your membership details stay hidden until a coordinator invites you back into the program.'}
              </Text>
              {hasPendingInvite ? (
                <View className="flex-row gap-3 mt-4">
                  <ActionButton
                    className="flex-1"
                    onPress={handleAcceptInvite}
                    loading={acceptInviteMutation.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Accept social program invitation"
                    testID="social-progress-accept-invite"
                  >
                    Accept invite
                  </ActionButton>
                  <ActionButton
                    className="flex-1"
                    variant="secondary"
                    onPress={handleDeclineInvite}
                    loading={declineInviteMutation.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Decline social program invitation"
                    testID="social-progress-decline-invite"
                  >
                    Decline
                  </ActionButton>
                </View>
              ) : null}
            </SurfaceCard>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

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

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Social Program Progress"
          subtitle="Track your commitments, KPI performance, and compliance status."
          leftSlot={
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(trainer)" as any))}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="social-progress-back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          }
        />
        <View className="px-4 pb-8 gap-4">
          <SurfaceCard style={{ ...CARD_SOFT_STYLE, overflow: 'hidden' }}>
            <View
              pointerEvents='none'
              style={{
                position: 'absolute',
                top: -20,
                right: -25,
                width: 110,
                height: 110,
                borderRadius: 55,
                backgroundColor: 'rgba(96,165,250,0.18)',
              }}
            />
            <View
              pointerEvents='none'
              style={{
                position: 'absolute',
                bottom: -28,
                left: -20,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: 'rgba(167,139,250,0.14)',
              }}
            />
            {canUseDevSocialPreview ? (
              <TouchableOpacity
                onPress={() => {
                  const userId = String(user?.id || "").trim();
                  setShowDevSocialPreview((current) => {
                    const next = !current;
                    if (userId) {
                      void setCachedTrainerSocialPreviewMode(userId, next);
                    }
                    return next;
                  });
                }}
                activeOpacity={0.75}
                accessibilityRole='button'
                accessibilityLabel={
                  showDevSocialPreview
                    ? 'Show live social metrics'
                    : 'Show sample social metrics'
                }
                testID='social-progress-preview-toggle'
                className='self-start'
              >
                <Text
                  className='text-base font-semibold'
                  style={{
                    color: DASH.primary,
                    textDecorationLine: 'underline',
                  }}
                >
                  Your social progress at a glance
                </Text>
              </TouchableOpacity>
            ) : (
              <Text
                className='text-base font-semibold'
                style={{ color: DASH.text }}
              >
                Your social progress at a glance
              </Text>
            )}
            <Text className='text-sm mt-1' style={{ color: DASH.muted }}>
              {displaySocialStatusLine}
            </Text>
            <View className='flex-row mt-3 gap-2'>
              <SocialMetricDial
                label='Followers'
                value={formatCompactNumber(displaySocialFollowers * socialVizProgress)}
                helper={`Goal ${formatCompactNumber(socialFollowerTarget)}`}
                progress={displaySocialFollowers / socialFollowerTarget}
                animationProgress={socialVizProgress}
              />
              <SocialMetricDial
                label='V/MO'
                value={formatCompactNumber(displaySocialViewsPerMonth * socialVizProgress)}
                helper={`Goal ${formatCompactNumber(socialViewsTarget)}`}
                progress={displaySocialViewsPerMonth / socialViewsTarget}
                animationProgress={socialVizProgress}
              />
              <SocialMetricDial
                label='Platforms'
                value={String(
                  Math.round(displayConnectedPlatforms.length * socialVizProgress),
                )}
                helper={displaySocialPlatformSummary || 'Connect channels'}
                progress={displayConnectedPlatforms.length / platformDialTarget}
                animationProgress={socialVizProgress}
              />
            </View>
            <View
              className='mt-3 rounded-xl border px-3 py-3'
              style={{
                backgroundColor: 'rgba(11,16,32,0.42)',
                borderColor: 'rgba(148,163,184,0.18)',
              }}
            >
              <View className='flex-row items-center justify-between'>
                <Text
                  className='text-[11px] font-semibold uppercase tracking-[0.8px]'
                  style={{ color: '#93C5FD' }}
                >
                  Recent engagement
                </Text>
                <Text className='text-[11px]' style={{ color: DASH.muted }}>
                  {displayLatestSocialPostSummary}
                </Text>
              </View>
              <View className='mt-3'>
                {displayRecentSocialMomentum.length > 0 ? (
                  <SocialLineChart
                    values={displayRecentSocialMomentum}
                    animationProgress={socialVizProgress}
                  />
                ) : (
                  <SocialLineChartPlaceholder />
                )}
              </View>
              <View className='flex-row flex-wrap mt-3'>
                {[
                  `Engagement ${pct(displaySocialEngagementRate)}`,
                  `CTR ${pct(displaySocialCtr)}`,
                ].map((pill) => (
                  <View
                    key={pill}
                    className='mr-2 mb-2 rounded-full px-2.5 py-1'
                    style={{
                      backgroundColor: 'rgba(15,23,42,0.55)',
                      borderWidth: 1,
                      borderColor: 'rgba(148,163,184,0.25)',
                    }}
                  >
                    <Text
                      className='text-[10px] font-semibold'
                      style={{ color: '#C7D2FE' }}
                    >
                      {pill}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            <View
              className='mt-3 rounded-xl border px-3 py-3'
              style={{
                backgroundColor: 'rgba(11,16,32,0.42)',
                borderColor: 'rgba(148,163,184,0.18)',
              }}
            >
              <View className='flex-row items-center justify-between mb-2'>
                <Text
                  className='text-[11px] font-semibold uppercase tracking-[0.8px]'
                  style={{ color: '#93C5FD' }}
                >
                  Program readiness
                </Text>
                <Text
                  className='text-xs font-semibold'
                  style={{ color: displaySocialReadinessColor }}
                >
                  {displaySocialReadinessPct}%
                </Text>
              </View>
              <View
                className='h-2 rounded-full border overflow-hidden'
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(148,163,184,0.18)',
                }}
              >
                <View
                  style={{
                    width: `${Math.max(8, displaySocialReadinessPct)}%`,
                    height: '100%',
                    backgroundColor: displaySocialReadinessColor,
                  }}
                />
              </View>
              <Text className='text-xs mt-2 font-medium' style={{ color: DASH.text }}>
                {displaySocialReadinessMessage}
              </Text>
            </View>
          </SurfaceCard>

          {accessStateCard ? (
            <SurfaceCard
              style={{
                borderColor: `${accessStateCard.color}55`,
                backgroundColor: `${accessStateCard.color}12`,
              }}
            >
              <Text
                className='text-sm font-semibold'
                style={{ color: accessStateCard.color }}
              >
                {accessStateCard.title}
              </Text>
              <Text className='text-sm mt-1' style={{ color: colors.foreground }}>
                {accessStateCard.body}
              </Text>
            </SurfaceCard>
          ) : null}

          <SurfaceCard style={{ position: 'relative', overflow: 'visible' }}>
            <View className='flex-row items-center justify-between mb-2'>
              <Text className='text-base font-semibold text-foreground'>
                Connected services
              </Text>
              <View className='flex-row items-center gap-2'>
                {isConnected ? (
                  <TouchableOpacity
                    onPress={() => {
                      setSyncDoneAt(null);
                      syncNowMutation.mutate();
                    }}
                    disabled={syncNowMutation.isPending}
                    className='px-2.5 py-1 rounded-full border border-border flex-row items-center'
                    style={{
                      backgroundColor: colors.surface,
                      opacity: syncNowMutation.isPending ? 0.7 : 1,
                      borderColor: syncDoneAt ? 'rgba(52,211,153,0.45)' : colors.border,
                    }}
                    accessibilityRole='button'
                    accessibilityLabel='Run a full social sync now'
                    testID='social-progress-sync-now'
                  >
                    {syncNowMutation.isPending ? (
                      <ActivityIndicator size='small' color={colors.muted} />
                    ) : (
                      <MaterialCommunityIcons
                        name={syncDoneAt ? 'check-circle' : 'refresh'}
                        size={12}
                        color={syncDoneAt ? '#34D399' : colors.muted}
                      />
                    )}
                    <Text
                      className='text-[11px] ml-1'
                      style={{ color: syncDoneAt ? '#34D399' : colors.muted }}
                    >
                      {syncNowMutation.isPending
                        ? 'Syncing...'
                        : syncDoneAt
                          ? 'Synced'
                          : 'Sync now'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {canAttemptConnect ? (
                  <TouchableOpacity
                    onPress={handleConnectPhyllo}
                    disabled={isLaunchingConnect}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isLaunchingConnect ? 0.9 : 1,
                    }}
                    accessibilityRole='button'
                    accessibilityLabel={
                      isConnected
                        ? 'Manage social connections'
                        : 'Set up social connections'
                    }
                    testID='social-progress-connect-more-fab'
                  >
                    {isLaunchingConnect ? (
                      <ActivityIndicator size='small' color='#fff' />
                    ) : (
                      <MaterialCommunityIcons name='cog-outline' size={22} color='#fff' />
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
            <Text className='text-sm text-muted'>
              Membership:{' '}
              <Text className='text-foreground font-semibold capitalize'>
                {String(membershipStatus).replace(/_/g, ' ')}
              </Text>
            </Text>
            <Text className='text-sm text-muted mt-1'>
              Social accounts connected:{' '}
              <Text className='text-foreground font-semibold'>
                {isConnected ? 'Yes' : 'No'}
              </Text>
            </Text>
            {connectActionError ? (
              <Text className='text-xs mt-2' style={{ color: '#EF4444' }}>
                {connectActionError}
              </Text>
            ) : null}
            {connectActionSuccess ? (
              <Text className='text-xs mt-2' style={{ color: '#34D399' }}>
                {connectActionSuccess}
              </Text>
            ) : null}
            <View className='gap-2 mt-3'>
              {platformStats.length > 0 ? (
                platformStats.map((row) => {
                  const platformIcon = getSocialPlatformIcon(row.platform);
                  return (
                    <View
                      key={`progress-service-${row.platform}`}
                      className='rounded-xl border border-border px-3 py-2 flex-row items-center justify-between'
                    >
                      <View className='flex-1 pr-3'>
                        <View className='flex-row items-center'>
                          <MaterialCommunityIcons
                            name={platformIcon.icon as any}
                            size={16}
                            color={platformIcon.color}
                          />
                          <Text className='text-sm font-semibold text-foreground ml-1.5'>
                            {platformIcon.label}
                          </Text>
                        </View>
                        <Text className='text-xs text-muted mt-0.5'>
                          Followers: {row.followers.toLocaleString()}
                        </Text>
                      </View>
                      <View className='items-end'>
                        <Text className='text-xs text-muted'>
                          Impressions / month
                        </Text>
                        <Text className='text-sm font-semibold text-foreground'>
                          {row.impressions.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text className='text-xs text-muted'>None linked yet</Text>
              )}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Campaign Offer Metrics
            </Text>
            {campaignBundles.length === 0 ? (
              <Text className="text-sm text-muted">
                Create an offer from a campaign template to unlock campaign-attributed
                metrics.
              </Text>
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {campaignBundles.slice(0, 8).map((bundle: any) => {
                    const isActive = String(bundle.id) === activeBundleId;
                    return (
                      <TouchableOpacity
                        key={bundle.id}
                        onPress={() => setSelectedBundleId(String(bundle.id))}
                        style={{
                          borderWidth: 1,
                          borderColor: isActive ? colors.primary : colors.border,
                          backgroundColor: isActive ? `${colors.primary}20` : colors.surface,
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Select campaign offer ${bundle.title}`}
                        testID={`social-progress-campaign-${bundle.id}`}
                      >
                        <Text
                          style={{
                            color: isActive ? colors.primary : colors.foreground,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          {bundle.title || "Campaign"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View className="flex-row">
                  <View className="flex-1 mr-2 border border-border rounded-lg px-3 py-2">
                    <Text className="text-xs text-muted">Views</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {measured.views.toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-1 mx-2 border border-border rounded-lg px-3 py-2">
                    <Text className="text-xs text-muted">Clicks</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {measured.clicks.toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-1 ml-2 border border-border rounded-lg px-3 py-2">
                    <Text className="text-xs text-muted">CTR</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {(measured.ctr * 100).toFixed(2)}%
                    </Text>
                  </View>
                </View>
                <Text className="text-xs text-muted mt-2">
                  Source: Campaign-attributed daily facts (measured)
                </Text>
                <View className="flex-row mt-3">
                  <View className="flex-1 mr-2 border border-border rounded-lg px-3 py-2">
                    <Text className="text-xs text-muted">Matched</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {complianceTotals.matched}
                    </Text>
                  </View>
                  <View className="flex-1 mx-2 border border-border rounded-lg px-3 py-2">
                    <Text className="text-xs text-muted">Review</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {complianceTotals.needsReview}
                    </Text>
                  </View>
                  <View className="flex-1 mx-2 border border-border rounded-lg px-3 py-2">
                    <Text className="text-xs text-muted">Rejected</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {complianceTotals.rejected}
                    </Text>
                  </View>
                  <View className="flex-1 ml-2 border border-border rounded-lg px-3 py-2">
                    <Text className="text-xs text-muted">Required</Text>
                    <Text className="text-base font-semibold text-foreground">
                      {complianceTotals.required}
                    </Text>
                  </View>
                </View>
                <View className="mt-4 gap-3">
                  {campaignMetricsQuery.isLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : campaignComplianceRows.length === 0 ? (
                    <Text className="text-sm text-muted">
                      No campaign posting requirements have been configured yet.
                    </Text>
                  ) : (
                    campaignComplianceRows.map((row) => {
                      const statusColor = getComplianceColor(row.complianceState);
                      return (
                        <View
                          key={row.id}
                          className="border border-border rounded-xl px-3 py-3"
                        >
                          <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-semibold text-foreground flex-1 pr-3">
                              {row.campaignAccountName}
                            </Text>
                            <View
                              className="rounded-full px-2.5 py-1"
                              style={{ backgroundColor: `${statusColor}22` }}
                            >
                              <Text
                                style={{
                                  color: statusColor,
                                  fontSize: 11,
                                  fontWeight: "700",
                                }}
                              >
                                {row.complianceLabel}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-xs text-muted mt-2">
                            Posts: {row.matchedPosts}/{Math.max(1, row.requiredPosts)} matched
                            {"  "}• Review {row.needsReviewPosts} • Rejected {row.rejectedPosts}
                          </Text>
                          <Text className="text-xs text-muted mt-2">
                            Hashtags:{" "}
                            {row.requiredHashtags.length > 0
                              ? row.requiredHashtags.join(", ")
                              : "None"}
                          </Text>
                          <Text className="text-xs text-muted mt-1">
                            Mentions:{" "}
                            {row.requiredMentions.length > 0
                              ? row.requiredMentions.join(", ")
                              : "None"}
                          </Text>
                          <Text className="text-xs text-muted mt-1">
                            Platforms:{" "}
                            {row.allowedPlatforms.length > 0
                              ? row.allowedPlatforms.join(", ")
                              : "Any"}
                          </Text>
                          <Text className="text-xs text-muted mt-1">
                            Window:{" "}
                            {formatPostingWindow(
                              row.postingWindowStart,
                              row.postingWindowEnd,
                            )}
                          </Text>
                          {row.requiredLinkSlug ? (
                            <Text className="text-xs text-muted mt-1">
                              Link slug: {row.requiredLinkSlug}
                            </Text>
                          ) : null}
                          {Number(row.ruleMissCounts?.missingHashtag || 0) > 0 ? (
                            <Text className="text-xs mt-2" style={{ color: "#EF4444" }}>
                              {Number(row.ruleMissCounts?.missingHashtag || 0)} post(s) missed the
                              required hashtag.
                            </Text>
                          ) : null}
                          {Number(row.ruleMissCounts?.missingMention || 0) > 0 ? (
                            <Text className="text-xs mt-1" style={{ color: "#EF4444" }}>
                              {Number(row.ruleMissCounts?.missingMention || 0)} post(s) missed the
                              required mention.
                            </Text>
                          ) : null}
                          {Number(row.ruleMissCounts?.missingLink || 0) > 0 ? (
                            <Text className="text-xs mt-1" style={{ color: "#EF4444" }}>
                              {Number(row.ruleMissCounts?.missingLink || 0)} post(s) missed the
                              tracked link requirement.
                            </Text>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Modeled Business Outcomes
            </Text>
            <Text className="text-xs text-muted mb-3">
              Adjustable assumptions for CPC, intent, and conversion forecasting.
            </Text>
            <View className="flex-row">
              <View className="flex-1 mr-2">
                <Text className="text-xs text-muted mb-1">AOV (£)</Text>
                <TextInput
                  value={avgOrderValue}
                  onChangeText={setAvgOrderValue}
                  keyboardType="decimal-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: colors.foreground,
                    backgroundColor: colors.surface,
                  }}
                />
              </View>
              <View className="flex-1 mx-2">
                <Text className="text-xs text-muted mb-1">Click→Intent %</Text>
                <TextInput
                  value={clickToIntentRate}
                  onChangeText={setClickToIntentRate}
                  keyboardType="decimal-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: colors.foreground,
                    backgroundColor: colors.surface,
                  }}
                />
              </View>
              <View className="flex-1 ml-2">
                <Text className="text-xs text-muted mb-1">Intent→Conv %</Text>
                <TextInput
                  value={intentToConversionRate}
                  onChangeText={setIntentToConversionRate}
                  keyboardType="decimal-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    color: colors.foreground,
                    backgroundColor: colors.surface,
                  }}
                />
              </View>
            </View>
            <View className="mt-3">
              <Text className="text-xs text-muted mb-1">Target CPC (£)</Text>
              <TextInput
                value={targetCpc}
                onChangeText={setTargetCpc}
                keyboardType="decimal-pad"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  color: colors.foreground,
                  backgroundColor: colors.surface,
                }}
              />
            </View>
            <View className="flex-row mt-3">
              <View className="flex-1 mr-2 border border-border rounded-lg px-3 py-2">
                <Text className="text-xs text-muted">Projected Intents</Text>
                <Text className="text-base font-semibold text-foreground">
                  {modeled.projectedIntents.toLocaleString()}
                </Text>
              </View>
              <View className="flex-1 mx-2 border border-border rounded-lg px-3 py-2">
                <Text className="text-xs text-muted">Projected Conversions</Text>
                <Text className="text-base font-semibold text-foreground">
                  {modeled.projectedConversions.toLocaleString()}
                </Text>
              </View>
              <View className="flex-1 ml-2 border border-border rounded-lg px-3 py-2">
                <Text className="text-xs text-muted">Projected Revenue</Text>
                <Text className="text-base font-semibold text-foreground">
                  £{modeled.projectedRevenue.toLocaleString()}
                </Text>
              </View>
            </View>
            <Text className="text-xs text-muted mt-2">
              Modeled CPC {modeled.effectiveCpc.toFixed(2)} vs target {Number(targetCpc || 0).toFixed(2)}
              {"  "}({modeled.cpcDelta >= 0 ? "+" : ""}
              {modeled.cpcDelta.toFixed(2)})
            </Text>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Commitment status
            </Text>
            <Text className="text-sm text-muted mb-1">
              Program status:{" "}
              <Text className="text-foreground font-semibold capitalize">
                {String(
                  progress?.status || data?.membership?.status || "not_started",
                ).replace(/_/g, " ")}
              </Text>
            </Text>
            <Text className="text-sm text-muted mb-1">
              Required posts:{" "}
              <Text className="text-foreground font-semibold">
                {Number(
                  commitment?.minimumPosts || progress?.postsRequired || 0,
                )}
              </Text>
            </Text>
            <Text className="text-sm text-muted mb-1">
              Delivered posts:{" "}
              <Text className="text-foreground font-semibold">
                {Number(progress?.postsDelivered || 0)}
              </Text>
            </Text>
            <Text className="text-sm text-muted mb-1">
              On-time posting:{" "}
              <Text className="text-foreground font-semibold">
                {Number(progress?.onTimePct || 0).toFixed(1)}%
              </Text>
            </Text>
            <Text className="text-sm text-muted mb-1">
              Tag compliance:{" "}
              <Text className="text-foreground font-semibold">
                {Number(progress?.tagPct || 0).toFixed(1)}%
              </Text>
            </Text>
            <Text className="text-sm text-muted">
              Approved creative compliance:{" "}
              <Text className="text-foreground font-semibold">
                {Number(progress?.approvedCreativePct || 0).toFixed(1)}%
              </Text>
            </Text>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Concerns and violations
            </Text>
            {violations.length === 0 ? (
              <Text className="text-sm text-muted">
                No active concerns right now.
              </Text>
            ) : (
              <View className="gap-2">
                {violations.slice(0, 10).map((violation: any) => (
                  <View
                    key={violation.id}
                    className="border border-border rounded-lg px-3 py-2"
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {String(violation.type || "Policy concern").replace(
                        /_/g,
                        " ",
                      )}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      {violation.message || "Action required."}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5 capitalize">
                      Severity: {violation.severity || "warning"} | Status:{" "}
                      {String(violation.status || "open").replace(/_/g, " ")}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Recent posts
            </Text>
            {recentPostsQuery.isLoading ? (
              <View className="py-3 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-xs text-muted mt-2">Loading recent posts...</Text>
              </View>
            ) : (recentPostsQuery.data || []).length === 0 ? (
              <Text className="text-sm text-muted">
                No recent synced posts yet.
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
                    <TouchableOpacity
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
                      testID={`social-progress-recent-post-${post.id}`}
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
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </SurfaceCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
