import { IconSymbol } from "@/components/ui/icon-symbol";
import { SwipeDownSheet } from "@/components/swipe-down-sheet";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { useWebSocket } from "@/hooks/use-websocket";
import { navigateToHome } from "@/lib/navigation";
import { trpc } from "@/lib/trpc";
import { LOCO_ASSISTANT_USER_ID } from "@/shared/const";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
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

const WAVEFORM_BAR_COUNT = 48;
const WAVEFORM_MIN_H = 2;
const WAVEFORM_MAX_H = 34;

function meterToHeight(metering: number | undefined): number {
  if (metering === undefined || metering === null) return WAVEFORM_MIN_H;
  const clamped = Math.max(-50, Math.min(0, metering));
  const normalized = Math.pow((clamped + 50) / 50, 0.7);
  return WAVEFORM_MIN_H + normalized * (WAVEFORM_MAX_H - WAVEFORM_MIN_H);
}

function useWebMicMeter(isRecording: boolean, intervalMs = 100): number | undefined {
  const [db, setDb] = useState<number | undefined>(undefined);
  const ctxRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (!isRecording) {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t: any) => t.stop());
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      analyserRef.current = null;
      streamRef.current = null;
      setDb(undefined);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        timerRef.current = setInterval(() => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const dbValue = avg > 0 ? -60 + (avg / 255) * 60 : -60;
          setDb(dbValue);
        }, intervalMs);
      } catch {
        setDb(undefined);
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t: any) => t.stop());
      ctxRef.current?.close().catch(() => {});
    };
  }, [isRecording, intervalMs]);

  return db;
}

