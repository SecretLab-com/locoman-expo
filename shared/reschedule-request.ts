export const RESCHEDULE_REQUEST_PREFIX = 'reschedule_request_v1:';

export type RescheduleRequestPayload = {
  requestedDate: string | null;
  reason: string | null;
  requestedAt: string | null;
};

export function normalizeRescheduleDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function encodeRescheduleRequest(payload: RescheduleRequestPayload): string {
  return `${RESCHEDULE_REQUEST_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeRescheduleRequest(
  notes: string | null | undefined,
): RescheduleRequestPayload | null {
  if (!notes) return null;

  if (notes.startsWith(RESCHEDULE_REQUEST_PREFIX)) {
    try {
      const raw = JSON.parse(
        notes.slice(RESCHEDULE_REQUEST_PREFIX.length),
      ) as Partial<RescheduleRequestPayload>;

      return {
        requestedDate: normalizeRescheduleDate(raw.requestedDate ?? null),
        reason: raw.reason?.toString().trim() || null,
        requestedAt: normalizeRescheduleDate(raw.requestedAt ?? null),
      };
    } catch {
      return null;
    }
  }

  if (!notes.toLowerCase().includes('reschedule requested')) return null;

  const [, maybeReason] = notes.split(':');
  return {
    requestedDate: null,
    reason: maybeReason?.trim() || null,
    requestedAt: null,
  };
}
