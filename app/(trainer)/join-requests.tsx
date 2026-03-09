import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ActionButton } from "@/components/action-button";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";

type JoinRequest = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  message: string | null;
  goals: string[] | null;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
};

function JoinRequestCard({
  request,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  request: JoinRequest;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const colors = useColors();

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return "Just now";
  };

  return (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      {/* Header with avatar and name */}
      <View className="flex-row items-center mb-3">
        <Image
          source={{ uri: request.userAvatar || "https://i.pravatar.cc/150?img=0" }}
          style={{ width: 48, height: 48, borderRadius: 24 }}
        />
        <View className="flex-1 ml-3">
          <Text className="text-foreground font-semibold text-base">
            {request.userName}
          </Text>
          <Text className="text-muted text-sm">{request.userEmail}</Text>
        </View>
        <Text className="text-muted text-xs">{formatDate(request.createdAt)}</Text>
      </View>

      {/* Message */}
      {request.message && (
        <View className="bg-background rounded-lg p-3 mb-3">
          <Text className="text-foreground text-sm leading-5">
            {`"${request.message}"`}
          </Text>
        </View>
      )}

      {/* Goals */}
      {request.goals && request.goals.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mb-4">
          {request.goals.map((goal, index) => (
            <View
              key={index}
              className="bg-primary/10 px-3 py-1 rounded-full"
            >
              <Text style={{ color: colors.primary }} className="text-xs font-medium">
                {goal}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action buttons */}
      {request.status === "pending" ? (
        <View className="flex-row gap-3">
          <ActionButton
            variant="secondary"
            size="lg"
            onPress={onReject}
            loading={isRejecting}
            loadingText="Declining..."
            className="flex-1 py-3 rounded-lg border border-border"
            accessibilityLabel="Decline request"
            testID="join-request-decline"
          >
            Decline
          </ActionButton>
          <ActionButton
            variant="primary"
            size="lg"
            onPress={onApprove}
            loading={isApproving}
            loadingText="Accepting..."
            className="flex-1 py-3 rounded-lg"
            style={{ backgroundColor: colors.primary }}
            accessibilityLabel="Accept request"
            testID="join-request-accept"
          >
            Accept
          </ActionButton>
        </View>
      ) : (
        <View
          className="self-start px-3 py-1 rounded-full"
          style={{
            backgroundColor: request.status === "approved" ? `${colors.success}20` : `${colors.error}20`,
          }}
        >
          <Text
            className="text-xs font-semibold capitalize"
            style={{ color: request.status === "approved" ? colors.success : colors.error }}
          >
            {request.status}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function JoinRequestsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [processedRequests, setProcessedRequests] = useState<JoinRequest[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const requestsQuery = trpc.myTrainers.forTrainerPendingRequests.useQuery();
  const approveRequest = trpc.myTrainers.approveRequest.useMutation({
    onSuccess: () => {
      requestsQuery.refetch();
    },
  });
  const rejectRequest = trpc.myTrainers.rejectRequest.useMutation({
    onSuccess: () => {
      requestsQuery.refetch();
    },
  });

  const pendingRequests: JoinRequest[] = (requestsQuery.data || []).map((request: any) => {
    const user = request.requestUser || {};
    const goals = Array.isArray(request.goals)
      ? request.goals.map((goal: any) => String(goal))
      : null;
    return {
      id: String(request.id),
      userId: String(request.userId || user.id || request.id),
      userName: user.name || request.name || "Unknown User",
      userEmail: user.email || request.email || "",
      userAvatar: user.photoUrl || request.photoUrl || null,
      message: request.notes || null,
      goals,
      status: "pending",
      createdAt: new Date(request.createdAt || Date.now()),
    };
  });

  const requests = [
    ...pendingRequests,
    ...processedRequests.filter((processed) => !pendingRequests.some((pending) => pending.id === processed.id)),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const filteredRequests = requests.filter(
    (r) => filter === "all" || r.status === "pending"
  );

  const pendingCount = pendingRequests.length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await requestsQuery.refetch();
    setRefreshing(false);
  };

  const handleApprove = (requestId: string) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    Alert.alert(
      "Accept Request",
      "This will add the user as your client. They will be notified and can start purchasing your bundles.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            const request = pendingRequests.find((item) => item.id === requestId);
            if (!request) return;
            setProcessingRequestId(requestId);
            try {
              await approveRequest.mutateAsync({ requestId });
              setProcessedRequests((prev) => {
                const next = prev.filter((item) => item.id !== requestId);
                return [{ ...request, status: "approved" }, ...next];
              });
            } catch (error) {
              console.error("Failed to approve join request:", error);
              Alert.alert("Error", "Failed to approve request. Please try again.");
            } finally {
              setProcessingRequestId(null);
            }
          },
        },
      ]
    );
  };

  const handleReject = (requestId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    Alert.alert(
      "Decline Request",
      "Are you sure you want to decline this request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            const request = pendingRequests.find((item) => item.id === requestId);
            if (!request) return;
            setProcessingRequestId(requestId);
            try {
              await rejectRequest.mutateAsync({ requestId });
              setProcessedRequests((prev) => {
                const next = prev.filter((item) => item.id !== requestId);
                return [{ ...request, status: "rejected" }, ...next];
              });
            } catch (error) {
              console.error("Failed to reject join request:", error);
              Alert.alert("Error", "Failed to decline request. Please try again.");
            } finally {
              setProcessingRequestId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer className="px-4">
      {/* Header */}
      <View className="flex-row items-center justify-between py-4">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <View>
            <Text className="text-2xl font-bold text-foreground">Join Requests</Text>
            <Text className="text-muted text-sm mt-1">
              {pendingCount} pending request{pendingCount !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>
      </View>

      {/* Filter tabs */}
      <View className="flex-row mb-4 bg-surface rounded-lg p-1">
        <TouchableOpacity
          onPress={() => setFilter("pending")}
          className="flex-1 py-2 rounded-md items-center"
          style={{
            backgroundColor: filter === "pending" ? colors.primary : "transparent",
          }}
        >
          <Text
            style={{
              color: filter === "pending" ? "#fff" : colors.muted,
              fontWeight: "600",
            }}
          >
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter("all")}
          className="flex-1 py-2 rounded-md items-center"
          style={{
            backgroundColor: filter === "all" ? colors.primary : "transparent",
          }}
        >
          <Text
            style={{
              color: filter === "all" ? "#fff" : colors.muted,
              fontWeight: "600",
            }}
          >
            All ({requests.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests list */}
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <JoinRequestCard
            request={item}
            onApprove={() => handleApprove(item.id)}
            onReject={() => handleReject(item.id)}
            isApproving={approveRequest.isPending && processingRequestId === item.id}
            isRejecting={rejectRequest.isPending && processingRequestId === item.id}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || requestsQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          requestsQuery.isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="text-muted mt-2">Loading join requests...</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-12">
            <IconSymbol name="person.badge.plus" size={48} color={colors.muted} />
            <Text className="text-muted text-center mt-4">
              {filter === "pending"
                ? "No pending requests"
                : "No join requests yet"}
            </Text>
            <Text className="text-muted text-center text-sm mt-1">
              Clients can request to join from your public profile
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      {processingRequestId && (
        <View className="absolute inset-0 bg-black/20 items-center justify-center">
          <View className="bg-surface rounded-xl px-4 py-3 border border-border flex-row items-center">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-foreground ml-2">Updating request...</Text>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
