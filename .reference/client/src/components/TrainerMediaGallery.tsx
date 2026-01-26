import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Camera,
  Image as ImageIcon,
  Video,
  Upload,
  Trash2,
  Loader2,
  Plus,
  GripVertical,
  X,
  Play,
  Link as LinkIcon,
  FileVideo,
} from "lucide-react";
import { toast } from "sonner";
import { ImageCropper } from "./ImageCropper";

type MediaItem = {
  id: number;
  type: "profile_photo" | "gallery_image" | "video" | "bundle_cover";
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  description?: string | null;
  videoProvider?: "youtube" | "vimeo" | "upload" | null;
  videoId?: string | null;
};

// Sortable gallery item component
function SortableGalleryItem({
  img,
  onDelete,
}: {
  img: MediaItem;
  onDelete: (id: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: img.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-square"
    >
      <img
        src={img.url}
        alt={img.title || "Gallery image"}
        className="w-full h-full object-cover rounded-lg"
      />
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3 text-white" />
      </div>
      <button
        onClick={() => onDelete(img.id)}
        className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3 text-white" />
      </button>
    </div>
  );
}

export function TrainerMediaGallery() {
  const utils = trpc.useUtils();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<"profile" | "gallery" | "video" | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  // Cropping state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropType, setCropType] = useState<"profile" | "gallery">("profile");
  const [pendingFileName, setPendingFileName] = useState<string>("");
  
  const profileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Fetch media
  const { data: media, isLoading } = trpc.trainerProfile.getMedia.useQuery();
  
  // Mutations
  const uploadProfilePhoto = trpc.trainerProfile.uploadProfilePhoto.useMutation({
    onSuccess: () => {
      toast.success("Profile photo updated!");
      utils.trainerProfile.getMedia.invalidate();
      utils.auth.me.invalidate();
      setIsUploading(false);
      setUploadType(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload photo");
      setIsUploading(false);
      setUploadType(null);
    },
  });
  
  const uploadGalleryImage = trpc.trainerProfile.uploadGalleryImage.useMutation({
    onSuccess: () => {
      toast.success("Image added to gallery!");
      utils.trainerProfile.getMedia.invalidate();
      setIsUploading(false);
      setUploadType(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload image");
      setIsUploading(false);
      setUploadType(null);
    },
  });
  
  const addVideo = trpc.trainerProfile.addVideo.useMutation({
    onSuccess: () => {
      toast.success("Video added!");
      utils.trainerProfile.getMedia.invalidate();
      setVideoDialogOpen(false);
      setVideoUrl("");
      setVideoTitle("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add video");
    },
  });
  
  const uploadVideo = trpc.trainerProfile.uploadVideo.useMutation({
    onSuccess: () => {
      toast.success("Video uploaded!");
      utils.trainerProfile.getMedia.invalidate();
      setIsUploading(false);
      setUploadType(null);
      setVideoDialogOpen(false);
      setVideoTitle("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload video");
      setIsUploading(false);
      setUploadType(null);
    },
  });
  
  const deleteMedia = trpc.trainerProfile.deleteMedia.useMutation({
    onSuccess: () => {
      toast.success("Media deleted");
      utils.trainerProfile.getMedia.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete");
    },
  });
  
  const reorderGallery = trpc.trainerProfile.reorderGallery.useMutation({
    onError: (error) => {
      toast.error(error.message || "Failed to reorder");
      utils.trainerProfile.getMedia.invalidate();
    },
  });
  
  // File handling - opens cropper instead of direct upload
  const handleFileSelect = useCallback((file: File, type: "profile" | "gallery") => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }
    
    // Read file and open cropper
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropType(type);
      setPendingFileName(file.name);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  }, []);
  
  // Handle cropped image upload
  const handleCropComplete = useCallback((base64Data: string, mimeType: string) => {
    setIsUploading(true);
    setUploadType(cropType);
    
    if (cropType === "profile") {
      uploadProfilePhoto.mutate({
        base64Data,
        mimeType,
        fileName: pendingFileName,
      });
    } else {
      uploadGalleryImage.mutate({
        base64Data,
        mimeType,
        fileName: pendingFileName,
      });
    }
  }, [cropType, pendingFileName, uploadProfilePhoto, uploadGalleryImage]);
  
  // Handle video file upload
  const handleVideoFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }
    
    // 100MB limit for videos
    if (file.size > 100 * 1024 * 1024) {
      toast.error("Video must be less than 100MB");
      return;
    }
    
    setIsUploading(true);
    setUploadType("video");
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadVideo.mutate({
        base64Data: base64,
        mimeType: file.type,
        fileName: file.name,
        title: videoTitle || undefined,
      });
    };
    reader.readAsDataURL(file);
  }, [uploadVideo, videoTitle]);
  
  const handleAddVideo = () => {
    if (!videoUrl) {
      toast.error("Please enter a video URL");
      return;
    }
    addVideo.mutate({ url: videoUrl, title: videoTitle || undefined });
  };
  
  // Categorize media
  const profilePhoto = media?.find((m) => m.type === "profile_photo");
  const galleryImages = media?.filter((m) => m.type === "gallery_image") || [];
  const videos = media?.filter((m) => m.type === "video") || [];
  
  // Handle drag end for reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const currentGallery = media?.filter((m) => m.type === "gallery_image") || [];
      const oldIndex = currentGallery.findIndex((img) => img.id === active.id);
      const newIndex = currentGallery.findIndex((img) => img.id === over.id);
      
      const newOrder = arrayMove(currentGallery, oldIndex, newIndex);
      const orderedIds = newOrder.map((img) => img.id);
      
      // Optimistic update
      utils.trainerProfile.getMedia.setData(undefined, (old) => {
        if (!old) return old;
        const nonGallery = old.filter((m) => m.type !== "gallery_image");
        return [...nonGallery, ...newOrder];
      });
      
      // Persist to server
      reorderGallery.mutate({ orderedIds });
    }
  }, [media, utils, reorderGallery]);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Profile Photo Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-purple-500" />
            Profile Photo
          </CardTitle>
          <CardDescription>
            Your main profile picture shown on your landing page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative">
              {profilePhoto ? (
                <img
                  src={profilePhoto.url}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                  <Camera className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              {isUploading && uploadType === "profile" && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={profileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file, "profile");
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => profileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {profilePhoto ? "Change Photo" : "Upload Photo"}
              </Button>
              <p className="text-xs text-muted-foreground">
                You can crop and resize after selecting an image
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Gallery Images Section with Drag & Drop */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-blue-500" />
                Photo Gallery
              </CardTitle>
              <CardDescription>
                Drag to reorder. Showcase your work ({galleryImages.length}/12)
              </CardDescription>
            </div>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file, "gallery");
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => galleryInputRef.current?.click()}
              disabled={isUploading || galleryImages.length >= 12}
            >
              {isUploading && uploadType === "gallery" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Image
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {galleryImages.length === 0 ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to add your first gallery image
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={galleryImages.map((img) => img.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {galleryImages.map((img) => (
                    <SortableGalleryItem
                      key={img.id}
                      img={img}
                      onDelete={setDeleteConfirmId}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
      
      {/* Videos Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Video className="h-5 w-5 text-red-500" />
                Videos
              </CardTitle>
              <CardDescription>
                Add videos to showcase your training ({videos.length}/6)
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVideoDialogOpen(true)}
              disabled={videos.length >= 6}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Video
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setVideoDialogOpen(true)}
            >
              <Video className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to add a video (upload or paste URL)
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {videos.map((video) => (
                <div key={video.id} className="relative group">
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title || "Video thumbnail"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center">
                        <Play className="h-5 w-5 text-white ml-0.5" />
                      </div>
                    </div>
                    {video.videoProvider === "upload" && (
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">
                        Uploaded
                      </div>
                    )}
                  </div>
                  {video.title && (
                    <p className="text-xs mt-1 truncate">{video.title}</p>
                  )}
                  <button
                    onClick={() => setDeleteConfirmId(video.id)}
                    className="absolute top-1 right-1 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Image Cropper Dialog */}
      {cropImageSrc && (
        <ImageCropper
          open={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setCropImageSrc(null);
          }}
          imageSrc={cropImageSrc}
          aspectRatio={cropType === "profile" ? 1 : 4 / 3}
          onCropComplete={handleCropComplete}
          title={cropType === "profile" ? "Crop Profile Photo" : "Crop Gallery Image"}
          description={
            cropType === "profile"
              ? "Adjust the crop to create your perfect profile photo."
              : "Adjust the crop area for your gallery image."
          }
        />
      )}
      
      {/* Add Video Dialog with Tabs */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Video</DialogTitle>
            <DialogDescription>
              Upload a video file or paste a YouTube/Vimeo URL
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="url" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url" className="gap-2">
                <LinkIcon className="h-4 w-4" />
                Paste URL
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-2">
                <FileVideo className="h-4 w-4" />
                Upload File
              </TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Video URL</Label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div className="space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="My Training Video"
                />
              </div>
              <Button
                onClick={handleAddVideo}
                disabled={addVideo.isPending || !videoUrl}
                className="w-full"
              >
                {addVideo.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4 mr-2" />
                )}
                Add Video URL
              </Button>
            </TabsContent>
            <TabsContent value="upload" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  placeholder="My Training Video"
                />
              </div>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVideoFileSelect(file);
                  e.target.value = "";
                }}
              />
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => videoInputRef.current?.click()}
              >
                {isUploading && uploadType === "video" ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Uploading video...</p>
                  </div>
                ) : (
                  <>
                    <FileVideo className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Click to select a video file
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Max 100MB • MP4, MOV, WebM
                    </p>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Media</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMedia.mutate({ id: deleteConfirmId })}
              disabled={deleteMedia.isPending}
            >
              {deleteMedia.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
