import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Navigation Simplification", () => {
  describe("Profile FAB Component", () => {
    it("should have ProfileFAB component file", () => {
      const fabPath = path.join(__dirname, "../components/profile-fab.tsx");
      expect(fs.existsSync(fabPath)).toBe(true);
    });

    it("should export ProfileFAB component", () => {
      const fabContent = fs.readFileSync(
        path.join(__dirname, "../components/profile-fab.tsx"),
        "utf-8"
      );
      expect(fabContent).toContain("export function ProfileFAB");
    });

    it("should include menu items for authenticated users", () => {
      const fabContent = fs.readFileSync(
        path.join(__dirname, "../components/profile-fab.tsx"),
        "utf-8"
      );
      expect(fabContent).toContain("My Profile");
      expect(fabContent).toContain("Settings");
      expect(fabContent).toContain("Sign Out");
    });

    it("should include menu items for unauthenticated users", () => {
      const fabContent = fs.readFileSync(
        path.join(__dirname, "../components/profile-fab.tsx"),
        "utf-8"
      );
      expect(fabContent).toContain("Sign In");
      expect(fabContent).toContain("Create Account");
    });

    it("should use safe area insets for positioning", () => {
      const fabContent = fs.readFileSync(
        path.join(__dirname, "../components/profile-fab.tsx"),
        "utf-8"
      );
      expect(fabContent).toContain("useSafeAreaInsets");
      expect(fabContent).toContain("insets.top");
    });
  });

  describe("Root Layout Integration", () => {
    it("should import ProfileFAB in root layout", () => {
      const layoutContent = fs.readFileSync(
        path.join(__dirname, "../app/_layout.tsx"),
        "utf-8"
      );
      expect(layoutContent).toContain("import { ProfileFAB }");
    });

    it("should render ProfileFAB in root layout", () => {
      const layoutContent = fs.readFileSync(
        path.join(__dirname, "../app/_layout.tsx"),
        "utf-8"
      );
      expect(layoutContent).toContain("<ProfileFAB />");
    });
  });

  describe("Browse Screen", () => {
    it("should have browse screen file", () => {
      const browsePath = path.join(__dirname, "../app/browse/index.tsx");
      expect(fs.existsSync(browsePath)).toBe(true);
    });

    it("should have tabs for bundles, products, and trainers", () => {
      const browseContent = fs.readFileSync(
        path.join(__dirname, "../app/browse/index.tsx"),
        "utf-8"
      );
      expect(browseContent).toContain("bundles");
      expect(browseContent).toContain("products");
      expect(browseContent).toContain("trainers");
    });

    it("should use public catalog endpoints", () => {
      const browseContent = fs.readFileSync(
        path.join(__dirname, "../app/browse/index.tsx"),
        "utf-8"
      );
      expect(browseContent).toContain("trpc.catalog.bundles");
      expect(browseContent).toContain("trpc.catalog.products");
      expect(browseContent).toContain("trpc.catalog.trainers");
    });

    it("should have back button for navigation", () => {
      const browseContent = fs.readFileSync(
        path.join(__dirname, "../app/browse/index.tsx"),
        "utf-8"
      );
      expect(browseContent).toContain("router.back()");
    });
  });

  describe("Client Dashboard Navigation", () => {
    it("should navigate to browse screen instead of tabs", () => {
      const clientDashContent = fs.readFileSync(
        path.join(__dirname, "../app/(client)/index.tsx"),
        "utf-8"
      );
      expect(clientDashContent).toContain('router.push("/browse")');
      expect(clientDashContent).not.toContain('router.push("/(tabs)")');
    });
  });

  describe("Tabs Layout", () => {
    it("should hide profile tab from tab bar", () => {
      const tabsLayoutContent = fs.readFileSync(
        path.join(__dirname, "../app/(tabs)/_layout.tsx"),
        "utf-8"
      );
      expect(tabsLayoutContent).toContain('name="profile"');
      expect(tabsLayoutContent).toContain("href: null");
    });

    it("should have comment explaining profile is accessed via FAB", () => {
      const tabsLayoutContent = fs.readFileSync(
        path.join(__dirname, "../app/(tabs)/_layout.tsx"),
        "utf-8"
      );
      expect(tabsLayoutContent).toContain("ProfileFAB");
    });
  });

  describe("Icon Symbol Mappings", () => {
    it("should have gear icon mapping", () => {
      const iconContent = fs.readFileSync(
        path.join(__dirname, "../components/ui/icon-symbol.tsx"),
        "utf-8"
      );
      expect(iconContent).toContain('"gear"');
    });

    it("should have person.circle.fill icon mapping", () => {
      const iconContent = fs.readFileSync(
        path.join(__dirname, "../components/ui/icon-symbol.tsx"),
        "utf-8"
      );
      expect(iconContent).toContain('"person.circle.fill"');
    });

    it("should have logout icon mapping", () => {
      const iconContent = fs.readFileSync(
        path.join(__dirname, "../components/ui/icon-symbol.tsx"),
        "utf-8"
      );
      expect(iconContent).toContain('"rectangle.portrait.and.arrow.right"');
    });
  });
});
