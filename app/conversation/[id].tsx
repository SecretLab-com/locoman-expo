import { useState, useRef, useEffect, useCallback } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { navigateToHome } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";

// Common emoji reactions
const EMOJI_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "👏", "🎉"];

type Message = {
  id: number;
  senderId: number;
  content: string;
  createdAt: string;
  isRead: boolean;
  messageType?: "text" | "image" | "file" | "system";
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  attachmentMimeType?: string | null;
};

type Reaction = {
  id: number;
  messageId: number;
  userId: number;
  reaction: string;
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

// Emoji picker modal
function EmojiPicker({ 
  visible, 
  onClose, 
  onSelect,
  colors,
}: { 
  visible: boolean; 
  onClose: () => void; 
  onSelect: (emoji: string) => void;
  colors: any;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        className="flex-1 justify-center items-center bg-black/50"
        onPress={onClose}
      >
        <View className="bg-surface rounded-2xl p-4 mx-4">
          <Text className="text-foreground font-semibold text-center mb-3">
            Add Reaction
          </Text>
          <View className="flex-row flex-wrap justify-center gap-2">
            {EMOJI_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                className="w-12 h-12 items-center justify-center rounded-full bg-background"
                onPress={() => {
                  onSelect(emoji);
                  onClose();
                }}
              >
                <Text className="text-2xl">{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

// Attachment picker modal
function AttachmentPicker({
  visible,
  onClose,
  onSelectImage,
  onSelectFile,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectImage: () => void;
  onSelectFile: () => void;
  colors: any;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable 
        className="flex-1 justify-end bg-black/50"
        onPress={onClose}
      >
        <View className="bg-surface rounded-t-2xl p-4 pb-8">
          <View className="w-12 h-1 bg-border rounded-full self-center mb-4" />
          <Text className="text-foreground font-semibold text-lg mb-4">
            Send Attachment
          </Text>
          <TouchableOpacity
            className="flex-row items-center p-4 bg-background rounded-xl mb-3"
            onPress={() => {
              onSelectImage();
              onClose();
            }}
          >
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
              <IconSymbol name="photo.fill" size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-medium">Photo</Text>
              <Text className="text-muted text-sm">Send an image from your library</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center p-4 bg-background rounded-xl"
            onPress={() => {
              onSelectFile();
              onClose();
            }}
          >
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mr-3">
              <IconSymbol name="doc.fill" size={20} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-medium">File</Text>
              <Text className="text-muted text-sm">Send a document or file</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

// Message reactions display
function MessageReactions({ 
  reactions, 
  messageId,
  userId,
  onToggleReaction,
  colors,
}: { 
  reactions: Reaction[];
  messageId: number;
  userId: number;
  onToggleReaction: (messageId: number, reaction: string) => void;
  colors: any;
}) {
  // Group reactions by emoji
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.reaction]) {
      acc[r.reaction] = { count: 0, hasUserReacted: false };
    }
    acc[r.reaction].count++;
    if (r.userId === userId) {
      acc[r.reaction].hasUserReacted = true;
    }
    return acc;
  }, {} as Record<string, { count: number; hasUserReacted: boolean }>);

  if (Object.keys(grouped).length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-1 mt-1 px-1">
      {Object.entries(grouped).map(([emoji, data]) => (
        <TouchableOpacity
          key={emoji}
          className={`flex-row items-center px-2 py-0.5 rounded-full ${
            data.hasUserReacted ? "bg-primary/20" : "bg-surface"
          }`}
          onPress={() => onToggleReaction(messageId, emoji)}
        >
          <Text className="text-sm">{emoji}</Text>
          <Text className={`text-xs ml-1 ${data.hasUserReacted ? "text-primary" : "text-muted"}`}>
            {data.count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Message bubble with reactions and attachments
function MessageBubble({ 
  message, 
  isOwn, 
  colors,
  reactions,
  userId,
  onLongPress,
  onToggleReaction,
}: { 
  message: Message; 
  isOwn: boolean; 
  colors: any;
  reactions: Reaction[];
  userId: number;
  onLongPress: (messageId: number) => void;
  onToggleReaction: (messageId: number, reaction: string) => void;
}) {
  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const messageReactions = reactions.filter(r => r.messageId === message.id);

  const renderContent = () => {
    if (message.messageType === "image" && message.attachmentUrl) {
      return (
        <View>
          <Image
            source={{ uri: message.attachmentUrl }}
            className="w-48 h-48 rounded-lg"
            resizeMode="cover"
          />
          {message.content && message.content !== "Image" && (
            <Text className={`mt-2 ${isOwn ? "text-white" : "text-foreground"}`}>
              {message.content}
            </Text>
          )}
        </View>
      );
    }

    if (message.messageType === "file" && message.attachmentUrl) {
      return (
        <TouchableOpacity className="flex-row items-center">
          <View className={`w-10 h-10 rounded-lg items-center justify-center mr-2 ${
            isOwn ? "bg-white/20" : "bg-primary/10"
          }`}>
            <IconSymbol name="doc.fill" size={20} color={isOwn ? "#fff" : colors.primary} />
          </View>
          <View className="flex-1">
            <Text 
              className={`font-medium ${isOwn ? "text-white" : "text-foreground"}`}
              numberOfLines={1}
            >
              {message.attachmentName || "File"}
            </Text>
            {message.attachmentSize && (
              <Text className={`text-xs ${isOwn ? "text-white/70" : "text-muted"}`}>
                {formatFileSize(message.attachmentSize)}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <Text className={isOwn ? "text-white" : "text-foreground"}>
        {message.content}
      </Text>
    );
  };

  return (
    <View className={`px-4 py-1 ${isOwn ? "items-end" : "items-start"}`}>
      <Pressable
        onLongPress={() => onLongPress(message.id)}
        delayLongPress={300}
      >
        <View
          className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
            isOwn 
              ? "bg-primary rounded-br-sm" 
              : "bg-surface border border-border rounded-bl-sm"
          }`}
        >
          {renderContent()}
        </View>
      </Pressable>
      <MessageReactions 
        reactions={messageReactions}
        messageId={message.id}
        userId={userId}
        onToggleReaction={onToggleReaction}
        colors={colors}
      />
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
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

  // Fetch reactions for this conversation
  const { data: reactions = [] } = trpc.messages.getConversationReactions.useQuery(
    { conversationId: id || "" },
    { enabled: !!id, refetchInterval: 5000 }
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

  // Send message with attachment
  const sendWithAttachment = trpc.messages.sendWithAttachment.useMutation({
    onSuccess: () => {
      refetch();
      utils.messages.conversations.invalidate();
    },
  });

  // Add reaction mutation
  const addReaction = trpc.messages.addReaction.useMutation({
    onSuccess: () => {
      utils.messages.getConversationReactions.invalidate({ conversationId: id || "" });
    },
  });

  // Remove reaction mutation
  const removeReaction = trpc.messages.removeReaction.useMutation({
    onSuccess: () => {
      utils.messages.getConversationReactions.invalidate({ conversationId: id || "" });
    },
  });

  // Mark messages as read mutation
  const markRead = trpc.messages.markRead.useMutation();

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages && messages.length > 0 && user) {
      const unreadMessages = messages.filter(
        (msg: any) => msg.senderId !== user.id && !msg.readAt
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
  useEffect(() => {
    if (sendMessage.isSuccess) {
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
    
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
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

  const handleLongPress = async (messageId: number) => {
    await haptics.medium();
    setSelectedMessageId(messageId);
    setShowEmojiPicker(true);
  };

  const handleToggleReaction = async (messageId: number, reaction: string) => {
    if (!user) return;
    await haptics.light();
    
    // Check if user already reacted with this emoji
    const existingReaction = (reactions as Reaction[]).find(
      r => r.messageId === messageId && r.userId === user.id && r.reaction === reaction
    );
    
    if (existingReaction) {
      removeReaction.mutate({ messageId, reaction });
    } else {
      addReaction.mutate({ messageId, reaction });
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    if (selectedMessageId) {
      handleToggleReaction(selectedMessageId, emoji);
      setSelectedMessageId(null);
    }
  };

  const handleSelectImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] && participantId) {
      // In a real app, you'd upload the image to storage first
      // For now, we'll just send a placeholder
      await haptics.light();
      sendWithAttachment.mutate({
        receiverId: parseInt(participantId),
        content: "Image",
        conversationId: id,
        messageType: "image",
        attachmentUrl: result.assets[0].uri,
        attachmentName: result.assets[0].fileName || "image.jpg",
        attachmentSize: result.assets[0].fileSize,
        attachmentMimeType: result.assets[0].mimeType || "image/jpeg",
      });
    }
  };

  const handleSelectFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
    });

    if (!result.canceled && result.assets[0] && participantId) {
      // In a real app, you'd upload the file to storage first
      await haptics.light();
      sendWithAttachment.mutate({
        receiverId: parseInt(participantId),
        content: result.assets[0].name,
        conversationId: id,
        messageType: "file",
        attachmentUrl: result.assets[0].uri,
        attachmentName: result.assets[0].name,
        attachmentSize: result.assets[0].size,
        attachmentMimeType: result.assets[0].mimeType || "application/octet-stream",
      });
    }
  };

  // Transform messages to match our interface
  const messageList: Message[] = (messages || []).map((msg: any) => ({
    id: msg.id,
    senderId: msg.senderId,
    content: msg.content,
    createdAt: msg.createdAt,
    isRead: !!msg.readAt,
    messageType: msg.messageType || "text",
    attachmentUrl: msg.attachmentUrl,
    attachmentName: msg.attachmentName,
    attachmentSize: msg.attachmentSize,
    attachmentMimeType: msg.attachmentMimeType,
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
              reactions={reactions as Reaction[]}
              userId={user?.id || 0}
              onLongPress={handleLongPress}
              onToggleReaction={handleToggleReaction}
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
          {/* Attachment button */}
          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center mr-2"
            onPress={() => setShowAttachmentPicker(true)}
          >
            <IconSymbol name="plus.circle.fill" size={28} color={colors.primary} />
          </TouchableOpacity>

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

      {/* Emoji Picker Modal */}
      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => {
          setShowEmojiPicker(false);
          setSelectedMessageId(null);
        }}
        onSelect={handleSelectEmoji}
        colors={colors}
      />

      {/* Attachment Picker Modal */}
      <AttachmentPicker
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onSelectImage={handleSelectImage}
        onSelectFile={handleSelectFile}
        colors={colors}
      />
    </View>
  );
}
