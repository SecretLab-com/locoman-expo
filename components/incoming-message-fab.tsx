import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useColors } from "@/hooks/use-colors";
import { useWebSocket } from "@/hooks/use-websocket";
import { scheduleMessageNotification } from "@/lib/notifications";
import { trpc } from "@/lib/trpc";
import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IncomingMessageState = {
  conversationId: string;
  senderId?: string;
  senderName?: string;
  preview?: string;
  count: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function IncomingMessageFAB() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { user } = useAuthContext();
  const { connect, disconnect, subscribe } = useWebSocket();
  const [incoming, setIncoming] = useState<IncomingMessageState | null>(null);
  const [renderedIncoming, setRenderedIncoming] = useState<IncomingMessageState | null>(null);
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedConversationStampsRef = useRef(false);
  const conversationStampByIdRef = useRef<Map<string, string>>(new Map());
  const hasInitializedUnreadRef = useRef(false);
  const previousUnreadTotalRef = useRef(0);
  const alertAnim = useRef(new Animated.Value(0)).current;
  const canListenForMessages = Boolean(user?.id);
  const { data: conversations = [] } = trpc.messages.conversations.useQuery(undefined, {
    enabled: canListenForMessages,
    refetchInterval: 5000,
  });

  const openConversationId = useMemo(() => {
    if (!pathname.startsWith("/conversation/")) return null;
    const parts = pathname.split("/");
    return parts.length >= 3 ? decodeURIComponent(parts[2]) : null;
  }, [pathname]);

  useEffect(() => {
    if (!canListenForMessages || !user?.id) {
      setIncoming(null);
      return;
    }

    connect();
    const unsubscribe = subscribe((msg) => {
      if (msg.type !== "new_message") return;
      const message = msg.message as {
        id?: string;
        senderId?: string;
        conversationId?: string;
        content?: string;
        senderName?: string;
      };

      const conversationId = message?.conversationId || msg.conversationId;
      if (!conversationId) return;
      if (message.senderId === user.id) return;
      if (openConversationId && openConversationId === conversationId) return;

      const messageId = message.id ?? `${conversationId}-${Date.now()}`;
      if (notifiedMessageIdsRef.current.has(messageId)) return;
      notifiedMessageIdsRef.current.add(messageId);

      const senderName = message.senderName || "New message";
      const preview = (message.content || "").trim();

      void scheduleMessageNotification(
        conversationId,
        senderName,
        preview,
        message.senderId
      );

      setIncoming((current) => {
        if (!current || current.conversationId !== conversationId) {
          return {
            conversationId,
            senderId: message.senderId,
            senderName,
            preview,
            count: 1,
          };
        }
        return {
          ...current,
          preview,
          count: current.count + 1,
        };
      });
    });

    return () => {
      unsubscribe();
      disconnect();
    };
  }, [canListenForMessages, connect, disconnect, openConversationId, subscribe, user?.id]);

  useEffect(() => {
    if (!incoming || !openConversationId) return;
    if (incoming.conversationId !== openConversationId) return;
    setIncoming(null);
  }, [incoming, openConversationId]);

  // Fallback: trigger alert when unread total increases (e.g. websocket miss).
  useEffect(() => {
    if (!canListenForMessages) return;
    const unreadTotal = (conversations as any[]).reduce(
      (sum, conversation) => sum + Number(conversation.unreadCount || 0),
      0
    );
    if (!hasInitializedUnreadRef.current) {
      hasInitializedUnreadRef.current = true;
      previousUnreadTotalRef.current = unreadTotal;
      return;
    }
    const unreadIncreased = unreadTotal > previousUnreadTotalRef.current;
    previousUnreadTotalRef.current = unreadTotal;
    if (!unreadIncreased) return;

    const unreadConversation = (conversations as any[])
      .filter(
        (conversation) =>
          Number(conversation.unreadCount || 0) > 0 &&
          (!openConversationId || conversation.conversationId !== openConversationId)
      )
      .sort((a, b) => {
        const aTs = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTs = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTs - aTs;
      })[0];

    if (!unreadConversation) return;
    setIncoming({
      conversationId: unreadConversation.conversationId,
      senderId: unreadConversation.otherUserId || undefined,
      senderName: unreadConversation.otherUserName || "New message",
      preview: unreadConversation.lastMessageContent || "",
      count: Math.max(1, Number(unreadConversation.unreadCount || 1)),
    });
  }, [canListenForMessages, conversations, openConversationId]);

  // Secondary fallback: detect any new incoming last message from conversations list.
  // This catches cases where unread counts are already consumed or websocket events are missed.
  useEffect(() => {
    if (!canListenForMessages || !user?.id) return;
    if (!conversations.length) return;

    let newestIncoming: any = null;
    const nextStampMap = new Map<string, string>();

    for (const conversation of conversations as any[]) {
      const conversationId = conversation.conversationId as string;
      if (!conversationId) continue;
      const stamp = `${conversation.updatedAt || ""}|${conversation.lastMessageSenderId || ""}|${conversation.lastMessageContent || ""}`;
      nextStampMap.set(conversationId, stamp);

      if (!hasInitializedConversationStampsRef.current) continue;
      const prevStamp = conversationStampByIdRef.current.get(conversationId);
      if (!prevStamp || prevStamp === stamp) continue;
      if (conversation.lastMessageSenderId === user.id) continue;
      if (openConversationId && openConversationId === conversationId) continue;

      const candidateTime = conversation.updatedAt ? new Date(conversation.updatedAt).getTime() : 0;
      const newestTime = newestIncoming?.updatedAt ? new Date(newestIncoming.updatedAt).getTime() : 0;
      if (!newestIncoming || candidateTime >= newestTime) {
        newestIncoming = conversation;
      }
    }

    conversationStampByIdRef.current = nextStampMap;
    if (!hasInitializedConversationStampsRef.current) {
      hasInitializedConversationStampsRef.current = true;
      return;
    }
    if (!newestIncoming) return;

    setIncoming((current) => ({
      conversationId: newestIncoming.conversationId,
      senderId: newestIncoming.otherUserId || undefined,
      senderName: newestIncoming.otherUserName || "New message",
      preview: newestIncoming.lastMessageContent || "",
      count: Math.max(
        current?.conversationId === newestIncoming.conversationId ? (current?.count ?? 0) + 1 : 1,
        Number(newestIncoming.unreadCount || 1),
      ),
    }));
  }, [canListenForMessages, conversations, openConversationId, user?.id]);

  useEffect(() => {
    if (!incoming) return;
    const timer = setTimeout(() => {
      setIncoming(null);
    }, 10000);
    return () => clearTimeout(timer);
  }, [incoming]);

  useEffect(() => {
    if (incoming) {
      if (renderedIncoming === incoming) return;
      setRenderedIncoming(incoming);
      alertAnim.stopAnimation();
      alertAnim.setValue(0);
      Animated.spring(alertAnim, {
        toValue: 1,
        stiffness: 180,
        damping: 14,
        mass: 0.75,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!renderedIncoming) return;
    alertAnim.stopAnimation();
    Animated.timing(alertAnim, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setRenderedIncoming(null);
      }
    });
  }, [incoming, renderedIncoming, alertAnim]);

  if (!renderedIncoming) return null;

  const label = renderedIncoming.count > 1 ? `${renderedIncoming.count} new messages` : "New message";
  const subtitle = renderedIncoming.senderName || "Someone";
  const animatedStyle = {
    opacity: alertAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateX: alertAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [36, 0],
        }),
      },
      {
        translateY: alertAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 0],
        }),
      },
      {
        scale: alertAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.9, 1],
        }),
      },
      {
        rotate: alertAnim.interpolate({
          inputRange: [0, 0.65, 1],
          outputRange: ["10deg", "-4deg", "0deg"],
        }),
      },
    ],
  } as const;

  return (
    <AnimatedPressable
      onPress={() => {
        router.push({
          pathname: "/conversation/[id]" as any,
          params: {
            id: renderedIncoming.conversationId,
            name: renderedIncoming.senderName || "Messages",
            participantId: renderedIncoming.senderId || "",
          },
        });
        setIncoming(null);
      }}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${subtitle}`}
      testID="incoming-message-fab"
      style={[
        {
          position: "absolute",
          right: 16,
          top: insets.top + 56,
          maxWidth: 280,
          minWidth: 180,
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 12,
          elevation: 10,
          zIndex: 9999,
        },
        animatedStyle,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconSymbol name="message.fill" size={15} color={colors.background} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.muted, fontSize: 12, marginTop: 1 }}
          >
            {subtitle}
            {renderedIncoming.preview ? `: ${renderedIncoming.preview}` : ""}
          </Text>
        </View>
      </View>
      <View
        style={{
          position: "absolute",
          top: -6,
          right: -6,
          minWidth: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: "#ef4444",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 5,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>
          {renderedIncoming.count > 99 ? "99+" : renderedIncoming.count}
        </Text>
      </View>
    </AnimatedPressable>
  );
}
