import { ActionButton } from "@/components/action-button";
import { CollapsibleHeaderScrollView } from "@/components/collapsible-header-scroll-view";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useAuthContext } from "@/contexts/auth-context";
import {
    buildTrainerDashboardPalette,
    createTrainerActivityStatusStyles,
    createTrainerOfferStatusStyles,
    type TrainerDashboardPalette,
    trainerDialSegmentColors,
} from "@/design-system/trainer-dashboard";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { trackLaunchEvent } from "@/lib/analytics";
import { getBundleFallbackImageUrl, normalizeAssetUrl } from "@/lib/asset-url";
import { formatGBPFromMinor } from "@/lib/currency";
import { maybeShowInviteCongrats } from "@/lib/social-invite-alerts";
import {
    getCachedTrainerSocialPreviewMode,
    getCachedTrainerSocialStatus,
    getSocialStatusCacheTtlMs,
    isFreshSocialStatusCache,
    setCachedTrainerSocialPreviewMode,
    setCachedTrainerSocialStatus,
} from "@/lib/social-status-cache";
import { trpc } from "@/lib/trpc";
import { mapBundleDraftToBundleView } from "@/shared/bundle-offer";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Platform,
    RefreshControl,
    Text,
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

type NextAction = "invite" | "bundle" | "pay" | "done";
type PaymentStatus = "awaiting_payment" | "paid" | "paid_out" | "cancelled";
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
  lastReminderSentAt?: string | null;
};

type HeroConfig = {
  title: string;
  subtitle: string;
  cta: string;
  ctaIcon: React.ComponentProps<typeof IconSymbol>["name"];
  onPress: () => void;
};

type TierName = "Getting Started" | "Growing" | "Pro" | "Elite";
type SocialCardVariant =
  | "connected"
  | "active_member"
  | "pending_invite"
  | "invite_only";
type DevSocialPreviewData = {
  followers: number;
  viewsPerMonth: number;
  engagementRate: number;
  ctr: number;
  platforms: string[];
  momentum: number[];
  latestPostSummary: string;
};

const TIER_ORDER: TierName[] = ["Getting Started", "Growing", "Pro", "Elite"];
const TIER_MIN_POINTS: Record<TierName, number> = {
  "Getting Started": 0,
  Growing: 1000,
  Pro: 2000,
  Elite: 5000,
};

const TEST_STATE_SEQUENCE: NextAction[] = ["invite", "bundle", "pay", "done"];
const DASH = {} as TrainerDashboardPalette;

const getCardStyle = () => ({ backgroundColor: DASH.card, borderColor: DASH.border });
const getCardSoftStyle = () => ({ backgroundColor: DASH.cardSoft, borderColor: DASH.border });
const getHeroStyle = () => ({ backgroundColor: DASH.heroBg, borderColor: DASH.heroBorder });
const SECTION_SPACING_CLASS = "px-6 mb-7";
const getActionIconWrapStyle = () => ({ backgroundColor: DASH.actionIconWrapBg });
const getActionTileStyle = () => ({ backgroundColor: DASH.actionTileBg, borderColor: DASH.actionTileBorder });
const ACTION_TILE_FIXED_HEIGHT = 140;
const getHeroGlowMainStyle = () => ({ backgroundColor: DASH.heroGlowMain });
const getHeroGlowSecondStyle = () => ({ backgroundColor: DASH.heroGlowSecond });
const getChipStyle = () => ({ backgroundColor: DASH.chipBg, borderColor: DASH.borderStrong });
const getMutedBadgeStyle = () => ({ backgroundColor: DASH.mutedBadgeBg, borderColor: DASH.mutedBadgeBorder });

const getActivityStatusStyle = (): Record<PaymentStatus, { bg: string; text: string; label: string }> =>
  createTrainerActivityStatusStyles(DASH.primary);

const DEV_SOCIAL_PREVIEW_OWNER_EMAILS = [
  "jason@secretlab.com",
  "trainer@secretlab.com",
];
const DEV_SOCIAL_PREVIEW_DATA: DevSocialPreviewData = {
  followers: 13840,
  viewsPerMonth: 18400,
  engagementRate: 0.064,
  ctr: 0.021,
  platforms: ["instagram", "youtube", "tiktok"],
  momentum: [220, 310, 420, 390, 560, 680, 740, 910, 1120, 1360],
  latestPostSummary: "Latest post: 1.8k engagements",
};
const SOCIAL_VIZ_ANIMATION_MS = 1500;

const getOfferStatusStyle = (): Record<OfferStatus, { bg: string; border: string; text: string; label: string }> =>
  createTrainerOfferStatusStyles(DASH.primary);

function formatDateShort(value: string | Date) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatCompactNumber(value: number) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  if (Math.abs(numeric) >= 1_000_000) {
    return `${(numeric / 1_000_000).toFixed(numeric >= 10_000_000 ? 0 : 1)}M`;
  }
  if (Math.abs(numeric) >= 1_000) {
    return `${(numeric / 1_000).toFixed(numeric >= 10_000 ? 0 : 1)}k`;
  }
  return numeric.toLocaleString();
}

function formatRatePercent(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return `${(numeric * 100).toFixed(1)}%`;
}

function normalizeSocialPlatformLabel(value: string) {
  const cleaned = String(value || "")
    .trim()
    .replace(/_/g, " ");
  if (!cleaned) return "";
  if (cleaned.toLowerCase() === "x") return "X";
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatBundleType(value: string | undefined) {
  if (!value) return "Bundle";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
        style={{ ...getActionTileStyle(), height: ACTION_TILE_FIXED_HEIGHT }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
      >
        <View className={`w-12 h-12 rounded-full items-center justify-center ${subtitle || value ? "mb-1.5" : "mb-2"}`} style={getActionIconWrapStyle()}>
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
    <SurfaceCard style={getCardStyle()}>
      <View className="items-center py-4">
        <View className="w-16 h-16 rounded-full items-center justify-center mb-3" style={{ backgroundColor: DASH.emptyIconBg }}>
          <IconSymbol name={icon} size={28} color={DASH.emptyIconColor} />
        </View>
        <Text className="text-sm text-center leading-5 px-2" style={{ color: DASH.emptyText }}>
          {description}
        </Text>
        <TouchableOpacity
          className="mt-3 px-5 py-2 rounded-full border"
          style={getMutedBadgeStyle()}
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
        backgroundColor: isDone || isCurrent ? DASH.chipBg : DASH.stepInactiveBg,
        borderColor: isDone || isCurrent ? DASH.borderStrong : DASH.stepInactiveBorder,
      }}
    >
      <View
        className="w-4 h-4 rounded-full items-center justify-center mr-1.5"
        style={{ backgroundColor: isDone || isCurrent ? DASH.actionIconWrapBg : DASH.stepInactiveBg }}
      >
        {isDone ? (
          <IconSymbol name="checkmark" size={10} color={DASH.primary} />
        ) : (
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isCurrent ? DASH.primary : DASH.stepInactiveDot }} />
        )}
      </View>
      <Text className="text-[11px] font-medium" style={{ color: isDone || isCurrent ? DASH.text : DASH.muted }}>
        {label}
      </Text>
    </View>
  );
}

