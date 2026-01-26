import { useState, useCallback } from 'react';

/**
 * Hook for handling pull-to-refresh functionality
 * @param onRefresh The async function to call when refreshing
 * @returns Object with refreshing state and refresh handler
 */
export function useRefresh(onRefresh: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return {
    refreshing,
    onRefresh: handleRefresh,
  };
}
