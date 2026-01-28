import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("User Journey Validation", () => {
  const projectRoot = path.resolve(__dirname, "..");

  describe("Login Screen Enhancements", () => {
    it("should have password visibility toggle", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("showPassword");
      expect(content).toContain("setShowPassword");
      expect(content).toContain("togglePasswordVisibility");
      expect(content).toContain("eye.fill");
      expect(content).toContain("eye.slash.fill");
    });

    it("should have Remember Me option", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("rememberMe");
      expect(content).toContain("setRememberMe");
      expect(content).toContain("REMEMBER_ME_KEY");
      expect(content).toContain("SAVED_EMAIL_KEY");
      expect(content).toContain("AsyncStorage");
    });

    it("should have test account quick-fill buttons", () => {
      const loginPath = path.join(projectRoot, "app/login.tsx");
      const content = fs.readFileSync(loginPath, "utf-8");
      
      expect(content).toContain("trainer@secretlab.com");
      expect(content).toContain("client@secretlab.com");
      expect(content).toContain("manager@secretlab.com");
      expect(content).toContain("testuser@secretlab.com");
      expect(content).toContain("Test Accounts");
    });
  });

  describe("Trainer Journey", () => {
    it("should have trainer dashboard with navigation to bundles", () => {
      const dashboardPath = path.join(projectRoot, "app/(trainer)/index.tsx");
      const content = fs.readFileSync(dashboardPath, "utf-8");
      
      expect(content).toContain("Dashboard");
      expect(content).toContain("Active Bundles");
      expect(content).toContain('router.push("/(trainer)/bundles"');
      expect(content).toContain("New Bundle");
      expect(content).toContain('router.push("/bundle-editor/new"');
    });

    it("should have trainer bundles screen with create button", () => {
      const bundlesPath = path.join(projectRoot, "app/(trainer)/bundles.tsx");
      const content = fs.readFileSync(bundlesPath, "utf-8");
      
      expect(content).toContain("My Bundles");
      expect(content).toContain("handleCreateBundle");
      expect(content).toContain('router.push("/bundle-editor/new"');
      expect(content).toContain("Create Your First Bundle");
    });

    it("should have bundle editor with submit for review", () => {
      const editorPath = path.join(projectRoot, "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(editorPath, "utf-8");
      
      expect(content).toContain("handleSubmitForReview");
      expect(content).toContain("submitForReviewMutation");
      expect(content).toContain("Submit for Review");
      expect(content).toContain("pending_review");
    });

    it("should have trainer layout with correct tabs", () => {
      const layoutPath = path.join(projectRoot, "app/(trainer)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain("Home"); // Home tab goes to Dashboard (index)
      expect(content).toContain("Calendar");
      expect(content).toContain("Clients");
      expect(content).toContain("Deliveries");
      expect(content).toContain("Earnings");
    });
  });

  describe("Client Journey", () => {
    it("should have client dashboard", () => {
      const dashboardPath = path.join(projectRoot, "app/(client)/index.tsx");
      const content = fs.readFileSync(dashboardPath, "utf-8");
      
      expect(fs.existsSync(dashboardPath)).toBe(true);
    });

    it("should have client subscriptions screen", () => {
      const subscriptionsPath = path.join(projectRoot, "app/(client)/subscriptions.tsx");
      const content = fs.readFileSync(subscriptionsPath, "utf-8");
      
      expect(fs.existsSync(subscriptionsPath)).toBe(true);
    });

    it("should have client deliveries screen", () => {
      const deliveriesPath = path.join(projectRoot, "app/(client)/deliveries.tsx");
      const content = fs.readFileSync(deliveriesPath, "utf-8");
      
      expect(fs.existsSync(deliveriesPath)).toBe(true);
    });

    it("should have client layout with correct tabs", () => {
      const layoutPath = path.join(projectRoot, "app/(client)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain("Home");
      expect(content).toContain("Programs");
      expect(content).toContain("Deliveries");
      expect(content).toContain("Spending");
    });
  });

  describe("Manager Journey", () => {
    it("should have manager dashboard", () => {
      const dashboardPath = path.join(projectRoot, "app/(manager)/index.tsx");
      const content = fs.readFileSync(dashboardPath, "utf-8");
      
      expect(fs.existsSync(dashboardPath)).toBe(true);
    });

    it("should have manager approvals screen", () => {
      const approvalsPath = path.join(projectRoot, "app/(manager)/approvals.tsx");
      const content = fs.readFileSync(approvalsPath, "utf-8");
      
      expect(fs.existsSync(approvalsPath)).toBe(true);
    });

    it("should have manager users screen", () => {
      const usersPath = path.join(projectRoot, "app/(manager)/users.tsx");
      const content = fs.readFileSync(usersPath, "utf-8");
      
      expect(fs.existsSync(usersPath)).toBe(true);
    });

    it("should have manager layout with correct tabs", () => {
      const layoutPath = path.join(projectRoot, "app/(manager)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain("Home"); // Home tab goes to Dashboard (index)
      expect(content).toContain("Approvals");
      expect(content).toContain("Users");
      expect(content).toContain("Analytics");
    });
  });

  describe("Shopper Journey", () => {
    it("should have catalog/discover screen", () => {
      const catalogPath = path.join(projectRoot, "app/(tabs)/index.tsx");
      const content = fs.readFileSync(catalogPath, "utf-8");
      
      expect(content).toContain("Discover");
      expect(content).toContain("BundleCard");
      expect(content).toContain("handleBundlePress");
    });

    it("should have cart screen", () => {
      const cartPath = path.join(projectRoot, "app/(tabs)/cart.tsx");
      const content = fs.readFileSync(cartPath, "utf-8");
      
      expect(fs.existsSync(cartPath)).toBe(true);
    });

    it("should have checkout flow", () => {
      const checkoutPath = path.join(projectRoot, "app/checkout/index.tsx");
      const confirmationPath = path.join(projectRoot, "app/checkout/confirmation.tsx");
      
      expect(fs.existsSync(checkoutPath)).toBe(true);
      expect(fs.existsSync(confirmationPath)).toBe(true);
    });

    it("should have products screen", () => {
      const productsPath = path.join(projectRoot, "app/(tabs)/products.tsx");
      const content = fs.readFileSync(productsPath, "utf-8");
      
      expect(fs.existsSync(productsPath)).toBe(true);
    });
  });

  describe("Profile Screen Role-Based Navigation", () => {
    it("should have role-based dashboard navigation", () => {
      const profilePath = path.join(projectRoot, "app/(tabs)/profile.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      
      expect(content).toContain("useAuthContext");
      expect(content).toContain("isTrainer");
      expect(content).toContain("isClient");
      expect(content).toContain("isManager");
      expect(content).toContain("isCoordinator");
    });

    it("should navigate to correct dashboard based on role", () => {
      const profilePath = path.join(projectRoot, "app/(tabs)/profile.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      
      expect(content).toContain('router.push("/(coordinator)"');
      expect(content).toContain('router.push("/(manager)"');
      expect(content).toContain('router.push("/(trainer)"');
      expect(content).toContain('router.push("/(client)"');
    });

    it("should show role badge", () => {
      const profilePath = path.join(projectRoot, "app/(tabs)/profile.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      
      expect(content).toContain("RoleBadge");
      expect(content).toContain("Trainer");
      expect(content).toContain("Client");
      expect(content).toContain("Manager");
      expect(content).toContain("Coordinator");
      expect(content).toContain("Shopper");
    });

    it("should show trainer quick actions for trainers", () => {
      const profilePath = path.join(projectRoot, "app/(tabs)/profile.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      
      expect(content).toContain("Trainer Actions");
      expect(content).toContain("Create New Bundle");
      expect(content).toContain("Invite Client");
      expect(content).toContain("My Bundles");
    });

    it("should show manager quick actions for managers", () => {
      const profilePath = path.join(projectRoot, "app/(tabs)/profile.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      
      expect(content).toContain("Manager Actions");
      expect(content).toContain("Pending Approvals");
      expect(content).toContain("Manage Users");
    });
  });

  describe("Route Configuration", () => {
    it("should have all role-based routes in main layout", () => {
      const layoutPath = path.join(projectRoot, "app/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain('name="(trainer)"');
      expect(content).toContain('name="(client)"');
      expect(content).toContain('name="(manager)"');
      expect(content).toContain('name="(coordinator)"');
    });

    it("should have bundle editor route", () => {
      const layoutPath = path.join(projectRoot, "app/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain('name="bundle-editor/[id]"');
    });

    it("should have checkout routes", () => {
      const layoutPath = path.join(projectRoot, "app/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain('name="checkout/index"');
      expect(content).toContain('name="checkout/confirmation"');
    });
  });
});
