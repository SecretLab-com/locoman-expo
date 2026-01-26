import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  extractProductsFromBundle,
  shouldRegenerateImage,
} from "./bundleImageGenerator";

// Mock dependencies
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/generated.png" }),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/image.png" }),
}));

vi.mock("./db", () => ({
  getBundleDraftById: vi.fn(),
  getBundleTemplateById: vi.fn(),
  updateBundleDraft: vi.fn(),
}));

describe("Bundle Image Generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractProductsFromBundle", () => {
    it("should extract product info from valid productsJson array", () => {
      const productsJson = [
        { name: "Protein Powder", imageUrl: "https://example.com/protein.jpg", category: "supplements" },
        { name: "Resistance Bands", imageUrl: "https://example.com/bands.jpg", category: "equipment" },
      ];

      const result = extractProductsFromBundle(productsJson);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: "Protein Powder",
        imageUrl: "https://example.com/protein.jpg",
        category: "supplements",
      });
      expect(result[1]).toEqual({
        name: "Resistance Bands",
        imageUrl: "https://example.com/bands.jpg",
        category: "equipment",
      });
    });

    it("should handle products with title instead of name", () => {
      const productsJson = [
        { title: "Shaker Bottle", image_url: "https://example.com/shaker.jpg" },
      ];

      const result = extractProductsFromBundle(productsJson);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Shaker Bottle");
    });

    it("should return empty array for null/undefined input", () => {
      expect(extractProductsFromBundle(null)).toEqual([]);
      expect(extractProductsFromBundle(undefined)).toEqual([]);
    });

    it("should return empty array for non-array input", () => {
      expect(extractProductsFromBundle("not an array")).toEqual([]);
      expect(extractProductsFromBundle({ product: "test" })).toEqual([]);
    });

    it("should handle products without images", () => {
      const productsJson = [
        { name: "Product Without Image" },
      ];

      const result = extractProductsFromBundle(productsJson);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Product Without Image");
      expect(result[0].imageUrl).toBeUndefined();
    });
  });

  describe("shouldRegenerateImage", () => {
    it("should return true when old products is null", () => {
      const newProducts = [{ name: "Product 1", imageUrl: null, category: null }];
      expect(shouldRegenerateImage(null, newProducts)).toBe(true);
    });

    it("should return true when old products is empty", () => {
      const newProducts = [{ name: "Product 1", imageUrl: null, category: null }];
      expect(shouldRegenerateImage([], newProducts)).toBe(true);
    });

    it("should return false when new products is null", () => {
      const oldProducts = [{ name: "Product 1", imageUrl: null, category: null }];
      expect(shouldRegenerateImage(oldProducts, null)).toBe(false);
    });

    it("should return false when new products is empty", () => {
      const oldProducts = [{ name: "Product 1", imageUrl: null, category: null }];
      expect(shouldRegenerateImage(oldProducts, [])).toBe(false);
    });

    it("should return true when product count changes", () => {
      const oldProducts = [{ name: "Product 1", imageUrl: null, category: null }];
      const newProducts = [
        { name: "Product 1", imageUrl: null, category: null },
        { name: "Product 2", imageUrl: null, category: null },
      ];
      expect(shouldRegenerateImage(oldProducts, newProducts)).toBe(true);
    });

    it("should return true when product names change", () => {
      const oldProducts = [{ name: "Product 1", imageUrl: null, category: null }];
      const newProducts = [{ name: "Product 2", imageUrl: null, category: null }];
      expect(shouldRegenerateImage(oldProducts, newProducts)).toBe(true);
    });

    it("should return false when products are the same", () => {
      const oldProducts = [
        { name: "Product 1", imageUrl: null, category: null },
        { name: "Product 2", imageUrl: null, category: null },
      ];
      const newProducts = [
        { name: "Product 1", imageUrl: "new-url", category: "new-category" },
        { name: "Product 2", imageUrl: null, category: null },
      ];
      // Only names matter for comparison, not imageUrl or category
      expect(shouldRegenerateImage(oldProducts, newProducts)).toBe(false);
    });

    it("should return false when products are same but in different order", () => {
      const oldProducts = [
        { name: "Product 1", imageUrl: null, category: null },
        { name: "Product 2", imageUrl: null, category: null },
      ];
      const newProducts = [
        { name: "Product 2", imageUrl: null, category: null },
        { name: "Product 1", imageUrl: null, category: null },
      ];
      expect(shouldRegenerateImage(oldProducts, newProducts)).toBe(false);
    });
  });
});
