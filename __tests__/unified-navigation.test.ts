import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Tests for Unified Navigation Structure
 * 
 * The app now uses a single unified tab bar (Instagram/Uber pattern):
 * - One stable bottom tab bar that never changes
 * - 5 tabs: Home, Discover, Activity, Messages, Profile
 * - Role-specific content adapts within screens
 * - Role-specific screens open as Stack cards on top of tabs
 */

describe("Unified Navigation Structure", () => {
  describe("Unified Tabs Layout", () => {
    it("should have unified tabs with 5 stable tabs", () => {
      const layoutPath = path.join(process.cwd(), "app/(tabs)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      // Should have the 5 unified tabs
      expect(content).toContain('name="index"'); // Home
      expect(content).toContain('name="discover"');
      expect(content).toContain('name="activity"');
      expect(content).toContain('name="messages"');
      expect(content).toContain('name="profile"');
    });

    it("should have unified tab layout comment explaining the pattern", () => {
      const layoutPath = path.join(process.cwd(), "app/(tabs)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain("Unified Tab Layout");
      expect(content).toContain("STABLE bottom navigation");
    });
  });

  describe("Role-Specific Layouts Use Stack", () => {
    it("should have client layout using Stack instead of Tabs", () => {
      const layoutPath = path.join(process.cwd(), "app/(client)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain('import { Stack } from "expo-router"');
      expect(content).not.toContain('import { Tabs } from "expo-router"');
      expect(content).toContain("Client Stack Layout");
    });

    it("should have trainer layout using Stack instead of Tabs", () => {
      const layoutPath = path.join(process.cwd(), "app/(trainer)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain('import { Stack } from "expo-router"');
      expect(content).not.toContain('import { Tabs } from "expo-router"');
      expect(content).toContain("Trainer Stack Layout");
    });

    it("should have manager layout using Stack instead of Tabs", () => {
      const layoutPath = path.join(process.cwd(), "app/(manager)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain('import { Stack } from "expo-router"');
      expect(content).not.toContain('import { Tabs } from "expo-router"');
      expect(content).toContain("Manager Stack Layout");
    });

    it("should have coordinator layout using Stack instead of Tabs", () => {
      const layoutPath = path.join(process.cwd(), "app/(coordinator)/_layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");
      
      expect(content).toContain('import { Stack } from "expo-router"');
      expect(content).not.toContain('import { Tabs } from "expo-router"');
      expect(content).toContain("Coordinator Stack Layout");
    });
  });

  describe("Navigation Utility", () => {
    it("should always route to unified tabs", () => {
      const navPath = path.join(process.cwd(), "lib/navigation.ts");
      const content = fs.readFileSync(navPath, "utf-8");
      
      // Should always return /(tabs)
      expect(content).toContain('return "/(tabs)"');
      expect(content).toContain("UNIFIED NAVIGATION PATTERN");
    });

    it("should have role screen routes for Stack navigation", () => {
      const navPath = path.join(process.cwd(), "lib/navigation.ts");
      const content = fs.readFileSync(navPath, "utf-8");
      
      expect(content).toContain("RoleScreens");
      expect(content).toContain("client:");
      expect(content).toContain("trainer:");
      expect(content).toContain("manager:");
      expect(content).toContain("coordinator:");
    });
  });

  describe("Unified Home Screen", () => {
    it("should have role-adaptive home screen", () => {
      const homePath = path.join(process.cwd(), "app/(tabs)/index.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      
      expect(content).toContain("UnifiedHomeScreen");
      expect(content).toContain("ShopperHome");
      expect(content).toContain("ClientHome");
      expect(content).toContain("TrainerHome");
      expect(content).toContain("ManagerHome");
      expect(content).toContain("CoordinatorHome");
    });

    it("should adapt content based on role", () => {
      const homePath = path.join(process.cwd(), "app/(tabs)/index.tsx");
      const content = fs.readFileSync(homePath, "utf-8");
      
      expect(content).toContain("effectiveRole");
      expect(content).toContain('case "coordinator"');
      expect(content).toContain('case "manager"');
      expect(content).toContain('case "trainer"');
      expect(content).toContain('case "client"');
    });
  });

  describe("Role-Specific Dashboard Components", () => {
    it("should have shopper home dashboard component", () => {
      const dashPath = path.join(process.cwd(), "components/dashboards/shopper-home.tsx");
      expect(fs.existsSync(dashPath)).toBe(true);
      const content = fs.readFileSync(dashPath, "utf-8");
      expect(content).toContain("ShopperHome");
    });

    it("should have client home dashboard component", () => {
      const dashPath = path.join(process.cwd(), "components/dashboards/client-home.tsx");
      expect(fs.existsSync(dashPath)).toBe(true);
      const content = fs.readFileSync(dashPath, "utf-8");
      expect(content).toContain("ClientHome");
    });

    it("should have trainer home dashboard component", () => {
      const dashPath = path.join(process.cwd(), "components/dashboards/trainer-home.tsx");
      expect(fs.existsSync(dashPath)).toBe(true);
      const content = fs.readFileSync(dashPath, "utf-8");
      expect(content).toContain("TrainerHome");
    });

    it("should have manager home dashboard component", () => {
      const dashPath = path.join(process.cwd(), "components/dashboards/manager-home.tsx");
      expect(fs.existsSync(dashPath)).toBe(true);
      const content = fs.readFileSync(dashPath, "utf-8");
      expect(content).toContain("ManagerHome");
    });

    it("should have coordinator home dashboard component", () => {
      const dashPath = path.join(process.cwd(), "components/dashboards/coordinator-home.tsx");
      expect(fs.existsSync(dashPath)).toBe(true);
      const content = fs.readFileSync(dashPath, "utf-8");
      expect(content).toContain("CoordinatorHome");
    });
  });

  describe("Profile Screen", () => {
    it("should have simplified profile without dashboard navigation", () => {
      const profilePath = path.join(process.cwd(), "app/(tabs)/profile.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      
      // Should not have the old dashboard navigation
      expect(content).not.toContain("handleDashboardPress");
      expect(content).not.toContain("getDashboardLabel");
      
      // Should have the new header
      expect(content).toContain("Profile");
      expect(content).toContain("Manage your account");
    });

    it("should still have role-specific quick actions", () => {
      const profilePath = path.join(process.cwd(), "app/(tabs)/profile.tsx");
      const content = fs.readFileSync(profilePath, "utf-8");
      
      // Trainer actions
      expect(content).toContain("Trainer Actions");
      expect(content).toContain("Create New Bundle");
      
      // Manager actions
      expect(content).toContain("Manager Actions");
      expect(content).toContain("Pending Approvals");
    });
  });

  describe("Tab Screens", () => {
    it("should have discover tab screen", () => {
      const discoverPath = path.join(process.cwd(), "app/(tabs)/discover.tsx");
      expect(fs.existsSync(discoverPath)).toBe(true);
      const content = fs.readFileSync(discoverPath, "utf-8");
      expect(content).toContain("DiscoverScreen");
    });

    it("should have activity tab screen", () => {
      const activityPath = path.join(process.cwd(), "app/(tabs)/activity.tsx");
      expect(fs.existsSync(activityPath)).toBe(true);
      const content = fs.readFileSync(activityPath, "utf-8");
      expect(content).toContain("ActivityScreen");
    });

    it("should have messages tab screen", () => {
      const messagesPath = path.join(process.cwd(), "app/(tabs)/messages.tsx");
      expect(fs.existsSync(messagesPath)).toBe(true);
      const content = fs.readFileSync(messagesPath, "utf-8");
      expect(content).toContain("MessagesScreen");
    });
  });
});
