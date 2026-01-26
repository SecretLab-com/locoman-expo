import { describe, it, expect } from "vitest";

// Points tier calculation tests
describe("Points Tier Calculations", () => {
  const TIERS = {
    bronze: { minPoints: 0, maxPoints: 4999 },
    silver: { minPoints: 5000, maxPoints: 14999 },
    gold: { minPoints: 15000, maxPoints: 49999 },
    platinum: { minPoints: 50000, maxPoints: Infinity },
  };

  function getTierFromPoints(points: number): string {
    if (points >= 50000) return "platinum";
    if (points >= 15000) return "gold";
    if (points >= 5000) return "silver";
    return "bronze";
  }

  function getNextTier(currentTier: string): string | null {
    const tiers = ["bronze", "silver", "gold", "platinum"];
    const currentIndex = tiers.indexOf(currentTier);
    if (currentIndex < tiers.length - 1) {
      return tiers[currentIndex + 1];
    }
    return null;
  }

  function calculateProgressToNextTier(points: number): number {
    const currentTier = getTierFromPoints(points);
    const nextTier = getNextTier(currentTier);
    
    if (!nextTier) return 100; // Already at max tier
    
    const currentTierConfig = TIERS[currentTier as keyof typeof TIERS];
    const nextTierConfig = TIERS[nextTier as keyof typeof TIERS];
    
    const pointsInCurrentTier = points - currentTierConfig.minPoints;
    const pointsNeededForNextTier = nextTierConfig.minPoints - currentTierConfig.minPoints;
    
    return Math.min((pointsInCurrentTier / pointsNeededForNextTier) * 100, 100);
  }

  describe("getTierFromPoints", () => {
    it("should return bronze for 0 points", () => {
      expect(getTierFromPoints(0)).toBe("bronze");
    });

    it("should return bronze for 4999 points", () => {
      expect(getTierFromPoints(4999)).toBe("bronze");
    });

    it("should return silver for 5000 points", () => {
      expect(getTierFromPoints(5000)).toBe("silver");
    });

    it("should return silver for 14999 points", () => {
      expect(getTierFromPoints(14999)).toBe("silver");
    });

    it("should return gold for 15000 points", () => {
      expect(getTierFromPoints(15000)).toBe("gold");
    });

    it("should return gold for 49999 points", () => {
      expect(getTierFromPoints(49999)).toBe("gold");
    });

    it("should return platinum for 50000 points", () => {
      expect(getTierFromPoints(50000)).toBe("platinum");
    });

    it("should return platinum for 100000 points", () => {
      expect(getTierFromPoints(100000)).toBe("platinum");
    });
  });

  describe("getNextTier", () => {
    it("should return silver for bronze", () => {
      expect(getNextTier("bronze")).toBe("silver");
    });

    it("should return gold for silver", () => {
      expect(getNextTier("silver")).toBe("gold");
    });

    it("should return platinum for gold", () => {
      expect(getNextTier("gold")).toBe("platinum");
    });

    it("should return null for platinum", () => {
      expect(getNextTier("platinum")).toBeNull();
    });
  });

  describe("calculateProgressToNextTier", () => {
    it("should return 0% at start of bronze tier", () => {
      expect(calculateProgressToNextTier(0)).toBe(0);
    });

    it("should return 50% halfway through bronze tier", () => {
      // Bronze: 0-4999 (5000 points range), halfway = 2500
      expect(calculateProgressToNextTier(2500)).toBe(50);
    });

    it("should return ~100% at end of bronze tier", () => {
      // 4999/5000 = 99.98%
      expect(calculateProgressToNextTier(4999)).toBeCloseTo(99.98, 1);
    });

    it("should return 0% at start of silver tier", () => {
      expect(calculateProgressToNextTier(5000)).toBe(0);
    });

    it("should return 50% halfway through silver tier", () => {
      // Silver: 5000-14999 (10000 points range), halfway = 10000
      expect(calculateProgressToNextTier(10000)).toBe(50);
    });

    it("should return 100% for platinum tier (max tier)", () => {
      expect(calculateProgressToNextTier(50000)).toBe(100);
      expect(calculateProgressToNextTier(100000)).toBe(100);
    });
  });
});

