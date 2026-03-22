import { PlanShoppingShell } from "@/components/plan-shopping-shell";
import { useCart } from "@/contexts/cart-context";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";
import { router } from "expo-router";
import { useMemo, type ReactNode } from "react";

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

/** Wraps catalog when trainer is shopping for a client from `/(tabs)/products` (not `/plan-shop`). */
export function PlanShoppingProductsWrap({ children }: { children: ReactNode }) {
  const { proposalContext } = useCart();
  const clientId = proposalContext?.clientRecordId || "";
  const clientName = proposalContext?.clientName || "";
  const displayName = clientName || "Client";

  const clientQuery = trpc.clients.detail.useQuery(
    { id: clientId },
    { enabled: !!clientId },
  );
  const clientPhotoUrl = useMemo(
    () => normalizeAssetUrl((clientQuery.data as any)?.photoUrl || (clientQuery.data as any)?.avatar),
    [clientQuery.data],
  );

  return (
    <PlanShoppingShell
      displayName={displayName}
      clientPhotoUrl={clientPhotoUrl}
      getInitials={getInitials}
      onDone={() => router.push("/(trainer)/cart" as any)}
    >
      {children}
    </PlanShoppingShell>
  );
}
