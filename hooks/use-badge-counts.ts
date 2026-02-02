import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/auth-context";
import { useWebSocket } from "@/hooks/use-websocket";

export type BadgeCounts = {
  pendingDeliveries: number;
  pendingApprovals: number;
  unreadMessages: number;
  pendingJoinRequests: number;
};

/**
 * Hook to fetch badge counts for tab notifications
 * Returns counts for various notification types based on user role
 */
export function useBadgeCounts() {
  const { isAuthenticated, isTrainer, isManager, isClient } = useAuthContext();
  const [counts, setCounts] = useState<BadgeCounts>({
    pendingDeliveries: 0,
    pendingApprovals: 0,
    unreadMessages: 0,
    pendingJoinRequests: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const websocket = useWebSocket();

  // Fetch pending deliveries count for trainers
  const trainerDeliveriesQuery = trpc.deliveries.pending.useQuery(
    undefined,
    {
      enabled: isAuthenticated && isTrainer,
      staleTime: Infinity,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch client deliveries
  const clientDeliveriesQuery = trpc.deliveries.myDeliveries.useQuery(
    undefined,
    {
      enabled: isAuthenticated && isClient,
      staleTime: Infinity,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch pending approvals count (for managers)
  const approvalsQuery = trpc.admin.pendingBundles.useQuery(
    undefined,
    {
      enabled: isAuthenticated && isManager,
      staleTime: Infinity,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch pending join requests (for trainers) - uses myTrainers.pendingRequests
  // Note: This shows requests the user has sent, not received
  // For trainers to see incoming requests, we'd need a separate endpoint
  const joinRequestsQuery = trpc.myTrainers.pendingRequests.useQuery(
    undefined,
    {
      enabled: isAuthenticated && isTrainer,
      staleTime: Infinity,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
    }
  );

  // Update counts when queries change
  useEffect(() => {
    const trainerDeliveries = trainerDeliveriesQuery.data?.length ?? 0;
    const clientDeliveries = clientDeliveriesQuery.data?.filter(d => d.status === "pending" || d.status === "ready")?.length ?? 0;
    
    setCounts({
      pendingDeliveries: isTrainer ? trainerDeliveries : clientDeliveries,
      pendingApprovals: approvalsQuery.data?.length ?? 0,
      unreadMessages: 0, // TODO: Implement unread messages count
      pendingJoinRequests: joinRequestsQuery.data?.length ?? 0,
    });
  }, [trainerDeliveriesQuery.data, clientDeliveriesQuery.data, approvalsQuery.data, joinRequestsQuery.data, isTrainer]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      trainerDeliveriesQuery.refetch(),
      clientDeliveriesQuery.refetch(),
      approvalsQuery.refetch(),
      joinRequestsQuery.refetch(),
    ]);
    setIsLoading(false);
  }, [trainerDeliveriesQuery, clientDeliveriesQuery, approvalsQuery, joinRequestsQuery]);

  useEffect(() => {
    if (!isAuthenticated) return;
    websocket.connect();
    const unsubscribe = websocket.subscribe((message) => {
      if (message.type === "badge_counts_updated") {
        refetch();
      }
    });
    return () => {
      unsubscribe();
      websocket.disconnect();
    };
  }, [isAuthenticated, refetch, websocket]);

  return {
    counts,
    isLoading,
    refetch,
  };
}
