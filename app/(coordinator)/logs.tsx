import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";

type ImpersonationLog = {
  userId: number;
  userName: string;
  userRole: UserRole;
  timestamp: string;
};

const ROLE_COLORS: Record<UserRole, string> = {
  shopper: "#6B7280",
  client: "#3B82F6",
  trainer: "#10B981",
  manager: "#F59E0B",
  coordinator: "#8B5CF6",
};

export default function LogsScreen() {
  const colors = useColors();
  const [logs, setLogs] = useState<ImpersonationLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Load logs
  const loadLogs = async () => {
    try {
      const storedLogs = await AsyncStorage.getItem("impersonation_logs");
      if (storedLogs) {
        setLogs(JSON.parse(storedLogs));
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  // Clear logs
  const handleClearLogs = () => {
    Alert.alert(
      "Clear Logs",
      "Are you sure you want to clear all impersonation logs?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem("impersonation_logs");
            setLogs([]);
          },
        },
      ]
    );
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Get initials
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Impersonation Logs</Text>
          <Text className="text-sm text-muted mt-1">
            {logs.length} entries recorded
          </Text>
        </View>
        {logs.length > 0 && (
          <TouchableOpacity
            onPress={handleClearLogs}
            className="bg-error/10 px-4 py-2 rounded-xl"
          >
            <Text className="text-error font-medium">Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {logs.length === 0 ? (
          <View className="bg-surface rounded-xl p-6 items-center">
            <IconSymbol name="doc.text.fill" size={32} color={colors.muted} />
            <Text className="text-muted mt-2">No impersonation logs</Text>
            <Text className="text-muted text-sm text-center mt-1">
              Logs will appear here when you impersonate users
            </Text>
          </View>
        ) : (
          <View className="bg-surface rounded-xl divide-y divide-border">
            {logs.map((log, index) => (
              <View key={index} className="flex-row items-center p-4">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${ROLE_COLORS[log.userRole]}20` }}
                >
                  <Text
                    className="font-bold"
                    style={{ color: ROLE_COLORS[log.userRole] }}
                  >
                    {getInitials(log.userName)}
                  </Text>
                </View>
                <View className="flex-1 ml-3">
                  <View className="flex-row items-center">
                    <Text className="text-foreground font-medium">{log.userName}</Text>
                    <View
                      className="px-2 py-0.5 rounded-full ml-2"
                      style={{ backgroundColor: `${ROLE_COLORS[log.userRole]}20` }}
                    >
                      <Text
                        className="text-xs font-medium capitalize"
                        style={{ color: ROLE_COLORS[log.userRole] }}
                      >
                        {log.userRole}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-sm text-muted">
                    {formatTimestamp(log.timestamp)}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </View>
            ))}
          </View>
        )}

        {/* Info Card */}
        <View className="bg-primary/10 rounded-xl p-4 mt-6">
          <View className="flex-row items-center mb-2">
            <IconSymbol name="info.circle.fill" size={20} color={colors.primary} />
            <Text className="text-primary font-semibold ml-2">About Impersonation</Text>
          </View>
          <Text className="text-muted text-sm leading-relaxed">
            Impersonation allows coordinators to view the app as any user for testing
            and support purposes. All impersonation sessions are logged for security
            and audit purposes.
          </Text>
        </View>

        {/* Bottom padding */}
        <View className="h-24" />
      </ScrollView>
    </ScreenContainer>
  );
}
