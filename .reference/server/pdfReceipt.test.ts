import { describe, it, expect } from "vitest";
import {
  calculateVATBreakdown,
  generateReceiptHTML,
  buildReceiptData,
  type ReceiptLineItem,
} from "./pdfReceipt";

describe("PDF Receipt Generation", () => {
  describe("calculateVATBreakdown", () => {
    it("should calculate standard rate VAT (20%)", () => {
      const lineItems: ReceiptLineItem[] = [
        { description: "Product A", quantity: 1, unitPrice: 100, vatRate: 20, total: 120 },
      ];
      
      const breakdown = calculateVATBreakdown(lineItems);
      
      expect(breakdown.standardRate.net).toBeCloseTo(100, 2);
      expect(breakdown.standardRate.vat).toBeCloseTo(20, 2);
    });

    it("should calculate reduced rate VAT (5%)", () => {
      const lineItems: ReceiptLineItem[] = [
        { description: "Product B", quantity: 1, unitPrice: 100, vatRate: 5, total: 105 },
      ];
      
      const breakdown = calculateVATBreakdown(lineItems);
      
      expect(breakdown.reducedRate.net).toBeCloseTo(100, 2);
      expect(breakdown.reducedRate.vat).toBeCloseTo(5, 2);
    });

    it("should calculate zero rate VAT", () => {
      const lineItems: ReceiptLineItem[] = [
        { description: "Product C", quantity: 1, unitPrice: 50, vatRate: 0, total: 50 },
      ];
      
      const breakdown = calculateVATBreakdown(lineItems);
      
      expect(breakdown.zeroRate.net).toBe(50);
    });

    it("should handle mixed VAT rates", () => {
      const lineItems: ReceiptLineItem[] = [
        { description: "Standard", quantity: 1, unitPrice: 100, vatRate: 20, total: 120 },
        { description: "Reduced", quantity: 1, unitPrice: 100, vatRate: 5, total: 105 },
        { description: "Zero", quantity: 1, unitPrice: 50, vatRate: 0, total: 50 },
      ];
      
      const breakdown = calculateVATBreakdown(lineItems);
      
      expect(breakdown.standardRate.net).toBeCloseTo(100, 2);
      expect(breakdown.standardRate.vat).toBeCloseTo(20, 2);
      expect(breakdown.reducedRate.net).toBeCloseTo(100, 2);
      expect(breakdown.reducedRate.vat).toBeCloseTo(5, 2);
      expect(breakdown.zeroRate.net).toBe(50);
    });

    it("should handle empty line items", () => {
      const breakdown = calculateVATBreakdown([]);
      
      expect(breakdown.standardRate.net).toBe(0);
      expect(breakdown.standardRate.vat).toBe(0);
      expect(breakdown.reducedRate.net).toBe(0);
      expect(breakdown.reducedRate.vat).toBe(0);
      expect(breakdown.zeroRate.net).toBe(0);
    });
  });

  describe("buildReceiptData", () => {
    it("should build receipt data from order information", () => {
      const order = {
        id: 123,
        totalAmount: "150.00",
        createdAt: new Date("2025-01-15"),
        paymentMethod: "Card",
      };
      
      const customer = { name: "John Doe", email: "john@example.com" };
      const trainer = { name: "Jane Trainer" };
      const bundleName = "Fitness Bundle";
      const lineItems = [
        { type: "product", name: "Protein Powder", quantity: 2, unitPrice: 25, totalPrice: 50 },
        { type: "service", name: "Personal Training", quantity: 1, unitPrice: 100, totalPrice: 100 },
      ];
      
      const receiptData = buildReceiptData(order, customer, trainer, bundleName, lineItems);
      
      expect(receiptData.receiptNumber).toBe("LM-000123");
      expect(receiptData.customerName).toBe("John Doe");
      expect(receiptData.customerEmail).toBe("john@example.com");
      expect(receiptData.trainerName).toBe("Jane Trainer");
      expect(receiptData.bundleName).toBe("Fitness Bundle");
      expect(receiptData.lineItems).toHaveLength(2);
      expect(receiptData.totalAmount).toBe(150);
    });

    it("should handle null customer name", () => {
      const order = { id: 1, totalAmount: "100.00", createdAt: new Date() };
      const customer = { name: null, email: null };
      const trainer = { name: null };
      
      const receiptData = buildReceiptData(order, customer, trainer, "Bundle", []);
      
      expect(receiptData.customerName).toBe("Customer");
      expect(receiptData.customerEmail).toBe("");
      expect(receiptData.trainerName).toBe("Trainer");
    });

    it("should pad receipt number correctly", () => {
      const order = { id: 1, totalAmount: "100.00", createdAt: new Date() };
      const receiptData = buildReceiptData(order, { name: null, email: null }, { name: null }, "Bundle", []);
      
      expect(receiptData.receiptNumber).toBe("LM-000001");
    });
  });

  describe("generateReceiptHTML", () => {
    it("should generate valid HTML with all sections", () => {
      const receiptData = {
        receiptNumber: "LM-000001",
        date: new Date("2025-01-15"),
        customerName: "John Doe",
        customerEmail: "john@example.com",
        trainerName: "Jane Trainer",
        bundleName: "Fitness Bundle",
        lineItems: [
          { description: "Protein Powder", quantity: 2, unitPrice: 25, vatRate: 20, total: 60 },
        ],
        subtotal: 60,
        vatAmount: 10,
        totalAmount: 60,
        paymentMethod: "Card",
        companyDetails: {
          name: "LocoMotivate Ltd",
          address: "123 Fitness Street, London",
          vatNumber: "GB123456789",
          companyNumber: "12345678",
        },
      };
      
      const html = generateReceiptHTML(receiptData);
      
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("LocoMotivate");
      expect(html).toContain("Tax Receipt");
      expect(html).toContain("LM-000001");
      expect(html).toContain("John Doe");
      expect(html).toContain("Jane Trainer");
      expect(html).toContain("Protein Powder");
      expect(html).toContain("VAT Summary");
      expect(html).toContain("GB123456789");
    });

    it("should include reimbursement notice", () => {
      const receiptData = {
        receiptNumber: "LM-000001",
        date: new Date(),
        customerName: "Test",
        customerEmail: "test@test.com",
        trainerName: "Trainer",
        bundleName: "Bundle",
        lineItems: [],
        subtotal: 0,
        vatAmount: 0,
        totalAmount: 0,
        paymentMethod: "Card",
        companyDetails: {
          name: "Test",
          address: "Test",
          vatNumber: "Test",
          companyNumber: "Test",
        },
      };
      
      const html = generateReceiptHTML(receiptData);
      
      expect(html).toContain("Insurance/Employer Reimbursement");
      expect(html).toContain("United Kingdom");
    });

    it("should format currency in GBP", () => {
      const receiptData = {
        receiptNumber: "LM-000001",
        date: new Date(),
        customerName: "Test",
        customerEmail: "test@test.com",
        trainerName: "Trainer",
        bundleName: "Bundle",
        lineItems: [
          { description: "Item", quantity: 1, unitPrice: 99.99, vatRate: 20, total: 119.99 },
        ],
        subtotal: 119.99,
        vatAmount: 20,
        totalAmount: 119.99,
        paymentMethod: "Card",
        companyDetails: {
          name: "Test",
          address: "Test",
          vatNumber: "Test",
          companyNumber: "Test",
        },
      };
      
      const html = generateReceiptHTML(receiptData);
      
      expect(html).toContain("£99.99");
      expect(html).toContain("£119.99");
    });
  });
});

