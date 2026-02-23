import { NavigationHeader } from "@/components/navigation-header";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { haptics } from "@/hooks/use-haptics";
import { useWebSocket } from "@/hooks/use-websocket";
import { trpc } from "@/lib/trpc";
import { LOCO_ASSISTANT_NAME, LOCO_ASSISTANT_USER_ID } from "@/shared/const";
import { Stack } from "expo-router";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AssistantMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  messageType?: "text" | "image" | "file" | "system";
  attachmentName?: string | null;
};

function formatDuration(durationMillis: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function guessAudioMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".caf")) return "audio/x-caf";
  return "audio/mp4";
}

function extractAudioExtension(uri: string): string {
  const match = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return (match?.[1] || "m4a").toLowerCase();
}

function formatTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function MessageBubble({
  item,
  isOwn,
  colors,
}: {
  item: AssistantMessage;
  isOwn: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View className={`px-4 mb-3 ${isOwn ? "items-end" : "items-start"}`}>
      <View
        className={`max-w-[88%] rounded-2xl px-3 py-2 ${
          isOwn ? "bg-primary" : "bg-surface border border-border"
        }`}
      >
        <Text className={isOwn ? "text-background" : "text-foreground"}>
          {item.content?.trim() ||
            (item.messageType === "image"
              ? "[Image]"
              : item.attachmentName || "[Message]")}
        </Text>
      </View>
      <Text className="text-[11px] text-muted mt-1">
        {isOwn ? "You" : LOCO_ASSISTANT_NAME} • {formatTimeLabel(item.createdAt)}
      </Text>
      {!isOwn && !item.readAt && item.senderId === LOCO_ASSISTANT_USER_ID ? (
        <View className="w-1.5 h-1.5 rounded-full mt-1" style={{ backgroundColor: colors.primary }} />
      ) : null}
    </View>
  );
}

function TypingIndicator({ colors }: { colors: ReturnType<typeof useColors> }) {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animateDot = (dotValue: typeof dot1, delay: number) => {
      dotValue.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-4, { duration: 300 }),
            withTiming(0, { duration: 300 }),
          ),
          -1,
          false,
        ),
      );
    };
    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, [dot1, dot2, dot3]);

  const dot1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const dot2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const dot3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <View className="px-4 py-2 items-start">
      <View className="flex-row items-center">
        <Text className="text-xs text-muted mr-2">{LOCO_ASSISTANT_NAME} is typing</Text>
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

