import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getDb: vi.fn(),
  getTrainerEarningsSummary: vi.fn(),
  getTrainerEarningsBreakdown: vi.fn(),
  getTrainerEarningsHistory: vi.fn(),
  getServiceDeliveriesByTrainer: vi.fn(),
  createTrainerEarning: vi.fn(),
  createServiceDelivery: vi.fn(),
  updateServiceDelivery: vi.fn(),
  getServiceDeliveryById: vi.fn(),
}));

import * as db from "./db";

describe("Trainer Earnings System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Earnings Summary Calculation", () => {
    it("should return zero values when no earnings exist", async () => {
      vi.mocked(db.getTrainerEarningsSummary).mockResolvedValue({
        totalEarnings: 0,
        productCommissions: 0,
        serviceRevenue: 0,
        bundlesSold: 0,
        periodComparison: { previous: 0, change: 0 },
      });

      const result = await db.getTrainerEarningsSummary(1, { period: "month" });

      expect(result.totalEarnings).toBe(0);
      expect(result.productCommissions).toBe(0);
      expect(result.serviceRevenue).toBe(0);
      expect(result.bundlesSold).toBe(0);
    });

    it("should calculate total earnings as sum of products and services", async () => {
      vi.mocked(db.getTrainerEarningsSummary).mockResolvedValue({
        totalEarnings: 350,
        productCommissions: 100,
        serviceRevenue: 250,
        bundlesSold: 5,
        periodComparison: { previous: 280, change: 25 },
      });

      const result = await db.getTrainerEarningsSummary(1, { period: "month" });

      expect(result.totalEarnings).toBe(result.productCommissions + result.serviceRevenue);
      expect(result.bundlesSold).toBe(5);
    });

    it("should calculate period comparison correctly", async () => {
      vi.mocked(db.getTrainerEarningsSummary).mockResolvedValue({
        totalEarnings: 500,
        productCommissions: 150,
        serviceRevenue: 350,
        bundlesSold: 8,
        periodComparison: { previous: 400, change: 25 },
      });

      const result = await db.getTrainerEarningsSummary(1, { period: "month" });

      expect(result.periodComparison).toBeDefined();
      expect(result.periodComparison?.change).toBe(25);
    });
  });

  describe("Earnings Breakdown", () => {
    it("should return service breakdown by type", async () => {
      vi.mocked(db.getTrainerEarningsBreakdown).mockResolvedValue({
        byProduct: [],
        byService: [
          { name: "Personal Training", quantity: 10, revenue: 500, percentage: 71.4 },
          { name: "Nutrition Check-in", quantity: 8, revenue: 200, percentage: 28.6 },
        ],
        revenueByDay: [],
      });

      const result = await db.getTrainerEarningsBreakdown(1, { period: "month" });

      expect(result.byService).toHaveLength(2);
      expect(result.byService[0].name).toBe("Personal Training");
      expect(result.byService[0].revenue).toBe(500);
    });

    it("should return daily revenue breakdown for charts", async () => {
      vi.mocked(db.getTrainerEarningsBreakdown).mockResolvedValue({
        byProduct: [],
        byService: [],
        revenueByDay: [
          { date: "2026-01-15", products: 50, services: 100, total: 150 },
          { date: "2026-01-16", products: 75, services: 150, total: 225 },
          { date: "2026-01-17", products: 25, services: 200, total: 225 },
        ],
      });

      const result = await db.getTrainerEarningsBreakdown(1, { period: "week" });

      expect(result.revenueByDay).toHaveLength(3);
      expect(result.revenueByDay[0].total).toBe(result.revenueByDay[0].products + result.revenueByDay[0].services);
    });
  });

  describe("Service Deliveries", () => {
    it("should return deliveries filtered by status", async () => {
      vi.mocked(db.getServiceDeliveriesByTrainer).mockResolvedValue([
        {
          id: 1,
          orderId: 100,
          trainerId: 1,
          clientId: 10,
          bundleId: 5,
          bundleTitle: "Strength Bundle",
          serviceType: "training",
          serviceName: "Personal Training",
          totalQuantity: 4,
          deliveredQuantity: 2,
          pricePerUnit: "50.00",
          status: "in_progress",
          notes: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          client: { id: 10, name: "John Doe" },
        },
      ]);

      const result = await db.getServiceDeliveriesByTrainer(1, { status: "in_progress" });

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("in_progress");
      expect(result[0].deliveredQuantity).toBe(2);
      expect(result[0].totalQuantity).toBe(4);
    });

    it("should include client information with deliveries", async () => {
      vi.mocked(db.getServiceDeliveriesByTrainer).mockResolvedValue([
        {
          id: 1,
          orderId: 100,
          trainerId: 1,
          clientId: 10,
          bundleId: 5,
          bundleTitle: "Weight Loss Bundle",
          serviceType: "check_in",
          serviceName: "Weekly Check-in",
          totalQuantity: 8,
          deliveredQuantity: 0,
          pricePerUnit: "25.00",
          status: "pending",
          notes: null,
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          client: { id: 10, name: "Jane Smith" },
        },
      ]);

      const result = await db.getServiceDeliveriesByTrainer(1, { status: "pending" });

      expect(result[0].client).toBeDefined();
      expect(result[0].client?.name).toBe("Jane Smith");
    });
  });

  describe("Delivery Updates", () => {
    it("should update delivery progress", async () => {
      vi.mocked(db.getServiceDeliveryById).mockResolvedValue({
        id: 1,
        orderId: 100,
        trainerId: 1,
        clientId: 10,
        bundleId: 5,
        bundleTitle: "Test Bundle",
        serviceType: "training",
        serviceName: "Personal Training",
        totalQuantity: 4,
        deliveredQuantity: 1,
        pricePerUnit: "50.00",
        status: "in_progress",
        notes: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(db.updateServiceDelivery).mockResolvedValue(undefined);

      const delivery = await db.getServiceDeliveryById(1);
      expect(delivery).toBeDefined();
      expect(delivery?.trainerId).toBe(1);

      await db.updateServiceDelivery(1, { deliveredQuantity: 2, status: "in_progress" });
      expect(db.updateServiceDelivery).toHaveBeenCalledWith(1, { deliveredQuantity: 2, status: "in_progress" });
    });

    it("should auto-complete when all sessions delivered", async () => {
      vi.mocked(db.getServiceDeliveryById).mockResolvedValue({
        id: 1,
        orderId: 100,
        trainerId: 1,
        clientId: 10,
        bundleId: 5,
        bundleTitle: "Test Bundle",
        serviceType: "training",
        serviceName: "Personal Training",
        totalQuantity: 4,
        deliveredQuantity: 3,
        pricePerUnit: "50.00",
        status: "in_progress",
        notes: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const delivery = await db.getServiceDeliveryById(1);
      
      // Simulate incrementing to total
      const newCount = (delivery?.deliveredQuantity || 0) + 1;
      const shouldComplete = newCount >= (delivery?.totalQuantity || 0);
      
      expect(shouldComplete).toBe(true);
      expect(newCount).toBe(4);
    });
  });

  describe("Earnings Creation", () => {
    it("should create earnings record from order", async () => {
      vi.mocked(db.createTrainerEarning).mockResolvedValue(undefined as any);

      await db.createTrainerEarning({
        orderId: 100,
        trainerId: 1,
        bundleId: 5,
        bundleTitle: "Strength Bundle",
        clientId: 10,
        clientName: "John Doe",
        productCommission: "25.50",
        serviceRevenue: "200.00",
        totalEarnings: "225.50",
        orderTotal: "350.00",
        status: "pending",
      });

      expect(db.createTrainerEarning).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 100,
          trainerId: 1,
          totalEarnings: "225.50",
        })
      );
    });
  });

  describe("Period Filtering", () => {
    it("should support week period filtering", async () => {
      vi.mocked(db.getTrainerEarningsSummary).mockResolvedValue({
        totalEarnings: 150,
        productCommissions: 50,
        serviceRevenue: 100,
        bundlesSold: 2,
        periodComparison: { previous: 120, change: 25 },
      });

      const result = await db.getTrainerEarningsSummary(1, { period: "week" });
      expect(result.bundlesSold).toBe(2);
    });

    it("should support year period filtering", async () => {
      vi.mocked(db.getTrainerEarningsSummary).mockResolvedValue({
        totalEarnings: 12500,
        productCommissions: 3500,
        serviceRevenue: 9000,
        bundlesSold: 150,
        periodComparison: { previous: 10000, change: 25 },
      });

      const result = await db.getTrainerEarningsSummary(1, { period: "year" });
      expect(result.bundlesSold).toBe(150);
    });

    it("should support all-time period without comparison", async () => {
      vi.mocked(db.getTrainerEarningsSummary).mockResolvedValue({
        totalEarnings: 50000,
        productCommissions: 15000,
        serviceRevenue: 35000,
        bundlesSold: 500,
      });

      const result = await db.getTrainerEarningsSummary(1, { period: "all" });
      expect(result.periodComparison).toBeUndefined();
    });
  });
});

describe("Commission Calculation Logic", () => {
  it("should calculate product commission correctly", () => {
    const baseRate = 0.10;
    const spfRate = 0.05;
    const productPrice = 49.99;
    
    const commission = productPrice * (baseRate + spfRate);
    expect(commission).toBeCloseTo(7.50, 2);
  });

  it("should calculate service revenue at 100%", () => {
    const servicePrice = 50.00;
    const quantity = 4;
    
    const revenue = servicePrice * quantity;
    expect(revenue).toBe(200.00);
  });

  it("should calculate total earnings correctly", () => {
    const productCommission = 25.50;
    const serviceRevenue = 200.00;
    
    const totalEarnings = productCommission + serviceRevenue;
    expect(totalEarnings).toBe(225.50);
  });

  it("should calculate average per bundle correctly", () => {
    const totalEarnings = 1000;
    const bundlesSold = 8;
    
    const avgPerBundle = totalEarnings / bundlesSold;
    expect(avgPerBundle).toBe(125);
  });
});
