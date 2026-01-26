import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

interface TagSuggestion {
  value: string;
  label: string;
  color: string;
}

// Default suggestions for goal types (fallback if database is empty)
const DEFAULT_GOAL_SUGGESTIONS: TagSuggestion[] = [
  { value: "weight_loss", label: "Weight Loss", color: "#ef4444" },
  { value: "strength", label: "Strength", color: "#f97316" },
  { value: "longevity", label: "Longevity", color: "#22c55e" },
  { value: "power", label: "Power", color: "#eab308" },
  { value: "toning", label: "Toning", color: "#ec4899" },
  { value: "recovery", label: "Recovery", color: "#14b8a6" },
  { value: "endurance", label: "Endurance", color: "#3b82f6" },
  { value: "flexibility", label: "Flexibility", color: "#a855f7" },
  { value: "mobility", label: "Mobility", color: "#06b6d4" },
  { value: "sports_performance", label: "Sports Performance", color: "#6366f1" },
  { value: "muscle_building", label: "Muscle Building", color: "#dc2626" },
  { value: "cardio", label: "Cardio", color: "#0ea5e9" },
];

// Default suggestions for service types (fallback if database is empty)
const DEFAULT_SERVICE_SUGGESTIONS: TagSuggestion[] = [
  { value: "training", label: "Personal Training", color: "#3b82f6" },
  { value: "check_in", label: "Check-in Call", color: "#10b981" },
  { value: "plan_review", label: "Plan Review", color: "#8b5cf6" },
  { value: "call", label: "Coaching Call", color: "#f59e0b" },
  { value: "group_session", label: "Group Session", color: "#ec4899" },
  { value: "assessment", label: "Fitness Assessment", color: "#06b6d4" },
  { value: "nutrition", label: "Nutrition Consultation", color: "#84cc16" },
  { value: "equipment_service", label: "Equipment Service", color: "#f97316" },
  { value: "racket_stringing", label: "Racket Stringing", color: "#6366f1" },
  { value: "video_analysis", label: "Video Analysis", color: "#14b8a6" },
];

export function useGoalTagColors() {
  const { data: dbColors, isLoading } = trpc.bundles.getTagColors.useQuery(
    { category: "goal" },
    { staleTime: 60000 } // Cache for 1 minute
  );

  const suggestions = useMemo(() => {
    if (!dbColors || dbColors.length === 0) {
      return DEFAULT_GOAL_SUGGESTIONS;
    }
    
    // Merge database colors with defaults, preferring database colors
    const dbColorMap = new Map(dbColors.map(c => [c.tag, c]));
    const merged: TagSuggestion[] = [];
    
    // First add all database colors
    for (const dbColor of dbColors) {
      merged.push({
        value: dbColor.tag,
        label: dbColor.label || dbColor.tag,
        color: dbColor.color,
      });
    }
    
    // Then add any defaults that aren't in the database
    for (const defaultSuggestion of DEFAULT_GOAL_SUGGESTIONS) {
      if (!dbColorMap.has(defaultSuggestion.value)) {
        merged.push(defaultSuggestion);
      }
    }
    
    return merged;
  }, [dbColors]);

  return { suggestions, isLoading };
}

export function useServiceTagColors() {
  const { data: dbColors, isLoading } = trpc.bundles.getTagColors.useQuery(
    { category: "service" },
    { staleTime: 60000 } // Cache for 1 minute
  );

  const suggestions = useMemo(() => {
    if (!dbColors || dbColors.length === 0) {
      return DEFAULT_SERVICE_SUGGESTIONS;
    }
    
    // Merge database colors with defaults, preferring database colors
    const dbColorMap = new Map(dbColors.map(c => [c.tag, c]));
    const merged: TagSuggestion[] = [];
    
    // First add all database colors
    for (const dbColor of dbColors) {
      merged.push({
        value: dbColor.tag,
        label: dbColor.label || dbColor.tag,
        color: dbColor.color,
      });
    }
    
    // Then add any defaults that aren't in the database
    for (const defaultSuggestion of DEFAULT_SERVICE_SUGGESTIONS) {
      if (!dbColorMap.has(defaultSuggestion.value)) {
        merged.push(defaultSuggestion);
      }
    }
    
    return merged;
  }, [dbColors]);

  return { suggestions, isLoading };
}

// Hook to get color for a specific tag (for displaying saved tags)
export function useTagColor(tag: string, category: "goal" | "service") {
  const { suggestions } = category === "goal" ? useGoalTagColors() : useServiceTagColors();
  
  return useMemo(() => {
    const found = suggestions.find(s => s.value === tag);
    return found?.color || "#6b7280"; // Default gray if not found
  }, [suggestions, tag]);
}

// Hook to create/persist a custom tag color
export function useCreateTagColor() {
  const utils = trpc.useUtils();
  const mutation = trpc.bundles.getOrCreateTagColor.useMutation({
    onSuccess: () => {
      // Invalidate tag colors cache to refetch
      utils.bundles.getTagColors.invalidate();
    },
  });

  return mutation;
}
