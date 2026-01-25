import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

type InvitationStatus = "pending" | "accepted" | "expired" | "declined";

type Invitation = {
  id: number;
  trainerName: string;
  bundleTitle: string;
  clientEmail: string;
  status: InvitationStatus;
  createdAt: Date;
  expiresAt: Date;
};

// Mock data
const MOCK_INVITATIONS: Invitation[] = [
  {
    id: 1,
    trainerName: "Coach Mike",
    bundleTitle: "Weight Loss Program",
    clientEmail: "john@example.com",
    status: "pending",
    createdAt: new Date(Date.now() - 86400000 * 2),
    expiresAt: new Date(Date.now() + 86400000 * 5),
  },
  {
    id: 2,
    trainerName: "Coach Sarah",
    bundleTitle: "Nutrition Coaching",
    clientEmail: "jane@example.com",
    status: "accepted",
    createdAt: new Date(Date.now() - 86400000 * 5),
    expiresAt: new Date(Date.now() + 86400000 * 2),
  },
  {
    id: 3,
    trainerName: "Coach Mike",
    bundleTitle: "HIIT Cardio Blast",
    clientEmail: "mike@example.com",
    status: "expired",
    createdAt: new Date(Date.now() - 86400000 * 10),
    expiresAt: new Date(Date.now() - 86400000 * 3),
  },
  {
    id: 4,
    trainerName: "Coach Alex",
    bundleTitle: "Strength Training",
    clientEmail: "sarah@example.com",
    status: "declined",
    createdAt: new Date(Date.now() - 86400000 * 7),
    expiresAt: new Date(Date.now() - 86400000 * 1),
  },
];

const STATUS_COLORS: Record<InvitationStatus, string> = {
  pending: "#F59E0B",
  accepted: "#22C55E",
  expired: "#6B7280",
  declined: "#EF4444",
};

export default function InvitationsScreen() {
  const colors = useColors();
  const [selectedStatus, setSelectedStatus] = useState<InvitationStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  // Filter invitations
  const filteredInvitations = useMemo(() => {
    if (selectedStatus === "all") return MOCK_INVITATIONS;
    return MOCK_INVITATIONS.filter((inv) => inv.status === selectedStatus);
  }, [selectedStatus]);

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: MOCK_INVITATIONS.length,
      pending: MOCK_INVITATIONS.filter((i) => i.status === "pending").length,
      accepted: MOCK_INVITATIONS.filter((i) => i.status === "accepted").length,
      expired: MOCK_INVITATIONS.filter((i) => i.status === "expired").length,
      declined: MOCK_INVITATIONS.filter((i) => i.status === "declined").length,
      conversionRate: Math.round(
        (MOCK_INVITATIONS.filter((i) => i.status === "accepted").length /
          MOCK_INVITATIONS.length) *
          100
      ),
    };
  }, []);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
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

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Invitations</Text>
        <Text className="text-sm text-muted mt-1">
          Track and manage client invitations
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
              <Text className="text-lg font-bold text-error">{stats.declined}</Text>
              <Text className="text-xs text-muted">Declined</Text>
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
          {(["all", "pending", "accepted", "expired", "declined"] as const).map((status) => (
            <TouchableOpacity
              key={status}
              onPress={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-full ${
                selectedStatus === status ? "bg-primary" : "bg-surface border border-border"
              }`}
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
                    {invitation.bundleTitle}
                  </Text>
                  <Text className="text-sm text-muted">{invitation.trainerName}</Text>
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
