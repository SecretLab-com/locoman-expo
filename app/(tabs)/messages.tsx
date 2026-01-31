import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { haptics } from "@/hooks/use-haptics";

type Conversation = {
  id: number;
  name: string;
  avatar: string | null;
  lastMessage: string;
  timestamp: string;
  unread: number;
};

// Mock data - in production, this would come from tRPC queries
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 1,
    name: "Coach Sarah",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
    lastMessage: "Great progress this week! Keep it up 💪",
    timestamp: "2m ago",
    unread: 2,
  },
  {
    id: 2,
    name: "Coach Mike",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
    lastMessage: "Your next workout plan is ready",
    timestamp: "1h ago",
    unread: 0,
  },
  {
    id: 3,
    name: "Support Team",
    avatar: null,
    lastMessage: "Thanks for your feedback!",
    timestamp: "Yesterday",
    unread: 0,
  },
];

function ConversationItem({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const colors = useColors();

  const handlePress = async () => {
    await haptics.light();
    onPress();
  };

  return (
    <TouchableOpacity
      className="flex-row items-center p-4 bg-surface border-b border-border"
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      {conversation.avatar ? (
        <Image
          source={{ uri: conversation.avatar }}
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
          <Text className={`font-semibold ${conversation.unread > 0 ? "text-foreground" : "text-foreground"}`}>
            {conversation.name}
          </Text>
          <Text className={`text-xs ${conversation.unread > 0 ? "text-primary" : "text-muted"}`}>
            {conversation.timestamp}
          </Text>
        </View>
        <Text
          className={`text-sm mt-0.5 ${conversation.unread > 0 ? "text-foreground font-medium" : "text-muted"}`}
          numberOfLines={1}
        >
          {conversation.lastMessage}
        </Text>
      </View>

      {/* Unread Badge */}
      {conversation.unread > 0 && (
        <View className="ml-2 bg-primary w-6 h-6 rounded-full items-center justify-center">
          <Text className="text-white text-xs font-bold">{conversation.unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleLoginPress = async () => {
    await haptics.light();
    router.push("/login");
  };

  const handleConversationPress = (conversation: Conversation) => {
    // Navigate to conversation detail
    router.push(`/conversation/${conversation.id}` as any);
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

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-foreground">Messages</Text>
          <Text className="text-sm text-muted">Chat with your trainers</Text>
        </View>
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-surface items-center justify-center border border-border"
          onPress={() => {/* New message */}}
        >
          <IconSymbol name="plus" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      <FlatList
        data={MOCK_CONVERSATIONS}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
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
            <Text className="text-muted text-center">
              Start a conversation with your trainer
            </Text>
          </View>
        }
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </ScreenContainer>
  );
}
