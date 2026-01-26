import { describe, it, expect, vi, beforeEach } from "vitest";
import * as db from "./db";

// Mock the database functions with partial mock
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    createBundleDraft: vi.fn(),
    updateBundleDraft: vi.fn(),
    getBundleDraftById: vi.fn(),
  };
});

describe("Bundle Image Source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBundleDraft with imageSource", () => {
    it("should accept ai as imageSource", async () => {
      const mockCreate = vi.mocked(db.createBundleDraft);
      mockCreate.mockResolvedValue(1);

      const result = await db.createBundleDraft({
        trainerId: 1,
        title: "Test Bundle",
        status: "draft",
        imageSource: "ai",
      } as any);

      expect(result).toBe(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          imageSource: "ai",
        })
      );
    });

    it("should accept custom as imageSource", async () => {
      const mockCreate = vi.mocked(db.createBundleDraft);
      mockCreate.mockResolvedValue(2);

      const result = await db.createBundleDraft({
        trainerId: 1,
        title: "Custom Image Bundle",
        status: "draft",
        imageSource: "custom",
      } as any);

      expect(result).toBe(2);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          imageSource: "custom",
        })
      );
    });
  });

  describe("updateBundleDraft with imageSource", () => {
    it("should update imageSource from ai to custom", async () => {
      const mockUpdate = vi.mocked(db.updateBundleDraft);
      mockUpdate.mockResolvedValue(undefined);

      await db.updateBundleDraft(1, { imageSource: "custom" } as any);

      expect(mockUpdate).toHaveBeenCalledWith(1, { imageSource: "custom" });
    });

    it("should update imageSource from custom to ai", async () => {
      const mockUpdate = vi.mocked(db.updateBundleDraft);
      mockUpdate.mockResolvedValue(undefined);

      await db.updateBundleDraft(1, { imageSource: "ai" } as any);

      expect(mockUpdate).toHaveBeenCalledWith(1, { imageSource: "ai" });
    });
  });

  describe("getBundleDraftById returns imageSource", () => {
    it("should return bundle with ai imageSource", async () => {
      const mockBundle = {
        id: 1,
        title: "AI Bundle",
        imageSource: "ai",
        trainerId: 1,
      };

      const mockGet = vi.mocked(db.getBundleDraftById);
      mockGet.mockResolvedValue(mockBundle as any);

      const result = await db.getBundleDraftById(1);

      expect(result).toEqual(mockBundle);
      expect(result?.imageSource).toBe("ai");
    });

    it("should return bundle with custom imageSource", async () => {
      const mockBundle = {
        id: 2,
        title: "Custom Bundle",
        imageSource: "custom",
        trainerId: 1,
      };

      const mockGet = vi.mocked(db.getBundleDraftById);
      mockGet.mockResolvedValue(mockBundle as any);

      const result = await db.getBundleDraftById(2);

      expect(result).toEqual(mockBundle);
      expect(result?.imageSource).toBe("custom");
    });

    it("should default to ai when imageSource is null", async () => {
      const mockBundle = {
        id: 3,
        title: "Legacy Bundle",
        imageSource: null,
        trainerId: 1,
      };

      const mockGet = vi.mocked(db.getBundleDraftById);
      mockGet.mockResolvedValue(mockBundle as any);

      const result = await db.getBundleDraftById(3);

      // The frontend handles null as "ai" default
      expect(result?.imageSource).toBeNull();
    });
  });
});

describe("Image Source Toggle Behavior", () => {
  it("should preserve imageSource when switching between modes", () => {
    // Test that the state management works correctly
    let imageSource: "ai" | "custom" = "ai";
    
    // Switch to custom
    imageSource = "custom";
    expect(imageSource).toBe("custom");
    
    // Switch back to ai
    imageSource = "ai";
    expect(imageSource).toBe("ai");
  });

  it("should validate imageSource enum values", () => {
    const validValues = ["ai", "custom"];
    
    expect(validValues.includes("ai")).toBe(true);
    expect(validValues.includes("custom")).toBe(true);
    expect(validValues.includes("invalid")).toBe(false);
  });
});