const DIAL_START_ANGLE = 240;
const DIAL_SWEEP_ANGLE = 240;
const DIAL_SEGMENT_GAP_ANGLE = 8;
const DIAL_SEGMENT_COLORS = trainerDialSegmentColors;

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
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
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
  const clampedProgress = Math.max(
    0,
    Math.min(1, progress * animationProgress),
  );
  const accentColor = getDialAccentColor(clampedProgress);
  const segmentSweep = DIAL_SWEEP_ANGLE / DIAL_SEGMENT_COLORS.length;
  const progressEndAngle = DIAL_START_ANGLE + clampedProgress * DIAL_SWEEP_ANGLE;
  const progressEndPoint = polarToCartesian(center, center, radius, progressEndAngle);
  return (
    <View
      className="flex-1 rounded-xl border px-2 py-3 items-center"
      style={{
        backgroundColor: DASH.socialStatBg,
        borderColor: DASH.socialStatBorder,
        minHeight: 148,
      }}
    >
      <Text
        className="text-[9px] font-semibold uppercase tracking-[0.4px]"
        style={{ color: DASH.socialAccentText }}
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
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={size} height={size}>
          {DIAL_SEGMENT_COLORS.map((segmentColor, index) => {
            const startAngle =
              DIAL_START_ANGLE +
              index * segmentSweep +
              DIAL_SEGMENT_GAP_ANGLE / 2;
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
                strokeLinecap="round"
                fill="none"
                opacity={0.45}
              />
            );
          })}
          {clampedProgress > 0 ? (
            <Path
              d={describeArc(
                center,
                center,
                radius,
                DIAL_START_ANGLE,
                progressEndAngle,
              )}
              stroke={accentColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
          <Circle
            cx={progressEndPoint.x}
            cy={progressEndPoint.y}
            r={3.5}
            fill={accentColor}
          />
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="text-xl font-bold" style={{ color: DASH.text }}>
            {value}
          </Text>
        </View>
      </View>
      {helper ? (
        <Text
          className="text-[10px] mt-1 text-center"
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
  if (points.length === 0) return "";
  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    )
    .join(" ");
}

function buildAreaPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number,
) {
  if (points.length === 0) return "";
  const linePath = buildLinePath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${linePath} L ${lastPoint.x.toFixed(2)} ${baselineY.toFixed(
    2,
  )} L ${firstPoint.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
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
        overflow: "hidden",
        backgroundColor: DASH.chartBg,
        borderWidth: 1,
        borderColor: DASH.chartBorder,
        paddingHorizontal: 4,
        paddingVertical: 4,
      }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="socialMomentumFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#60A5FA" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#60A5FA" stopOpacity="0.02" />
          </LinearGradient>
          <LinearGradient id="socialMomentumLine" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#60A5FA" />
            <Stop offset="100%" stopColor="#A78BFA" />
          </LinearGradient>
          <ClipPath id="socialMomentumReveal">
            <Rect x={0} y={0} width={revealWidth} height={height} />
          </ClipPath>
        </Defs>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingTop + chartHeight * ratio;
          return (
            <Path
              key={`social-grid-${ratio}`}
              d={`M ${paddingX} ${y.toFixed(2)} L ${width - paddingX} ${y.toFixed(2)}`}
              stroke={DASH.chartGrid}
              strokeWidth={1}
              strokeDasharray="4 6"
              fill="none"
            />
          );
        })}
        {areaPath ? (
          <Path
            d={areaPath}
            fill="url(#socialMomentumFill)"
            clipPath="url(#socialMomentumReveal)"
          />
        ) : null}
        {linePath ? (
          <Path
            d={linePath}
            stroke="url(#socialMomentumLine)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            clipPath="url(#socialMomentumReveal)"
          />
        ) : null}
        {lastPoint && clampedProgress > 0.96 ? (
          <>
            <Circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r={6}
              fill="rgba(167,139,250,0.24)"
            />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={3.5} fill="#A78BFA" />
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
  const placeholderLine = buildLinePath(placeholderPoints);
  const placeholderArea = buildAreaPath(placeholderPoints, baselineY);

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
        overflow: "hidden",
        backgroundColor: DASH.chartBg,
        borderWidth: 1,
        borderColor: DASH.chartBorder,
        paddingHorizontal: 4,
        paddingVertical: 4,
        justifyContent: "center",
      }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = paddingTop + (height - paddingTop - paddingBottom) * ratio;
          return (
            <Path
              key={`social-placeholder-grid-${ratio}`}
              d={`M ${paddingX} ${y.toFixed(2)} L ${width - paddingX} ${y.toFixed(2)}`}
              stroke={DASH.chartBorder}
              strokeWidth={1}
              strokeDasharray="4 6"
              fill="none"
            />
          );
        })}
        <Path
          d={placeholderArea}
          fill={DASH.chartPlaceholderFill}
        />
        <Path
          d={placeholderLine}
          stroke={DASH.chartBorder}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 7,
            backgroundColor: DASH.chartOverlayBg,
            borderWidth: 1,
            borderColor: DASH.chartBorder,
          }}
        >
          <Text
            className="text-xs font-medium"
            style={{ color: DASH.chartPlaceholderText }}
          >
            No data available.. Yet.
          </Text>
        </View>
      </View>
    </View>
  );
}

function getConnectedPlatformsFromSocialStatus(status: any): string[] {
  const profile = status?.profile as any;
  const keys = new Set<string>();
  const direct = Array.isArray(profile?.platforms) ? profile.platforms : [];
  for (const value of direct) {
    const key = String(value || "").trim().toLowerCase();
    if (key && key !== "unknown") keys.add(key);
  }
  const rawProfiles = Array.isArray(profile?.metadata?.rawProfiles)
    ? profile.metadata.rawProfiles
    : [];
  for (const row of rawProfiles) {
    const key = String(
      row?.platform ||
        row?.platform_name ||
        row?.work_platform?.name ||
        row?.workPlatform?.name ||
        row?.work_platform_name ||
        row?.network ||
        "",
    )
      .trim()
      .toLowerCase();
    if (key && key !== "unknown") keys.add(key);
  }
  const rawAccounts = Array.isArray(profile?.metadata?.rawAccounts)
    ? profile.metadata.rawAccounts
    : [];
  for (const row of rawAccounts) {
    const key = String(
      row?.platform ||
        row?.platform_name ||
        row?.work_platform?.name ||
        row?.workPlatform?.name ||
        row?.work_platform_name ||
        row?.network ||
        "",
    )
      .trim()
      .toLowerCase();
    if (key && key !== "unknown") keys.add(key);
  }
  return Array.from(keys);
}

function getSocialCardVariant(status: any): SocialCardVariant {
  const connectedPlatforms = getConnectedPlatformsFromSocialStatus(status);
  if (connectedPlatforms.length > 0) return "connected";
  if (String(status?.membership?.status || "").toLowerCase() === "active") {
    return "active_member";
  }
  if (Boolean(status?.pendingInvite?.id)) return "pending_invite";
  return "invite_only";
}

function SocialCardSkeleton() {
  return (
    <SurfaceCard
      style={{
        ...getCardSoftStyle(),
        borderColor: DASH.borderStrong,
        overflow: "hidden",
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -20,
          right: -25,
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: "rgba(96,165,250,0.18)",
        }}
      />
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <View
            style={{
              width: "68%",
              height: 16,
              borderRadius: 999,
              backgroundColor: DASH.skeletonStrong,
            }}
          />
          <View
            style={{
              width: "92%",
              height: 12,
              borderRadius: 999,
              backgroundColor: DASH.skeletonSoft,
              marginTop: 10,
            }}
          />
          <View
            style={{
              width: "78%",
              height: 12,
              borderRadius: 999,
              backgroundColor: DASH.skeletonSoft,
              marginTop: 8,
            }}
          />
          <View className="flex-row mt-4 gap-2">
            {[0, 1, 2].map((idx) => (
              <View
                key={`social-skeleton-pill-${idx}`}
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: DASH.skeletonPillBg }}
              >
                <View
                  style={{
                    width: 54,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: DASH.skeletonPillBar,
                  }}
                />
              </View>
            ))}
          </View>
          <View className="mt-4 items-center py-2">
            <ActivityIndicator size="small" color={DASH.primary} />
          </View>
        </View>
      </View>
    </SurfaceCard>
  );
}

