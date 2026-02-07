import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Category = "all" | "auth" | "admin" | "payments" | "shopify";

const CATEGORIES: { value: Category; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "list.bullet" },
  { value: "auth", label: "Auth", icon: "person.badge.key.fill" },
  { value: "admin", label: "Admin", icon: "shield.fill" },
  { value: "payments", label: "Payments", icon: "creditcard.fill" },
  { value: "shopify", label: "Shopify", icon: "cart.fill" },
];

const CATEGORY_COLORS: Record<string, string> = {
  auth: "#8B5CF6",
  admin: "#F59E0B",
  payments: "#10B981",
  shopify: "#3B82F6",
};

const ACTION_ICONS: Record<string, string> = {
  role_changed: "person.2.fill",
  status_changed: "power",
  impersonation_started: "theatermasks.fill",
  impersonation_ended: "theatermasks",
  profile_updated: "pencil",
  invited: "envelope.fill",
  deleted: "trash.fill",
  impersonate: "theatermasks.fill",
  // Payment statuses
  created: "plus.circle.fill",
  pending: "clock.fill",
  authorised: "checkmark.circle.fill",
  captured: "checkmark.seal.fill",
  refused: "xmark.circle.fill",
  cancelled: "minus.circle.fill",
  refunded: "arrow.uturn.backward.circle.fill",
};

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type LogItem = {
  id: string;
  category: string;
  action: string;
  description: string;
  userId: string | null;
  userName: string | null;
  metadata: any;
  createdAt: string;
};

function LogEntry({ item, colors }: { item: LogItem; colors: ReturnType<typeof useColors> }) {
  const catColor = CATEGORY_COLORS[item.category] || colors.muted;
  const icon = ACTION_ICONS[item.action] || "doc.text";

  return (
    <View className="flex-row p-4 border-b border-border">
      {/* Icon */}
      <View
        className="w-10 h-10 rounded-full items-center justify-center"
        style={{ backgroundColor: `${catColor}15` }}
      >
        <IconSymbol name={icon as any} size={18} color={catColor} />
      </View>

      {/* Content */}
      <View className="flex-1 ml-3">
        <Text className="text-foreground text-sm leading-5" numberOfLines={3}>
          {item.description}
        </Text>
        <View className="flex-row items-center mt-1.5 gap-2">
          <View
            className="px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${catColor}15` }}
          >
            <Text className="text-xs font-medium capitalize" style={{ color: catColor }}>
              {item.category}
            </Text>
          </View>
          <Text className="text-xs text-muted">{formatTimestamp(item.createdAt)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function LogsScreen() {
  const colors = useColors();
  const [category, setCategory] = useState<Category>("all");

  const {
    data: logs,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.admin.activityFeed.useQuery(
    { limit: 100, category },
    { staleTime: 10000 },
  );

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-3">
        <Text className="text-2xl font-bold text-foreground">Activity Log</Text>
        <Text className="text-sm text-muted mt-1">
          System events, admin actions, and payment activity
        </Text>
      </View>

      {/* Category filters */}
      <View className="px-4 pb-3">
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item: cat }) => {
            const isActive = category === cat.value;
            return (
              <TouchableOpacity
                onPress={() => setCategory(cat.value)}
                className={`flex-row items-center px-3.5 py-2 rounded-full mr-2 border ${
                  isActive ? "bg-primary border-primary" : "bg-surface border-border"
                }`}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${cat.label}`}
              >
                <IconSymbol
                  name={cat.icon as any}
                  size={14}
                  color={isActive ? colors.background : colors.muted}
                />
                <Text
                  className={`text-sm ml-1.5 font-medium ${
                    isActive ? "text-background" : "text-muted"
                  }`}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-3">Loading activity...</Text>
        </View>
      ) : (
        <FlatList
          data={logs || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LogEntry item={item} colors={colors} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-16 px-6">
              <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                <IconSymbol name="doc.text.fill" size={32} color={colors.muted} />
              </View>
              <Text className="text-foreground font-semibold text-lg mb-1">No activity yet</Text>
              <Text className="text-muted text-center">
                {category === "all"
                  ? "Admin actions, logins, and system events will appear here as they happen."
                  : `No ${category} events recorded yet.`}
              </Text>
            </View>
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        />
      )}
    </ScreenContainer>
  );
}
