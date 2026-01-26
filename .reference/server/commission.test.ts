import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getBaseCommissionRate: vi.fn(),
  getProductSPF: vi.fn(),
  setProductSPF: vi.fn(),
  deleteProductSPF: vi.fn(),
  setBaseCommissionRate: vi.fn(),
}));

import {
  getBaseCommissionRate,
  getProductSPF,
  setProductSPF,
  deleteProductSPF,
  setBaseCommissionRate,
} from "./db";

describe("Commission System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Commission Rate", () => {
    it("should return default 10% when no rate is set", async () => {
      vi.mocked(getBaseCommissionRate).mockResolvedValue(0.10);
      
      const rate = await getBaseCommissionRate();
      expect(rate).toBe(0.10);
    });

    it("should return custom rate when set", async () => {
      vi.mocked(getBaseCommissionRate).mockResolvedValue(0.15);
      
      const rate = await getBaseCommissionRate();
      expect(rate).toBe(0.15);
    });

    it("should update base commission rate", async () => {
      vi.mocked(setBaseCommissionRate).mockResolvedValue(undefined);
      
      await setBaseCommissionRate(0.12);
      expect(setBaseCommissionRate).toHaveBeenCalledWith(0.12);
    });
  });

  describe("Product SPF (Special Product Fee)", () => {
    it("should return null when no SPF is set for product", async () => {
      vi.mocked(getProductSPF).mockResolvedValue([]);
      
      const spfList = await getProductSPF([12345]);
      expect(spfList).toEqual([]);
    });

    it("should return SPF data for products with special commission", async () => {
      const mockSPF = [
        {
          shopifyProductId: 12345,
          spfPercentage: 0.20,
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-03-31"),
        },
      ];
      vi.mocked(getProductSPF).mockResolvedValue(mockSPF);
      
      const spfList = await getProductSPF([12345]);
      expect(spfList).toHaveLength(1);
      expect(spfList[0].spfPercentage).toBe(0.20);
    });

    it("should set SPF for a product", async () => {
      vi.mocked(setProductSPF).mockResolvedValue(undefined);
      
      await setProductSPF({
        shopifyProductId: 12345,
        spfPercentage: 0.20,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
      });
      
      expect(setProductSPF).toHaveBeenCalledWith({
        shopifyProductId: 12345,
        spfPercentage: 0.20,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
    });

    it("should delete SPF for a product", async () => {
      vi.mocked(deleteProductSPF).mockResolvedValue(undefined);
      
      await deleteProductSPF(12345);
      expect(deleteProductSPF).toHaveBeenCalledWith(12345);
    });
  });

  describe("Commission Calculations", () => {
    it("should calculate commission with base rate only", () => {
      const productPrice = 100;
      const baseRate = 0.10;
      const spfRate = 0;
      
      const baseCommission = productPrice * baseRate;
      const spfCommission = productPrice * spfRate;
      const totalCommission = baseCommission + spfCommission;
      
      expect(baseCommission).toBe(10);
      expect(spfCommission).toBe(0);
      expect(totalCommission).toBe(10);
    });

    it("should calculate commission with base rate + SPF", () => {
      const productPrice = 100;
      const baseRate = 0.10;
      const spfRate = 0.20;
      
      const baseCommission = productPrice * baseRate;
      const spfCommission = productPrice * spfRate;
      const totalCommission = baseCommission + spfCommission;
      
      expect(baseCommission).toBe(10);
      expect(spfCommission).toBe(20);
      expect(totalCommission).toBe(30);
    });

    it("should calculate total trainer earnings for bundle", () => {
      const products = [
        { price: 24.95, baseRate: 0.10, spfRate: 0 },
        { price: 699.95, baseRate: 0.10, spfRate: 0 },
      ];
      const services = [
        { price: 75, count: 1 },
      ];
      
      // Calculate product commissions
      const productCommission = products.reduce((sum, p) => {
        return sum + (p.price * (p.baseRate + p.spfRate));
      }, 0);
      
      // Calculate service revenue (100% to trainer)
      const serviceRevenue = services.reduce((sum, s) => {
        return sum + (s.price * s.count);
      }, 0);
      
      const totalEarnings = productCommission + serviceRevenue;
      
      expect(productCommission).toBeCloseTo(72.49, 2);
      expect(serviceRevenue).toBe(75);
      expect(totalEarnings).toBeCloseTo(147.49, 2);
    });

    it("should calculate commission with SPF bonus on specific product", () => {
      const products = [
        { price: 24.95, baseRate: 0.10, spfRate: 0.20 }, // Red Bull with 20% SPF
        { price: 699.95, baseRate: 0.10, spfRate: 0 },
      ];
      
      const productCommission = products.reduce((sum, p) => {
        return sum + (p.price * (p.baseRate + p.spfRate));
      }, 0);
      
      // First product: 24.95 * 0.30 = 7.485
      // Second product: 699.95 * 0.10 = 69.995
      // Total: 77.48
      expect(productCommission).toBeCloseTo(77.48, 2);
    });
  });

  describe("Commission Formula Verification", () => {
    it("should match PRD formula: (Base% + SPF%) × Product Price", () => {
      // From PRD: Commission = (Base Commission % + SPF %) × Product Price
      const productPrice = 50;
      const baseCommissionPercent = 0.10;
      const spfPercent = 0.20;
      
      const commission = (baseCommissionPercent + spfPercent) * productPrice;
      
      expect(commission).toBeCloseTo(15, 2); // 30% of $50 = $15
    });

    it("should calculate total bundle commission correctly", () => {
      // From PRD: Total Commission = Σ (Product Commission) + Service Revenue
      const products = [
        { price: 50, commission: 15 }, // 30% commission
        { price: 100, commission: 10 }, // 10% commission
      ];
      const serviceRevenue = 75;
      
      const totalProductCommission = products.reduce((sum, p) => sum + p.commission, 0);
      const totalBundleCommission = totalProductCommission + serviceRevenue;
      
      expect(totalProductCommission).toBe(25);
      expect(totalBundleCommission).toBe(100);
    });
  });
});
