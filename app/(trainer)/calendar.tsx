import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { trpc } from "@/lib/trpc";

// Days of the week
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

type Session = {
  id: string;
  clientId?: string;
  clientName?: string;
  bundleId?: string;
  bundleTitle?: string;
  date: Date;
  time: string;
  duration: number; // minutes
  type: "session" | "check_in" | "delivery" | string;
  status: "scheduled" | "completed" | "cancelled" | "no_show" | string;
  notes?: string;
};

export default function CalendarScreen() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const overlayColor = colorScheme === "dark"
    ? "rgba(0, 0, 0, 0.5)"
    : "rgba(15, 23, 42, 0.18)";
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Fetch sessions from tRPC
  const { data: sessionsData, isLoading, refetch, isRefetching } = trpc.sessions.list.useQuery();

  // Map API data to Session type
  const sessions: Session[] = useMemo(() => {
    return (sessionsData || []).map((s: any) => {
      const sessionDate = new Date(s.sessionDate || s.date || s.createdAt);
      const hours = sessionDate.getHours().toString().padStart(2, "0");
      const minutes = sessionDate.getMinutes().toString().padStart(2, "0");
      return {
        id: String(s.id),
        clientId: s.clientId,
        clientName: s.clientName || "Unknown Client",
        bundleId: s.bundleId,
        bundleTitle: s.bundleTitle || "",
        date: sessionDate,
        time: s.time || `${hours}:${minutes}`,
        duration: s.durationMinutes || s.duration || 60,
        type: s.sessionType || s.type || "session",
        status: s.status || "scheduled",
        notes: s.notes,
      };
    });
  }, [sessionsData]);

  // Session mutations
  const completeMutation = trpc.sessions.complete.useMutation({
    onSuccess: () => {
      refetch();
      setShowSessionModal(false);
    },
  });

  const cancelMutation = trpc.sessions.cancel.useMutation({
    onSuccess: () => {
      refetch();
      setShowSessionModal(false);
    },
  });

  const onRefresh = async () => {
    await refetch();
  };

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const days: { date: Date; isCurrentMonth: boolean; hasEvents: boolean }[] = [];
    
    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false, hasEvents: false });
    }
    
    // Current month
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i);
      const hasEvents = sessions.some(
        (s) => s.date.toDateString() === date.toDateString()
      );
      days.push({ date, isCurrentMonth: true, hasEvents });
    }
    
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false, hasEvents: false });
    }
    
    return days;
  }, [currentDate, sessions]);

  // Get sessions for selected date
  const selectedDateSessions = useMemo(() => {
    return sessions.filter(
      (s) => s.date.toDateString() === selectedDate.toDateString()
    ).sort((a, b) => a.time.localeCompare(b.time));
  }, [sessions, selectedDate]);

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is selected
  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  // Handle session actions
  const handleCompleteSession = (session: Session) => {
    Alert.alert(
      "Complete Session",
      `Mark session with ${session.clientName} as completed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: () => {
            completeMutation.mutate({ id: session.id });
          },
        },
      ]
    );
  };

  const handleCancelSession = (session: Session) => {
    Alert.alert(
      "Cancel Session",
      `Cancel session with ${session.clientName}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => {
            cancelMutation.mutate({ id: session.id });
          },
        },
      ]
    );
  };

  // Get status color
  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "scheduled":
        return colors.primary;
      case "completed":
        return "#22C55E";
      case "cancelled":
        return colors.muted;
      case "no_show":
        return "#EF4444";
      default:
        return colors.muted;
    }
  };

  // Get type label
  const getTypeLabel = (type: Session["type"]) => {
    switch (type) {
      case "session":
        return "Training Session";
      case "check_in":
        return "Check-in";
      case "delivery":
        return "Delivery";
      default:
        return type;
    }
  };

  return (
    <ScreenContainer className="flex-1" edges={["left", "right"]}>
      {/* Navigation Header */}
      <NavigationHeader
        title="Calendar"
        rightAction={{
          icon: "plus",
          onPress: () => setShowAddModal(true),
          label: "Add session",
          testID: "add-session",
        }}
      />

      {/* Month Navigation */}
      <View className="flex-row items-center justify-between px-4 mb-4">
        <TouchableOpacity
          onPress={goToPreviousMonth}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center"
        >
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday}>
          <Text className="text-lg font-semibold text-foreground">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goToNextMonth}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center"
        >
          <IconSymbol name="chevron.right" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Calendar Grid */}
      <View className="px-4 mb-4">
        {/* Day Headers */}
        <View className="flex-row mb-2">
          {DAYS.map((day) => (
            <View key={day} className="flex-1 items-center">
              <Text className="text-xs text-muted font-medium">{day}</Text>
            </View>
          ))}
        </View>

        {/* Date Grid */}
        <View className="flex-row flex-wrap">
          {calendarData.map((day, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setSelectedDate(day.date)}
              className="w-[14.28%] aspect-square items-center justify-center"
            >
              <View
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  isSelected(day.date)
                    ? "bg-primary"
                    : isToday(day.date)
                    ? "bg-primary/20"
                    : ""
                }`}
              >
                <Text
                  className={`text-sm ${
                    isSelected(day.date)
                      ? "text-white font-bold"
                      : day.isCurrentMonth
                      ? "text-foreground"
                      : "text-muted"
                  }`}
                >
                  {day.date.getDate()}
                </Text>
                {day.hasEvents && !isSelected(day.date) && (
                  <View className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Selected Date Sessions */}
      <View className="flex-1 px-4">
        <Text className="text-base font-semibold text-foreground mb-3">
          {selectedDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : selectedDateSessions.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 items-center">
              <IconSymbol name="calendar" size={32} color={colors.muted} />
              <Text className="text-muted mt-2">No sessions scheduled</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(true)}
                className="mt-3 px-4 py-2 border border-border rounded-lg"
              >
                <Text className="text-foreground">Schedule Session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            selectedDateSessions.map((session) => (
              <TouchableOpacity
                key={session.id}
                onPress={() => {
                  setSelectedSession(session);
                  setShowSessionModal(true);
                }}
                className="bg-surface rounded-xl p-4 mb-3 border border-border"
              >
                <View className="flex-row items-start">
                  {/* Time */}
                  <View className="w-16">
                    <Text className="text-lg font-bold text-foreground">
                      {session.time}
                    </Text>
                    <Text className="text-xs text-muted">{session.duration}min</Text>
                  </View>

                  {/* Divider */}
                  <View
                    className="w-1 h-full rounded-full mr-3"
                    style={{ backgroundColor: getStatusColor(session.status) }}
                  />

                  {/* Content */}
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      {session.clientName}
                    </Text>
                    <Text className="text-sm text-muted">{session.bundleTitle}</Text>
                    <View className="flex-row items-center mt-1">
                      <View
                        className="px-2 py-0.5 rounded"
                        style={{ backgroundColor: `${getStatusColor(session.status)}20` }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: getStatusColor(session.status) }}
                        >
                          {getTypeLabel(session.type)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Chevron */}
                  <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Bottom padding */}
          <View className="h-24" />
        </ScrollView>
      </View>

      {/* Session Detail Modal */}
      <Modal
        visible={showSessionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSessionModal(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          onPress={() => setShowSessionModal(false)}
          style={{ backgroundColor: overlayColor }}
        >
          <View className="bg-background rounded-t-3xl p-6">
            {selectedSession && (
              <>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xl font-bold text-foreground">Session Details</Text>
                  <TouchableOpacity onPress={() => setShowSessionModal(false)}>
                    <IconSymbol name="xmark" size={24} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                <View className="bg-surface rounded-xl p-4 mb-4">
                  <Text className="text-lg font-semibold text-foreground">
                    {selectedSession.clientName}
                  </Text>
                  <Text className="text-muted">{selectedSession.bundleTitle}</Text>
                  <View className="flex-row mt-3 gap-4">
                    <View className="flex-row items-center">
                      <IconSymbol name="clock.fill" size={16} color={colors.muted} />
                      <Text className="text-foreground ml-1">{selectedSession.time}</Text>
                    </View>
                    <View className="flex-row items-center">
                      <IconSymbol name="calendar" size={16} color={colors.muted} />
                      <Text className="text-foreground ml-1">{selectedSession.duration} min</Text>
                    </View>
                  </View>
                </View>

                {selectedSession.status === "scheduled" && (
                  <View className="gap-3">
                    <TouchableOpacity
                      onPress={() => handleCompleteSession(selectedSession)}
                      className="bg-success py-4 rounded-xl items-center"
                    >
                      <Text className="text-white font-semibold">Mark as Completed</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleCancelSession(selectedSession)}
                      className="bg-surface py-4 rounded-xl items-center border border-border"
                    >
                      <Text className="text-error font-semibold">Cancel Session</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => setShowSessionModal(false)}
                  className="py-3 mt-3"
                >
                  <Text className="text-center text-muted">Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Add Session Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          onPress={() => setShowAddModal(false)}
          style={{ backgroundColor: overlayColor }}
        >
          <View className="bg-background rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-foreground">Schedule Session</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <Text className="text-muted text-center py-8">
              Session scheduling will be available soon.{"\n"}
              Contact your clients directly to schedule sessions.
            </Text>

            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              className="bg-primary py-4 rounded-xl items-center"
            >
              <Text className="text-white font-semibold">Got it</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
