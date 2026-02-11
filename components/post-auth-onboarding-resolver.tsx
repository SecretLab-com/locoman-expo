import { useAuthContext } from "@/contexts/auth-context";
import {
  clearPendingOnboardingContext,
  getPendingOnboardingContext,
} from "@/lib/onboarding-context";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import { useEffect, useRef } from "react";

/**
 * Applies post-auth onboarding intents persisted before OAuth redirect.
 * Example intents: deep-link invite acceptance and trainer join requests.
 */
export function PostAuthOnboardingResolver() {
  const { isAuthenticated, profileHydrated, effectiveRole } = useAuthContext();
  const processingRef = useRef(false);
  const requestToJoin = trpc.myTrainers.requestToJoin.useMutation();

  useEffect(() => {
    if (!isAuthenticated || !profileHydrated || processingRef.current) return;

    let cancelled = false;

    const run = async () => {
      const pending = await getPendingOnboardingContext();
      if (!pending || cancelled) return;

      processingRef.current = true;
      try {
        if (pending.inviteToken) {
          await clearPendingOnboardingContext();
          if (!cancelled) {
            router.replace({
              pathname: "/invite/[token]",
              params: { token: pending.inviteToken },
            } as any);
          }
          return;
        }

        if (
          pending.trainerId &&
          (effectiveRole === "client" || effectiveRole === "shopper")
        ) {
          try {
            await requestToJoin.mutateAsync({
              trainerId: pending.trainerId,
              message: "Requested during registration",
            });
          } catch {
            // Ignore duplicate/validation errors; the next screen still helps user continue.
          }
          await clearPendingOnboardingContext();
          if (!cancelled) {
            router.replace(`/trainer/${pending.trainerId}` as any);
          }
          return;
        }

        await clearPendingOnboardingContext();
      } finally {
        processingRef.current = false;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, profileHydrated, effectiveRole, requestToJoin]);

  return null;
}
