import { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

// Types for client data
type Session = {
  id: number;
  date: string;
  type: "training" | "check_in" | "call" | "plan_review";
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes?: string;
};

type Subscription = {
  id: number;
  bundleTitle: string;
  price: string;
  cadence: "weekly" | "monthly" | "yearly";
  sessionsIncluded: number;
  sessionsUsed: number;
  startDate: string;
  status: "active" | "paused" | "cancelled" | "expired";
};

type Delivery = {
  id: number;
  productName: string;
  status: "pending" | "ready" | "delivered" | "confirmed";
  scheduledDate: string;
};

type ClientData = {
  id: number;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  goals: string[];
  notes: string;
  joinedDate: string;
  subscription?: Subscription;
  upcomingSessions: Session[];
  pastSessions: Session[];
  pendingDeliveries: Delivery[];
};

// Mock data
const MOCK_CLIENT: ClientData = {
  id: 1,
  name: "Sarah Johnson",
  email: "sarah.johnson@email.com",
  phone: "+1 (555) 123-4567",
  photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200",
  goals: ["Weight Loss", "Muscle Building"],
  notes: "Prefers morning sessions. Has a knee injury - avoid high impact exercises.",
  joinedDate: "2024-01-15",
  subscription: {
    id: 1,
    bundleTitle: "Full Body Transformation",
    price: "149.99",
    cadence: "monthly",
    sessionsIncluded: 8,
    sessionsUsed: 3,
    startDate: "2024-01-15",
    status: "active",
  },
  upcomingSessions: [
    { id: 1, date: "2024-03-20T10:00:00", type: "training", status: "scheduled" },
    { id: 2, date: "2024-03-22T10:00:00", type: "training", status: "scheduled" },
    { id: 3, date: "2024-03-25T14:00:00", type: "check_in", status: "scheduled" },
  ],
  pastSessions: [
    { id: 4, date: "2024-03-15T10:00:00", type: "training", status: "completed" },
    { id: 5, date: "2024-03-13T10:00:00", type: "training", status: "completed" },
    { id: 6, date: "2024-03-11T10:00:00", type: "training", status: "completed" },
  ],
  pendingDeliveries: [
    { id: 1, productName: "Protein Powder - Vanilla", status: "ready", scheduledDate: "2024-03-20" },
    { id: 2, productName: "Resistance Bands Set", status: "pending", scheduledDate: "2024-03-22" },
  ],
};

function SessionCard({ session, onMarkComplete, onCancel }: {
  session: Session;
  onMarkComplete?: () => void;
  onCancel?: () => void;
}) {
  const colors = useColors();

  const getSessionIcon = (type: Session["type"]) => {
    switch (type) {
      case "training": return "dumbbell.fill";
      case "check_in": return "checkmark.circle.fill";
      case "call": return "video.fill";
      case "plan_review": return "doc.text.fill";
      default: return "calendar";
    }
  };

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "scheduled": return colors.primary;
      case "completed": return colors.success;
      case "cancelled": return colors.muted;
      case "no_show": return colors.error;
      default: return colors.muted;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <View className="bg-surface border border-border rounded-xl p-4 mb-3">
      <View className="flex-row items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: getStatusColor(session.status) + "20" }}
        >
          <IconSymbol
            name={getSessionIcon(session.type) as any}
            size={20}
            color={getStatusColor(session.status)}
          />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-medium capitalize">
            {session.type.replace("_", " ")}
          </Text>
          <Text className="text-muted text-sm">{formatDate(session.date)}</Text>
        </View>
        <View
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: getStatusColor(session.status) + "20" }}
        >
          <Text
            className="text-xs font-medium capitalize"
            style={{ color: getStatusColor(session.status) }}
          >
            {session.status}
          </Text>
        </View>
      </View>

      {session.status === "scheduled" && (
        <View className="flex-row mt-3 pt-3 border-t border-border gap-2">
          <TouchableOpacity
            className="flex-1 py-2 rounded-lg bg-primary"
            onPress={onMarkComplete}
          >
            <Text className="text-background text-center font-medium text-sm">Mark Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-2 rounded-lg border border-border"
            onPress={onCancel}
          >
            <Text className="text-muted text-center font-medium text-sm">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function DeliveryCard({ delivery, onMarkReady, onMarkDelivered }: {
  delivery: Delivery;
  onMarkReady?: () => void;
  onMarkDelivered?: () => void;
}) {
  const colors = useColors();

  const getStatusColor = (status: Delivery["status"]) => {
    switch (status) {
      case "pending": return colors.warning;
      case "ready": return colors.primary;
      case "delivered": return colors.success;
      case "confirmed": return colors.success;
      default: return colors.muted;
    }
  };

  return (
    <View className="bg-surface border border-border rounded-xl p-4 mb-3">
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-3">
          <IconSymbol name="bag.fill" size={20} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-medium">{delivery.productName}</Text>
          <Text className="text-muted text-sm">Scheduled: {delivery.scheduledDate}</Text>
        </View>
        <View
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: getStatusColor(delivery.status) + "20" }}
        >
          <Text
            className="text-xs font-medium capitalize"
            style={{ color: getStatusColor(delivery.status) }}
          >
            {delivery.status}
          </Text>
        </View>
      </View>

      {(delivery.status === "pending" || delivery.status === "ready") && (
        <View className="flex-row mt-3 pt-3 border-t border-border gap-2">
          {delivery.status === "pending" && (
            <TouchableOpacity
              className="flex-1 py-2 rounded-lg bg-primary"
              onPress={onMarkReady}
            >
              <Text className="text-background text-center font-medium text-sm">Mark Ready</Text>
            </TouchableOpacity>
          )}
          {delivery.status === "ready" && (
            <TouchableOpacity
              className="flex-1 py-2 rounded-lg bg-success"
              onPress={onMarkDelivered}
            >
              <Text className="text-background text-center font-medium text-sm">Mark Delivered</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function ClientDetailScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientData | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "deliveries">("overview");

  useEffect(() => {
    loadClient();
  }, [id]);

  const loadClient = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setClient(MOCK_CLIENT);
    } catch (error) {
      console.error("Failed to load client:", error);
      Alert.alert("Error", "Failed to load client data");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkSessionComplete = async (sessionId: number) => {
    Alert.alert(
      "Complete Session",
      "Mark this session as completed? This will use 1 session from the subscription.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            try {
              // TODO: API call to complete session
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              // Update local state
              if (client && client.subscription) {
                setClient({
                  ...client,
                  subscription: {
                    ...client.subscription,
                    sessionsUsed: client.subscription.sessionsUsed + 1,
                  },
                  upcomingSessions: client.upcomingSessions.filter((s) => s.id !== sessionId),
                  pastSessions: [
                    { ...client.upcomingSessions.find((s) => s.id === sessionId)!, status: "completed" },
                    ...client.pastSessions,
                  ],
                });
              }
            } catch {
              Alert.alert("Error", "Failed to complete session");
            }
          },
        },
      ]
    );
  };

  const handleCancelSession = async (sessionId: number) => {
    Alert.alert(
      "Cancel Session",
      "Are you sure you want to cancel this session?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            // TODO: API call
            if (client) {
              setClient({
                ...client,
                upcomingSessions: client.upcomingSessions.filter((s) => s.id !== sessionId),
              });
            }
          },
        },
      ]
    );
  };

  const handleMarkDeliveryReady = async (deliveryId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: API call
    if (client) {
      setClient({
        ...client,
        pendingDeliveries: client.pendingDeliveries.map((d) =>
          d.id === deliveryId ? { ...d, status: "ready" as const } : d
        ),
      });
    }
  };

  const handleMarkDeliveryDelivered = async (deliveryId: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // TODO: API call
    if (client) {
      setClient({
        ...client,
        pendingDeliveries: client.pendingDeliveries.map((d) =>
          d.id === deliveryId ? { ...d, status: "delivered" as const } : d
        ),
      });
    }
  };

  const handleScheduleSession = () => {
    Alert.alert("Coming Soon", "Session scheduling will be available soon");
  };

  const handleMessage = () => {
    Alert.alert("Coming Soon", "Messaging will be available soon");
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading client...</Text>
      </ScreenContainer>
    );
  }

  if (!client) {
    return (
      <ScreenContainer className="items-center justify-center p-4">
        <IconSymbol name="person.fill" size={48} color={colors.muted} />
        <Text className="text-muted mt-4">Client not found</Text>
        <TouchableOpacity
          className="mt-4 bg-primary px-6 py-3 rounded-full"
          onPress={() => router.back()}
        >
          <Text className="text-background font-semibold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const sessionsRemaining = client.subscription
    ? client.subscription.sessionsIncluded - client.subscription.sessionsUsed
    : 0;

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-semibold text-foreground ml-2">Client Details</Text>
        <TouchableOpacity onPress={handleMessage} className="p-2">
          <IconSymbol name="message.fill" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Client Profile */}
        <View className="p-4 items-center">
          {client.photoUrl ? (
            <Image
              source={{ uri: client.photoUrl }}
              className="w-24 h-24 rounded-full"
              contentFit="cover"
            />
          ) : (
            <View className="w-24 h-24 rounded-full bg-primary/20 items-center justify-center">
              <Text className="text-3xl font-bold text-primary">
                {client.name.charAt(0)}
              </Text>
            </View>
          )}
          <Text className="text-xl font-bold text-foreground mt-3">{client.name}</Text>
          <Text className="text-muted">{client.email}</Text>
          <Text className="text-muted text-sm">{client.phone}</Text>

          {/* Goals */}
          <View className="flex-row flex-wrap justify-center mt-3 gap-2">
            {client.goals.map((goal) => (
              <View key={goal} className="bg-primary/20 px-3 py-1 rounded-full">
                <Text className="text-primary text-sm">{goal}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Subscription & Sessions Card */}
        {client.subscription && (
          <View className="mx-4 bg-surface border border-border rounded-xl p-4 mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-foreground font-semibold">{client.subscription.bundleTitle}</Text>
              <View className="bg-success/20 px-2 py-1 rounded-full">
                <Text className="text-success text-xs font-medium capitalize">
                  {client.subscription.status}
                </Text>
              </View>
            </View>

            {/* Session Progress */}
            <View className="mb-3">
              <View className="flex-row justify-between mb-2">
                <Text className="text-muted text-sm">Sessions Used</Text>
                <Text className="text-foreground font-medium">
                  {client.subscription.sessionsUsed} / {client.subscription.sessionsIncluded}
                </Text>
              </View>
              <View className="h-2 bg-border rounded-full overflow-hidden">
                <View
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${(client.subscription.sessionsUsed / client.subscription.sessionsIncluded) * 100}%`,
                  }}
                />
              </View>
              <Text className="text-sm text-muted mt-1">
                {sessionsRemaining} sessions remaining this {client.subscription.cadence}
              </Text>
            </View>

            <View className="flex-row justify-between pt-3 border-t border-border">
              <View>
                <Text className="text-muted text-xs">Price</Text>
                <Text className="text-foreground font-semibold">
                  ${client.subscription.price}/{client.subscription.cadence}
                </Text>
              </View>
              <View>
                <Text className="text-muted text-xs">Started</Text>
                <Text className="text-foreground font-semibold">{client.subscription.startDate}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tab Navigation */}
        <View className="flex-row mx-4 bg-surface rounded-xl p-1 mb-4">
          {(["overview", "sessions", "deliveries"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-2 rounded-lg ${activeTab === tab ? "bg-primary" : ""}`}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                className={`text-center font-medium capitalize ${
                  activeTab === tab ? "text-background" : "text-muted"
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View className="px-4 pb-8">
          {activeTab === "overview" && (
            <View>
              {/* Notes */}
              <View className="bg-surface border border-border rounded-xl p-4 mb-4">
                <Text className="text-foreground font-semibold mb-2">Notes</Text>
                <Text className="text-muted">{client.notes || "No notes added yet."}</Text>
              </View>

              {/* Quick Actions */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-primary py-3 rounded-xl flex-row items-center justify-center"
                  onPress={handleScheduleSession}
                >
                  <IconSymbol name="calendar" size={18} color={colors.background} />
                  <Text className="text-background font-semibold ml-2">Schedule Session</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {activeTab === "sessions" && (
            <View>
              <Text className="text-foreground font-semibold mb-3">Upcoming Sessions</Text>
              {client.upcomingSessions.length === 0 ? (
                <View className="bg-surface border border-border rounded-xl p-6 items-center mb-4">
                  <IconSymbol name="calendar" size={32} color={colors.muted} />
                  <Text className="text-muted mt-2">No upcoming sessions</Text>
                </View>
              ) : (
                client.upcomingSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onMarkComplete={() => handleMarkSessionComplete(session.id)}
                    onCancel={() => handleCancelSession(session.id)}
                  />
                ))
              )}

              <Text className="text-foreground font-semibold mb-3 mt-4">Past Sessions</Text>
              {client.pastSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </View>
          )}

          {activeTab === "deliveries" && (
            <View>
              <Text className="text-foreground font-semibold mb-3">Pending Deliveries</Text>
              {client.pendingDeliveries.length === 0 ? (
                <View className="bg-surface border border-border rounded-xl p-6 items-center">
                  <IconSymbol name="bag.fill" size={32} color={colors.muted} />
                  <Text className="text-muted mt-2">No pending deliveries</Text>
                </View>
              ) : (
                client.pendingDeliveries.map((delivery) => (
                  <DeliveryCard
                    key={delivery.id}
                    delivery={delivery}
                    onMarkReady={() => handleMarkDeliveryReady(delivery.id)}
                    onMarkDelivered={() => handleMarkDeliveryDelivered(delivery.id)}
                  />
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
