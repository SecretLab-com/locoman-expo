import { useState, useRef, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";

type Message = {
  id: number;
  senderId: number;
  text: string;
  timestamp: string;
  isMe: boolean;
  status: "sent" | "delivered" | "read";
};

type ConversationInfo = {
  id: number;
  participantId: number;
  participantName: string;
  participantPhoto?: string;
  isOnline: boolean;
};

const MOCK_CONVERSATION: ConversationInfo = {
  id: 1,
  participantId: 101,
  participantName: "Sarah Johnson",
  participantPhoto: "https://i.pravatar.cc/150?img=1",
  isOnline: true,
};

const MOCK_MESSAGES: Message[] = [
  {
    id: 1,
    senderId: 101,
    text: "Hi! How are you feeling after yesterday's workout?",
    timestamp: "2024-03-20T09:00:00",
    isMe: false,
    status: "read",
  },
  {
    id: 2,
    senderId: 1,
    text: "Hey! I'm feeling great, a bit sore but in a good way 💪",
    timestamp: "2024-03-20T09:15:00",
    isMe: true,
    status: "read",
  },
  {
    id: 3,
    senderId: 101,
    text: "That's exactly what we want! The soreness means your muscles are adapting.",
    timestamp: "2024-03-20T09:20:00",
    isMe: false,
    status: "read",
  },
  {
    id: 4,
    senderId: 101,
    text: "Remember to stretch and stay hydrated today. I've updated your nutrition plan for this week.",
    timestamp: "2024-03-20T09:21:00",
    isMe: false,
    status: "read",
  },
  {
    id: 5,
    senderId: 1,
    text: "Thanks! I'll check it out. Should I still do the cardio session today?",
    timestamp: "2024-03-20T10:00:00",
    isMe: true,
    status: "read",
  },
  {
    id: 6,
    senderId: 101,
    text: "Yes, but keep it light - maybe 20 minutes of walking or easy cycling. Listen to your body!",
    timestamp: "2024-03-20T10:05:00",
    isMe: false,
    status: "read",
  },
  {
    id: 7,
    senderId: 1,
    text: "Got it! See you at our session on Thursday 🙌",
    timestamp: "2024-03-20T10:10:00",
    isMe: true,
    status: "delivered",
  },
  {
    id: 8,
    senderId: 101,
    text: "Great job on today's workout! See you next week.",
    timestamp: "2024-03-20T14:30:00",
    isMe: false,
    status: "read",
  },
];

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }
}

function MessageBubble({ message }: { message: Message }) {
  const colors = useColors();

  return (
    <View className={`flex-row mb-2 ${message.isMe ? "justify-end" : "justify-start"}`}>
      <View
        className={`max-w-[80%] px-4 py-3 rounded-2xl ${
          message.isMe
            ? "bg-primary rounded-br-md"
            : "bg-surface border border-border rounded-bl-md"
        }`}
      >
        <Text className={message.isMe ? "text-background" : "text-foreground"}>
          {message.text}
        </Text>
        <View className={`flex-row items-center mt-1 ${message.isMe ? "justify-end" : "justify-start"}`}>
          <Text className={`text-xs ${message.isMe ? "text-background/70" : "text-muted"}`}>
            {formatMessageTime(message.timestamp)}
          </Text>
          {message.isMe && (
            <IconSymbol
              name={message.status === "read" ? "checkmark.circle.fill" : "checkmark"}
              size={12}
              color={message.status === "read" ? colors.background : colors.background + "70"}
              style={{ marginLeft: 4 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export default function MessageThreadScreen() {
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [conversation] = useState(MOCK_CONVERSATION);
  const flatListRef = useRef<FlatList>(null);

  // Scroll to bottom on mount
  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, []);

  const handleSend = () => {
    if (!inputText.trim()) return;

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newMessage: Message = {
      id: Date.now(),
      senderId: 1, // Current user
      text: inputText.trim(),
      timestamp: new Date().toISOString(),
      isMe: true,
      status: "sent",
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // TODO: Send via API
    // Simulate delivery status update
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMessage.id ? { ...m, status: "delivered" as const } : m))
      );
    }, 1000);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = message.timestamp.split("T")[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  const renderItem = ({ item }: { item: { type: "date"; date: string } | { type: "message"; message: Message } }) => {
    if (item.type === "date") {
      return (
        <View className="items-center my-4">
          <View className="bg-surface px-3 py-1 rounded-full">
            <Text className="text-muted text-xs">{formatDateHeader(item.date)}</Text>
          </View>
        </View>
      );
    }
    return <MessageBubble message={item.message} />;
  };

  // Flatten grouped messages with date headers
  const flattenedData: ({ type: "date"; date: string } | { type: "message"; message: Message })[] = [];
  Object.entries(groupedMessages).forEach(([date, msgs]) => {
    flattenedData.push({ type: "date", date });
    msgs.forEach((msg) => flattenedData.push({ type: "message", message: msg }));
  });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <TouchableOpacity className="flex-row items-center flex-1 ml-2">
          <View className="relative">
            {conversation.participantPhoto ? (
              <Image
                source={{ uri: conversation.participantPhoto }}
                className="w-10 h-10 rounded-full"
                contentFit="cover"
              />
            ) : (
              <View className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center">
                <Text className="text-primary font-bold">
                  {conversation.participantName.charAt(0)}
                </Text>
              </View>
            )}
            {conversation.isOnline && (
              <View className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-background" />
            )}
          </View>
          <View className="ml-3">
            <Text className="text-foreground font-semibold">{conversation.participantName}</Text>
            <Text className="text-muted text-xs">
              {conversation.isOnline ? "Online" : "Offline"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="p-2">
          <IconSymbol name="phone.fill" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity className="p-2">
          <IconSymbol name="video.fill" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={flattenedData}
          keyExtractor={(item, index) => 
            item.type === "date" ? `date-${item.date}` : `msg-${item.message.id}`
          }
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        />

        {/* Input Area */}
        <View className="flex-row items-end px-4 py-3 border-t border-border bg-background">
          <TouchableOpacity className="p-2">
            <IconSymbol name="plus" size={24} color={colors.muted} />
          </TouchableOpacity>

          <View className="flex-1 mx-2 bg-surface border border-border rounded-2xl px-4 py-2 max-h-32">
            <TextInput
              className="text-foreground"
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              returnKeyType="default"
            />
          </View>

          <TouchableOpacity
            className={`p-2 rounded-full ${inputText.trim() ? "bg-primary" : "bg-muted/30"}`}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <IconSymbol
              name="paperplane.fill"
              size={20}
              color={inputText.trim() ? colors.background : colors.muted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
