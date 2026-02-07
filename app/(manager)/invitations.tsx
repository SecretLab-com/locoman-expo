import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

const STATUS_COLORS: Record<InvitationStatus, string> = {
  pending: "#F59E0B",
  accepted: "#22C55E",
  expired: "#6B7280",
  revoked: "#EF4444",
};

export default function InvitationsScreen() {
  const colors = useColors();
  const [selectedStatus, setSelectedStatus] = useState<InvitationStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const utils = trpc.useUtils();
  const invitationsQuery = trpc.admin.getUserInvitations.useQuery({
    limit: 50,
    offset: 0,
  });

  const invitations = invitationsQuery.data?.invitations ?? [];
  const totalCount = invitationsQuery.data?.total ?? 0;

  // Map API data to expected format
  const mappedInvitations = useMemo(() => {
    return invitations.map((inv) => ({
      id: inv.id,
      trainerName: inv.name ?? "—",
      bundleTitle: inv.role ?? "—",
      clientEmail: inv.email,
      status: (inv.status ?? "pending") as InvitationStatus,
      createdAt: new Date(inv.createdAt),
      expiresAt: new Date(inv.expiresAt),
    }));
  }, [invitations]);

  // Filter invitations
  const filteredInvitations = useMemo(() => {
    if (selectedStatus === "all") return mappedInvitations;
    return mappedInvitations.filter((inv) => inv.status === selectedStatus);
  }, [mappedInvitations, selectedStatus]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: totalCount,
      pending: mappedInvitations.filter((i) => i.status === "pending").length,
      accepted: mappedInvitations.filter((i) => i.status === "accepted").length,
      expired: mappedInvitations.filter((i) => i.status === "expired").length,
      revoked: mappedInvitations.filter((i) => i.status === "revoked").length,
      conversionRate: mappedInvitations.length > 0
        ? Math.round(
            (mappedInvitations.filter((i) => i.status === "accepted").length /
              mappedInvitations.length) *
              100
          )
        : 0,
    };
  }, [mappedInvitations, totalCount]);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await utils.admin.getUserInvitations.invalidate();
    setRefreshing(false);
  };

  // Format date
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (invitationsQuery.isLoading) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Invitations</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-4">Loading invitations...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (invitationsQuery.isError) {
    return (
      <ScreenContainer className="flex-1">
        <View className="px-4 pt-2 pb-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-foreground">Invitations</Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
          <Text className="text-foreground font-semibold mt-4 text-center">Failed to load invitations</Text>
          <Text className="text-muted text-sm mt-2 text-center">{invitationsQuery.error.message}</Text>
          <TouchableOpacity
            onPress={() => invitationsQuery.refetch()}
            className="mt-4 bg-primary px-6 py-3 rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Retry loading invitations"
          >
            <Text className="text-white font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Invitations</Text>
            <Text className="text-sm text-muted mt-1">
              Track and manage user invitations
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Stats Overview */}
        <View className="bg-surface rounded-xl p-4 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-sm text-muted">Total Invitations</Text>
              <Text className="text-3xl font-bold text-foreground">{stats.total}</Text>
            </View>
            <View className="bg-success/10 px-4 py-2 rounded-xl">
              <Text className="text-xs text-muted">Conversion Rate</Text>
              <Text className="text-xl font-bold text-success">{stats.conversionRate}%</Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1 bg-warning/10 rounded-lg p-3 items-center">
              <Text className="text-lg font-bold text-warning">{stats.pending}</Text>
              <Text className="text-xs text-muted">Pending</Text>
            </View>
            <View className="flex-1 bg-success/10 rounded-lg p-3 items-center">
              <Text className="text-lg font-bold text-success">{stats.accepted}</Text>
              <Text className="text-xs text-muted">Accepted</Text>
            </View>
            <View className="flex-1 bg-muted/10 rounded-lg p-3 items-center">
              <Text className="text-lg font-bold text-muted">{stats.expired}</Text>
              <Text className="text-xs text-muted">Expired</Text>
            </View>
            <View className="flex-1 bg-error/10 rounded-lg p-3 items-center">
              <Text className="text-lg font-bold text-error">{stats.revoked}</Text>
              <Text className="text-xs text-muted">Revoked</Text>
            </View>
          </View>
        </View>

        {/* Status Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ gap: 8 }}
        >
          {(["all", "pending", "accepted", "expired", "revoked"] as const).map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-full ${
                selectedStatus === status ? "bg-primary" : "bg-surface border border-border"
              }`}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${status === "all" ? "all statuses" : status}`}
            >
              <Text
                className={`font-medium capitalize ${
                  selectedStatus === status ? "text-white" : "text-foreground"
                }`}
              >
                {status === "all" ? "All" : status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Invitations List */}
        {filteredInvitations.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="envelope.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No invitations found</Text>
          </View>
        ) : (
          filteredInvitations.map((invitation) => (
            <View
              key={invitation.id}
              className="bg-surface rounded-xl p-4 mb-3 border border-border"
            >
              {/* Header */}
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-foreground font-semibold">
                    {invitation.trainerName}
                  </Text>
                  <Text className="text-sm text-muted capitalize">Role: {invitation.bundleTitle}</Text>
                </View>
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${STATUS_COLORS[invitation.status]}20` }}
                >
                  <Text
                    className="text-xs font-semibold capitalize"
                    style={{ color: STATUS_COLORS[invitation.status] }}
                  >
                    {invitation.status}
                  </Text>
                </View>
              </View>

              {/* Client Email */}
              <View className="flex-row items-center mb-2">
                <IconSymbol name="envelope.fill" size={16} color={colors.muted} />
                <Text className="text-sm text-muted ml-2">{invitation.clientEmail}</Text>
              </View>

              {/* Dates */}
              <View className="flex-row items-center justify-between pt-2 border-t border-border">
                <View className="flex-row items-center">
                  <IconSymbol name="calendar" size={14} color={colors.muted} />
                  <Text className="text-xs text-muted ml-1">
                    Sent {formatDate(invitation.createdAt)}
                  </Text>
                </View>
                {invitation.status === "pending" && (
                  <Text className="text-xs text-warning">
                    Expires {formatDate(invitation.expiresAt)}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
