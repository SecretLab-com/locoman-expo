import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { useShareIntentContext } from "expo-share-intent";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Conversation = {
  id: string;
  conversationId: string;
  otherUserId?: string;
  otherUserName?: string;
  otherUserAvatar?: string | null;
  otherUserRole?: string;
};

export default function ShareIntentScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuthContext();
  const { shareIntent, resetShareIntent } = useShareIntentContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [sending, setSending] = useState(false);

  const { data: conversations, isLoading } = trpc.messages.conversations.useQuery(
    undefined,
    { enabled: isAuthenticated },
  );

  const sendMessage = trpc.messages.send.useMutation();
  const sendWithAttachment = trpc.messages.sendWithAttachment.useMutation();
  const uploadAttachment = trpc.messages.uploadAttachment.useMutation();

  const sharedText = shareIntent.text || "";
  const sharedUrl = shareIntent.webUrl || "";
  const sharedFiles = shareIntent.files || [];
  const hasContent = Boolean(sharedText || sharedUrl || sharedFiles.length > 0);

  const filteredConversations = (conversations || []).filter((c: Conversation) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    return (c.otherUserName || "").toLowerCase().includes(term);
  });

  const buildMessageContent = useCallback(() => {
    const parts: string[] = [];
    if (sharedText && sharedText !== sharedUrl) {
      parts.push(sharedText);
    }
    if (sharedUrl) {
      parts.push(sharedUrl);
    }
    if (parts.length === 0 && sharedFiles.length > 0) {
      parts.push(`Shared ${sharedFiles.length} file${sharedFiles.length > 1 ? "s" : ""}`);
    }
    return parts.join("\n") || "Shared content";
  }, [sharedText, sharedUrl, sharedFiles]);

  const handleSend = useCallback(async () => {
    if (!selectedConversation?.otherUserId || sending) return;

    setSending(true);
    try {
      const content = buildMessageContent();

      if (sharedFiles.length > 0) {
        const file = sharedFiles[0];
        let attachmentUrl: string | undefined;
        const mimeType = file.mimeType || "application/octet-stream";
        const isImage = mimeType.startsWith("image/");

        if (file.path) {
          try {
            const base64Response = await fetch(file.path);
            const blob = await base64Response.blob();
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            const base64Data = base64.split(",")[1];
            if (base64Data) {
              const result = await uploadAttachment.mutateAsync({
                fileName: file.fileName || "shared-file",
                mimeType,
                fileData: base64Data,
              });
              attachmentUrl = result.url;
            }
          } catch (uploadErr) {
            console.warn("[ShareIntent] Upload failed, sending as text:", uploadErr);
          }
        }

        await sendWithAttachment.mutateAsync({
          receiverId: selectedConversation.otherUserId,
          content,
          conversationId: selectedConversation.conversationId,
          messageType: isImage ? "image" : "file",
          attachmentUrl,
          attachmentName: file.fileName || undefined,
          attachmentSize: file.size || undefined,
          attachmentMimeType: mimeType,
        });
      } else {
        await sendMessage.mutateAsync({
          receiverId: selectedConversation.otherUserId,
          content,
          conversationId: selectedConversation.conversationId,
        });
      }

      resetShareIntent();

      if (Platform.OS === "web") {
        router.replace(`/conversation/${selectedConversation.conversationId}` as any);
      } else {
        Alert.alert("Sent", `Message sent to ${selectedConversation.otherUserName || "contact"}.`, [
          {
            text: "OK",
            onPress: () => {
              router.replace(`/conversation/${selectedConversation.conversationId}` as any);
            },
          },
        ]);
      }
    } catch (err) {
      Alert.alert("Failed", err instanceof Error ? err.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }, [
    selectedConversation,
    sending,
    buildMessageContent,
    sharedFiles,
    sendMessage,
    sendWithAttachment,
    uploadAttachment,
    resetShareIntent,
  ]);

  const handleCancel = useCallback(() => {
    resetShareIntent();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [resetShareIntent]);

  if (!hasContent) {
    return (
      <ScreenContainer className="flex-1">
        <View className="flex-1 items-center justify-center px-6">
          <IconSymbol name="square.and.arrow.up" size={48} color={colors.muted} />
          <Text className="text-lg font-semibold text-foreground mt-4">Nothing to share</Text>
          <Text className="text-muted text-center mt-2">
            No content was received. Try sharing again from another app.
          </Text>
          <TouchableOpacity
            onPress={handleCancel}
            className="mt-6 px-6 py-3 bg-primary rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Close share screen"
            testID="share-intent-close"
          >
            <Text className="text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel sharing"
            testID="share-intent-cancel"
          >
            <Text className="text-primary text-base font-medium">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-foreground">Share To</Text>
          <TouchableOpacity
            onPress={handleSend}
            disabled={!selectedConversation || sending}
            style={{ opacity: selectedConversation && !sending ? 1 : 0.4 }}
            accessibilityRole="button"
            accessibilityLabel="Send shared content"
            testID="share-intent-send"
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text className="text-primary text-base font-semibold">Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Preview */}
      <View className="mx-4 mb-3 p-3 bg-surface rounded-xl border border-border">
        {sharedFiles.length > 0 && sharedFiles[0].mimeType?.startsWith("image/") && sharedFiles[0].path ? (
          <View className="flex-row items-center mb-2">
            <Image
              source={{ uri: sharedFiles[0].path }}
              style={{ width: 48, height: 48, borderRadius: 8 }}
              resizeMode="cover"
            />
            <Text className="text-xs text-muted ml-3 flex-1" numberOfLines={1}>
              {sharedFiles[0].fileName || "Image"}
            </Text>
          </View>
        ) : sharedFiles.length > 0 ? (
          <View className="flex-row items-center mb-2">
            <IconSymbol name="doc.fill" size={24} color={colors.muted} />
            <Text className="text-xs text-muted ml-2 flex-1" numberOfLines={1}>
              {sharedFiles[0].fileName || `${sharedFiles.length} file(s)`}
            </Text>
          </View>
        ) : null}
        {(sharedText || sharedUrl) ? (
          <Text className="text-sm text-foreground" numberOfLines={3}>
            {sharedText || sharedUrl}
          </Text>
        ) : null}
      </View>

      {/* Search */}
      <View className="px-4 mb-3">
        <View className="flex-row items-center bg-surface rounded-xl px-4 py-2.5 border border-border">
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations..."
            placeholderTextColor={colors.muted}
            className="flex-1 ml-2 text-foreground text-sm"
          />
        </View>
      </View>

      {/* Conversation List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {filteredConversations.map((conversation: Conversation) => {
            const isSelected = selectedConversation?.id === conversation.id;
            return (
              <TouchableOpacity
                key={conversation.id}
                onPress={() => setSelectedConversation(isSelected ? null : conversation)}
                className="flex-row items-center px-4 py-3"
                style={{
                  backgroundColor: isSelected ? colors.primary + "18" : "transparent",
                }}
                accessibilityRole="button"
                accessibilityLabel={`Send to ${conversation.otherUserName || "Unknown"}`}
                testID={`share-intent-conversation-${conversation.id}`}
              >
                <View
                  className="w-11 h-11 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: colors.surface }}
                >
                  {conversation.otherUserAvatar ? (
                    <Image
                      source={{ uri: conversation.otherUserAvatar }}
                      className="w-11 h-11 rounded-full"
                    />
                  ) : (
                    <IconSymbol name="person.fill" size={20} color={colors.muted} />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-medium">
                    {conversation.otherUserName || "Unknown"}
                  </Text>
                  {conversation.otherUserRole ? (
                    <Text className="text-xs text-muted capitalize">
                      {conversation.otherUserRole}
                    </Text>
                  ) : null}
                </View>
                {isSelected && (
                  <IconSymbol name="checkmark.circle.fill" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
          {filteredConversations.length === 0 && (
            <View className="items-center py-12">
              <IconSymbol name="message.fill" size={36} color={colors.muted} />
              <Text className="text-muted mt-3">
                {searchQuery ? "No conversations match your search" : "No conversations yet"}
              </Text>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
