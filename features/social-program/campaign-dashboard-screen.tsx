import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

type Props = {
  roleLabel: "Coordinator" | "Manager";
};

function GaugeRow({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(target, 1)) * 100)));
  return (
    <View className="mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs text-muted">{label}</Text>
        <Text className="text-xs font-semibold" style={{ color }}>
          {value.toFixed(1)} / {target.toFixed(1)}
        </Text>
      </View>
      <View className="h-2 rounded-full bg-surface border border-border overflow-hidden">
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color }} />
      </View>
    </View>
  );
}

export function CampaignDashboardScreen({ roleLabel }: Props) {
  const colors = useColors();
  const params = useLocalSearchParams<{ bundleId?: string }>();
  const bundleId = String(params.bundleId || "").trim();
  const summaryQuery = trpc.admin.campaignDashboardSummary.useQuery(
    { bundleId },
    { enabled: Boolean(bundleId) },
  );

  const rows = summaryQuery.data?.rows || [];
  const signupStats = summaryQuery.data?.signupStats || {
    trainerCount: 0,
    offerCount: 0,
    publishedOfferCount: 0,
  };

  const totals = useMemo(() => {
    return rows.reduce(
      (acc: any, row: any) => {
        acc.views += Number(row?.views || 0);
        acc.engagements += Number(row?.engagements || 0);
        acc.clicks += Number(row?.clicks || 0);
        acc.postsDelivered += Number(row?.postsDelivered || 0);
        acc.postsOnTime += Number(row?.postsOnTime || 0);
        acc.requiredPosts += Number(row?.requiredPosts || 0);
        return acc;
      },
      {
        views: 0,
        engagements: 0,
        clicks: 0,
        postsDelivered: 0,
        postsOnTime: 0,
        requiredPosts: 0,
      },
    );
  }, [rows]);

  const ctr = totals.views > 0 ? (totals.clicks / totals.views) * 100 : 0;
  const engagementRate = totals.views > 0 ? (totals.engagements / totals.views) * 100 : 0;
  const onTimePct = totals.postsDelivered > 0 ? (totals.postsOnTime / totals.postsDelivered) * 100 : 0;
  const deliveryPct = totals.requiredPosts > 0 ? (totals.postsDelivered / totals.requiredPosts) * 100 : 0;

  const topTrainers = useMemo(() => {
    return rows
      .slice()
      .sort((a: any, b: any) => Number(b?.views || 0) - Number(a?.views || 0))
      .slice(0, 8);
  }, [rows]);
  const topViews = Math.max(1, ...topTrainers.map((row: any) => Number(row?.views || 0)));

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Campaign Dashboard"
          subtitle={`${roleLabel} campaign performance cockpit`}
          leftSlot={
            <TouchableOpacity
              onPress={() =>
                router.canGoBack()
                  ? router.back()
                  : router.replace(
                      (roleLabel === "Manager" ? "/(manager)/templates" : "/(coordinator)/templates") as any,
                    )
              }
              className="w-10 h-10 rounded-full bg-surface items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID={`campaign-dashboard-back-${roleLabel.toLowerCase()}`}
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
          }
        />

        <View className="px-4 pb-8 gap-4">
          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              {summaryQuery.data?.bundleTitle || "Campaign"}
            </Text>
            <View className="flex-row flex-wrap -mx-1">
              {[
                { label: "Trainer signups", value: signupStats.trainerCount },
                { label: "Offers created", value: signupStats.offerCount },
                { label: "Published offers", value: signupStats.publishedOfferCount },
                { label: "Active contributors", value: new Set(rows.map((r: any) => r.trainerId)).size },
              ].map((kpi) => (
                <View key={kpi.label} className="w-1/2 px-1 mb-2">
                  <View className="rounded-lg border border-border px-3 py-2">
                    <Text className="text-[11px] text-muted">{kpi.label}</Text>
                    <Text className="text-base font-semibold text-foreground mt-0.5">
                      {Number(kpi.value || 0).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Gauges & Indicators
            </Text>
            <GaugeRow label="Delivery gauge" value={deliveryPct} target={100} color="#60A5FA" />
            <GaugeRow label="On-time gauge" value={onTimePct} target={100} color="#34D399" />
            <GaugeRow label="CTR temperature" value={ctr} target={5} color="#F59E0B" />
            <GaugeRow label="Engagement temperature" value={engagementRate} target={8} color="#A78BFA" />
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Contribution Bars
            </Text>
            {topTrainers.length === 0 ? (
              <Text className="text-sm text-muted">No campaign activity yet.</Text>
            ) : (
              <View className="gap-2">
                {topTrainers.map((row: any, idx: number) => {
                  const widthPct = Math.max(
                    6,
                    Math.round((Number(row?.views || 0) / topViews) * 100),
                  );
                  return (
                    <View key={`${row.trainerId}-${idx}`}>
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-xs text-foreground">
                          {row.trainerName || "Trainer"}
                        </Text>
                        <Text className="text-xs text-muted">
                          {Number(row?.views || 0).toLocaleString()} views
                        </Text>
                      </View>
                      <View className="h-2 rounded-full bg-surface border border-border overflow-hidden">
                        <View
                          style={{
                            width: `${widthPct}%`,
                            height: "100%",
                            backgroundColor: colors.primary,
                          }}
                        />
                      </View>
                    </View>
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
