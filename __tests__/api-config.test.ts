import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock react-native Platform
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios", // Default to iOS for testing
  },
}));

describe("API Config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getApiBaseUrl", () => {
    it("should return hardcoded URL for iOS platform", async () => {
      // Mock Platform.OS as ios
      vi.doMock("react-native", () => ({
        Platform: { OS: "ios" },
      }));

      const { getApiBaseUrl } = await import("../lib/api-config");
      const url = getApiBaseUrl();
      
      expect(url).toBe("https://3002-i4anndi9mla842misgiwl-a70979ba.sg1.manus.computer");
    });

    it("should return hardcoded URL for Android platform", async () => {
      // Mock Platform.OS as android
      vi.doMock("react-native", () => ({
        Platform: { OS: "android" },
      }));

      const { getApiBaseUrl } = await import("../lib/api-config");
      const url = getApiBaseUrl();
      
      expect(url).toBe("https://3002-i4anndi9mla842misgiwl-a70979ba.sg1.manus.computer");
    });

    it("should derive URL from hostname for web platform", async () => {
      // Mock Platform.OS as web
      vi.doMock("react-native", () => ({
        Platform: { OS: "web" },
      }));

      // Mock window.location
      const originalWindow = global.window;
      global.window = {
        location: {
          protocol: "https:",
          hostname: "8081-sandbox.region.domain",
        },
      } as any;

      const { getApiBaseUrl } = await import("../lib/api-config");
      const url = getApiBaseUrl();
      
      expect(url).toBe("https://3002-sandbox.region.domain");

      global.window = originalWindow;
    });

    it("should return empty string for web when hostname doesn't match pattern", async () => {
      // Mock Platform.OS as web
      vi.doMock("react-native", () => ({
        Platform: { OS: "web" },
      }));

      // Mock window.location with non-matching hostname
      const originalWindow = global.window;
      global.window = {
        location: {
          protocol: "https:",
          hostname: "localhost",
        },
      } as any;

      const { getApiBaseUrl } = await import("../lib/api-config");
      const url = getApiBaseUrl();
      
      expect(url).toBe("");

      global.window = originalWindow;
    });
  });

  describe("getTrpcUrl", () => {
    it("should append /api/trpc to base URL", async () => {
      // Mock Platform.OS as ios
      vi.doMock("react-native", () => ({
        Platform: { OS: "ios" },
      }));

      const { getTrpcUrl } = await import("../lib/api-config");
      const url = getTrpcUrl();
      
      expect(url).toBe("https://3002-i4anndi9mla842misgiwl-a70979ba.sg1.manus.computer/api/trpc");
    });
  });

  describe("Native platform detection", () => {
    it("should correctly identify iOS as native", async () => {
      vi.doMock("react-native", () => ({
        Platform: { OS: "ios" },
      }));

      const { getApiBaseUrl } = await import("../lib/api-config");
      const url = getApiBaseUrl();
      
      // Native platforms should use hardcoded URL
      expect(url).toContain("3002-");
      expect(url).not.toBe("");
    });

    it("should correctly identify Android as native", async () => {
      vi.doMock("react-native", () => ({
        Platform: { OS: "android" },
      }));

      const { getApiBaseUrl } = await import("../lib/api-config");
      const url = getApiBaseUrl();
      
      // Native platforms should use hardcoded URL
      expect(url).toContain("3002-");
      expect(url).not.toBe("");
    });
  });
});
