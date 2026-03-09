import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import {
  getSocialPlatformIcon,
  inferSocialPlatformFromText,
  normalizeSocialPlatform,
} from "@/lib/social-platforms";
import { trpc } from "@/lib/trpc";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function pct(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return `${(numeric * 100).toFixed(1)}%`;
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

export default function TrainerSocialProgressScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ bundleId?: string; templateId?: string }>();
  const { data } = trpc.socialProgram.myProgramDashboard.useQuery();
  const recentPostsQuery = trpc.socialProgram.recentPosts.useQuery({
    limit: 12,
    sparklineDays: 10,
  });
  const bundlesQuery = trpc.bundles.list.useQuery();
  const profile = data?.profile;
  const progress = data?.progress;
  const commitment = data?.commitment;
  const violations = data?.violations || [];
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
  const trendMaxViews = Math.max(1, ...trendRows.map((row) => row.views));

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
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(trainer)/social-program" as any))}
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
          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Measured KPI Snapshot
            </Text>
            <Text className="text-sm text-muted mb-1">
              Followers:{" "}
              <Text className="text-foreground font-semibold">
                {Number(profile?.followerCount || 0).toLocaleString()}
              </Text>
            </Text>
            <Text className="text-sm text-muted mb-1">
              V/MO:{" "}
              <Text className="text-foreground font-semibold">
                {Number(profile?.avgViewsPerMonth || 0).toLocaleString()}
              </Text>
            </Text>
            <Text className="text-sm text-muted mb-1">
              Engagement rate:{" "}
              <Text className="text-foreground font-semibold">
                {pct(profile?.avgEngagementRate)}
              </Text>
            </Text>
            <Text className="text-sm text-muted">
              CTR:{" "}
              <Text className="text-foreground font-semibold">
                {pct(profile?.avgCtr)}
              </Text>
            </Text>
            <Text className="text-xs text-muted mt-2">
              Source: connected social profile metrics
            </Text>
            <Text className="text-sm text-muted mt-2">
              Connected platforms:
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-2">
              {connectedPlatforms.length > 0 ? (
                connectedPlatforms.map((platformKey) => {
                  const platformIcon = getSocialPlatformIcon(platformKey);
                  return (
                    <View
                      key={`progress-${platformKey}`}
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
              14-Day Trend
            </Text>
            {trendRows.length === 0 ? (
              <Text className="text-sm text-muted">No recent trend data yet.</Text>
            ) : (
              <View className="flex-row items-end h-32">
                {trendRows.map((row) => {
                  const h = Math.max(4, Math.round((row.views / trendMaxViews) * 96));
                  return (
                    <View key={row.date} className="flex-1 items-center justify-end">
                      <View
                        style={{
                          width: 8,
                          height: h,
                          borderRadius: 4,
                          backgroundColor: `${colors.primary}CC`,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
            )}
            <Text className="text-xs text-muted mt-2">
              Bars represent daily view volume.
            </Text>
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
