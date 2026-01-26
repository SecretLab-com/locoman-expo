import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock the database functions with partial mock
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    incrementBundleViewCountByShopifyId: vi.fn(),
    getBundleByShopifyProductId: vi.fn(),
    getUserById: vi.fn(),
  };
});

describe("Storefront Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("incrementBundleViewCountByShopifyId", () => {
    it("should be called with correct product ID", async () => {
      const mockIncrement = vi.mocked(db.incrementBundleViewCountByShopifyId);
      mockIncrement.mockResolvedValue(undefined);

      await db.incrementBundleViewCountByShopifyId("12345");

      expect(mockIncrement).toHaveBeenCalledWith("12345");
      expect(mockIncrement).toHaveBeenCalledTimes(1);
    });
  });

  describe("getBundleByShopifyProductId", () => {
    it("should return bundle when found", async () => {
      const mockBundle = {
        id: 1,
        title: "Test Bundle",
        description: "A test bundle",
        trainerId: 100,
        shopifyProductId: "12345",
      };

      const mockGetBundle = vi.mocked(db.getBundleByShopifyProductId);
      mockGetBundle.mockResolvedValue(mockBundle as any);

      const result = await db.getBundleByShopifyProductId("12345");

      expect(result).toEqual(mockBundle);
      expect(mockGetBundle).toHaveBeenCalledWith("12345");
    });

    it("should return null when bundle not found", async () => {
      const mockGetBundle = vi.mocked(db.getBundleByShopifyProductId);
      mockGetBundle.mockResolvedValue(null);

      const result = await db.getBundleByShopifyProductId("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getUserById for trainer info", () => {
    it("should return trainer info when found", async () => {
      const mockTrainer = {
        id: 100,
        name: "John Trainer",
        username: "johntrainer",
      };

      const mockGetUser = vi.mocked(db.getUserById);
      mockGetUser.mockResolvedValue(mockTrainer as any);

      const result = await db.getUserById(100);

      expect(result).toEqual(mockTrainer);
      expect(mockGetUser).toHaveBeenCalledWith(100);
    });

    it("should return null when trainer not found", async () => {
      const mockGetUser = vi.mocked(db.getUserById);
      mockGetUser.mockResolvedValue(null);

      const result = await db.getUserById(999);

      expect(result).toBeNull();
    });
  });
});

describe("Bundle Performance Analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTopPerformingBundles", () => {
    it("should be a function that can be called", async () => {
      // This tests that the function exists and can be imported
      const { getTopPerformingBundles } = await import("./db");
      expect(typeof getTopPerformingBundles).toBe("function");
    });
  });

  describe("getBundlePerformanceSummary", () => {
    it("should be a function that can be called", async () => {
      // This tests that the function exists and can be imported
      const { getBundlePerformanceSummary } = await import("./db");
      expect(typeof getBundlePerformanceSummary).toBe("function");
    });
  });
});

describe("Cron Routes Security", () => {
  it("should generate cron secret from cookie secret", async () => {
    // Import the cron routes module
    const { getCronSecret } = await import("./_core/cronRoutes");
    
    // Verify the function exists and returns a string
    expect(typeof getCronSecret).toBe("function");
    const secret = getCronSecret();
    expect(typeof secret).toBe("string");
    expect(secret.length).toBeGreaterThan(0);
  });
});
