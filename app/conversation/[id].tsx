import { useState, useRef, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { haptics } from "@/hooks/use-haptics";
import { trpc } from "@/lib/trpc";

type Message = {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  isRead: boolean;
};

function MessageBubble({ message, isOwn, colors }: { message: Message; isOwn: boolean; colors: any }) {
  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <View className={`px-4 py-1 ${isOwn ? "items-end" : "items-start"}`}>
      <View
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
          isOwn 
            ? "bg-primary rounded-br-sm" 
            : "bg-surface border border-border rounded-bl-sm"
        }`}
      >
        <Text className={isOwn ? "text-white" : "text-foreground"}>
          {message.content}
        </Text>
      </View>
      <Text className="text-xs text-muted mt-1 px-1">
        {formatTime(message.createdAt)}
        {isOwn && message.isRead && " • Read"}
      </Text>
    </View>
  );
}

export default function ConversationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, name, participantId } = useLocalSearchParams<{ 
    id: string; 
    name: string; 
    participantId: string;
  }>();
  const { user } = useAuthContext();
  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const utils = trpc.useUtils();

  // Fetch messages for this conversation
  const {
    data: messages,
    isLoading,
    refetch,
  } = trpc.messages.thread.useQuery(
    { conversationId: id || "" },
    { enabled: !!id }
  );

  // Send message mutation
  const sendMessage = trpc.messages.send.useMutation({
    onSuccess: () => {
      setMessageText("");
      refetch();
      utils.messages.conversations.invalidate();
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !participantId) return;
    
    await haptics.light();
    sendMessage.mutate({
      receiverId: parseInt(participantId),
      content: messageText.trim(),
      conversationId: id,
    });
  };

  const handleBack = async () => {
    await haptics.light();
    router.back();
  };

  // Transform messages to match our interface
  const messageList: Message[] = (messages || []).map((msg: any) => ({
    id: msg.id,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt,
    isRead: msg.isRead || false,
  }));

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View 
        className="flex-row items-center px-4 py-3 bg-surface border-b border-border"
        style={{ paddingTop: insets.top + 8 }}
      >
        <TouchableOpacity
          className="w-10 h-10 rounded-full items-center justify-center -ml-2"
          onPress={handleBack}
        >
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        
        <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center ml-1">
          <IconSymbol name="person.fill" size={20} color={colors.primary} />
        </View>
        
        <View className="flex-1 ml-3">
          <Text className="text-foreground font-semibold text-lg" numberOfLines={1}>
            {name || "Conversation"}
          </Text>
          <Text className="text-xs text-muted">Tap for details</Text>
        </View>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messageList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.senderId === user?.id}
              colors={colors}
            />
          )}
          contentContainerStyle={{ 
            flexGrow: 1, 
            paddingVertical: 16,
            justifyContent: messageList.length === 0 ? "center" : "flex-start",
          }}
          ListEmptyComponent={
            <View className="items-center px-4">
              <View className="w-16 h-16 rounded-full bg-surface items-center justify-center mb-4">
                <IconSymbol name="message.fill" size={32} color={colors.muted} />
              </View>
              <Text className="text-foreground font-semibold text-lg mb-1">
                Start the conversation
              </Text>
              <Text className="text-muted text-center">
                Send a message to {name || "this person"}
              </Text>
            </View>
          }
          onContentSizeChange={() => {
            if (messageList.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
        />
      )}

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View 
          className="flex-row items-end px-4 py-3 bg-surface border-t border-border"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <View className="flex-1 flex-row items-end bg-background rounded-2xl border border-border px-4 py-2 mr-3">
            <TextInput
              className="flex-1 text-foreground text-base max-h-24"
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              returnKeyType="default"
            />
          </View>
          <TouchableOpacity
            className={`w-11 h-11 rounded-full items-center justify-center ${
              messageText.trim() ? "bg-primary" : "bg-surface border border-border"
            }`}
            onPress={handleSend}
            disabled={!messageText.trim() || sendMessage.isPending}
          >
            {sendMessage.isPending ? (
              <ActivityIndicator size="small" color={messageText.trim() ? "#fff" : colors.muted} />
            ) : (
              <IconSymbol 
                name="paperplane.fill" 
                size={20} 
                color={messageText.trim() ? "#fff" : colors.muted} 
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
