import { createContext, useContext, ReactNode } from "react";
import { useBadgeCounts, type BadgeCounts } from "@/hooks/use-badge-counts";

type BadgeContextType = {
  counts: BadgeCounts;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const BadgeContext = createContext<BadgeContextType | null>(null);

export function BadgeProvider({ children }: { children: ReactNode }) {
  const { counts, isLoading, refetch } = useBadgeCounts();

  return (
    <BadgeContext.Provider value={{ counts, isLoading, refetch }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadgeContext() {
  const context = useContext(BadgeContext);
  if (!context) {
    // Return default values if not in provider (for screens outside the main app)
    return {
      counts: {
        pendingDeliveries: 0,
        pendingApprovals: 0,
        unreadMessages: 0,
        pendingJoinRequests: 0,
      },
      isLoading: false,
      refetch: async () => {},
    };
  }
  return context;
}
