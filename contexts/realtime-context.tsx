import { useAuthContext } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase-client";
import { trpc } from "@/lib/trpc";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useRef } from "react";

type RealtimeContextValue = {
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue>({ connected: false });

export function useRealtime() {
  return useContext(RealtimeContext);
}

const TABLE_INVALIDATION_MAP: Record<string, (utils: ReturnType<typeof trpc.useUtils>) => void> = {
  products: (utils) => {
    utils.catalog.products.invalidate();
    utils.shopify.products.invalidate();
  },
  bundle_drafts: (utils) => {
    utils.catalog.bundles.invalidate();
    utils.bundles.list.invalidate();
    utils.bundles.templates.invalidate();
    utils.offers.list.invalidate();
  },
  orders: (utils) => {
    utils.orders.myOrders.invalidate();
  },
  payment_sessions: (utils) => {
    utils.payments.history.invalidate();
    utils.payments.stats.invalidate();
    utils.payments.payoutSummary.invalidate();
  },
  users: (utils) => {
    utils.clients.list.invalidate();
    utils.profile.get.invalidate();
  },
  product_deliveries: (utils) => {
    utils.deliveries.myDeliveries.invalidate();
  },
  subscriptions: (utils) => {
    utils.clients.list.invalidate();
    utils.myTrainers.list.invalidate();
  },
  user_invitations: () => {
    // admin.getUserInvitations is role-gated; safe to skip if not accessible
  },
  invitations: (utils) => {
    utils.clients.invitations.invalidate();
  },
  collections: (utils) => {
    utils.catalog.collections.invalidate();
  },
};

const DEBOUNCE_MS = 200;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const utils = trpc.useUtils();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingTablesRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
        connectedRef.current = false;
      }
      return;
    }

    const supabase = getSupabaseClient();

    const flushInvalidations = () => {
      const tables = Array.from(pendingTablesRef.current);
      pendingTablesRef.current.clear();
      timerRef.current = null;

      for (const table of tables) {
        const invalidator = TABLE_INVALIDATION_MAP[table];
        if (invalidator) {
          try {
            invalidator(utils);
          } catch {
            // Query key may not exist for this role; safe to ignore
          }
        }
      }
    };

    const scheduleInvalidation = (table: string) => {
      pendingTablesRef.current.add(table);
      if (timerRef.current) return;
      timerRef.current = setTimeout(flushInvalidations, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("realtime-invalidator")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => scheduleInvalidation("products"))
      .on("postgres_changes", { event: "*", schema: "public", table: "bundle_drafts" }, () => scheduleInvalidation("bundle_drafts"))
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => scheduleInvalidation("orders"))
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_sessions" }, () => scheduleInvalidation("payment_sessions"))
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => scheduleInvalidation("users"))
      .on("postgres_changes", { event: "*", schema: "public", table: "product_deliveries" }, () => scheduleInvalidation("product_deliveries"))
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => scheduleInvalidation("subscriptions"))
      .on("postgres_changes", { event: "*", schema: "public", table: "user_invitations" }, () => scheduleInvalidation("user_invitations"))
      .on("postgres_changes", { event: "*", schema: "public", table: "invitations" }, () => scheduleInvalidation("invitations"))
      .on("postgres_changes", { event: "*", schema: "public", table: "collections" }, () => scheduleInvalidation("collections"))
      .subscribe((status) => {
        connectedRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Connected to Supabase Realtime");
        } else if (status === "CHANNEL_ERROR") {
          console.warn("[Realtime] Channel error");
        } else if (status === "TIMED_OUT") {
          console.warn("[Realtime] Connection timed out");
        }
      });

    channelRef.current = channel;

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      channel.unsubscribe();
      channelRef.current = null;
      connectedRef.current = false;
    };
  }, [isAuthenticated, utils]);

  return (
    <RealtimeContext.Provider value={{ connected: connectedRef.current }}>
      {children}
    </RealtimeContext.Provider>
  );
}
