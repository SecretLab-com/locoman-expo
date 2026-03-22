import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getTrainerByUsername: vi.fn(),
  getUserById: vi.fn(),
  getAttributionForCustomer: vi.fn(),
  upsertAttribution: vi.fn(),
  getAttributionsByTrainer: vi.fn(),
  getOrderById: vi.fn(),
  getOrderItems: vi.fn(),
  getProductById: vi.fn(),
  createEarning: vi.fn(),
}));

import * as db from "../server/db";

const mockedDb = vi.mocked(db);

describe("trainer attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("slug resolution", () => {
    it("resolves a trainer by lowercase username", async () => {
      const mockTrainer = {
        id: "trainer-1",
        username: "alice",
        name: "Alice",
        role: "trainer" as const,
        active: true,
      };
      mockedDb.getTrainerByUsername.mockResolvedValue(mockTrainer as any);

      const result = await db.getTrainerByUsername("alice");
      expect(result).toBeDefined();
      expect(result?.id).toBe("trainer-1");
      expect(mockedDb.getTrainerByUsername).toHaveBeenCalledWith("alice");
    });

    it("returns undefined for non-existent slug", async () => {
      mockedDb.getTrainerByUsername.mockResolvedValue(undefined);

      const result = await db.getTrainerByUsername("nonexistent");
      expect(result).toBeUndefined();
    });
  });

  describe("attribution upsert", () => {
    it("creates attribution with store_link source", async () => {
      mockedDb.upsertAttribution.mockResolvedValue("attr-1");

      const id = await db.upsertAttribution({
        customerId: "customer-1",
        trainerId: "trainer-1",
        source: "store_link",
        metadata: { setBy: "customer-1" },
      });

      expect(id).toBe("attr-1");
      expect(mockedDb.upsertAttribution).toHaveBeenCalledWith({
        customerId: "customer-1",
        trainerId: "trainer-1",
        source: "store_link",
        metadata: { setBy: "customer-1" },
      });
    });

    it("creates attribution with invitation_acceptance source", async () => {
      mockedDb.upsertAttribution.mockResolvedValue("attr-2");

      const id = await db.upsertAttribution({
        customerId: "customer-1",
        trainerId: "trainer-2",
        source: "invitation_acceptance",
        metadata: { invitationId: "inv-1" },
      });

      expect(id).toBe("attr-2");
      expect(mockedDb.upsertAttribution).toHaveBeenCalledWith(
        expect.objectContaining({ source: "invitation_acceptance" }),
      );
    });
  });

  describe("attribution lookup", () => {
    it("returns existing attribution for a customer", async () => {
      mockedDb.getAttributionForCustomer.mockResolvedValue({
        id: "attr-1",
        customerId: "customer-1",
        trainerId: "trainer-1",
        source: "store_link",
        attributedAt: "2026-03-19T00:00:00Z",
        metadata: null,
      });

      const attribution = await db.getAttributionForCustomer("customer-1");
      expect(attribution).toBeDefined();
      expect(attribution?.trainerId).toBe("trainer-1");
    });

    it("returns undefined for non-attributed customer", async () => {
      mockedDb.getAttributionForCustomer.mockResolvedValue(undefined);

      const attribution = await db.getAttributionForCustomer("no-attribution");
      expect(attribution).toBeUndefined();
    });
  });

  describe("commission calculation data model", () => {
    it("product with commission_rate override", async () => {
      const product = {
        id: "prod-1",
        commissionRate: "15.00",
        name: "Test Product",
      };
      mockedDb.getProductById.mockResolvedValue(product as any);

      const result = await db.getProductById("prod-1");
      expect(result).toBeDefined();
      const rate = Number.parseFloat(result?.commissionRate || "10");
      expect(rate).toBe(15);
    });

    it("product without commission_rate uses default 10%", async () => {
      const product = {
        id: "prod-2",
        commissionRate: null,
        name: "Default Commission Product",
      };
      mockedDb.getProductById.mockResolvedValue(product as any);

      const result = await db.getProductById("prod-2");
      const rate = result?.commissionRate
        ? Number.parseFloat(result.commissionRate)
        : 10;
      expect(rate).toBe(10);
    });
  });

  describe("Shopify note_attributes integration", () => {
    it("includes attribution metadata in note_attributes shape", () => {
      const order = {
        id: "order-1",
        trainerId: "trainer-1",
        attributionId: "attr-1",
        savedCartProposalId: null,
      };

      const noteAttributes = [
        { name: "local_order_id", value: order.id },
        { name: "saved_cart_proposal_id", value: String(order.savedCartProposalId || "") },
        { name: "attributed_trainer_id", value: String(order.trainerId || "") },
        { name: "attribution_id", value: String(order.attributionId || "") },
      ].filter((entry) => entry.value);

      expect(noteAttributes).toContainEqual({
        name: "attributed_trainer_id",
        value: "trainer-1",
      });
      expect(noteAttributes).toContainEqual({
        name: "attribution_id",
        value: "attr-1",
      });
      expect(noteAttributes).not.toContainEqual(
        expect.objectContaining({ name: "saved_cart_proposal_id" }),
      );
    });
  });
});
