export type ProposalItemType = 'bundle' | 'product' | 'custom_product' | 'service';

export type ProposalCadenceCode = 'weekly' | '2x_week' | '3x_week' | 'daily';

export type ProposalItemInput = {
  itemType: ProposalItemType;
  title: string;
  description?: string | null;
  bundleDraftId?: string | null;
  productId?: string | null;
  customProductId?: string | null;
  imageUrl?: string | null;
  quantity: number;
  unitPrice: number;
  fulfillmentMethod?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ProposalScheduleEntry = {
  index: number;
  startsAt: string;
  label: string;
  timePreference: string | null;
};

export type ProposalDeliveryEntry = {
  title: string;
  itemType: ProposalItemType;
  quantity: number;
  fulfillmentMethod: string | null;
  projectedDate: string | null;
};

export type ProposalPricingSummary = {
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: 'GBP';
};

export type SavedCartProposalSnapshot = {
  title: string | null;
  notes: string | null;
  baseBundleDraftId: string | null;
  startDate: string | null;
  cadenceCode: ProposalCadenceCode;
  sessionsPerWeek: number;
  timePreference: string | null;
  /** Calendar length of the program; projected session count = programWeeks × sessionsPerWeek when set. */
  programWeeks?: number | null;
  /** Optional per-session rate for plan top-up line pricing in the trainer UI. */
  sessionCost?: number | null;
  /** Typical client session length (minutes), for schedule labels. */
  sessionDurationMinutes?: number | null;
  items: ProposalItemInput[];
  projectedSchedule: ProposalScheduleEntry[];
  projectedDeliveries: ProposalDeliveryEntry[];
  pricing: ProposalPricingSummary;
};

export type ProposalDiffSummary = {
  bundleRemoved: boolean;
  addedItems: Array<{ title: string; quantity: number }>;
  removedItems: Array<{ title: string; quantity: number }>;
  quantityChanges: Array<{ title: string; from: number; to: number }>;
  customProductChanges: Array<{ title: string; change: 'added' | 'removed' | 'quantity_changed' }>;
  discountChanged: boolean;
  priceDelta: number;
};

export function normalizeCadenceCode(value: string | null | undefined): ProposalCadenceCode {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\//g, '_');

  if (normalized === 'daily') return 'daily';
  if (normalized === '3x_week' || normalized === '3_times_a_week') return '3x_week';
  if (normalized === '2x_week' || normalized === '2_times_a_week' || normalized === 'twice_weekly') {
    return '2x_week';
  }
  return 'weekly';
}

export function cadenceToSessionsPerWeek(cadenceCode: string | null | undefined): number {
  switch (normalizeCadenceCode(cadenceCode)) {
    case 'daily':
      return 7;
    case '3x_week':
      return 3;
    case '2x_week':
      return 2;
    case 'weekly':
    default:
      return 1;
  }
}

/**
 * Maps discrete days-per-week (1–7) to a stored cadence code. Values 4–6 use `weekly` as the
 * enum label; `sessionsPerWeek` on the proposal remains the source of truth for scheduling.
 */
export function sessionsPerWeekToCadenceCode(sessions: number): ProposalCadenceCode {
  const n = Math.max(1, Math.min(7, Math.floor(Number(sessions))));
  if (!Number.isFinite(n)) return 'weekly';
  if (n >= 7) return 'daily';
  if (n === 3) return '3x_week';
  if (n === 2) return '2x_week';
  return 'weekly';
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Preferred session time from stored `timePreference`:
 * - `HH:mm` (24h) from the plan time picker
 * - legacy: `morning` / `afternoon` / `evening`
 */
export function parseTimePreference(timePreference: string | null | undefined): {
  hour: number;
  minute: number;
} {
  const raw = String(timePreference || '').trim();
  const hm = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const m = parseInt(hm[2], 10);
    if (Number.isFinite(h) && Number.isFinite(m)) {
      return {
        hour: Math.min(23, Math.max(0, h)),
        minute: Math.min(59, Math.max(0, m)),
      };
    }
  }
  const normalized = raw.toLowerCase();
  if (normalized.includes('morning')) return { hour: 9, minute: 0 };
  if (normalized.includes('afternoon')) return { hour: 14, minute: 0 };
  if (normalized.includes('evening')) return { hour: 18, minute: 0 };
  return { hour: 12, minute: 0 };
}

export function formatTimeHHmm(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatSessionDurationLabel(minutes: number | null | undefined): string {
  const m = Math.floor(Number(minutes) || 0);
  if (!Number.isFinite(m) || m <= 0) return '';
  if (m % 60 === 0) {
    const h = m / 60;
    return h === 1 ? '1 hr' : `${h} hrs`;
  }
  return `${m} min`;
}

/** Metadata flag for the auto-added plan coverage service line (cart / proposals). */
export function isPlanSessionTopUpItem(item: {
  metadata?: Record<string, unknown> | null;
}): boolean {
  return Boolean(item.metadata && item.metadata.planSessionTopUp === true);
}

function stripTimeLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getWeekdayIndexMondayFirst(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

export function startOfWeekMonday(date: Date): Date {
  const x = stripTimeLocal(date);
  const idx = getWeekdayIndexMondayFirst(x);
  x.setDate(x.getDate() - idx);
  return x;
}

/**
 * Weekday offsets from Monday: 0 = Mon, 1 = Tue, … — so 5 sessions/week = Mon–Fri.
 */
export function weekdayOffsetsFromMonday(sessionsPerWeek: number): number[] {
  const n = Math.min(7, Math.max(1, Math.floor(Number(sessionsPerWeek))));
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Lay out exactly `totalSessions` occurrences on weekdays, advancing calendar weeks
 * until filled. Skips dates strictly before `startDate` (calendar day).
 */
export function buildWeekdaySessionDates(input: {
  startDate: Date;
  totalSessions: number;
  sessionsPerWeek: number;
  prefHour: number;
  prefMinute: number;
}): Date[] {
  const totalSessions = Math.max(0, Math.floor(input.totalSessions));
  if (totalSessions === 0) return [];

  const sessionsPerWeek = Math.min(7, Math.max(1, Math.floor(input.sessionsPerWeek)));
  const offsets = weekdayOffsetsFromMonday(sessionsPerWeek);
  const startDay = stripTimeLocal(input.startDate);
  const monday = startOfWeekMonday(input.startDate);
  const result: Date[] = [];

  for (let week = 0; result.length < totalSessions; week += 1) {
    for (const off of offsets) {
      if (result.length >= totalSessions) break;
      const d = new Date(monday);
      d.setDate(monday.getDate() + week * 7 + off);
      if (d.getTime() < startDay.getTime()) continue;
      d.setHours(input.prefHour, input.prefMinute, 0, 0);
      result.push(d);
    }
  }
  return result;
}

function getOriginalUnitPrice(item: ProposalItemInput): number {
  const original = Number((item.metadata as Record<string, unknown> | null)?.originalUnitPrice);
  if (Number.isFinite(original) && original > 0) return original;
  return item.unitPrice;
}

export function calculateProposalPricing(items: ProposalItemInput[]): ProposalPricingSummary {
  let subtotalAmount = 0;
  let discountAmount = 0;

  for (const item of items) {
    const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
    const originalUnitPrice = getOriginalUnitPrice(item);
    subtotalAmount += unitPrice * quantity;
    if (originalUnitPrice > unitPrice) {
      discountAmount += (originalUnitPrice - unitPrice) * quantity;
    }
  }

  return {
    subtotalAmount: Number(subtotalAmount.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    totalAmount: Number(subtotalAmount.toFixed(2)),
    currency: 'GBP',
  };
}

export function buildProjectedSchedule(input: {
  startDate: string | Date | null | undefined;
  sessionsPerWeek: number;
  timePreference?: string | null;
  totalSessions: number;
  sessionDurationMinutes?: number | null;
}): ProposalScheduleEntry[] {
  const startDate = toDate(input.startDate);
  if (!startDate) return [];

  const totalSessions = Math.max(0, Math.floor(Number(input.totalSessions) || 0));
  if (totalSessions === 0) return [];

  const sessionsPerWeek = Math.min(
    7,
    Math.max(1, Math.floor(Number(input.sessionsPerWeek) || 1)),
  );
  const { hour: prefHour, minute: prefMinute } = parseTimePreference(input.timePreference);
  const durLabel = formatSessionDurationLabel(input.sessionDurationMinutes);
  const dates = buildWeekdaySessionDates({
    startDate,
    totalSessions,
    sessionsPerWeek,
    prefHour,
    prefMinute,
  });

  return dates.map((sessionDate, i) => ({
    index: i + 1,
    startsAt: sessionDate.toISOString(),
    label: durLabel ? `Session ${i + 1} · ${durLabel}` : `Session ${i + 1}`,
    timePreference: input.timePreference || null,
  }));
}

export function buildProjectedDeliveries(input: {
  startDate: string | Date | null | undefined;
  items: ProposalItemInput[];
}): ProposalDeliveryEntry[] {
  const startDate = toDate(input.startDate);
  const result: ProposalDeliveryEntry[] = [];

  for (const item of input.items) {
    if (item.itemType === 'service') continue;
    const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
    const fulfillmentMethod = item.fulfillmentMethod || null;
    const projectedDate = startDate ? new Date(startDate) : null;

    if (projectedDate && fulfillmentMethod === 'home_ship') {
      projectedDate.setDate(projectedDate.getDate() - 2);
    }

    result.push({
      title: item.title,
      itemType: item.itemType,
      quantity,
      fulfillmentMethod,
      projectedDate: projectedDate ? projectedDate.toISOString() : null,
    });
  }

  return result;
}

export function countProjectedSessions(items: ProposalItemInput[]): number {
  return items.reduce((sum, item) => {
    if (item.itemType === 'bundle') {
      const includedServices = Array.isArray(
        (item.metadata as Record<string, unknown> | null)?.includedServices,
      )
        ? ((item.metadata as Record<string, unknown>).includedServices as Array<Record<string, unknown>>)
        : [];
      const includedSessionCount = includedServices.reduce((serviceSum, service) => {
        const sessions = Number(service.sessions ?? service.quantity ?? service.count ?? 0);
        return serviceSum + (Number.isFinite(sessions) && sessions > 0 ? Math.floor(sessions) : 0);
      }, 0);
      return sum + includedSessionCount * Math.max(1, item.quantity);
    }

    if (item.itemType !== 'service') return sum;
    const sessions = Number((item.metadata as Record<string, unknown> | null)?.sessions);
    if (Number.isFinite(sessions) && sessions > 0) {
      return sum + Math.floor(sessions) * Math.max(1, item.quantity);
    }
    return sum + Math.max(1, item.quantity);
  }, 0);
}

/** Session count from bundle + services, excluding auto plan top-up lines. */
export function countPlanEligibleSessions(items: ProposalItemInput[]): number {
  return countProjectedSessions(items.filter((item) => !isPlanSessionTopUpItem(item)));
}

export function buildSavedCartProposalSnapshot(input: {
  title?: string | null;
  notes?: string | null;
  baseBundleDraftId?: string | null;
  startDate?: string | null;
  cadenceCode?: string | null;
  sessionsPerWeek?: number | null;
  timePreference?: string | null;
  programWeeks?: number | null;
  sessionCost?: number | null;
  sessionDurationMinutes?: number | null;
  items: ProposalItemInput[];
}): SavedCartProposalSnapshot {
  const cadenceCode = normalizeCadenceCode(input.cadenceCode);
  const derivedSessionsPerWeek =
    Number.isFinite(input.sessionsPerWeek) && Number(input.sessionsPerWeek) > 0
      ? Math.floor(Number(input.sessionsPerWeek))
      : cadenceToSessionsPerWeek(cadenceCode);

  const derivedProgramWeeks =
    Number.isFinite(input.programWeeks) && Number(input.programWeeks) > 0
      ? Math.floor(Number(input.programWeeks))
      : null;

  const totalSessionsFromProgram =
    derivedProgramWeeks != null && derivedSessionsPerWeek > 0
      ? derivedProgramWeeks * derivedSessionsPerWeek
      : null;

  const fromItems = countProjectedSessions(input.items);
  const totalSessions =
    totalSessionsFromProgram ??
    (fromItems > 0 ? fromItems : derivedSessionsPerWeek * 4);

  const sessionDurationMinutes =
    Number.isFinite(input.sessionDurationMinutes) && Number(input.sessionDurationMinutes) > 0
      ? Math.floor(Number(input.sessionDurationMinutes))
      : null;

  const projectedSchedule = buildProjectedSchedule({
    startDate: input.startDate,
    sessionsPerWeek: derivedSessionsPerWeek,
    timePreference: input.timePreference || null,
    totalSessions,
    sessionDurationMinutes,
  });
  const projectedDeliveries = buildProjectedDeliveries({
    startDate: input.startDate,
    items: input.items,
  });
  const pricing = calculateProposalPricing(input.items);

  const sessionCost =
    Number.isFinite(input.sessionCost) && Number(input.sessionCost) >= 0
      ? Number(input.sessionCost)
      : null;

  return {
    title: input.title || null,
    notes: input.notes || null,
    baseBundleDraftId: input.baseBundleDraftId || null,
    startDate: input.startDate || null,
    cadenceCode,
    sessionsPerWeek: derivedSessionsPerWeek,
    timePreference: input.timePreference || null,
    programWeeks: derivedProgramWeeks,
    sessionCost,
    sessionDurationMinutes,
    items: input.items,
    projectedSchedule,
    projectedDeliveries,
    pricing,
  };
}

function getComparableKey(item: ProposalItemInput): string {
  if (item.bundleDraftId) return `bundle:${item.bundleDraftId}`;
  if (item.productId) return `product:${item.productId}`;
  if (item.customProductId) return `custom:${item.customProductId}`;
  return `${item.itemType}:${item.title.toLowerCase()}`;
}

export function diffProposalSnapshots(
  originalSnapshot: SavedCartProposalSnapshot,
  finalSnapshot: SavedCartProposalSnapshot,
): ProposalDiffSummary {
  const originalItems = new Map(
    originalSnapshot.items.map((item) => [getComparableKey(item), item]),
  );
  const finalItems = new Map(
    finalSnapshot.items.map((item) => [getComparableKey(item), item]),
  );

  const addedItems: Array<{ title: string; quantity: number }> = [];
  const removedItems: Array<{ title: string; quantity: number }> = [];
  const quantityChanges: Array<{ title: string; from: number; to: number }> = [];
  const customProductChanges: Array<{ title: string; change: 'added' | 'removed' | 'quantity_changed' }> = [];

  for (const [key, originalItem] of originalItems.entries()) {
    const finalItem = finalItems.get(key);
    if (!finalItem) {
      removedItems.push({ title: originalItem.title, quantity: originalItem.quantity });
      if (originalItem.itemType === 'custom_product') {
        customProductChanges.push({ title: originalItem.title, change: 'removed' });
      }
      continue;
    }
    if (originalItem.quantity !== finalItem.quantity) {
      quantityChanges.push({
        title: originalItem.title,
        from: originalItem.quantity,
        to: finalItem.quantity,
      });
      if (originalItem.itemType === 'custom_product') {
        customProductChanges.push({ title: originalItem.title, change: 'quantity_changed' });
      }
    }
  }

  for (const [key, finalItem] of finalItems.entries()) {
    if (originalItems.has(key)) continue;
    addedItems.push({ title: finalItem.title, quantity: finalItem.quantity });
    if (finalItem.itemType === 'custom_product') {
      customProductChanges.push({ title: finalItem.title, change: 'added' });
    }
  }

  return {
    bundleRemoved: Boolean(originalSnapshot.baseBundleDraftId) &&
      originalSnapshot.baseBundleDraftId !== finalSnapshot.baseBundleDraftId,
    addedItems,
    removedItems,
    quantityChanges,
    customProductChanges,
    discountChanged:
      originalSnapshot.pricing.discountAmount !== finalSnapshot.pricing.discountAmount,
    priceDelta: Number(
      (finalSnapshot.pricing.totalAmount - originalSnapshot.pricing.totalAmount).toFixed(2),
    ),
  };
}
