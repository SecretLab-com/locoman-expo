import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, Check, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ImageLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectImage: (imageUrl: string) => void;
}

export function ImageLibraryDialog({
  open,
  onOpenChange,
  onSelectImage,
}: ImageLibraryDialogProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: images, isLoading, refetch } = trpc.bundles.imageLibrary.useQuery(undefined, {
    enabled: open,
  });

  const deleteFromLibrary = trpc.bundles.deleteFromLibrary.useMutation({
    onSuccess: () => {
      toast.success("Image removed from library");
      refetch();
      if (selectedId === deletingId) {
        setSelectedId(null);
      }
      setDeletingId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
      setDeletingId(null);
    },
  });

  const handleSelect = () => {
    const selected = images?.find((img) => img.id === selectedId);
    if (selected) {
      onSelectImage(selected.url);
      onOpenChange(false);
      setSelectedId(null);
    }
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    deleteFromLibrary.mutate({ id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Image Library</DialogTitle>
          <DialogDescription>
            Select a previously saved image to use as your bundle cover.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !images || images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-1">No saved images</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              When you upload custom images for your bundles, they'll be saved here for easy reuse.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid grid-cols-3 gap-4">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={cn(
                    "relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all",
                    selectedId === image.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30"
                  )}
                  onClick={() => setSelectedId(image.id)}
                >
                  <img
                    src={image.url}
                    alt={image.title || "Bundle cover"}
                    className="w-full aspect-square object-cover"
                  />
                  
                  {/* Selection indicator */}
                  {selectedId === image.id && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  )}

                  {/* Delete button */}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDelete(image.id, e)}
                    disabled={deletingId === image.id}
                  >
                    {deletingId === image.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>

                  {/* Title overlay */}
                  {image.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-white text-xs truncate">{image.title}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedId}>
            Use Selected Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