export default function TrainerAssistantScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const utils = trpc.useUtils();
  const { connect, disconnect, subscribe } = useWebSocket();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [inputText, setInputText] = useState("");
  const [hasConversation, setHasConversation] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [botTyping, setBotTyping] = useState(false);

  const flatListRef = useRef<FlatList<AssistantMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const markingReadIdsRef = useRef<Set<string>>(new Set());

  const conversationId = user?.id ? `bot-${user.id}` : "";

  const conversationsQuery = trpc.messages.conversations.useQuery(undefined, {
    enabled: Boolean(user?.id),
  });

  const threadQuery = trpc.messages.thread.useQuery(
    { conversationId },
    {
      enabled: Boolean(conversationId && hasConversation),
      refetchInterval: hasConversation ? 12_000 : false,
    },
  );

  const markRead = trpc.messages.markRead.useMutation();
  const sendToBot = trpc.messages.sendToBot.useMutation({
    onSuccess: async () => {
      setInputText("");
      setHasConversation(true);
      setBotTyping(true);
      await Promise.all([
        utils.messages.conversations.invalidate(),
        threadQuery.refetch(),
      ]);
      setTimeout(() => {
        void threadQuery.refetch();
      }, 1200);
    },
    onError: (error) => {
      setBotTyping(false);
      Alert.alert("Message failed", error.message || "Could not send message to assistant.");
    },
  });

  const uploadAttachment = trpc.messages.uploadAttachment.useMutation({
    onError: (error) => {
      Alert.alert("Upload failed", error.message || "Could not upload recorded audio.");
    },
  });

  const transcribeVoice = trpc.voice.transcribe.useMutation({
    onError: (error) => {
      Alert.alert("Transcription failed", error.message || "Could not transcribe audio.");
    },
  });

  useEffect(() => {
    if (!conversationId) {
      setHasConversation(false);
      return;
    }
    const exists = (conversationsQuery.data ?? []).some((conversation: any) => {
      const id = String(conversation.id || conversation.conversationId || "");
      return id === conversationId;
    });
    if (exists) {
      setHasConversation(true);
    }
  }, [conversationId, conversationsQuery.data]);

  useEffect(() => {
    if (!conversationId || !user?.id) return;
    connect();
    const unsubscribe = subscribe((message) => {
      if (message.type === "new_message" && message.conversationId === conversationId) {
        setHasConversation(true);
        setBotTyping(false);
        void threadQuery.refetch();
        void utils.messages.conversations.invalidate();
      }
      if (
        message.type === "typing_start" &&
        message.conversationId === conversationId &&
        message.userId === LOCO_ASSISTANT_USER_ID
      ) {
        setBotTyping(true);
      }
      if (
        message.type === "typing_stop" &&
        message.conversationId === conversationId &&
        message.userId === LOCO_ASSISTANT_USER_ID
      ) {
        setBotTyping(false);
      }
    });
    return () => {
      unsubscribe();
      disconnect();
    };
  }, [connect, conversationId, disconnect, subscribe, threadQuery.refetch, user?.id, utils]);

  const messages = useMemo<AssistantMessage[]>(() => {
    return (threadQuery.data ?? []).map((message: any) => ({
      id: String(message.id),
      senderId: String(message.senderId),
      content: String(message.content ?? ""),
      createdAt: String(message.createdAt || new Date().toISOString()),
      readAt: message.readAt || null,
      messageType: message.messageType || "text",
      attachmentName: message.attachmentName || null,
    }));
  }, [threadQuery.data]);

  useEffect(() => {
    if (!messages.length || !user?.id) return;
    const unreadIncoming = messages.filter(
      (message) =>
        message.senderId !== user.id &&
        !message.readAt &&
        !markingReadIdsRef.current.has(message.id),
    );
    unreadIncoming.forEach((message) => {
      markingReadIdsRef.current.add(message.id);
      markRead.mutate(
        { id: message.id },
        {
          onError: () => {
            markingReadIdsRef.current.delete(message.id);
          },
        },
      );
    });
  }, [markRead, messages, user?.id]);

  useEffect(() => {
    if (!messages.length && !botTyping) return;
    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(timeout);
  }, [messages.length, botTyping]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sendToBot.isPending) return;
    await haptics.light();
    await sendToBot.mutateAsync({ content: text });
  };

  const startRecording = async () => {
    if (recordingBusy || recorderState.isRecording) return;
    setRecordingBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Allow microphone access to record voice instructions.");
        return;
      }
      if (Platform.OS === "ios") {
        await setAudioModeAsync({ playsInSilentMode: true });
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      await haptics.light();
    } catch (error: any) {
      Alert.alert("Recording failed", error?.message || "Could not start recording.");
    } finally {
      setRecordingBusy(false);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (recordingBusy || !recorderState.isRecording) return;
    setRecordingBusy(true);
    try {
      await recorder.stop();
      const status = recorder.getStatus();
      const audioUri = status.url || recorder.uri || recorderState.url;
      if (!audioUri) {
        throw new Error("No recording file was produced.");
      }

      const fileInfo = await FileSystem.getInfoAsync(audioUri);
      if (!fileInfo.exists) {
        throw new Error("Recorded file does not exist.");
      }
      const size = fileInfo.size;
      if (size && size > 8 * 1024 * 1024) {
        throw new Error("Voice note exceeds 8 MB upload limit.");
      }

      const base64 = await FileSystem.readAsStringAsync(audioUri, {
        encoding: "base64",
      });
      if (!base64) {
        throw new Error("Recorded file could not be read.");
      }

      const extension = extractAudioExtension(audioUri);
      const fileName = `voice-note-${Date.now()}.${extension}`;
      const mimeType = guessAudioMimeType(audioUri);

      const upload = await uploadAttachment.mutateAsync({
        fileName,
        fileData: base64,
        mimeType,
      });

      const transcript = await transcribeVoice.mutateAsync({
        audioUrl: upload.url,
      });

      const transcriptionText = transcript.text?.trim();
      if (!transcriptionText) {
        Alert.alert("No speech detected", "Try recording again with clearer audio.");
        return;
      }

      setInputText((current) => (current.trim() ? `${current}\n${transcriptionText}` : transcriptionText));
      inputRef.current?.focus();
      await haptics.light();
    } catch (error: any) {
      Alert.alert("Voice transcription failed", error?.message || "Unable to process this recording.");
    } finally {
      setRecordingBusy(false);
    }
  };

  const handleRecordPress = async () => {
    if (recorderState.isRecording) {
      await stopRecordingAndTranscribe();
      return;
    }
    await startRecording();
  };

  const isBusy = sendToBot.isPending || recordingBusy || uploadAttachment.isPending || transcribeVoice.isPending;

  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer edges={["left", "right"]}>
        <NavigationHeader
          title={LOCO_ASSISTANT_NAME}
          subtitle="Automate invites, bundles, and client analytics."
          showBack
          showHome
        />

        <View className="px-4 py-2 bg-surface border-b border-border">
          <Text className="text-xs text-muted">
            Try: &quot;Invite all clients to bundles based on our chats&quot; or
            &quot;Show a graph of messages vs revenue by client.&quot;
          </Text>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingTop: 14,
              paddingBottom: 14,
              flexGrow: messages.length ? 0 : 1,
            }}
            renderItem={({ item }) => (
              <MessageBubble item={item} isOwn={item.senderId === user?.id} colors={colors} />
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-8">
                {threadQuery.isLoading || conversationsQuery.isLoading ? (
                  <>
                    <ActivityIndicator color={colors.primary} />
                    <Text className="text-sm text-muted mt-3">Loading assistant chat...</Text>
                  </>
                ) : (
                  <>
                    <View className="w-14 h-14 rounded-full bg-primary/10 items-center justify-center mb-4">
                      <IconSymbol name="sparkles" size={26} color={colors.primary} />
                    </View>
                    <Text className="text-base text-foreground font-semibold text-center">
                      Start with a message or voice note
                    </Text>
                    <Text className="text-sm text-muted text-center mt-2">
                      I can suggest bundles, draft invites, and produce graph-ready client performance data.
                    </Text>
                  </>
                )}
              </View>
            }
            ListFooterComponent={
              botTyping ? <TypingIndicator colors={colors} /> : null
            }
          />

          <View
            className="border-t border-border bg-surface px-3 pt-2"
            style={{ paddingBottom: Math.max(insets.bottom, 10) }}
          >
            {recorderState.isRecording ? (
              <View className="flex-row items-center mb-2 px-1">
                <IconSymbol name="record.circle.fill" size={14} color={colors.error} />
                <Text className="text-xs text-muted ml-1.5">
                  Recording {formatDuration(recorderState.durationMillis)}...
                </Text>
              </View>
            ) : uploadAttachment.isPending || transcribeVoice.isPending ? (
              <View className="flex-row items-center mb-2 px-1">
                <ActivityIndicator size="small" color={colors.primary} />
                <Text className="text-xs text-muted ml-2">Transcribing voice note...</Text>
              </View>
            ) : null}

            <View className="flex-row items-end">
              <TouchableOpacity
                className={`w-11 h-11 rounded-full items-center justify-center ${
                  recorderState.isRecording ? "bg-error" : "bg-primary/10"
                }`}
                onPress={handleRecordPress}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel={recorderState.isRecording ? "Stop recording" : "Record voice"}
                testID="assistant-record-voice"
              >
                <IconSymbol
                  name={recorderState.isRecording ? "stop.fill" : "mic.fill"}
                  size={19}
                  color={recorderState.isRecording ? colors.background : colors.primary}
                />
              </TouchableOpacity>

              <View className="flex-1 mx-2 rounded-2xl border border-border bg-background px-3 py-2">
                <TextInput
                  ref={inputRef}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask the assistant to automate a task..."
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={4000}
                  className="text-foreground min-h-[40px]"
                  testID="assistant-input"
                />
              </View>

              <TouchableOpacity
                className={`w-11 h-11 rounded-full items-center justify-center ${
                  inputText.trim().length > 0 && !isBusy ? "bg-primary" : "bg-muted/40"
                }`}
                onPress={handleSend}
                disabled={inputText.trim().length === 0 || isBusy}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                testID="assistant-send"
              >
                {sendToBot.isPending ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <IconSymbol name="arrow.up" size={18} color={colors.background} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </>
  );
}
