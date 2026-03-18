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

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPreferredHour(timePreference: string | null | undefined): number {
  const normalized = String(timePreference || '').trim().toLowerCase();
  if (normalized.includes('morning')) return 9;
  if (normalized.includes('afternoon')) return 14;
  if (normalized.includes('evening')) return 18;
  return 12;
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
  cadenceCode: string | null | undefined;
  sessionsPerWeek?: number | null;
  timePreference?: string | null;
  totalSessions?: number | null;
}): ProposalScheduleEntry[] {
  const startDate = toDate(input.startDate);
  if (!startDate) return [];

  const totalSessions =
    Number.isFinite(input.totalSessions) && Number(input.totalSessions) > 0
      ? Math.floor(Number(input.totalSessions))
      : cadenceToSessionsPerWeek(input.cadenceCode) * 4;

  const sessionsPerWeek =
    Number.isFinite(input.sessionsPerWeek) && Number(input.sessionsPerWeek) > 0
      ? Math.floor(Number(input.sessionsPerWeek))
      : cadenceToSessionsPerWeek(input.cadenceCode);

  const daySpacing = Math.max(1, Math.round(7 / Math.max(1, sessionsPerWeek)));
  const preferredHour = getPreferredHour(input.timePreference);
  const entries: ProposalScheduleEntry[] = [];

  for (let index = 0; index < totalSessions; index += 1) {
    const sessionDate = new Date(startDate);
    sessionDate.setDate(sessionDate.getDate() + index * daySpacing);
    sessionDate.setHours(preferredHour, 0, 0, 0);

    entries.push({
      index: index + 1,
      startsAt: sessionDate.toISOString(),
      label: `Session ${index + 1}`,
      timePreference: input.timePreference || null,
    });
  }

  return entries;
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

export function buildSavedCartProposalSnapshot(input: {
  title?: string | null;
  notes?: string | null;
  baseBundleDraftId?: string | null;
  startDate?: string | null;
  cadenceCode?: string | null;
  sessionsPerWeek?: number | null;
  timePreference?: string | null;
  items: ProposalItemInput[];
}): SavedCartProposalSnapshot {
  const cadenceCode = normalizeCadenceCode(input.cadenceCode);
  const derivedSessionsPerWeek =
    Number.isFinite(input.sessionsPerWeek) && Number(input.sessionsPerWeek) > 0
      ? Math.floor(Number(input.sessionsPerWeek))
      : cadenceToSessionsPerWeek(cadenceCode);
  const totalSessions = countProjectedSessions(input.items);
  const projectedSchedule = buildProjectedSchedule({
    startDate: input.startDate,
    cadenceCode,
    sessionsPerWeek: derivedSessionsPerWeek,
    timePreference: input.timePreference || null,
    totalSessions: totalSessions || undefined,
  });
  const projectedDeliveries = buildProjectedDeliveries({
    startDate: input.startDate,
    items: input.items,
  });
  const pricing = calculateProposalPricing(input.items);

  return {
    title: input.title || null,
    notes: input.notes || null,
    baseBundleDraftId: input.baseBundleDraftId || null,
    startDate: input.startDate || null,
    cadenceCode,
    sessionsPerWeek: derivedSessionsPerWeek,
    timePreference: input.timePreference || null,
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
