import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/hooks/useHaptic';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  /** Minimum pull distance to trigger refresh (default: 80px) */
  threshold?: number;
  /** Whether refresh is currently disabled */
  disabled?: boolean;
  /** Custom className for the container */
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  disabled = false,
  className,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const hasTriggeredHaptic = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Only enable pull-to-refresh when scrolled to top
    if (container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
    hasTriggeredHaptic.current = false;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Only allow pull when at top
    if (container.scrollTop > 0) {
      setPullDistance(0);
      return;
    }
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      // Apply resistance to the pull
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, threshold * 1.5);
      setPullDistance(distance);
      
      // Trigger haptic when crossing threshold
      if (distance >= threshold && !hasTriggeredHaptic.current) {
        triggerHaptic('medium');
        hasTriggeredHaptic.current = true;
      } else if (distance < threshold && hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = false;
      }
      
      // Prevent default scroll when pulling down
      if (diff > 10) {
        e.preventDefault();
      }
    }
  }, [isPulling, disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      triggerHaptic('heavy');
      
      try {
        await onRefresh();
        triggerHaptic('success');
      } catch (error) {
        console.error('Refresh failed:', error);
        triggerHaptic('error');
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, disabled, pullDistance, threshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-y-auto h-full", className)}
    >
      {/* Pull indicator */}
      <div 
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center transition-opacity duration-200 z-10",
          showIndicator ? "opacity-100" : "opacity-0"
        )}
        style={{ 
          top: 0,
          height: Math.max(pullDistance, isRefreshing ? 50 : 0),
          paddingTop: Math.max(pullDistance - 30, 0),
        }}
      >
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 transition-transform",
          progress >= 1 ? "scale-110" : "scale-100"
        )}>
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <ArrowDown 
              className={cn(
                "w-5 h-5 text-primary transition-transform duration-200",
                progress >= 1 ? "rotate-180" : ""
              )}
              style={{ 
                transform: `rotate(${progress * 180}deg)`,
              }}
            />
          )}
        </div>
      </div>

      {/* Content with pull offset */}
      <div 
        style={{ 
          transform: `translateY(${isRefreshing ? 50 : pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
