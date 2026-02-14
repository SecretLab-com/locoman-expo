import { describe, it, expect } from "vitest";

describe("LocoMotivate App", () => {
  describe("Theme Configuration", () => {
    it("should have valid theme colors defined", async () => {
      const themeConfig = await import("../theme.config.js");
      const { themeColors } = themeConfig;

      expect(themeColors).toBeDefined();
      expect(themeColors.primary).toBeDefined();
      // Bright Express inspired blue theme
      expect(themeColors.primary.light).toBe("#3B82F6");
      expect(themeColors.primary.dark).toBe("#60A5FA");
      expect(themeColors.background).toBeDefined();
      expect(themeColors.foreground).toBeDefined();
      expect(themeColors.surface).toBeDefined();
      expect(themeColors.muted).toBeDefined();
      expect(themeColors.border).toBeDefined();
      expect(themeColors.success).toBeDefined();
      expect(themeColors.warning).toBeDefined();
      expect(themeColors.error).toBeDefined();
    });
  });

  describe("Icon Mappings", () => {
    it("should have all required icon mappings", async () => {
      // We can't directly import the component due to React Native dependencies
      // but we can verify the file exists and has expected structure
      const fs = await import("fs");
      const path = await import("path");
      
      const iconFilePath = path.join(process.cwd(), "components/ui/icon-symbol.tsx");
      const fileContent = fs.readFileSync(iconFilePath, "utf-8");

      // Check for required icon mappings
      expect(fileContent).toContain("house.fill");
      expect(fileContent).toContain("cart.fill");
      expect(fileContent).toContain("person.fill");
      expect(fileContent).toContain("bag.fill");
      expect(fileContent).toContain("chart.bar.fill");
      expect(fileContent).toContain("magnifyingglass");
      expect(fileContent).toContain("plus");
      expect(fileContent).toContain("chevron.right");
    });
  });

  describe("App Configuration", () => {
    it("should have valid app.config.ts with branding", async () => {
      const fs = await import("fs");
      const path = await import("path");
      
      const configFilePath = path.join(process.cwd(), "app.config.ts");
      const fileContent = fs.readFileSync(configFilePath, "utf-8");

      // Check for app name configuration
      expect(fileContent).toContain("appName:");
      expect(fileContent).toContain("LocoMotivate");
      expect(fileContent).toContain("appSlug:");
      expect(fileContent).toContain("locomotivate");
      
      // Check for logo URL configuration
      expect(fileContent).toContain("logoUrl:");
    });
  });

  describe("Screen Files Exist", () => {
    it("should have all required screen files", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const requiredScreens = [
        "app/(tabs)/index.tsx",
        "app/(tabs)/cart.tsx",
        "app/(tabs)/profile.tsx",
        "app/(tabs)/_layout.tsx",
        "app/login.tsx",
        "app/register.tsx",
        "app/bundle/[id].tsx",
        "app/(trainer)/index.tsx",
        "app/(trainer)/bundles.tsx",
        "app/(trainer)/clients.tsx",
        "app/(trainer)/earnings.tsx",
        "app/(trainer)/_layout.tsx",
        "app/(client)/index.tsx",
        "app/(client)/orders.tsx",
        "app/(client)/deliveries.tsx",
        "app/(client)/_layout.tsx",
      ];

      for (const screen of requiredScreens) {
        const screenPath = path.join(process.cwd(), screen);
        expect(fs.existsSync(screenPath), `Screen ${screen} should exist`).toBe(true);
      }
    });
  });

  describe("Root Layout Configuration", () => {
    it("should have proper stack navigation setup", async () => {
      const fs = await import("fs");
      const path = await import("path");
      
      const layoutFilePath = path.join(process.cwd(), "app/_layout.tsx");
      const fileContent = fs.readFileSync(layoutFilePath, "utf-8");

      // Check for required screen registrations
      expect(fileContent).toContain('name="(tabs)"');
      expect(fileContent).toContain('name="login"');
      expect(fileContent).toContain('name="register"');
      expect(fileContent).toContain('name="bundle/[id]"');
      expect(fileContent).toContain('name="(trainer)"');
      expect(fileContent).toContain('name="(client)"');
      expect(fileContent).toContain('name="oauth/callback"');
    });
  });

  describe("Design Documentation", () => {
    it("should have design.md with proper structure", async () => {
      const fs = await import("fs");
      const path = await import("path");
      
      const designFilePath = path.join(process.cwd(), "design.md");
      const fileContent = fs.readFileSync(designFilePath, "utf-8");

      // Check for required sections
      expect(fileContent).toContain("Screen List");
      expect(fileContent).toContain("Key User Flows");
      expect(fileContent).toContain("Primary Content and Functionality");
    });
  });

  describe("Todo Tracking", () => {
    it("should have todo.md with completed items", async () => {
      const fs = await import("fs");
      const path = await import("path");
      
      const todoFilePath = path.join(process.cwd(), "todo.md");
      const fileContent = fs.readFileSync(todoFilePath, "utf-8");

      // Check for completed items
      expect(fileContent).toContain("[x] Generate app logo");
      expect(fileContent).toContain("[x] Login screen");
      expect(fileContent).toContain("[x] Catalog screen");
      expect(fileContent).toContain("[x] Cart screen");
      expect(fileContent).toContain("[x] Trainer dashboard");
      expect(fileContent).toContain("[x] Client home dashboard");
    });
  });
});
