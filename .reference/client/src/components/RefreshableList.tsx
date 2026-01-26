import { ReactNode, useCallback } from "react";
import { PullToRefresh } from "./PullToRefresh";
import { trpc } from "@/lib/trpc";

interface RefreshableListProps {
  children: ReactNode;
  /** Array of tRPC query keys to invalidate on refresh */
  queryKeys?: string[];
  /** Custom refresh handler (overrides queryKeys) */
  onRefresh?: () => Promise<void>;
  /** Additional className for the container */
  className?: string;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
}

/**
 * A wrapper component that adds pull-to-refresh functionality to any list.
 * Automatically invalidates specified tRPC queries on refresh.
 * 
 * Usage:
 * ```tsx
 * <RefreshableList queryKeys={["clients.list", "invitations.list"]}>
 *   <YourListContent />
 * </RefreshableList>
 * ```
 */
export function RefreshableList({
  children,
  queryKeys = [],
  onRefresh,
  className,
  enabled = true,
}: RefreshableListProps) {
  const utils = trpc.useUtils();

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
      return;
    }

    // Invalidate all specified query keys
    const invalidations = queryKeys.map(async (key) => {
      // Parse the key to get the router and procedure
      const parts = key.split(".");
      if (parts.length >= 2) {
        const [router, procedure] = parts;
        try {
          // @ts-ignore - Dynamic access to tRPC utils
          const routerUtils = utils[router];
          if (routerUtils && routerUtils[procedure]) {
            await routerUtils[procedure].invalidate();
          } else if (routerUtils?.invalidate) {
            // Invalidate entire router if procedure not found
            await routerUtils.invalidate();
          }
        } catch (error) {
          console.warn(`Failed to invalidate ${key}:`, error);
        }
      }
    });

    await Promise.all(invalidations);
  }, [queryKeys, onRefresh, utils]);

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      className={className}
      disabled={!enabled}
    >
      {children}
    </PullToRefresh>
  );
}

export default RefreshableList;
