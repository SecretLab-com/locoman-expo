import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.join(__dirname, "..");

describe("LocoMotivate Expo App - Feature Tests", () => {
  describe("Cart Context", () => {
    it("should have cart context with required exports", () => {
      const cartContextPath = path.join(projectRoot, "contexts/cart-context.tsx");
      expect(fs.existsSync(cartContextPath)).toBe(true);
      
      const content = fs.readFileSync(cartContextPath, "utf-8");
      expect(content).toContain("export interface CartItem");
      expect(content).toContain("addItem");
      expect(content).toContain("removeItem");
      expect(content).toContain("updateQuantity");
      expect(content).toContain("updateFulfillment");
      expect(content).toContain("clearCart");
      expect(content).toContain("AsyncStorage");
    });

    it("should support fulfillment options", () => {
      const cartContextPath = path.join(projectRoot, "contexts/cart-context.tsx");
      const content = fs.readFileSync(cartContextPath, "utf-8");
      expect(content).toContain("home_ship");
      expect(content).toContain("trainer_delivery");
      expect(content).toContain("vending");
      expect(content).toContain("cafeteria");
    });
  });

  describe("Bundle Editor", () => {
    it("should have bundle editor screen", () => {
      const bundleEditorPath = path.join(projectRoot, "app/bundle-editor/[id].tsx");
      expect(fs.existsSync(bundleEditorPath)).toBe(true);
      
      const content = fs.readFileSync(bundleEditorPath, "utf-8");
      expect(content).toContain("BundleEditorScreen");
      expect(content).toContain("ServiceItem");
      expect(content).toContain("ServiceItem");
      expect(content).toContain("newServiceType");
    });

    it("should support service configuration with quantity", () => {
      const bundleEditorPath = path.join(projectRoot, "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(bundleEditorPath, "utf-8");
      expect(content).toContain("quantity");
      expect(content).toContain("duration");
      expect(content).toContain("addService");
      expect(content).toContain("removeService");
    });
  });

  describe("Client Detail Screen", () => {
    it("should have client detail screen with session tracking", () => {
      const clientDetailPath = path.join(projectRoot, "app/client-detail/[id].tsx");
      expect(fs.existsSync(clientDetailPath)).toBe(true);
      
      const content = fs.readFileSync(clientDetailPath, "utf-8");
      expect(content).toContain("ClientDetailScreen");
      expect(content).toContain("sessionsIncluded");
      expect(content).toContain("sessionsUsed");
      expect(content).toContain("sessionsRemaining");
    });

    it("should allow marking sessions as complete", () => {
      const clientDetailPath = path.join(projectRoot, "app/client-detail/[id].tsx");
      const content = fs.readFileSync(clientDetailPath, "utf-8");
      expect(content).toContain("handleMarkSessionComplete");
      expect(content).toContain(">Complete<");
    });
  });

  describe("Checkout Flow", () => {
    it("should have checkout screen", () => {
      const checkoutPath = path.join(projectRoot, "app/checkout/index.tsx");
      expect(fs.existsSync(checkoutPath)).toBe(true);
      
      const content = fs.readFileSync(checkoutPath, "utf-8");
      expect(content).toContain("CheckoutScreen");
      expect(content).toContain("handlePlaceOrder");
      expect(content).toContain("subtotal");
      expect(content).toContain("tax");
      expect(content).toContain("total");
    });

    it("should have order confirmation screen", () => {
      const confirmationPath = path.join(projectRoot, "app/checkout/confirmation.tsx");
      expect(fs.existsSync(confirmationPath)).toBe(true);
      
      const content = fs.readFileSync(confirmationPath, "utf-8");
      expect(content).toContain("OrderConfirmationScreen");
      expect(content).toContain("Order Submitted");
      expect(content).toContain("orderNumber");
    });
  });

  describe("Delivery System", () => {
    it("should have enhanced delivery screen with tracking", () => {
      const deliveriesPath = path.join(projectRoot, "app/(client)/deliveries.tsx");
      expect(fs.existsSync(deliveriesPath)).toBe(true);
      
      const content = fs.readFileSync(deliveriesPath, "utf-8");
      expect(content).toContain("Delivery");
      expect(content).toContain("DeliveryStatus");
      expect(content).toContain("pending");
      expect(content).toContain("ready");
      expect(content).toContain("out_for_delivery"); // Updated from in_transit
      expect(content).toContain("delivered");
      expect(content).toContain("confirmed");
    });

    it("should support confirm receipt and report issue", () => {
      const deliveriesPath = path.join(projectRoot, "app/(client)/deliveries.tsx");
      const content = fs.readFileSync(deliveriesPath, "utf-8");
      expect(content).toContain("handleConfirmReceipt");
      expect(content).toContain("handleReportIssue");
      expect(content).toContain("Confirm Receipt");
      expect(content).toContain("Report Issue");
    });
  });

  describe("Messaging System", () => {
    it("should have conversations list screen", () => {
      const messagesPath = path.join(projectRoot, "app/messages/index.tsx");
      expect(fs.existsSync(messagesPath)).toBe(true);
      
      const content = fs.readFileSync(messagesPath, "utf-8");
      expect(content).toContain("MessagesScreen");
      // The messages/index.tsx re-exports from (tabs)/messages.tsx which has the full implementation
      expect(content).toContain("RoleBottomNav");
    });

    it("should have message thread screen", () => {
      const threadPath = path.join(projectRoot, "app/messages/[id].tsx");
      expect(fs.existsSync(threadPath)).toBe(true);
      
      const content = fs.readFileSync(threadPath, "utf-8");
      if (content.includes("conversation/[id]")) {
        const conversationPath = path.join(projectRoot, "app/conversation/[id].tsx");
        expect(fs.existsSync(conversationPath)).toBe(true);
        const conversationContent = fs.readFileSync(conversationPath, "utf-8");
        expect(conversationContent).toContain("MessageBubble");
        expect(conversationContent).toContain("handleSend");
        expect(conversationContent).toContain("messageText");
      } else {
        expect(content).toContain("MessageDetailScreen");
        expect(content).toContain("MessageBubble");
        expect(content).toContain("handleSend");
        expect(content).toContain("inputText");
      }
    });
  });

  describe("Auth Context", () => {
    it("should have auth context with role management", () => {
      const authContextPath = path.join(projectRoot, "contexts/auth-context.tsx");
      expect(fs.existsSync(authContextPath)).toBe(true);
      
      const content = fs.readFileSync(authContextPath, "utf-8");
      expect(content).toContain("AuthProvider");
      expect(content).toContain("role");
      expect(content).toContain("shopper");
      expect(content).toContain("trainer");
      expect(content).toContain("client");
    });

    it("should support impersonation for coordinator role", () => {
      const authContextPath = path.join(projectRoot, "contexts/auth-context.tsx");
      const content = fs.readFileSync(authContextPath, "utf-8");
      expect(content).toContain("impersonate");
      expect(content).toContain("coordinator");
    });
  });

  describe("Route Configuration", () => {
    it("should have all routes configured in root layout", () => {
      const layoutPath = path.join(projectRoot, "app/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      // Core routes
      expect(content).toContain('name="(tabs)"');
      expect(content).toContain('name="login"');
      expect(content).toContain('name="register"');
      
      // Feature routes
      expect(content).toContain('name="bundle/[id]"');
      expect(content).toContain('name="bundle-editor/[id]"');
      expect(content).toContain('name="client-detail/[id]"');
      expect(content).toContain('name="checkout/index"');
      expect(content).toContain('name="checkout/confirmation"');
      expect(content).toContain('name="messages/index"');
      expect(content).toContain('name="messages/[id]"');
      
      // Role-based routes
      expect(content).toContain('name="(trainer)"');
      expect(content).toContain('name="(client)"');
    });
  });

  describe("Database Schema", () => {
    it("should have comprehensive schema with all tables", () => {
      const migrationPath = path.join(projectRoot, "supabase/migrations/001_initial_schema.sql");
      expect(fs.existsSync(migrationPath)).toBe(true);

      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("CREATE TABLE users");
      expect(content).toContain("CREATE TABLE bundle_drafts");
      expect(content).toContain("CREATE TABLE bundle_templates");
      expect(content).toContain("CREATE TABLE subscriptions");
      expect(content).toContain("CREATE TABLE training_sessions");
      expect(content).toContain("CREATE TABLE orders");
      expect(content).toContain("CREATE TABLE product_deliveries");
      expect(content).toContain("CREATE TABLE messages");
      expect(content).toContain("CREATE TABLE clients");
    });

    it("should have session tracking fields in subscriptions", () => {
      const migrationPath = path.join(projectRoot, "supabase/migrations/001_initial_schema.sql");
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("sessions_included");
      expect(content).toContain("sessions_used");
    });
  });

  describe("Server Routers", () => {
    it("should have comprehensive API routers", () => {
      const routersPath = path.join(projectRoot, "server/routers.ts");
      expect(fs.existsSync(routersPath)).toBe(true);
      
      const content = fs.readFileSync(routersPath, "utf-8");
      // Check for router namespaces in appRouter
      expect(content).toContain("catalog:");
      expect(content).toContain("bundles:");
      expect(content).toContain("clients:");
      expect(content).toContain("orders:");
      expect(content).toContain("deliveries:");
      expect(content).toContain("messages:");
    });
  });
});
