import { ActionButton } from "@/components/action-button";
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
import { router } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";

function pct(value: number | null | undefined) {
  const numeric = Number(value || 0);
  return `${(numeric * 100).toFixed(1)}%`;
}

export default function TrainerSocialProgressScreen() {
  const colors = useColors();
  const { data } = trpc.socialProgram.myProgramDashboard.useQuery();
  const profile = data?.profile;
  const progress = data?.progress;
  const commitment = data?.commitment;
  const violations = data?.violations || [];
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
              <Text className="text-foreground font-semibold">
                {pct(profile?.avgCtr)}
              </Text>
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
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
