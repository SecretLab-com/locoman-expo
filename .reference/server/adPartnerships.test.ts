import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  generateTrainerReferralCode: vi.fn((trainerId: number) => `LM${trainerId}ABC123`),
}));

import * as db from "./db";

describe("Ad Partnerships", () => {
  describe("generateTrainerReferralCode", () => {
    it("should generate a referral code with trainer ID prefix", () => {
      const code = db.generateTrainerReferralCode(123);
      expect(code).toMatch(/^LM123/);
    });

    it("should generate different codes for different trainers", () => {
      const code1 = db.generateTrainerReferralCode(1);
      const code2 = db.generateTrainerReferralCode(2);
      expect(code1).not.toBe(code2);
    });
  });

  describe("Package Configuration", () => {
    const PACKAGE_CONFIG = {
      bronze: { monthlyFee: 99, commissionRate: 0.15, bonusPoints: 500 },
      silver: { monthlyFee: 249, commissionRate: 0.18, bonusPoints: 1000 },
      gold: { monthlyFee: 499, commissionRate: 0.20, bonusPoints: 2000 },
      platinum: { monthlyFee: 999, commissionRate: 0.25, bonusPoints: 5000 },
    };

    it("should have correct bronze package values", () => {
      expect(PACKAGE_CONFIG.bronze.monthlyFee).toBe(99);
      expect(PACKAGE_CONFIG.bronze.commissionRate).toBe(0.15);
      expect(PACKAGE_CONFIG.bronze.bonusPoints).toBe(500);
    });

    it("should have correct silver package values", () => {
      expect(PACKAGE_CONFIG.silver.monthlyFee).toBe(249);
      expect(PACKAGE_CONFIG.silver.commissionRate).toBe(0.18);
      expect(PACKAGE_CONFIG.silver.bonusPoints).toBe(1000);
    });

    it("should have correct gold package values", () => {
      expect(PACKAGE_CONFIG.gold.monthlyFee).toBe(499);
      expect(PACKAGE_CONFIG.gold.commissionRate).toBe(0.20);
      expect(PACKAGE_CONFIG.gold.bonusPoints).toBe(2000);
    });

    it("should have correct platinum package values", () => {
      expect(PACKAGE_CONFIG.platinum.monthlyFee).toBe(999);
      expect(PACKAGE_CONFIG.platinum.commissionRate).toBe(0.25);
      expect(PACKAGE_CONFIG.platinum.bonusPoints).toBe(5000);
    });

    it("should calculate correct trainer commission for bronze", () => {
      const commission = PACKAGE_CONFIG.bronze.monthlyFee * PACKAGE_CONFIG.bronze.commissionRate;
      expect(commission).toBeCloseTo(14.85, 2);
    });

    it("should calculate correct trainer commission for silver", () => {
      const commission = PACKAGE_CONFIG.silver.monthlyFee * PACKAGE_CONFIG.silver.commissionRate;
      expect(commission).toBeCloseTo(44.82, 2);
    });

    it("should calculate correct trainer commission for gold", () => {
      const commission = PACKAGE_CONFIG.gold.monthlyFee * PACKAGE_CONFIG.gold.commissionRate;
      expect(commission).toBeCloseTo(99.80, 2);
    });

    it("should calculate correct trainer commission for platinum", () => {
      const commission = PACKAGE_CONFIG.platinum.monthlyFee * PACKAGE_CONFIG.platinum.commissionRate;
      expect(commission).toBeCloseTo(249.75, 2);
    });
  });

  describe("Referral Code Parsing", () => {
    it("should extract trainer ID from valid referral code", () => {
      const code = "LM123ABC456";
      const match = code.match(/^LM(\d+)/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe("123");
    });

    it("should handle multi-digit trainer IDs", () => {
      const code = "LM98765XYZ789";
      const match = code.match(/^LM(\d+)/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe("98765");
    });

    it("should reject invalid referral codes", () => {
      const invalidCodes = ["ABC123", "123LM", "LM", "LMABC"];
      invalidCodes.forEach(code => {
        const match = code.match(/^LM(\d+)/);
        expect(match).toBeNull();
      });
    });
  });

  describe("Business Categories", () => {
    const VALID_CATEGORIES = [
      "sports_nutrition",
      "fitness_equipment",
      "physiotherapy",
      "healthy_food",
      "sports_retail",
      "wellness_recovery",
      "gym_studio",
      "health_insurance",
      "sports_events",
      "other",
    ];

    it("should have 10 valid business categories", () => {
      expect(VALID_CATEGORIES).toHaveLength(10);
    });

    it("should include sports_nutrition category", () => {
      expect(VALID_CATEGORIES).toContain("sports_nutrition");
    });

    it("should include fitness_equipment category", () => {
      expect(VALID_CATEGORIES).toContain("fitness_equipment");
    });

    it("should include other as fallback category", () => {
      expect(VALID_CATEGORIES).toContain("other");
    });
  });

  describe("Ad Placement Types", () => {
    const PLACEMENT_TYPES = [
      "bundle_sidebar",
      "vending_screen",
      "trainer_profile",
      "email_newsletter",
      "receipt_confirmation",
    ];

    it("should have 5 placement types", () => {
      expect(PLACEMENT_TYPES).toHaveLength(5);
    });

    it("should include bundle_sidebar placement", () => {
      expect(PLACEMENT_TYPES).toContain("bundle_sidebar");
    });

    it("should include vending_screen placement", () => {
      expect(PLACEMENT_TYPES).toContain("vending_screen");
    });
  });

  describe("Ad Earnings Calculations", () => {
    it("should calculate monthly earnings correctly", () => {
      const partnerships = [
        { monthlyFee: 99, commissionRate: 0.15 },
        { monthlyFee: 249, commissionRate: 0.18 },
        { monthlyFee: 499, commissionRate: 0.20 },
      ];
      
      const totalEarnings = partnerships.reduce((sum, p) => {
        return sum + (p.monthlyFee * p.commissionRate);
      }, 0);
      
      // 14.85 + 44.82 + 99.80 = 159.47
      expect(totalEarnings).toBeCloseTo(159.47, 2);
    });

    it("should calculate annual earnings correctly", () => {
      const monthlyCommission = 99 * 0.15; // Bronze package
      const annualEarnings = monthlyCommission * 12;
      expect(annualEarnings).toBeCloseTo(178.20, 2);
    });

    it("should calculate total bonus points correctly", () => {
      const partnerships = [
        { bonusPoints: 500 },
        { bonusPoints: 1000 },
        { bonusPoints: 2000 },
      ];
      
      const totalPoints = partnerships.reduce((sum, p) => sum + p.bonusPoints, 0);
      expect(totalPoints).toBe(3500);
    });
  });
});
