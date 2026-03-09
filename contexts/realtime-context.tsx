import { useAuthContext } from "@/contexts/auth-context";
import { offlineCache } from "@/lib/offline-cache";
import { getSupabaseClient } from "@/lib/supabase-client";
import { trpc } from "@/lib/trpc";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useRef, useState } from "react";

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
  trainer_social_profiles: (utils) => {
    utils.socialProgram.myStatus.invalidate();
    utils.socialProgram.myProgramDashboard.invalidate();
    utils.socialProgram.managementSummary.invalidate();
    utils.socialProgram.listMembers.invalidate();
  },
  trainer_social_metrics_daily: (utils) => {
    utils.socialProgram.myProgramDashboard.invalidate();
    utils.socialProgram.campaignMetrics.invalidate();
    utils.admin.campaignMetricsSummary.invalidate();
  },
  trainer_campaign_metrics_daily: (utils) => {
    utils.socialProgram.campaignMetrics.invalidate();
    utils.admin.campaignMetricsSummary.invalidate();
    utils.admin.campaignReportCsv.invalidate();
    utils.admin.campaignReportPdf.invalidate();
  },
  social_event_notifications: (utils) => {
    utils.socialProgram.myNotifications.invalidate();
  },
  trainer_social_contents: (utils) => {
    utils.socialProgram.recentPosts.invalidate();
  },
  trainer_social_content_activity_daily: (utils) => {
    utils.socialProgram.recentPosts.invalidate();
  },
  trainer_payout_onboardings: (utils) => {
    utils.payments.getOnboardingStatus.invalidate();
    utils.payments.payoutSummary.invalidate();
    utils.payments.payoutSetup.invalidate();
    utils.payments.kycSummary.invalidate();
    utils.payments.listOnboardingRequests.invalidate();
    utils.payments.getOnboardingRequest.invalidate();
  },
  trainer_payout_onboarding_details: (utils) => {
    utils.payments.getOnboardingStatus.invalidate();
    utils.payments.kycSummary.invalidate();
    utils.payments.listOnboardingRequests.invalidate();
    utils.payments.getOnboardingRequest.invalidate();
  },
  trainer_payout_onboarding_events: (utils) => {
    utils.payments.getOnboardingStatus.invalidate();
    utils.payments.kycSummary.invalidate();
    utils.payments.listOnboardingRequests.invalidate();
    utils.payments.getOnboardingRequest.invalidate();
  },
};

const DEBOUNCE_MS = 200;

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const utils = trpc.useUtils();
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingTablesRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
        setConnected(false);
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

    let isOnline = true;
    let networkUnsubscribe: (() => void) | null = null;

    const unsubscribeChannel = () => {
      if (!channelRef.current) return;
      channelRef.current.unsubscribe();
      channelRef.current = null;
      setConnected(false);
    };

    const subscribeChannel = () => {
      if (channelRef.current || !isOnline) return;
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
        .on("postgres_changes", { event: "*", schema: "public", table: "trainer_social_profiles" }, () => scheduleInvalidation("trainer_social_profiles"))
        .on("postgres_changes", { event: "*", schema: "public", table: "trainer_social_metrics_daily" }, () => scheduleInvalidation("trainer_social_metrics_daily"))
        .on("postgres_changes", { event: "*", schema: "public", table: "trainer_campaign_metrics_daily" }, () => scheduleInvalidation("trainer_campaign_metrics_daily"))
        .on("postgres_changes", { event: "*", schema: "public", table: "social_event_notifications" }, () => scheduleInvalidation("social_event_notifications"))
        .on("postgres_changes", { event: "*", schema: "public", table: "trainer_social_contents" }, () => scheduleInvalidation("trainer_social_contents"))
        .on("postgres_changes", { event: "*", schema: "public", table: "trainer_social_content_activity_daily" }, () => scheduleInvalidation("trainer_social_content_activity_daily"))
        .on("postgres_changes", { event: "*", schema: "public", table: "trainer_payout_onboardings" }, () => scheduleInvalidation("trainer_payout_onboardings"))
        .on("postgres_changes", { event: "*", schema: "public", table: "trainer_payout_onboarding_details" }, () => scheduleInvalidation("trainer_payout_onboarding_details"))
        .on("postgres_changes", { event: "*", schema: "public", table: "trainer_payout_onboarding_events" }, () => scheduleInvalidation("trainer_payout_onboarding_events"))
        .subscribe((status) => {
          const nextConnected = status === "SUBSCRIBED";
          setConnected(nextConnected);
          if (status === "SUBSCRIBED") {
            console.log("[Realtime] Connected to Supabase Realtime");
          } else if (status === "CHANNEL_ERROR" && isOnline) {
            console.warn("[Realtime] Channel error");
          } else if (status === "TIMED_OUT" && isOnline) {
            console.warn("[Realtime] Connection timed out");
          }
        });
      channelRef.current = channel;
    };

    const initializeRealtime = async () => {
      isOnline = await offlineCache.isOnline();
      if (isOnline) {
        subscribeChannel();
      } else {
        setConnected(false);
      }

      networkUnsubscribe = offlineCache.subscribeToNetworkChanges((online) => {
        isOnline = online;
        if (online) {
          subscribeChannel();
          return;
        }
        unsubscribeChannel();
      });
    };

    void initializeRealtime();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (networkUnsubscribe) {
        networkUnsubscribe();
        networkUnsubscribe = null;
      }
      unsubscribeChannel();
    };
  }, [isAuthenticated, utils]);

  return (
    <RealtimeContext.Provider value={{ connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}
