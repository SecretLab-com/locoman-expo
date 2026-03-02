import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";

function pct(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return `${(numeric * 100).toFixed(1)}%`;
}

export default function TrainerSocialProgressScreen() {
  const { data } = trpc.socialProgram.myProgramDashboard.useQuery();
  const profile = data?.profile;
  const progress = data?.progress;
  const commitment = data?.commitment;
  const violations = data?.violations || [];

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Social Program Progress"
          subtitle="Track your commitments, KPI performance, and compliance status."
          leftSlot={
            <ActionButton
              onPress={() => router.back()}
              variant="ghost"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              testID="social-progress-back"
            >
              <IconSymbol name="chevron.left" size={18} color="#3B82F6" />
            </ActionButton>
          }
        />
        <View className="px-4 pb-8 gap-4">
          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Current KPI Snapshot
            </Text>
            <Text className="text-sm text-muted mb-1">
              Followers:{" "}
              <Text className="text-foreground font-semibold">
                {Number(profile?.followerCount || 0).toLocaleString()}
              </Text>
            </Text>
            <Text className="text-sm text-muted mb-1">
              Avg views/month:{" "}
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
              <Text className="text-foreground font-semibold">{pct(profile?.avgCtr)}</Text>
            </Text>
          </SurfaceCard>

          <SurfaceCard>
            <Text className="text-base font-semibold text-foreground mb-2">
              Commitment status
            </Text>
            <Text className="text-sm text-muted mb-1">
              Program status:{" "}
              <Text className="text-foreground font-semibold capitalize">
                {String(progress?.status || data?.membership?.status || "not_started").replace(
                  /_/g,
                  " ",
                )}
              </Text>
            </Text>
            <Text className="text-sm text-muted mb-1">
              Required posts:{" "}
              <Text className="text-foreground font-semibold">
                {Number(commitment?.minimumPosts || progress?.postsRequired || 0)}
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
              <Text className="text-sm text-muted">No active concerns right now.</Text>
            ) : (
              <View className="gap-2">
                {violations.slice(0, 10).map((violation: any) => (
                  <View
                    key={violation.id}
                    className="border border-border rounded-lg px-3 py-2"
                  >
                    <Text className="text-sm font-semibold text-foreground">
                      {String(violation.type || "Policy concern").replace(/_/g, " ")}
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
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
