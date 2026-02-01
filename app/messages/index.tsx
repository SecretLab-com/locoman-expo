import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationHeader } from "@/components/navigation-header";
import { navigateToHome } from "@/lib/navigation";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

type Conversation = {
  id: number;
  participantId: number;
  participantName: string;
  participantPhoto?: string;
  participantRole: "trainer" | "client";
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
};

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 1,
    participantId: 101,
    participantName: "Sarah Johnson",
    participantPhoto: "https://i.pravatar.cc/150?img=1",
    participantRole: "trainer",
    lastMessage: "Great job on today's workout! See you next week.",
    lastMessageTime: "2024-03-20T14:30:00",
    unreadCount: 2,
    isOnline: true,
  },
  {
    id: 2,
    participantId: 102,
    participantName: "Mike Chen",
    participantPhoto: "https://i.pravatar.cc/150?img=3",
    participantRole: "trainer",
    lastMessage: "Your nutrition plan is ready for review",
    lastMessageTime: "2024-03-19T10:15:00",
    unreadCount: 0,
    isOnline: false,
  },
  {
    id: 3,
    participantId: 201,
    participantName: "John Doe",
    participantPhoto: "https://i.pravatar.cc/150?img=11",
    participantRole: "client",
    lastMessage: "Thanks for the session today!",
    lastMessageTime: "2024-03-18T16:45:00",
    unreadCount: 0,
    isOnline: true,
  },
  {
    id: 4,
    participantId: 202,
    participantName: "Emma Wilson",
    participantPhoto: "https://i.pravatar.cc/150?img=5",
    participantRole: "trainer",
    lastMessage: "Don't forget to hydrate!",
    lastMessageTime: "2024-03-17T09:00:00",
    unreadCount: 1,
    isOnline: false,
  },
];

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

function ConversationCard({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const colors = useColors();

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3 bg-background"
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar with Online Indicator */}
      <View className="relative">
        {conversation.participantPhoto ? (
          <Image
            source={{ uri: conversation.participantPhoto }}
            className="w-14 h-14 rounded-full"
            contentFit="cover"
          />
        ) : (
          <View className="w-14 h-14 rounded-full bg-primary/20 items-center justify-center">
            <Text className="text-primary text-xl font-bold">
              {conversation.participantName.charAt(0)}
            </Text>
          </View>
        )}
        {conversation.isOnline && (
          <View className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-success border-2 border-background" />
        )}
      </View>

      {/* Message Content */}
      <View className="flex-1 ml-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-foreground font-semibold">{conversation.participantName}</Text>
          <Text className="text-muted text-xs">{formatTime(conversation.lastMessageTime)}</Text>
        </View>
        <View className="flex-row items-center mt-1">
          <Text
            className={`flex-1 text-sm ${
              conversation.unreadCount > 0 ? "text-foreground font-medium" : "text-muted"
            }`}
            numberOfLines={1}
          >
            {conversation.lastMessage}
          </Text>
          {conversation.unreadCount > 0 && (
            <View className="bg-primary rounded-full min-w-[20px] h-5 items-center justify-center px-1.5 ml-2">
              <Text className="text-background text-xs font-bold">{conversation.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      <IconSymbol name="chevron.right" size={16} color={colors.muted} />
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const colors = useColors();
  const [conversations] = useState(MOCK_CONVERSATIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filteredConversations = conversations.filter((conv) =>
    conv.participantName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch from API
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleConversationPress = (conversation: Conversation) => {
    router.push(`/messages/${conversation.id}` as any);
  };

  return (
    <ScreenContainer edges={["left", "right"]}>
      {/* Header with home button */}
      <NavigationHeader
        title="Messages"
        subtitle={totalUnread > 0 ? `${totalUnread} unread` : undefined}
        showBack
        showHome
        onBack={() => navigateToHome()}
        rightAction={{
          icon: "pencil",
          onPress: () => {},
          label: "New message",
          testID: "messages-new",
        }}
      />

      {/* Search Section */}
      <View className="px-4 pb-4 border-b border-border">

        {/* Search Bar */}
        <View className="flex-row items-center bg-surface border border-border rounded-xl px-4 py-3">
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            className="flex-1 ml-3 text-foreground"
            placeholder="Search conversations..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <IconSymbol name="xmark" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ConversationCard
            conversation={item}
            onPress={() => handleConversationPress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-border ml-[74px]" />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View className="items-center py-12 px-4">
            <IconSymbol name="message.fill" size={48} color={colors.muted} />
            <Text className="text-foreground font-semibold mt-4">No conversations yet</Text>
            <Text className="text-muted text-center mt-2">
              Start a conversation with your trainer or clients
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
