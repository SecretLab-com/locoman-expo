import { ActionButton } from "@/components/action-button";
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
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SESSION_TYPE_OPTIONS = [
  { value: "training" as const, label: "Training" },
  { value: "check_in" as const, label: "Check-In" },
  { value: "call" as const, label: "Call" },
  { value: "plan_review" as const, label: "Plan Review" },
];

type CalendarViewMode = "day" | "week" | "month" | "year";

type Session = {
  id: string;
  clientId?: string;
  clientName?: string;
  bundleId?: string;
  bundleTitle?: string;
  date: Date;
  time: string;
  duration: number;
  type: "session" | "check_in" | "delivery" | string;
  status: "scheduled" | "completed" | "cancelled" | "no_show" | string;
  notes?: string;
};

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getSessionHour(session: Session): number {
  const [h] = session.time.split(":").map(Number);
  return Number.isFinite(h) ? h : 9;
}

function getSessionMinute(session: Session): number {
  const parts = session.time.split(":").map(Number);
  return parts.length >= 2 && Number.isFinite(parts[1]) ? parts[1] : 0;
}

function sessionStartLocal(session: Session): Date {
  const d = new Date(session.date);
  const [h, m] = session.time.split(":").map(Number);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

const WEEK_HOUR_ROW_HEIGHT = 48;
const WEEK_TIME_COL_WIDTH = 48;

type WeekSessionBlockProps = {
  session: Session;
  getStatusColor: (status: Session["status"]) => string;
  onPressById: (sessionId: string) => void;
  /** Long-press starts move mode (scroll view wins over Pan gestures; tap a slot next). */
  onBeginMoveById: (sessionId: string) => void;
  isPendingMove: boolean;
};

function CalendarWeekSessionBlock({
  session,
  getStatusColor,
  onPressById,
  onBeginMoveById,
  isPendingMove,
}: WeekSessionBlockProps) {
  const colors = useColors();
  const sid = session.id;
  const ignoreNextPressRef = useRef(false);

  const chipStyle = {
    backgroundColor: `${getStatusColor(session.status)}18`,
    borderLeftWidth: 3,
    borderLeftColor: getStatusColor(session.status),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 2,
  } as const;

  if (session.status !== "scheduled") {
    return (
      <Pressable
        onPress={() => onPressById(sid)}
        style={chipStyle}
        accessibilityRole="button"
        accessibilityLabel={`${session.clientName} at ${session.time}`}
      >
        <Text className="text-foreground text-[11px] font-medium" numberOfLines={1}>
          {session.clientName}
        </Text>
        <Text className="text-muted text-[10px]">{session.time}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      delayLongPress={450}
      onLongPress={() => {
        ignoreNextPressRef.current = true;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onBeginMoveById(sid);
      }}
      onPress={() => {
        if (ignoreNextPressRef.current) {
          ignoreNextPressRef.current = false;
          return;
        }
        onPressById(sid);
      }}
      style={[chipStyle, isPendingMove ? { borderWidth: 2, borderColor: colors.primary } : undefined]}
      accessibilityRole="button"
      accessibilityLabel={`${session.clientName} at ${session.time}. Long-press to move, then tap a time slot.`}
    >
      <Text className="text-foreground text-[11px] font-medium" numberOfLines={1}>
        {session.clientName}
      </Text>
      <Text className="text-muted text-[10px]">{session.time}</Text>
    </Pressable>
  );
}

export default function CalendarScreen() {
  const colors = useColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ scheduleClientId?: string | string[]; code?: string | string[] }>();
  const scheduleClientId = Array.isArray(params.scheduleClientId)
    ? params.scheduleClientId[0]
    : params.scheduleClientId;
  const colorScheme = useColorScheme();
  const overlayColor = "rgba(0,0,0,0.85)";

  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
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
  const [counterProposeId, setCounterProposeId] = useState<string | null>(null);
  const [counterDate, setCounterDate] = useState("");
  const [counterTime, setCounterTime] = useState("");
  const [counterNote, setCounterNote] = useState("");
  const [showMoveConfirm, setShowMoveConfirm] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ session: Session; proposedStart: Date } | null>(null);
  /** Week view: long-press session → tap target slot (reliable vs ScrollView stealing Pan gestures). */
  const [pendingMoveSessionId, setPendingMoveSessionId] = useState<string | null>(null);

  const timeInputRef = useRef<TextInput>(null);
  const durationInputRef = useRef<TextInput>(null);
  const locationInputRef = useRef<TextInput>(null);
  const notesInputRef = useRef<TextInput>(null);
  const scheduleScrollRef = useRef<ScrollView>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [rescheduleDuration, setRescheduleDuration] = useState("60");
  const [rescheduleNote, setRescheduleNote] = useState("");

  const { data: clientsData = [], isLoading: clientsLoading } = trpc.clients.list.useQuery();
  const { data: sessionsData, isLoading, refetch, isRefetching } = trpc.sessions.list.useQuery();
  const { data: pendingReschedules = [], refetch: refetchReschedules } = trpc.reschedule.pending.useQuery();
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
  const syncFromGoogle = trpc.googleCalendar.syncFromGoogle.useMutation({
    onSuccess: (result) => {
      if (result.updated > 0 || result.cancelled > 0) {
        refetch();
        refetchReschedules();
      }
    },
  });
  const approveReschedule = trpc.reschedule.approve.useMutation({
    onSuccess: () => { refetch(); refetchReschedules(); Alert.alert("Approved", "Session rescheduled."); },
    onError: (err) => Alert.alert("Error", err.message),
  });
  const rejectReschedule = trpc.reschedule.reject.useMutation({
    onSuccess: () => { refetchReschedules(); Alert.alert("Rejected", "Reschedule declined, original time kept."); },
    onError: (err) => Alert.alert("Error", err.message),
  });
  const counterPropose = trpc.reschedule.counterPropose.useMutation({
    onSuccess: () => { refetchReschedules(); setCounterProposeId(null); setCounterDate(""); setCounterTime(""); setCounterNote(""); Alert.alert("Sent", "Counter-proposal sent to client."); },
    onError: (err) => Alert.alert("Error", err.message),
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

  const completeMutation = trpc.sessions.complete.useMutation({
    onSuccess: () => { refetch(); setShowSessionModal(false); },
  });
  const cancelMutation = trpc.sessions.cancel.useMutation({
    onSuccess: () => { refetch(); setShowSessionModal(false); },
  });

  useEffect(() => {
    if (googleStatus.data?.connected && !syncFromGoogle.isPending) {
      syncFromGoogle.mutate();
    }
  }, [googleStatus.data?.connected]);

  useEffect(() => {
    if (viewMode !== "week") setPendingMoveSessionId(null);
  }, [viewMode]);

  const onRefresh = async () => {
    await Promise.all([refetch(), refetchReschedules()]);
    if (googleStatus.data?.connected) {
      syncFromGoogle.mutate();
    }
  };

  const getStatusColor = (status: Session["status"]) => {
    switch (status) {
      case "scheduled": return colors.primary;
      case "completed": return "#22C55E";
      case "cancelled": return colors.muted;
      case "no_show": return "#EF4444";
      default: return colors.muted;
    }
  };

  const getTypeLabel = (type: Session["type"]) => {
    switch (type) {
      case "session": return "Training";
      case "check_in": return "Check-in";
      case "delivery": return "Delivery";
      default: return type;
    }
  };

  const selectedDateSessions = useMemo(() => {
    return sessions.filter((s) => isSameDay(s.date, selectedDate)).sort((a, b) => a.time.localeCompare(b.time));
  }, [sessions, selectedDate]);

  const handleDateSelect = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      // Month grid is anchored to the 1st; week/day use the picked day so navigation stays aligned.
      if (viewMode === "month") {
        setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
      } else {
        setCurrentDate(new Date(date));
      }
    },
    [viewMode],
  );

  const handleSessionPress = useCallback((session: Session) => {
    setSelectedSession(session);
    setShowSessionModal(true);
  }, []);

  const handleSessionPressById = useCallback(
    (sessionId: string) => {
      setPendingMoveSessionId(null);
      const s = sessions.find((x) => x.id === sessionId);
      if (s) {
        setSelectedSession(s);
        setShowSessionModal(true);
      }
    },
    [sessions],
  );

  const handleDragMove = useCallback((session: Session, proposedStart: Date) => {
    setMoveTarget({ session, proposedStart });
    setShowMoveConfirm(true);
  }, []);

  const handleBeginMoveById = useCallback((sessionId: string) => {
    setPendingMoveSessionId(sessionId);
  }, []);

  const handleDropPendingToSlot = useCallback(
    (sessionId: string, day: Date, hour: number) => {
      const session = sessions.find((s) => s.id === sessionId);
      setPendingMoveSessionId(null);
      if (!session || session.status !== "scheduled") return;
      const proposedStart = new Date(day);
      proposedStart.setHours(hour, getSessionMinute(session), 0, 0);
      if (sessionStartLocal(session).getTime() === proposedStart.getTime()) return;
      handleDragMove(session, proposedStart);
    },
    [sessions, handleDragMove],
  );

  const confirmMove = useCallback(async () => {
    if (!moveTarget) return;
    const { session, proposedStart } = moveTarget;
    const proposed = new Date(proposedStart);
    proposed.setSeconds(0, 0);
    try {
      await suggestRescheduleMutation.mutateAsync({
        id: session.id,
        proposedStartTime: proposed,
        durationMinutes: session.duration,
        note: "Moved via calendar",
      });
      setShowMoveConfirm(false);
      setMoveTarget(null);
    } catch {
      setShowMoveConfirm(false);
      setMoveTarget(null);
    }
  }, [moveTarget, suggestRescheduleMutation]);

  // --- Navigation ---
  const goToPrevious = () => {
    const d = new Date(currentDate);
    switch (viewMode) {
      case "day": d.setDate(d.getDate() - 1); setSelectedDate(new Date(d)); break;
      case "week": d.setDate(d.getDate() - 7); setSelectedDate(new Date(d)); break;
      case "month": d.setMonth(d.getMonth() - 1); break;
      case "year": d.setFullYear(d.getFullYear() - 1); break;
    }
    setCurrentDate(d);
  };

  const goToNext = () => {
    const d = new Date(currentDate);
    switch (viewMode) {
      case "day": d.setDate(d.getDate() + 1); setSelectedDate(new Date(d)); break;
      case "week": d.setDate(d.getDate() + 7); setSelectedDate(new Date(d)); break;
      case "month": d.setMonth(d.getMonth() + 1); break;
      case "year": d.setFullYear(d.getFullYear() + 1); break;
    }
    setCurrentDate(d);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const getNavigationTitle = () => {
    switch (viewMode) {
      case "day":
        return selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      case "week": {
        const ws = getWeekStart(currentDate);
        const we = new Date(ws);
        we.setDate(we.getDate() + 6);
        return `${MONTHS_SHORT[ws.getMonth()]} ${ws.getDate()} - ${MONTHS_SHORT[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;
      }
      case "month":
        return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
      case "year":
        return `${currentDate.getFullYear()}`;
    }
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  // --- Calendar data ---
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: { date: Date; isCurrentMonth: boolean; hasEvents: boolean }[] = [];
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false, hasEvents: sessions.some((s) => isSameDay(s.date, date)) });
    }
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true, hasEvents: sessions.some((s) => isSameDay(s.date, date)) });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false, hasEvents: sessions.some((s) => isSameDay(s.date, date)) });
    }
    return days;
  }, [currentDate, sessions]);

  const weekDays = useMemo(() => getWeekDays(getWeekStart(currentDate)), [currentDate]);

  const clientOptions = useMemo(() => {
    const term = searchClient.trim().toLowerCase();
    return (clientsData || [])
      .map((client: any) => ({ id: String(client.id), name: String(client.name || client.email || "Client") }))
      .filter((client) => !term || client.name.toLowerCase().includes(term))
      .slice(0, 20);
  }, [clientsData, searchClient]);

  const selectedClientName = useMemo(() => {
    const found = (clientsData || []).find((client: any) => String(client.id) === newSessionClientId);
    return found?.name || found?.email || null;
  }, [clientsData, newSessionClientId]);

  const openAddSessionModal = () => {
    if (scheduleClientId) setNewSessionClientId(scheduleClientId);
    setScheduleErrors({});
    setShowAddModal(true);
  };

  const handleCompleteSession = (session: Session) => {
    Alert.alert("Complete Session", `Mark session with ${session.clientName} as completed?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Complete", onPress: () => completeMutation.mutate({ id: session.id }) },
    ]);
  };

  const handleCancelSession = (session: Session) => {
    Alert.alert("Cancel Session", `Cancel session with ${session.clientName}?`, [
      { text: "No", style: "cancel" },
      { text: "Yes, Cancel", style: "destructive", onPress: () => cancelMutation.mutate({ id: session.id }) },
    ]);
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
    if (!timeMatch) { Alert.alert("Invalid time", "Use 24-hour format HH:MM."); return; }
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rescheduleDate.trim());
    if (!dateMatch) { Alert.alert("Invalid date", "Use date format YYYY-MM-DD."); return; }
    const durationMinutes = Math.max(15, Math.min(480, Number.parseInt(rescheduleDuration, 10) || 60));
    const proposed = new Date(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3], +timeMatch[1], +timeMatch[2]);
    await suggestRescheduleMutation.mutateAsync({
      id: selectedSession.id,
      proposedStartTime: proposed,
      durationMinutes,
      note: rescheduleNote.trim() || undefined,
    });
  };

  const handleScheduleSession = async () => {
    const errors: Record<string, string> = {};
    if (!newSessionClientId) errors.client = "Please select a client";
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(newSessionTime.trim());
    if (!timeMatch) errors.time = "Use 24-hour format HH:MM (e.g. 09:00)";
    const parsedDuration = Number.parseInt(newSessionDuration, 10);
    if (!parsedDuration || parsedDuration < 15) errors.duration = "Duration must be at least 15 minutes";
    setScheduleErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const durationMinutes = Math.max(15, Math.min(480, parsedDuration || 60));
    const [hours, minutes] = [+timeMatch![1], +timeMatch![2]];
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
    } catch { /* handled by mutation */ }
  };

  const getGoogleRedirectUri = () => {
    if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/calendar`;
    return Linking.createURL("calendar-google-auth");
  };

  const handleConnectGoogleCalendar = async () => {
    const redirectUri = getGoogleRedirectUri();
    const { authUrl } = await getGoogleAuthUrl.mutateAsync({ redirectUri });
    if (Platform.OS === "web") {
      const popup = window.open(authUrl, "google-calendar-auth", "width=500,height=700,popup=yes");
      if (!popup) { window.location.assign(authUrl); return; }
      const timer = setInterval(async () => {
        try {
          if (popup.closed) { clearInterval(timer); return; }
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
        } catch { /* cross-origin */ }
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

  // --- Session event block (shared) ---
  const renderSessionBlock = (session: Session, compact = false) => (
    <TouchableOpacity
      key={session.id}
      onPress={() => handleSessionPress(session)}
      className={compact ? "mb-1" : "bg-surface rounded-xl p-3 mb-2 border border-border"}
      style={compact ? {
        backgroundColor: `${getStatusColor(session.status)}18`,
        borderLeftWidth: 3,
        borderLeftColor: getStatusColor(session.status),
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
        marginBottom: 2,
      } : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${session.clientName} at ${session.time}`}
    >
      {compact ? (
        <View>
          <Text className="text-foreground text-[11px] font-medium" numberOfLines={1}>{session.clientName}</Text>
          <Text className="text-muted text-[10px]">{session.time}</Text>
        </View>
      ) : (
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
      )}
    </TouchableOpacity>
  );

  // ===========================================================================
  // VIEW RENDERERS
  // ===========================================================================

  const renderDayView = () => {
    const daySessions = sessions.filter((s) => isSameDay(s.date, selectedDate));
    return (
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {HOURS.map((hour) => {
          const hourSessions = daySessions.filter((s) => getSessionHour(s) === hour);
          return (
            <TouchableOpacity
              key={hour}
              onPress={() => {
                setNewSessionTime(`${String(hour).padStart(2, "0")}:00`);
                openAddSessionModal();
              }}
              className="flex-row border-b border-border"
              style={{ minHeight: 60 }}
              accessibilityRole="button"
              accessibilityLabel={`${formatHour(hour)} - tap to add session`}
            >
              <View style={{ width: 56, paddingTop: 4 }}>
                <Text className="text-[11px] text-muted text-right pr-2">{formatHour(hour)}</Text>
              </View>
              <View className="flex-1 py-1 px-2">
                {hourSessions.map((session) => renderSessionBlock(session, false))}
              </View>
            </TouchableOpacity>
          );
        })}
        <View className="h-24" />
      </ScrollView>
    );
  };

  const renderWeekView = () => {
    const days = weekDays;
    return (
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {pendingMoveSessionId ? (
          <View className="bg-primary/15 border-b border-primary/40 px-4 py-3 flex-row items-center gap-3">
            <Text className="text-foreground text-sm flex-1">
              Tap the time slot where this session should go, or cancel.
            </Text>
            <TouchableOpacity
              onPress={() => setPendingMoveSessionId(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel move"
            >
              <Text className="text-primary font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <View className="flex-row border-b border-border">
          <View style={{ width: WEEK_TIME_COL_WIDTH }} />
          {days.map((day, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => handleDateSelect(day)}
              className="flex-1 items-center py-2"
              accessibilityRole="button"
              accessibilityLabel={`Go to ${DAYS_FULL[day.getDay()]}`}
            >
              <Text className="text-[10px] text-muted">{DAYS[day.getDay()]}</Text>
              <View
                className={`w-7 h-7 rounded-full items-center justify-center mt-0.5 ${isSameDay(day, selectedDate) ? "bg-primary" : ""}`}
                style={!isSameDay(day, selectedDate) && isToday(day) ? { borderWidth: 2, borderColor: colors.primary } : undefined}
              >
                <Text className={`text-xs font-medium ${isSameDay(day, selectedDate) ? "text-white" : isToday(day) ? "text-primary" : "text-foreground"}`}>
                  {day.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        {HOURS.map((hour) => (
          <View key={hour} className="flex-row border-b border-border" style={{ minHeight: WEEK_HOUR_ROW_HEIGHT }}>
            <View style={{ width: WEEK_TIME_COL_WIDTH, paddingTop: 2 }}>
              <Text className="text-[10px] text-muted text-right pr-1">{formatHour(hour)}</Text>
            </View>
            {days.map((day, i) => {
              const hourSessions = sessions.filter((s) => isSameDay(s.date, day) && getSessionHour(s) === hour);
              return (
                <View
                  key={i}
                  className="flex-1 border-l border-border px-0.5 py-0.5"
                  style={{ minHeight: WEEK_HOUR_ROW_HEIGHT }}
                >
                  <Pressable
                    style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}
                    onPress={() => {
                      if (pendingMoveSessionId) {
                        handleDropPendingToSlot(pendingMoveSessionId, day, hour);
                        return;
                      }
                      handleDateSelect(day);
                      setNewSessionTime(`${String(hour).padStart(2, "0")}:00`);
                      openAddSessionModal();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      pendingMoveSessionId
                        ? `Move session to ${DAYS[day.getDay()]} ${formatHour(hour)}`
                        : `${DAYS[day.getDay()]} ${formatHour(hour)} — add session`
                    }
                  />
                  <View className="relative" style={{ zIndex: 1 }} pointerEvents="box-none">
                    {hourSessions.map((session) => (
                      <CalendarWeekSessionBlock
                        key={session.id}
                        session={session}
                        getStatusColor={getStatusColor}
                        onPressById={handleSessionPressById}
                        onBeginMoveById={handleBeginMoveById}
                        isPendingMove={pendingMoveSessionId === session.id}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
        <View className="h-24" />
      </ScrollView>
    );
  };

  const renderMonthView = () => (
    <View className="flex-1">
      <View className="flex-row mb-1 px-2">
        {DAYS.map((day) => (
          <View key={day} className="flex-1 items-center">
            <Text className="text-xs text-muted font-medium">{day}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap px-2">
        {monthDays.map((day, index) => {
          const daySessions = sessions.filter((s) => isSameDay(s.date, day.date));
          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleDateSelect(day.date)}
              className="w-[14.28%] items-center"
              style={{ paddingVertical: 2, minHeight: 52 }}
              accessibilityRole="button"
              accessibilityLabel={`${day.date.toDateString()}`}
            >
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${isSameDay(day.date, selectedDate) ? "bg-primary" : ""}`}
                style={!isSameDay(day.date, selectedDate) && isToday(day.date) ? { borderWidth: 2, borderColor: colors.primary } : undefined}
              >
                <Text
                  className={`text-sm ${
                    isSameDay(day.date, selectedDate) ? "text-white font-bold"
                    : isToday(day.date) ? "text-primary font-bold"
                    : day.isCurrentMonth ? "text-foreground" : "text-muted"
                  }`}
                >
                  {day.date.getDate()}
                </Text>
              </View>
              {daySessions.length > 0 && (
                <View className="flex-row gap-0.5 mt-0.5">
                  {daySessions.slice(0, 3).map((s) => (
                    <View key={s.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getStatusColor(s.status) }} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View className="flex-1 px-4 pt-2">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-base font-semibold text-foreground">
            {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
          <TouchableOpacity onPress={openAddSessionModal} className="bg-primary px-3 py-1.5 rounded-full" accessibilityRole="button" accessibilityLabel="Add session">
            <Text className="text-white text-xs font-semibold">+ Add</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {isLoading ? (
            <View className="items-center py-12"><ActivityIndicator size="large" color={colors.primary} /></View>
          ) : selectedDateSessions.length === 0 ? (
            <View className="bg-surface rounded-xl p-6 items-center mt-2">
              <IconSymbol name="calendar" size={32} color={colors.muted} />
              <Text className="text-muted mt-2">No sessions on this day</Text>
            </View>
          ) : (
            selectedDateSessions.map((session) => renderSessionBlock(session, false))
          )}
          <View className="h-16" />
        </ScrollView>
      </View>
    </View>
  );

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    return (
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {Array.from({ length: 12 }, (_, monthIdx) => {
          const firstDay = new Date(year, monthIdx, 1);
          const lastDay = new Date(year, monthIdx + 1, 0);
          const startPadding = firstDay.getDay();
          const totalDays = lastDay.getDate();
          const monthSessions = sessions.filter((s) => s.date.getFullYear() === year && s.date.getMonth() === monthIdx);
          const eventDays = new Set(monthSessions.map((s) => s.date.getDate()));
          const isCurrentMonth = new Date().getFullYear() === year && new Date().getMonth() === monthIdx;

          return (
            <TouchableOpacity
              key={monthIdx}
              onPress={() => { setCurrentDate(new Date(year, monthIdx, 1)); setViewMode("month"); }}
              className="rounded-xl border border-border bg-surface p-3 mb-3"
              accessibilityRole="button"
              accessibilityLabel={`Go to ${MONTHS[monthIdx]}`}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className={`text-sm font-semibold ${isCurrentMonth ? "text-primary" : "text-foreground"}`}>
                  {MONTHS[monthIdx]}
                </Text>
                {monthSessions.length > 0 && (
                  <Text className="text-xs text-muted">{monthSessions.length} session{monthSessions.length === 1 ? "" : "s"}</Text>
                )}
              </View>
              <View className="flex-row mb-1">
                {DAYS.map((day) => (
                  <View key={day} style={{ width: "14.28%", alignItems: "center" }}>
                    <Text style={{ fontSize: 9, color: colors.muted, fontWeight: "500" }}>{day}</Text>
                  </View>
                ))}
              </View>
              <View className="flex-row flex-wrap">
                {Array.from({ length: startPadding }, (_, i) => (
                  <View key={`pad-${i}`} style={{ width: "14.28%", height: 22 }} />
                ))}
                {Array.from({ length: totalDays }, (_, i) => {
                  const dayNum = i + 1;
                  const todayMatch = isCurrentMonth && new Date().getDate() === dayNum;
                  const hasEvent = eventDays.has(dayNum);
                  return (
                    <View key={dayNum} style={{ width: "14.28%", height: 22, alignItems: "center", justifyContent: "center" }}>
                      <View style={{
                        width: 20, height: 20, borderRadius: 10,
                        backgroundColor: hasEvent ? `${colors.primary}30` : "transparent",
                        borderWidth: todayMatch ? 1.5 : 0,
                        borderColor: colors.primary,
                        alignItems: "center", justifyContent: "center",
                      }}>
                        <Text style={{ fontSize: 9, fontWeight: hasEvent || todayMatch ? "600" : "400", color: hasEvent ? colors.primary : todayMatch ? colors.primary : colors.muted }}>
                          {dayNum}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </TouchableOpacity>
          );
        })}
        <View className="h-24" />
      </ScrollView>
    );
  };

  // ===========================================================================
  // MAIN RENDER
  // ===========================================================================

  return (
    <ScreenContainer className="flex-1" edges={["left", "right"]}>
      <NavigationHeader title="Calendar" />

      {/* View mode switcher */}
      <View className="flex-row mx-4 mb-2 rounded-xl bg-surface border border-border overflow-hidden">
        {(["day", "week", "month", "year"] as CalendarViewMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            onPress={() => setViewMode(mode)}
            className={`flex-1 py-2 items-center ${viewMode === mode ? "bg-primary" : ""}`}
            accessibilityRole="button"
            accessibilityLabel={`${mode} view`}
            testID={`calendar-view-${mode}`}
          >
            <Text className={`text-xs font-semibold capitalize ${viewMode === mode ? "text-white" : "text-muted"}`}>
              {mode}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Navigation bar */}
      <View className="flex-row items-center justify-between px-4 mb-2">
        <TouchableOpacity
          onPress={goToPrevious}
          className="w-9 h-9 rounded-full bg-surface items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Previous"
        >
          <IconSymbol name="chevron.left" size={18} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToToday} className="flex-row items-center gap-1" accessibilityRole="button" accessibilityLabel="Go to today">
          <Text className="text-base font-semibold text-foreground">{getNavigationTitle()}</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-2">
          {!isToday(selectedDate) && (
            <TouchableOpacity onPress={goToToday} className="px-2 py-1 rounded-full border border-primary" accessibilityRole="button" accessibilityLabel="Go to today">
              <Text className="text-primary text-xs font-semibold">Today</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={goToNext}
            className="w-9 h-9 rounded-full bg-surface items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Next"
          >
            <IconSymbol name="chevron.right" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Google Calendar status */}
      <View className="px-4 mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          {googleStatus.data?.connected ? (
            <>
              <View className="w-2 h-2 rounded-full bg-success mr-2" />
              <Text className="text-xs text-muted">Syncing to {googleStatus.data.selectedCalendarName || "Google Calendar"}</Text>
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
                <TouchableOpacity onPress={() => disconnectGoogleCalendar.mutate()} accessibilityRole="button" accessibilityLabel="Disconnect Google Calendar" testID="calendar-google-disconnect">
                  <Text className="text-xs text-error font-semibold">Disconnect</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={handleConnectGoogleCalendar} accessibilityRole="button" accessibilityLabel="Connect Google Calendar" testID="calendar-google-connect">
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
                        onPress={() => selectGoogleCalendar.mutate({ calendarId: calendar.id, calendarName: calendar.summary })}
                        className={`px-3 py-1.5 rounded-full border ${active ? "bg-primary border-primary" : "bg-background border-border"}`}
                      >
                        <Text className={active ? "text-white text-xs font-medium" : "text-foreground text-xs"}>{calendar.summary}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : !googleStatus.data?.connected ? (
              <Text className="text-xs text-muted">Connect Google Calendar to auto-sync sessions.</Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Pending reschedule alerts */}
      {(pendingReschedules as any[]).length > 0 && (
        <View className="px-4 mb-2">
          {(pendingReschedules as any[]).map((req: any) => {
            const oldTime = new Date(req.originalDate).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
            const newTime = new Date(req.proposedDate).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
            return (
              <View key={req.id} className="bg-warning/10 border border-warning/30 rounded-xl p-3 mb-2">
                <Text className="text-foreground text-sm font-semibold mb-1">Reschedule Request</Text>
                <Text className="text-muted text-xs mb-2">
                  {oldTime} → {newTime}
                  {req.source === "google_calendar" ? " (from Google Calendar)" : ""}
                </Text>
                <View className="flex-row gap-2">
                  <ActionButton className="flex-1 bg-success py-2 rounded-lg" onPress={() => approveReschedule.mutate({ id: req.id })} loading={approveReschedule.isPending} variant="primary" size="sm" accessibilityLabel="Approve reschedule">Approve</ActionButton>
                  <ActionButton className="flex-1 bg-error py-2 rounded-lg" onPress={() => rejectReschedule.mutate({ id: req.id })} loading={rejectReschedule.isPending} variant="danger" size="sm" accessibilityLabel="Reject reschedule">Reject</ActionButton>
                  <ActionButton
                    className="flex-1 bg-primary py-2 rounded-lg"
                    variant="primary" size="sm"
                    onPress={() => {
                      setCounterProposeId(counterProposeId === req.id ? null : req.id);
                      const d = new Date(req.proposedDate);
                      setCounterDate(d.toISOString().slice(0, 10));
                      setCounterTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
                      setCounterNote("");
                    }}
                    accessibilityLabel="Suggest alternative time"
                  >Suggest</ActionButton>
                </View>
                {counterProposeId === req.id && (
                  <View className="mt-3 pt-3 border-t border-warning/20">
                    <Text className="text-foreground text-xs font-semibold mb-2">Suggest another time</Text>
                    <View className="flex-row gap-2 mb-2">
                      <TextInput className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-xs" placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} value={counterDate} onChangeText={setCounterDate} />
                      <TextInput className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-xs" placeholder="HH:MM" placeholderTextColor={colors.muted} value={counterTime} onChangeText={setCounterTime} />
                    </View>
                    <TextInput className="bg-surface border border-border rounded-lg px-3 py-2 text-foreground text-xs mb-2" placeholder="Note (optional)" placeholderTextColor={colors.muted} value={counterNote} onChangeText={setCounterNote} />
                    <ActionButton className="bg-primary py-2 rounded-lg" loading={counterPropose.isPending} loadingText="Sending..." variant="primary" size="sm"
                      onPress={() => {
                        const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(counterDate.trim());
                        const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(counterTime.trim());
                        if (!dateMatch || !timeMatch) { Alert.alert("Invalid", "Use YYYY-MM-DD and HH:MM format."); return; }
                        const proposed = new Date(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3], +timeMatch[1], +timeMatch[2]);
                        counterPropose.mutate({ id: req.id, counterDate: proposed, note: counterNote.trim() || undefined });
                      }}
                      accessibilityLabel="Send counter-proposal"
                    >Send Counter-Proposal</ActionButton>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Calendar view body */}
      {viewMode === "day" && renderDayView()}
      {viewMode === "week" && renderWeekView()}
      {viewMode === "month" && renderMonthView()}
      {viewMode === "year" && renderYearView()}

      {/* FAB for adding session (day/week views) */}
      {(viewMode === "day" || viewMode === "week") && (
        <TouchableOpacity
          onPress={openAddSessionModal}
          className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
          style={{ right: 16, bottom: 16 }}
          accessibilityRole="button"
          accessibilityLabel="Add session"
          testID="calendar-add-fab"
        >
          <IconSymbol name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Move confirmation dialog */}
      <Modal visible={showMoveConfirm} transparent animationType="fade" onRequestClose={() => setShowMoveConfirm(false)}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: overlayColor }}>
          <View className="bg-surface rounded-2xl p-6 mx-6" style={{ maxWidth: 400, width: "90%" }}>
            <Text className="text-lg font-bold text-foreground mb-2">Move this session?</Text>
            {moveTarget && (
              <View className="mb-4">
                <Text className="text-muted">
                  {moveTarget.session.clientName} · {moveTarget.session.time} · {moveTarget.session.duration}min
                </Text>
                <Text className="text-muted mt-1">
                  From: {moveTarget.session.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </Text>
                <Text className="text-primary font-semibold mt-1">
                  To:{" "}
                  {moveTarget.proposedStart.toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            )}
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => { setShowMoveConfirm(false); setMoveTarget(null); }} className="flex-1 bg-surface border border-border py-3 rounded-xl items-center">
                <Text className="text-foreground font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmMove} className="flex-1 bg-primary py-3 rounded-xl items-center" disabled={suggestRescheduleMutation.isPending}>
                <Text className="text-white font-semibold">{suggestRescheduleMutation.isPending ? "Moving..." : "Move Session"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Session Detail Modal */}
      <Modal visible={showSessionModal} transparent animationType="slide" onRequestClose={() => setShowSessionModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: overlayColor }}>
          <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowSessionModal(false)} />
          <SwipeDownSheet visible={showSessionModal} onClose={() => setShowSessionModal(false)} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 }}>
            {selectedSession && (
              <>
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-xl font-bold text-foreground">Session Details</Text>
                  <TouchableOpacity onPress={() => setShowSessionModal(false)}><IconSymbol name="xmark" size={24} color={colors.muted} /></TouchableOpacity>
                </View>
                <View className="bg-surface rounded-xl p-4 mb-4">
                  <Text className="text-lg font-semibold text-foreground">{selectedSession.clientName}</Text>
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
                    <TouchableOpacity onPress={() => openRescheduleModal(selectedSession)} className="bg-primary/15 py-4 rounded-xl items-center border border-primary/40">
                      <Text className="text-primary font-semibold">Suggest Reschedule</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleCompleteSession(selectedSession)} className="bg-success py-4 rounded-xl items-center">
                      <Text className="text-white font-semibold">Mark as Completed</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleCancelSession(selectedSession)} className="bg-surface py-4 rounded-xl items-center border border-border">
                      <Text className="text-error font-semibold">Cancel Session</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity onPress={() => setShowSessionModal(false)} className="py-3 mt-3">
                  <Text className="text-center text-muted">Close</Text>
                </TouchableOpacity>
              </>
            )}
          </SwipeDownSheet>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal visible={showRescheduleModal} transparent animationType="slide" onRequestClose={() => setShowRescheduleModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: overlayColor }}>
          <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowRescheduleModal(false)} />
          <SwipeDownSheet visible={showRescheduleModal} onClose={() => setShowRescheduleModal(false)} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 }}>
            <Text className="text-xl font-bold text-foreground mb-4">Suggest Appointment Move</Text>
            <Text className="text-sm text-muted mb-2">Date (YYYY-MM-DD)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3" value={rescheduleDate} onChangeText={setRescheduleDate} placeholder="2026-02-15" placeholderTextColor={colors.muted} />
            <Text className="text-sm text-muted mb-2">Time (HH:MM)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3" value={rescheduleTime} onChangeText={setRescheduleTime} placeholder="09:00" placeholderTextColor={colors.muted} />
            <Text className="text-sm text-muted mb-2">Duration (minutes)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3" value={rescheduleDuration} onChangeText={setRescheduleDuration} keyboardType="number-pad" placeholder="60" placeholderTextColor={colors.muted} />
            <Text className="text-sm text-muted mb-2">Message (optional)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-4" value={rescheduleNote} onChangeText={setRescheduleNote} placeholder="Can we move this by an hour?" placeholderTextColor={colors.muted} multiline numberOfLines={3} style={{ minHeight: 88, textAlignVertical: "top" }} />
            <TouchableOpacity onPress={handleSuggestReschedule} className="bg-primary py-4 rounded-xl items-center" disabled={suggestRescheduleMutation.isPending}>
              <Text className="text-white font-semibold">{suggestRescheduleMutation.isPending ? "Sending..." : "Send Suggestion"}</Text>
            </TouchableOpacity>
          </SwipeDownSheet>
        </View>
      </Modal>

      {/* Add Session Modal */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: overlayColor }}>
            <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowAddModal(false)} />
            <SwipeDownSheet visible={showAddModal} onClose={() => setShowAddModal(false)} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingHorizontal: 24 }}>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-foreground">Schedule Session</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}><IconSymbol name="xmark" size={24} color={colors.muted} /></TouchableOpacity>
              </View>
              <ScrollView ref={scheduleScrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Date</Text>
                  <View className="bg-surface border border-border rounded-xl px-4 py-3">
                    <Text className="text-foreground">{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</Text>
                  </View>
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Client *</Text>
                  {selectedClientName && (
                    <View className="bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 mb-2">
                      <Text className="text-primary font-medium">Selected: {selectedClientName}</Text>
                    </View>
                  )}
                  {scheduleErrors.client && !newSessionClientId && <Text className="text-error text-xs mb-1">{scheduleErrors.client}</Text>}
                  <TextInput
                    className={`bg-surface border rounded-xl px-4 py-3 text-foreground mb-2 ${scheduleErrors.client && !newSessionClientId ? "border-error" : "border-border"}`}
                    placeholder="Search clients..." placeholderTextColor={colors.muted} value={searchClient} onChangeText={setSearchClient}
                  />
                  {clientsLoading ? (
                    <View className="py-4 items-center"><ActivityIndicator color={colors.primary} /></View>
                  ) : (
                    <View className="gap-2">
                      {clientOptions.length === 0 ? (
                        <View className="bg-surface border border-border rounded-xl px-4 py-3"><Text className="text-muted text-sm">No matching clients</Text></View>
                      ) : clientOptions.map((client) => (
                        <TouchableOpacity
                          key={client.id}
                          onPress={() => { setNewSessionClientId(client.id); setScheduleErrors((prev) => { const { client: _, ...rest } = prev; return rest; }); }}
                          className={`rounded-xl px-4 py-3 border ${newSessionClientId === client.id ? "border-primary bg-primary/10" : "border-border bg-surface"}`}
                        >
                          <Text className={newSessionClientId === client.id ? "text-primary font-medium" : "text-foreground"}>{client.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Time (HH:MM)</Text>
                  <TextInput
                    ref={timeInputRef}
                    className={`bg-surface border rounded-xl px-4 py-3 text-foreground ${scheduleErrors.time ? "border-error" : "border-border"}`}
                    placeholder="09:00" placeholderTextColor={colors.muted} value={newSessionTime}
                    onChangeText={(v) => { setNewSessionTime(v); setScheduleErrors((prev) => { const { time: _, ...rest } = prev; return rest; }); }}
                    keyboardType="numbers-and-punctuation" returnKeyType="next" onSubmitEditing={() => durationInputRef.current?.focus()}
                  />
                  {scheduleErrors.time && <Text className="text-error text-xs mt-1">{scheduleErrors.time}</Text>}
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Duration (minutes)</Text>
                  <TextInput
                    ref={durationInputRef}
                    className={`bg-surface border rounded-xl px-4 py-3 text-foreground ${scheduleErrors.duration ? "border-error" : "border-border"}`}
                    placeholder="60" placeholderTextColor={colors.muted} value={newSessionDuration}
                    onChangeText={(v) => { setNewSessionDuration(v); setScheduleErrors((prev) => { const { duration: _, ...rest } = prev; return rest; }); }}
                    keyboardType="number-pad" returnKeyType="next" onSubmitEditing={() => locationInputRef.current?.focus()}
                  />
                  {scheduleErrors.duration && <Text className="text-error text-xs mt-1">{scheduleErrors.duration}</Text>}
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Session Type</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {SESSION_TYPE_OPTIONS.map((option) => (
                      <TouchableOpacity key={option.value} onPress={() => setNewSessionType(option.value)} className={`px-3 py-2 rounded-full border ${newSessionType === option.value ? "bg-primary border-primary" : "bg-surface border-border"}`}>
                        <Text className={newSessionType === option.value ? "text-white font-medium" : "text-foreground"}>{option.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-foreground mb-2">Location (optional)</Text>
                  <TextInput ref={locationInputRef} className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground" placeholder="Gym floor, Zoom, etc." placeholderTextColor={colors.muted} value={newSessionLocation} onChangeText={setNewSessionLocation} returnKeyType="next" onFocus={() => setTimeout(() => scheduleScrollRef.current?.scrollToEnd({ animated: true }), 300)} onSubmitEditing={() => notesInputRef.current?.focus()} />
                </View>
                <View className="mb-5">
                  <Text className="text-sm font-medium text-foreground mb-2">Notes (optional)</Text>
                  <TextInput ref={notesInputRef} className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground" placeholder="Any notes for this session..." placeholderTextColor={colors.muted} value={newSessionNotes} onChangeText={setNewSessionNotes} returnKeyType="done" blurOnSubmit onFocus={() => setTimeout(() => scheduleScrollRef.current?.scrollToEnd({ animated: true }), 300)} multiline numberOfLines={3} style={{ minHeight: 90, textAlignVertical: "top" }} />
                </View>
                <View className="flex-row gap-3 mb-2">
                  <TouchableOpacity onPress={() => setShowAddModal(false)} className="flex-1 bg-surface border border-border py-4 rounded-xl items-center">
                    <Text className="text-foreground font-semibold">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleScheduleSession} className="flex-1 bg-primary py-4 rounded-xl items-center" disabled={createSessionMutation.isPending}>
                    <Text className="text-white font-semibold">{createSessionMutation.isPending ? "Scheduling..." : "Schedule"}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </SwipeDownSheet>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}
