import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Palette,
  Tag,
  Trash2,
  Edit2,
  Plus,
  Loader2,
  Target,
  Dumbbell,
  Save,
} from "lucide-react";
import { useLocation } from "wouter";

interface TagColor {
  id: number;
  tag: string;
  label: string | null;
  color: string;
  category: string;
}

// Predefined color palette for easy selection
const COLOR_PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
  "#64748b", // slate
  "#78716c", // stone
];

function TagCard({
  tag,
  onEdit,
  onDelete,
}: {
  tag: TagColor;
  onEdit: (tag: TagColor) => void;
  onDelete: (tag: TagColor) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: tag.color + "20" }}
        >
          {tag.category === "goal" ? (
            <Target className="h-4 w-4" style={{ color: tag.color }} />
          ) : (
            <Dumbbell className="h-4 w-4" style={{ color: tag.color }} />
          )}
        </div>
        <div>
          <div className="font-medium text-foreground capitalize">
            {tag.label || tag.tag.replace(/_/g, " ")}
          </div>
          <div className="text-xs text-muted-foreground font-mono">{tag.tag}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge
          className="text-white text-xs"
          style={{ backgroundColor: tag.color }}
        >
          {tag.color}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(tag)}
        >
          <Edit2 className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:text-red-600"
          onClick={() => onDelete(tag)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function TagManagement() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("goals");
  const [editingTag, setEditingTag] = useState<TagColor | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagColor | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagCategory, setNewTagCategory] = useState<"goal" | "service">("goal");

  // Form state for editing/creating
  const [formTag, setFormTag] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formColor, setFormColor] = useState("#3b82f6");

  // Fetch all tags
  const goalTags = trpc.bundles.getTagColors.useQuery({ category: "goal" });
  const serviceTags = trpc.bundles.getTagColors.useQuery({ category: "service" });

  // Mutations
  const utils = trpc.useUtils();
  
  const createTagMutation = trpc.bundles.getOrCreateTagColor.useMutation({
    onSuccess: () => {
      toast.success("Tag created successfully");
      utils.bundles.getTagColors.invalidate();
      setIsCreating(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create tag");
    },
  });

  const updateTagMutation = trpc.bundles.updateTagColor.useMutation({
    onSuccess: () => {
      toast.success("Tag updated successfully");
      utils.bundles.getTagColors.invalidate();
      setEditingTag(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update tag");
    },
  });

  const deleteTagMutation = trpc.bundles.deleteTagColor.useMutation({
    onSuccess: () => {
      toast.success("Tag deleted successfully");
      utils.bundles.getTagColors.invalidate();
      setDeletingTag(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete tag");
    },
  });

  const resetForm = () => {
    setFormTag("");
    setFormLabel("");
    setFormColor("#3b82f6");
  };

  const handleEdit = (tag: TagColor) => {
    setEditingTag(tag);
    setFormTag(tag.tag);
    setFormLabel(tag.label || "");
    setFormColor(tag.color);
  };

  const handleSaveEdit = () => {
    if (!editingTag) return;
    updateTagMutation.mutate({
      id: editingTag.id,
      label: formLabel || undefined,
      color: formColor,
    });
  };

  const handleCreate = () => {
    if (!formTag.trim()) {
      toast.error("Please enter a tag name");
      return;
    }
    createTagMutation.mutate({
      tag: formTag.toLowerCase().replace(/\s+/g, "_"),
      category: newTagCategory,
      label: formLabel || undefined,
      color: formColor,
    });
  };

  const handleDelete = () => {
    if (!deletingTag) return;
    deleteTagMutation.mutate({ id: deletingTag.id });
  };

  const openCreateDialog = (category: "goal" | "service") => {
    setNewTagCategory(category);
    setIsCreating(true);
    resetForm();
  };

  const isLoading = goalTags.isLoading || serviceTags.isLoading;

  return (
    <AppShell title="Tag Management">
      <div className="container py-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/manager/settings")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Tag className="h-6 w-6" />
              Tag Management
            </h1>
            <p className="text-muted-foreground">
              Manage goal and service type tags with custom colors
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="goals" className="gap-2">
              <Target className="h-4 w-4" />
              Goal Types
              {goalTags.data && (
                <Badge variant="secondary" className="ml-1">
                  {goalTags.data.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="services" className="gap-2">
              <Dumbbell className="h-4 w-4" />
              Service Types
              {serviceTags.data && (
                <Badge variant="secondary" className="ml-1">
                  {serviceTags.data.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Goal Types</CardTitle>
                  <CardDescription>
                    Tags used to categorize bundles by fitness goals
                  </CardDescription>
                </div>
                <Button onClick={() => openCreateDialog("goal")} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Goal
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : goalTags.data && goalTags.data.length > 0 ? (
                  <div className="space-y-2">
                    {goalTags.data.map((tag) => (
                      <TagCard
                        key={tag.id}
                        tag={tag}
                        onEdit={handleEdit}
                        onDelete={setDeletingTag}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No goal tags yet</p>
                    <p className="text-sm">Create your first goal type to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Service Types</CardTitle>
                  <CardDescription>
                    Tags used to categorize services included in bundles
                  </CardDescription>
                </div>
                <Button onClick={() => openCreateDialog("service")} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Service
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : serviceTags.data && serviceTags.data.length > 0 ? (
                  <div className="space-y-2">
                    {serviceTags.data.map((tag) => (
                      <TagCard
                        key={tag.id}
                        tag={tag}
                        onEdit={handleEdit}
                        onDelete={setDeletingTag}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No service tags yet</p>
                    <p className="text-sm">Create your first service type to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tag</DialogTitle>
              <DialogDescription>
                Update the display label and color for this tag
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tag ID (read-only)</Label>
                <Input value={formTag} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Display Label</Label>
                <Input
                  id="label"
                  placeholder="e.g., Weight Loss"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-slate-200"
                    style={{ backgroundColor: formColor }}
                  />
                  <Input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        formColor === color ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingTag(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateTagMutation.isPending}
                className="gap-2"
              >
                {updateTagMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Dialog */}
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Create New {newTagCategory === "goal" ? "Goal" : "Service"} Tag
              </DialogTitle>
              <DialogDescription>
                Add a new tag with a custom color for categorizing bundles
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newTag">Tag Name *</Label>
                <Input
                  id="newTag"
                  placeholder="e.g., muscle_building"
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Use lowercase with underscores (spaces will be converted)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newLabel">Display Label</Label>
                <Input
                  id="newLabel"
                  placeholder="e.g., Muscle Building"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-slate-200"
                    style={{ backgroundColor: formColor }}
                  />
                  <Input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-6 h-6 rounded-full border-2 transition-all ${
                        formColor === color ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormColor(color)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createTagMutation.isPending || !formTag.trim()}
                className="gap-2"
              >
                {createTagMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create Tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deletingTag} onOpenChange={(open) => !open && setDeletingTag(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Tag</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this tag? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deletingTag && (
              <div className="py-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: deletingTag.color + "20" }}
                  >
                    {deletingTag.category === "goal" ? (
                      <Target className="h-4 w-4" style={{ color: deletingTag.color }} />
                    ) : (
                      <Dumbbell className="h-4 w-4" style={{ color: deletingTag.color }} />
                    )}
                  </div>
                  <div>
                    <div className="font-medium capitalize">
                      {deletingTag.label || deletingTag.tag.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground">{deletingTag.category} tag</div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingTag(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteTagMutation.isPending}
                className="gap-2"
              >
                {deleteTagMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete Tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
