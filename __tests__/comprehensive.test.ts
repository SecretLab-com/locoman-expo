import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PROJECT_ROOT = path.join(__dirname, "..");

describe("LocoMotivate Expo App - Comprehensive Feature Tests", () => {
  describe("Project Structure", () => {
    it("should have all required role-based tab layouts", () => {
      const layouts = [
        "app/(tabs)/_layout.tsx",
        "app/(trainer)/_layout.tsx",
        "app/(client)/_layout.tsx",
        "app/(manager)/_layout.tsx",
        "app/(coordinator)/_layout.tsx",
      ];
      
      layouts.forEach((layout) => {
        const layoutPath = path.join(PROJECT_ROOT, layout);
        expect(fs.existsSync(layoutPath), `Missing: ${layout}`).toBe(true);
      });
    });

    it("should have root layout with all routes configured", () => {
      const layoutPath = path.join(PROJECT_ROOT, "app/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      // Check for all major routes
      expect(content).toContain('name="(tabs)"');
      expect(content).toContain('name="(trainer)"');
      expect(content).toContain('name="(client)"');
      expect(content).toContain('name="(manager)"');
      expect(content).toContain('name="(coordinator)"');
      expect(content).toContain('name="login"');
      expect(content).toContain('name="register"');
      expect(content).toContain('name="bundle/[id]"');
      expect(content).toContain('name="checkout/index"');
      expect(content).toContain('name="messages/index"');
      expect(content).toContain('name="trainer/[id]"');
      expect(content).toContain('name="invite/[token]"');
    });
  });

  describe("Shopper Features", () => {
    it("should have catalog/home screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(tabs)/index.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have products catalog screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(tabs)/products.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Products");
      expect(content).toContain("addItem");
    });

    it("should have trainer directory screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(tabs)/trainers.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Trainer");
      expect(content).toContain("specialties");
    });

    it("should have cart screen with checkout", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(tabs)/cart.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Cart");
      expect(content).toContain("checkout");
    });

    it("should have bundle detail screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/bundle/[id].tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have public trainer profile screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/trainer/[id].tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });
  });

  describe("Trainer Features", () => {
    it("should have trainer home with money-first copy", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(trainer)/index.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Let’s get you paid.");
      expect(content).toContain("Progress");
    });

    it("should have bundles management screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(trainer)/bundles.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have clients list screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(trainer)/clients.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have calendar screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(trainer)/calendar.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Calendar");
      expect(content).toContain("session");
    });

    it("should have orders management screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(trainer)/orders.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Orders");
      expect(content).toContain("pending");
    });

    it("should have settings screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(trainer)/settings.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Settings");
      expect(content).toContain("username");
      expect(content).toContain("bio");
    });

    it("should have rewards/status screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(trainer)/points.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const pointsContent = fs.readFileSync(screenPath, "utf-8");
      const rewardsPath = path.join(PROJECT_ROOT, "app/(trainer)/rewards.tsx");
      const rewardsContent = fs.readFileSync(rewardsPath, "utf-8");
      expect(pointsContent).toContain("./rewards");
      expect(rewardsContent).toContain("Rewards");
      expect(rewardsContent).toContain("How points work");
    });

    it("should have invite screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(trainer)/invite.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Invite");
    });

    it("should have bundle editor screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/bundle-editor/[id].tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have client detail screen with active offers and payment history", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/client-detail/[id].tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Active offers");
      expect(content).toContain("Payment history");
    });
  });

  describe("Client Features", () => {
    it("should have client dashboard", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(client)/index.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have subscriptions screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(client)/subscriptions.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Subscription");
      expect(content).toContain("pause");
    });

    it("should have deliveries screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(client)/deliveries.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Deliver");
      expect(content).toContain("confirm");
    });

    it("should have spending screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(client)/spending.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Spending");
    });
  });

  describe("Manager Features", () => {
    it("should have manager dashboard", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(manager)/index.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Dashboard");
      expect(content).toContain("Low Inventory");
    });

    it("should have users management screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(manager)/users.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Users");
      expect(content).toContain("role");
    });

    it("should have trainers management screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(manager)/trainers.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have analytics screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(manager)/analytics.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Analytics");
      expect(content).toContain("Revenue");
    });

    it("should have templates screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(manager)/templates.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have invitations screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(manager)/invitations.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });
  });

  describe("Coordinator Features", () => {
    it("should have coordinator dashboard screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(coordinator)/index.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("CoordinatorHomeScreen");
      expect(content).toContain("QuickAction");
    });

    it("should have logs screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/(coordinator)/logs.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Logs");
      expect(content).toContain("impersonation");
    });
  });

  describe("Checkout Features", () => {
    it("should have checkout screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/checkout/index.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Checkout");
    });

    it("should have confirmation screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/checkout/confirmation.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });
  });

  describe("Messaging Features", () => {
    it("should have conversations list screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/messages/index.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have message thread screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/messages/[id].tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });
  });

  describe("Invitation Features", () => {
    it("should have invitation landing page", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/invite/[token].tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
      const content = fs.readFileSync(screenPath, "utf-8");
      expect(content).toContain("Accept");
      expect(content).toContain("Decline");
      expect(content).toContain("products");
      expect(content).toContain("services");
      expect(content).toContain("goals");
      expect(content).toContain("personalMessage");
    });
  });

  describe("Authentication", () => {
    it("should have login screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/login.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have register screen", () => {
      const screenPath = path.join(PROJECT_ROOT, "app/register.tsx");
      expect(fs.existsSync(screenPath)).toBe(true);
    });

    it("should have auth context", () => {
      const contextPath = path.join(PROJECT_ROOT, "contexts/auth-context.tsx");
      expect(fs.existsSync(contextPath)).toBe(true);
    });
  });

  describe("Cart Context", () => {
    it("should have cart context with all required functions", () => {
      const contextPath = path.join(PROJECT_ROOT, "contexts/cart-context.tsx");
      expect(fs.existsSync(contextPath)).toBe(true);
      const content = fs.readFileSync(contextPath, "utf-8");
      expect(content).toContain("addItem");
      expect(content).toContain("removeItem");
      expect(content).toContain("updateQuantity");
      expect(content).toContain("clearCart");
      expect(content).toContain("AsyncStorage");
    });
  });

  describe("Icon Mappings", () => {
    it("should have all required icon mappings", () => {
      const iconPath = path.join(PROJECT_ROOT, "components/ui/icon-symbol.tsx");
      const content = fs.readFileSync(iconPath, "utf-8");
      
      const requiredIcons = [
        "house.fill",
        "cart.fill",
        "person.fill",
        "figure.run",
        "calendar",
        "bag.fill",
        "shippingbox.fill",
        "chart.bar.fill",
        "person.badge.key.fill",
        "star.fill",
        "magnifyingglass",
      ];
      
      requiredIcons.forEach((icon) => {
        expect(content, `Missing icon: ${icon}`).toContain(`"${icon}"`);
      });
    });
  });

  describe("Database Schema", () => {
    it("should have all required tables", () => {
      const migrationPath = path.join(PROJECT_ROOT, "supabase/migrations/001_initial_schema.sql");
      const content = fs.readFileSync(migrationPath, "utf-8");
      
      const requiredTables = [
        "users",
        "bundle_drafts",
        "products",
        "subscriptions",
        "orders",
        "product_deliveries",
        "messages",
        "invitations",
      ];
      
      requiredTables.forEach((table) => {
        expect(content, `Missing table: ${table}`).toContain(`CREATE TABLE ${table}`);
      });
    });

    it("should have session tracking fields in subscriptions", () => {
      const migrationPath = path.join(PROJECT_ROOT, "supabase/migrations/001_initial_schema.sql");
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("sessions_included");
      expect(content).toContain("sessions_used");
    });
  });

  describe("Server Routers", () => {
    it("should have all required routers", () => {
      const routersPath = path.join(PROJECT_ROOT, "server/routers.ts");
      const content = fs.readFileSync(routersPath, "utf-8");
      
      expect(content).toContain("catalog");
      expect(content).toContain("trainer");
      expect(content).toContain("client");
      expect(content).toContain("orders");
      expect(content).toContain("deliveries");
      expect(content).toContain("messages");
    });
  });
});
