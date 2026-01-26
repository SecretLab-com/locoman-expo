import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkLowInventory, getNotificationCooldownRemaining, resetNotificationCooldown } from "./lowInventoryCheck";

// Mock the db module
vi.mock("../db", () => ({
  getBundlesWithLowInventory: vi.fn(),
}));

// Mock the notification module
vi.mock("../_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

import { getBundlesWithLowInventory } from "../db";
import { notifyOwner } from "../_core/notification";

describe("lowInventoryCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNotificationCooldown();
  });

  describe("checkLowInventory", () => {
    it("should return success when no bundles have low inventory", async () => {
      vi.mocked(getBundlesWithLowInventory).mockResolvedValue([]);

      const result = await checkLowInventory(5, false);

      expect(result.checked).toBe(true);
      expect(result.bundlesWithLowInventory).toBe(0);
      expect(result.notificationSent).toBe(false);
      expect(result.message).toBe("All bundles have sufficient inventory");
    });

    it("should detect bundles with low inventory", async () => {
      vi.mocked(getBundlesWithLowInventory).mockResolvedValue([
        {
          bundleId: 1,
          bundleTitle: "Test Bundle",
          trainerId: 1,
          lowInventoryProducts: [
            { productId: 101, productName: "Product A", inventory: 2 },
            { productId: 102, productName: "Product B", inventory: 0 },
          ],
        },
      ]);

      const result = await checkLowInventory(5, false);

      expect(result.checked).toBe(true);
      expect(result.bundlesWithLowInventory).toBe(1);
      expect(result.details).toHaveLength(1);
      expect(result.details?.[0].bundleTitle).toBe("Test Bundle");
      expect(result.details?.[0].lowProducts).toHaveLength(2);
    });

    it("should send notification when sendNotification is true", async () => {
      vi.mocked(getBundlesWithLowInventory).mockResolvedValue([
        {
          bundleId: 1,
          bundleTitle: "Test Bundle",
          trainerId: 1,
          lowInventoryProducts: [
            { productId: 101, productName: "Product A", inventory: 2 },
          ],
        },
      ]);
      vi.mocked(notifyOwner).mockResolvedValue(true);

      const result = await checkLowInventory(5, true, true);

      expect(result.notificationSent).toBe(true);
      expect(notifyOwner).toHaveBeenCalledTimes(1);
      expect(notifyOwner).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Low Inventory Alert"),
          content: expect.stringContaining("Test Bundle"),
        })
      );
    });

    it("should not send notification when sendNotification is false", async () => {
      vi.mocked(getBundlesWithLowInventory).mockResolvedValue([
        {
          bundleId: 1,
          bundleTitle: "Test Bundle",
          trainerId: 1,
          lowInventoryProducts: [
            { productId: 101, productName: "Product A", inventory: 2 },
          ],
        },
      ]);

      const result = await checkLowInventory(5, false);

      expect(result.notificationSent).toBe(false);
      expect(notifyOwner).not.toHaveBeenCalled();
    });

    it("should respect notification cooldown", async () => {
      vi.mocked(getBundlesWithLowInventory).mockResolvedValue([
        {
          bundleId: 1,
          bundleTitle: "Test Bundle",
          trainerId: 1,
          lowInventoryProducts: [
            { productId: 101, productName: "Product A", inventory: 2 },
          ],
        },
      ]);
      vi.mocked(notifyOwner).mockResolvedValue(true);

      // First call should send notification
      const result1 = await checkLowInventory(5, true, true);
      expect(result1.notificationSent).toBe(true);

      // Second call without forceSend should not send (cooldown)
      const result2 = await checkLowInventory(5, true, false);
      expect(result2.notificationSent).toBe(false);
      expect(notifyOwner).toHaveBeenCalledTimes(1);
    });

    it("should bypass cooldown when forceSend is true", async () => {
      vi.mocked(getBundlesWithLowInventory).mockResolvedValue([
        {
          bundleId: 1,
          bundleTitle: "Test Bundle",
          trainerId: 1,
          lowInventoryProducts: [
            { productId: 101, productName: "Product A", inventory: 2 },
          ],
        },
      ]);
      vi.mocked(notifyOwner).mockResolvedValue(true);

      // First call
      await checkLowInventory(5, true, true);
      
      // Second call with forceSend should still send
      const result = await checkLowInventory(5, true, true);
      expect(result.notificationSent).toBe(true);
      expect(notifyOwner).toHaveBeenCalledTimes(2);
    });
  });

  describe("getNotificationCooldownRemaining", () => {
    it("should return 0 when no notification has been sent", () => {
      expect(getNotificationCooldownRemaining()).toBe(0);
    });
  });
});
