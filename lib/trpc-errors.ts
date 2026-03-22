import { TRPCClientError } from "@trpc/client";

/** If the server sent a JSON array of Zod issues as the message, show the `message` lines only. */
function formatPossibleZodJsonMessage(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("[")) return raw;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (!Array.isArray(parsed)) return raw;
    const msgs = parsed
      .filter((x): x is { message?: unknown } => x !== null && typeof x === "object")
      .map((x) => (typeof x.message === "string" ? x.message : null))
      .filter((m): m is string => Boolean(m));
    if (msgs.length === 0) return raw;
    return msgs.join("\n");
  } catch {
    return raw;
  }
}

/** Human-readable message from a tRPC mutation failure (Save/Send plan, etc.). */
export function getTrpcMutationMessage(error: unknown, fallback: string): string {
  if (error instanceof TRPCClientError) {
    const msg = error.message?.trim();
    if (msg) return formatPossibleZodJsonMessage(msg);
  }
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message?: unknown }).message ?? "").trim();
    if (msg) return formatPossibleZodJsonMessage(msg);
  }
  return fallback;
}

/**
 * True when the server rejected `status: "hidden"` because the deployed API predates
 * `CLIENT_STATUS_VALUES` including `hidden` (Zod "Invalid option" for client status).
 */
export function isClientStatusHiddenUnsupportedError(error: unknown): boolean {
  const raw = getTrpcMutationMessage(error, "");
  return (
    raw.includes("Invalid option") &&
    raw.includes("pending") &&
    raw.includes("active") &&
    raw.includes("inactive") &&
    raw.includes("removed") &&
    !raw.includes("hidden")
  );
}
