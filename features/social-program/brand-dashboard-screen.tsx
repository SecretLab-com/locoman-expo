import { ScreenContainer } from "@/components/screen-container";
import { ActionButton } from "@/components/action-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

type Props = {
  roleLabel: "Coordinator" | "Manager";
};

function getComplianceLabel(state: string) {
  switch (state) {
    case "matched_post":
      return "Matched";
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

export function BrandDashboardScreen({ roleLabel }: Props) {
  const colors = useColors();
  const params = useLocalSearchParams<{ bundleId?: string }>();
  const bundleIdFilter = String(params.bundleId || "").trim() || undefined;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const accountsQuery = trpc.admin.listCampaignAccounts.useQuery({
    accountType: "all",
    activeOnly: true,
    limit: 300,
  });
  const summaryQuery = trpc.admin.campaignMetricsSummary.useQuery(
    selectedAccountId || bundleIdFilter
      ? {
          campaignAccountId: selectedAccountId || undefined,
          bundleDraftId: bundleIdFilter,
        }
      : undefined,
  );
  const csvExportQuery = trpc.admin.campaignReportCsv.useQuery(
    selectedAccountId ? { campaignAccountId: selectedAccountId } : undefined,
    { enabled: false },
  );
  const pdfExportQuery = trpc.admin.campaignReportPdf.useQuery(
    selectedAccountId ? { campaignAccountId: selectedAccountId } : undefined,
    { enabled: false },
  );

  const rows = summaryQuery.data || [];
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row: any) => {
        acc.views += Number(row?.views || 0);
        acc.engagements += Number(row?.engagements || 0);
        acc.clicks += Number(row?.clicks || 0);
        acc.postsDelivered += Number(row?.postsDelivered || 0);
        acc.postsOnTime += Number(row?.postsOnTime || 0);
        acc.requiredPosts += Number(row?.requiredPosts || 0);
        acc.matchedPosts += Number(row?.matchedPosts || 0);
        acc.needsReviewPosts += Number(row?.needsReviewPosts || 0);
        acc.rejectedPosts += Number(row?.rejectedPosts || 0);
        return acc;
      },
      {
        views: 0,
        engagements: 0,
        clicks: 0,
        postsDelivered: 0,
        postsOnTime: 0,
        requiredPosts: 0,
        matchedPosts: 0,
        needsReviewPosts: 0,
        rejectedPosts: 0,
      },
    );
  }, [rows]);

  const ctr = totals.views > 0 ? totals.clicks / totals.views : 0;
  const engagementRate = totals.views > 0 ? totals.engagements / totals.views : 0;
  const onTimePct =
    totals.postsDelivered > 0 ? totals.postsOnTime / totals.postsDelivered : 0;
  const deliveryPct =
    totals.requiredPosts > 0 ? totals.postsDelivered / totals.requiredPosts : 0;

  const topRows = useMemo(() => {
    return rows
      .slice()
      .sort((a: any, b: any) => Number(b?.views || 0) - Number(a?.views || 0))
      .slice(0, 20);
  }, [rows]);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Brand Dashboard"
          subtitle={`${roleLabel} campaign performance overview by account.${bundleIdFilter ? " Filtered to selected campaign." : ""}`}
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
              testID={`brand-dashboard-back-${roleLabel.toLowerCase()}`}
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          }
        />

        <View className="px-4 pb-8 gap-4">
          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Campaign Accounts
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <TouchableOpacity
                onPress={() => setSelectedAccountId(null)}
                style={{
                  borderWidth: 1,
                  borderColor: selectedAccountId ? colors.border : colors.primary,
                  backgroundColor: selectedAccountId ? colors.surface : `${colors.primary}22`,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
                accessibilityRole="button"
                accessibilityLabel="Show all campaign accounts"
                testID="brand-dashboard-account-all"
              >
                <Text
                  style={{
                    color: selectedAccountId ? colors.foreground : colors.primary,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  All
                </Text>
              </TouchableOpacity>
              {(accountsQuery.data || []).map((account: any) => {
                const isActive = account.id === selectedAccountId;
                return (
                  <TouchableOpacity
                    key={account.id}
                    onPress={() => setSelectedAccountId(account.id)}
                    style={{
                      borderWidth: 1,
                      borderColor: isActive ? colors.primary : colors.border,
                      backgroundColor: isActive ? `${colors.primary}22` : colors.surface,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter by ${account.name}`}
                    testID={`brand-dashboard-account-${account.id}`}
                  >
                    <Text
                      style={{
                        color: isActive ? colors.primary : colors.foreground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {account.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Performance Totals
            </Text>
            <View className="flex-row flex-wrap -mx-1">
              {[
                { key: "views", label: "Views", value: totals.views.toLocaleString() },
                {
                  key: "engagements",
                  label: "Engagements",
                  value: totals.engagements.toLocaleString(),
                },
                { key: "ctr", label: "CTR", value: `${(ctr * 100).toFixed(2)}%` },
                {
                  key: "er",
                  label: "Engagement Rate",
                  value: `${(engagementRate * 100).toFixed(2)}%`,
                },
                {
                  key: "delivery",
                  label: "Delivery",
                  value: `${(deliveryPct * 100).toFixed(1)}%`,
                },
                {
                  key: "ontime",
                  label: "On-Time",
                  value: `${(onTimePct * 100).toFixed(1)}%`,
                },
                {
                  key: "matched",
                  label: "Matched Posts",
                  value: totals.matchedPosts.toLocaleString(),
                },
                {
                  key: "review",
                  label: "Needs Review",
                  value: totals.needsReviewPosts.toLocaleString(),
                },
                {
                  key: "rejected",
                  label: "Rejected Posts",
                  value: totals.rejectedPosts.toLocaleString(),
                },
              ].map((item) => (
                <View key={item.key} className="w-1/2 px-1 mb-2">
                  <View className="rounded-lg border border-border px-3 py-2">
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
              Compliance States
            </Text>
            {topRows.length === 0 ? (
              <Text className="text-sm text-muted">No compliance data yet.</Text>
            ) : (
              <View className="gap-2">
                {topRows.slice(0, 10).map((row: any, idx: number) => {
                  const state = String(row?.complianceState || "awaiting_post");
                  const color = getComplianceColor(state);
                  return (
                    <View
                      key={`${row.campaignAccountId}-${row.bundleDraftId}-${row.trainerId}-${idx}-status`}
                      className="border border-border rounded-lg px-3 py-2"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-sm font-semibold text-foreground">
                            {row.campaignAccountName}
                          </Text>
                          <Text className="text-xs text-muted mt-0.5">
                            {row.trainerName} • {row.bundleTitle}
                          </Text>
                        </View>
                        <View
                          className="rounded-full px-2.5 py-1"
                          style={{ backgroundColor: `${color}22` }}
                        >
                          <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
                            {getComplianceLabel(state)}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xs text-muted mt-2">
                        Matched {Number(row?.matchedPosts || 0)} / Required{" "}
                        {Number(row?.requiredPosts || 0)} • Review{" "}
                        {Number(row?.needsReviewPosts || 0)} • Rejected{" "}
                        {Number(row?.rejectedPosts || 0)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Top Campaign Contributors
            </Text>
            {topRows.length === 0 ? (
              <Text className="text-sm text-muted">No campaign performance data yet.</Text>
            ) : (
              <View className="gap-2">
                {topRows.map((row: any, idx: number) => (
                  <View
                    key={`${row.campaignAccountId}-${row.bundleDraftId}-${row.trainerId}-${idx}`}
                    className="border border-border rounded-lg px-3 py-2"
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {row.bundleTitle}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      Account: {row.campaignAccountName} • Trainer: {row.trainerName}
                    </Text>
                    <Text className="text-xs text-muted mt-0.5">
                      Views {Number(row.views || 0).toLocaleString()} • Clicks{" "}
                      {Number(row.clicks || 0).toLocaleString()} • ER{" "}
                      {Number(row.views || 0) > 0
                        ? `${((Number(row.engagements || 0) / Number(row.views || 1)) * 100).toFixed(2)}%`
                        : "0.00%"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Reporting Exports
            </Text>
            <Text className="text-sm text-muted mb-3">
              Export campaign reporting packs for Delivery, Performance, Business
              Outcomes, and Finance.
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={async () => {
                  const result = await csvExportQuery.refetch();
                  const payload = result.data;
                  if (!payload) return;
                  Alert.alert(
                    "CSV ready",
                    `${payload.fileName}\n\n${payload.content.slice(0, 260)}...`,
                  );
                }}
                className="flex-1 rounded-lg border border-border px-3 py-2"
                accessibilityRole="button"
                accessibilityLabel="Export campaign report CSV"
                testID="brand-dashboard-export-csv"
              >
                <Text className="text-sm font-semibold text-foreground text-center">
                  Export CSV
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  const result = await pdfExportQuery.refetch();
                  const payload = result.data;
                  if (!payload) return;
                  Alert.alert(
                    "PDF summary ready",
                    `${payload.fileName}\n\n${payload.content.slice(0, 260)}...`,
                  );
                }}
                className="flex-1 rounded-lg border border-border px-3 py-2"
                accessibilityRole="button"
                accessibilityLabel="Export campaign report PDF summary"
                testID="brand-dashboard-export-pdf"
              >
                <Text className="text-sm font-semibold text-foreground text-center">
                  Export PDF
                </Text>
              </TouchableOpacity>
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
