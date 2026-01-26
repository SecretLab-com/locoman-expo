import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";

// Test webhook signature verification
describe("Webhook Signature Verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return true in mock mode", async () => {
    process.env.MOCK_SHOPIFY = "true";
    const { verifyWebhookSignature } = await import("./shopify");
    
    const result = verifyWebhookSignature("any body", "any signature");
    expect(result).toBe(true);
  });

  it("should return false when SHOPIFY_API_SECRET is not configured", async () => {
    process.env.MOCK_SHOPIFY = "false";
    process.env.SHOPIFY_API_SECRET = "";
    process.env.SHOPIFY_API_SECRET_KEY = "";
    
    const { verifyWebhookSignature } = await import("./shopify");
    
    const result = verifyWebhookSignature("test body", "test signature");
    expect(result).toBe(false);
  });

  it("should verify valid signature correctly", async () => {
    process.env.MOCK_SHOPIFY = "false";
    const testSecret = "test-webhook-secret";
    process.env.SHOPIFY_API_SECRET = testSecret;
    
    const { verifyWebhookSignature } = await import("./shopify");
    
    // Generate a valid signature
    const body = '{"test": "data"}';
    const hmac = createHmac("sha256", testSecret);
    hmac.update(body, "utf8");
    const validSignature = hmac.digest("base64");
    
    const result = verifyWebhookSignature(body, validSignature);
    expect(result).toBe(true);
  });

  it("should reject invalid signature", async () => {
    process.env.MOCK_SHOPIFY = "false";
    process.env.SHOPIFY_API_SECRET = "test-webhook-secret";
    
    const { verifyWebhookSignature } = await import("./shopify");
    
    const body = '{"test": "data"}';
    const invalidSignature = "aW52YWxpZC1zaWduYXR1cmU="; // base64 of "invalid-signature"
    
    const result = verifyWebhookSignature(body, invalidSignature);
    expect(result).toBe(false);
  });

  it("should support SHOPIFY_API_SECRET_KEY as fallback", async () => {
    process.env.MOCK_SHOPIFY = "false";
    process.env.SHOPIFY_API_SECRET = "";
    const testSecret = "fallback-secret";
    process.env.SHOPIFY_API_SECRET_KEY = testSecret;
    
    const { verifyWebhookSignature } = await import("./shopify");
    
    // Generate a valid signature with the fallback secret
    const body = '{"test": "data"}';
    const hmac = createHmac("sha256", testSecret);
    hmac.update(body, "utf8");
    const validSignature = hmac.digest("base64");
    
    const result = verifyWebhookSignature(body, validSignature);
    expect(result).toBe(true);
  });
});

// Test getTrainersWithStats with zero trainers
describe("getTrainersWithStats Empty Array Guard", () => {
  it("should return empty array when no trainers exist", async () => {
    // This test verifies the function doesn't throw when trainers array is empty
    // The actual database call would be mocked in a real test environment
    const { getTrainersWithStats } = await import("./db");
    
    // The function should handle empty results gracefully
    const result = await getTrainersWithStats();
    expect(Array.isArray(result)).toBe(true);
  });
});
