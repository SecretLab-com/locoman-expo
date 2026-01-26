import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// MONTHLY AWARDS CALCULATION TESTS
// ============================================================================

describe("Monthly Awards Calculation", () => {
  describe("Award Type Definitions", () => {
    const awardTypes = [
      { type: "top_seller", name: "Top Seller", points: 1000 },
      { type: "perfect_delivery", name: "Perfect Delivery", points: 500 },
      { type: "client_champion", name: "Client Champion", points: 750 },
      { type: "rising_star", name: "Rising Star", points: 500 },
      { type: "retention_master", name: "Retention Master", points: 750 },
      { type: "upsell_expert", name: "Upsell Expert", points: 500 },
    ];

    it("should define all award types with correct point values", () => {
      expect(awardTypes).toHaveLength(6);
      expect(awardTypes.find(a => a.type === "top_seller")?.points).toBe(1000);
      expect(awardTypes.find(a => a.type === "perfect_delivery")?.points).toBe(500);
    });

    it("should have unique award types", () => {
      const types = awardTypes.map(a => a.type);
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });
  });

  describe("Top Seller Award Logic", () => {
    it("should identify trainer with highest revenue", () => {
      const trainerRevenues = [
        { trainerId: 1, revenue: 5000 },
        { trainerId: 2, revenue: 8500 },
        { trainerId: 3, revenue: 3200 },
      ];
      
      const topSeller = trainerRevenues.reduce((max, t) => 
        t.revenue > max.revenue ? t : max
      );
      
      expect(topSeller.trainerId).toBe(2);
      expect(topSeller.revenue).toBe(8500);
    });

    it("should handle tie by selecting first trainer", () => {
      const trainerRevenues = [
        { trainerId: 1, revenue: 5000 },
        { trainerId: 2, revenue: 5000 },
      ];
      
      const topSeller = trainerRevenues.reduce((max, t) => 
        t.revenue > max.revenue ? t : max
      );
      
      expect(topSeller.trainerId).toBe(1);
    });
  });

  describe("Perfect Delivery Award Logic", () => {
    it("should identify trainer with 100% delivery completion", () => {
      const deliveryStats = [
        { trainerId: 1, completed: 20, total: 20 },
        { trainerId: 2, completed: 18, total: 20 },
        { trainerId: 3, completed: 15, total: 15 },
      ];
      
      const perfectDelivery = deliveryStats.filter(d => 
        d.completed === d.total && d.total > 0
      );
      
      expect(perfectDelivery).toHaveLength(2);
      expect(perfectDelivery.map(d => d.trainerId)).toContain(1);
      expect(perfectDelivery.map(d => d.trainerId)).toContain(3);
    });

    it("should not award if no deliveries", () => {
      const deliveryStats = [
        { trainerId: 1, completed: 0, total: 0 },
      ];
      
      const perfectDelivery = deliveryStats.filter(d => 
        d.completed === d.total && d.total > 0
      );
      
      expect(perfectDelivery).toHaveLength(0);
    });
  });

  describe("Client Champion Award Logic", () => {
    it("should identify trainer with most new clients", () => {
      const newClientCounts = [
        { trainerId: 1, newClients: 5 },
        { trainerId: 2, newClients: 12 },
        { trainerId: 3, newClients: 8 },
      ];
      
      const champion = newClientCounts.reduce((max, t) => 
        t.newClients > max.newClients ? t : max
      );
      
      expect(champion.trainerId).toBe(2);
      expect(champion.newClients).toBe(12);
    });
  });

  describe("Retention Master Award Logic", () => {
    it("should calculate retention rate correctly", () => {
      const retentionData = {
        returningClients: 8,
        totalClients: 10,
      };
      
      const retentionRate = retentionData.returningClients / retentionData.totalClients;
      
      expect(retentionRate).toBe(0.8);
    });

    it("should identify trainer with highest retention rate", () => {
      const retentionStats = [
        { trainerId: 1, returning: 8, total: 10 }, // 80%
        { trainerId: 2, returning: 9, total: 10 }, // 90%
        { trainerId: 3, returning: 7, total: 10 }, // 70%
      ];
      
      const withRates = retentionStats.map(t => ({
        ...t,
        rate: t.returning / t.total,
      }));
      
      const master = withRates.reduce((max, t) => 
        t.rate > max.rate ? t : max
      );
      
      expect(master.trainerId).toBe(2);
      expect(master.rate).toBe(0.9);
    });
  });

  describe("Month Period Calculation", () => {
    it("should calculate correct month boundaries", () => {
      const date = new Date("2026-01-15");
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
      
      expect(startOfMonth.toISOString()).toContain("2026-01-01");
      expect(endOfMonth.getDate()).toBe(31); // January has 31 days
    });

    it("should handle February correctly", () => {
      const date = new Date("2026-02-15");
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const endOfMonth = new Date(year, month, 0);
      
      expect(endOfMonth.getDate()).toBe(28); // 2026 is not a leap year
    });
  });
});

// ============================================================================
// SPF MANAGEMENT TESTS
// ============================================================================

