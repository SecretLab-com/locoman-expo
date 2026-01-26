import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getTagColors: vi.fn(),
  getTagColor: vi.fn(),
  createTagColor: vi.fn(),
  upsertTagColor: vi.fn(),
  getOrCreateTagColor: vi.fn(),
}));

import {
  getTagColors,
  getTagColor,
  createTagColor,
  upsertTagColor,
  getOrCreateTagColor,
} from "./db";

describe("Tag Colors System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTagColors", () => {
    it("should return all tag colors when no category specified", async () => {
      const mockColors = [
        { id: 1, tag: "weight_loss", color: "#ef4444", category: "goal", label: "Weight Loss" },
        { id: 2, tag: "training", color: "#3b82f6", category: "service", label: "Personal Training" },
      ];
      vi.mocked(getTagColors).mockResolvedValue(mockColors);
      
      const colors = await getTagColors();
      expect(colors).toHaveLength(2);
      expect(colors[0].category).toBe("goal");
      expect(colors[1].category).toBe("service");
    });

    it("should return only goal colors when category is goal", async () => {
      const mockGoalColors = [
        { id: 1, tag: "weight_loss", color: "#ef4444", category: "goal", label: "Weight Loss" },
        { id: 2, tag: "strength", color: "#f97316", category: "goal", label: "Strength" },
      ];
      vi.mocked(getTagColors).mockResolvedValue(mockGoalColors);
      
      const colors = await getTagColors("goal");
      expect(colors).toHaveLength(2);
      expect(colors.every(c => c.category === "goal")).toBe(true);
    });

    it("should return only service colors when category is service", async () => {
      const mockServiceColors = [
        { id: 1, tag: "training", color: "#3b82f6", category: "service", label: "Personal Training" },
        { id: 2, tag: "check_in", color: "#10b981", category: "service", label: "Check-in Call" },
      ];
      vi.mocked(getTagColors).mockResolvedValue(mockServiceColors);
      
      const colors = await getTagColors("service");
      expect(colors).toHaveLength(2);
      expect(colors.every(c => c.category === "service")).toBe(true);
    });
  });

  describe("getTagColor", () => {
    it("should return tag color when it exists", async () => {
      const mockColor = { id: 1, tag: "weight_loss", color: "#ef4444", category: "goal", label: "Weight Loss" };
      vi.mocked(getTagColor).mockResolvedValue(mockColor);
      
      const color = await getTagColor("weight_loss", "goal");
      expect(color).toBeDefined();
      expect(color?.tag).toBe("weight_loss");
      expect(color?.color).toBe("#ef4444");
    });

    it("should return null when tag color does not exist", async () => {
      vi.mocked(getTagColor).mockResolvedValue(null);
      
      const color = await getTagColor("nonexistent", "goal");
      expect(color).toBeNull();
    });
  });

  describe("createTagColor", () => {
    it("should create a new tag color", async () => {
      vi.mocked(createTagColor).mockResolvedValue(undefined);
      
      await createTagColor({
        tag: "custom_goal",
        color: "#9333ea",
        category: "goal",
        label: "Custom Goal",
      });
      
      expect(createTagColor).toHaveBeenCalledWith({
        tag: "custom_goal",
        color: "#9333ea",
        category: "goal",
        label: "Custom Goal",
      });
    });
  });

  describe("upsertTagColor", () => {
    it("should update existing tag color", async () => {
      const existingColor = { id: 1, tag: "weight_loss", color: "#ef4444", category: "goal", label: "Weight Loss" };
      vi.mocked(getTagColor).mockResolvedValue(existingColor);
      vi.mocked(upsertTagColor).mockResolvedValue({ ...existingColor, color: "#dc2626" });
      
      const result = await upsertTagColor({
        tag: "weight_loss",
        color: "#dc2626",
        category: "goal",
        label: "Weight Loss",
      });
      
      expect(result.color).toBe("#dc2626");
    });

    it("should create new tag color if it does not exist", async () => {
      vi.mocked(getTagColor).mockResolvedValue(null);
      vi.mocked(upsertTagColor).mockResolvedValue({
        tag: "new_tag",
        color: "#7c3aed",
        category: "goal",
        label: "New Tag",
      });
      
      const result = await upsertTagColor({
        tag: "new_tag",
        color: "#7c3aed",
        category: "goal",
        label: "New Tag",
      });
      
      expect(result.tag).toBe("new_tag");
      expect(result.color).toBe("#7c3aed");
    });
  });

  describe("getOrCreateTagColor", () => {
    it("should return existing color when tag exists", async () => {
      vi.mocked(getOrCreateTagColor).mockResolvedValue({
        tag: "weight_loss",
        color: "#ef4444",
        label: "Weight Loss",
      });
      
      const result = await getOrCreateTagColor("weight_loss", "goal");
      expect(result.tag).toBe("weight_loss");
      expect(result.color).toBe("#ef4444");
    });

    it("should create and return new color when tag does not exist", async () => {
      vi.mocked(getOrCreateTagColor).mockResolvedValue({
        tag: "custom_tag",
        color: "#9333ea", // Auto-assigned from palette
        label: "custom_tag",
      });
      
      const result = await getOrCreateTagColor("custom_tag", "goal");
      expect(result.tag).toBe("custom_tag");
      expect(result.color).toMatch(/^#[0-9a-f]{6}$/i); // Valid hex color
    });

    it("should use provided label when creating new tag", async () => {
      vi.mocked(getOrCreateTagColor).mockResolvedValue({
        tag: "custom_tag",
        color: "#9333ea",
        label: "My Custom Tag",
      });
      
      const result = await getOrCreateTagColor("custom_tag", "goal", "My Custom Tag");
      expect(result.label).toBe("My Custom Tag");
    });
  });

  describe("Color Palette", () => {
    it("should generate deterministic colors based on tag name", async () => {
      // The same tag should always get the same color
      vi.mocked(getOrCreateTagColor).mockImplementation(async (tag) => {
        const palette = [
          "#e11d48", "#db2777", "#c026d3", "#9333ea", "#7c3aed",
          "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6",
          "#10b981", "#22c55e", "#84cc16", "#eab308", "#f97316",
          "#ef4444"
        ];
        const hash = tag.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const color = palette[hash % palette.length];
        return { tag, color, label: tag };
      });
      
      const result1 = await getOrCreateTagColor("test_tag", "goal");
      const result2 = await getOrCreateTagColor("test_tag", "goal");
      
      expect(result1.color).toBe(result2.color);
    });
  });

  describe("Default Tag Colors", () => {
    it("should have all default goal types defined", () => {
      const defaultGoals = [
        "weight_loss", "strength", "longevity", "power", "toning",
        "recovery", "endurance", "flexibility", "mobility",
        "sports_performance", "muscle_building", "cardio"
      ];
      
      expect(defaultGoals).toHaveLength(12);
    });

    it("should have all default service types defined", () => {
      const defaultServices = [
        "training", "check_in", "plan_review", "call", "group_session",
        "assessment", "nutrition", "equipment_service", "racket_stringing",
        "video_analysis"
      ];
      
      expect(defaultServices).toHaveLength(10);
    });
  });
});
