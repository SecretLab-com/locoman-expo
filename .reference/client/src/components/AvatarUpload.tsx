import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Camera, Trash2, Upload, Loader2, User } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ImageCropper } from "./ImageCropper";

interface AvatarUploadProps {
  currentPhotoUrl?: string | null;
  userName?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  onUploadComplete?: (url: string) => void;
  onRemoveComplete?: () => void;
}

const sizeClasses = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-20 w-20",
  xl: "h-28 w-28",
};

const iconSizes = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
};

const cameraButtonSizes = {
  sm: "h-6 w-6 -bottom-0.5 -right-0.5",
  md: "h-7 w-7 -bottom-0.5 -right-0.5",
  lg: "h-8 w-8 -bottom-1 -right-1",
  xl: "h-10 w-10 -bottom-1 -right-1",
};

export function AvatarUpload({
  currentPhotoUrl,
  userName,
  size = "lg",
  onUploadComplete,
  onRemoveComplete,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const uploadMutation = trpc.userProfile.uploadAvatar.useMutation({
    onSuccess: (data) => {
      setPreviewUrl(data.url);
      utils.auth.me.invalidate();
      toast.success("Profile photo updated!");
      onUploadComplete?.(data.url);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upload photo");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  const removeMutation = trpc.userProfile.removeAvatar.useMutation({
    onSuccess: () => {
      setPreviewUrl(null);
      utils.auth.me.invalidate();
      toast.success("Profile photo removed");
      onRemoveComplete?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove photo");
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 10MB for cropping, will be compressed after)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    // Convert to data URL for cropper
    const reader = new FileReader();
    reader.onload = () => {
      setImageToCrop(reader.result as string);
      setCropperOpen(true);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCropComplete = (croppedBase64: string, mimeType: string) => {
    setIsUploading(true);
    uploadMutation.mutate({
      base64Data: croppedBase64,
      mimeType: mimeType,
      fileName: "avatar.jpg",
    });
    setImageToCrop(null);
  };

  const handleRemove = () => {
    removeMutation.mutate();
  };

  const displayUrl = previewUrl || currentPhotoUrl;
  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <div className="relative inline-block">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      <Avatar className={`${sizeClasses[size]} ring-2 ring-background shadow-lg`}>
        {displayUrl ? (
          <AvatarImage src={displayUrl} alt={userName || "User"} className="object-cover" />
        ) : null}
        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
          {isUploading ? (
            <Loader2 className={`${iconSizes[size]} animate-spin`} />
          ) : displayUrl ? null : (
            <span className="text-lg">{initials}</span>
          )}
        </AvatarFallback>
      </Avatar>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className={`absolute ${cameraButtonSizes[size]} rounded-full shadow-md border-2 border-background hover:scale-110 transition-transform`}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="bottom" className="w-48">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Photo
          </DropdownMenuItem>
          {displayUrl && (
            <DropdownMenuItem
              onClick={handleRemove}
              className="text-red-600 focus:text-red-600"
              disabled={removeMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Photo
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Image Cropper Dialog */}
      {imageToCrop && (
        <ImageCropper
          open={cropperOpen}
          onClose={() => {
            setCropperOpen(false);
            setImageToCrop(null);
          }}
          imageSrc={imageToCrop}
          aspectRatio={1}
          onCropComplete={handleCropComplete}
          title="Crop Your Profile Photo"
          description="Adjust the crop area to select the best portion of your photo."
        />
      )}
    </div>
  );
}

// Simple display-only avatar component
interface UserAvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const displaySizeClasses = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-24 w-24",
};

export function UserAvatar({ photoUrl, name, size = "md", className = "" }: UserAvatarProps) {
  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "";

  return (
    <Avatar className={`${displaySizeClasses[size]} ${className}`}>
      {photoUrl ? (
        <AvatarImage src={photoUrl} alt={name || "User"} className="object-cover" loading="lazy" />
      ) : null}
      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-medium">
        {initials || <User className="h-4 w-4" />}
      </AvatarFallback>
    </Avatar>
  );
}
