import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Follow-up Features Implementation", () => {
  describe("Haptic Feedback", () => {
    it("should have use-haptics hook", () => {
      const filePath = path.join(process.cwd(), "hooks/use-haptics.ts");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("haptics");
      expect(content).toContain("impactAsync");
    });

    it("should have HapticButton component", () => {
      const filePath = path.join(process.cwd(), "components/haptic-button.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("HapticButton");
      expect(content).toContain("haptics");
    });

    it("should have haptic feedback in login screen", () => {
      const filePath = path.join(process.cwd(), "app/login.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("haptics");
    });
  });

  describe("Offline Mode", () => {
    it("should have offline-cache service", () => {
      const filePath = path.join(process.cwd(), "lib/offline-cache.ts");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("AsyncStorage");
      expect(content).toContain("getCachedBundles");
      expect(content).toContain("cacheBundles");
    });

    it("should have offline context provider", () => {
      const filePath = path.join(process.cwd(), "contexts/offline-context.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("OfflineProvider");
      expect(content).toContain("isOnline");
    });

    it("should have offline indicator component", () => {
      const filePath = path.join(process.cwd(), "components/offline-indicator.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("OfflineIndicator");
      expect(content).toContain("offline");
    });

    it("should use offline caching in catalog screen", () => {
      const filePath = path.join(process.cwd(), "app/(tabs)/index.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("useOffline");
    });
  });

  describe("Bundle Editor", () => {
    it("should have bundle editor screen", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should have tab-based UI in bundle editor", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("details");
      expect(content).toContain("services");
      expect(content).toContain("products");
      expect(content).toContain("goals");
    });

    it("should have service management in bundle editor", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("ServiceItem");
      expect(content).toContain("addService");
      expect(content).toContain("removeService");
      expect(content).toContain("updateService");
    });

    it("should have product selection in bundle editor", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("ProductItem");
      expect(content).toContain("toggleProduct");
      expect(content).toContain("showProductModal");
    });

    it("should have goal selection in bundle editor", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("GOAL_SUGGESTIONS");
      expect(content).toContain("toggleGoal");
      expect(content).toContain("customGoal");
    });

    it("should have AI image generation in bundle editor", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("generateImageMutation");
      expect(content).toContain("handleGenerateImage");
      expect(content).toContain("Generate with AI");
    });

    it("should have submit for review workflow", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("handleSubmitForReview");
      expect(content).toContain("submitForReviewMutation");
      expect(content).toContain("Submit for Review");
    });

    it("should have price auto-calculation", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("productTotal");
      expect(content).toContain("servicesTotal");
      expect(content).toContain("Price Summary");
    });

    it("should have status badges for bundle states", () => {
      const filePath = path.join(process.cwd(), "app/bundle-editor/[id].tsx");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("pending_review");
      expect(content).toContain("rejected");
      expect(content).toContain("rejectionReason");
    });
  });

  describe("Pull-to-Refresh", () => {
    it("should have RefreshableScrollView component", () => {
      const filePath = path.join(process.cwd(), "components/refreshable-scroll-view.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("RefreshControl");
      expect(content).toContain("onRefresh");
    });
  });

  describe("Loading Skeletons", () => {
    it("should have skeleton components", () => {
      const filePath = path.join(process.cwd(), "components/skeleton.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("Skeleton");
      expect(content).toContain("BundleCardSkeleton");
      expect(content).toContain("ProductCardSkeleton");
    });
  });

  describe("Media Picker", () => {
    it("should have media picker component", () => {
      const filePath = path.join(process.cwd(), "components/media-picker.tsx");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("ImagePicker");
      expect(content).toContain("SingleImagePicker");
    });
  });

  describe("Shopify Integration", () => {
    it("should have Shopify service", () => {
      const filePath = path.join(process.cwd(), "server/shopify.ts");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("fetchProducts");
      expect(content).toContain("createCheckout");
    });

    it("should have Shopify router in server", () => {
      const filePath = path.join(process.cwd(), "server/routers.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("shopify");
    });
  });

  describe("AI Image Generation", () => {
    it("should have image generation service", () => {
      const filePath = path.join(process.cwd(), "lib/image-generation.ts");
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("buildBundleImagePrompt");
    });

    it("should have AI router in server", () => {
      const filePath = path.join(process.cwd(), "server/routers.ts");
      const content = fs.readFileSync(filePath, "utf-8");
      expect(content).toContain("ai:");
      expect(content).toContain("generateBundleImage");
    });
  });
});
