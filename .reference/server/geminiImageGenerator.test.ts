import { describe, it, expect, vi, beforeEach } from "vitest";
import { isGeminiConfigured } from "./geminiImageGenerator";

// Mock the ENV module
vi.mock("./_core/env", () => ({
  ENV: {
    geminiApiKey: "",
  },
}));

describe("Gemini Image Generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isGeminiConfigured", () => {
    it("should return false when GEMINI_API_KEY is not set", async () => {
      // Re-import to get fresh module with mocked ENV
      const { ENV } = await import("./_core/env");
      (ENV as any).geminiApiKey = "";
      
      const result = isGeminiConfigured();
      expect(result).toBe(false);
    });

    it("should return true when GEMINI_API_KEY is set", async () => {
      const { ENV } = await import("./_core/env");
      (ENV as any).geminiApiKey = "test-api-key";
      
      const result = isGeminiConfigured();
      expect(result).toBe(true);
    });
  });
});
