import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { navigateToHome } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Message = {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  isRead: boolean;
};

// Typing indicator animation component
function TypingIndicator({ name, colors }: { name: string; colors: any }) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (dotValue: SharedValue<number>, delay: number) => {
      dotValue.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-4, { duration: 300 }),
            withTiming(0, { duration: 300 })
          ),
          -1,
          false
        )
      );
    };

    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, [dot1, dot2, dot3]);

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  return (
    <View className="px-4 py-2 items-start">
      <View className="flex-row items-center">
        <Text className="text-xs text-muted mr-2">{name} is typing</Text>
        <View className="flex-row items-center gap-1">
          <Animated.View
            style={[dot1Style, { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted }]}
          />
          <Animated.View
            style={[dot2Style, { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted }]}
          />
          <Animated.View
            style={[dot3Style, { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted }]}
          />
        </View>
      </View>
    </View>
  );
}

// Read receipt component (double checkmarks)
function ReadReceipt({ isRead, colors }: { isRead: boolean; colors: any }) {
  return (
    <View className="flex-row items-center ml-1">
      <IconSymbol 
        name="checkmark" 
        size={12} 
        color={isRead ? colors.primary : colors.muted} 
      />
      <IconSymbol 
        name="checkmark" 
        size={12} 
        color={isRead ? colors.primary : colors.muted}
        style={{ marginLeft: -6 }}
      />
    </View>
  );
}

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
      <View className="flex-row items-center mt-1 px-1">
        <Text className="text-xs text-muted">
          {formatTime(message.createdAt)}
        </Text>
        {isOwn && <ReadReceipt isRead={message.isRead} colors={colors} />}
      </View>
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
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();

  // Fetch messages for this conversation
  const {
    data: messages,
    isLoading,
    refetch,
  } = trpc.messages.thread.useQuery(
    { conversationId: id || "" },
    { 
      enabled: !!id,
      refetchInterval: 3000, // Poll for new messages every 3 seconds
    }
  );

  // Send message mutation
  const sendMessage = trpc.messages.send.useMutation({
    onSuccess: () => {
      setMessageText("");
      setIsTyping(false);
      refetch();
      utils.messages.conversations.invalidate();
    },
  });

  // Mark messages as read mutation
  const markRead = trpc.messages.markRead.useMutation();

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages && messages.length > 0 && user) {
      const unreadMessages = messages.filter(
        (msg: any) => msg.senderId !== user.id && !msg.isRead
      );
      unreadMessages.forEach((msg: any) => {
        markRead.mutate({ id: msg.id });
      });
    }
  }, [messages, user, markRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Simulate other user typing (in a real app, this would come from WebSocket)
  // For demo purposes, we'll show typing indicator briefly after sending a message
  useEffect(() => {
    if (sendMessage.isSuccess) {
      // Simulate the other person typing a response
      const showTypingTimeout = setTimeout(() => {
        setOtherUserTyping(true);
        const hideTypingTimeout = setTimeout(() => {
          setOtherUserTyping(false);
        }, 3000);
        return () => clearTimeout(hideTypingTimeout);
      }, 1000);
      return () => clearTimeout(showTypingTimeout);
    }
  }, [sendMessage.isSuccess]);

  // Handle text input changes for typing indicator
  const handleTextChange = useCallback((text: string) => {
    setMessageText(text);
    
    // Set typing state
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
    }
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to clear typing state after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  }, [isTyping]);

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
    navigateToHome();
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
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          testID="conversation-back"
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
          <Text className="text-xs text-muted">
            {otherUserTyping ? "typing..." : "Tap for details"}
          </Text>
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
          ListFooterComponent={
            otherUserTyping ? (
              <TypingIndicator name={name || "User"} colors={colors} />
            ) : null
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
              className="flex-1 text-foreground text-base max-h-24 py-1"
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              selectionColor={colors.muted}
              value={messageText}
              onChangeText={handleTextChange}
              multiline
              returnKeyType="default"
              blurOnSubmit={false}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === "Enter") {
                  handleSend();
                }
              }}
              onSubmitEditing={() => {
                if (Platform.OS !== "web") {
                  handleSend();
                }
              }}
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
