import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleOrderCreated,
  handleOrderPaid,
  handleOrderFulfilled,
  handleFulfillmentUpdate,
  verifyShopifyWebhook,
} from "./shopifyWebhooks";

// Mock the db module
vi.mock("./db", () => ({
  getOrderByShopifyId: vi.fn(),
  createOrder: vi.fn(),
  updateOrder: vi.fn(),
  createOrderItem: vi.fn(),
  updateOrderItem: vi.fn(),
  getClientByEmail: vi.fn(),
  createClient: vi.fn(),
  getBundlePublicationByShopifyProductId: vi.fn(),
  getBundleDraftById: vi.fn(),
  logActivity: vi.fn(),
  createSubscription: vi.fn(),
  getProductByShopifyId: vi.fn(),
  updateOrderItemsFulfillment: vi.fn(),
  updateOrderItemByShopifyId: vi.fn(),
}));

import * as db from "./db";

describe("Shopify Webhook Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleOrderCreated", () => {
    const mockOrderPayload = {
      id: 12345,
      order_number: 1001,
      name: "#1001",
      email: "customer@example.com",
      customer: {
        id: 100,
        email: "customer@example.com",
        first_name: "John",
        last_name: "Doe",
        phone: "+1234567890",
      },
      line_items: [
        {
          id: 1,
          product_id: 999,
          variant_id: 888,
          title: "Test Bundle",
          quantity: 1,
          price: "99.99",
          properties: [],
        },
      ],
      total_price: "99.99",
      subtotal_price: "99.99",
      total_tax: "0.00",
      financial_status: "paid",
      fulfillment_status: null,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T10:00:00Z",
    };

    it("should create a new order when order does not exist", async () => {
      vi.mocked(db.getOrderByShopifyId).mockResolvedValue(null);
      vi.mocked(db.createOrder).mockResolvedValue(1);
      vi.mocked(db.createOrderItem).mockResolvedValue(1);

      const result = await handleOrderCreated(mockOrderPayload);

      expect(result.success).toBe(true);
      expect(db.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          shopifyOrderId: 12345,
          shopifyOrderNumber: "#1001",
          customerEmail: "customer@example.com",
        })
      );
    });

    it("should skip processing if order already exists", async () => {
      vi.mocked(db.getOrderByShopifyId).mockResolvedValue({ id: 1 } as any);

      const result = await handleOrderCreated(mockOrderPayload);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Order already processed");
      expect(db.createOrder).not.toHaveBeenCalled();
    });

    it("should auto-create client when trainer is attributed", async () => {
      vi.mocked(db.getOrderByShopifyId).mockResolvedValue(null);
      vi.mocked(db.createOrder).mockResolvedValue(1);
      vi.mocked(db.createOrderItem).mockResolvedValue(1);
      vi.mocked(db.getBundlePublicationByShopifyProductId).mockResolvedValue({
        id: 10,
        draftId: 5,
      } as any);
      vi.mocked(db.getBundleDraftById).mockResolvedValue({
        id: 5,
        trainerId: 100,
      } as any);
      vi.mocked(db.getClientByEmail).mockResolvedValue(null);
      vi.mocked(db.createClient).mockResolvedValue(50);

      await handleOrderCreated(mockOrderPayload);

      expect(db.createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          trainerId: 100,
          email: "customer@example.com",
          name: "John Doe",
        })
      );
    });
  });

  describe("handleOrderFulfilled", () => {
    const mockFulfilledPayload = {
      id: 12345,
      order_number: 1001,
      name: "#1001",
      email: "customer@example.com",
      line_items: [],
      total_price: "99.99",
      subtotal_price: "99.99",
      total_tax: "0.00",
      financial_status: "paid",
      fulfillment_status: "fulfilled",
      fulfillments: [
        {
          id: 1,
          order_id: 12345,
          status: "success",
          tracking_number: "1Z999AA10123456784",
          tracking_url: "https://tracking.example.com/1Z999AA10123456784",
          tracking_company: "UPS",
          line_items: [],
        },
      ],
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T12:00:00Z",
    };

    it("should update order status and tracking info", async () => {
      vi.mocked(db.getOrderByShopifyId).mockResolvedValue({ id: 1 } as any);
      vi.mocked(db.updateOrder).mockResolvedValue(undefined);

      const result = await handleOrderFulfilled(mockFulfilledPayload);

      expect(result.success).toBe(true);
      expect(db.updateOrder).toHaveBeenCalled();
    });

    it("should skip update if order not found", async () => {
      vi.mocked(db.getOrderByShopifyId).mockResolvedValue(null);

      const result = await handleOrderFulfilled(mockFulfilledPayload);

      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("handleFulfillmentUpdate", () => {
    const mockFulfillmentPayload = {
      id: 5001,
      order_id: 12345,
      status: "success",
      tracking_number: "1Z999AA10123456784",
      tracking_url: "https://tracking.example.com/1Z999AA10123456784",
      tracking_company: "UPS",
      estimated_delivery_at: "2024-01-20T18:00:00Z",
      line_items: [
        {
          id: 1,
          product_id: 999,
          variant_id: 888,
          title: "Test Product",
          quantity: 1,
          price: "49.99",
        },
      ],
    };

    it("should update order with fulfillment tracking info", async () => {
      vi.mocked(db.getOrderByShopifyId).mockResolvedValue({ id: 1 } as any);
      vi.mocked(db.updateOrder).mockResolvedValue(undefined);

      const result = await handleFulfillmentUpdate(mockFulfillmentPayload);

      expect(result.success).toBe(true);
      expect(db.updateOrder).toHaveBeenCalled();
    });
  });

  describe("handleOrderPaid", () => {
    const mockPaidPayload = {
      id: 12345,
      order_number: 1001,
      name: "#1001",
      email: "customer@example.com",
      line_items: [],
      total_price: "99.99",
      subtotal_price: "99.99",
      total_tax: "0.00",
      financial_status: "paid",
      fulfillment_status: null,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-15T12:00:00Z",
    };

    it("should update payment status to paid", async () => {
      vi.mocked(db.getOrderByShopifyId).mockResolvedValue({ id: 1 } as any);
      vi.mocked(db.updateOrder).mockResolvedValue(undefined);

      const result = await handleOrderPaid(mockPaidPayload);

      expect(result.success).toBe(true);
      expect(db.updateOrder).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          paymentStatus: "paid",
        })
      );
    });
  });

  describe("verifyShopifyWebhook", () => {
    it("should return false for missing hmac header", () => {
      const result = verifyShopifyWebhook('{"test": "data"}', undefined);
      expect(result).toBe(false);
    });

    it("should return false for empty hmac header", () => {
      const result = verifyShopifyWebhook('{"test": "data"}', "");
      expect(result).toBe(false);
    });
  });
});
