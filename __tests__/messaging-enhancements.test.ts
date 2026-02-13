import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const APP_DIR = path.join(__dirname, "..");

describe("Messaging Enhancements", () => {
  describe("Incoming message alert", () => {
    it("should include a global incoming-message FAB component", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/_layout.tsx"),
        "utf-8"
      );
      expect(content).toContain("IncomingMessageFAB");
      expect(content).toContain("<IncomingMessageFAB />");
    });

    it("should render an accessible incoming-message FAB with stable testID", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "components/incoming-message-fab.tsx"),
        "utf-8"
      );
      expect(content).toContain("accessibilityRole=\"button\"");
      expect(content).toContain("testID=\"incoming-message-fab\"");
    });

    it("should handle websocket new_message events and show alert state", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "components/incoming-message-fab.tsx"),
        "utf-8"
      );
      expect(content).toContain("msg.type !== \"new_message\"");
      expect(content).toContain("setIncoming");
      expect(content).toContain("scheduleMessageNotification");
      expect(content).toContain("message?.conversationId || msg.conversationId");
    });

    it("should fall back to unread conversations when websocket events are missed", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "components/incoming-message-fab.tsx"),
        "utf-8"
      );
      expect(content).toContain("trpc.messages.conversations.useQuery");
      expect(content).toContain("conversation.unreadCount");
      expect(content).toContain("openConversationId");
    });

    it("should detect new inbound messages from conversation summary changes", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "components/incoming-message-fab.tsx"),
        "utf-8"
      );
      expect(content).toContain("hasInitializedConversationStampsRef");
      expect(content).toContain("conversationStampByIdRef");
      expect(content).toContain("conversation.lastMessageSenderId === user.id");
      expect(content).toContain("setIncoming((current) => ({");
    });

    it("should auto-hide incoming alert after 10 seconds", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "components/incoming-message-fab.tsx"),
        "utf-8"
      );
      expect(content).toContain("setTimeout(() => {");
      expect(content).toContain("setIncoming(null)");
      expect(content).toContain("10000");
    });

    it("should animate alert in and out", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "components/incoming-message-fab.tsx"),
        "utf-8"
      );
      expect(content).toContain("Animated.spring");
      expect(content).toContain("Animated.timing");
      expect(content).toContain("AnimatedPressable");
    });
  });

  describe("Profile FAB unread indicators", () => {
    it("should show unread red dot on the profile FAB", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "components/profile-fab.tsx"),
        "utf-8"
      );
      expect(content).toContain("counts.unreadMessages > 0");
      expect(content).toContain("testID=\"profile-fab\"");
      expect(content).toContain("backgroundColor: \"#EF4444\"");
    });

    it("should show unread red dot beside the Messages menu item", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "components/profile-fab.tsx"),
        "utf-8"
      );
      expect(content).toContain("showDot: hasUnreadMessages");
      expect(content).toContain("label: \"Messages\"");
      expect(content).toContain("item.showDot");
    });
  });

  describe("Push Notifications", () => {
    it("should have message notification function in notifications lib", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "lib/notifications.ts"),
        "utf-8"
      );
      expect(content).toContain("scheduleMessageNotification");
      expect(content).toContain("conversationId");
      expect(content).toContain("senderName");
      expect(content).toContain("messagePreview");
    });

    it("should handle message notifications in notification context", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "contexts/notification-context.tsx"),
        "utf-8"
      );
      expect(content).toContain('case "message"');
      expect(content).toContain("/conversation/[id]");
      expect(content).toContain("conversationId");
    });

    it("should have Android notification channels for messages", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "lib/notifications.ts"),
        "utf-8"
      );
      expect(content).toContain("setNotificationChannelAsync");
      expect(content).toContain("default");
    });
  });

  describe("Typing Indicators", () => {
    it("should have typing indicator component in conversation screen", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("TypingIndicator");
      expect(content).toContain("is typing");
    });

    it("should have animated dots for typing indicator", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("useSharedValue");
      expect(content).toContain("useAnimatedStyle");
      expect(content).toContain("withRepeat");
      expect(content).toContain("dot1");
      expect(content).toContain("dot2");
      expect(content).toContain("dot3");
    });

    it("should track typing state", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("isTyping");
      expect(content).toContain("otherUserTyping");
      expect(content).toContain("setIsTyping");
      expect(content).toContain("setOtherUserTyping");
    });

    it("should show typing status in header", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain('otherUserTyping ? "typing..."');
    });

    it("should have typing timeout for auto-clear", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("typingTimeoutRef");
      expect(content).toContain("clearTimeout");
    });
  });

  describe("Read Receipts", () => {
    it("should have ReadReceipt component in conversation screen", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("ReadReceipt");
      expect(content).toContain("isRead");
    });

    it("should show double checkmarks for read receipts", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      // Two checkmark icons for double-tick
      const checkmarkCount = (content.match(/name="checkmark"/g) || []).length;
      expect(checkmarkCount).toBeGreaterThanOrEqual(2);
    });

    it("should color checkmarks based on read status", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("isRead ? colors.primary : colors.muted");
    });

    it("should show read receipts only for own messages", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("isOwn && <ReadReceipt");
    });

    it("should mark messages as read when viewing", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("markRead");
      expect(content).toContain("trpc.messages.markRead");
    });

    it("should have read receipts in conversation list", () => {
      // The full messages implementation is in (tabs)/messages.tsx
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/messages.tsx"),
        "utf-8"
      );
      expect(content).toContain("unreadCount");
      expect(content).toContain("lastMessage");
    });

    it("should show 'You:' prefix for own messages in list", () => {
      // The full messages implementation is in (tabs)/messages.tsx
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/messages.tsx"),
        "utf-8"
      );
      // Check for You: prefix in the message display
      expect(content).toContain("You:");
      expect(content).toContain("lastMessageIsOwn");
    });
  });

  describe("Message Polling", () => {
    it("should poll for new messages", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("refetchInterval");
      expect(content).toContain("3000"); // 3 second polling
    });
  });
});
