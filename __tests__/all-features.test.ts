import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.join(__dirname, "..");

describe("LocoMotivate Expo App - Complete Feature Test Suite", () => {
  // ============================================
  // AUTHENTICATION & OAUTH
  // ============================================
  describe("Authentication", () => {
    it("should have login screen", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      expect(fs.existsSync(loginPath)).toBe(true);
      const content = fs.readFileSync(loginPath, "utf-8");
      expect(content).toContain("email");
      expect(content).toContain("password");
    });

    it("should have register screen", () => {
      const registerPath = path.join(projectRoot, "app/register.tsx");
      expect(fs.existsSync(registerPath)).toBe(true);
    });

    it("should have auth context with role management", () => {
      const authContextPath = path.join(projectRoot, "contexts/auth-context.tsx");
      expect(fs.existsSync(authContextPath)).toBe(true);
      const content = fs.readFileSync(authContextPath, "utf-8");
      expect(content).toContain("role");
      expect(content).toContain("impersonate");
    });

    it("should have OAuth buttons component", () => {
      const oauthPath = path.join(projectRoot, "components/oauth-buttons.tsx");
      expect(fs.existsSync(oauthPath)).toBe(true);
      const content = fs.readFileSync(oauthPath, "utf-8");
      expect(content).toContain("Apple");
      expect(content).toContain("Google");
    });
  });

  // ============================================
  // SHOPPER FEATURES
  // ============================================
  describe("Shopper Features", () => {
    it("should have catalog/home screen with bundles", () => {
      const catalogPath = path.join(projectRoot, "app/(tabs)/index.tsx");
      expect(fs.existsSync(catalogPath)).toBe(true);
      const content = fs.readFileSync(catalogPath, "utf-8");
      expect(content).toContain("bundle");
    });

    it("should have products screen", () => {
      const productsPath = path.join(projectRoot, "app/(tabs)/products.tsx");
      expect(fs.existsSync(productsPath)).toBe(true);
      const content = fs.readFileSync(productsPath, "utf-8");
      expect(content).toContain("product");
    });

    it("should have trainer directory screen", () => {
      const trainersPath = path.join(projectRoot, "app/(tabs)/trainers.tsx");
      expect(fs.existsSync(trainersPath)).toBe(true);
      const content = fs.readFileSync(trainersPath, "utf-8");
      expect(content).toContain("trainer");
      expect(content).toContain("specialt");
    });

    it("should have cart screen with cart context", () => {
      const cartPath = path.join(projectRoot, "app/(tabs)/cart.tsx");
      expect(fs.existsSync(cartPath)).toBe(true);
      const cartContextPath = path.join(projectRoot, "contexts/cart-context.tsx");
      expect(fs.existsSync(cartContextPath)).toBe(true);
    });

    it("should have bundle detail screen", () => {
      const bundleDetailPath = path.join(projectRoot, "app/bundle/[id].tsx");
      expect(fs.existsSync(bundleDetailPath)).toBe(true);
    });

    it("should have public trainer profile screen", () => {
      const trainerProfilePath = path.join(projectRoot, "app/trainer/[id].tsx");
      expect(fs.existsSync(trainerProfilePath)).toBe(true);
      const content = fs.readFileSync(trainerProfilePath, "utf-8");
      expect(content).toContain("Request to Join");
    });
  });

  // ============================================
  // TRAINER FEATURES
  // ============================================
  describe("Trainer Features", () => {
    it("should have trainer dashboard with stats", () => {
      const dashboardPath = path.join(projectRoot, "app/(trainer)/index.tsx");
      expect(fs.existsSync(dashboardPath)).toBe(true);
      const content = fs.readFileSync(dashboardPath, "utf-8");
      expect(content).toContain("Dashboard");
      expect(content).toContain("earnings");
    });

    it("should have trainer calendar screen", () => {
      const calendarPath = path.join(projectRoot, "app/(trainer)/calendar.tsx");
      expect(fs.existsSync(calendarPath)).toBe(true);
      const content = fs.readFileSync(calendarPath, "utf-8");
      expect(content).toContain("session");
    });

    it("should have trainer clients screen", () => {
      const clientsPath = path.join(projectRoot, "app/(trainer)/clients.tsx");
      expect(fs.existsSync(clientsPath)).toBe(true);
    });

    it("should have trainer bundles screen", () => {
      const bundlesPath = path.join(projectRoot, "app/(trainer)/bundles.tsx");
      expect(fs.existsSync(bundlesPath)).toBe(true);
    });

    it("should have bundle editor for CRUD", () => {
      const editorPath = path.join(projectRoot, "app/bundle-editor/[id].tsx");
      expect(fs.existsSync(editorPath)).toBe(true);
      const content = fs.readFileSync(editorPath, "utf-8");
      expect(content).toContain("title");
      expect(content).toContain("price");
      expect(content).toContain("product");
    });

    it("should have trainer orders screen", () => {
      const ordersPath = path.join(projectRoot, "app/(trainer)/orders.tsx");
      expect(fs.existsSync(ordersPath)).toBe(true);
      const content = fs.readFileSync(ordersPath, "utf-8");
      expect(content).toContain("pending");
      expect(content).toContain("processing");
      expect(content).toContain("STATUS_TABS");
    });

    it("should have trainer deliveries screen", () => {
      const deliveriesPath = path.join(projectRoot, "app/(trainer)/deliveries.tsx");
      expect(fs.existsSync(deliveriesPath)).toBe(true);
      const content = fs.readFileSync(deliveriesPath, "utf-8");
      expect(content).toContain("Mark Ready");
      expect(content).toContain("Mark Delivered");
    });

    it("should have trainer earnings screen", () => {
      const earningsPath = path.join(projectRoot, "app/(trainer)/earnings.tsx");
      expect(fs.existsSync(earningsPath)).toBe(true);
    });

    it("should have trainer settings screen", () => {
      const settingsPath = path.join(projectRoot, "app/(trainer)/settings.tsx");
      expect(fs.existsSync(settingsPath)).toBe(true);
      const content = fs.readFileSync(settingsPath, "utf-8");
      expect(content).toContain("username");
      expect(content).toContain("bio");
      expect(content).toContain("specialt");
    });

    it("should have trainer points/status screen", () => {
      const pointsPath = path.join(projectRoot, "app/(trainer)/points.tsx");
      expect(fs.existsSync(pointsPath)).toBe(true);
      const content = fs.readFileSync(pointsPath, "utf-8");
      expect(content).toContain("Bronze");
      expect(content).toContain("Silver");
      expect(content).toContain("Gold");
      expect(content).toContain("Platinum");
    });

    it("should have trainer invite screen", () => {
      const invitePath = path.join(projectRoot, "app/(trainer)/invite.tsx");
      expect(fs.existsSync(invitePath)).toBe(true);
      const content = fs.readFileSync(invitePath, "utf-8");
      expect(content).toContain("invitation");
    });

    it("should have trainer partnerships screen", () => {
      const partnershipsPath = path.join(projectRoot, "app/(trainer)/partnerships.tsx");
      expect(fs.existsSync(partnershipsPath)).toBe(true);
      const content = fs.readFileSync(partnershipsPath, "utf-8");
      expect(content).toContain("partnership");
      expect(content).toContain("business");
    });

    it("should have client detail screen with session tracking", () => {
      const clientDetailPath = path.join(projectRoot, "app/client-detail/[id].tsx");
      expect(fs.existsSync(clientDetailPath)).toBe(true);
      const content = fs.readFileSync(clientDetailPath, "utf-8");
      expect(content).toContain("session");
      expect(content).toContain("sessionsUsed");
      expect(content).toContain("handleMarkSessionComplete");
    });
  });

  // ============================================
  // CLIENT FEATURES
  // ============================================
  describe("Client Features", () => {
    it("should have client home/dashboard screen", () => {
      const homePath = path.join(projectRoot, "app/(client)/index.tsx");
      expect(fs.existsSync(homePath)).toBe(true);
    });

    it("should have client orders screen", () => {
      const ordersPath = path.join(projectRoot, "app/(client)/orders.tsx");
      expect(fs.existsSync(ordersPath)).toBe(true);
    });

    it("should have client deliveries screen with confirm/report", () => {
      const deliveriesPath = path.join(projectRoot, "app/(client)/deliveries.tsx");
      expect(fs.existsSync(deliveriesPath)).toBe(true);
      const content = fs.readFileSync(deliveriesPath, "utf-8");
      expect(content).toContain("Confirm");
      expect(content).toContain("Report");
    });

    it("should have client subscriptions screen", () => {
      const subscriptionsPath = path.join(projectRoot, "app/(client)/subscriptions.tsx");
      expect(fs.existsSync(subscriptionsPath)).toBe(true);
      const content = fs.readFileSync(subscriptionsPath, "utf-8");
      expect(content).toContain("Pause");
      expect(content).toContain("Resume");
      expect(content).toContain("Cancel");
    });

    it("should have client spending screen", () => {
      const spendingPath = path.join(projectRoot, "app/(client)/spending.tsx");
      expect(fs.existsSync(spendingPath)).toBe(true);
    });
  });

  // ============================================
  // MANAGER FEATURES
  // ============================================
  describe("Manager Features", () => {
    it("should have manager dashboard", () => {
      const dashboardPath = path.join(projectRoot, "app/(manager)/index.tsx");
      expect(fs.existsSync(dashboardPath)).toBe(true);
      const content = fs.readFileSync(dashboardPath, "utf-8");
      expect(content).toContain("Manager Dashboard");
      expect(content).toContain("Low Inventory");
    });

    it("should have manager users screen", () => {
      const usersPath = path.join(projectRoot, "app/(manager)/users.tsx");
      expect(fs.existsSync(usersPath)).toBe(true);
    });

    it("should have manager trainers screen", () => {
      const trainersPath = path.join(projectRoot, "app/(manager)/trainers.tsx");
      expect(fs.existsSync(trainersPath)).toBe(true);
    });

    it("should have manager analytics screen", () => {
      const analyticsPath = path.join(projectRoot, "app/(manager)/analytics.tsx");
      expect(fs.existsSync(analyticsPath)).toBe(true);
    });

    it("should have manager templates screen", () => {
      const templatesPath = path.join(projectRoot, "app/(manager)/templates.tsx");
      expect(fs.existsSync(templatesPath)).toBe(true);
    });

    it("should have manager invitations screen", () => {
      const invitationsPath = path.join(projectRoot, "app/(manager)/invitations.tsx");
      expect(fs.existsSync(invitationsPath)).toBe(true);
    });

    it("should have manager bundle approvals screen", () => {
      const approvalsPath = path.join(projectRoot, "app/(manager)/approvals.tsx");
      expect(fs.existsSync(approvalsPath)).toBe(true);
      const content = fs.readFileSync(approvalsPath, "utf-8");
      expect(content).toContain("Approve");
      expect(content).toContain("Reject");
    });

    it("should have manager deliveries screen", () => {
      const deliveriesPath = path.join(projectRoot, "app/(manager)/deliveries.tsx");
      expect(fs.existsSync(deliveriesPath)).toBe(true);
    });

    it("should have manager products screen", () => {
      const productsPath = path.join(projectRoot, "app/(manager)/products.tsx");
      expect(fs.existsSync(productsPath)).toBe(true);
      const content = fs.readFileSync(productsPath, "utf-8");
      expect(content).toContain("Sync");
    });
  });

  // ============================================
  // COORDINATOR FEATURES
  // ============================================
  describe("Coordinator Features", () => {
    it("should have coordinator impersonate screen", () => {
      const impersonatePath = path.join(projectRoot, "app/(coordinator)/index.tsx");
      expect(fs.existsSync(impersonatePath)).toBe(true);
      const content = fs.readFileSync(impersonatePath, "utf-8");
      expect(content).toContain("Impersonate");
    });

    it("should have coordinator logs screen", () => {
      const logsPath = path.join(projectRoot, "app/(coordinator)/logs.tsx");
      expect(fs.existsSync(logsPath)).toBe(true);
    });
  });

  // ============================================
  // CHECKOUT & ORDERS
  // ============================================
  describe("Checkout & Orders", () => {
    it("should have checkout screen", () => {
      const checkoutPath = path.join(projectRoot, "app/checkout/index.tsx");
      expect(fs.existsSync(checkoutPath)).toBe(true);
    });

    it("should have order confirmation screen", () => {
      const confirmationPath = path.join(projectRoot, "app/checkout/confirmation.tsx");
      expect(fs.existsSync(confirmationPath)).toBe(true);
    });

    it("should have cart context with fulfillment options", () => {
      const cartContextPath = path.join(projectRoot, "contexts/cart-context.tsx");
      const content = fs.readFileSync(cartContextPath, "utf-8");
      expect(content).toContain("fulfillment");
      expect(content).toContain("addItem");
      expect(content).toContain("removeItem");
      expect(content).toContain("updateQuantity");
    });
  });

  // ============================================
  // MESSAGING
  // ============================================
  describe("Messaging", () => {
    it("should have conversations list screen", () => {
      const conversationsPath = path.join(projectRoot, "app/messages/index.tsx");
      expect(fs.existsSync(conversationsPath)).toBe(true);
    });

    it("should have message thread screen", () => {
      const threadPath = path.join(projectRoot, "app/messages/[id].tsx");
      expect(fs.existsSync(threadPath)).toBe(true);
    });
  });

  // ============================================
  // INVITATIONS
  // ============================================
  describe("Invitations", () => {
    it("should have invitation landing page", () => {
      const invitePath = path.join(projectRoot, "app/invite/[token].tsx");
      expect(fs.existsSync(invitePath)).toBe(true);
      const content = fs.readFileSync(invitePath, "utf-8");
      expect(content).toContain("Accept");
      expect(content).toContain("Decline");
    });
  });

  // ============================================
  // PUSH NOTIFICATIONS
  // ============================================
  describe("Push Notifications", () => {
    it("should have notifications service", () => {
      const notificationsPath = path.join(projectRoot, "lib/notifications.ts");
      expect(fs.existsSync(notificationsPath)).toBe(true);
      const content = fs.readFileSync(notificationsPath, "utf-8");
      expect(content).toContain("registerForPushNotificationsAsync");
      expect(content).toContain("scheduleDeliveryNotification");
      expect(content).toContain("scheduleSessionReminder");
    });

    it("should have notification context provider", () => {
      const contextPath = path.join(projectRoot, "contexts/notification-context.tsx");
      expect(fs.existsSync(contextPath)).toBe(true);
      const content = fs.readFileSync(contextPath, "utf-8");
      expect(content).toContain("NotificationProvider");
      expect(content).toContain("useNotifications");
    });

    it("should handle web platform gracefully", () => {
      const notificationsPath = path.join(projectRoot, "lib/notifications.ts");
      const content = fs.readFileSync(notificationsPath, "utf-8");
      expect(content).toContain('Platform.OS === "web"');
    });
  });

  // ============================================
  // DATABASE SCHEMA
  // ============================================
  describe("Database Schema", () => {
    it("should have complete drizzle schema", () => {
      const schemaPath = path.join(projectRoot, "drizzle/schema.ts");
      expect(fs.existsSync(schemaPath)).toBe(true);
      const content = fs.readFileSync(schemaPath, "utf-8");
      
      // Check for all required tables
      expect(content).toContain("users");
      expect(content).toContain("bundleDrafts"); // bundles are stored as drafts
      expect(content).toContain("products");
      expect(content).toContain("orders");
      expect(content).toContain("productDeliveries"); // deliveries table
      expect(content).toContain("subscriptions");
      expect(content).toContain("sessions");
      expect(content).toContain("invitations");
      expect(content).toContain("messages");
    });

    it("should have session tracking fields in subscriptions", () => {
      const schemaPath = path.join(projectRoot, "drizzle/schema.ts");
      const content = fs.readFileSync(schemaPath, "utf-8");
      expect(content).toContain("sessionsIncluded");
      expect(content).toContain("sessionsUsed");
    });
  });

  // ============================================
  // SERVER ROUTERS
  // ============================================
  describe("Server API Routers", () => {
    it("should have comprehensive server routers", () => {
      const routersPath = path.join(projectRoot, "server/routers.ts");
      expect(fs.existsSync(routersPath)).toBe(true);
      const content = fs.readFileSync(routersPath, "utf-8");
      
      // Check for all required routers
      expect(content).toContain("catalog");
      expect(content).toContain("bundles");
      expect(content).toContain("orders");
      expect(content).toContain("deliveries");
      expect(content).toContain("clients");
      expect(content).toContain("subscriptions");
      expect(content).toContain("messages");
      expect(content).toContain("invitations");
    });

    it("should have trainer dashboard endpoints", () => {
      const routersPath = path.join(projectRoot, "server/routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      expect(content).toContain("trainerDashboard");
    });
  });

  // ============================================
  // THEME & BRANDING
  // ============================================
  describe("Theme & Branding", () => {
    it("should have custom theme colors", () => {
      const themePath = path.join(projectRoot, "theme.config.js");
      expect(fs.existsSync(themePath)).toBe(true);
      const content = fs.readFileSync(themePath, "utf-8");
      expect(content).toContain("primary");
      expect(content).toContain("3B82F6"); // Bright Express blue
    });

    it("should have app icon", () => {
      const iconPath = path.join(projectRoot, "assets/images/icon.png");
      expect(fs.existsSync(iconPath)).toBe(true);
    });

    it("should have app config with branding", () => {
      const configPath = path.join(projectRoot, "app.config.ts");
      expect(fs.existsSync(configPath)).toBe(true);
      const content = fs.readFileSync(configPath, "utf-8");
      expect(content).toContain("appName");
      expect(content).toContain("logoUrl");
    });
  });

  // ============================================
  // NAVIGATION
  // ============================================
  describe("Navigation", () => {
    it("should have role-based tab layouts", () => {
      const shopperTabsPath = path.join(projectRoot, "app/(tabs)/_layout.tsx");
      const trainerTabsPath = path.join(projectRoot, "app/(trainer)/_layout.tsx");
      const clientTabsPath = path.join(projectRoot, "app/(client)/_layout.tsx");
      const managerTabsPath = path.join(projectRoot, "app/(manager)/_layout.tsx");
      const coordinatorTabsPath = path.join(projectRoot, "app/(coordinator)/_layout.tsx");

      expect(fs.existsSync(shopperTabsPath)).toBe(true);
      expect(fs.existsSync(trainerTabsPath)).toBe(true);
      expect(fs.existsSync(clientTabsPath)).toBe(true);
      expect(fs.existsSync(managerTabsPath)).toBe(true);
      expect(fs.existsSync(coordinatorTabsPath)).toBe(true);
    });

    it("should have icon mappings for all tabs", () => {
      const iconSymbolPath = path.join(projectRoot, "components/ui/icon-symbol.tsx");
      expect(fs.existsSync(iconSymbolPath)).toBe(true);
      const content = fs.readFileSync(iconSymbolPath, "utf-8");
      
      // Check for required icons
      expect(content).toContain("house.fill");
      expect(content).toContain("bag.fill");
      expect(content).toContain("person.2.fill");
      expect(content).toContain("calendar");
      expect(content).toContain("chart.bar.fill");
    });
  });

  // ============================================
  // DESIGN DOCUMENTATION
  // ============================================
  describe("Design Documentation", () => {
    it("should have design.md with mobile app design plan", () => {
      const designPath = path.join(projectRoot, "design.md");
      expect(fs.existsSync(designPath)).toBe(true);
      const content = fs.readFileSync(designPath, "utf-8");
      expect(content).toContain("Screen");
      expect(content).toContain("Color");
    });

    it("should have todo.md with feature tracking", () => {
      const todoPath = path.join(projectRoot, "todo.md");
      expect(fs.existsSync(todoPath)).toBe(true);
      const content = fs.readFileSync(todoPath, "utf-8");
      expect(content).toContain("[x]"); // Completed items
    });
  });
});