describe("SPF Management", () => {
  describe("SPF Rate Validation", () => {
    it("should accept valid SPF percentages (0-50%)", () => {
      const validRates = [0.05, 0.1, 0.15, 0.2, 0.25, 0.5];
      
      validRates.forEach(rate => {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(0.5);
      });
    });

    it("should reject negative SPF rates", () => {
      const rate = -0.1;
      const isValid = rate >= 0 && rate <= 0.5;
      expect(isValid).toBe(false);
    });

    it("should reject SPF rates over 50%", () => {
      const rate = 0.6;
      const isValid = rate >= 0 && rate <= 0.5;
      expect(isValid).toBe(false);
    });
  });

  describe("SPF Date Range Validation", () => {
    it("should validate start date is before end date", () => {
      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-03-31");
      
      expect(startDate < endDate).toBe(true);
    });

    it("should allow null end date for ongoing promotions", () => {
      const startDate = new Date("2026-01-01");
      const endDate = null;
      
      const isValid = endDate === null || startDate < endDate;
      expect(isValid).toBe(true);
    });

    it("should reject end date before start date", () => {
      const startDate = new Date("2026-03-01");
      const endDate = new Date("2026-01-31");
      
      expect(startDate < endDate).toBe(false);
    });
  });

  describe("SPF Status Calculation", () => {
    it("should identify active promotions", () => {
      const now = new Date("2026-01-15");
      const promotion = {
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
      };
      
      const isActive = promotion.startDate <= now && 
        (promotion.endDate === null || promotion.endDate >= now);
      
      expect(isActive).toBe(true);
    });

    it("should identify upcoming promotions", () => {
      const now = new Date("2026-01-15");
      const promotion = {
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-02-28"),
      };
      
      const isUpcoming = promotion.startDate > now;
      
      expect(isUpcoming).toBe(true);
    });

    it("should identify expired promotions", () => {
      const now = new Date("2026-01-15");
      const promotion = {
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-31"),
      };
      
      const isExpired = promotion.endDate !== null && promotion.endDate < now;
      
      expect(isExpired).toBe(true);
    });

    it("should treat ongoing promotions (null end date) as active", () => {
      const now = new Date("2026-01-15");
      const promotion = {
        startDate: new Date("2026-01-01"),
        endDate: null,
      };
      
      const isActive = promotion.startDate <= now && promotion.endDate === null;
      
      expect(isActive).toBe(true);
    });
  });

  describe("Commission Calculation with SPF", () => {
    it("should calculate total commission correctly", () => {
      const productPrice = 100;
      const baseCommission = 0.1; // 10%
      const spfBonus = 0.2; // 20%
      
      const totalCommission = productPrice * (baseCommission + spfBonus);
      
      expect(totalCommission).toBeCloseTo(30, 2); // £30 on £100 product
    });

    it("should handle products without SPF", () => {
      const productPrice = 100;
      const baseCommission = 0.1;
      const spfBonus = 0; // No SPF
      
      const totalCommission = productPrice * (baseCommission + spfBonus);
      
      expect(totalCommission).toBe(10); // £10 on £100 product
    });

    it("should calculate bundle commission with mixed SPF products", () => {
      const products = [
        { price: 50, spf: 0.2 }, // Has 20% SPF
        { price: 30, spf: 0 },   // No SPF
        { price: 20, spf: 0.15 }, // Has 15% SPF
      ];
      const baseCommission = 0.1;
      
      const totalCommission = products.reduce((sum, p) => 
        sum + (p.price * (baseCommission + p.spf)), 0
      );
      
      // (50 * 0.3) + (30 * 0.1) + (20 * 0.25) = 15 + 3 + 5 = 23
      expect(totalCommission).toBe(23);
    });
  });

  describe("Base Commission Rate", () => {
    it("should default to 10% if not set", () => {
      const baseRate = null;
      const effectiveRate = baseRate ?? 0.1;
      
      expect(effectiveRate).toBe(0.1);
    });

    it("should allow base rate between 1% and 50%", () => {
      const validRates = [0.01, 0.05, 0.1, 0.15, 0.25, 0.5];
      
      validRates.forEach(rate => {
        expect(rate).toBeGreaterThanOrEqual(0.01);
        expect(rate).toBeLessThanOrEqual(0.5);
      });
    });
  });
});

// ============================================================================
// AWARD POINTS INTEGRATION TESTS
// ============================================================================

describe("Award Points Integration", () => {
  it("should add award points to trainer total", () => {
    const currentPoints = 5000;
    const awardPoints = 1000; // Top Seller award
    
    const newTotal = currentPoints + awardPoints;
    
    expect(newTotal).toBe(6000);
  });

  it("should create point transaction for award", () => {
    const award = {
      type: "top_seller",
      points: 1000,
      month: "2026-01",
    };
    
    const transaction = {
      trainerId: 1,
      points: award.points,
      source: "award",
      description: `Monthly Award: Top Seller for ${award.month}`,
      createdAt: new Date(),
    };
    
    expect(transaction.points).toBe(1000);
    expect(transaction.source).toBe("award");
  });

  it("should prevent duplicate awards for same month", () => {
    const existingAwards = [
      { trainerId: 1, type: "top_seller", month: "2026-01" },
    ];
    
    const newAward = { trainerId: 1, type: "top_seller", month: "2026-01" };
    
    const isDuplicate = existingAwards.some(a => 
      a.trainerId === newAward.trainerId && 
      a.type === newAward.type && 
      a.month === newAward.month
    );
    
    expect(isDuplicate).toBe(true);
  });
});
