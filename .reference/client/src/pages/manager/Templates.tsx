import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useGoalTagColors } from "@/hooks/useTagColors";
import {
  Dumbbell,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Heart,
  Zap,
  Award,
  Target,
  Loader2,
  Package,
  Calendar,
  ImageIcon,
  X,
  Filter,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const goalIcons: Record<string, React.ElementType> = {
  weight_loss: Heart,
  strength: Dumbbell,
  longevity: Award,
  power: Zap,
};

const goalColors: Record<string, string> = {
  weight_loss: "from-pink-500 to-red-500",
  strength: "from-blue-500 to-indigo-500",
  longevity: "from-green-500 to-emerald-500",
  power: "from-orange-500 to-amber-500",
};

const goalBgColors: Record<string, string> = {
  weight_loss: "bg-pink-100 text-pink-600",
  strength: "bg-blue-100 text-blue-600",
  longevity: "bg-green-100 text-emerald-600",
  power: "bg-orange-100 text-orange-600",
};

type GoalType = "weight_loss" | "strength" | "longevity" | "power";

export default function ManagerTemplates() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGoalFilters, setSelectedGoalFilters] = useState<string[]>([]);

  const utils = trpc.useUtils();

  // Fetch templates from API
  const { data: templates, isLoading } = trpc.templates.list.useQuery();
  
  // Fetch goal tag colors for displaying colored tags
  const { suggestions: goalSuggestions } = useGoalTagColors();

  // Create mutation
  const createTemplate = trpc.templates.create.useMutation({
    onSuccess: () => {
      toast.success("Template created successfully");
      utils.templates.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create template");
    },
  });

  // Delete mutation
  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      toast.success("Template deleted successfully");
      utils.templates.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete template");
    },
  });

  // Get all unique goals from templates for filter options
  const allGoals = React.useMemo(() => {
    const goalsSet = new Set<string>();
    (templates || []).forEach((template) => {
      if (template.goalsJson && Array.isArray(template.goalsJson)) {
        (template.goalsJson as string[]).forEach((goal) => goalsSet.add(goal));
      } else if (template.goalType) {
        goalsSet.add(template.goalType);
      }
    });
    return Array.from(goalsSet);
  }, [templates]);

  // Filter templates by search query and selected goal filters
  const filteredTemplates = (templates || []).filter((template) => {
    // Text search filter
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Goal tag filter
    if (selectedGoalFilters.length === 0) {
      return matchesSearch;
    }
    
    const templateGoals = template.goalsJson && Array.isArray(template.goalsJson)
      ? (template.goalsJson as string[])
      : template.goalType
        ? [template.goalType]
        : [];
    
    // Check if template has ANY of the selected goals (OR logic)
    const matchesGoals = selectedGoalFilters.some((filter) => templateGoals.includes(filter));
    
    return matchesSearch && matchesGoals;
  });

  // Toggle a goal filter
  const toggleGoalFilter = (goal: string) => {
    setSelectedGoalFilters((prev) =>
      prev.includes(goal)
        ? prev.filter((g) => g !== goal)
        : [...prev, goal]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedGoalFilters([]);
    setSearchQuery("");
  };

  const handleEdit = (template: typeof filteredTemplates[0]) => {
    setLocation(`/manager/templates/${template.id}`);
  };

  const handleDuplicate = (template: typeof filteredTemplates[0]) => {
    createTemplate.mutate({
      title: `${template.title} (Copy)`,
      description: template.description || undefined,
      goalType: (template.goalType as GoalType) || undefined,
      basePrice: template.basePrice?.toString() || undefined,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteTemplate.mutate({ id });
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Templates">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Templates">
      <div className="container py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Bundle Templates</h1>
            <p className="text-sm text-muted-foreground">Create templates for trainers</p>
          </div>
          <Button size="sm" onClick={() => setLocation("/manager/templates/new")}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Goal Tag Filters */}
        {allGoals.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter by goal:</span>
              {(selectedGoalFilters.length > 0 || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700 ml-auto flex items-center gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {allGoals.map((goal) => {
                const suggestion = goalSuggestions.find((s) => s.value === goal);
                const color = suggestion?.color || "#6b7280";
                const label = suggestion?.label || goal.replace(/_/g, " ");
                const isSelected = selectedGoalFilters.includes(goal);
                
                return (
                  <button
                    key={goal}
                    onClick={() => toggleGoalFilter(goal)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                      isSelected
                        ? "text-white ring-2 ring-offset-2 ring-offset-background"
                        : "text-foreground bg-muted hover:opacity-80"
                    }`}
                    style={{
                      backgroundColor: isSelected ? color : undefined,
                      borderColor: color,
                      // Use CSS custom property for ring color
                      "--tw-ring-color": color,
                    } as React.CSSProperties}
                  >
                    {label}
                    {isSelected && (
                      <X className="h-3 w-3 ml-1.5 inline-block" />
                    )}
                  </button>
                );
              })}
            </div>
            {selectedGoalFilters.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Showing {filteredTemplates.length} of {templates?.length || 0} templates
              </p>
            )}
          </div>
        )}

        {/* Templates Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const goalType = (template.goalType as GoalType) || "strength";
            const GoalIcon = goalIcons[goalType] || Target;
            const gradientClass = goalColors[goalType] || goalColors.strength;
            const bgColorClass = goalBgColors[goalType] || goalBgColors.strength;

            // Parse default products and services
            const defaultProducts = Array.isArray(template.defaultProducts)
              ? template.defaultProducts.length
              : 0;
            const defaultServices = Array.isArray(template.defaultServices)
              ? template.defaultServices.length
              : 0;

            return (
              <Card 
                key={template.id} 
                className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleEdit(template)}
              >
                {/* Cover Image - Large Hero */}
                <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                  {template.imageUrl ? (
                    <img
                      src={template.imageUrl}
                      alt={template.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
                      <GoalIcon className="h-16 w-16 text-white/80" />
                    </div>
                  )}
                  
                  {/* Overlay gradient for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {/* Status badge */}
                  <div className="absolute top-3 left-3">
                    <Badge
                      variant="outline"
                      className={
                        template.active
                          ? "bg-green-500/90 text-white border-green-400 backdrop-blur-sm"
                          : "bg-muted/500/90 text-white border-slate-400 backdrop-blur-sm"
                      }
                    >
                      {template.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  {/* Actions menu */}
                  <div className="absolute top-3 right-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(template); }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(template); }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleDelete(template.id); }}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  {/* Title overlay at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-bold text-white text-lg truncate">{template.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {/* Display goal tags from goalsJson or fallback to goalType - clickable to filter */}
                      {(() => {
                        const goals: string[] = template.goalsJson && Array.isArray(template.goalsJson)
                          ? (template.goalsJson as string[])
                          : template.goalType
                            ? [template.goalType]
                            : [];
                        
                        const tags = goals.slice(0, 3).map((goal: string) => {
                          const suggestion = goalSuggestions.find((s) => s.value === goal);
                          const color = suggestion?.color || "#6b7280";
                          const label = suggestion?.label || goal.replace(/_/g, " ");
                          const isActive = selectedGoalFilters.includes(goal);
                          
                          return (
                            <button
                              key={goal}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGoalFilter(goal);
                              }}
                              className={`text-xs px-2 py-0.5 rounded-full text-white capitalize backdrop-blur-sm transition-all hover:scale-105 ${
                                isActive ? "ring-2 ring-white ring-offset-1" : ""
                              }`}
                              style={{ backgroundColor: color + "cc" }}
                              title={`Click to ${isActive ? "remove" : "filter by"} ${label}`}
                            >
                              {label}
                            </button>
                          );
                        });
                        
                        const overflow = goals.length > 3 ? (
                          <span key="overflow" className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                            +{goals.length - 3}
                          </span>
                        ) : null;
                        
                        return [...tags, overflow];
                      })()}
                    </div>
                  </div>
                </div>
                
                {/* Card Content */}
                <CardContent className="p-4">
                  {template.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {template.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        {defaultProducts} products
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {defaultServices} services
                      </span>
                    </div>
                    {template.basePrice && (
                      <span className="font-semibold text-foreground">
                        ${Number(template.basePrice).toFixed(2)} base
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No templates found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Create your first bundle template"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setLocation("/manager/templates/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Template
              </Button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
