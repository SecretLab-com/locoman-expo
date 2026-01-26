import { Info, CheckCircle2, XCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface ImageGuidelinesProps {
  variant?: "popover" | "inline";
  className?: string;
}

export function ImageGuidelines({ variant = "popover", className }: ImageGuidelinesProps) {
  const content = (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold text-sm mb-2">Recommended Specifications</h4>
        <ul className="text-sm space-y-1.5 text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span><strong>Size:</strong> 1024 × 1024 pixels (square)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span><strong>Format:</strong> JPG, PNG, or WebP</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span><strong>File size:</strong> Under 5MB</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span><strong>Resolution:</strong> At least 72 DPI</span>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-2">Best Practices</h4>
        <ul className="text-sm space-y-1.5 text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>Center your main subject in the image</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>Use high contrast for visibility</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>Keep text minimal and large</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>Use professional product photography</span>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-2">Avoid</h4>
        <ul className="text-sm space-y-1.5 text-muted-foreground">
          <li className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <span>Blurry or pixelated images</span>
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <span>Text near edges (may get cropped)</span>
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <span>Busy backgrounds that distract</span>
          </li>
          <li className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <span>Copyrighted images without permission</span>
          </li>
        </ul>
      </div>

      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> Use the crop tool after uploading to ensure your image fits perfectly in the square format.
        </p>
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <div className={`bg-muted/50 rounded-lg p-4 ${className || ""}`}>
        {content}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className={className}>
          <Info className="h-4 w-4 mr-1" />
          Image Guidelines
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        {content}
      </PopoverContent>
    </Popover>
  );
}

interface ImageValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateImage(file: File): ImageValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    errors.push(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 5MB limit`);
  } else if (file.size > 2 * 1024 * 1024) {
    warnings.push(`Large file size (${(file.size / 1024 / 1024).toFixed(1)}MB) may slow upload`);
  }

  // Check file type
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    errors.push(`Invalid file type: ${file.type}. Use JPG, PNG, or WebP`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

export function validateImageDimensions(
  width: number,
  height: number
): ImageValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check minimum dimensions
  if (width < 400 || height < 400) {
    errors.push(`Image too small (${width}×${height}). Minimum 400×400 pixels`);
  } else if (width < 800 || height < 800) {
    warnings.push(`Image may appear pixelated. Recommended 1024×1024 pixels`);
  }

  // Check aspect ratio (should be close to 1:1 for square)
  const aspectRatio = width / height;
  if (aspectRatio < 0.5 || aspectRatio > 2) {
    warnings.push(`Unusual aspect ratio. Square images (1:1) work best`);
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}
