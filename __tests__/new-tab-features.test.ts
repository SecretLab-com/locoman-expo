import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const APP_DIR = path.join(__dirname, "..");

describe("Navigation Enhancements", () => {
  describe("Stack Layout Animations", () => {
    it("should have animation configuration in client layout", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(client)/_layout.tsx"),
        "utf-8"
      );
      expect(content).toContain("animation:");
      expect(content).toContain("animationDuration:");
      expect(content).toContain("slide_from_right");
    });

    it("should have animation configuration in trainer layout", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(trainer)/_layout.tsx"),
        "utf-8"
      );
      expect(content).toContain("animation:");
      expect(content).toContain("animationDuration:");
      expect(content).toContain("slide_from_bottom"); // Modal for invite
    });

    it("should have animation configuration in manager layout", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(manager)/_layout.tsx"),
        "utf-8"
      );
      expect(content).toContain("animation:");
      expect(content).toContain("animationDuration:");
    });

    it("should have animation configuration in coordinator layout", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(coordinator)/_layout.tsx"),
        "utf-8"
      );
      expect(content).toContain("animation:");
      expect(content).toContain("animationDuration:");
    });
  });

  describe("Activity Tab", () => {
    it("should have Activity tab screen", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/activity.tsx"),
        "utf-8"
      );
      expect(content).toContain("ActivityScreen");
    });

    it("should fetch real data from tRPC", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/activity.tsx"),
        "utf-8"
      );
      expect(content).toContain("trpc.deliveries.myDeliveries");
      expect(content).toContain("trpc.deliveries.list");
      expect(content).toContain("trpc.orders.list");
    });

    it("should have role-adaptive content", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/activity.tsx"),
        "utf-8"
      );
      expect(content).toContain("isTrainer");
      expect(content).toContain("isClient");
    });

    it("should have tab selector for filtering", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/activity.tsx"),
        "utf-8"
      );
      expect(content).toContain('type ActivityTab');
      expect(content).toContain('"all"');
      expect(content).toContain('"orders"');
      expect(content).toContain('"deliveries"');
    });

    it("should have quick stats for trainers", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/activity.tsx"),
        "utf-8"
      );
      expect(content).toContain("Pending Orders");
      expect(content).toContain("Pending Deliveries");
    });
  });

  describe("Messages Tab", () => {
    it("should have Messages tab screen", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/messages.tsx"),
        "utf-8"
      );
      expect(content).toContain("MessagesScreen");
    });

    it("should fetch conversations from tRPC", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/messages.tsx"),
        "utf-8"
      );
      expect(content).toContain("trpc.messages.conversations");
    });

    it("should have conversation item component", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/messages.tsx"),
        "utf-8"
      );
      expect(content).toContain("ConversationItem");
    });

    it("should navigate to conversation detail", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/messages.tsx"),
        "utf-8"
      );
      expect(content).toContain("handleConversationPress");
      expect(content).toContain("/conversation/[id]");
    });

    it("should have new message button", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/(tabs)/messages.tsx"),
        "utf-8"
      );
      expect(content).toContain("handleNewMessage");
      expect(content).toContain("/new-message");
    });
  });

  describe("Conversation Detail Screen", () => {
    it("should have conversation detail screen", () => {
      const exists = fs.existsSync(
        path.join(APP_DIR, "app/conversation/[id].tsx")
      );
      expect(exists).toBe(true);
    });

    it("should fetch messages from tRPC", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("trpc.messages.thread");
    });

    it("should have send message functionality", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("trpc.messages.send");
      expect(content).toContain("handleSend");
    });

    it("should have message bubble component", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("MessageBubble");
      expect(content).toContain("isOwn");
    });

    it("should have keyboard avoiding view for input", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/conversation/[id].tsx"),
        "utf-8"
      );
      expect(content).toContain("KeyboardAvoidingView");
    });
  });

  describe("New Message Screen", () => {
    it("should have new message screen", () => {
      const exists = fs.existsSync(
        path.join(APP_DIR, "app/new-message.tsx")
      );
      expect(exists).toBe(true);
    });

    it("should have contact search functionality", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/new-message.tsx"),
        "utf-8"
      );
      expect(content).toContain("searchQuery");
      expect(content).toContain("filteredContacts");
    });

    it("should show different contacts based on role", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/new-message.tsx"),
        "utf-8"
      );
      expect(content).toContain("isTrainer");
      expect(content).toContain("trpc.clients.list");
      expect(content).toContain("trpc.catalog.trainers");
    });

    it("should navigate to conversation on contact select", () => {
      const content = fs.readFileSync(
        path.join(APP_DIR, "app/new-message.tsx"),
        "utf-8"
      );
      expect(content).toContain("handleContactPress");
      expect(content).toContain("/conversation/[id]");
    });
  });
});