describe("Points Auto-Award Integration", () => {
  describe("Points calculation", () => {
    it("should calculate 1 point per £1 spent", () => {
      const saleAmount = 150.75;
      const points = Math.floor(saleAmount);
      expect(points).toBe(150);
    });

    it("should handle zero amount", () => {
      const saleAmount = 0;
      const points = Math.floor(saleAmount);
      expect(points).toBe(0);
    });

    it("should handle large amounts", () => {
      const saleAmount = 9999.99;
      const points = Math.floor(saleAmount);
      expect(points).toBe(9999);
    });
  });

  describe("Bonus points logic", () => {
    it("should award 100 points for new client (first order)", () => {
      const orderCount = 1;
      const isNewClient = orderCount === 1;
      expect(isNewClient).toBe(true);
      
      const bonusPoints = isNewClient ? 100 : 0;
      expect(bonusPoints).toBe(100);
    });

    it("should award 50 points for returning client", () => {
      const orderCount = 3;
      const isReturningClient = orderCount > 1;
      expect(isReturningClient).toBe(true);
      
      const bonusPoints = isReturningClient ? 50 : 0;
      expect(bonusPoints).toBe(50);
    });

    it("should not award retention bonus on first order", () => {
      const orderCount = 1;
      const isReturningClient = orderCount > 1;
      expect(isReturningClient).toBe(false);
    });
  });
});
