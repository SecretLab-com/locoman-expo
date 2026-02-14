import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { useWebSocket } from "@/hooks/use-websocket";
import { navigateToHome } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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

// Common emoji reactions
const EMOJI_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "👏", "🎉"];

type Message = {
  id: string;
  senderId: string;
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
  id: string;
  messageId: string;
  userId: string;
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

function MessageActionsModal({
  visible,
  canEdit,
  onClose,
  onReact,
  onEdit,
  onDelete,
}: {
  visible: boolean;
  canEdit: boolean;
  onClose: () => void;
  onReact: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable className="bg-surface rounded-t-2xl p-4 border-t border-border">
          <TouchableOpacity
            className="rounded-xl bg-background border border-border px-4 py-3 mb-2"
            onPress={onReact}
            accessibilityRole="button"
            accessibilityLabel="React to message"
            testID="message-action-react"
          >
            <Text className="text-foreground font-semibold text-center">React</Text>
          </TouchableOpacity>
          {canEdit ? (
            <TouchableOpacity
              className="rounded-xl bg-background border border-border px-4 py-3 mb-2"
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Edit message"
              testID="message-action-edit"
            >
              <Text className="text-foreground font-semibold text-center">Edit message</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            className="rounded-xl bg-error/10 px-4 py-3 mb-2"
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete message"
            testID="message-action-delete"
          >
            <Text className="text-error font-semibold text-center">Delete message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="rounded-xl bg-background border border-border px-4 py-3"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel message actions"
            testID="message-action-cancel"
          >
            <Text className="text-foreground font-semibold text-center">Cancel</Text>
          </TouchableOpacity>
        </Pressable>
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
  messageId: string;
  userId: string;
  onToggleReaction: (messageId: string, reaction: string) => void;
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
          className={`flex-row items-center px-2 py-0.5 rounded-full ${data.hasUserReacted ? "bg-primary/20" : "bg-surface"
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

function isSingleEmojiMessage(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;

  // Match one emoji grapheme, optionally joined sequences (ZWJ), variation selectors, and skin tones.
  return /^(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)(?:\u200D(?:\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?))*$/u.test(
    trimmed
  );
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
  userId: string;
  onLongPress: (messageId: string) => void;
  onToggleReaction: (messageId: string, reaction: string) => void;
}) {
  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const messageReactions = reactions.filter(r => r.messageId === message.id);
  const isLargeEmoji = message.messageType === "text" && isSingleEmojiMessage(message.content);
  const bubbleMinWidth = isLargeEmoji ? 0 : message.messageType === "text" ? 136 : 96;

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
          <View className={`w-10 h-10 rounded-lg items-center justify-center mr-2 ${isOwn ? "bg-white/20" : "bg-primary/10"
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

    if (isLargeEmoji) {
      return (
        <Text style={{ fontSize: 56, lineHeight: 64 }}>
          {message.content.trim()}
        </Text>
      );
    }

    return <Text className={isOwn ? "text-white" : "text-foreground"}>{message.content}</Text>;
  };

  return (
    <View className={`px-4 py-1 ${isOwn ? "items-end" : "items-start"}`}>
      <Pressable
        onLongPress={() => onLongPress(message.id)}
        delayLongPress={300}
      >
        <View
          className={`max-w-[92%] rounded-2xl ${isLargeEmoji
              ? ""
              : isOwn
                ? "bg-primary rounded-br-sm px-4 py-2.5"
                : "bg-surface border border-border rounded-bl-sm px-4 py-2.5"
            }`}
          style={isLargeEmoji ? undefined : { minWidth: bubbleMinWidth }}
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
  const { id, name, participantId, participantIds, groupIcon } = useLocalSearchParams<{
    id: string;
    name: string;
    participantId: string;
    participantIds: string;
    groupIcon: string;
  }>();
  const { user, isAuthenticated } = useAuthContext();
  const [messageText, setMessageText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showConversationDetails, setShowConversationDetails] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markingReadIdsRef = useRef<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const { connect, disconnect, subscribe } = useWebSocket();

  // Fetch messages for this conversation
  const {
    data: messages,
    isLoading,
    refetch,
  } = trpc.messages.thread.useQuery(
    { conversationId: id || "" },
    {
      enabled: !!id,
    }
  );

  // Real-time message updates via WebSocket
  useEffect(() => {
    if (!isAuthenticated) return;
    connect();
    const unsubscribe = subscribe((msg) => {
      if (msg.type === "new_message" && msg.conversationId === id) {
        refetch();
        utils.messages.conversations.invalidate();
      }
    });
    return () => {
      unsubscribe();
      disconnect();
    };
  }, [id, isAuthenticated, connect, disconnect, subscribe, refetch, utils]);

  // Fetch reactions for this conversation
  const { data: reactions = [] } = trpc.messages.getConversationReactions.useQuery(
    { conversationId: id || "" },
    { enabled: !!id, refetchInterval: 60000 }
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
  const sendGroupMessage = trpc.messages.sendGroup.useMutation({
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
  const sendGroupWithAttachment = trpc.messages.sendGroupWithAttachment.useMutation({
    onSuccess: () => {
      refetch();
      utils.messages.conversations.invalidate();
    },
  });
  const uploadAttachment = trpc.messages.uploadAttachment.useMutation();

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
  const editMessage = trpc.messages.edit.useMutation({
    onSuccess: async () => {
      await refetch();
      await utils.messages.conversations.invalidate();
    },
  });
  const deleteMessage = trpc.messages.delete.useMutation({
    onSuccess: async () => {
      await refetch();
      await utils.messages.conversations.invalidate();
    },
  });
  const deleteConversation = trpc.messages.deleteConversation.useMutation({
    onSuccess: async () => {
      await utils.messages.conversations.invalidate();
    },
  });

  // Reset mark-read dedupe when switching conversations.
  useEffect(() => {
    markingReadIdsRef.current.clear();
  }, [id]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (!messages?.length || !user?.id) return;
    const unreadMessages = messages.filter(
      (msg: any) => msg.senderId !== user.id && !msg.readAt
    );
    unreadMessages.forEach((msg: any) => {
      if (markingReadIdsRef.current.has(msg.id)) return;
      markingReadIdsRef.current.add(msg.id);
      markRead.mutate(
        { id: msg.id },
        {
          onError: () => {
            // Allow retry if mark-read fails.
            markingReadIdsRef.current.delete(msg.id);
          },
        }
      );
    });
  }, [messages, user?.id, markRead]);

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
    if (!messageText.trim()) return;

    if (editingMessageId) {
      try {
        await editMessage.mutateAsync({
          id: editingMessageId,
          content: messageText.trim(),
        });
        setEditingMessageId(null);
        setMessageText("");
      } catch (error: any) {
        Alert.alert("Edit failed", error?.message || "Unable to edit this message.");
      }
      return;
    }

    const ids = participantIds
      ? participantIds
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
      : participantId
        ? [participantId]
        : [];
    if (!ids.length) return;

    await haptics.light();
    if (ids.length === 1) {
      sendMessage.mutate({
        receiverId: ids[0],
        content: messageText.trim(),
        conversationId: id,
      });
      return;
    }
    sendGroupMessage.mutate({
      receiverIds: ids,
      content: messageText.trim(),
      conversationId: id,
    });
  };

  const handleBack = async () => {
    await haptics.light();
    navigateToHome();
  };

  const handleDeleteConversation = () => {
    const runDelete = async () => {
      try {
        await deleteConversation.mutateAsync({ conversationId: id || "" });
        setShowConversationDetails(false);
        navigateToHome();
      } catch (error: any) {
        Alert.alert("Delete failed", error?.message || "Unable to delete this conversation.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete this entire conversation?")) {
        void runDelete();
      }
      return;
    }

    Alert.alert("Delete conversation", "Delete this entire conversation?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void runDelete() },
    ]);
  };

  const handleOpenConversationDetails = async () => {
    await haptics.light();
    setShowConversationDetails(true);
  };

  const handleLongPress = async (messageId: string) => {
    await haptics.medium();
    setSelectedMessageId(messageId);
    setShowMessageActions(true);
  };

  const handleToggleReaction = async (messageId: string, reaction: string) => {
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

  const confirmDeleteSelectedMessage = () => {
    if (!selectedMessageId) return;

    const runDelete = async () => {
      try {
        await deleteMessage.mutateAsync({ id: selectedMessageId });
      } catch (error: any) {
        Alert.alert("Delete failed", error?.message || "Unable to delete this message.");
      } finally {
        if (editingMessageId === selectedMessageId) {
          setEditingMessageId(null);
          setMessageText("");
        }
        setShowMessageActions(false);
        setSelectedMessageId(null);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Delete this message?")) {
        void runDelete();
      }
      return;
    }

    Alert.alert("Delete message", "Delete this message?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void runDelete() },
    ]);
  };

  const handleSelectImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `image-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";
      const base64 =
        asset.base64 ||
        (await FileSystem.readAsStringAsync(asset.uri, {
          encoding: "base64",
        }));
      const uploadResult = await uploadAttachment.mutateAsync({
        fileName,
        fileData: base64,
        mimeType,
      });

      await haptics.light();
      const ids = participantIds
        ? participantIds
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
        : participantId
          ? [participantId]
          : [];
      if (!ids.length) return;
      if (ids.length === 1) {
        sendWithAttachment.mutate({
          receiverId: ids[0],
          content: "Image",
          conversationId: id,
          messageType: "image",
          attachmentUrl: uploadResult.url,
          attachmentName: fileName,
          attachmentSize: asset.fileSize,
          attachmentMimeType: mimeType,
        });
        return;
      }
      sendGroupWithAttachment.mutate({
        receiverIds: ids,
        content: "Image",
        conversationId: id,
        messageType: "image",
        attachmentUrl: uploadResult.url,
        attachmentName: fileName,
        attachmentSize: asset.fileSize,
        attachmentMimeType: mimeType,
      });
    }
  };

  const handleSelectFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = asset.name || `file-${Date.now()}`;
      const mimeType = asset.mimeType || "application/octet-stream";
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: "base64",
      });
      const uploadResult = await uploadAttachment.mutateAsync({
        fileName,
        fileData: base64,
        mimeType,
      });

      await haptics.light();
      const ids = participantIds
        ? participantIds
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
        : participantId
          ? [participantId]
          : [];
      if (!ids.length) return;
      if (ids.length === 1) {
        sendWithAttachment.mutate({
          receiverId: ids[0],
          content: fileName,
          conversationId: id,
          messageType: "file",
          attachmentUrl: uploadResult.url,
          attachmentName: fileName,
          attachmentSize: asset.size,
          attachmentMimeType: mimeType,
        });
        return;
      }
      sendGroupWithAttachment.mutate({
        receiverIds: ids,
        content: fileName,
        conversationId: id,
        messageType: "file",
        attachmentUrl: uploadResult.url,
        attachmentName: fileName,
        attachmentSize: asset.size,
        attachmentMimeType: mimeType,
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
  const groupParticipantCount = participantIds
    ? participantIds
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0).length
    : 0;
  const detailsSubtitle = otherUserTyping ? "typing..." : "Tap for details";
  const selectedMessage = selectedMessageId
    ? messageList.find((msg) => msg.id === selectedMessageId) || null
    : null;
  const canEditSelectedMessage = Boolean(
    selectedMessage &&
      selectedMessage.senderId === user?.id &&
      selectedMessage.messageType === "text"
  );

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
          <IconSymbol name={(groupIcon as any) || "person.fill"} size={20} color={colors.primary} />
        </View>

        <TouchableOpacity
          className="flex-1 ml-3"
          onPress={handleOpenConversationDetails}
          accessibilityRole="button"
          accessibilityLabel="Open conversation details"
          testID="conversation-details-trigger"
        >
          <Text className="text-foreground font-semibold text-lg" numberOfLines={1}>
            {name || "Conversation"}
          </Text>
          <Text className="text-xs text-muted">
            {detailsSubtitle}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        className="flex-1"
      >
        {/* Messages */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messageList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwn={item.senderId === user?.id}
                colors={colors}
                reactions={reactions as Reaction[]}
                userId={user?.id || ""}
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

        <View
          className="flex-row items-end px-4 py-3 bg-surface border-t border-border"
          style={{
            paddingBottom: Platform.OS === "web" ? 12 : Math.max(insets.bottom, 12),
          }}
        >
          {editingMessageId ? (
            <View className="absolute left-4 right-4 -top-14 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 flex-row items-center justify-between">
              <Text className="text-primary text-sm font-medium">Editing message</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingMessageId(null);
                  setMessageText("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel editing message"
                testID="cancel-edit-message"
              >
                <Text className="text-primary font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}

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
              style={
                Platform.OS === "web"
                  ? ({
                    outlineWidth: 0,
                    outlineStyle: "solid",
                    outlineColor: "transparent",
                    boxShadow: "none",
                    WebkitBoxShadow: "none",
                    borderWidth: 0,
                    WebkitTapHighlightColor: "transparent",
                  } as any)
                  : undefined
              }
              value={messageText}
              onChangeText={handleTextChange}
              multiline
              returnKeyType="default"
              blurOnSubmit={false}
              onKeyPress={(e) => {
                if (e.nativeEvent.key === "Enter" && !(e as any).shiftKey) {
                  e.preventDefault?.();
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
            className={`w-11 h-11 rounded-full items-center justify-center ${messageText.trim() ? "bg-primary" : "bg-surface border border-border"
              }`}
            onPress={handleSend}
            disabled={!messageText.trim() || sendMessage.isPending || editMessage.isPending}
            accessibilityRole="button"
            accessibilityLabel={editingMessageId ? "Save edited message" : "Send message"}
            testID="send-message-btn"
          >
            {sendMessage.isPending || editMessage.isPending ? (
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

      <MessageActionsModal
        visible={showMessageActions}
        canEdit={canEditSelectedMessage}
        onClose={() => {
          setShowMessageActions(false);
          setSelectedMessageId(null);
        }}
        onReact={() => {
          setShowMessageActions(false);
          setShowEmojiPicker(true);
        }}
        onEdit={() => {
          if (!selectedMessage || !canEditSelectedMessage) return;
          setMessageText(selectedMessage.content);
          setEditingMessageId(selectedMessage.id);
          setShowMessageActions(false);
          setSelectedMessageId(null);
        }}
        onDelete={confirmDeleteSelectedMessage}
      />

      {/* Attachment Picker Modal */}
      <AttachmentPicker
        visible={showAttachmentPicker}
        onClose={() => setShowAttachmentPicker(false)}
        onSelectImage={handleSelectImage}
        onSelectFile={handleSelectFile}
        colors={colors}
      />

      <Modal
        visible={showConversationDetails}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConversationDetails(false)}
      >
        <Pressable
          className="flex-1 justify-center items-center bg-black/50 px-6"
          onPress={() => setShowConversationDetails(false)}
        >
          <Pressable className="w-full max-w-md rounded-2xl bg-surface border border-border p-5">
            <Text className="text-foreground text-lg font-semibold mb-1">
              Conversation details
            </Text>
            <Text className="text-muted text-sm mb-4">
              {name || "Conversation"}
            </Text>
            <View className="gap-2">
              <Text className="text-foreground text-sm">
                Conversation ID: {id || "Unavailable"}
              </Text>
              <Text className="text-foreground text-sm">
                Type: {groupParticipantCount > 1 ? "Group chat" : "Direct chat"}
              </Text>
              <Text className="text-foreground text-sm">
                Participants: {groupParticipantCount > 1 ? groupParticipantCount : 2}
              </Text>
            </View>
            <TouchableOpacity
              className="mt-4 rounded-xl bg-error/10 px-4 py-3 items-center"
              onPress={handleDeleteConversation}
              accessibilityRole="button"
              accessibilityLabel="Delete this conversation"
              testID="delete-conversation-btn"
            >
              <Text className="text-error font-semibold">Delete conversation</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-5 rounded-xl bg-primary px-4 py-3 items-center"
              onPress={() => setShowConversationDetails(false)}
              accessibilityRole="button"
              accessibilityLabel="Close conversation details"
              testID="conversation-details-close"
            >
              <Text className="text-background font-semibold">Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
