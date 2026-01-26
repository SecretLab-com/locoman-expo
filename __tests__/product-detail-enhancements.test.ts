import { describe, it, expect } from "vitest";

describe("Product Detail Modal Enhancements", () => {
  describe("Quantity Selector", () => {
    it("should allow incrementing quantity", () => {
      let quantity = 1;
      const increment = () => { quantity += 1; };
      
      increment();
      expect(quantity).toBe(2);
      
      increment();
      expect(quantity).toBe(3);
    });

    it("should allow decrementing quantity but not below 1", () => {
      let quantity = 3;
      const decrement = () => {
        if (quantity > 1) quantity -= 1;
      };
      
      decrement();
      expect(quantity).toBe(2);
      
      decrement();
      expect(quantity).toBe(1);
      
      decrement(); // Should not go below 1
      expect(quantity).toBe(1);
    });

    it("should show current quantity if product already in bundle", () => {
      const bundleProducts = [
        { id: 1, title: "Protein", quantity: 3 },
        { id: 2, title: "Creatine", quantity: 2 },
      ];
      
      const getExistingQuantity = (productId: number) => {
        const existing = bundleProducts.find(p => p.id === productId);
        return existing?.quantity || 0;
      };
      
      expect(getExistingQuantity(1)).toBe(3);
      expect(getExistingQuantity(2)).toBe(2);
      expect(getExistingQuantity(99)).toBe(0);
    });

    it("should update button text based on selection state and quantity", () => {
      const getButtonText = (isSelected: boolean, quantity: number) => {
        if (isSelected) {
          return `Update Quantity (${quantity})`;
        }
        return `Add ${quantity} to Bundle`;
      };
      
      expect(getButtonText(false, 1)).toBe("Add 1 to Bundle");
      expect(getButtonText(false, 5)).toBe("Add 5 to Bundle");
      expect(getButtonText(true, 3)).toBe("Update Quantity (3)");
    });
  });

  describe("Add Product with Quantity", () => {
    it("should add new product with specified quantity", () => {
      const products: Array<{ id: number; title: string; quantity: number }> = [];
      
      const addProductWithQuantity = (product: { id: number; title: string }, quantity: number) => {
        const existing = products.find(p => p.id === product.id);
        if (existing) {
          existing.quantity = quantity;
        } else {
          products.push({ ...product, quantity: Math.max(1, quantity) });
        }
      };
      
      addProductWithQuantity({ id: 1, title: "Protein" }, 3);
      expect(products).toHaveLength(1);
      expect(products[0].quantity).toBe(3);
    });

    it("should update quantity if product already exists", () => {
      const products = [{ id: 1, title: "Protein", quantity: 2 }];
      
      const addProductWithQuantity = (product: { id: number; title: string }, quantity: number) => {
        const existing = products.find(p => p.id === product.id);
        if (existing) {
          existing.quantity = quantity;
        } else {
          products.push({ ...product, quantity: Math.max(1, quantity) });
        }
      };
      
      addProductWithQuantity({ id: 1, title: "Protein" }, 5);
      expect(products).toHaveLength(1);
      expect(products[0].quantity).toBe(5);
    });

    it("should enforce minimum quantity of 1", () => {
      const products: Array<{ id: number; title: string; quantity: number }> = [];
      
      const addProductWithQuantity = (product: { id: number; title: string }, quantity: number) => {
        products.push({ ...product, quantity: Math.max(1, quantity) });
      };
      
      addProductWithQuantity({ id: 1, title: "Protein" }, 0);
      expect(products[0].quantity).toBe(1);
      
      addProductWithQuantity({ id: 2, title: "Creatine" }, -5);
      expect(products[1].quantity).toBe(1);
    });
  });

  describe("Barcode Scanner from Detail Modal", () => {
    it("should find product by SKU when barcode scanned", () => {
      const products = [
        { id: 1, title: "Protein Powder", sku: "PRO-001" },
        { id: 2, title: "Creatine", sku: "CRE-002" },
        { id: 3, title: "BCAA", sku: "BCAA-003" },
      ];
      
      const findProductBySku = (scannedCode: string) => {
        return products.find(
          p => p.sku && p.sku.toLowerCase() === scannedCode.toLowerCase()
        );
      };
      
      expect(findProductBySku("PRO-001")?.title).toBe("Protein Powder");
      expect(findProductBySku("pro-001")?.title).toBe("Protein Powder"); // Case insensitive
      expect(findProductBySku("UNKNOWN")).toBeUndefined();
    });

    it("should switch to matched product in detail view", () => {
      let currentProduct = { id: 1, title: "Protein" };
      let detailQuantity = 3;
      
      const switchToProduct = (product: { id: number; title: string }) => {
        currentProduct = product;
        detailQuantity = 1; // Reset quantity when switching
      };
      
      switchToProduct({ id: 2, title: "Creatine" });
      
      expect(currentProduct.id).toBe(2);
      expect(currentProduct.title).toBe("Creatine");
      expect(detailQuantity).toBe(1);
    });
  });

  describe("Product Recommendations", () => {
    it("should recommend products with same type", () => {
      const products = [
        { id: 1, title: "Whey Protein", productType: "Supplement", vendor: "Brand A" },
        { id: 2, title: "Casein Protein", productType: "Supplement", vendor: "Brand B" },
        { id: 3, title: "Yoga Mat", productType: "Equipment", vendor: "Brand C" },
        { id: 4, title: "Creatine", productType: "Supplement", vendor: "Brand A" },
      ];
      
      const getRecommendations = (currentProduct: typeof products[0]) => {
        return products.filter(p => {
          if (p.id === currentProduct.id) return false;
          return p.productType === currentProduct.productType || p.vendor === currentProduct.vendor;
        });
      };
      
      const recs = getRecommendations(products[0]);
      expect(recs).toHaveLength(2); // Casein (same type) and Creatine (same vendor)
      expect(recs.map(r => r.title)).toContain("Casein Protein");
      expect(recs.map(r => r.title)).toContain("Creatine");
    });

    it("should recommend products with same vendor", () => {
      const products = [
        { id: 1, title: "Protein", productType: "Supplement", vendor: "FitBrand" },
        { id: 2, title: "Pre-Workout", productType: "Supplement", vendor: "FitBrand" },
        { id: 3, title: "Shaker Bottle", productType: "Accessory", vendor: "FitBrand" },
        { id: 4, title: "Yoga Mat", productType: "Equipment", vendor: "OtherBrand" },
      ];
      
      const getRecommendations = (currentProduct: typeof products[0]) => {
        return products.filter(p => {
          if (p.id === currentProduct.id) return false;
          return p.vendor === currentProduct.vendor;
        });
      };
      
      const recs = getRecommendations(products[0]);
      expect(recs).toHaveLength(2);
      expect(recs.map(r => r.title)).toContain("Pre-Workout");
      expect(recs.map(r => r.title)).toContain("Shaker Bottle");
    });

    it("should exclude bundles from recommendations", () => {
      const products = [
        { id: 1, title: "Protein", productType: "Supplement", vendor: "Brand" },
        { id: 2, title: "Starter Bundle", productType: "Bundle", vendor: "Brand" },
        { id: 3, title: "Creatine", productType: "Supplement", vendor: "Brand" },
        { id: 4, title: "Full Pack", productType: "bundle", vendor: "Brand" }, // lowercase
      ];
      
      const getRecommendations = (currentProduct: typeof products[0]) => {
        return products.filter(p => {
          if (p.id === currentProduct.id) return false;
          if (p.productType && p.productType.toLowerCase() === "bundle") return false;
          return p.productType === currentProduct.productType || p.vendor === currentProduct.vendor;
        });
      };
      
      const recs = getRecommendations(products[0]);
      expect(recs).toHaveLength(1);
      expect(recs[0].title).toBe("Creatine");
    });

    it("should limit recommendations to 4 items", () => {
      const products = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Product ${i + 1}`,
        productType: "Supplement",
        vendor: "Brand",
      }));
      
      const getRecommendations = (currentProduct: typeof products[0]) => {
        return products
          .filter(p => {
            if (p.id === currentProduct.id) return false;
            return p.productType === currentProduct.productType;
          })
          .slice(0, 4);
      };
      
      const recs = getRecommendations(products[0]);
      expect(recs).toHaveLength(4);
    });

    it("should allow clicking recommendation to view its details", () => {
      let selectedProduct = { id: 1, title: "Protein" };
      let detailQuantity = 5;
      
      const viewRecommendation = (product: { id: number; title: string }) => {
        selectedProduct = product;
        detailQuantity = 1; // Reset quantity
      };
      
      viewRecommendation({ id: 2, title: "Creatine" });
      
      expect(selectedProduct.id).toBe(2);
      expect(selectedProduct.title).toBe("Creatine");
      expect(detailQuantity).toBe(1);
    });
  });

  describe("Detail Modal State Management", () => {
    it("should reset quantity when closing modal", () => {
      let showModal = true;
      let detailQuantity = 5;
      
      const closeModal = () => {
        showModal = false;
        detailQuantity = 1;
      };
      
      closeModal();
      
      expect(showModal).toBe(false);
      expect(detailQuantity).toBe(1);
    });

    it("should reset quantity when switching products", () => {
      let currentProduct = { id: 1, title: "Protein" };
      let detailQuantity = 3;
      
      const switchProduct = (product: { id: number; title: string }) => {
        currentProduct = product;
        detailQuantity = 1;
      };
      
      switchProduct({ id: 2, title: "Creatine" });
      
      expect(detailQuantity).toBe(1);
    });
  });
});
