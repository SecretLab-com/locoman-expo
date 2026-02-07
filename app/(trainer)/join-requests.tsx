import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

type JoinRequest = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userAvatar: string | null;
  message: string | null;
  goals: string[] | null;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
};

// TODO: Replace with real API when trainer join requests endpoint is created
// Needs: trpc.joinRequests.list.useQuery() or trpc.clients.joinRequests.useQuery()
// The server currently has myTrainers.requestToJoin (client-side) but no trainer-side
// endpoint to list incoming join requests.
const MOCK_JOIN_REQUESTS: JoinRequest[] = [
  {
    id: 1,
    userId: 101,
    userName: "Alex Thompson",
    userEmail: "alex.t@email.com",
    userAvatar: "https://i.pravatar.cc/150?img=33",
    message: "I've been following your content for months and would love to work with you on my weight loss journey!",
    goals: ["Weight Loss", "Nutrition"],
    status: "pending",
    createdAt: new Date(Date.now() - 86400000 * 2),
  },
  {
    id: 2,
    userId: 102,
    userName: "Emma Davis",
    userEmail: "emma.d@email.com",
    userAvatar: "https://i.pravatar.cc/150?img=44",
    message: "Looking to build strength and improve my overall fitness. Your programs look perfect for my goals.",
    goals: ["Strength Training", "HIIT"],
    status: "pending",
    createdAt: new Date(Date.now() - 86400000 * 1),
  },
  {
    id: 3,
    userId: 103,
    userName: "Chris Miller",
    userEmail: "chris.m@email.com",
    userAvatar: "https://i.pravatar.cc/150?img=55",
    message: "Referred by a friend who's your client. Ready to start my fitness transformation!",
    goals: ["Weight Loss", "Muscle Building"],
    status: "pending",
    createdAt: new Date(Date.now() - 86400000 * 0.5),
  },
];

function JoinRequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: JoinRequest;
  onApprove: () => void;
  onReject: () => void;
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
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={onReject}
          className="flex-1 py-3 rounded-lg border border-border items-center"
          style={{ opacity: 1 }}
          activeOpacity={0.7}
        >
          <Text className="text-muted font-semibold">Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onApprove}
          className="flex-1 py-3 rounded-lg items-center"
          style={{ backgroundColor: colors.primary }}
          activeOpacity={0.7}
        >
          <Text className="text-white font-semibold">Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function JoinRequestsScreen() {
  const colors = useColors();
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState(MOCK_JOIN_REQUESTS);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const filteredRequests = requests.filter(
    (r) => filter === "all" || r.status === "pending"
  );

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const handleRefresh = async () => {
    setRefreshing(true);
    // TODO: Replace with real API refetch when endpoint is created
    // e.g. await refetch();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleApprove = (requestId: number) => {
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
          onPress: () => {
            setRequests((prev) =>
              prev.map((r) =>
                r.id === requestId ? { ...r, status: "approved" as const } : r
              )
            );
            // TODO: Replace with trpc.clients.approveJoinRequest.useMutation() when endpoint is created
          },
        },
      ]
    );
  };

  const handleReject = (requestId: number) => {
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
          onPress: () => {
            setRequests((prev) =>
              prev.map((r) =>
                r.id === requestId ? { ...r, status: "rejected" as const } : r
              )
            );
            // TODO: Replace with trpc.clients.rejectJoinRequest.useMutation() when endpoint is created
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
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <JoinRequestCard
            request={item}
            onApprove={() => handleApprove(item.id)}
            onReject={() => handleReject(item.id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
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
    </ScreenContainer>
  );
}
