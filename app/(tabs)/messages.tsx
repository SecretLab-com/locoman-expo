import { useBottomNavHeight } from "@/components/role-bottom-nav";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { useWebSocket } from "@/hooks/use-websocket";
import { getRoleConversationPath } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Conversation = {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar: string | null;
  participantRole: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  lastMessageIsOwn: boolean;
  lastMessageIsRead: boolean;
};

function ConversationItem({
  conversation,
  onPress,
  onLongPress,
}: {
  conversation: Conversation;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const colors = useColors();

  const handlePress = async () => {
    await haptics.light();
    onPress();
  };

  // Format timestamp
  const formatTimestamp = (date: string | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <TouchableOpacity
      className="flex-row items-center p-4 bg-surface border-b border-border"
      onPress={handlePress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {conversation.participantRole === "group" ? (
        <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
          <IconSymbol name="person.2.fill" size={22} color={colors.primary} />
        </View>
      ) : conversation.participantAvatar ? (
        <Image
          source={{ uri: conversation.participantAvatar }}
          className="w-12 h-12 rounded-full"
          contentFit="cover"
        />
      ) : (
        <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
          <IconSymbol name="person.fill" size={24} color={colors.primary} />
        </View>
      )}

      {/* Content */}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Text 
              className={`font-semibold ${conversation.unreadCount > 0 ? "text-foreground" : "text-foreground"}`}
              numberOfLines={1}
            >
              {conversation.participantName}
            </Text>
            {conversation.participantRole === "group" ? (
              <View className="ml-2 px-2 py-0.5 bg-primary/10 rounded-full">
                <Text className="text-xs text-primary font-medium">Group</Text>
              </View>
            ) : conversation.participantRole === "trainer" ? (
              <View className="ml-2 px-2 py-0.5 bg-primary/10 rounded-full">
                <Text className="text-xs text-primary font-medium">Trainer</Text>
              </View>
            ) : null}
          </View>
          <Text className={`text-xs ml-2 ${conversation.unreadCount > 0 ? "text-primary" : "text-muted"}`}>
            {formatTimestamp(conversation.lastMessageAt)}
          </Text>
        </View>
        <View className="flex-row items-center mt-0.5">
          {/* Read receipt for own messages */}
          {conversation.lastMessageIsOwn && conversation.lastMessage && (
            <View className="flex-row items-center mr-1">
              <IconSymbol 
                name="checkmark" 
                size={12} 
                color={conversation.lastMessageIsRead ? colors.primary : colors.muted} 
              />
              <IconSymbol 
                name="checkmark" 
                size={12} 
                color={conversation.lastMessageIsRead ? colors.primary : colors.muted}
                style={{ marginLeft: -6 }}
              />
            </View>
          )}
          <Text
            className={`text-sm flex-1 ${conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted"}`}
            numberOfLines={1}
          >
            {conversation.lastMessageIsOwn && conversation.lastMessage ? `You: ${conversation.lastMessage}` : (conversation.lastMessage || "Start a conversation")}
          </Text>
        </View>
      </View>

      {/* Unread Badge */}
      {conversation.unreadCount > 0 && (
        <View className="ml-2 bg-primary min-w-[24px] h-6 px-1.5 rounded-full items-center justify-center">
          <Text className="text-white text-xs font-bold">{conversation.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const { isAuthenticated, isTrainer, effectiveRole, user } = useAuthContext();
  const bottomNavHeight = useBottomNavHeight();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const fabOffset = Math.max(8, bottomNavHeight - bottomPadding - 6);
  const roleBase =
    effectiveRole === "client"
      ? "/(client)"
      : effectiveRole === "trainer"
        ? "/(trainer)"
        : effectiveRole === "manager"
          ? "/(manager)"
          : effectiveRole === "coordinator"
            ? "/(coordinator)"
            : "/(tabs)";

  const { connect, disconnect, subscribe } = useWebSocket();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});

  // Load group names from AsyncStorage
  useEffect(() => {
    if (!user?.id) return;
    const loadGroupNames = async () => {
      try {
        const stored = await AsyncStorage.getItem(`messageGroups:${user.id}`);
        if (!stored) return;
        const groups = JSON.parse(stored) as Array<{ id: string; name: string }>;
        const map: Record<string, string> = {};
        for (const g of groups) {
          if (g.id && g.name) map[g.id] = g.name;
        }
        setGroupNames(map);
      } catch {
        // Ignore parse errors
      }
    };
    void loadGroupNames();
  }, [user?.id]);

  // Fetch conversations from API
  const {
    data: conversations,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.messages.conversations.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const deleteConversation = trpc.messages.deleteConversation.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  // Real-time conversation updates via WebSocket
  useEffect(() => {
    if (!isAuthenticated) return;
    connect();
    const unsubscribe = subscribe((msg) => {
      if (msg.type === "new_message" || msg.type === "badge_counts_updated") {
        refetch();
      }
    });
    return () => {
      unsubscribe();
      disconnect();
    };
  }, [isAuthenticated, connect, disconnect, subscribe, refetch]);

  const onRefresh = useCallback(async () => {
    await haptics.light();
    await refetch();
  }, [refetch]);

  const handleLoginPress = async () => {
    await haptics.light();
    router.push("/login");
  };

  const handleConversationPress = (conversation: Conversation) => {
    // Navigate to conversation detail
    router.push({
      pathname: getRoleConversationPath(effectiveRole as any) as any,
      params: { 
        id: conversation.id,
        name: conversation.participantName,
        participantId: conversation.participantId,
      },
    });
  };

  const handleConversationLongPress = async (conversation: Conversation) => {
    await haptics.medium();
    setSelectedConversation(conversation);
  };

  const confirmDeleteConversation = async () => {
    if (!selectedConversation) return;
    try {
      await deleteConversation.mutateAsync({ conversationId: selectedConversation.id });
      setSelectedConversation(null);
      Alert.alert("Conversation deleted", "This conversation has been removed.");
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message || "Unable to delete conversation.");
    }
  };

  const handleNewMessage = async () => {
    await haptics.light();
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    router.push(`${roleBase}/messages/new` as any);
  };

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <View className="w-20 h-20 rounded-full bg-primary/10 items-center justify-center mb-6">
          <IconSymbol name="message.fill" size={40} color={colors.primary} />
        </View>
        <Text className="text-2xl font-bold text-foreground text-center mb-2">
          Your Messages
        </Text>
        <Text className="text-muted text-center mb-8">
          Sign in to chat with your trainers and get support
        </Text>
        <TouchableOpacity
          className="bg-primary px-8 py-3 rounded-full"
          onPress={handleLoginPress}
        >
          <Text className="text-background font-semibold text-lg">Sign In</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading messages...</Text>
      </ScreenContainer>
    );
  }

  // Transform API data to match our component interface, sorted by most recent
  const conversationList: Conversation[] = (conversations || [])
    .map((conv: any) => {
      const convId = conv.id || conv.conversationId;
      const isGroup = conv.isGroup || convId.startsWith("group-");
      const storedGroupName = groupNames[convId];
      let displayName: string;
      if (isGroup && storedGroupName) {
        displayName = storedGroupName;
      } else if (isGroup && conv.participantNames?.length > 0) {
        displayName = conv.participantNames.join(", ");
      } else {
        displayName = conv.participantName || conv.otherUserName || "Unknown";
      }
      return {
        id: convId,
        participantId: conv.participantId || conv.otherUserId,
        participantName: displayName,
        participantAvatar: isGroup ? null : (conv.participantAvatar || conv.otherUserAvatar || null),
        participantRole: isGroup ? "group" : (conv.participantRole || conv.otherUserRole || "user"),
        lastMessage: conv.lastMessage || conv.lastMessageContent || null,
        lastMessageAt: conv.lastMessageAt || conv.updatedAt || null,
        unreadCount: conv.unreadCount || 0,
        lastMessageIsOwn: conv.lastMessageIsOwn || conv.lastMessageSenderId === conv.currentUserId || false,
        lastMessageIsRead: conv.lastMessageIsRead || false,
      };
    })
    .sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA; // newest first
    });

  return (
    <ScreenContainer className="flex-1 relative">
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Messages</Text>
          <Text className="text-sm text-muted">
            {isTrainer ? "Chat with your clients" : "Chat with your trainers"}
          </Text>
        </View>
      </View>

      <View className="flex-1">
        {/* Conversations List */}
        <FlatList
          data={conversationList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              onPress={() => handleConversationPress(item)}
              onLongPress={() => handleConversationLongPress(item)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-12 px-4">
              <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                <IconSymbol name="message.fill" size={32} color={colors.muted} />
              </View>
              <Text className="text-foreground font-semibold text-lg mb-1">No messages yet</Text>
              <Text className="text-muted text-center mb-6">
                {isTrainer 
                  ? "Messages from your clients will appear here"
                  : "Start a conversation with your trainer"
                }
              </Text>
              {!isTrainer && (
                <TouchableOpacity
                  className="bg-primary px-6 py-3 rounded-full"
                  onPress={async () => {
                    await haptics.light();
                    router.push("/(tabs)/discover" as any);
                  }}
                >
                  <Text className="text-background font-semibold">Find a Trainer</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          contentContainerStyle={{ flexGrow: 1 }}
        />

      </View>

      <TouchableOpacity
        onPress={handleNewMessage}
        className="absolute w-14 h-14 rounded-full bg-primary items-center justify-center shadow-lg"
        style={{ right: 16, bottom: fabOffset }}
        accessibilityRole="button"
        accessibilityLabel="Start a new message"
        testID="messages-new-fab"
      >
        <IconSymbol name="plus" size={24} color={colors.background} />
      </TouchableOpacity>

      <Modal
        visible={Boolean(selectedConversation)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedConversation(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setSelectedConversation(null)}
        >
          <Pressable className="bg-surface rounded-t-2xl p-5 border-t border-border">
            <Text className="text-foreground text-lg font-semibold mb-1">
              Conversation options
            </Text>
            <Text className="text-muted mb-4">
              {selectedConversation?.participantName || "Conversation"}
            </Text>
            <TouchableOpacity
              className="rounded-xl bg-error/15 px-4 py-3 mb-2"
              onPress={confirmDeleteConversation}
              disabled={deleteConversation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Delete this conversation"
              testID="conversation-delete"
            >
              {deleteConversation.isPending ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text className="text-error font-semibold">Delete conversation</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-xl bg-background border border-border px-4 py-3"
              onPress={() => setSelectedConversation(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel conversation options"
              testID="conversation-options-cancel"
            >
              <Text className="text-foreground font-semibold text-center">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