function LiveWaveform({ metering, isRecording, colors }: { metering: number | undefined; isRecording: boolean; colors: any }) {
  const webMeter = useWebMicMeter(Platform.OS === "web" && isRecording, 100);
  const activeMeter = Platform.OS === "web" ? webMeter : metering;

  const [bars, setBars] = useState<number[]>(() => new Array(WAVEFORM_BAR_COUNT).fill(WAVEFORM_MIN_H));

  useEffect(() => {
    setBars((prev) => {
      const next = [...prev.slice(1), meterToHeight(activeMeter)];
      return next;
    });
  }, [activeMeter]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 1.5, height: WAVEFORM_MAX_H }}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: 2.5,
            height: h,
            borderRadius: 1.5,
            backgroundColor: colors.primary,
            opacity: 0.4 + (i / WAVEFORM_BAR_COUNT) * 0.6,
          }}
        />
      ))}
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
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.85)" }}
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
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" }}
        onPress={onClose}
      >
        <SwipeDownSheet
          visible={visible}
          onClose={onClose}
          style={{ backgroundColor: colors.surface, padding: 16, paddingBottom: 32, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        >
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
        </SwipeDownSheet>
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
      <Pressable style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.85)" }} onPress={onClose}>
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

function estimateBase64SizeBytes(base64: string): number {
  const sanitized = base64.replace(/\s/g, "");
  const padding = sanitized.endsWith("==") ? 2 : sanitized.endsWith("=") ? 1 : 0;
  return Math.floor((sanitized.length * 3) / 4) - padding;
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
  onImagePress,
}: {
  message: Message;
  isOwn: boolean;
  colors: any;
  reactions: Reaction[];
  userId: string;
  onLongPress: (messageId: string) => void;
  onToggleReaction: (messageId: string, reaction: string) => void;
  onImagePress?: (url: string) => void;
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
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onImagePress?.(message.attachmentUrl!)}
          accessibilityRole="button"
          accessibilityLabel="View image fullscreen"
        >
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
        </TouchableOpacity>
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
  const [typingUserName, setTypingUserName] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markingReadIdsRef = useRef<Set<string>>(new Set());

  const isAssistantChat = participantId === LOCO_ASSISTANT_USER_ID || id?.startsWith("bot-");
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, 100);

  const allParticipantIds = useMemo(() => {
    const ids = new Set<string>();
    if (user?.id) ids.add(user.id);
    if (participantId) ids.add(participantId);
    if (participantIds) {
      participantIds.split(",").map((v) => v.trim()).filter(Boolean).forEach((v) => ids.add(v));
    }
    return Array.from(ids);
  }, [user?.id, participantId, participantIds]);

  const utils = trpc.useUtils();

  const { connect, disconnect, subscribe, sendTypingStart, sendTypingStop } = useWebSocket();

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

  const [participantList, setParticipantList] = useState<Array<{
    id: string; name: string; photoUrl: string | null; role: string | null;
  }>>([]);

  useEffect(() => {
    if (!allParticipantIds.length) return;
    let cancelled = false;
    Promise.all(
      allParticipantIds.map(async (pid) => {
        try {
          const profile = await utils.catalog.trainerProfile.fetch({ id: pid });
          return {
            id: pid,
            name: (profile as any)?.name || "Unknown",
            photoUrl: (profile as any)?.photoUrl || null,
            role: (profile as any)?.role || null,
          };
        } catch {
          return {
            id: pid,
            name: pid === user?.id ? (user?.name || "You") : "Unknown",
            photoUrl: null,
            role: null,
          };
        }
      }),
    ).then((profiles) => {
      if (!cancelled) setParticipantList(profiles);
    });
    return () => { cancelled = true; };
  }, [allParticipantIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time message updates via WebSocket
  useEffect(() => {
    if (!isAuthenticated) return;
    connect();
    const unsubscribe = subscribe((msg) => {
      if (msg.type === "new_message" && msg.conversationId === id) {
        refetch();
        utils.messages.conversations.invalidate();
        return;
      }
      if (msg.type === "typing_start" && msg.conversationId === id && msg.userId !== user?.id) {
        setTypingUserName(msg.userName || String(name || "User"));
        setOtherUserTyping(true);
        return;
      }
      if (msg.type === "typing_stop" && msg.conversationId === id && msg.userId !== user?.id) {
        setOtherUserTyping(false);
        setTypingUserName(null);
      }
    });
    return () => {
      unsubscribe();
      disconnect();
    };
  }, [id, isAuthenticated, connect, disconnect, subscribe, refetch, utils, user?.id, name]);

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
    onError: (error: any) => {
      Alert.alert("Send failed", error?.message || "Unable to send attachment.");
    },
  });
  const sendGroupWithAttachment = trpc.messages.sendGroupWithAttachment.useMutation({
    onSuccess: () => {
      refetch();
      utils.messages.conversations.invalidate();
    },
    onError: (error: any) => {
      Alert.alert("Send failed", error?.message || "Unable to send attachment.");
    },
  });
  const uploadAttachment = trpc.messages.uploadAttachment.useMutation({
    onError: (error: any) => {
      Alert.alert("Upload failed", error?.message || "Unable to upload attachment.");
    },
  });
  const transcribeVoice = trpc.voice.transcribe.useMutation();

  const handleVoicePress = async () => {
    if (voiceBusy) return;

    if (recorderState.isRecording) {
      setVoiceBusy(true);
      try {
        await recorder.stop();
        const status = recorder.getStatus();
        const audioUri = status.url || recorder.uri || recorderState.url;
        if (!audioUri) throw new Error("No recording file was produced.");

        let base64: string;
        let ext: string;
        let mimeType: string;

        if (Platform.OS === "web") {
          const response = await fetch(audioUri);
          const blob = await response.blob();
          mimeType = blob.type || "audio/webm";
          ext = mimeType.includes("webm") ? "webm" : mimeType.includes("mp4") ? "m4a" : "webm";
          base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1] || "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          const fileInfo = await FileSystem.getInfoAsync(audioUri);
          if (!fileInfo.exists) throw new Error("Recorded file does not exist.");
          base64 = await FileSystem.readAsStringAsync(audioUri, { encoding: "base64" });
          ext = (audioUri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || "m4a").toLowerCase();
          const mimeMap: Record<string, string> = { webm: "audio/webm", wav: "audio/wav", ogg: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", caf: "audio/x-caf" };
          mimeType = mimeMap[ext] || "audio/mp4";
        }

        if (!base64) throw new Error("Recorded file could not be read.");

        const upload = await uploadAttachment.mutateAsync({
          fileName: `voice-${Date.now()}.${ext}`,
          fileData: base64,
          mimeType,
        });

        const transcript = await transcribeVoice.mutateAsync({ audioUrl: upload.url });
        const text = transcript.text?.trim();
        if (!text) {
          Alert.alert("No speech detected", "Try recording again with clearer audio.");
          return;
        }

        if (isAssistantChat) {
          const ids = participantIds
            ? participantIds.split(",").map((v) => v.trim()).filter(Boolean)
            : participantId ? [participantId] : [];
          if (ids.length === 1) {
            sendMessage.mutate({ receiverId: ids[0], content: text, conversationId: id });
          } else if (ids.length > 1) {
            sendGroupMessage.mutate({ receiverIds: ids, content: text, conversationId: id });
          }
        } else {
          setMessageText((prev) => (prev.trim() ? `${prev} ${text}` : text));
        }
        await haptics.light();
      } catch (error: any) {
        Alert.alert("Voice failed", error?.message || "Unable to process recording.");
      } finally {
        setVoiceBusy(false);
      }
      return;
    }

    setVoiceBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Allow microphone access to record voice.");
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      await haptics.light();
    } catch (error: any) {
      Alert.alert("Recording failed", error?.message || "Could not start recording.");
    } finally {
      setVoiceBusy(false);
    }
  };

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

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (id) {
        sendTypingStop(id);
      }
    };
  }, [id, sendTypingStop]);

  // Handle text input changes for typing indicator
  const handleTextChange = useCallback((text: string) => {
    setMessageText(text);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    const hasText = text.trim().length > 0;

    if (!hasText) {
      if (isTyping && id) {
        sendTypingStop(id);
      }
      setIsTyping(false);
      return;
    }

    if (!isTyping && id) {
      setIsTyping(true);
      sendTypingStart(id, String(user?.name || "User"));
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (id) {
        sendTypingStop(id);
      }
    }, 1500);
  }, [id, isTyping, sendTypingStart, sendTypingStop, user?.name]);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (id) {
      sendTypingStop(id);
    }
    setIsTyping(false);

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
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission required", "Allow photo access to send images in chat.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
        exif: false,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const fileName = asset.fileName || `image-${Date.now()}.jpg`;
      const mimeType = asset.mimeType?.startsWith("image/") ? asset.mimeType : "image/jpeg";
      let base64 = asset.base64 || "";

      // iOS can return a library URI without inline base64; read from file URI as fallback.
      if (!base64) {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: "base64",
        });
      }
      if (!base64) {
        Alert.alert("Image unavailable", "Could not read this photo. Try a different image.");
        return;
      }

      const bytes = estimateBase64SizeBytes(base64);
      if (bytes > 8 * 1024 * 1024) {
        Alert.alert("Image too large", "Please choose a smaller image (max 8 MB).");
        return;
      }

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
          attachmentSize: asset.fileSize ?? bytes,
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
        attachmentSize: asset.fileSize ?? bytes,
        attachmentMimeType: mimeType,
      });
    } catch (error: any) {
      Alert.alert("Photo send failed", error?.message || "Unable to send this photo right now.");
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
        keyboardVerticalOffset={0}
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
                onImagePress={setFullscreenImageUrl}
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
                <TypingIndicator name={typingUserName || String(name || "User")} colors={colors} />
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
            paddingBottom:
              Platform.OS === "web"
                ? 12
                : isKeyboardVisible
                  ? 6
                  : Math.max(insets.bottom, 12),
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

          {/* Left button: attachment (default) or cancel (recording) */}
          {recorderState.isRecording ? (
            <TouchableOpacity
              className="w-10 h-10 rounded-full items-center justify-center mr-2 bg-surface border border-border"
              onPress={() => { recorder.stop(); setVoiceBusy(false); }}
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
              testID="conversation-voice-cancel"
            >
              <IconSymbol name="xmark" size={16} color={colors.muted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="w-10 h-10 rounded-full items-center justify-center mr-2"
              onPress={() => setShowAttachmentPicker(true)}
              disabled={voiceBusy || transcribeVoice.isPending}
              accessibilityRole="button"
              accessibilityLabel="Open attachment options"
              testID="conversation-open-attachments"
            >
              <IconSymbol name="plus.circle.fill" size={28} color={voiceBusy ? colors.muted : colors.primary} />
            </TouchableOpacity>
          )}

          {/* Input area: fixed height, shows text input / waveform / transcribing */}
          <View
            className="flex-1 flex-row items-center bg-background rounded-2xl border border-border mr-2"
            style={{ height: 44, paddingHorizontal: 16 }}
          >
            {recorderState.isRecording ? (
              <LiveWaveform metering={recorderState.metering} isRecording={recorderState.isRecording} colors={colors} />
            ) : voiceBusy || transcribeVoice.isPending ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-sm text-muted ml-2">Transcribing...</Text>
              </>
            ) : (
              <>
                <TextInput
                  className="flex-1 text-foreground text-base"
                  style={[
                    { height: 40 },
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
                      : undefined,
                  ]}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.muted}
                  value={messageText}
                  onChangeText={handleTextChange}
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
                {!messageText.trim() && (
                  <TouchableOpacity
                    className="ml-2 w-8 h-8 rounded-full items-center justify-center"
                    onPress={handleVoicePress}
                    disabled={voiceBusy || uploadAttachment.isPending || transcribeVoice.isPending}
                    accessibilityRole="button"
                    accessibilityLabel="Record voice message"
                    testID="conversation-voice-btn"
                  >
                    <IconSymbol name="mic" size={18} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Right button: send (default) or stop+send (recording) */}
          {recorderState.isRecording ? (
            <TouchableOpacity
              className="w-11 h-11 rounded-full items-center justify-center bg-primary"
              onPress={handleVoicePress}
              accessibilityRole="button"
              accessibilityLabel="Stop recording and send"
              testID="conversation-voice-stop"
            >
              <IconSymbol name="arrow.up" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className={`w-11 h-11 rounded-full items-center justify-center ${messageText.trim() ? "bg-primary" : "bg-surface border border-border"}`}
              onPress={handleSend}
              disabled={!messageText.trim() || sendMessage.isPending || editMessage.isPending || voiceBusy}
              accessibilityRole="button"
              accessibilityLabel={editingMessageId ? "Save edited message" : "Send message"}
              testID="send-message-btn"
            >
              {sendMessage.isPending || editMessage.isPending || voiceBusy ? (
                <ActivityIndicator size="small" color={messageText.trim() ? "#fff" : colors.muted} />
              ) : (
                <IconSymbol
                  name="paperplane.fill"
                  size={20}
                  color={messageText.trim() ? "#fff" : colors.muted}
                />
              )}
            </TouchableOpacity>
          )}
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
          style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, backgroundColor: "rgba(0,0,0,0.85)" }}
          onPress={() => setShowConversationDetails(false)}
        >
          <Pressable
            className="w-full max-w-md rounded-2xl border border-border p-5"
            style={{
              backgroundColor: colors.surface,
              shadowColor: "#000",
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
            }}
          >
            <Text className="text-foreground text-lg font-semibold mb-1">
              Conversation details
            </Text>
            <Text className="text-muted text-sm mb-4">
              {name || "Conversation"} · {groupParticipantCount > 1 ? "Group" : "Direct"} · {participantList.length} members
            </Text>

            <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-2">
              Members
            </Text>
            <View className="gap-1 mb-2">
              {participantList.map((p) => (
                <View key={p.id} className="flex-row items-center py-2">
                  {p.photoUrl ? (
                    <Image
                      source={{ uri: p.photoUrl }}
                      className="w-9 h-9 rounded-full mr-3"
                    />
                  ) : (
                    <View
                      className="w-9 h-9 rounded-full mr-3 items-center justify-center"
                      style={{ backgroundColor: colors.primary + "20" }}
                    >
                      <Text className="text-primary font-semibold text-sm">
                        {(p.name || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-foreground text-sm font-medium">
                      {p.name}{p.id === user?.id ? " (you)" : ""}
                    </Text>
                    {p.role ? (
                      <Text className="text-muted text-xs capitalize">{p.role}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
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

      {/* Fullscreen Image Viewer */}
      <Modal
        visible={!!fullscreenImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenImageUrl(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setFullscreenImageUrl(null)}
        >
          <TouchableOpacity
            style={{ position: "absolute", top: insets.top + 12, right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
            onPress={() => setFullscreenImageUrl(null)}
            accessibilityRole="button"
            accessibilityLabel="Close image"
            testID="fullscreen-image-close"
          >
            <IconSymbol name="xmark" size={20} color="#fff" />
          </TouchableOpacity>
          {fullscreenImageUrl ? (
            <Image
              source={{ uri: fullscreenImageUrl }}
              style={{ width: "92%", height: "75%", borderRadius: 8 }}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
