import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

// Days of the week
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SESSION_TYPE_OPTIONS = [
  { value: "training" as const, label: "Training" },
  { value: "check_in" as const, label: "Check-In" },
  { value: "call" as const, label: "Call" },
  { value: "plan_review" as const, label: "Plan Review" },
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
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ scheduleClientId?: string | string[]; code?: string | string[] }>();
  const scheduleClientId = Array.isArray(params.scheduleClientId)
    ? params.scheduleClientId[0]
    : params.scheduleClientId;
  const colorScheme = useColorScheme();
  const overlayColor = "rgba(0,0,0,0.85)";
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [newSessionClientId, setNewSessionClientId] = useState<string | null>(scheduleClientId || null);
  const [newSessionTime, setNewSessionTime] = useState("09:00");
  const [newSessionDuration, setNewSessionDuration] = useState("60");
  const [newSessionType, setNewSessionType] = useState<"training" | "check_in" | "call" | "plan_review">("training");
  const [newSessionLocation, setNewSessionLocation] = useState("");
  const [newSessionNotes, setNewSessionNotes] = useState("");
  const [searchClient, setSearchClient] = useState("");
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [rescheduleDuration, setRescheduleDuration] = useState("60");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const isWideScreen = windowWidth >= 1100;

  // Fetch sessions from tRPC
  const { data: clientsData = [], isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const { data: sessionsData, isLoading, refetch, isRefetching } = trpc.sessions.list.useQuery();
  const createSessionMutation = trpc.sessions.create.useMutation({
    onSuccess: async () => {
      await refetch();
      setShowAddModal(false);
      setNewSessionTime("09:00");
      setNewSessionDuration("60");
      setNewSessionType("training");
      setNewSessionLocation("");
      setNewSessionNotes("");
      setSearchClient("");
      Alert.alert("Success", "Session scheduled.");
    },
    onError: (error) => {
      Alert.alert("Error", error.message || "Failed to schedule session.");
    },
  });
  const googleStatus = trpc.googleCalendar.status.useQuery();
  const googleCalendars = trpc.googleCalendar.calendars.useQuery(undefined, {
    enabled: Boolean(googleStatus.data?.connected),
  });
  const getGoogleAuthUrl = trpc.googleCalendar.getAuthUrl.useMutation();
  const connectGoogleCalendar = trpc.googleCalendar.connectWithCode.useMutation({
    onSuccess: async () => {
      await Promise.all([googleStatus.refetch(), googleCalendars.refetch()]);
      Alert.alert("Connected", "Google Calendar connected successfully.");
    },
    onError: (error) => {
      Alert.alert("Google Calendar Error", error.message || "Could not connect Google Calendar.");
    },
  });
  const selectGoogleCalendar = trpc.googleCalendar.selectCalendar.useMutation({
    onSuccess: async () => {
      await Promise.all([googleStatus.refetch(), googleCalendars.refetch()]);
    },
  });
  const disconnectGoogleCalendar = trpc.googleCalendar.disconnect.useMutation({
    onSuccess: async () => {
      await Promise.all([googleStatus.refetch(), googleCalendars.refetch()]);
      Alert.alert("Disconnected", "Google Calendar has been disconnected.");
    },
  });
  const suggestRescheduleMutation = trpc.sessions.suggestReschedule.useMutation({
    onSuccess: () => {
      setShowRescheduleModal(false);
      setShowSessionModal(false);
      Alert.alert("Suggestion sent", "Reschedule suggestion shared via Google Calendar.");
    },
    onError: (error) => {
      Alert.alert("Could not suggest move", error.message || "Try again.");
    },
  });

  useEffect(() => {
    if (scheduleClientId) {
      setNewSessionClientId(scheduleClientId);
      setShowAddModal(true);
    }
  }, [scheduleClientId]);

  useEffect(() => {
    let code = Array.isArray(params.code) ? params.code[0] : params.code;
    if (!code && Platform.OS === "web" && typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      code = urlParams.get("code") || undefined;
    }
    if (!code || Platform.OS !== "web" || connectGoogleCalendar.isPending) return;
    const redirectUri = `${window.location.origin}/calendar`;
    connectGoogleCalendar
      .mutateAsync({ code, redirectUri })
      .then(() => {
        Alert.alert("Connected", "Google Calendar connected. A 'Locomotivate' calendar has been created.");
      })
      .catch((err) => {
        Alert.alert("Connection failed", err?.message || "Could not connect Google Calendar.");
      })
      .finally(() => {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
  }, [params.code]);

  // Map API data to Session type
  const sessions: Session[] = useMemo(() => {
    const clientNameById = new Map<string, string>();
    (clientsData || []).forEach((client: any) => {
      if (client?.id) {
        clientNameById.set(String(client.id), String(client.name || client.email || "Client"));
      }
    });

    return (sessionsData || []).map((s: any) => {
      const sessionDate = new Date(s.sessionDate || s.date || s.createdAt);
      const hours = sessionDate.getHours().toString().padStart(2, "0");
      const minutes = sessionDate.getMinutes().toString().padStart(2, "0");
      const clientId = s.clientId ? String(s.clientId) : undefined;
      return {
        id: String(s.id),
        clientId,
        clientName: s.clientName || (clientId ? clientNameById.get(clientId) : undefined) || "Unknown Client",
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
  }, [sessionsData, clientsData]);

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

  const clientOptions = useMemo(() => {
    const term = searchClient.trim().toLowerCase();
    return (clientsData || [])
      .map((client: any) => ({
        id: String(client.id),
        name: String(client.name || client.email || "Client"),
      }))
      .filter((client) => !term || client.name.toLowerCase().includes(term))
      .slice(0, 20);
  }, [clientsData, searchClient]);

  const selectedClientName = useMemo(() => {
    const found = (clientsData || []).find((client: any) => String(client.id) === newSessionClientId);
    return found?.name || found?.email || null;
  }, [clientsData, newSessionClientId]);

  const openAddSessionModal = () => {
    if (scheduleClientId) {
      setNewSessionClientId(scheduleClientId);
    }
    setScheduleErrors({});
    setShowAddModal(true);
  };

  const getGoogleRedirectUri = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return `${window.location.origin}/calendar`;
    }
    return Linking.createURL("calendar-google-auth");
  };

  const handleConnectGoogleCalendar = async () => {
    const redirectUri = getGoogleRedirectUri();
    const { authUrl } = await getGoogleAuthUrl.mutateAsync({ redirectUri });
    if (Platform.OS === "web") {
      const popup = window.open(authUrl, "google-calendar-auth", "width=500,height=700,popup=yes");
      if (!popup) {
        window.location.assign(authUrl);
        return;
      }
      const timer = setInterval(async () => {
        try {
          if (popup.closed) {
            clearInterval(timer);
            return;
          }
          const popupUrl = popup.location.href;
          if (popupUrl.includes("code=")) {
            clearInterval(timer);
            const url = new URL(popupUrl);
            const code = url.searchParams.get("code");
            popup.close();
            if (code) {
              try {
                await connectGoogleCalendar.mutateAsync({ code, redirectUri });
                await Promise.all([googleStatus.refetch(), googleCalendars.refetch()]);
                Alert.alert("Connected", "Google Calendar connected.");
              } catch (err: any) {
                Alert.alert("Connection failed", err?.message || "Could not connect.");
              }
            }
          }
        } catch {
          // cross-origin — popup still on Google's domain, keep waiting
        }
      }, 500);
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
    if (result.type !== "success" || !result.url) return;
    const callbackUrl = new URL(result.url);
    const code = callbackUrl.searchParams.get("code");
    if (!code) return;
    await connectGoogleCalendar.mutateAsync({ code, redirectUri });
  };

  const openRescheduleModal = (session: Session) => {
    setSelectedSession(session);
    setRescheduleDate(session.date.toISOString().slice(0, 10));
    setRescheduleTime(session.time || "09:00");
    setRescheduleDuration(String(session.duration || 60));
    setRescheduleNote("");
    setShowRescheduleModal(true);
  };

  const handleSuggestReschedule = async () => {
    if (!selectedSession) return;
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(rescheduleTime.trim());
    if (!timeMatch) {
      Alert.alert("Invalid time", "Use 24-hour format HH:MM.");
      return;
    }
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rescheduleDate.trim());
    if (!dateMatch) {
      Alert.alert("Invalid date", "Use date format YYYY-MM-DD.");
      return;
    }
    const durationMinutes = Math.max(15, Math.min(480, Number.parseInt(rescheduleDuration, 10) || 60));
    const proposed = new Date(
      Number.parseInt(dateMatch[1], 10),
      Number.parseInt(dateMatch[2], 10) - 1,
      Number.parseInt(dateMatch[3], 10),
      Number.parseInt(timeMatch[1], 10),
      Number.parseInt(timeMatch[2], 10),
      0,
      0,
    );
    await suggestRescheduleMutation.mutateAsync({
      id: selectedSession.id,
      proposedStartTime: proposed,
      durationMinutes,
      note: rescheduleNote.trim() || undefined,
    });
  };

  const handleScheduleSession = async () => {
    const errors: Record<string, string> = {};

    if (!newSessionClientId) {
      errors.client = "Please select a client";
    }

    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(newSessionTime.trim());
    if (!timeMatch) {
      errors.time = "Use 24-hour format HH:MM (e.g. 09:00)";
    }

    const parsedDuration = Number.parseInt(newSessionDuration, 10);
    if (!parsedDuration || parsedDuration < 15) {
      errors.duration = "Duration must be at least 15 minutes";
    }

    setScheduleErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const durationMinutes = Math.max(15, Math.min(480, parsedDuration || 60));
    const [hours, minutes] = [Number.parseInt(timeMatch![1], 10), Number.parseInt(timeMatch![2], 10)];
    const sessionDate = new Date(selectedDate);
    sessionDate.setHours(hours, minutes, 0, 0);

    try {
      await createSessionMutation.mutateAsync({
        clientId: newSessionClientId!,
        sessionDate,
        durationMinutes,
        sessionType: newSessionType,
        location: newSessionLocation.trim() || undefined,
        notes: newSessionNotes.trim() || undefined,
      });
    } catch {
      // Error alert handled in mutation onError callback.
    }
  };

  return (
    <ScreenContainer className="flex-1" edges={["left", "right"]}>
      {/* Navigation Header */}
      <NavigationHeader title="Calendar" />

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

      <View className="px-4 mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center">
          {googleStatus.data?.connected ? (
            <>
              <View className="w-2 h-2 rounded-full bg-success mr-2" />
              <Text className="text-xs text-muted">
                Syncing to {googleStatus.data.selectedCalendarName || "Google Calendar"}
              </Text>
            </>
          ) : (
            <TouchableOpacity onPress={handleConnectGoogleCalendar} className="flex-row items-center">
              <IconSymbol name="link" size={14} color={colors.primary} />
              <Text className="text-xs text-primary font-medium ml-1">Connect Google Calendar</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setShowCalendarSettings(!showCalendarSettings)}
          className="w-8 h-8 rounded-full bg-surface items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Calendar settings"
          testID="calendar-settings-toggle"
        >
          <IconSymbol name="gearshape.fill" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {showCalendarSettings && (
        <View className="px-4 mb-3">
          <View className="bg-surface rounded-xl border border-border p-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-foreground">Google Calendar</Text>
              {googleStatus.data?.connected ? (
                <TouchableOpacity
                  onPress={() => disconnectGoogleCalendar.mutate()}
                  accessibilityRole="button"
                  accessibilityLabel="Disconnect Google Calendar"
                  testID="calendar-google-disconnect"
                >
                  <Text className="text-xs text-error font-semibold">Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleConnectGoogleCalendar}
                  accessibilityRole="button"
                  accessibilityLabel="Connect Google Calendar"
                  testID="calendar-google-connect"
                >
                  <Text className="text-xs text-primary font-semibold">Connect</Text>
                </TouchableOpacity>
              )}
            </View>
            {googleStatus.data?.connected && googleCalendars.data?.calendars?.length ? (
              <View>
                <Text className="text-xs text-muted mb-1">Sync calendar</Text>
                <View className="flex-row flex-wrap gap-2">
                  {googleCalendars.data.calendars.slice(0, 8).map((calendar) => {
                    const active = googleCalendars.data?.selectedCalendarId === calendar.id;
                    return (
                      <TouchableOpacity
                        key={calendar.id}
                        onPress={() =>
                          selectGoogleCalendar.mutate({
                            calendarId: calendar.id,
                            calendarName: calendar.summary,
                          })
                        }
                        className={`px-3 py-1.5 rounded-full border ${active ? "bg-primary border-primary" : "bg-background border-border"}`}
                      >
                        <Text className={active ? "text-white text-xs font-medium" : "text-foreground text-xs"}>
                          {calendar.summary}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : !googleStatus.data?.connected ? (
              <Text className="text-xs text-muted">
                Connect Google Calendar to auto-sync sessions.
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {isWideScreen ? (
        <View className="flex-1 flex-row px-4 pb-3">
          <View className="rounded-xl border border-border bg-surface p-4 mr-4" style={{ width: "58%", maxWidth: 760 }}>
            <View className="flex-row mb-2">
              {DAYS.map((day) => (
                <View key={day} className="flex-1 items-center">
                  <Text className="text-xs text-muted font-medium">{day}</Text>
                </View>
              ))}
            </View>
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
                        : ""
                    }`}
                    style={!isSelected(day.date) && isToday(day.date) ? { borderWidth: 2, borderColor: colors.primary } : undefined}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected(day.date)
                          ? "text-white font-bold"
                          : isToday(day.date)
                          ? "text-primary font-bold"
                          : day.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted"
                      }`}
                    >
                      {day.date.getDate()}
                    </Text>
                    {day.hasEvents && !isSelected(day.date) && (
                      <View className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-success" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-1 rounded-xl border border-border bg-surface p-4">
            <Text className="text-base font-semibold text-foreground mb-3">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
              {isLoading ? (
                <View className="items-center py-12">
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : selectedDateSessions.length === 0 ? (
                <View className="bg-background rounded-xl p-6 items-center">
                  <IconSymbol name="calendar" size={32} color={colors.muted} />
                  <Text className="text-muted mt-2">No sessions scheduled</Text>
                  <TouchableOpacity onPress={openAddSessionModal} className="mt-3 px-4 py-2 border border-border rounded-lg">
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
                    className="bg-background rounded-xl p-4 mb-3 border border-border"
                  >
                    <View className="flex-row items-start">
                      <View className="w-16">
                        <Text className="text-lg font-bold text-foreground">{session.time}</Text>
                        <Text className="text-xs text-muted">{session.duration}min</Text>
                      </View>
                      <View className="w-1 h-full rounded-full mr-3" style={{ backgroundColor: getStatusColor(session.status) }} />
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">{session.clientName}</Text>
                        <Text className="text-sm text-muted">{session.bundleTitle}</Text>
                        <View className="flex-row items-center mt-1">
                          <View className="px-2 py-0.5 rounded" style={{ backgroundColor: `${getStatusColor(session.status)}20` }}>
                            <Text className="text-xs font-medium" style={{ color: getStatusColor(session.status) }}>
                              {getTypeLabel(session.type)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <IconSymbol name="chevron.right" size={20} color={colors.muted} />
                    </View>
                  </TouchableOpacity>
                ))
              )}
              <View className="h-16" />
            </ScrollView>
          </View>
        </View>
      ) : (
        <>
          {/* Compact Calendar Grid — fixed at top */}
          <View className="px-4 pb-2 border-b border-border">
            <View className="flex-row mb-1">
              {DAYS.map((day) => (
                <View key={day} className="flex-1 items-center">
                  <Text className="text-xs text-muted font-medium">{day}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {calendarData.map((day, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedDate(day.date)}
                  className="w-[14.28%] items-center justify-center"
                  style={{ paddingVertical: 4 }}
                >
                  <View
                    className={`w-9 h-9 rounded-full items-center justify-center ${
                      isSelected(day.date) ? "bg-primary" : ""
                    }`}
                    style={!isSelected(day.date) && isToday(day.date) ? { borderWidth: 2, borderColor: colors.primary } : undefined}
                  >
                    <Text
                      className={`text-sm ${
                        isSelected(day.date)
                          ? "text-white font-bold"
                          : isToday(day.date)
                          ? "text-primary font-bold"
                          : day.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted"
                      }`}
                    >
                      {day.date.getDate()}
                    </Text>
                  </View>
                  {day.hasEvents && (
                    <View className="w-1.5 h-1.5 rounded-full bg-success mt-0.5" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Selected Date Header */}
          <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-foreground">
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </Text>
            <TouchableOpacity
              onPress={openAddSessionModal}
              className="bg-primary px-3 py-1.5 rounded-full"
            >
              <Text className="text-white text-xs font-semibold">+ Add</Text>
            </TouchableOpacity>
          </View>

          {/* Sessions list — scrollable, fills remaining space */}
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {isLoading ? (
              <View className="items-center py-12">
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : selectedDateSessions.length === 0 ? (
              <View className="bg-surface rounded-xl p-6 items-center mt-2">
                <IconSymbol name="calendar" size={32} color={colors.muted} />
                <Text className="text-muted mt-2">No sessions on this day</Text>
              </View>
            ) : (
              selectedDateSessions.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  onPress={() => {
                    setSelectedSession(session);
                    setShowSessionModal(true);
                  }}
                  className="bg-surface rounded-xl p-4 mb-2 border border-border"
                >
                  <View className="flex-row items-center">
                    <View style={{ width: 4, height: 40, borderRadius: 2, backgroundColor: getStatusColor(session.status), marginRight: 12 }} />
                    <View className="flex-1">
                      <Text className="text-foreground font-semibold">{session.clientName}</Text>
                      <Text className="text-xs text-muted mt-0.5">
                        {session.time} · {session.duration}min · {getTypeLabel(session.type)}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </>
      )}

      {/* Session Detail Modal */}
      <Modal
        visible={showSessionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSessionModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: overlayColor }}>
          <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowSessionModal(false)} />
          <SwipeDownSheet
            visible={showSessionModal}
            onClose={() => setShowSessionModal(false)}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 }}
          >
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
                      onPress={() => openRescheduleModal(selectedSession)}
                      className="bg-primary/15 py-4 rounded-xl items-center border border-primary/40"
                    >
                      <Text className="text-primary font-semibold">Suggest Reschedule</Text>
                    </TouchableOpacity>
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
          </SwipeDownSheet>
        </View>
      </Modal>

      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: overlayColor }}>
          <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowRescheduleModal(false)} />
          <SwipeDownSheet
            visible={showRescheduleModal}
            onClose={() => setShowRescheduleModal(false)}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 }}
          >
            <Text className="text-xl font-bold text-foreground mb-4">Suggest Appointment Move</Text>
            <Text className="text-sm text-muted mb-2">Date (YYYY-MM-DD)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
              value={rescheduleDate}
              onChangeText={setRescheduleDate}
              placeholder="2026-02-15"
              placeholderTextColor={colors.muted}
            />
            <Text className="text-sm text-muted mb-2">Time (HH:MM)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
              value={rescheduleTime}
              onChangeText={setRescheduleTime}
              placeholder="09:00"
              placeholderTextColor={colors.muted}
            />
            <Text className="text-sm text-muted mb-2">Duration (minutes)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
              value={rescheduleDuration}
              onChangeText={setRescheduleDuration}
              keyboardType="number-pad"
              placeholder="60"
              placeholderTextColor={colors.muted}
            />
            <Text className="text-sm text-muted mb-2">Message (optional)</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-4"
              value={rescheduleNote}
              onChangeText={setRescheduleNote}
              placeholder="Can we move this by an hour?"
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={3}
              style={{ minHeight: 88, textAlignVertical: "top" }}
            />
            <TouchableOpacity
              onPress={handleSuggestReschedule}
              className="bg-primary py-4 rounded-xl items-center"
              disabled={suggestRescheduleMutation.isPending}
            >
              <Text className="text-white font-semibold">
                {suggestRescheduleMutation.isPending ? "Sending..." : "Send Suggestion"}
              </Text>
            </TouchableOpacity>
          </SwipeDownSheet>
        </View>
      </Modal>

      {/* Add Session Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: overlayColor }}>
          <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowAddModal(false)} />
          <SwipeDownSheet
            visible={showAddModal}
            onClose={() => setShowAddModal(false)}
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 }}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-foreground">Schedule Session</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Date</Text>
                <View className="bg-surface border border-border rounded-xl px-4 py-3">
                  <Text className="text-foreground">
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Client *</Text>
                {selectedClientName && (
                  <View className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 mb-2">
                    <Text className="text-primary font-medium">Selected: {selectedClientName}</Text>
                  </View>
                )}
                {scheduleErrors.client && !newSessionClientId && (
                  <Text className="text-error text-xs mb-1">{scheduleErrors.client}</Text>
                )}
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-foreground mb-2 ${scheduleErrors.client && !newSessionClientId ? "border-error" : "border-border"}`}
                  placeholder="Search clients..."
                  placeholderTextColor={colors.muted}
                  value={searchClient}
                  onChangeText={setSearchClient}
                />

                {clientsLoading ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  <View className="gap-2">
                    {clientOptions.length === 0 ? (
                      <View className="bg-surface border border-border rounded-xl px-4 py-3">
                        <Text className="text-muted text-sm">No matching clients</Text>
                      </View>
                    ) : (
                      clientOptions.map((client) => (
                        <TouchableOpacity
                          key={client.id}
                          onPress={() => { setNewSessionClientId(client.id); setScheduleErrors((prev) => { const { client: _, ...rest } = prev; return rest; }); }}
                          className={`rounded-xl px-4 py-3 border ${
                            newSessionClientId === client.id
                              ? "border-primary bg-primary/10"
                              : "border-border bg-surface"
                          }`}
                        >
                          <Text className={newSessionClientId === client.id ? "text-primary font-medium" : "text-foreground"}>
                            {client.name}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Time (HH:MM)</Text>
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-foreground ${scheduleErrors.time ? "border-error" : "border-border"}`}
                  placeholder="09:00"
                  placeholderTextColor={colors.muted}
                  value={newSessionTime}
                  onChangeText={(v) => { setNewSessionTime(v); setScheduleErrors((prev) => { const { time: _, ...rest } = prev; return rest; }); }}
                  keyboardType="numbers-and-punctuation"
                />
                {scheduleErrors.time && <Text className="text-error text-xs mt-1">{scheduleErrors.time}</Text>}
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Duration (minutes)</Text>
                <TextInput
                  className={`bg-surface border rounded-xl px-4 py-3 text-foreground ${scheduleErrors.duration ? "border-error" : "border-border"}`}
                  placeholder="60"
                  placeholderTextColor={colors.muted}
                  value={newSessionDuration}
                  onChangeText={(v) => { setNewSessionDuration(v); setScheduleErrors((prev) => { const { duration: _, ...rest } = prev; return rest; }); }}
                  keyboardType="number-pad"
                />
                {scheduleErrors.duration && <Text className="text-error text-xs mt-1">{scheduleErrors.duration}</Text>}
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Session Type</Text>
                <View className="flex-row flex-wrap gap-2">
                  {SESSION_TYPE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setNewSessionType(option.value)}
                      className={`px-3 py-2 rounded-full border ${
                        newSessionType === option.value
                          ? "bg-primary border-primary"
                          : "bg-surface border-border"
                      }`}
                    >
                      <Text className={newSessionType === option.value ? "text-white font-medium" : "text-foreground"}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-foreground mb-2">Location (optional)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Gym floor, Zoom, etc."
                  placeholderTextColor={colors.muted}
                  value={newSessionLocation}
                  onChangeText={setNewSessionLocation}
                />
              </View>

              <View className="mb-5">
                <Text className="text-sm font-medium text-foreground mb-2">Notes (optional)</Text>
                <TextInput
                  className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
                  placeholder="Any notes for this session..."
                  placeholderTextColor={colors.muted}
                  value={newSessionNotes}
                  onChangeText={setNewSessionNotes}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 90, textAlignVertical: "top" }}
                />
              </View>

              <View className="flex-row gap-3 mb-2">
                <TouchableOpacity
                  onPress={() => setShowAddModal(false)}
                  className="flex-1 bg-surface border border-border py-4 rounded-xl items-center"
                >
                  <Text className="text-foreground font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleScheduleSession}
                  className="flex-1 bg-primary py-4 rounded-xl items-center"
                  disabled={createSessionMutation.isPending}
                >
                  <Text className="text-white font-semibold">
                    {createSessionMutation.isPending ? "Scheduling..." : "Schedule"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SwipeDownSheet>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
