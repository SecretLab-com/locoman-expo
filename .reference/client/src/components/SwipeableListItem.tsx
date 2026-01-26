import { useState, useRef, useCallback, ReactNode } from "react";
import { useHaptic } from "@/hooks/useHaptic";
import { cn } from "@/lib/utils";

export interface SwipeAction {
  icon: ReactNode;
  label: string;
  color: string;
  bgColor: string;
  onClick: () => void;
}

interface SwipeableListItemProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  threshold?: number;
  disabled?: boolean;
}

export function SwipeableListItem({
  children,
  leftActions = [],
  rightActions = [],
  className,
  threshold = 80,
  disabled = false,
}: SwipeableListItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState<"left" | "right" | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const haptic = useHaptic();

  const maxLeftSwipe = leftActions.length * 72;
  const maxRightSwipe = rightActions.length * 72;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    currentX.current = translateX;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  }, [disabled, translateX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !isDragging) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    // Only handle horizontal swipes
    if (isHorizontalSwipe.current === false) {
      setIsDragging(false);
      return;
    }

    if (isHorizontalSwipe.current === true) {
      e.preventDefault();
      
      let newTranslateX = currentX.current + deltaX;
      
      // Apply resistance at boundaries
      if (newTranslateX > 0) {
        // Swiping right (revealing left actions)
        if (leftActions.length === 0) {
          newTranslateX = newTranslateX * 0.2; // Strong resistance
        } else {
          newTranslateX = Math.min(newTranslateX, maxLeftSwipe + 20);
        }
      } else {
        // Swiping left (revealing right actions)
        if (rightActions.length === 0) {
          newTranslateX = newTranslateX * 0.2; // Strong resistance
        } else {
          newTranslateX = Math.max(newTranslateX, -maxRightSwipe - 20);
        }
      }

      setTranslateX(newTranslateX);

      // Haptic feedback when crossing threshold
      if (Math.abs(newTranslateX) >= threshold && Math.abs(currentX.current + deltaX - threshold) < 5) {
        haptic.selection();
      }
    }
  }, [disabled, isDragging, leftActions.length, rightActions.length, maxLeftSwipe, maxRightSwipe, threshold, haptic]);

  const handleTouchEnd = useCallback(() => {
    if (disabled) return;
    setIsDragging(false);
    isHorizontalSwipe.current = null;

    // Determine final position
    if (translateX > threshold && leftActions.length > 0) {
      // Snap open to left actions
      setTranslateX(maxLeftSwipe);
      setIsOpen("left");
      haptic.medium();
    } else if (translateX < -threshold && rightActions.length > 0) {
      // Snap open to right actions
      setTranslateX(-maxRightSwipe);
      setIsOpen("right");
      haptic.medium();
    } else {
      // Snap closed
      setTranslateX(0);
      setIsOpen(null);
    }
  }, [disabled, translateX, threshold, leftActions.length, rightActions.length, maxLeftSwipe, maxRightSwipe, haptic]);

  const handleClose = useCallback(() => {
    setTranslateX(0);
    setIsOpen(null);
  }, []);

  const handleActionClick = useCallback((action: SwipeAction) => {
    haptic.medium();
    action.onClick();
    // Close after action
    setTimeout(() => {
      setTranslateX(0);
      setIsOpen(null);
    }, 150);
  }, [haptic]);

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
    >
      {/* Left actions (revealed when swiping right) */}
      {leftActions.length > 0 && (
        <div className="absolute inset-y-0 left-0 flex">
          {leftActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              className={cn(
                "flex flex-col items-center justify-center w-18 h-full transition-opacity",
                action.bgColor,
                isOpen === "left" ? "opacity-100" : "opacity-80"
              )}
              style={{ width: 72 }}
            >
              <span className={action.color}>{action.icon}</span>
              <span className={cn("text-xs mt-1 font-medium", action.color)}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Right actions (revealed when swiping left) */}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex">
          {rightActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              className={cn(
                "flex flex-col items-center justify-center w-18 h-full transition-opacity",
                action.bgColor,
                isOpen === "right" ? "opacity-100" : "opacity-80"
              )}
              style={{ width: 72 }}
            >
              <span className={action.color}>{action.icon}</span>
              <span className={cn("text-xs mt-1 font-medium", action.color)}>
                {action.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      <div
        className={cn(
          "relative bg-card touch-pan-y",
          isDragging ? "" : "transition-transform duration-200 ease-out"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={isOpen ? handleClose : undefined}
      >
        {children}
      </div>

      {/* Overlay to close when open */}
      {isOpen && (
        <div 
          className="absolute inset-0 z-10"
          onClick={handleClose}
          style={{ 
            left: isOpen === "left" ? maxLeftSwipe : 0,
            right: isOpen === "right" ? maxRightSwipe : 0 
          }}
        />
      )}
    </div>
  );
}
