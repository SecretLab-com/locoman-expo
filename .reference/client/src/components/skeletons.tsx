import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Skeleton for stat cards (used in dashboards)
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-12 h-4" />
        </div>
        <Skeleton className="h-7 w-20 mb-1" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

/**
 * Grid of stat card skeletons
 */
export function StatsGridSkeleton({ 
  count = 4, 
  columns = 2,
  className 
}: { 
  count?: number; 
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  return (
    <div className={cn(`grid ${gridCols[columns]} gap-3`, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for list items with avatar/icon and text
 */
export function ListItemSkeleton({ 
  showAvatar = true,
  showBadge = false,
  showAction = false,
  className 
}: { 
  showAvatar?: boolean;
  showBadge?: boolean;
  showAction?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {showAvatar && (
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              {showBadge && <Skeleton className="h-5 w-16 rounded-full" />}
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          {showAction && (
            <Skeleton className="w-8 h-8 rounded shrink-0" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * List of item skeletons
 */
export function ListSkeleton({ 
  count = 5,
  showAvatar = true,
  showBadge = false,
  showAction = false,
  className 
}: { 
  count?: number;
  showAvatar?: boolean;
  showBadge?: boolean;
  showAction?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton 
          key={i} 
          showAvatar={showAvatar}
          showBadge={showBadge}
          showAction={showAction}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for bundle/product cards with image
 */
export function BundleCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex">
        <Skeleton className="w-24 h-24 rounded-none shrink-0" />
        <div className="flex-1 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-6 w-14" />
          </div>
          <Skeleton className="h-5 w-36" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Grid of bundle card skeletons
 */
export function BundleGridSkeleton({ 
  count = 6,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <BundleCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for schedule/calendar items
 */
export function ScheduleItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 p-2 rounded-lg bg-muted", className)}>
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center gap-1">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/**
 * Skeleton for dashboard schedule section
 */
export function ScheduleSkeleton({ 
  count = 3,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <ScheduleItemSkeleton key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for activity feed items
 */
export function ActivityItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Skeleton className="w-2 h-2 rounded-full mt-1.5 shrink-0" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * Skeleton for activity feed section
 */
export function ActivityFeedSkeleton({ 
  count = 5,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <ActivityItemSkeleton key={i} />
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for trainer/user cards in directory
 */
export function TrainerCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Grid of trainer card skeletons
 */
export function TrainerGridSkeleton({ 
  count = 6,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <TrainerCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for delivery/order items
 */
export function DeliveryItemSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Skeleton className="w-16 h-16 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-48" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * List of delivery item skeletons
 */
export function DeliveryListSkeleton({ 
  count = 4,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <DeliveryItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for earnings/spending summary cards
 */
export function EarningsSummarySkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-10 w-36 mb-2" />
        <Skeleton className="h-4 w-48" />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for transaction/history items
 */
export function TransactionItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between py-3 border-b last:border-0", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

/**
 * List of transaction skeletons
 */
export function TransactionListSkeleton({ 
  count = 5,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <TransactionItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Page header skeleton
 */
export function PageHeaderSkeleton({ 
  showAction = true,
  className 
}: { 
  showAction?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between mb-6", className)}>
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {showAction && <Skeleton className="h-9 w-24" />}
    </div>
  );
}

/**
 * Filter bar skeleton
 */
export function FilterBarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-2 mb-4", className)}>
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

/**
 * Tabs skeleton
 */
export function TabsSkeleton({ 
  count = 4,
  className 
}: { 
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 p-1 bg-muted rounded-lg mb-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 flex-1 rounded-md" />
      ))}
    </div>
  );
}

export default {
  StatCardSkeleton,
  StatsGridSkeleton,
  ListItemSkeleton,
  ListSkeleton,
  BundleCardSkeleton,
  BundleGridSkeleton,
  ScheduleItemSkeleton,
  ScheduleSkeleton,
  ActivityItemSkeleton,
  ActivityFeedSkeleton,
  TrainerCardSkeleton,
  TrainerGridSkeleton,
  DeliveryItemSkeleton,
  DeliveryListSkeleton,
  EarningsSummarySkeleton,
  TransactionItemSkeleton,
  TransactionListSkeleton,
  PageHeaderSkeleton,
  FilterBarSkeleton,
  TabsSkeleton,
};
