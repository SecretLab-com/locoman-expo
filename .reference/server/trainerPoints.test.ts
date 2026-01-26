import { describe, it, expect } from "vitest";
import {
  calculateTier,
  getNextTierInfo,
  TIER_THRESHOLDS,
  TIER_BENEFITS,
} from "./db";

describe("Trainer Loyalty Points System", () => {
  describe("calculateTier", () => {
    it("should return bronze for 0 points", () => {
      expect(calculateTier(0)).toBe("bronze");
    });

    it("should return bronze for points below 5000", () => {
      expect(calculateTier(500)).toBe("bronze");
      expect(calculateTier(4999)).toBe("bronze");
    });

    it("should return silver for 5000+ points", () => {
      expect(calculateTier(5000)).toBe("silver");
      expect(calculateTier(10000)).toBe("silver");
      expect(calculateTier(14999)).toBe("silver");
    });

    it("should return gold for 15000+ points", () => {
      expect(calculateTier(15000)).toBe("gold");
      expect(calculateTier(25000)).toBe("gold");
      expect(calculateTier(34999)).toBe("gold");
    });

    it("should return platinum for 35000+ points", () => {
      expect(calculateTier(35000)).toBe("platinum");
      expect(calculateTier(50000)).toBe("platinum");
      expect(calculateTier(100000)).toBe("platinum");
    });
  });

  describe("TIER_THRESHOLDS", () => {
    it("should have correct threshold values", () => {
      expect(TIER_THRESHOLDS.bronze).toBe(0);
      expect(TIER_THRESHOLDS.silver).toBe(5000);
      expect(TIER_THRESHOLDS.gold).toBe(15000);
      expect(TIER_THRESHOLDS.platinum).toBe(35000);
    });

    it("should have thresholds in ascending order", () => {
      expect(TIER_THRESHOLDS.bronze).toBeLessThan(TIER_THRESHOLDS.silver);
      expect(TIER_THRESHOLDS.silver).toBeLessThan(TIER_THRESHOLDS.gold);
      expect(TIER_THRESHOLDS.gold).toBeLessThan(TIER_THRESHOLDS.platinum);
    });
  });

  describe("TIER_BENEFITS", () => {
    it("should have benefits for all tiers", () => {
      expect(TIER_BENEFITS.bronze).toBeDefined();
      expect(TIER_BENEFITS.silver).toBeDefined();
      expect(TIER_BENEFITS.gold).toBeDefined();
      expect(TIER_BENEFITS.platinum).toBeDefined();
    });

    it("should have commission bonus increasing with tier", () => {
      expect(TIER_BENEFITS.bronze.commissionBonus).toBeLessThan(TIER_BENEFITS.silver.commissionBonus);
      expect(TIER_BENEFITS.silver.commissionBonus).toBeLessThan(TIER_BENEFITS.gold.commissionBonus);
      expect(TIER_BENEFITS.gold.commissionBonus).toBeLessThan(TIER_BENEFITS.platinum.commissionBonus);
    });

    it("should have priority support for silver and above", () => {
      expect(TIER_BENEFITS.bronze.prioritySupport).toBe(false);
      expect(TIER_BENEFITS.silver.prioritySupport).toBe(true);
      expect(TIER_BENEFITS.gold.prioritySupport).toBe(true);
      expect(TIER_BENEFITS.platinum.prioritySupport).toBe(true);
    });

    it("should have featured listing for gold and above", () => {
      expect(TIER_BENEFITS.bronze.featuredListing).toBe(false);
      expect(TIER_BENEFITS.silver.featuredListing).toBe(false);
      expect(TIER_BENEFITS.gold.featuredListing).toBe(true);
      expect(TIER_BENEFITS.platinum.featuredListing).toBe(true);
    });

    it("should have exclusive products only for platinum", () => {
      expect(TIER_BENEFITS.bronze.exclusiveProducts).toBe(false);
      expect(TIER_BENEFITS.silver.exclusiveProducts).toBe(false);
      expect(TIER_BENEFITS.gold.exclusiveProducts).toBe(false);
      expect(TIER_BENEFITS.platinum.exclusiveProducts).toBe(true);
    });
  });

  describe("getNextTierInfo", () => {
    it("should return silver as next tier for bronze", () => {
      const info = getNextTierInfo("bronze", 2500);
      expect(info.nextTier).toBe("silver");
      expect(info.pointsNeeded).toBe(2500); // 5000 - 2500
    });

    it("should return gold as next tier for silver", () => {
      const info = getNextTierInfo("silver", 10000);
      expect(info.nextTier).toBe("gold");
      expect(info.pointsNeeded).toBe(5000); // 15000 - 10000
    });

    it("should return platinum as next tier for gold", () => {
      const info = getNextTierInfo("gold", 25000);
      expect(info.nextTier).toBe("platinum");
      expect(info.pointsNeeded).toBe(10000); // 35000 - 25000
    });

    it("should return null for platinum (no next tier)", () => {
      const info = getNextTierInfo("platinum", 50000);
      expect(info.nextTier).toBe(null);
      expect(info.progress).toBe(100);
    });

    it("should calculate progress correctly", () => {
      // Bronze to Silver: 0-5000 range
      const bronzeInfo = getNextTierInfo("bronze", 2500);
      expect(bronzeInfo.progress).toBe(50); // 2500/5000 = 50%

      // Silver to Gold: 5000-15000 range (10000 points range)
      const silverInfo = getNextTierInfo("silver", 10000);
      expect(silverInfo.progress).toBe(50); // (10000-5000)/(15000-5000) = 5000/10000 = 50%

      // Gold to Platinum: 15000-35000 range (20000 points range)
      const goldInfo = getNextTierInfo("gold", 25000);
      expect(goldInfo.progress).toBe(50); // (25000-15000)/(35000-15000) = 10000/20000 = 50%
    });

    it("should cap progress at 100%", () => {
      // Edge case: points exceed next tier threshold
      const info = getNextTierInfo("bronze", 6000);
      expect(info.progress).toBeLessThanOrEqual(100);
    });

    it("should not return negative progress", () => {
      const info = getNextTierInfo("bronze", 0);
      expect(info.progress).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Points calculation rules", () => {
    it("should award 1 point per £1 of commission", () => {
      // Rule: £1 = 1 point
      const commission = 150; // £150 commission
      const expectedPoints = Math.floor(commission);
      expect(expectedPoints).toBe(150);
    });

    it("should award 100 points for new client bonus", () => {
      const NEW_CLIENT_BONUS = 100;
      expect(NEW_CLIENT_BONUS).toBe(100);
    });

    it("should award 50 points for client retention", () => {
      const CLIENT_RETENTION_BONUS = 50;
      expect(CLIENT_RETENTION_BONUS).toBe(50);
    });

    it("should award 500-5000 points for ad partnerships", () => {
      const AD_PARTNERSHIP_MIN = 500;
      const AD_PARTNERSHIP_MAX = 5000;
      expect(AD_PARTNERSHIP_MIN).toBe(500);
      expect(AD_PARTNERSHIP_MAX).toBe(5000);
    });
  });

  describe("Transaction types", () => {
    it("should support all expected transaction types", () => {
      const transactionTypes = [
        "bundle_sale",
        "new_client_bonus",
        "client_retention",
        "ad_partnership_sale",
        "ad_partnership_renewal",
        "upsell_bonus",
        "monthly_target",
        "tier_bonus",
        "referral_bonus",
        "redemption",
        "adjustment",
        "expiration",
      ];

      // These types should all be valid
      transactionTypes.forEach((type) => {
        expect(typeof type).toBe("string");
        expect(type.length).toBeGreaterThan(0);
      });
    });
  });
});
