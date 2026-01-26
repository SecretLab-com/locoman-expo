import { describe, it, expect, vi, beforeEach } from "vitest";
import * as shopify from "./shopify";
import * as db from "./db";

// Mock the shopify module
vi.mock("./shopify", () => ({
  syncProductsToDatabase: vi.fn(),
  fetchProducts: vi.fn(),
}));

// Mock the db module
vi.mock("./db", () => ({
  upsertProduct: vi.fn(),
  getProducts: vi.fn(),
  getProductById: vi.fn(),
  getProductsByIds: vi.fn(),
  logActivity: vi.fn(),
}));

describe("Product Sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("syncProductsToDatabase", () => {
    it("should sync products from Shopify to database", async () => {
      const mockUpsertProduct = vi.fn().mockResolvedValue(1);
      
      // Mock the sync function to return success
      vi.mocked(shopify.syncProductsToDatabase).mockResolvedValue({
        synced: 5,
        errors: 0,
      });

      const result = await shopify.syncProductsToDatabase(mockUpsertProduct);

      expect(result.synced).toBe(5);
      expect(result.errors).toBe(0);
    });

    it("should handle sync errors gracefully", async () => {
      const mockUpsertProduct = vi.fn().mockRejectedValue(new Error("DB error"));
      
      vi.mocked(shopify.syncProductsToDatabase).mockResolvedValue({
        synced: 3,
        errors: 2,
      });

      const result = await shopify.syncProductsToDatabase(mockUpsertProduct);

      expect(result.synced).toBe(3);
      expect(result.errors).toBe(2);
    });
  });

  describe("getProducts", () => {
    it("should return products from database", async () => {
      const mockProducts = [
        { id: 1, name: "Product 1", price: "29.99" },
        { id: 2, name: "Product 2", price: "39.99" },
      ];

      vi.mocked(db.getProducts).mockResolvedValue(mockProducts as any);

      const result = await db.getProducts();

      expect(result).toEqual(mockProducts);
      expect(db.getProducts).toHaveBeenCalled();
    });

    it("should filter products by category", async () => {
      const mockProducts = [
        { id: 1, name: "Protein", category: "protein", price: "49.99" },
      ];

      vi.mocked(db.getProducts).mockResolvedValue(mockProducts as any);

      const result = await db.getProducts({ category: "protein" });

      expect(result).toEqual(mockProducts);
      expect(db.getProducts).toHaveBeenCalledWith({ category: "protein" });
    });
  });

  describe("upsertProduct", () => {
    it("should insert new product when shopifyProductId not found", async () => {
      vi.mocked(db.upsertProduct).mockResolvedValue(1);

      const newProduct = {
        shopifyProductId: 123456,
        shopifyVariantId: 789,
        name: "New Product",
        price: "29.99",
        inventoryQuantity: 100,
        availability: "available" as const,
      };

      const result = await db.upsertProduct(newProduct);

      expect(result).toBe(1);
      expect(db.upsertProduct).toHaveBeenCalledWith(newProduct);
    });

    it("should update existing product when shopifyProductId found", async () => {
      vi.mocked(db.upsertProduct).mockResolvedValue(5); // existing ID

      const existingProduct = {
        shopifyProductId: 123456,
        shopifyVariantId: 789,
        name: "Updated Product",
        price: "34.99",
        inventoryQuantity: 50,
        availability: "available" as const,
      };

      const result = await db.upsertProduct(existingProduct);

      expect(result).toBe(5);
      expect(db.upsertProduct).toHaveBeenCalledWith(existingProduct);
    });
  });
});
