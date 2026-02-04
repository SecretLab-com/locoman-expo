import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
  sessionsRemaining: number; // remaining sessions for tracking
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
    sessionsRemaining: 5,
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
    <View className="bg-surface border border-border/50 rounded-2xl p-4 mb-3 shadow-sm">
      <View className="flex-row items-center">
        <View
          className="w-12 h-12 rounded-xl items-center justify-center mr-4"
          style={{ backgroundColor: getStatusColor(session.status) + "15" }}
        >
          <IconSymbol
            name={getSessionIcon(session.type) as any}
            size={22}
            color={getStatusColor(session.status)}
          />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base capitalize">
            {session.type.replace("_", " ")}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <IconSymbol name="calendar" size={12} color={colors.muted} />
            <Text className="text-muted text-xs ml-1 font-medium">{formatDate(session.date)}</Text>
          </View>
        </View>
        <View
          className="px-3 py-1 rounded-full border border-current"
          style={{
            backgroundColor: getStatusColor(session.status) + "10",
            borderColor: getStatusColor(session.status) + "30"
          }}
        >
          <Text
            className="text-[10px] font-bold uppercase tracking-tight"
            style={{ color: getStatusColor(session.status) }}
          >
            {session.status}
          </Text>
        </View>
      </View>

      {session.status === "scheduled" && (
        <View className="flex-row mt-4 pt-4 border-t border-border/40 gap-3">
          <TouchableOpacity
            className="flex-1 py-2.5 rounded-xl bg-primary shadow-sm active:opacity-80"
            onPress={onMarkComplete}
          >
            <Text className="text-background text-center font-bold text-sm">Mark Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 py-2.5 rounded-xl border border-border bg-surface/30 active:opacity-80"
            onPress={onCancel}
          >
            <Text className="text-muted text-center font-bold text-sm">Cancel</Text>
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
    <View className="bg-surface border border-border/50 rounded-2xl p-4 mb-3 shadow-sm">
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center mr-4">
          <IconSymbol name="bag.fill" size={22} color={colors.primary} />
        </View>
        <View className="flex-1">
          <Text className="text-foreground font-bold text-base">{delivery.productName}</Text>
          <View className="flex-row items-center mt-0.5">
            <IconSymbol name="calendar" size={12} color={colors.muted} />
            <Text className="text-muted text-xs ml-1 font-medium">Scheduled: {delivery.scheduledDate}</Text>
          </View>
        </View>
        <View
          className="px-3 py-1 rounded-full border border-current"
          style={{
            backgroundColor: getStatusColor(delivery.status) + "10",
            borderColor: getStatusColor(delivery.status) + "30"
          }}
        >
          <Text
            className="text-[10px] font-bold uppercase tracking-tight"
            style={{ color: getStatusColor(delivery.status) }}
          >
            {delivery.status}
          </Text>
        </View>
      </View>

      {(delivery.status === "pending" || delivery.status === "ready") && (
        <View className="flex-row mt-4 pt-4 border-t border-border/40 gap-3">
          {delivery.status === "pending" && (
            <TouchableOpacity
              className="flex-1 py-2.5 rounded-xl bg-primary shadow-sm active:opacity-80"
              onPress={onMarkReady}
            >
              <Text className="text-background text-center font-bold text-sm">Ready</Text>
            </TouchableOpacity>
          )}
          {delivery.status === "ready" && (
            <TouchableOpacity
              className="flex-1 py-2.5 rounded-xl bg-success shadow-sm active:opacity-80"
              onPress={onMarkDelivered}
            >
              <Text className="text-white text-center font-bold text-sm">Delivered</Text>
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
    <ScreenContainer edges={["left", "right"]}>
      {/* Navigation Header */}
      <NavigationHeader
        title="Client Details"
        rightAction={{
          icon: "message.fill",
          onPress: handleMessage,
          label: "Message client",
          testID: "message-client",
        }}
      />

      {/* Breadcrumb Navigation */}
      <BreadcrumbNav
        items={[
          { label: "Clients", path: "/(trainer)/clients" },
          { label: client.name },
        ]}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Client Profile Header */}
        <View className="relative">
          <LinearGradient
            colors={[colors.primary + "1A", colors.background]}
            className="absolute top-0 left-0 right-0 h-48"
          />

          <View className="p-6 items-center">
            <View className="relative">
              {client.photoUrl ? (
                <Image
                  source={{ uri: client.photoUrl }}
                  className="w-28 h-28 rounded-full border-4 border-background shadow-lg"
                  contentFit="cover"
                />
              ) : (
                <View className="w-28 h-28 rounded-full bg-primary/20 items-center justify-center border-4 border-background shadow-lg">
                  <Text className="text-4xl font-bold text-primary">
                    {client.name.charAt(0)}
                  </Text>
                </View>
              )}
              <View className="absolute bottom-1 right-1 w-6 h-6 bg-success rounded-full border-2 border-background" />
            </View>

            <Text className="text-2xl font-bold text-foreground mt-4">{client.name}</Text>
            <View className="flex-row items-center mt-1">
              <IconSymbol name="envelope.fill" size={12} color={colors.muted} />
              <Text className="text-muted text-sm ml-1">{client.email}</Text>
            </View>

            <View className="flex-row items-center mt-2 bg-surface/50 border border-border px-3 py-1.5 rounded-full">
              <IconSymbol name="calendar" size={12} color={colors.primary} />
              <Text className="text-xs text-muted ml-1.5">Joined {new Date(client.joinedDate).toLocaleDateString()}</Text>
            </View>

            {/* Quick Stats Row */}
            <View className="flex-row mt-6 w-full justify-around bg-surface border border-border rounded-2xl p-4 shadow-sm">
              <View className="items-center">
                <Text className="text-foreground font-bold text-lg">{client.pastSessions.length}</Text>
                <Text className="text-muted text-[10px] uppercase font-bold tracking-wider">Sessions</Text>
              </View>
              <View className="w-px h-8 bg-border" />
              <View className="items-center">
                <Text className="text-foreground font-bold text-lg">{client.pendingDeliveries.length}</Text>
                <Text className="text-muted text-[10px] uppercase font-bold tracking-wider">Orders</Text>
              </View>
              <View className="w-px h-8 bg-border" />
              <View className="items-center">
                <Text className="text-foreground font-bold text-lg">{client.goals.length}</Text>
                <Text className="text-muted text-[10px] uppercase font-bold tracking-wider">Goals</Text>
              </View>
            </View>

            {/* Goals */}
            <View className="flex-row flex-wrap justify-center mt-4 gap-2">
              {client.goals.map((goal) => (
                <View key={goal} className="bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full">
                  <Text className="text-primary text-xs font-semibold">{goal}</Text>
                </View>
              ))}
            </View>
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
            <View className="mb-4">
              <View className="flex-row justify-between mb-2 items-baseline">
                <Text className="text-muted text-sm font-medium">Session Credits</Text>
                <View className="flex-row items-baseline">
                  <Text className="text-2xl font-bold text-foreground">
                    {client.subscription.sessionsUsed}
                  </Text>
                  <Text className="text-muted text-sm font-medium ml-1">
                    / {client.subscription.sessionsIncluded} used
                  </Text>
                </View>
              </View>
              <View className="h-3 bg-border rounded-full overflow-hidden">
                <LinearGradient
                  colors={[colors.primary, colors.primary + "CC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="h-full rounded-full"
                  style={{
                    width: `${(client.subscription.sessionsUsed / client.subscription.sessionsIncluded) * 100}%`,
                  }}
                />
              </View>
              <View className="flex-row items-center mt-2">
                <IconSymbol name="clock.fill" size={12} color={colors.muted} />
                <Text className="text-xs text-muted ml-1 font-medium">
                  {sessionsRemaining} sessions remaining • Resets in {client.subscription.cadence}
                </Text>
              </View>
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
        <View className="mx-4 mb-4">
          <View className="flex-row bg-surface border border-border p-1.5 rounded-2xl shadow-sm">
            {(["overview", "sessions", "deliveries"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                className={`flex-1 py-2.5 rounded-xl ${activeTab === tab ? "bg-primary shadow-sm" : ""}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab);
                }}
              >
                <Text
                  className={`text-center font-bold text-xs uppercase tracking-wider ${activeTab === tab ? "text-background" : "text-muted"
                    }`}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-4 pb-8">
          {activeTab === "overview" && (
            <View>
              {/* Notes */}
              <View className="bg-surface border border-border/50 rounded-2xl p-5 mb-5 shadow-sm">
                <View className="flex-row items-center mb-3">
                  <View className="w-8 h-8 rounded-lg bg-warning/10 items-center justify-center mr-2">
                    <IconSymbol name="note.text" size={16} color={colors.warning} />
                  </View>
                  <Text className="text-foreground font-bold text-base">Trainer Notes</Text>
                </View>
                <Text className="text-muted leading-relaxed">
                  {client.notes || "No notes added yet. Use this space to track progress and preferences."}
                </Text>
              </View>

              {/* Quick Actions */}
              <View className="flex-row gap-4">
                <TouchableOpacity
                  className="flex-1 bg-primary py-4 rounded-2xl flex-row items-center justify-center shadow-lg active:opacity-90"
                  onPress={handleScheduleSession}
                >
                  <IconSymbol name="calendar.badge.plus" size={20} color={colors.background} />
                  <Text className="text-background font-bold ml-2">Schedule Session</Text>
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
