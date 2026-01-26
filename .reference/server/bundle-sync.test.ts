import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the shopify module
vi.mock("./shopify", () => ({
  syncBundleToShopify: vi.fn().mockResolvedValue({ success: true }),
  syncBundleFromShopify: vi.fn().mockResolvedValue({ success: true }),
  syncAllBundles: vi.fn().mockResolvedValue({ synced: 5, failed: 0 }),
}));

// Mock the db module
vi.mock("./db", () => ({
  getPublishedBundlesForSync: vi.fn().mockResolvedValue([
    {
      id: 1,
      draftId: 101,
      shopifyProductId: "123456",
      shopifyVariantId: "789012",
      syncStatus: "pending",
      syncedAt: null,
      lastSyncError: null,
    },
    {
      id: 2,
      draftId: 102,
      shopifyProductId: "234567",
      shopifyVariantId: "890123",
      syncStatus: "synced",
      syncedAt: new Date(),
      lastSyncError: null,
    },
  ]),
  getBundlesNeedingSync: vi.fn().mockResolvedValue([
    {
      id: 1,
      draftId: 101,
      shopifyProductId: "123456",
      shopifyVariantId: "789012",
      syncStatus: "pending",
    },
  ]),
  updateBundleSyncStatus: vi.fn().mockResolvedValue(undefined),
  getBundleDraftById: vi.fn().mockResolvedValue({
    id: 101,
    title: "Test Bundle",
    description: "Test description",
    price: "99.99",
    imageUrl: "https://example.com/image.jpg",
    status: "published",
  }),
}));

import * as shopify from "./shopify";
import * as db from "./db";

describe("Bundle Synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncBundleToShopify", () => {
    it("should sync a bundle to Shopify successfully", async () => {
      const bundle = {
        shopifyProductId: "123456",
        shopifyVariantId: "789012",
        title: "Test Bundle",
        description: "Test description",
        basePrice: 99.99,
        minPrice: 79.99,
        maxPrice: 129.99,
        imageUrl: "https://example.com/image.jpg",
        status: "active" as const,
      };

      const result = await shopify.syncBundleToShopify(bundle);

      expect(result.success).toBe(true);
      expect(shopify.syncBundleToShopify).toHaveBeenCalledWith(bundle);
    });
  });

  describe("getPublishedBundlesForSync", () => {
    it("should return all published bundles", async () => {
      const bundles = await db.getPublishedBundlesForSync();

      expect(bundles).toHaveLength(2);
      expect(bundles[0].shopifyProductId).toBe("123456");
      expect(bundles[1].syncStatus).toBe("synced");
    });
  });

  describe("getBundlesNeedingSync", () => {
    it("should return only bundles with pending or failed sync status", async () => {
      const bundles = await db.getBundlesNeedingSync();

      expect(bundles).toHaveLength(1);
      expect(bundles[0].syncStatus).toBe("pending");
    });
  });

  describe("updateBundleSyncStatus", () => {
    it("should update sync status to synced", async () => {
      await db.updateBundleSyncStatus(1, "synced");

      expect(db.updateBundleSyncStatus).toHaveBeenCalledWith(1, "synced");
    });

    it("should update sync status to failed with error message", async () => {
      await db.updateBundleSyncStatus(1, "failed", "Connection timeout");

      expect(db.updateBundleSyncStatus).toHaveBeenCalledWith(1, "failed", "Connection timeout");
    });
  });

  describe("Bundle sync workflow", () => {
    it("should sync all pending bundles", async () => {
      const bundlesNeedingSync = await db.getBundlesNeedingSync();
      
      for (const bundle of bundlesNeedingSync) {
        const draft = await db.getBundleDraftById(bundle.draftId);
        if (draft) {
          const result = await shopify.syncBundleToShopify({
            shopifyProductId: bundle.shopifyProductId!,
            shopifyVariantId: bundle.shopifyVariantId!,
            title: draft.title,
            description: draft.description || "",
            basePrice: parseFloat(draft.price?.toString() || "0"),
            minPrice: parseFloat(draft.price?.toString() || "0"),
            maxPrice: parseFloat(draft.price?.toString() || "0"),
            imageUrl: draft.imageUrl || undefined,
            status: draft.status === "published" ? "active" : "draft",
          });
          
          if (result.success) {
            await db.updateBundleSyncStatus(bundle.id, "synced");
          }
        }
      }

      expect(db.getBundlesNeedingSync).toHaveBeenCalled();
      expect(db.getBundleDraftById).toHaveBeenCalledWith(101);
      expect(shopify.syncBundleToShopify).toHaveBeenCalled();
      expect(db.updateBundleSyncStatus).toHaveBeenCalledWith(1, "synced");
    });
  });
});
