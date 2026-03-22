/**
 * Client row `status` — must match Postgres `client_status` (see supabase migrations, incl. `hidden`).
 */
export const CLIENT_STATUS_VALUES = [
  "pending",
  "active",
  "inactive",
  "removed",
  "hidden",
] as const;

export type ClientRecordStatus = (typeof CLIENT_STATUS_VALUES)[number];
