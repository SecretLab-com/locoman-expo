import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import {
  Dumbbell,
  Search,
  Filter,
  Heart,
  Zap,
  Award,
  Target,
  User,
  Package,
} from "lucide-react";
import { BundleGridSkeleton, FilterBarSkeleton } from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useGoalTagColors } from "@/hooks/useTagColors";

const goalIcons: Record<string, React.ElementType> = {
  weight_loss: Heart,
  strength: Dumbbell,
  longevity: Award,
  power: Zap,
};

const goalColors: Record<string, string> = {
  weight_loss: "bg-green-100 text-green-700",
  strength: "bg-orange-100 text-orange-700",
  longevity: "bg-purple-100 text-purple-700",
  power: "bg-blue-100 text-blue-700",
};

type Bundle = {
  id: number;
  title: string;
  description: string;
  price: string;
  goalType: string;
  goalsJson: string[] | null;
  imageUrl: string | null;
  trainerName: string;
  productsJson: Array<{ title?: string; name?: string; imageUrl?: string }> | null;
};

export default function Catalog() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const urlGoal = new URLSearchParams(searchParams).get("goal");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<string>(urlGoal || "all");
  const [sortBy, setSortBy] = useState("popular");

  // Goal tag colors
  const { suggestions: goalSuggestions } = useGoalTagColors();

  // Fetch bundles from API
  const { data: catalogData, isLoading, refetch } = trpc.catalog.bundles.useQuery(
    { goalType: selectedGoal !== "all" ? selectedGoal : undefined },
    { staleTime: 30000 }
  );

  // Pull-to-refresh handler
  const handleRefresh = async () => {
    await refetch();
  };

  // Transform API data
  const bundles = useMemo(() => {
    if (!catalogData) return [];
    return catalogData.map((item) => ({
      id: item.draft.id,
      title: item.draft.title,
      description: item.draft.description || "",
      price: item.draft.price || "0",
      goalType: item.template?.goalType || "strength",
      goalsJson: item.draft.goalsJson as string[] | null,
      imageUrl: item.draft.imageUrl,
      trainerName: "Trainer",
      productsJson: item.draft.productsJson as Array<{ title?: string; name?: string; imageUrl?: string }> | null,
    }));
  }, [catalogData]);

  // Filter bundles
  const filteredBundles = useMemo(() => {
    let result = bundles.filter((bundle: Bundle) => {
      const matchesSearch =
        bundle.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bundle.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGoal = selectedGoal === "all" || bundle.goalType === selectedGoal;
      return matchesSearch && matchesGoal;
    });

    // Sort
    if (sortBy === "price_low") {
      result = [...result].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sortBy === "price_high") {
      result = [...result].sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    }

    return result;
  }, [bundles, searchQuery, selectedGoal, sortBy]);

  return (
    <AppShell title="Bundles" onRefresh={handleRefresh}>
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Bundle Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Trainer-curated wellness bundles for your fitness goals
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bundles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Select value={selectedGoal} onValueChange={setSelectedGoal}>
              <SelectTrigger className="flex-1">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Goal Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Goals</SelectItem>
                <SelectItem value="weight_loss">Weight Loss</SelectItem>
                <SelectItem value="strength">Strength</SelectItem>
                <SelectItem value="longevity">Longevity</SelectItem>
                <SelectItem value="power">Power</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="price_low">Price: Low to High</SelectItem>
                <SelectItem value="price_high">Price: High to Low</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Goal Type Pills */}
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 -mx-4 px-4">
          {[
            { key: "all", label: "All", icon: Target },
            { key: "weight_loss", label: "Weight Loss", icon: Heart },
            { key: "strength", label: "Strength", icon: Dumbbell },
            { key: "longevity", label: "Longevity", icon: Award },
            { key: "power", label: "Power", icon: Zap },
          ].map((goal) => (
            <Button
              key={goal.key}
              variant={selectedGoal === goal.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedGoal(goal.key)}
              className="gap-2 whitespace-nowrap flex-shrink-0"
            >
              <goal.icon className="h-4 w-4" />
              {goal.label}
            </Button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <>
            <Skeleton className="h-4 w-32 mb-4" />
            <BundleGridSkeleton count={6} />
          </>
        )}

        {/* Results count */}
        {!isLoading && (
          <div className="text-sm text-muted-foreground mb-4">
            Showing {filteredBundles.length} bundle{filteredBundles.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* Bundle Grid */}
        {!isLoading && filteredBundles.length > 0 && (
          <div className="grid gap-4">
            {filteredBundles.map((bundle: Bundle) => {
              const GoalIcon = goalIcons[bundle.goalType] || Target;
              const goalColor = goalColors[bundle.goalType] || "bg-muted text-foreground";
              const price = parseFloat(bundle.price);

              return (
                <Card
                  key={bundle.id}
                  className="group cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden"
                  onClick={() => setLocation(`/bundle/${bundle.id}`)}
                >
                  <div className="flex">
                    {/* Bundle image with product thumbnails */}
                    <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                      {bundle.imageUrl ? (
                        <img
                          src={bundle.imageUrl}
                          alt={bundle.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <GoalIcon className="h-12 w-12 text-muted-foreground/50" />
                      )}
                      {/* Product thumbnails overlay */}
                      {bundle.productsJson && bundle.productsJson.length > 0 && (
                        <div className="absolute bottom-1 right-1 flex -space-x-2">
                          {bundle.productsJson.slice(0, 3).map((product, idx) => (
                            product.imageUrl ? (
                              <div
                                key={idx}
                                className="w-6 h-6 rounded-full border-2 border-white bg-white overflow-hidden shadow-sm"
                              >
                                <img
                                  src={product.imageUrl}
                                  alt={product.title || product.name || "Product"}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : null
                          ))}
                          {bundle.productsJson.filter(p => p.imageUrl).length > 3 && (
                            <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-600 flex items-center justify-center shadow-sm">
                              <span className="text-[10px] text-white font-medium">+{bundle.productsJson.filter(p => p.imageUrl).length - 3}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 p-3">
                      <div className="flex items-start justify-between mb-1">
                        <Badge className={`${goalColor} text-xs`}>
                          {bundle.goalType.replace("_", " ")}
                        </Badge>
                        <span className="text-lg font-bold text-foreground">
                          ${price.toFixed(2)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1 group-hover:text-blue-600 transition-colors">
                        {bundle.title}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {bundle.trainerName}
                      </div>
                      {/* Goal tags */}
                      {bundle.goalsJson && bundle.goalsJson.length > 0 && (
                        <div className="flex items-center gap-1 mt-2 flex-wrap">
                          {bundle.goalsJson.map((goal: string) => {
                            const tagColor = goalSuggestions.find(s => s.value.toLowerCase() === goal.toLowerCase());
                            return (
                              <Badge
                                key={goal}
                                className="text-xs capitalize"
                                style={{
                                  backgroundColor: tagColor?.color ? `${tagColor.color}20` : undefined,
                                  color: tagColor?.color || undefined,
                                  borderColor: tagColor?.color || undefined,
                                }}
                                variant={tagColor ? "outline" : "secondary"}
                              >
                                {goal.replace("_", " ")}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredBundles.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No bundles found</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {searchQuery || selectedGoal !== "all"
                ? "Try adjusting your search or filter criteria"
                : "Trainers haven't published any bundles yet. Check back soon!"}
            </p>
            {(searchQuery || selectedGoal !== "all") && (
              <Button variant="outline" onClick={() => {
                setSearchQuery("");
                setSelectedGoal("all");
              }}>
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