export default function TrainerHomeScreen() {
  const { effectiveUser, user, isImpersonating, impersonatedUser } = useAuthContext();
  const impersonationBannerVisible = Boolean(isImpersonating && impersonatedUser);
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isLight = colorScheme === "light";
  Object.assign(DASH, buildTrainerDashboardPalette(colors, isLight));
  const activityStatusStyles = getActivityStatusStyle();
  const offerStatusStyles = getOfferStatusStyle();
  const utils = trpc.useUtils();
  const [testStateOverride, setTestStateOverride] = useState<NextAction | null>(null);
  const [earningsExpanded, setEarningsExpanded] = useState(false);
  const [showDevSocialPreview, setShowDevSocialPreview] = useState(false);
  const devSocialPreviewInitialized = useRef(false);
  const [, setDevSocialPreviewHydrated] = useState(false);
  const socialVizProgressAnim = useRef(new Animated.Value(0)).current;
  const [socialVizProgress, setSocialVizProgress] = useState(0);
  const heroScaleAnim = useRef(new Animated.Value(1)).current;
  const ctaScaleAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const stepProgressAnim = useRef(new Animated.Value(1)).current;
  const glowFloatAnim = useRef(new Animated.Value(0)).current;
  const glowPulseAnim = useRef(new Animated.Value(0)).current;
  const socialCardPulseAnim = useRef(new Animated.Value(0)).current;
  const socialCardFloatAnim = useRef(new Animated.Value(0)).current;

  // Twitch-style floating emoji stream for social card
  const SOCIAL_EMOJIS = ["💰", "📱", "🔥", "⭐", "💫", "👀", "📊", "💪", "✨", "🎯"];
  const EMOJI_POOL_SIZE = 6;
  const emojiPool = useRef(
    Array.from({ length: EMOJI_POOL_SIZE }, () => ({
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;
  const [emojiSlots, setEmojiSlots] = useState<{ emoji: string; right: number }[]>(
    Array.from({ length: EMOJI_POOL_SIZE }, (_, i) => ({
      emoji: "💰",
      right: 12 + (i % 4) * 18,
    }))
  );
  const nextEmojiSlot = useRef(0);

  const {
    data: clients = [],
    isRefetching: clientsRefetching,
    refetch: refetchClients,
  } = trpc.clients.list.useQuery();
  const {
    data: trainerBundles = [],
    isLoading: offersLoading,
    isRefetching: offersRefetching,
    refetch: refetchOffers,
  } = trpc.bundles.list.useQuery();
  const offers = useMemo(
    () => (trainerBundles as any[]).map((bundle) => mapBundleDraftToBundleView(bundle)),
    [trainerBundles],
  );
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
  const {
    data: socialStatus,
    isLoading: socialStatusLoading,
    isRefetching: socialStatusRefetching,
    refetch: refetchSocialStatus,
  } = trpc.socialProgram.myStatus.useQuery(undefined, {
    staleTime: getSocialStatusCacheTtlMs(),
    refetchInterval: getSocialStatusCacheTtlMs(),
    refetchOnMount: true,
    refetchOnReconnect: true,
  });
  const [cachedSocialStatusEntry, setCachedSocialStatusEntry] = useState<{
    data: any;
    timestamp: number;
  } | null>(null);
  const [socialStatusCacheHydrated, setSocialStatusCacheHydrated] = useState(false);
  useEffect(() => {
    const userId = String(effectiveUser?.id || "").trim();
    let isCancelled = false;
    if (!userId) {
      setCachedSocialStatusEntry(null);
      setSocialStatusCacheHydrated(true);
      return;
    }
    setSocialStatusCacheHydrated(false);
    getCachedTrainerSocialStatus(userId).then((entry) => {
      if (isCancelled) return;
      setCachedSocialStatusEntry(entry);
      setSocialStatusCacheHydrated(true);
    });
    return () => {
      isCancelled = true;
    };
  }, [effectiveUser?.id]);
  useEffect(() => {
    const userId = String(effectiveUser?.id || "").trim();
    if (!userId || !socialStatus) return;
    const nextEntry = {
      data: socialStatus,
      timestamp: Date.now(),
    };
    setCachedSocialStatusEntry(nextEntry);
    setCachedTrainerSocialStatus(userId, socialStatus);
  }, [effectiveUser?.id, socialStatus]);
  const cachedSocialCardVariant = useMemo(
    () => getSocialCardVariant(cachedSocialStatusEntry?.data),
    [cachedSocialStatusEntry?.data],
  );
  const cachedSocialMembershipStatus = String(
    cachedSocialStatusEntry?.data?.membership?.status || "",
  ).toLowerCase();
  const shouldUseCachedSocialStatus =
    !socialStatus &&
    Boolean(cachedSocialStatusEntry?.data) &&
    (cachedSocialCardVariant === "connected" ||
      cachedSocialCardVariant === "active_member" ||
      cachedSocialMembershipStatus === "banned" ||
      cachedSocialMembershipStatus === "paused" ||
      isFreshSocialStatusCache(cachedSocialStatusEntry?.timestamp));
  const resolvedSocialStatus = socialStatus ||
    (shouldUseCachedSocialStatus ? cachedSocialStatusEntry?.data : null);
  const socialRecentPostsQuery = trpc.socialProgram.recentPosts.useQuery(
    { limit: 6, sparklineDays: 10 },
    { enabled: Boolean((resolvedSocialStatus?.profile as any)?.phylloUserId) },
  );

  const isRefetching =
    clientsRefetching ||
    offersRefetching ||
    statsRefetching ||
    invitationsRefetching ||
    payoutRefetching ||
    activityRefetching ||
    pendingPaymentsRefetching ||
    pointsRefetching ||
    socialStatusRefetching ||
    socialRecentPostsQuery.isRefetching;

  const hasClient = clients.length > 0;
  const hasPendingInvite = invitations.some((invite) => {
    const status = (invite.status || "pending").toLowerCase();
    return status === "pending";
  });
  const hasClientOrInvite = hasClient || hasPendingInvite;
  const hasPendingSocialInvite = Boolean(resolvedSocialStatus?.pendingInvite?.id);
  const hasBundle = offers.length > 0;
  const hasPayment = (paymentStats?.paid || 0) > 0 || (paymentStats?.paidOut || 0) > 0;
  const liveNextAction: NextAction = !hasClientOrInvite ? "invite" : !hasBundle ? "bundle" : !hasPayment ? "pay" : "done";
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
      const rawStatus = (payment.rawStatus || "").toLowerCase();
      return rawStatus !== "cancelled" && rawStatus !== "authorised" && rawStatus !== "captured" && rawStatus !== "paid_out";
    });
  }, [pendingPaymentHistory]);
  const pendingPaymentsCount = pendingPaymentRows.length;
  const pendingPaymentsTotalMinor = useMemo(
    () => pendingPaymentRows.reduce((sum, payment) => sum + (payment.amountMinor || 0), 0),
    [pendingPaymentRows],
  );

  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const cancelPendingPayment = trpc.payments.cancelLink.useMutation({
    onSuccess: async () => {
      setCancellingRef(null);
      await Promise.all([
        utils.payments.history.invalidate(),
        utils.payments.stats.invalidate(),
      ]);
    },
    onError: () => setCancellingRef(null),
  });

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

  const connectedSocialPlatforms = useMemo(
    () => getConnectedPlatformsFromSocialStatus(resolvedSocialStatus),
    [resolvedSocialStatus],
  );
  const canUseDevSocialPreview =
    __DEV__ &&
    DEV_SOCIAL_PREVIEW_OWNER_EMAILS.includes(
      String(user?.email || "").trim().toLowerCase(),
    );

  const showConnectedSocialCard = connectedSocialPlatforms.length > 0;
  const socialMembershipStatus = String(
    resolvedSocialStatus?.membership?.status || "",
  ).toLowerCase();
  const isActiveSocialMember =
    socialMembershipStatus === "active";
  const socialProfile = resolvedSocialStatus?.profile as any;
  const socialCommitment = resolvedSocialStatus?.commitment as any;
  const socialFollowers = Number(socialProfile?.followerCount || 0);
  const socialEngagementRate = Number(socialProfile?.avgEngagementRate || 0);
  const socialCtr = Number(socialProfile?.avgCtr || 0);
  const socialFollowerTarget = Math.max(1, Number(socialCommitment?.minimumFollowers || 10000));
  const socialViewsTarget = Math.max(1, Number(socialCommitment?.minimumAvgViews || 1000));
  const socialOpenViolationsCount = Array.isArray(resolvedSocialStatus?.openViolations)
    ? resolvedSocialStatus.openViolations.length
    : 0;
  const recentSocialPosts = socialRecentPostsQuery.data || [];
  const socialViewsPerMonthFromPosts = recentSocialPosts.reduce(
    (sum: number, post: any) => sum + Number(post?.latestViews || 0),
    0,
  );
  const socialViewsPerMonth = Math.max(
    Number(socialProfile?.avgViewsPerMonth || 0),
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
  const socialFollowerProgressPct = Math.max(
    0,
    Math.min(100, Math.round((socialFollowers / socialFollowerTarget) * 100)),
  );
  const socialViewsProgressPct = Math.max(
    0,
    Math.min(100, Math.round((socialViewsPerMonth / socialViewsTarget) * 100)),
  );
  const socialReadinessPct = Math.round(
    (socialFollowerProgressPct + socialViewsProgressPct) / 2,
  );
  const resolvedSocialReadinessColor =
    socialOpenViolationsCount > 0
      ? "#F59E0B"
      : socialReadinessPct >= 100
        ? "#34D399"
        : DASH.primary;
  const latestSocialPost = recentSocialPosts[0] || null;
  const latestSocialPostSummary = latestSocialPost
    ? `Latest post: ${formatCompactNumber(Number(latestSocialPost.latestEngagements || 0))} engagements`
    : socialRecentPostsQuery.isLoading
      ? "Syncing first post signals..."
      : "Syncing first post signals...";
  const platformDialTarget = 3;
  const shouldAutoEnableDevPreview =
    canUseDevSocialPreview &&
    showConnectedSocialCard &&
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
    if (!showConnectedSocialCard || !userId || devSocialPreviewInitialized.current) return;
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
  }, [
    canUseDevSocialPreview,
    shouldAutoEnableDevPreview,
    showConnectedSocialCard,
    user?.id,
  ]);
  const displayConnectedSocialPlatforms = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.platforms
    : connectedSocialPlatforms;
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
    Math.min(
      100,
      Math.round((displaySocialFollowers / socialFollowerTarget) * 100),
    ),
  );
  const displaySocialViewsProgressPct = Math.max(
    0,
    Math.min(
      100,
      Math.round((displaySocialViewsPerMonth / socialViewsTarget) * 100),
    ),
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
      ? "#F59E0B"
      : displaySocialReadinessPct >= 100
        ? "#34D399"
        : resolvedSocialReadinessColor;
  const displaySocialReadinessMessage =
    displaySocialOpenViolationsCount > 0
      ? `${displaySocialOpenViolationsCount} open concern${displaySocialOpenViolationsCount === 1 ? "" : "s"} to review`
      : displaySocialFollowerGap <= 0 && displaySocialViewsGap <= 0
        ? "Ready for campaign review"
        : displaySocialFollowerProgressPct <= displaySocialViewsProgressPct
          ? `Needs ${formatCompactNumber(displaySocialFollowerGap)} more followers`
          : `Needs ${formatCompactNumber(displaySocialViewsGap)} more monthly views`;
  const displaySocialStatusLine =
    displaySocialOpenViolationsCount > 0
      ? "Momentum is strong, but there is a compliance issue to resolve."
      : showDevSocialPreview
        ? `Connected from ${displayConnectedSocialPlatforms.length} platforms with rising example engagement.`
        : `Connected from ${displayConnectedSocialPlatforms.length} platform${displayConnectedSocialPlatforms.length === 1 ? "" : "s"} with live Phyllo sync.`;
  const displayRecentSocialMomentum = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.momentum
    : recentSocialMomentum;
  const displayLatestSocialPostSummary = showDevSocialPreview
    ? DEV_SOCIAL_PREVIEW_DATA.latestPostSummary
    : latestSocialPostSummary;
  const displaySocialPlatformSummary = displayConnectedSocialPlatforms
    .slice(0, 2)
    .map((platform) => normalizeSocialPlatformLabel(platform))
    .join(" · ");
  const showSocialCardSkeleton = false;
  const socialDataReady = Boolean(resolvedSocialStatus) || (socialStatusCacheHydrated && !socialStatusLoading);
  const shouldShowSocialHomeCard =
    socialDataReady &&
    (showConnectedSocialCard || isActiveSocialMember || hasPendingSocialInvite) &&
    socialMembershipStatus !== "banned" &&
    socialMembershipStatus !== "uninvited";
  const shouldHideSocialHomeCard = !shouldShowSocialHomeCard;
  const socialHomeCardTitle = showConnectedSocialCard
    ? "Your social progress at a glance"
    : socialMembershipStatus === "banned"
      ? "Social access removed."
      : socialMembershipStatus === "paused"
        ? "Social access paused."
        : isActiveSocialMember
          ? "You’re in Social Posts."
          : hasPendingSocialInvite
            ? "You’ve been invited to Social Posts."
            : "Get Paid for Social Posts.";
  const socialHomeCardSubtitle = showConnectedSocialCard
    ? displaySocialStatusLine
    : socialMembershipStatus === "banned"
      ? "Your social program access is currently banned. Please contact your coordinator if this looks incorrect."
      : socialMembershipStatus === "paused"
        ? "Your social program access is paused right now. Your coordinator can reactivate it when you are ready."
        : isActiveSocialMember
          ? "Connect your first social channel to unlock campaign tracking, recent posts, and progress metrics."
          : hasPendingSocialInvite
            ? `Congratulations${resolvedSocialStatus?.invitedBy?.name ? `, ${resolvedSocialStatus.invitedBy.name} invited you` : ""} to join this exclusive creator program.`
            : "This is an exclusive invite-only program for trainers selected to post and earn from social campaigns.";
  const socialHomeCardAccessibilityLabel = `${socialHomeCardTitle} ${socialHomeCardSubtitle}`.trim();
  const socialVizAnimationKey = useMemo(
    () =>
      JSON.stringify({
        showConnectedSocialCard,
        showDevSocialPreview,
        followers: displaySocialFollowers,
        views: displaySocialViewsPerMonth,
        platforms: displayConnectedSocialPlatforms.length,
        momentum: displayRecentSocialMomentum,
      }),
    [
      showConnectedSocialCard,
      showDevSocialPreview,
      displaySocialFollowers,
      displaySocialViewsPerMonth,
      displayConnectedSocialPlatforms.length,
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
    if (!showConnectedSocialCard) {
      socialVizProgressAnim.stopAnimation();
      socialVizProgressAnim.setValue(0);
      setSocialVizProgress(0);
      return;
    }
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
  }, [showConnectedSocialCard, socialVizAnimationKey, socialVizProgressAnim]);
  const handleToggleDevSocialPreview = (event?: any) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    if (!canUseDevSocialPreview) return;
    const userId = String(user?.id || "").trim();
    setShowDevSocialPreview((current) => {
      const next = !current;
      if (userId) {
        void setCachedTrainerSocialPreviewMode(userId, next);
      }
      return next;
    });
  };
  const canNavigateSocialCard =
    !(showConnectedSocialCard && canUseDevSocialPreview);

  // #region agent log
  useEffect(() => {
    const cardVariant = showConnectedSocialCard
      ? "connected"
      : isActiveSocialMember
        ? "active_member_no_platform"
        : hasPendingSocialInvite
          ? "pending_invite"
          : "invite_only_fallback";
    fetch('http://127.0.0.1:7478/ingest/df68b49b-3d9f-498c-ad02-48ff4882188d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08d30c'},body:JSON.stringify({sessionId:'08d30c',runId:'trainer-home-social-card',hypothesisId:'H1_H2_H3',location:'app/(trainer)/index.tsx:640',message:'trainer_home_social_card_state',data:{socialStatusLoading,socialStatusRefetching,hasSocialStatusData:Boolean(socialStatus),membershipStatus:String(socialStatus?.membership?.status||''),pendingInviteId:String(socialStatus?.pendingInvite?.id||''),connectedPlatforms:connectedSocialPlatforms,showConnectedSocialCard,isActiveSocialMember,hasPendingSocialInvite,cardVariant},timestamp:Date.now()})}).catch(()=>{});
  }, [
    connectedSocialPlatforms,
    hasPendingSocialInvite,
    isActiveSocialMember,
    showConnectedSocialCard,
    socialStatus,
    socialStatusLoading,
    socialStatusRefetching,
  ]);
  // #endregion

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7478/ingest/df68b49b-3d9f-498c-ad02-48ff4882188d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08d30c'},body:JSON.stringify({sessionId:'08d30c',runId:'trainer-home-social-card',hypothesisId:'H1',location:'app/(trainer)/index.tsx:659',message:'trainer_home_social_query_transition',data:{socialStatusLoading,hasSocialStatusData:Boolean(socialStatus),membershipStatus:String(socialStatus?.membership?.status||''),phylloUserId:String((socialStatus?.profile as any)?.phylloUserId||''),platformCount:Array.isArray((socialStatus?.profile as any)?.platforms)?(socialStatus?.profile as any)?.platforms.length:0},timestamp:Date.now()})}).catch(()=>{});
  }, [socialStatus, socialStatusLoading]);
  // #endregion

  const getBundleImageUrl = (offer: any): string => {
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

    return getBundleFallbackImageUrl(offer?.title);
  };

  const heroStep = nextAction === "invite" ? 1 : nextAction === "bundle" ? 2 : 3;

  const heroConfig: HeroConfig = (() => {
    if (nextAction === "invite") {
      return {
        title: "You’re 2 steps away from your first payout",
        subtitle: "Invite your first client and set up a bundle to start earning.",
        cta: "Invite client",
        ctaIcon: "person.badge.plus",
        onPress: () => {
          trackLaunchEvent("trainer_home_next_action_tapped", { step: "invite" });
          router.push("/(trainer)/invite" as any);
        },
      };
    }
    if (nextAction === "bundle") {
      return {
        title: "Create your first bundle",
        subtitle: "Package your expertise into a clear, client-ready plan.",
        cta: "Create bundle",
        ctaIcon: "sparkles",
        onPress: () => {
          trackLaunchEvent("trainer_home_next_action_tapped", { step: "bundle" });
          router.push("/bundle-editor/new" as any);
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
      refetchSocialStatus(),
      socialRecentPostsQuery.refetch(),
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
    const inviteId = String(socialStatus?.pendingInvite?.id || "").trim();
    if (!inviteId) return;
    void maybeShowInviteCongrats({
      inviteId,
      coordinatorName: socialStatus?.invitedBy?.name || null,
    });
  }, [socialStatus?.invitedBy?.name, socialStatus?.pendingInvite?.id]);

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

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(socialCardPulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(socialCardPulseAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(socialCardFloatAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(socialCardFloatAnim, {
          toValue: 0,
          duration: 2600,
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
  }, [socialCardFloatAnim, socialCardPulseAnim]);

  // Spawn floating emoji reactions
  useEffect(() => {
    const rightPositions = [14, 32, 50, 22, 42, 8];
    const interval = setInterval(() => {
      const idx = nextEmojiSlot.current % EMOJI_POOL_SIZE;
      nextEmojiSlot.current++;
      const emoji = SOCIAL_EMOJIS[Math.floor(Math.random() * SOCIAL_EMOJIS.length)];
      const right = rightPositions[idx];
      setEmojiSlots((prev) => {
        const next = [...prev];
        next[idx] = { emoji, right };
        return next;
      });
      const slot = emojiPool[idx];
      slot.y.setValue(0);
      slot.opacity.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(slot.opacity, { toValue: 0.92, duration: 180, useNativeDriver: true }),
          Animated.delay(650),
          Animated.timing(slot.opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
        Animated.timing(slot.y, {
          toValue: -88,
          duration: 1210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 480);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emojiPool, nextEmojiSlot]);

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
  const socialFloatY = socialCardFloatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });

  const openGetPaid = (source: string, mode?: "tap" | "link") => {
    trackLaunchEvent("trainer_home_next_action_tapped", { step: source, mode: mode || "default" });
    router.push({
      pathname: "/(trainer)/get-paid",
      ...(mode ? { params: { mode } } : {}),
    } as any);
  };


  const handleCancelPendingPayment = async (payment: PendingPaymentRow) => {
    const doCancel = async () => {
      try {
        setCancellingRef(payment.merchantReference);
        await cancelPendingPayment.mutateAsync({ merchantReference: payment.merchantReference });
      } catch (error: any) {
        setCancellingRef(null);
        const msg = error?.message || "Please try again.";
        Alert.alert("Unable to cancel", msg);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Cancel payment link?\n\nThe client will no longer be able to pay using this link.")) {
        await doCancel();
      }
    } else {
      Alert.alert(
        "Cancel payment link?",
        "The client will no longer be able to pay using this link.",
        [
          { text: "Keep link", style: "cancel" },
          { text: "Cancel link", style: "destructive", onPress: doCancel },
        ],
      );
    }
  };

  const totalEarned = formatGBPFromMinor(paymentStats?.totalPaidMinor || 0);
  const availableEarnings = formatGBPFromMinor(Math.round((payoutSummary?.available || 0) * 100));
  const pendingEarnings = formatGBPFromMinor(Math.round((payoutSummary?.pending || 0) * 100));
  const payoutStatusLabel = payoutSummary?.statusLabel || (payoutSummary?.bankConnected ? "Active" : "Not Started");
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
      label: "Create bundle",
      onPress: () => {
        trackLaunchEvent("trainer_home_next_action_tapped", { step: "bundle" });
        router.push("/bundle-editor/new" as any);
      },
      testID: "trainer-quick-bundle",
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
      onPress: () => router.push("/(trainer)/payment-history" as any),
      testID: "trainer-quick-pending-payments",
    },
  ];

  const activityRows = (recentActivity as any[]).filter((item) => item.status !== "cancelled").slice(0, 5);
  const hasAnyLoading =
    offersLoading ||
    statsLoading ||
    invitationsLoading ||
    payoutLoading ||
    activityLoading ||
    pendingPaymentsLoading ||
    pointsLoading ||
    (socialStatusLoading && !resolvedSocialStatus);

  const homeHeaderSubtitle =
    process.env.EXPO_PUBLIC_SHOW_PROGRESS_HEADER === "1"
      ? "Let's get you paid."
      : "Manage clients, create bundles, and grow your business.";

  return (
    <ScreenContainer
      edges={["top", "left", "right"]}
      containerClassName="bg-background"
      safeAreaClassName="bg-background"
      className="bg-background"
    >
      <CollapsibleHeaderScrollView
        title={`Hi, ${firstName} 👋`}
        subtitle={homeHeaderSubtitle}
        testID="trainer-home-scroll"
        contentContainerClassName="bg-background"
        omitInternalTopInset={!impersonationBannerVisible}
        expandedExtraHeight={process.env.EXPO_PUBLIC_SHOW_PROGRESS_HEADER === "1" ? 0 : 22}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={DASH.primary} />}
        headerDecoration={
          process.env.EXPO_PUBLIC_SHOW_PROGRESS_HEADER === "1" ? undefined : (
            <View
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 20,
                overflow: "hidden",
                backgroundColor: DASH.heroBg,
                borderWidth: 1,
                borderColor: DASH.heroBorder,
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: -40,
                  right: -30,
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: "rgba(129,140,248,0.18)",
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  bottom: -50,
                  left: -20,
                  width: 130,
                  height: 130,
                  borderRadius: 65,
                  backgroundColor: "rgba(96,165,250,0.14)",
                }}
              />
            </View>
          )
        }
        headerDecorationHeight={100}
        decorationMarginTop={0}
        overlayTitleOnHeaderDecoration
      >
        {process.env.EXPO_PUBLIC_SHOW_PROGRESS_HEADER === "1" ? (
          <>
        <View className={SECTION_SPACING_CLASS}>
          <Animated.View style={{ transform: [{ scale: heroScaleAnim }] }}>
            <SurfaceCard className="relative overflow-hidden" style={getHeroStyle()}>
            <Animated.View
              pointerEvents="none"
              style={[
                getHeroGlowMainStyle(),
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
                getHeroGlowSecondStyle(),
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

            <View className="self-start flex-row items-center px-3 py-1 rounded-full border mb-3" style={getChipStyle()}>
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

            <Text className="text-[12px] uppercase tracking-[1px] mb-1" style={{ color: DASH.muted }}>
              Progress
            </Text>
            <Text className="text-xl font-bold mb-2" style={{ color: DASH.text }}>
              {heroConfig.title}
            </Text>
            <Text className="text-sm mb-5" style={{ color: DASH.heroSubtitle }}>
              {heroConfig.subtitle}
            </Text>

            <View className="flex-row items-center gap-2 mb-6">
              {[1, 2, 3].map((step) => (
                <Animated.View
                  key={step}
                  className="flex-1 h-2 rounded-full"
                  style={{
                    backgroundColor: step <= heroStep ? DASH.primary : DASH.divider,
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
              <StepPill label="Create bundle" isDone={heroStep > 2} isCurrent={heroStep === 2} />
              <StepPill label={nextAction === "done" ? "Bonus status" : "Get paid"} isDone={nextAction === "done"} isCurrent={heroStep === 3} />
            </View>

            {nextAction === "done" ? (
              <View
                className="rounded-xl border px-3 py-3 mb-5"
                style={{ backgroundColor: DASH.ratingPanelBg, borderColor: DASH.ratingPanelBorder }}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-semibold" style={{ color: DASH.text }}>
                    Rating
                  </Text>
                  <View className="flex-row items-center">
                    <IconSymbol name="star.fill" size={14} color="#FBBF24" />
                    <Text className="text-sm font-semibold ml-1" style={{ color: DASH.ratingText }}>
                      {statusTier}
                    </Text>
                  </View>
                </View>
                <View className="mt-2 h-2 rounded-full" style={{ backgroundColor: DASH.progressTrackBg }}>
                  <View
                    className="h-2 rounded-full"
                    style={{ width: `${Math.round(tierProgress * 100)}%`, backgroundColor: "#A78BFA" }}
                  />
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs" style={{ color: DASH.ratingText }}>
                    {totalPoints.toLocaleString()} pts
                  </Text>
                  <Text className="text-xs" style={{ color: DASH.ratingText }}>
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
              style={{ borderColor: DASH.secondaryButtonBorder, backgroundColor: DASH.secondaryButtonBg }}
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
              <View className="mt-4 pt-3 border-t" style={{ borderColor: DASH.divider }}>
                <Text className="text-xs mb-2" style={{ color: DASH.muted }}>
                  Testing controls
                  {testStateOverride ? ` (${testStateOverride})` : " (live)"}
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    className="flex-1 rounded-xl py-2.5 items-center border"
                    style={getMutedBadgeStyle()}
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
                    style={getMutedBadgeStyle()}
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
                    style={getMutedBadgeStyle()}
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
          </>
        ) : null}

        <View className={SECTION_SPACING_CLASS}>
          {shouldHideSocialHomeCard ? null : showSocialCardSkeleton ? (
            <SocialCardSkeleton />
          ) : !canNavigateSocialCard ? (
            <View testID="trainer-social-program-card">
              <SurfaceCard
                style={{
                  ...getCardSoftStyle(),
                  borderColor: DASH.borderStrong,
                  overflow: "hidden",
                }}
              >
                <TouchableOpacity
                  onPress={() =>
                    router.push(
                      (showConnectedSocialCard
                        ? "/(trainer)/social-progress"
                        : "/(trainer)/social-progress") as any,
                    )
                  }
                  activeOpacity={0.92}
                  accessibilityRole="button"
                  accessibilityLabel={socialHomeCardAccessibilityLabel}
                  testID="trainer-social-card-body-link"
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    zIndex: 1,
                  }}
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: -20,
                    right: -25,
                    width: 110,
                    height: 110,
                    borderRadius: 55,
                    backgroundColor: "rgba(96,165,250,0.18)",
                  }}
                />
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: -28,
                    left: -20,
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: "rgba(167,139,250,0.14)",
                    transform: [{ translateY: socialFloatY }],
                  }}
                />
                {showConnectedSocialCard && canUseDevSocialPreview ? (
                  <TouchableOpacity
                    onPress={handleToggleDevSocialPreview}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showDevSocialPreview
                        ? "Show live social metrics"
                        : "Show sample social metrics"
                    }
                    testID="trainer-social-preview-toggle"
                    className="self-start"
                    style={{ zIndex: 2 }}
                  >
                    <Text
                      className="text-base font-semibold"
                      style={{
                        color: DASH.primary,
                        textDecorationLine: "underline",
                      }}
                    >
                      Your social progress at a glance
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <View
                  className="flex-row items-start justify-between gap-3"
                  pointerEvents="none"
                >
                  <View className="flex-1">
                    {!showConnectedSocialCard || !canUseDevSocialPreview ? (
                      <Text
                        className="text-base font-semibold"
                        style={{ color: DASH.text }}
                      >
                        {socialHomeCardTitle}
                      </Text>
                    ) : null}
                    <Text className="text-sm mt-1" style={{ color: DASH.muted }}>
                      {socialHomeCardSubtitle}
                    </Text>
                    {showConnectedSocialCard ? (
                      <>
                        <View className="flex-row mt-3 gap-2">
                          <SocialMetricDial
                            label="Followers"
                            value={formatCompactNumber(
                              displaySocialFollowers * socialVizProgress,
                            )}
                            helper={`Goal ${formatCompactNumber(socialFollowerTarget)}`}
                            progress={
                              displaySocialFollowers / socialFollowerTarget
                            }
                            animationProgress={socialVizProgress}
                          />
                          <SocialMetricDial
                            label="V/MO"
                            value={formatCompactNumber(
                              displaySocialViewsPerMonth * socialVizProgress,
                            )}
                            helper={`Goal ${formatCompactNumber(socialViewsTarget)}`}
                            progress={
                              displaySocialViewsPerMonth / socialViewsTarget
                            }
                            animationProgress={socialVizProgress}
                          />
                          <SocialMetricDial
                            label="Platforms"
                            value={String(
                              Math.round(
                                displayConnectedSocialPlatforms.length *
                                  socialVizProgress,
                              ),
                            )}
                            helper={
                              displaySocialPlatformSummary || "Connect channels"
                            }
                            progress={
                              displayConnectedSocialPlatforms.length /
                              platformDialTarget
                            }
                            animationProgress={socialVizProgress}
                          />
                        </View>

                        <View
                          className="mt-3 rounded-xl border px-3 py-3"
                          style={{
                            backgroundColor: DASH.socialStatBg,
                            borderColor: DASH.socialStatBorder,
                          }}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text
                              className="text-[11px] font-semibold uppercase tracking-[0.8px]"
                              style={{ color: DASH.socialAccentText }}
                            >
                              Recent engagement
                            </Text>
                            <Text
                              className="text-[11px]"
                              style={{ color: DASH.muted }}
                            >
                              {displayLatestSocialPostSummary}
                            </Text>
                          </View>
                          <View className="mt-3">
                            {displayRecentSocialMomentum.length > 0 ? (
                              <SocialLineChart
                                values={displayRecentSocialMomentum}
                                animationProgress={socialVizProgress}
                              />
                            ) : (
                              <SocialLineChartPlaceholder />
                            )}
                          </View>
                          <View className="flex-row flex-wrap mt-3">
                            {[
                              `Engagement ${formatRatePercent(displaySocialEngagementRate)}`,
                              `CTR ${formatRatePercent(displaySocialCtr)}`,
                            ].map((pill) => (
                              <View
                                key={pill}
                                className="mr-2 mb-2 rounded-full px-2.5 py-1"
                                style={{
                                  backgroundColor: DASH.socialPillBg,
                                  borderWidth: 1,
                                  borderColor: DASH.socialPillBorder,
                                }}
                              >
                                <Text
                                  className="text-[10px] font-semibold"
                                  style={{ color: DASH.socialPillText }}
                                >
                                  {pill}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        <View
                          className="mt-3 rounded-xl border px-3 py-3"
                          style={{
                            backgroundColor: DASH.socialStatBg,
                            borderColor: DASH.socialStatBorder,
                          }}
                        >
                          <View className="flex-row items-center justify-between mb-2">
                            <Text
                              className="text-[11px] font-semibold uppercase tracking-[0.8px]"
                              style={{ color: DASH.socialAccentText }}
                            >
                              Program readiness
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: displaySocialReadinessColor }}
                            >
                              {displaySocialReadinessPct}%
                            </Text>
                          </View>
                          <View
                            className="h-2 rounded-full border overflow-hidden"
                            style={{
                              backgroundColor: DASH.progressTrackBg,
                              borderColor: DASH.socialStatBorder,
                            }}
                          >
                            <View
                              style={{
                                width: `${Math.max(8, displaySocialReadinessPct)}%`,
                                height: "100%",
                                backgroundColor: displaySocialReadinessColor,
                              }}
                            />
                          </View>
                          <Text
                            className="text-xs mt-2 font-medium"
                            style={{ color: DASH.text }}
                          >
                            {displaySocialReadinessMessage}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View className="flex-row mt-3">
                          {["Followers", "Views", "Compliance"].map((pill) => (
                            <View
                              key={pill}
                              className="mr-2 rounded-full px-2.5 py-1"
                              style={{
                                backgroundColor: DASH.socialPillBg,
                                borderWidth: 1,
                                borderColor: DASH.socialPillBorder,
                              }}
                            >
                              <Text
                                className="text-[10px] font-semibold"
                                style={{ color: DASH.socialPillText }}
                              >
                                {pill}
                              </Text>
                            </View>
                          ))}
                        </View>
                        {resolvedSocialStatus?.pendingInvite ? (
                          <View
                            className="mt-2 self-start rounded-full px-2.5 py-1 flex-row items-center"
                            style={{
                              backgroundColor: "rgba(147,197,253,0.14)",
                              borderWidth: 1,
                              borderColor: "rgba(147,197,253,0.4)",
                            }}
                          >
                            <IconSymbol name="bell.fill" size={11} color="#93C5FD" />
                            <Text
                              className="text-[11px] ml-1 font-semibold"
                              style={{ color: "#93C5FD" }}
                            >
                              Invite from{" "}
                              {resolvedSocialStatus.invitedBy?.name ||
                                "your coordinator"}
                            </Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>
                </View>

                {!showConnectedSocialCard &&
                  emojiPool.map((slot, i) => (
                    <Animated.Text
                      key={i}
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        bottom: 10,
                        right: emojiSlots[i].right,
                        fontSize: 17,
                        opacity: slot.opacity,
                        transform: [{ translateY: slot.y }],
                        zIndex: 10,
                      }}
                    >
                      {emojiSlots[i].emoji}
                    </Animated.Text>
                  ))}
              </SurfaceCard>
            </View>
          ) : (
            <TouchableOpacity
              onPress={
                canNavigateSocialCard
                  ? () =>
                      router.push(
                        (showConnectedSocialCard
                          ? "/(trainer)/social-progress"
                          : "/(trainer)/social-progress") as any,
                      )
                  : undefined
              }
              disabled={!canNavigateSocialCard}
              activeOpacity={0.92}
              accessibilityRole={canNavigateSocialCard ? "button" : undefined}
              accessibilityLabel={
                canNavigateSocialCard
                  ? socialHomeCardAccessibilityLabel
                  : undefined
              }
              testID="trainer-social-program-card"
            >
              <SurfaceCard
                style={{
                  ...getCardSoftStyle(),
                  borderColor: DASH.borderStrong,
                  overflow: "hidden",
                }}
              >
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: -20,
                    right: -25,
                    width: 110,
                    height: 110,
                    borderRadius: 55,
                    backgroundColor: "rgba(96,165,250,0.18)",
                  }}
                />
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    bottom: -28,
                    left: -20,
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: "rgba(167,139,250,0.14)",
                    transform: [{ translateY: socialFloatY }],
                  }}
                />
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1">
                    {showConnectedSocialCard && canUseDevSocialPreview ? (
                      <TouchableOpacity
                        onPress={handleToggleDevSocialPreview}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel={
                          showDevSocialPreview
                            ? "Show live social metrics"
                            : "Show sample social metrics"
                        }
                        testID="trainer-social-preview-toggle"
                        className="self-start"
                      >
                        <Text
                          className="text-base font-semibold"
                          style={{
                            color: DASH.primary,
                            textDecorationLine: "underline",
                          }}
                        >
                          Your social progress at a glance
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text
                        className="text-base font-semibold"
                        style={{ color: DASH.text }}
                      >
                        {socialHomeCardTitle}
                      </Text>
                    )}
                    <Text className="text-sm mt-1" style={{ color: DASH.muted }}>
                      {socialHomeCardSubtitle}
                    </Text>
                    {showConnectedSocialCard ? (
                      <>
                        <View className="flex-row mt-3 gap-2">
                          <SocialMetricDial
                            label="Followers"
                            value={formatCompactNumber(displaySocialFollowers)}
                            helper={`Goal ${formatCompactNumber(socialFollowerTarget)}`}
                            progress={
                              displaySocialFollowers / socialFollowerTarget
                            }
                          />
                          <SocialMetricDial
                            label="V/MO"
                            value={formatCompactNumber(displaySocialViewsPerMonth)}
                            helper={`Goal ${formatCompactNumber(socialViewsTarget)}`}
                            progress={
                              displaySocialViewsPerMonth / socialViewsTarget
                            }
                          />
                          <SocialMetricDial
                            label="Platforms"
                            value={String(displayConnectedSocialPlatforms.length)}
                            helper={
                              displaySocialPlatformSummary || "Connect channels"
                            }
                            progress={
                              displayConnectedSocialPlatforms.length /
                              platformDialTarget
                            }
                          />
                        </View>

                        <View
                          className="mt-3 rounded-xl border px-3 py-3"
                          style={{
                            backgroundColor: DASH.socialStatBg,
                            borderColor: DASH.socialStatBorder,
                          }}
                        >
                          <View className="flex-row items-center justify-between">
                            <Text
                              className="text-[11px] font-semibold uppercase tracking-[0.8px]"
                              style={{ color: DASH.socialAccentText }}
                            >
                              Recent engagement
                            </Text>
                            <Text
                              className="text-[11px]"
                              style={{ color: DASH.muted }}
                            >
                              {displayLatestSocialPostSummary}
                            </Text>
                          </View>
                          <View className="mt-3">
                            {displayRecentSocialMomentum.length > 0 ? (
                              <SocialLineChart values={displayRecentSocialMomentum} />
                            ) : (
                              <SocialLineChartPlaceholder />
                            )}
                          </View>
                          <View className="flex-row flex-wrap mt-3">
                            {[
                              `Engagement ${formatRatePercent(displaySocialEngagementRate)}`,
                              `CTR ${formatRatePercent(displaySocialCtr)}`,
                            ].map((pill) => (
                              <View
                                key={pill}
                                className="mr-2 mb-2 rounded-full px-2.5 py-1"
                                style={{
                                  backgroundColor: DASH.socialPillBg,
                                  borderWidth: 1,
                                  borderColor: DASH.socialPillBorder,
                                }}
                              >
                                <Text
                                  className="text-[10px] font-semibold"
                                  style={{ color: DASH.socialPillText }}
                                >
                                  {pill}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        <View
                          className="mt-3 rounded-xl border px-3 py-3"
                          style={{
                            backgroundColor: DASH.socialStatBg,
                            borderColor: DASH.socialStatBorder,
                          }}
                        >
                          <View className="flex-row items-center justify-between mb-2">
                            <Text
                              className="text-[11px] font-semibold uppercase tracking-[0.8px]"
                              style={{ color: DASH.socialAccentText }}
                            >
                              Program readiness
                            </Text>
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: displaySocialReadinessColor }}
                            >
                              {displaySocialReadinessPct}%
                            </Text>
                          </View>
                          <View
                            className="h-2 rounded-full border overflow-hidden"
                            style={{
                              backgroundColor: DASH.progressTrackBg,
                              borderColor: DASH.socialStatBorder,
                            }}
                          >
                            <View
                              style={{
                                width: `${Math.max(8, displaySocialReadinessPct)}%`,
                                height: "100%",
                                backgroundColor: displaySocialReadinessColor,
                              }}
                            />
                          </View>
                          <Text
                            className="text-xs mt-2 font-medium"
                            style={{ color: DASH.text }}
                          >
                            {displaySocialReadinessMessage}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View className="flex-row mt-3">
                          {["Followers", "Views", "Compliance"].map((pill) => (
                            <View
                              key={pill}
                              className="mr-2 rounded-full px-2.5 py-1"
                              style={{
                                backgroundColor: DASH.socialPillBg,
                                borderWidth: 1,
                                borderColor: DASH.socialPillBorder,
                              }}
                            >
                              <Text
                                className="text-[10px] font-semibold"
                                style={{ color: DASH.socialPillText }}
                              >
                                {pill}
                              </Text>
                            </View>
                          ))}
                        </View>
                        {resolvedSocialStatus?.pendingInvite ? (
                          <View
                            className="mt-2 self-start rounded-full px-2.5 py-1 flex-row items-center"
                            style={{
                              backgroundColor: "rgba(147,197,253,0.14)",
                              borderWidth: 1,
                              borderColor: "rgba(147,197,253,0.4)",
                            }}
                          >
                            <IconSymbol name="bell.fill" size={11} color="#93C5FD" />
                            <Text
                              className="text-[11px] ml-1 font-semibold"
                              style={{ color: "#93C5FD" }}
                            >
                              Invite from{" "}
                              {resolvedSocialStatus.invitedBy?.name ||
                                "your coordinator"}
                            </Text>
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>
                </View>

                {!showConnectedSocialCard &&
                  emojiPool.map((slot, i) => (
                    <Animated.Text
                      key={i}
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        bottom: 10,
                        right: emojiSlots[i].right,
                        fontSize: 17,
                        opacity: slot.opacity,
                        transform: [{ translateY: slot.y }],
                        zIndex: 10,
                      }}
                    >
                      {emojiSlots[i].emoji}
                    </Animated.Text>
                  ))}
              </SurfaceCard>
            </TouchableOpacity>
          )}
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
                backgroundColor: DASH.surfaceDashedBg,
                borderColor: DASH.surfaceDashedBorder,
                borderStyle: "dashed",
              }}
            >
              <View className="items-center py-2">
                <View className="w-14 h-14 rounded-full items-center justify-center" style={{ backgroundColor: DASH.lockIconBg }}>
                  <IconSymbol name="lock.fill" size={24} color={DASH.lockIconColor} />
                </View>
                <Text className="text-3xl font-bold mt-3" style={{ color: DASH.lockIconColor }}>
                  £0.00
                </Text>
                <Text className="text-[10px] uppercase tracking-[2px] mt-1" style={{ color: DASH.lockIconColor }}>
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
            <SurfaceCard style={getCardSoftStyle()}>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold" style={{ color: DASH.text }}>
                  Payout overview
                </Text>
                <TouchableOpacity
                  className="rounded-full px-3 py-1.5 border"
                  style={getMutedBadgeStyle()}
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
              <View className="flex-row items-center justify-between mt-2">
                <Text style={{ color: DASH.muted }}>Payout setup</Text>
                <Text className="font-semibold" style={{ color: DASH.text }}>
                  {payoutStatusLabel}
                </Text>
              </View>
              <Text className="text-xs mt-2" style={{ color: DASH.muted }}>
                {payoutSummary?.message || "Complete your payout onboarding to start getting paid."}
              </Text>
              {earningsExpanded ? (
                <>
                  <View className="h-px my-3" style={{ backgroundColor: DASH.divider }} />
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
          title="Bundles"
          actionLabel={offers.length > 0 ? "Manage" : "New"}
          onActionPress={() => router.push((offers.length > 0 ? "/(trainer)/offers" : "/bundle-editor/new") as any)}
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
              cta="New bundle"
              onPress={() => router.push("/bundle-editor/new" as any)}
            />
          ) : (
            <SurfaceCard style={getCardStyle()}>
              {previewOffers.map((offer, index) => (
                <View
                  key={offer.id}
                  className={index < previewOffers.length - 1 ? "pb-3 mb-3 border-b" : ""}
                  style={index < previewOffers.length - 1 ? { borderColor: DASH.divider } : undefined}
                >
                  {(() => {
                    const offerImageUrl = getBundleImageUrl(offer);
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
                        <View className="px-2 py-1 rounded-full border mr-2" style={getMutedBadgeStyle()}>
                          <Text className="text-[11px]" style={{ color: DASH.muted }}>
                            {formatBundleType(offer.type)}
                          </Text>
                        </View>
                        <View
                          className="px-2 py-1 rounded-full border"
                          style={{
                            backgroundColor: (offerStatusStyles[(offer.status as OfferStatus) || "draft"] || offerStatusStyles.draft).bg,
                            borderColor: (offerStatusStyles[(offer.status as OfferStatus) || "draft"] || offerStatusStyles.draft).border,
                          }}
                        >
                          <Text
                            className="text-[11px] font-medium"
                            style={{ color: (offerStatusStyles[(offer.status as OfferStatus) || "draft"] || offerStatusStyles.draft).text }}
                          >
                            {(offerStatusStyles[(offer.status as OfferStatus) || "draft"] || offerStatusStyles.draft).label}
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

        <SectionHeader
          title="Recent activity"
          actionLabel="See all"
          onActionPress={() => router.push("/(trainer)/payment-history" as any)}
        />
        <View className={SECTION_SPACING_CLASS}>
          {activityLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color={DASH.primary} />
            </View>
          ) : activityRows.length === 0 ? (
            <SurfaceCard style={{ ...getCardStyle(), paddingVertical: 28 }}>
              <View className="items-center">
                <IconSymbol name="clock.arrow.circlepath" size={34} color="#475569" />
                <Text className="text-sm text-center mt-3 px-3" style={{ color: "#B6C2D6" }}>
                  Your activity will appear here once you start growing your business.
                </Text>
              </View>
            </SurfaceCard>
          ) : (
            <SurfaceCard style={getCardStyle()}>
              {activityRows.map((item, index) => {
                const status = (item.status as PaymentStatus) || "awaiting_payment";
                const statusStyle = activityStatusStyles[status] || activityStatusStyles.awaiting_payment;
                const methodLabel = item.method === "link" ? "Payment Link" : "Tap to Pay";
                const canCancel = status === "awaiting_payment" && item.merchantReference;
                return (
                  <View
                    key={item.id}
                    className={index < activityRows.length - 1 ? "pb-3 mb-3 border-b" : ""}
                    style={index < activityRows.length - 1 ? { borderColor: DASH.divider } : undefined}
                  >
                    <View className="flex-row items-start justify-between">
                      <View className="flex-1 pr-2">
                        <Text className="font-medium" style={{ color: DASH.text }} numberOfLines={1}>
                          {item.description || "Training session"}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <View className="px-2 py-1 rounded-full mr-2 border" style={getMutedBadgeStyle()}>
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
                    <View className="flex-row items-center justify-between mt-2">
                      <View className="px-2 py-1 rounded-full" style={{ backgroundColor: statusStyle.bg }}>
                        <Text className="text-[11px] font-medium" style={{ color: statusStyle.text }}>
                          {statusStyle.label}
                        </Text>
                      </View>
                      {canCancel && (
                        <ActionButton
                          onPress={() => handleCancelPendingPayment(item as PendingPaymentRow)}
                          loading={cancellingRef === item.merchantReference}
                          variant="ghost"
                          size="sm"
                          className="px-2.5 py-1 rounded-full border"
                          style={{
                            minHeight: 26,
                            borderColor: "rgba(248,113,113,0.35)",
                            backgroundColor: "rgba(248,113,113,0.1)",
                          }}
                          textClassName="text-[11px]"
                          accessibilityLabel={`Cancel ${item.description || "payment"}`}
                        >
                          <Text className="text-[11px] font-semibold" style={{ color: "#FCA5A5" }}>Cancel</Text>
                        </ActionButton>
                      )}
                    </View>
                  </View>
                );
              })}
            </SurfaceCard>
          )}
        </View>

        <View className="pb-8" />

        {hasAnyLoading ? (
          <View className="items-center pb-8">
            <ActivityIndicator size="small" color={DASH.primary} />
          </View>
        ) : null}
      </CollapsibleHeaderScrollView>
    </ScreenContainer>
  );
}
