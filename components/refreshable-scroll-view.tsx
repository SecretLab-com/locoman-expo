import React, { useState, useCallback } from "react";
import { ScrollView, RefreshControl, ScrollViewProps } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface RefreshableScrollViewProps extends ScrollViewProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

/**
 * A ScrollView with built-in pull-to-refresh functionality.
 * Wraps the standard ScrollView with a RefreshControl that handles
 * the refreshing state automatically.
 */
export function RefreshableScrollView({
  onRefresh,
  children,
  ...props
}: RefreshableScrollViewProps) {
  const [refreshing, setRefreshing] = useState(false);
  const colors = useColors();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <ScrollView
      {...props}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {children}
    </ScrollView>
  );
}