// Points earning tests
describe("Points Earning Calculations", () => {
  function calculateBundleSalePoints(saleAmount: number): number {
    // £1 = 1 point
    return Math.floor(saleAmount);
  }

  function calculateAdPartnershipPoints(packageTier: string): number {
    const bonusPoints: Record<string, number> = {
      bronze: 500,
      silver: 1000,
      gold: 2500,
      platinum: 5000,
    };
    return bonusPoints[packageTier] || 0;
  }

  function calculateNewClientBonus(): number {
    return 100;
  }

  function calculateClientRetentionBonus(): number {
    return 50;
  }

  describe("calculateBundleSalePoints", () => {
    it("should return 100 points for £100 sale", () => {
      expect(calculateBundleSalePoints(100)).toBe(100);
    });

    it("should return 50 points for £50.99 sale (floor)", () => {
      expect(calculateBundleSalePoints(50.99)).toBe(50);
    });

    it("should return 0 points for £0 sale", () => {
      expect(calculateBundleSalePoints(0)).toBe(0);
    });

    it("should return 1000 points for £1000 sale", () => {
      expect(calculateBundleSalePoints(1000)).toBe(1000);
    });
  });

  describe("calculateAdPartnershipPoints", () => {
    it("should return 500 points for bronze partnership", () => {
      expect(calculateAdPartnershipPoints("bronze")).toBe(500);
    });

    it("should return 1000 points for silver partnership", () => {
      expect(calculateAdPartnershipPoints("silver")).toBe(1000);
    });

    it("should return 2500 points for gold partnership", () => {
      expect(calculateAdPartnershipPoints("gold")).toBe(2500);
    });

    it("should return 5000 points for platinum partnership", () => {
      expect(calculateAdPartnershipPoints("platinum")).toBe(5000);
    });

    it("should return 0 points for unknown tier", () => {
      expect(calculateAdPartnershipPoints("unknown")).toBe(0);
    });
  });

  describe("bonus points", () => {
    it("should return 100 points for new client bonus", () => {
      expect(calculateNewClientBonus()).toBe(100);
    });

    it("should return 50 points for client retention bonus", () => {
      expect(calculateClientRetentionBonus()).toBe(50);
    });
  });
});

// Commission rate by tier tests
describe("Commission Rate by Tier", () => {
  function getCommissionRate(tier: string): number {
    const rates: Record<string, number> = {
      bronze: 0.10,
      silver: 0.12,
      gold: 0.15,
      platinum: 0.18,
    };
    return rates[tier] || 0.10;
  }

  it("should return 10% for bronze tier", () => {
    expect(getCommissionRate("bronze")).toBe(0.10);
  });

  it("should return 12% for silver tier", () => {
    expect(getCommissionRate("silver")).toBe(0.12);
  });

  it("should return 15% for gold tier", () => {
    expect(getCommissionRate("gold")).toBe(0.15);
  });

  it("should return 18% for platinum tier", () => {
    expect(getCommissionRate("platinum")).toBe(0.18);
  });

  it("should default to 10% for unknown tier", () => {
    expect(getCommissionRate("unknown")).toBe(0.10);
  });
});

// Total earnings calculation tests
describe("Total Earnings Calculations", () => {
  function calculateTotalEarnings(
    tier: string,
    saleAmount: number,
    spfPercentage: number = 0
  ): number {
    const baseRates: Record<string, number> = {
      bronze: 0.10,
      silver: 0.12,
      gold: 0.15,
      platinum: 0.18,
    };
    
    const baseRate = baseRates[tier] || 0.10;
    const totalRate = baseRate + (spfPercentage / 100);
    
    return saleAmount * totalRate;
  }

  it("should calculate bronze tier earnings correctly", () => {
    expect(calculateTotalEarnings("bronze", 100)).toBe(10);
  });

  it("should calculate platinum tier earnings correctly", () => {
    expect(calculateTotalEarnings("platinum", 100)).toBe(18);
  });

  it("should include SPF bonus in earnings", () => {
    // Bronze (10%) + 5% SPF = 15%
    expect(calculateTotalEarnings("bronze", 100, 5)).toBeCloseTo(15, 2);
  });

  it("should calculate complex earnings scenario", () => {
    // Gold (15%) + 20% SPF = 35%
    expect(calculateTotalEarnings("gold", 200, 20)).toBe(70);
  });
});
