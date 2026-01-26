import { useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagSuggestion {
  value: string;
  label: string;
  color?: string; // Hex color for the tag
}

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: TagSuggestion[];
  placeholder?: string;
  allowCustom?: boolean;
  customPlaceholder?: string;
  onCustomSubmit?: (custom: string) => void;
  className?: string;
  maxTags?: number; // Maximum number of tags allowed
}

// Generate a random color for custom tags
const generateRandomColor = () => {
  const colors = [
    "#e11d48", "#db2777", "#c026d3", "#9333ea", "#7c3aed",
    "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6",
    "#10b981", "#22c55e", "#84cc16", "#eab308", "#f97316",
    "#ef4444"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Get contrasting text color (black or white) based on background
const getContrastColor = (hexColor: string): string => {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
};

export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder = "Select or type...",
  allowCustom = false,
  customPlaceholder = "Type to add custom...",
  onCustomSubmit,
  className,
  maxTags,
}: TagInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input and exclude already selected
  const filteredSuggestions = suggestions.filter(
    (s) =>
      !value.includes(s.value) &&
      s.label.toLowerCase().includes(inputValue.toLowerCase())
  );

  // Check if input matches any suggestion
  const isCustomValue =
    inputValue.trim() &&
    !suggestions.some(
      (s) => s.label.toLowerCase() === inputValue.toLowerCase()
    );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addTag = (tagValue: string) => {
    if (!value.includes(tagValue)) {
      onChange([...value, tagValue]);
    }
    setInputValue("");
    inputRef.current?.focus();
  };

  const removeTag = (tagValue: string) => {
    onChange(value.filter((v) => v !== tagValue));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      // Check if it matches a suggestion
      const match = suggestions.find(
        (s) => s.label.toLowerCase() === inputValue.toLowerCase()
      );
      if (match) {
        addTag(match.value);
      } else if (allowCustom && isCustomValue) {
        // Add as custom suggestion
        onCustomSubmit?.(inputValue.trim());
        addTag(inputValue.trim());
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      // Remove last tag on backspace if input is empty
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const getTagInfo = (tagValue: string) => {
    const suggestion = suggestions.find((s) => s.value === tagValue);
    return {
      label: suggestion?.label || tagValue,
      color: suggestion?.color || generateRandomColor(),
    };
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap gap-1.5 p-2 min-h-[42px] rounded-md border border-input bg-background cursor-text",
          isOpen && "ring-2 ring-ring ring-offset-2"
        )}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        {/* Selected tags */}
        {value.map((tag) => {
          const tagInfo = getTagInfo(tag);
          return (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full"
              style={{
                backgroundColor: tagInfo.color,
                color: getContrastColor(tagInfo.color),
              }}
            >
              {tagInfo.label}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="ml-0.5 rounded-full p-0.5 hover:opacity-80"
                style={{ color: getContrastColor(tagInfo.color) }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />

        {/* Dropdown indicator */}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform self-center",
            isOpen && "rotate-180"
          )}
        />
      </div>

      {/* Dropdown */}
      {isOpen && (filteredSuggestions.length > 0 || (allowCustom && isCustomValue)) && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-auto">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion.value}
              type="button"
              onClick={() => addTag(suggestion.value)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: suggestion.color || "#6b7280" }}
              />
              {suggestion.label}
            </button>
          ))}

          {/* Custom option */}
          {allowCustom && isCustomValue && (
            <>
              {filteredSuggestions.length > 0 && (
                <div className="border-t border-border" />
              )}
              <button
                type="button"
                onClick={() => {
                  onCustomSubmit?.(inputValue.trim());
                  addTag(inputValue.trim());
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              >
                <span className="text-muted-foreground">Create:</span>
                <Badge variant="outline" className="text-xs">
                  {inputValue.trim()}
                </Badge>
              </button>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {isOpen && filteredSuggestions.length === 0 && !isCustomValue && value.length < suggestions.length && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-3">
          <p className="text-sm text-muted-foreground text-center">
            {inputValue ? "No matching goals" : "All goals selected"}
          </p>
        </div>
      )}
    </div>
  );
}
