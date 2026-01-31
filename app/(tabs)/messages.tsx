import { useState, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";

type Conversation = {
  id: string;
  participantId: number;
  participantName: string;
  participantAvatar: string | null;
  participantRole: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

function ConversationItem({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
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
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {conversation.participantAvatar ? (
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
            {conversation.participantRole === "trainer" && (
              <View className="ml-2 px-2 py-0.5 bg-primary/10 rounded-full">
                <Text className="text-xs text-primary font-medium">Trainer</Text>
              </View>
            )}
          </View>
          <Text className={`text-xs ml-2 ${conversation.unreadCount > 0 ? "text-primary" : "text-muted"}`}>
            {formatTimestamp(conversation.lastMessageAt)}
          </Text>
        </View>
        <Text
          className={`text-sm mt-0.5 ${conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted"}`}
          numberOfLines={1}
        >
          {conversation.lastMessage || "Start a conversation"}
        </Text>
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
  const { isAuthenticated, isTrainer, isClient } = useAuthContext();

  // Fetch conversations from API
  const {
    data: conversations,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.messages.conversations.useQuery(undefined, {
    enabled: isAuthenticated,
  });

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
      pathname: "/conversation/[id]" as any,
      params: { 
        id: conversation.id,
        name: conversation.participantName,
        participantId: conversation.participantId.toString(),
      },
    });
  };

  const handleNewMessage = async () => {
    await haptics.light();
    // Navigate to new message screen or show contact picker
    router.push("/new-message" as any);
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

  // Transform API data to match our component interface
  const conversationList: Conversation[] = (conversations || []).map((conv: any) => ({
    id: conv.id || conv.conversationId,
    participantId: conv.participantId || conv.otherUserId,
    participantName: conv.participantName || conv.otherUserName || "Unknown",
    participantAvatar: conv.participantAvatar || conv.otherUserAvatar || null,
    participantRole: conv.participantRole || conv.otherUserRole || "user",
    lastMessage: conv.lastMessage || conv.lastMessageContent || null,
    lastMessageAt: conv.lastMessageAt || conv.updatedAt || null,
    unreadCount: conv.unreadCount || 0,
  }));

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Messages</Text>
          <Text className="text-sm text-muted">
            {isTrainer ? "Chat with your clients" : "Chat with your trainers"}
          </Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
          onPress={handleNewMessage}
        >
          <IconSymbol name="plus" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      <FlatList
        data={conversationList}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item)}
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
    </ScreenContainer>
  );
}
