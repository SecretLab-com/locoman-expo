/**
 * Database access layer — Supabase (Postgres).
 *
 * All functions use the server-side Supabase client (service role key, bypasses
 * RLS).  Column names in Postgres are snake_case; we convert to/from camelCase
 * at the boundary so the rest of the app can keep its existing conventions.
 */

import { getServerSupabase } from "../lib/supabase";
import { ENV } from "./_core/env";

// ============================================================================
// HELPERS — snake_case ↔ camelCase
// ============================================================================

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Convert a single DB row (snake_case keys) → app object (camelCase keys) */
function mapFromDb<T = Record<string, any>>(row: Record<string, any> | null | undefined): T | undefined {
  if (!row) return undefined;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    result[snakeToCamel(key)] = value;
  }
  return result as T;
}

/** Convert an array of DB rows → app objects */
function mapRowsFromDb<T = Record<string, any>>(rows: Record<string, any>[]): T[] {
  return rows.map((row) => mapFromDb<T>(row)!);
}

/** Convert an app object (camelCase keys) → DB row (snake_case keys) */
function mapToDb(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[camelToSnake(key)] = value;
    }
  }
  return result;
}

function sanitizeSearchTerm(value: string): string {
  return value
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMetadata(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? { ...(value as Record<string, any>) } : {};
}

type PushTokenRecord = {
  token: string;
  platform: string;
  updatedAt: string;
};

const MAX_PUSH_TOKENS_PER_USER = 8;

function normalizePushTokenRecords(value: unknown): PushTokenRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({
      token: typeof entry.token === "string" ? entry.token : "",
      platform: typeof entry.platform === "string" ? entry.platform : "unknown",
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
    }))
    .filter((entry) => Boolean(entry.token));
}

function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);
}

/** Shorthand for the server Supabase client */
function sb() {
  return getServerSupabase();
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type UserRole = "shopper" | "client" | "trainer" | "manager" | "coordinator";

export type User = {
  id: string;
  authId: string | null;
  openId: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  loginMethod: string | null;
  role: UserRole;
  username: string | null;
  bio: string | null;
  specialties: any;
  socialLinks: any;
  trainerId: string | null;
  active: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
  lastSignedIn: string;
  passwordHash: string | null;
};

export type InsertUser = Partial<Omit<User, "id" | "createdAt" | "updatedAt">> & {
  openId?: string | null;
  role?: UserRole;
};

export type BundleTemplate = {
  id: string;
  title: string;
  description: string | null;
  goalType: string | null;
  goalsJson: any;
  imageUrl: string | null;
  basePrice: string | null;
  minPrice: string | null;
  maxPrice: string | null;
  rulesJson: any;
  defaultServices: any;
  defaultProducts: any;
  active: boolean;
  usageCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertBundleTemplate = Partial<Omit<BundleTemplate, "id" | "createdAt" | "updatedAt">>;

export type BundleDraft = {
  id: string;
  trainerId: string | null;
  templateId: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageSource: string | null;
  price: string | null;
  cadence: string | null;
  selectionsJson: any;
  servicesJson: any;
  productsJson: any;
  goalsJson: any;
  suggestedGoal: string | null;
  status: string;
  shopifyProductId: number | null;
  shopifyVariantId: number | null;
  viewCount: number | null;
  salesCount: number | null;
  totalRevenue: string | null;
  submittedForReviewAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  reviewComments: string | null;
  version: number | null;
  isTemplate: boolean;
  templateVisibility: string[];
  discountType: string | null;
  discountValue: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  templateActive: boolean;
  totalTrainerBonus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertBundleDraft = Partial<Omit<BundleDraft, "id" | "createdAt" | "updatedAt">> & {
  title: string;
};

export type TemplateSettings = {
  templateVisibility?: string[];
  discountType?: string | null;
  discountValue?: string | null;
  availabilityStart?: string | null;
  availabilityEnd?: string | null;
  templateActive?: boolean;
};

export type Product = {
  id: string;
  shopifyProductId: number | null;
  shopifyVariantId: number | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  media: any;
  price: string;
  compareAtPrice: string | null;
  brand: string | null;
  category: string | null;
  phase: string | null;
  fulfillmentOptions: any;
  inventoryQuantity: number | null;
  availability: string | null;
  isApproved: boolean | null;
  trainerBonus: string | null;
  sponsoredBy: string | null;
  bonusExpiresAt: string | null;
  isSponsored: boolean;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Collection = {
  id: string;
  shopifyCollectionId: number;
  title: string;
  handle: string;
  imageUrl: string | null;
  channels: string[];
  shopEnabled: boolean;
  productIds: number[];
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type InsertCollection = Partial<Omit<Collection, "id" | "createdAt" | "updatedAt">> & {
  shopifyCollectionId: number;
  title: string;
  handle: string;
};

export type InsertProduct = Partial<Omit<Product, "id" | "createdAt" | "updatedAt">> & {
  name: string;
  price: string;
  shopifyProductId?: number | null;
};

export type Client = {
  id: string;
  trainerId: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  goals: any;
  notes: string | null;
  status: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertClient = Partial<Omit<Client, "id" | "createdAt" | "updatedAt">> & {
  trainerId: string;
  name: string;
};

export type Subscription = {
  id: string;
  clientId: string;
  trainerId: string;
  bundleDraftId: string | null;
  status: string | null;
  subscriptionType: string | null;
  price: string;
  startDate: string;
  renewalDate: string | null;
  pausedAt: string | null;
  cancelledAt: string | null;
  sessionsIncluded: number | null;
  sessionsUsed: number | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertSubscription = Partial<Omit<Subscription, "id" | "createdAt" | "updatedAt">> & {
  clientId: string;
  trainerId: string;
  price: string;
  startDate: string;
};

export type Session = {
  id: string;
  clientId: string;
  trainerId: string;
  subscriptionId: string | null;
  sessionDate: string;
  durationMinutes: number | null;
  sessionType: string | null;
  location: string | null;
  status: string | null;
  notes: string | null;
  completedAt: string | null;
  googleCalendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertSession = Partial<Omit<Session, "id" | "createdAt" | "updatedAt">> & {
  clientId: string;
  trainerId: string;
  sessionDate: string;
};

export type Order = {
  id: string;
  shopifyOrderId: number | null;
  shopifyOrderNumber: string | null;
  clientId: string | null;
  trainerId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  totalAmount: string;
  subtotalAmount: string | null;
  taxAmount: string | null;
  shippingAmount: string | null;
  status: string | null;
  fulfillmentStatus: string | null;
  paymentStatus: string | null;
  fulfillmentMethod: string | null;
  deliveryDate: string | null;
  deliveredAt: string | null;
  trackingNumber: string | null;
  orderData: any;
  createdAt: string;
  updatedAt: string;
};

export type InsertOrder = Partial<Omit<Order, "id" | "createdAt" | "updatedAt">> & {
  totalAmount: string;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  name: string;
  quantity: number;
  price: string;
  totalPrice: string;
  fulfillmentStatus: string | null;
  createdAt: string;
};

export type InsertOrderItem = Partial<Omit<OrderItem, "id" | "createdAt">> & {
  orderId: string;
  name: string;
  quantity: number;
  price: string;
  totalPrice: string;
};

export type ProductDelivery = {
  id: string;
  orderId: string | null;
  orderItemId: string | null;
  trainerId: string;
  clientId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  status: string | null;
  scheduledDate: string | null;
  deliveredAt: string | null;
  confirmedAt: string | null;
  deliveryMethod: string | null;
  trackingNumber: string | null;
  notes: string | null;
  clientNotes: string | null;
  disputeReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertProductDelivery = Partial<Omit<ProductDelivery, "id" | "createdAt" | "updatedAt">> & {
  trainerId: string;
  clientId: string;
  productName: string;
};

export type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  content: string;
  messageType: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
  attachmentMimeType: string | null;
  readAt: string | null;
  createdAt: string;
};

export type InsertMessage = Partial<Omit<Message, "id" | "createdAt">> & {
  senderId: string;
  receiverId: string;
  conversationId: string;
  content: string;
};

export type MessageReaction = {
  id: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: string;
};

export type InsertMessageReaction = {
  messageId: string;
  userId: string;
  reaction: string;
};

export type CalendarEvent = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  eventType: string | null;
  relatedClientId: string | null;
  relatedOrderId: string | null;
  reminderSent: boolean | null;
  googleCalendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RescheduleRequest = {
  id: string;
  sessionId: string;
  trainerId: string;
  clientId: string;
  originalDate: string;
  proposedDate: string;
  proposedDuration: number | null;
  proposedLocation: string | null;
  source: string | null;
  status: string;
  counterDate: string | null;
  note: string | null;
  responseNote: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertRescheduleRequest = Partial<Omit<RescheduleRequest, "id" | "createdAt" | "updatedAt">> & {
  sessionId: string;
  trainerId: string;
  clientId: string;
  originalDate: string;
  proposedDate: string;
};

export type InsertCalendarEvent = Partial<Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">> & {
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
};

export type TrainerEarning = {
  id: string;
  trainerId: string;
  orderId: string | null;
  bundleDraftId: string | null;
  subscriptionId: string | null;
  earningType: string | null;
  amount: string;
  status: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertTrainerEarning = Partial<Omit<TrainerEarning, "id" | "createdAt" | "updatedAt">> & {
  trainerId: string;
  amount: string;
};

export type PartnershipStatus = "pending" | "active" | "rejected" | "expired";

export type PartnershipBusinessStatus = "available" | "submitted" | "inactive";

export type PartnershipBusiness = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  commissionRate: number | null;
  website: string | null;
  contactEmail: string | null;
  isAvailable: boolean | null;
  status: PartnershipBusinessStatus | string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertPartnershipBusiness = Partial<Omit<PartnershipBusiness, "id" | "createdAt" | "updatedAt">> & {
  name: string;
  type: string;
};

export type TrainerPartnership = {
  id: string;
  trainerId: string;
  businessId: string;
  status: PartnershipStatus | string | null;
  commissionRate: number | null;
  totalEarnings: string | null;
  clickCount: number | null;
  conversionCount: number | null;
  expiresAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertTrainerPartnership = Partial<Omit<TrainerPartnership, "id" | "createdAt" | "updatedAt">> & {
  trainerId: string;
  businessId: string;
};

export type TrainerPartnershipWithBusiness = TrainerPartnership & {
  businessName: string;
  businessType: string;
  description: string | null;
};

export type ActivityLog = {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type InsertActivityLog = Partial<Omit<ActivityLog, "id" | "createdAt">> & {
  action: string;
};

export type Invitation = {
  id: string;
  trainerId: string;
  email: string;
  name: string | null;
  token: string;
  bundleDraftId: string | null;
  status: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  createdAt: string;
};

export type InsertInvitation = Partial<Omit<Invitation, "id" | "createdAt">> & {
  trainerId: string;
  email: string;
  token: string;
  expiresAt: string;
};

export type UserInvitation = {
  id: string;
  invitedBy: string;
  email: string;
  name: string | null;
  role: UserRole;
  token: string;
  status: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  createdAt: string;
};

export type InsertUserInvitation = Partial<Omit<UserInvitation, "id" | "createdAt">> & {
  invitedBy: string;
  email: string;
  token: string;
  expiresAt: string;
  role: UserRole;
};

export type UserActivityLog = {
  id: string;
  targetUserId: string;
  performedBy: string;
  action: string;
  previousValue: string | null;
  newValue: string | null;
  notes: string | null;
  createdAt: string;
};

export type InsertUserActivityLog = Partial<Omit<UserActivityLog, "id" | "createdAt">> & {
  targetUserId: string;
  performedBy: string;
  action: string;
};

export type PaymentSession = {
  id: string;
  adyenSessionId: string | null;
  adyenSessionData: string | null;
  merchantReference: string;
  requestedBy: string;
  payerId: string | null;
  amountMinor: number;
  currency: string;
  description: string | null;
  method: string | null;
  status: string;
  pspReference: string | null;
  orderId: string | null;
  subscriptionId: string | null;
  paymentLink: string | null;
  metadata: any;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InsertPaymentSession = Partial<Omit<PaymentSession, "id" | "createdAt" | "updatedAt">> & {
  merchantReference: string;
  requestedBy: string;
  amountMinor: number;
};

export type PaymentLog = {
  id: string;
  paymentSessionId: string | null;
  pspReference: string | null;
  merchantReference: string | null;
  eventCode: string;
  success: boolean;
  amountMinor: number | null;
  currency: string | null;
  paymentMethod: string | null;
  rawPayload: any;
  reason: string | null;
  createdAt: string;
};

export type InsertPaymentLog = Partial<Omit<PaymentLog, "id" | "createdAt">> & {
  eventCode: string;
};

// ============================================================================
// LEGACY COMPAT — getDb() returns true if Supabase is configured
// ============================================================================

export async function getDb(): Promise<boolean> {
  try {
    sb();
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  try {
    const dbData = mapToDb({
      openId: user.openId,
      ...(user.name !== undefined && { name: user.name ?? null }),
      ...(user.email !== undefined && { email: user.email ?? null }),
      ...(user.phone !== undefined && { phone: user.phone ?? null }),
      ...(user.photoUrl !== undefined && { photoUrl: user.photoUrl ?? null }),
      ...(user.loginMethod !== undefined && { loginMethod: user.loginMethod ?? null }),
      ...(user.authId !== undefined && { authId: user.authId }),
      lastSignedIn: user.lastSignedIn ?? new Date().toISOString(),
    });

    // Set role
    if (user.role !== undefined) {
      dbData.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      dbData.role = "coordinator";
    }

    const { error } = await sb()
      .from("users")
      .upsert(dbData, { onConflict: "open_id" });
    if (error) throw error;
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByAuthId(authId: string): Promise<User | undefined> {
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .eq("auth_id", authId)
    .limit(1)
    .maybeSingle();
  if (error) { console.error("[Database] getUserByAuthId:", error.message); return undefined; }
  return mapFromDb<User>(data);
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .eq("open_id", openId)
    .limit(1)
    .maybeSingle();
  if (error) { console.error("[Database] getUserByOpenId:", error.message); return undefined; }
  return mapFromDb<User>(data);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error) { console.error("[Database] getUserByEmail:", error.message); return undefined; }
  return mapFromDb<User>(data);
}

export async function getUserById(id: string): Promise<User | undefined> {
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error) { console.error("[Database] getUserById:", error.message); return undefined; }
  return mapFromDb<User>(data);
}

export async function updateUserRole(userId: string, role: UserRole) {
  const { error } = await sb().from("users").update({ role }).eq("id", userId);
  if (error) { console.error("[Database] updateUserRole:", error.message); throw error; }
}

export async function updateUser(userId: string, data: Partial<InsertUser>) {
  const { error } = await sb().from("users").update(mapToDb(data)).eq("id", userId);
  if (error) { console.error("[Database] updateUser:", error.message); throw error; }
}

export async function upsertUserPushToken(
  userId: string,
  token: string,
  platform: "ios" | "android" | "unknown" = "unknown"
) {
  const normalizedToken = token.trim();
  if (!normalizedToken || !isExpoPushToken(normalizedToken)) {
    throw new Error("Invalid Expo push token");
  }

  const { data: row, error: fetchError } = await sb()
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();
  if (fetchError) {
    console.error("[Database] upsertUserPushToken fetch:", fetchError.message);
    throw fetchError;
  }

  const metadata = normalizeMetadata(row?.metadata);
  const pushMeta = normalizeMetadata(metadata.push);
  const existingTokens = normalizePushTokenRecords(pushMeta.expoTokens);
  const now = new Date().toISOString();

  const nextTokens: PushTokenRecord[] = [
    { token: normalizedToken, platform, updatedAt: now },
    ...existingTokens.filter((entry) => entry.token !== normalizedToken),
  ].slice(0, MAX_PUSH_TOKENS_PER_USER);

  const nextMetadata = {
    ...metadata,
    push: {
      ...pushMeta,
      expoTokens: nextTokens,
      updatedAt: now,
    },
  };

  const { error: updateError } = await sb()
    .from("users")
    .update({ metadata: nextMetadata })
    .eq("id", userId);
  if (updateError) {
    console.error("[Database] upsertUserPushToken update:", updateError.message);
    throw updateError;
  }
}

export async function removeUserPushToken(userId: string, token: string) {
  const normalizedToken = token.trim();
  if (!normalizedToken) return;

  const { data: row, error: fetchError } = await sb()
    .from("users")
    .select("metadata")
    .eq("id", userId)
    .maybeSingle();
  if (fetchError) {
    console.error("[Database] removeUserPushToken fetch:", fetchError.message);
    return;
  }

  const metadata = normalizeMetadata(row?.metadata);
  const pushMeta = normalizeMetadata(metadata.push);
  const existingTokens = normalizePushTokenRecords(pushMeta.expoTokens);
  const nextTokens = existingTokens.filter((entry) => entry.token !== normalizedToken);
  if (nextTokens.length === existingTokens.length) return;

  const nextMetadata = {
    ...metadata,
    push: {
      ...pushMeta,
      expoTokens: nextTokens,
      updatedAt: new Date().toISOString(),
    },
  };

  const { error: updateError } = await sb()
    .from("users")
    .update({ metadata: nextMetadata })
    .eq("id", userId);
  if (updateError) {
    console.error("[Database] removeUserPushToken update:", updateError.message);
  }
}

export async function getExpoPushTokensForUserIds(userIds: string[]): Promise<Map<string, string[]>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await sb()
    .from("users")
    .select("id, metadata")
    .in("id", ids);
  if (error) {
    console.error("[Database] getExpoPushTokensForUserIds:", error.message);
    return new Map();
  }

  const tokenMap = new Map<string, string[]>();
  for (const user of data || []) {
    const metadata = normalizeMetadata(user.metadata);
    const pushMeta = normalizeMetadata(metadata.push);
    const tokenRecords = normalizePushTokenRecords(pushMeta.expoTokens);
    const validTokens = Array.from(
      new Set(tokenRecords.map((entry) => entry.token).filter((entry) => isExpoPushToken(entry)))
    );
    tokenMap.set(user.id, validTokens);
  }
  return tokenMap;
}

export async function getTrainers(): Promise<User[]> {
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .eq("role", "trainer")
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getTrainers:", error.message); return []; }
  return mapRowsFromDb<User>(data || []);
}

export async function getAllUsers(limit = 100, offset = 0): Promise<User[]> {
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) { console.error("[Database] getAllUsers:", error.message); return []; }
  return mapRowsFromDb<User>(data || []);
}

export async function getUsersWithFilters(options: {
  limit?: number;
  offset?: number;
  role?: string;
  status?: "active" | "inactive";
  search?: string;
  joinedAfter?: Date;
  joinedBefore?: Date;
}): Promise<{ users: User[]; total: number }> {
  const { limit = 20, offset = 0, role, status, search, joinedAfter, joinedBefore } = options;

  let query = sb().from("users").select("*", { count: "exact" });

  if (role && role !== "all") {
    query = query.eq("role", role);
  }
  if (status === "active") {
    query = query.eq("active", true);
  } else if (status === "inactive") {
    query = query.eq("active", false);
  }
  if (search) {
    const term = sanitizeSearchTerm(search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
    }
  }
  if (joinedAfter) {
    query = query.gte("created_at", joinedAfter.toISOString());
  }
  if (joinedBefore) {
    query = query.lte("created_at", joinedBefore.toISOString());
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { console.error("[Database] getUsersWithFilters:", error.message); return { users: [], total: 0 }; }
  return { users: mapRowsFromDb<User>(data || []), total: count ?? 0 };
}

export async function updateUserStatus(userId: string, active: boolean) {
  const { error } = await sb().from("users").update({ active }).eq("id", userId);
  if (error) { console.error("[Database] updateUserStatus:", error.message); throw error; }
}

export async function bulkUpdateUserRole(userIds: string[], role: UserRole) {
  const { error } = await sb().from("users").update({ role }).in("id", userIds);
  if (error) { console.error("[Database] bulkUpdateUserRole:", error.message); throw error; }
}

export async function bulkUpdateUserStatus(userIds: string[], active: boolean) {
  const { error } = await sb().from("users").update({ active }).in("id", userIds);
  if (error) { console.error("[Database] bulkUpdateUserStatus:", error.message); throw error; }
}

export async function searchUsers(query: string): Promise<User[]> {
  const term = sanitizeSearchTerm(query);
  if (!term) return [];
  const { data, error } = await sb()
    .from("users")
    .select("*")
    .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
    .limit(50);
  if (error) { console.error("[Database] searchUsers:", error.message); return []; }
  return mapRowsFromDb<User>(data || []);
}

// ============================================================================
// BUNDLE TEMPLATES
// ============================================================================

export async function getBundleTemplates(): Promise<BundleTemplate[]> {
  const { data, error } = await sb()
    .from("bundle_templates")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getBundleTemplates:", error.message); return []; }
  return mapRowsFromDb<BundleTemplate>(data || []);
}

export async function getAllBundleTemplates(): Promise<BundleTemplate[]> {
  const { data, error } = await sb()
    .from("bundle_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getAllBundleTemplates:", error.message); return []; }
  return mapRowsFromDb<BundleTemplate>(data || []);
}

export async function getBundleTemplateById(id: string): Promise<BundleTemplate | undefined> {
  const { data, error } = await sb()
    .from("bundle_templates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getBundleTemplateById:", error.message); return undefined; }
  return mapFromDb<BundleTemplate>(data);
}

export async function createBundleTemplate(data: InsertBundleTemplate): Promise<string> {
  const { data: row, error } = await sb()
    .from("bundle_templates")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateBundleTemplate(id: string, data: Partial<InsertBundleTemplate>) {
  const { error } = await sb()
    .from("bundle_templates")
    .update(mapToDb(data))
    .eq("id", id);
  if (error) { console.error("[Database] updateBundleTemplate:", error.message); throw error; }
}

export async function deleteBundleTemplate(id: string) {
  const { error } = await sb()
    .from("bundle_templates")
    .delete()
    .eq("id", id);
  if (error) { console.error("[Database] deleteBundleTemplate:", error.message); throw error; }
}

export async function incrementTemplateUsage(templateId: string) {
  const { error } = await sb().rpc("increment_template_usage", { template_id: templateId });
  if (error) { console.error("[Database] incrementTemplateUsage:", error.message); }
}

// ============================================================================
// BUNDLE DRAFTS
// ============================================================================

export async function getBundleDraftsByTrainer(trainerId: string): Promise<BundleDraft[]> {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[Database] getBundleDraftsByTrainer:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

export async function getBundleDraftById(id: string): Promise<BundleDraft | undefined> {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getBundleDraftById:", error.message); return undefined; }
  return mapFromDb<BundleDraft>(data);
}

export async function createBundleDraft(data: InsertBundleDraft): Promise<string> {
  const { data: row, error } = await sb()
    .from("bundle_drafts")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateBundleDraft(id: string, data: Partial<InsertBundleDraft>) {
  const { error } = await sb().from("bundle_drafts").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateBundleDraft:", error.message); throw error; }
}

export async function deleteBundleDraft(id: string) {
  const { error } = await sb().from("bundle_drafts").delete().eq("id", id);
  if (error) { console.error("[Database] deleteBundleDraft:", error.message); throw error; }
}

export async function upsertBundleFromShopify(data: {
  shopifyProductId: number;
  shopifyVariantId?: number;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  price?: string;
}) {
  const dbData: Record<string, any> = {
    title: data.title,
    description: data.description,
    image_url: data.imageUrl,
    price: data.price,
    shopify_product_id: data.shopifyProductId,
    shopify_variant_id: data.shopifyVariantId,
    status: "published",
  };

  const { error } = await sb()
    .from("bundle_drafts")
    .upsert(dbData, { onConflict: "shopify_product_id" });
  if (error) { console.error("[Database] upsertBundleFromShopify:", error.message); throw error; }
}

export async function getPublishedBundles(): Promise<BundleDraft[]> {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .eq("status", "published")
    .not("shopify_product_id", "is", null)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[Database] getPublishedBundles:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

// ============================================================================
// PROMOTED TEMPLATES (bundles promoted to templates)
// ============================================================================

export async function getBundleDraftsByCreator(userId: string): Promise<BundleDraft[]> {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .eq("trainer_id", userId)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[Database] getBundleDraftsByCreator:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

export async function getAdminBundles(): Promise<BundleDraft[]> {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .is("trainer_id", null)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[Database] getAdminBundles:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

export async function getNonTemplateBundles(): Promise<BundleDraft[]> {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .or("is_template.is.null,is_template.eq.false")
    .is("trainer_id", null)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[Database] getNonTemplateBundles:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

export async function getPromotedTemplates(): Promise<BundleDraft[]> {
  const now = new Date().toISOString();
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .eq("is_template", true)
    .eq("template_active", true)
    .or(`availability_start.is.null,availability_start.lte.${now}`)
    .or(`availability_end.is.null,availability_end.gte.${now}`)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[Database] getPromotedTemplates:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

export async function getAllPromotedTemplates(): Promise<BundleDraft[]> {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .eq("is_template", true)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[Database] getAllPromotedTemplates:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

export async function promoteBundleToTemplate(bundleId: string, settings: TemplateSettings) {
  const { error } = await sb()
    .from("bundle_drafts")
    .update(mapToDb({
      isTemplate: true,
      templateActive: true,
      ...settings,
    }))
    .eq("id", bundleId);
  if (error) { console.error("[Database] promoteBundleToTemplate:", error.message); throw error; }
}

export async function updateTemplateSettings(bundleId: string, settings: TemplateSettings) {
  const { error } = await sb()
    .from("bundle_drafts")
    .update(mapToDb(settings))
    .eq("id", bundleId)
    .eq("is_template", true);
  if (error) { console.error("[Database] updateTemplateSettings:", error.message); throw error; }
}

export async function demoteTemplate(bundleId: string) {
  const { error } = await sb()
    .from("bundle_drafts")
    .update({
      is_template: false,
      template_active: false,
      template_visibility: [],
      discount_type: null,
      discount_value: null,
      availability_start: null,
      availability_end: null,
    })
    .eq("id", bundleId);
  if (error) { console.error("[Database] demoteTemplate:", error.message); throw error; }
}

export async function getPublishedBundlesByTrainerIds(trainerIds: string[]): Promise<BundleDraft[]> {
  if (!Array.isArray(trainerIds) || trainerIds.length === 0) return [];
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .eq("status", "published")
    .not("shopify_product_id", "is", null)
    .in("trainer_id", trainerIds)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[Database] getPublishedBundlesByTrainerIds:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

export async function getPendingReviewBundles(): Promise<BundleDraft[]> {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("*")
    .eq("status", "pending_review")
    .order("submitted_for_review_at", { ascending: true });
  if (error) { console.error("[Database] getPendingReviewBundles:", error.message); return []; }
  return mapRowsFromDb<BundleDraft>(data || []);
}

// ============================================================================
// PRODUCTS
// ============================================================================

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await sb()
    .from("products")
    .select("*")
    .eq("availability", "available")
    .order("name", { ascending: true });
  if (error) { console.error("[Database] getProducts:", error.message); return []; }
  return mapRowsFromDb<Product>(data || []);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const { data, error } = await sb()
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getProductById:", error.message); return undefined; }
  return mapFromDb<Product>(data);
}

export async function getProductByShopifyProductId(shopifyProductId: number): Promise<Product | undefined> {
  const { data, error } = await sb()
    .from("products")
    .select("*")
    .eq("shopify_product_id", shopifyProductId)
    .maybeSingle();
  if (error) { console.error("[Database] getProductByShopifyProductId:", error.message); return undefined; }
  return mapFromDb<Product>(data);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const term = sanitizeSearchTerm(query);
  if (!term) return [];
  const { data, error } = await sb()
    .from("products")
    .select("*")
    .eq("availability", "available")
    .or(`name.ilike.%${term}%,brand.ilike.%${term}%`)
    .limit(50);
  if (error) { console.error("[Database] searchProducts:", error.message); return []; }
  return mapRowsFromDb<Product>(data || []);
}

export async function upsertProduct(data: InsertProduct) {
  const dbData = mapToDb(data);

  if (data.shopifyProductId) {
    const { error } = await sb()
      .from("products")
      .upsert(dbData, { onConflict: "shopify_product_id" });
    if (error) { console.error("[Database] upsertProduct:", error.message); throw error; }
  } else {
    const { error } = await sb().from("products").insert(dbData);
    if (error) { console.error("[Database] upsertProduct:", error.message); throw error; }
  }
}

// ============================================================================
// COLLECTIONS (synced from Shopify)
// ============================================================================

export async function getCollections(shopEnabledOnly = true): Promise<Collection[]> {
  let query = sb().from("collections").select("*").order("title", { ascending: true });
  if (shopEnabledOnly) query = query.eq("shop_enabled", true);
  const { data, error } = await query;
  if (error) { console.error("[Database] getCollections:", error.message); return []; }
  return mapRowsFromDb<Collection>(data || []);
}

export async function upsertCollection(data: InsertCollection) {
  const dbData = mapToDb(data);
  const { error } = await sb()
    .from("collections")
    .upsert(dbData, { onConflict: "shopify_collection_id" });
  if (error) { console.error("[Database] upsertCollection:", error.message); throw error; }
}

export async function deleteStaleCollections(activeShopifyIds: number[]) {
  if (activeShopifyIds.length === 0) return;
  const { error } = await sb()
    .from("collections")
    .delete()
    .not("shopify_collection_id", "in", `(${activeShopifyIds.join(",")})`);
  if (error) { console.error("[Database] deleteStaleCollections:", error.message); }
}

// ============================================================================
// CLIENTS
// ============================================================================

export async function getClientsByTrainer(trainerId: string): Promise<Client[]> {
  const { data, error } = await sb()
    .from("clients")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getClientsByTrainer:", error.message); return []; }
  return mapRowsFromDb<Client>(data || []);
}

export async function getClientById(id: string): Promise<Client | undefined> {
  const { data, error } = await sb()
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getClientById:", error.message); return undefined; }
  return mapFromDb<Client>(data);
}

export async function createClient(data: InsertClient): Promise<string> {
  const { data: row, error } = await sb()
    .from("clients")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateClient(id: string, data: Partial<InsertClient>) {
  const { error } = await sb().from("clients").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateClient:", error.message); throw error; }
}

export async function getActiveBundlesCountForClient(clientId: string): Promise<number> {
  const { count, error } = await sb()
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "active");
  if (error) { console.error("[Database] getActiveBundlesCountForClient:", error.message); return 0; }
  return count ?? 0;
}

export async function getTotalSpentByClient(clientId: string): Promise<number> {
  const { data, error } = await sb().rpc("get_total_spent", { p_client_id: clientId });
  if (error) { console.error("[Database] getTotalSpentByClient:", error.message); return 0; }
  return parseFloat(data) || 0;
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export async function getSubscriptionsByClient(clientId: string): Promise<Subscription[]> {
  const { data, error } = await sb()
    .from("subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getSubscriptionsByClient:", error.message); return []; }
  return mapRowsFromDb<Subscription>(data || []);
}

export async function getSubscriptionsByTrainer(trainerId: string): Promise<Subscription[]> {
  const { data, error } = await sb()
    .from("subscriptions")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getSubscriptionsByTrainer:", error.message); return []; }
  return mapRowsFromDb<Subscription>(data || []);
}

export async function getSubscriptionById(id: string): Promise<Subscription | undefined> {
  const { data, error } = await sb()
    .from("subscriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getSubscriptionById:", error.message); return undefined; }
  return mapFromDb<Subscription>(data);
}

export async function getActiveSubscription(clientId: string): Promise<Subscription | undefined> {
  const { data, error } = await sb()
    .from("subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) { console.error("[Database] getActiveSubscription:", error.message); return undefined; }
  return mapFromDb<Subscription>(data);
}

export async function createSubscription(data: InsertSubscription): Promise<string> {
  const { data: row, error } = await sb()
    .from("subscriptions")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateSubscription(id: string, data: Partial<InsertSubscription>) {
  const { error } = await sb().from("subscriptions").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateSubscription:", error.message); throw error; }
}

export async function incrementSessionsUsed(subscriptionId: string) {
  const { error } = await sb().rpc("increment_sessions_used", { sub_id: subscriptionId });
  if (error) { console.error("[Database] incrementSessionsUsed:", error.message); throw error; }
}

// ============================================================================
// SESSIONS (Training sessions — table: training_sessions)
// ============================================================================

export async function getSessionsByClient(clientId: string): Promise<Session[]> {
  const { data, error } = await sb()
    .from("training_sessions")
    .select("*")
    .eq("client_id", clientId)
    .order("session_date", { ascending: false });
  if (error) { console.error("[Database] getSessionsByClient:", error.message); return []; }
  return mapRowsFromDb<Session>(data || []);
}

export async function getSessionsByTrainer(trainerId: string): Promise<Session[]> {
  const { data, error } = await sb()
    .from("training_sessions")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("session_date", { ascending: false });
  if (error) { console.error("[Database] getSessionsByTrainer:", error.message); return []; }
  return mapRowsFromDb<Session>(data || []);
}

export async function getUpcomingSessions(trainerId: string): Promise<Session[]> {
  const { data, error } = await sb()
    .from("training_sessions")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("status", "scheduled")
    .order("session_date", { ascending: true })
    .limit(10);
  if (error) { console.error("[Database] getUpcomingSessions:", error.message); return []; }
  return mapRowsFromDb<Session>(data || []);
}

export async function getSessionById(id: string): Promise<Session | undefined> {
  const { data, error } = await sb()
    .from("training_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getSessionById:", error.message); return undefined; }
  return mapFromDb<Session>(data);
}

export async function createSession(data: InsertSession): Promise<string> {
  const { data: row, error } = await sb()
    .from("training_sessions")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateSession(id: string, data: Partial<InsertSession>) {
  const { error } = await sb().from("training_sessions").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateSession:", error.message); throw error; }
}

export async function completeSession(sessionId: string) {
  const { error } = await sb().rpc("complete_session", { session_id: sessionId });
  if (error) { console.error("[Database] completeSession:", error.message); throw error; }
}

// ============================================================================
// ORDERS
// ============================================================================

export async function getOrdersByClient(clientId: string): Promise<Order[]> {
  const { data, error } = await sb()
    .from("orders")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getOrdersByClient:", error.message); return []; }
  return mapRowsFromDb<Order>(data || []);
}

export async function getOrdersByTrainer(trainerId: string): Promise<Order[]> {
  const { data, error } = await sb()
    .from("orders")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getOrdersByTrainer:", error.message); return []; }
  return mapRowsFromDb<Order>(data || []);
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const { data, error } = await sb()
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getOrderById:", error.message); return undefined; }
  return mapFromDb<Order>(data);
}

export async function createOrder(data: InsertOrder): Promise<string> {
  const { data: row, error } = await sb()
    .from("orders")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateOrder(id: string, data: Partial<InsertOrder>) {
  const { error } = await sb().from("orders").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateOrder:", error.message); throw error; }
}

// ============================================================================
// ORDER ITEMS
// ============================================================================

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await sb()
    .from("order_items")
    .select("*")
    .eq("order_id", orderId);
  if (error) { console.error("[Database] getOrderItems:", error.message); return []; }
  return mapRowsFromDb<OrderItem>(data || []);
}

export async function createOrderItem(data: InsertOrderItem): Promise<string> {
  const { data: row, error } = await sb()
    .from("order_items")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

// ============================================================================
// PRODUCT DELIVERIES
// ============================================================================

export async function getDeliveriesByClient(clientId: string): Promise<ProductDelivery[]> {
  const { data, error } = await sb()
    .from("product_deliveries")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getDeliveriesByClient:", error.message); return []; }
  return mapRowsFromDb<ProductDelivery>(data || []);
}

export async function getDeliveriesByTrainer(trainerId: string): Promise<ProductDelivery[]> {
  const { data, error } = await sb()
    .from("product_deliveries")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getDeliveriesByTrainer:", error.message); return []; }
  return mapRowsFromDb<ProductDelivery>(data || []);
}

export async function getPendingDeliveries(trainerId: string): Promise<ProductDelivery[]> {
  const { data, error } = await sb()
    .from("product_deliveries")
    .select("*")
    .eq("trainer_id", trainerId)
    .in("status", ["pending", "ready", "scheduled", "out_for_delivery"])
    .order("scheduled_date", { ascending: true });
  if (error) { console.error("[Database] getPendingDeliveries:", error.message); return []; }
  return mapRowsFromDb<ProductDelivery>(data || []);
}

export async function getAllDeliveries(options?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ deliveries: (ProductDelivery & {
  trainerName: string | null;
  clientName: string | null;
})[]; total: number }> {
  const { status, search, limit = 100, offset = 0 } = options || {};

  let query = sb().from("product_deliveries").select("*", { count: "exact" });
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[Database] getAllDeliveries:", error.message);
    return { deliveries: [], total: 0 };
  }

  const deliveries = mapRowsFromDb<ProductDelivery>(data || []);
  if (!deliveries.length) {
    return { deliveries: [], total: 0 };
  }

  const userIds = Array.from(
    new Set(
      deliveries.flatMap((d) => [d.trainerId, d.clientId].filter((id): id is string => Boolean(id)))
    )
  );

  const userNameById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await sb()
      .from("users")
      .select("id, name")
      .in("id", userIds);
    if (usersError) {
      console.error("[Database] getAllDeliveries users:", usersError.message);
    } else {
      for (const user of users || []) {
        userNameById.set(user.id, user.name ?? null);
      }
    }
  }

  const enriched = deliveries.map((delivery) => ({
    ...delivery,
    trainerName: userNameById.get(delivery.trainerId) ?? null,
    clientName: userNameById.get(delivery.clientId) ?? null,
  }));

  if (!search?.trim()) {
    return { deliveries: enriched, total: count ?? enriched.length };
  }

  const term = search.trim().toLowerCase();
  const filtered = enriched.filter((delivery) =>
    (delivery.productName || "").toLowerCase().includes(term) ||
    (delivery.deliveryMethod || "").toLowerCase().includes(term) ||
    (delivery.trainerName || "").toLowerCase().includes(term) ||
    (delivery.clientName || "").toLowerCase().includes(term)
  );

  return { deliveries: filtered, total: filtered.length };
}

export async function getDeliveryById(id: string): Promise<ProductDelivery | null> {
  const { data, error } = await sb()
    .from("product_deliveries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getDeliveryById:", error.message); return null; }
  return mapFromDb<ProductDelivery>(data) ?? null;
}

export async function createDelivery(data: InsertProductDelivery): Promise<string> {
  const { data: row, error } = await sb()
    .from("product_deliveries")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateDelivery(id: string, data: Partial<InsertProductDelivery>) {
  const { error } = await sb().from("product_deliveries").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateDelivery:", error.message); throw error; }
}

export async function markDeliveryReady(id: string) {
  const { error } = await sb().from("product_deliveries").update({ status: "ready" }).eq("id", id);
  if (error) { console.error("[Database] markDeliveryReady:", error.message); throw error; }
}

export async function markDeliveryDelivered(id: string) {
  const { error } = await sb()
    .from("product_deliveries")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("[Database] markDeliveryDelivered:", error.message); throw error; }
}

export async function confirmDeliveryReceipt(id: string) {
  const { error } = await sb()
    .from("product_deliveries")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("[Database] confirmDeliveryReceipt:", error.message); throw error; }
}

export async function getUserIdsByRoles(roles: UserRole[]): Promise<string[]> {
  const { data, error } = await sb()
    .from("users")
    .select("id")
    .in("role", roles);
  if (error) { console.error("[Database] getUserIdsByRoles:", error.message); return []; }
  return (data || []).map((row) => row.id);
}

// ============================================================================
// MESSAGES
// ============================================================================

export async function getConversations(userId: string): Promise<string[]> {
  const { data: sent, error: sentError } = await sb()
    .from("messages")
    .select("conversation_id")
    .eq("sender_id", userId);
  if (sentError) { console.error("[Database] getConversations:", sentError.message); }
  const { data: received, error: recvError } = await sb()
    .from("messages")
    .select("conversation_id")
    .eq("receiver_id", userId);
  if (recvError) { console.error("[Database] getConversations:", recvError.message); }
  const allIds = new Set([
    ...(sent || []).map((m) => m.conversation_id),
    ...(received || []).map((m) => m.conversation_id),
  ]);
  return Array.from(allIds);
}

export async function getConversationSummaries(userId: string) {
  const { data: rows, error } = await sb()
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[Database] getConversationSummaries:", error.message);
    return [];
  }
  const messages = mapRowsFromDb<Message>((rows || []) as Record<string, any>[]);
  if (!messages.length) return [];

  const byConversation = new Map<string, Message[]>();
  for (const message of messages) {
    const list = byConversation.get(message.conversationId) || [];
    list.push(message);
    byConversation.set(message.conversationId, list);
  }

  const otherUserIds = new Set<string>();
  byConversation.forEach((conversationMessages) => {
    for (const message of conversationMessages) {
      if (message.senderId !== userId) otherUserIds.add(message.senderId);
      if (message.receiverId !== userId) otherUserIds.add(message.receiverId);
    }
  });

  const otherUsersById = new Map<string, User>();
  if (otherUserIds.size > 0) {
    const { data: usersRows, error: usersError } = await sb()
      .from("users")
      .select("*")
      .in("id", Array.from(otherUserIds));
    if (usersError) {
      console.error("[Database] getConversationSummaries users:", usersError.message);
    } else {
      const users = mapRowsFromDb<User>((usersRows || []) as Record<string, any>[]);
      for (const user of users) {
        otherUsersById.set(user.id, user);
      }
    }
  }

  const summaries = Array.from(byConversation.entries()).map(([conversationId, conversationMessages]) => {
    const lastMessage = conversationMessages[0];
    const unreadCount = conversationMessages.filter(
      (message) => message.receiverId === userId && !message.readAt
    ).length;

    const participantIds = new Set<string>();
    for (const message of conversationMessages) {
      if (message.senderId !== userId) participantIds.add(message.senderId);
      if (message.receiverId !== userId) participantIds.add(message.receiverId);
    }
    const participants = Array.from(participantIds)
      .map((id) => otherUsersById.get(id))
      .filter(Boolean)
      .map((u) => ({
        id: u!.id,
        name: u!.name || u!.email || "Unknown",
        photoUrl: u!.photoUrl,
        role: u!.role,
      }));

    return {
      conversationId,
      participants,
      unreadCount,
      lastMessage: {
        id: lastMessage.id,
        content: lastMessage.content,
        senderId: lastMessage.senderId,
        createdAt: lastMessage.createdAt,
      },
    };
  });

  summaries.sort((a, b) => {
    const aTs = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bTs = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bTs - aTs;
  });

  return summaries;
}

export async function getMessagesByConversation(conversationId: string): Promise<Message[]> {
  const { data, error } = await sb()
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) { console.error("[Database] getMessagesByConversation:", error.message); return []; }
  return mapRowsFromDb<Message>(data || []);
}

export async function getMessageById(id: string): Promise<Message | undefined> {
  const { data, error } = await sb()
    .from("messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getMessageById:", error.message); return undefined; }
  return mapFromDb<Message>(data);
}

export async function isConversationParticipant(conversationId: string, userId: string): Promise<boolean> {
  const { data, error } = await sb()
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .limit(1);
  if (error) {
    console.error("[Database] isConversationParticipant:", error.message);
    return false;
  }
  return Boolean(data && data.length > 0);
}

export async function getConversationParticipantIds(conversationId: string): Promise<string[]> {
  const { data, error } = await sb()
    .from("messages")
    .select("sender_id,receiver_id")
    .eq("conversation_id", conversationId);
  if (error) {
    console.error("[Database] getConversationParticipantIds:", error.message);
    return [];
  }

  const ids = new Set<string>();
  for (const row of data || []) {
    if (row.sender_id) ids.add(row.sender_id);
    if (row.receiver_id) ids.add(row.receiver_id);
  }
  return Array.from(ids);
}

export async function createMessage(data: InsertMessage): Promise<string> {
  const dbData = mapToDb(data);
  const { data: row, error } = await sb()
    .from("messages")
    .insert(dbData)
    .select("id")
    .single();
  if (error) {
    console.error("[Database] Failed to create message:", error.message, { conversationId: data.conversationId, senderId: data.senderId });
    throw error;
  }
  return row.id;
}

export async function markMessageRead(id: string) {
  const { error } = await sb()
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) { console.error("[Database] markMessageRead:", error.message); }
}

export async function updateMessageContent(id: string, content: string) {
  const { error } = await sb()
    .from("messages")
    .update({ content })
    .eq("id", id);
  if (error) {
    console.error("[Database] updateMessageContent:", error.message);
    throw error;
  }
}

export async function deleteMessage(id: string) {
  // Reactions reference message_id, so clear them first.
  const { error: reactionError } = await sb()
    .from("message_reactions")
    .delete()
    .eq("message_id", id);
  if (reactionError) {
    console.error("[Database] deleteMessage reactions:", reactionError.message);
  }

  const { error } = await sb()
    .from("messages")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[Database] deleteMessage:", error.message);
    throw error;
  }
}

export async function deleteConversation(conversationId: string) {
  const { data: msgRows, error: msgError } = await sb()
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId);
  if (msgError) {
    console.error("[Database] deleteConversation messages:", msgError.message);
    throw msgError;
  }

  const messageIds = (msgRows || []).map((row) => row.id).filter(Boolean);
  if (messageIds.length > 0) {
    const { error: reactionError } = await sb()
      .from("message_reactions")
      .delete()
      .in("message_id", messageIds);
    if (reactionError) {
      console.error("[Database] deleteConversation reactions:", reactionError.message);
    }
  }

  const { error } = await sb()
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId);
  if (error) {
    console.error("[Database] deleteConversation:", error.message);
    throw error;
  }
}

// ============================================================================
// MESSAGE REACTIONS
// ============================================================================

export async function getMessageReactions(messageId: string): Promise<MessageReaction[]> {
  const { data, error } = await sb()
    .from("message_reactions")
    .select("*")
    .eq("message_id", messageId);
  if (error) { console.error("[Database] getMessageReactions:", error.message); return []; }
  return mapRowsFromDb<MessageReaction>(data || []);
}

export async function addMessageReaction(data: InsertMessageReaction) {
  // Check if reaction already exists
  const { data: existing, error: selectError } = await sb()
    .from("message_reactions")
    .select("*")
    .eq("message_id", data.messageId)
    .eq("user_id", data.userId)
    .eq("reaction", data.reaction)
    .limit(1);
  if (selectError) { console.error("[Database] addMessageReaction:", selectError.message); }

  if (existing && existing.length > 0) {
    return mapFromDb<MessageReaction>(existing[0]);
  }

  const { data: row, error } = await sb()
    .from("message_reactions")
    .insert(mapToDb(data))
    .select("*")
    .single();
  if (error) throw error;
  return mapFromDb<MessageReaction>(row);
}

export async function removeMessageReaction(messageId: string, userId: string, reaction: string) {
  const { error } = await sb()
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("reaction", reaction);
  if (error) { console.error("[Database] removeMessageReaction:", error.message); }
}

export async function getConversationReactions(conversationId: string): Promise<MessageReaction[]> {
  // Get all message IDs in the conversation
  const { data: msgRows, error: msgError } = await sb()
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId);
  if (msgError) { console.error("[Database] getConversationReactions:", msgError.message); return []; }

  if (!msgRows || msgRows.length === 0) return [];

  const messageIds = msgRows.map((m) => m.id);
  const { data, error } = await sb()
    .from("message_reactions")
    .select("*")
    .in("message_id", messageIds);
  if (error) { console.error("[Database] getConversationReactions:", error.message); return []; }
  return mapRowsFromDb<MessageReaction>(data || []);
}

// ============================================================================
// CALENDAR EVENTS
// ============================================================================

export async function getCalendarEvents(userId: string, _startDate?: Date, _endDate?: Date): Promise<CalendarEvent[]> {
  const { data, error } = await sb()
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .order("start_time", { ascending: true });
  if (error) { console.error("[Database] getCalendarEvents:", error.message); return []; }
  return mapRowsFromDb<CalendarEvent>(data || []);
}

export async function createCalendarEvent(data: InsertCalendarEvent): Promise<string> {
  const { data: row, error } = await sb()
    .from("calendar_events")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function updateCalendarEvent(id: string, data: Partial<InsertCalendarEvent>) {
  const { error } = await sb().from("calendar_events").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateCalendarEvent:", error.message); }
}

// ============================================================================
// TRAINER EARNINGS
// ============================================================================

export async function getEarningsByTrainer(trainerId: string): Promise<TrainerEarning[]> {
  const { data, error } = await sb()
    .from("trainer_earnings")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getEarningsByTrainer:", error.message); return []; }
  return mapRowsFromDb<TrainerEarning>(data || []);
}

export async function createEarning(data: InsertTrainerEarning): Promise<string> {
  const { data: row, error } = await sb()
    .from("trainer_earnings")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function getEarningsSummary(trainerId: string): Promise<{ total: number; pending: number; paid: number }> {
  const { data, error } = await sb().rpc("get_earnings_summary", { p_trainer_id: trainerId });
  if (error) { console.error("[Database] getEarningsSummary:", error.message); return { total: 0, pending: 0, paid: 0 }; }
  const result = data as { total: number; pending: number; paid: number } | null;
  if (!result) return { total: 0, pending: 0, paid: 0 };
  return { total: Number(result.total), pending: Number(result.pending), paid: Number(result.paid) };
}

// ============================================================================
// PARTNERSHIPS
// ============================================================================

export async function getPartnershipBusinessById(id: string): Promise<PartnershipBusiness | undefined> {
  const { data, error } = await sb()
    .from("partnership_businesses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getPartnershipBusinessById:", error.message); return undefined; }
  return mapFromDb<PartnershipBusiness>(data);
}

export async function getAvailablePartnershipBusinesses(): Promise<PartnershipBusiness[]> {
  const { data, error } = await sb()
    .from("partnership_businesses")
    .select("*")
    .eq("is_available", true)
    .eq("status", "available")
    .order("name", { ascending: true });
  if (error) { console.error("[Database] getAvailablePartnershipBusinesses:", error.message); return []; }
  return mapRowsFromDb<PartnershipBusiness>(data || []);
}

export async function createPartnershipBusiness(data: InsertPartnershipBusiness): Promise<string> {
  const { data: row, error } = await sb()
    .from("partnership_businesses")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) { console.error("[Database] createPartnershipBusiness:", error.message); throw error; }
  return row.id;
}

export async function getTrainerPartnerships(trainerId: string): Promise<TrainerPartnershipWithBusiness[]> {
  const { data, error } = await sb()
    .from("trainer_partnerships")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getTrainerPartnerships:", error.message); return []; }
  const partnerships = mapRowsFromDb<TrainerPartnership>(data || []);
  if (partnerships.length === 0) return [];

  const businessIds = Array.from(new Set(partnerships.map((p) => p.businessId).filter(Boolean)));
  if (businessIds.length === 0) {
    return partnerships.map((partnership) => ({
      ...partnership,
      businessName: "Business",
      businessType: "General",
      description: null,
    }));
  }
  const { data: businessRows, error: businessError } = await sb()
    .from("partnership_businesses")
    .select("*")
    .in("id", businessIds);
  if (businessError) { console.error("[Database] getTrainerPartnerships businesses:", businessError.message); return []; }
  const businesses = mapRowsFromDb<PartnershipBusiness>(businessRows || []);
  const businessById = new Map<string, PartnershipBusiness>();
  businesses.forEach((business) => {
    businessById.set(business.id, business);
  });

  return partnerships.map((partnership) => {
    const business = businessById.get(partnership.businessId);
    return {
      ...partnership,
      businessName: business?.name || "Business",
      businessType: business?.type || "General",
      description: business?.description || null,
    };
  });
}

export async function createTrainerPartnership(data: InsertTrainerPartnership): Promise<string> {
  const { data: existing, error: existingError } = await sb()
    .from("trainer_partnerships")
    .select("id")
    .eq("trainer_id", data.trainerId)
    .eq("business_id", data.businessId)
    .in("status", ["pending", "active"])
    .limit(1)
    .maybeSingle();
  if (existingError) { console.error("[Database] createTrainerPartnership existing:", existingError.message); }
  if (existing?.id) return existing.id;

  const { data: row, error } = await sb()
    .from("trainer_partnerships")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) { console.error("[Database] createTrainerPartnership:", error.message); throw error; }
  return row.id;
}

// ============================================================================
// INVITATIONS
// ============================================================================

export async function createInvitation(data: InsertInvitation): Promise<string> {
  const { data: row, error } = await sb()
    .from("invitations")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function getInvitationByToken(token: string): Promise<Invitation | undefined> {
  const { data, error } = await sb()
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) { console.error("[Database] getInvitationByToken:", error.message); return undefined; }
  return mapFromDb<Invitation>(data);
}

export async function getInvitationsByTrainer(trainerId: string): Promise<Invitation[]> {
  const { data, error } = await sb()
    .from("invitations")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getInvitationsByTrainer:", error.message); return []; }
  return mapRowsFromDb<Invitation>(data || []);
}

export async function updateInvitation(id: string, data: Partial<InsertInvitation>) {
  const { error } = await sb().from("invitations").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateInvitation:", error.message); throw error; }
}

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

export async function logActivity(data: InsertActivityLog) {
  const { error } = await sb().from("activity_logs").insert(mapToDb(data));
  if (error) { console.error("[Database] logActivity:", error.message); throw error; }
}

// ============================================================================
// USER INVITATIONS (Manager-created invites)
// ============================================================================

export async function createUserInvitation(data: InsertUserInvitation): Promise<string> {
  const { data: row, error } = await sb()
    .from("user_invitations")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function getUserInvitationByToken(token: string): Promise<UserInvitation | undefined> {
  const { data, error } = await sb()
    .from("user_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error) { console.error("[Database] getUserInvitationByToken:", error.message); return undefined; }
  return mapFromDb<UserInvitation>(data);
}

export async function getUserInvitationById(id: string): Promise<UserInvitation | undefined> {
  const { data, error } = await sb()
    .from("user_invitations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getUserInvitationById:", error.message); return undefined; }
  return mapFromDb<UserInvitation>(data);
}

export async function getUserInvitations(options: {
  limit?: number;
  offset?: number;
  status?: "pending" | "accepted" | "expired" | "revoked";
}): Promise<{ invitations: UserInvitation[]; total: number }> {
  const { limit = 20, offset = 0, status } = options;

  let query = sb().from("user_invitations").select("*", { count: "exact" });
  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { console.error("[Database] getUserInvitations:", error.message); return { invitations: [], total: 0 }; }
  return { invitations: mapRowsFromDb<UserInvitation>(data || []), total: count ?? 0 };
}

export async function updateUserInvitation(id: string, data: Partial<InsertUserInvitation>) {
  const { error } = await sb().from("user_invitations").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateUserInvitation:", error.message); throw error; }
}

export async function revokeUserInvitation(id: string) {
  const { error } = await sb().from("user_invitations").update({ status: "revoked" }).eq("id", id);
  if (error) { console.error("[Database] revokeUserInvitation:", error.message); throw error; }
}

/**
 * Auto-accept all pending user invitations for a given email/user.
 * Returns the highest-priority role that was granted, or null if none matched.
 */
export async function autoAcceptPendingUserInvitations(
  userId: string,
  email: string,
): Promise<{ acceptedCount: number; role: string | null }> {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return { acceptedCount: 0, role: null };

  const { data: pending, error } = await sb()
    .from("user_invitations")
    .select("*")
    .eq("status", "pending")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Database] autoAcceptPendingUserInvitations:", error.message);
    return { acceptedCount: 0, role: null };
  }
  if (!pending || pending.length === 0) return { acceptedCount: 0, role: null };

  const now = Date.now();
  const rolePriority: Record<string, number> = {
    coordinator: 4,
    manager: 3,
    trainer: 2,
    client: 1,
    shopper: 0,
  };
  let bestRole: string | null = null;
  let bestPriority = -1;
  let acceptedCount = 0;

  for (const row of pending) {
    const expiresAtMs = new Date(row.expires_at).getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs < now) {
      await sb().from("user_invitations").update({ status: "expired" }).eq("id", row.id);
      continue;
    }

    await sb()
      .from("user_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId,
      })
      .eq("id", row.id);

    acceptedCount++;
    const priority = rolePriority[row.role] ?? 0;
    if (priority > bestPriority) {
      bestPriority = priority;
      bestRole = row.role;
    }
  }

  return { acceptedCount, role: bestRole };
}

/**
 * Accept a pending user invitation by token. Does NOT require email match.
 * Returns the invitation role if accepted, or null if no valid invite found.
 * Ensures the invite is only used once.
 */
export async function acceptPendingUserInvitationByToken(
  token: string,
  userId: string,
): Promise<{ role: string; invitationId: string } | null> {
  if (!token) return null;

  const { data, error } = await sb()
    .from("user_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("[Database] acceptPendingUserInvitationByToken:", error.message);
    return null;
  }
  if (!data) return null;

  if (data.status === "accepted") {
    if (data.accepted_by_user_id && data.accepted_by_user_id !== userId) {
      return null;
    }
    return { role: data.role, invitationId: data.id };
  }

  if (data.status !== "pending") return null;

  const expiresAtMs = new Date(data.expires_at).getTime();
  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    await sb().from("user_invitations").update({ status: "expired" }).eq("id", data.id);
    return null;
  }

  await sb()
    .from("user_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: userId,
    })
    .eq("id", data.id);

  const email = String(data.email || "").trim().toLowerCase();
  if (email) {
    await sb()
      .from("user_invitations")
      .update({ status: "revoked" })
      .eq("status", "pending")
      .eq("email", email)
      .neq("id", data.id);
  }

  return { role: data.role, invitationId: data.id };
}

export async function revokeOtherPendingUserInvitationsByEmail(email: string, excludeId: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return 0;
  const { data, error } = await sb()
    .from("user_invitations")
    .update({ status: "revoked" })
    .eq("status", "pending")
    .eq("email", normalizedEmail)
    .neq("id", excludeId)
    .select("id");
  if (error) {
    console.error("[Database] revokeOtherPendingUserInvitationsByEmail:", error.message);
    throw error;
  }
  return (data || []).length;
}

// ============================================================================
// COORDINATOR OPERATIONS
// ============================================================================

export async function getTopTrainers(limit = 10) {
  const { data, error } = await sb().rpc("get_top_trainers", { p_limit: limit });
  if (error) { console.error("[Database] getTopTrainers:", error.message); return []; }
  return (data as any[]) || [];
}

export async function getTopBundles(limit = 10) {
  const { data, error } = await sb().rpc("get_top_bundles", { p_limit: limit });
  if (error) { console.error("[Database] getTopBundles:", error.message); return []; }
  return (data as any[]) || [];
}

export async function getCoordinatorStats() {
  const { count: totalUsers, error: e1 } = await sb()
    .from("users")
    .select("*", { count: "exact", head: true });
  if (e1) { console.error("[Database] getCoordinatorStats:", e1.message); }

  const { count: totalBundles, error: e2 } = await sb()
    .from("bundle_drafts")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");
  if (e2) { console.error("[Database] getCoordinatorStats:", e2.message); }

  const { count: pendingApprovals, error: e3 } = await sb()
    .from("bundle_drafts")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_review");
  if (e3) { console.error("[Database] getCoordinatorStats:", e3.message); }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const { count: newUsersThisMonth, error: e4 } = await sb()
    .from("users")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfMonth.toISOString());
  if (e4) { console.error("[Database] getCoordinatorStats:", e4.message); }

  return {
    totalUsers: totalUsers ?? 0,
    totalBundles: totalBundles ?? 0,
    pendingApprovals: pendingApprovals ?? 0,
    newUsersThisMonth: newUsersThisMonth ?? 0,
  };
}

export async function getLowInventoryProducts(options?: { threshold?: number; limit?: number }) {
  const { threshold = 5, limit = 20 } = options || {};

  const { data, error } = await sb()
    .from("products")
    .select("id, name, inventory_quantity, updated_at")
    .lte("inventory_quantity", threshold)
    .eq("availability", "available")
    .order("inventory_quantity", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[Database] getLowInventoryProducts:", error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    productName: (row.name as string) || "Unknown product",
    currentStock: Number(row.inventory_quantity ?? 0),
    updatedAt: (row.updated_at as string) || null,
  }));
}

export async function getRevenueSummary() {
  const { data, error } = await sb()
    .from("orders")
    .select("total_amount, status, created_at")
    .neq("status", "cancelled")
    .neq("status", "refunded");

  if (error) {
    console.error("[Database] getRevenueSummary:", error.message);
    return { total: 0, thisMonth: 0, lastMonth: 0, growth: 0 };
  }

  const parseAmount = (value: unknown) => {
    const amount = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
    return Number.isFinite(amount) ? amount : 0;
  };

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let total = 0;
  let thisMonth = 0;
  let lastMonth = 0;

  for (const order of data || []) {
    const amount = parseAmount(order.total_amount);
    total += amount;

    const createdAt = new Date(order.created_at as string);
    if (createdAt >= startOfThisMonth) {
      thisMonth += amount;
      continue;
    }
    if (createdAt >= startOfLastMonth && createdAt < startOfThisMonth) {
      lastMonth += amount;
    }
  }

  const growth = lastMonth > 0
    ? ((thisMonth - lastMonth) / lastMonth) * 100
    : thisMonth > 0
      ? 100
      : 0;

  return { total, thisMonth, lastMonth, growth };
}

export async function getRevenueTrend(options?: { months?: number }) {
  const months = Math.max(1, Math.min(options?.months ?? 6, 24));
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data, error } = await sb()
    .from("orders")
    .select("total_amount, status, created_at")
    .gte("created_at", start.toISOString())
    .neq("status", "cancelled")
    .neq("status", "refunded");

  if (error) {
    console.error("[Database] getRevenueTrend:", error.message);
    return [];
  }

  const parseAmount = (value: unknown) => {
    const amount = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
    return Number.isFinite(amount) ? amount : 0;
  };

  const monthMap = new Map<string, { month: string; revenue: number; orders: number }>();
  for (let idx = months - 1; idx >= 0; idx -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - idx, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    monthMap.set(key, {
      month: monthDate.toLocaleString("en-US", { month: "short" }),
      revenue: 0,
      orders: 0,
    });
  }

  for (const order of data || []) {
    const createdAt = new Date(order.created_at as string);
    const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthMap.get(key);
    if (!entry) continue;
    entry.revenue += parseAmount(order.total_amount);
    entry.orders += 1;
  }

  return Array.from(monthMap.values());
}

// ============================================================================
// USER ACTIVITY LOGS (Admin actions on users)
// ============================================================================

export async function logUserActivity(data: InsertUserActivityLog) {
  const { error } = await sb().from("user_activity_logs").insert(mapToDb(data));
  if (error) { console.error("[Database] logUserActivity:", error.message); }
}

export async function getUserActivityLogs(targetUserId: string, limit = 50): Promise<UserActivityLog[]> {
  const { data, error } = await sb()
    .from("user_activity_logs")
    .select("*")
    .eq("target_user_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("[Database] getUserActivityLogs:", error.message); return []; }
  return mapRowsFromDb<UserActivityLog>(data || []);
}

export async function getRecentActivityLogs(limit = 100): Promise<UserActivityLog[]> {
  const { data, error } = await sb()
    .from("user_activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("[Database] getRecentActivityLogs:", error.message); return []; }
  return mapRowsFromDb<UserActivityLog>(data || []);
}

// ============================================================================
// CLIENT-TRAINER RELATIONSHIPS (My Trainers feature)
// ============================================================================

export async function getMyTrainers(userId: string) {
  const { data: clientRecords, error: clientError } = await sb()
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "pending"]);
  if (clientError) { console.error("[Database] getMyTrainers:", clientError.message); return []; }

  if (!clientRecords || clientRecords.length === 0) return [];

  const trainerIds = clientRecords.map((c) => c.trainer_id);

  const { data: trainers, error: trainersError } = await sb()
    .from("users")
    .select("*")
    .in("id", trainerIds);
  if (trainersError) { console.error("[Database] getMyTrainers:", trainersError.message); return []; }

  return (trainers || []).map((trainer) => {
    const mapped = mapFromDb<User>(trainer)!;
    const clientRecord = clientRecords.find((c) => c.trainer_id === trainer.id);
    return {
      ...mapped,
      relationshipId: clientRecord?.id,
      relationshipStatus: clientRecord?.status,
      joinedDate: clientRecord?.accepted_at || clientRecord?.created_at,
      isPrimary: clientRecord?.id === clientRecords[0]?.id,
    };
  });
}

export async function getActiveBundlesCount(trainerId: string, clientUserId: string): Promise<number> {
  const { data: clientRecord, error: clientError } = await sb()
    .from("clients")
    .select("id")
    .eq("trainer_id", trainerId)
    .eq("user_id", clientUserId)
    .limit(1)
    .maybeSingle();
  if (clientError) { console.error("[Database] getActiveBundlesCount:", clientError.message); return 0; }

  if (!clientRecord) return 0;

  const { count, error: countError } = await sb()
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientRecord.id)
    .eq("status", "active");
  if (countError) { console.error("[Database] getActiveBundlesCount:", countError.message); return 0; }

  return count ?? 0;
}

export async function removeTrainerFromClient(trainerId: string, clientUserId: string) {
  const { error } = await sb()
    .from("clients")
    .update({ status: "removed" })
    .eq("trainer_id", trainerId)
    .eq("user_id", clientUserId);
  if (error) { console.error("[Database] removeTrainerFromClient:", error.message); throw error; }
}

export async function getAvailableTrainers(userId: string, search?: string, _specialty?: string): Promise<User[]> {
  // Get IDs of trainers already connected to this user
  const { data: existingConnections, error: connError } = await sb()
    .from("clients")
    .select("trainer_id")
    .eq("user_id", userId)
    .in("status", ["active", "pending"]);
  if (connError) { console.error("[Database] getAvailableTrainers:", connError.message); }

  const connectedTrainerIds = (existingConnections || []).map((c) => c.trainer_id);

  let query = sb()
    .from("users")
    .select("*")
    .eq("role", "trainer")
    .eq("active", true);

  if (connectedTrainerIds.length > 0) {
    // Exclude already connected trainers
    query = query.not("id", "in", `(${connectedTrainerIds.join(",")})`);
  }

  if (search) {
    const term = sanitizeSearchTerm(search);
    if (term) {
      query = query.or(`name.ilike.%${term}%,bio.ilike.%${term}%,username.ilike.%${term}%`);
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) { console.error("[Database] getAvailableTrainers:", error.message); return []; }
  return mapRowsFromDb<User>(data || []);
}

export async function createJoinRequest(trainerId: string, userId: string, message?: string): Promise<string> {
  // Check if relationship already exists
  const { data: existing, error: existError } = await sb()
    .from("clients")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (existError) { console.error("[Database] createJoinRequest:", existError.message); throw existError; }

  if (existing) {
    if (existing.status === "removed") {
      const { error: updateError } = await sb()
        .from("clients")
        .update({ status: "pending", notes: message })
        .eq("id", existing.id);
      if (updateError) { console.error("[Database] createJoinRequest:", updateError.message); throw updateError; }
      return existing.id;
    }
    throw new Error("Already connected to this trainer");
  }

  // Get user info
  const { data: user, error: userError } = await sb()
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();
  if (userError) { console.error("[Database] createJoinRequest:", userError.message); throw userError; }

  if (!user) throw new Error("User not found");

  const { data: row, error } = await sb()
    .from("clients")
    .insert({
      trainer_id: trainerId,
      user_id: userId,
      name: user.name || "Unknown",
      email: user.email,
      phone: user.phone,
      photo_url: user.photo_url,
      status: "pending",
      notes: message,
      invited_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function getPendingJoinRequests(userId: string) {
  const { data: pending, error: pendingError } = await sb()
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending");
  if (pendingError) { console.error("[Database] getPendingJoinRequests:", pendingError.message); return []; }

  if (!pending || pending.length === 0) return [];

  const trainerIds = pending.map((p) => p.trainer_id);
  const { data: trainers, error: trainersError } = await sb()
    .from("users")
    .select("*")
    .in("id", trainerIds);
  if (trainersError) { console.error("[Database] getPendingJoinRequests:", trainersError.message); }

  return pending.map((request) => ({
    ...mapFromDb(request),
    trainer: mapFromDb<User>((trainers || []).find((t) => t.id === request.trainer_id)),
  }));
}

export async function cancelJoinRequest(requestId: string, userId: string) {
  const { data: request, error: selectError } = await sb()
    .from("clients")
    .select("*")
    .eq("id", requestId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (selectError) { console.error("[Database] cancelJoinRequest:", selectError.message); throw selectError; }

  if (!request) throw new Error("Request not found");

  const { error } = await sb().from("clients").delete().eq("id", requestId);
  if (error) { console.error("[Database] cancelJoinRequest:", error.message); throw error; }
}

export async function getPendingJoinRequestsForTrainer(trainerId: string) {
  const { data: pending, error: pendingError } = await sb()
    .from("clients")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (pendingError) { console.error("[Database] getPendingJoinRequestsForTrainer:", pendingError.message); return []; }

  if (!pending || pending.length === 0) return [];

  const userIds = pending
    .map((p) => p.user_id)
    .filter((id): id is string => Boolean(id));
  const userById = new Map<string, User>();

  if (userIds.length > 0) {
    const { data: users, error: usersError } = await sb()
      .from("users")
      .select("*")
      .in("id", userIds);
    if (usersError) {
      console.error("[Database] getPendingJoinRequestsForTrainer users:", usersError.message);
    } else {
      mapRowsFromDb<User>(users || []).forEach((u) => userById.set(u.id, u));
    }
  }

  return pending.map((request) => {
    const mapped = mapFromDb<Client>(request)!;
    const requestUser = mapped.userId ? userById.get(mapped.userId) : undefined;
    return {
      ...mapped,
      requestUser: requestUser || null,
    };
  });
}

export async function getClientByTrainerAndUser(trainerId: string, userId: string): Promise<Client | undefined> {
  const { data, error } = await sb()
    .from("clients")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) { console.error("[Database] getClientByTrainerAndUser:", error.message); return undefined; }
  return mapFromDb<Client>(data);
}

export async function approveJoinRequest(requestId: string, trainerId: string) {
  const now = new Date().toISOString();
  const { data, error } = await sb()
    .from("clients")
    .update({
      status: "active",
      accepted_at: now,
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("trainer_id", trainerId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) { console.error("[Database] approveJoinRequest:", error.message); throw error; }
  if (!data) throw new Error("Join request not found");
  return mapFromDb<Client>(data)!;
}

export async function rejectJoinRequest(requestId: string, trainerId: string) {
  const now = new Date().toISOString();
  const { data, error } = await sb()
    .from("clients")
    .update({
      status: "removed",
      updated_at: now,
    })
    .eq("id", requestId)
    .eq("trainer_id", trainerId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) { console.error("[Database] rejectJoinRequest:", error.message); throw error; }
  if (!data) throw new Error("Join request not found");
  return mapFromDb<Client>(data)!;
}

export async function getTrainerBundleCount(trainerId: string): Promise<number> {
  const { count, error } = await sb()
    .from("bundle_drafts")
    .select("*", { count: "exact", head: true })
    .eq("trainer_id", trainerId)
    .eq("status", "published");
  if (error) { console.error("[Database] getTrainerBundleCount:", error.message); return 0; }
  return count ?? 0;
}

export async function getPublishedBundlesPreviewByTrainer(trainerId: string, limit = 2) {
  const { data, error } = await sb()
    .from("bundle_drafts")
    .select("id, title, image_url, price, cadence")
    .eq("trainer_id", trainerId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) { console.error("[Database] getPublishedBundlesPreviewByTrainer:", error.message); return []; }

  return (data || []).map((d) => ({
    id: d.id,
    title: d.title,
    imageUrl: d.image_url,
    price: d.price,
    cadence: d.cadence,
  }));
}

// ============================================================================
// PAYMENT SESSIONS
// ============================================================================

export async function createPaymentSession(data: InsertPaymentSession): Promise<string> {
  const { data: row, error } = await sb()
    .from("payment_sessions")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function getPaymentSessionByReference(merchantReference: string): Promise<PaymentSession | undefined> {
  const { data, error } = await sb()
    .from("payment_sessions")
    .select("*")
    .eq("merchant_reference", merchantReference)
    .maybeSingle();
  if (error) { console.error("[Database] getPaymentSessionByReference:", error.message); return undefined; }
  return mapFromDb<PaymentSession>(data);
}

export async function getPaymentSessionByAdyenId(adyenSessionId: string): Promise<PaymentSession | undefined> {
  const { data, error } = await sb()
    .from("payment_sessions")
    .select("*")
    .eq("adyen_session_id", adyenSessionId)
    .maybeSingle();
  if (error) { console.error("[Database] getPaymentSessionByAdyenId:", error.message); return undefined; }
  return mapFromDb<PaymentSession>(data);
}

export async function updatePaymentSessionByReference(
  merchantReference: string,
  data: Partial<InsertPaymentSession>,
) {
  const { error } = await sb()
    .from("payment_sessions")
    .update(mapToDb(data))
    .eq("merchant_reference", merchantReference);
  if (error) { console.error("[Database] updatePaymentSessionByReference:", error.message); throw error; }
}

export async function getPaymentHistory(
  userId: string,
  options: { limit?: number; offset?: number; status?: string } = {},
): Promise<PaymentSession[]> {
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  let query = sb()
    .from("payment_sessions")
    .select("*")
    .eq("requested_by", userId);

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) { console.error("[Database] getPaymentHistory:", error.message); return []; }
  return mapRowsFromDb<PaymentSession>(data || []);
}

export async function getPaymentSessionsByTrainer(userId: string): Promise<PaymentSession[]> {
  const { data, error } = await sb()
    .from("payment_sessions")
    .select("*")
    .eq("requested_by", userId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getPaymentSessionsByTrainer:", error.message); return []; }
  return mapRowsFromDb<PaymentSession>(data || []);
}

export async function getPaymentHistoryForClient(
  trainerId: string,
  clientEmail?: string | null,
): Promise<PaymentSession[]> {
  if (!clientEmail) return [];
  const safeEmail = clientEmail.trim().toLowerCase();
  if (!safeEmail) return [];

  const { data, error } = await sb()
    .from("payment_sessions")
    .select("*")
    .eq("requested_by", trainerId)
    .ilike("description", `%${safeEmail}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) { console.error("[Database] getPaymentHistoryForClient:", error.message); return []; }
  return mapRowsFromDb<PaymentSession>(data || []);
}

export async function getPaymentStats(userId: string) {
  const { data: allSessions, error } = await sb()
    .from("payment_sessions")
    .select("status, amount_minor")
    .eq("requested_by", userId);
  if (error) { console.error("[Database] getPaymentStats:", error.message); return { total: 0, captured: 0, pending: 0, totalAmount: 0 }; }

  let total = 0;
  let captured = 0;
  let pending = 0;
  let totalAmount = 0;

  for (const s of allSessions || []) {
    total++;
    if (s.status === "captured" || s.status === "authorised") {
      captured++;
      totalAmount += s.amount_minor;
    } else if (s.status === "created" || s.status === "pending") {
      pending++;
    }
  }

  return { total, captured, pending, totalAmount };
}

// ============================================================================
// PAYMENT LOGS
// ============================================================================

export async function createPaymentLog(data: InsertPaymentLog) {
  const { error } = await sb().from("payment_logs").insert(mapToDb(data));
  if (error) { console.error("[Database] createPaymentLog:", error.message); }
}

export async function getPaymentLogsByReference(merchantReference: string): Promise<PaymentLog[]> {
  const { data, error } = await sb()
    .from("payment_logs")
    .select("*")
    .eq("merchant_reference", merchantReference)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getPaymentLogsByReference:", error.message); return []; }
  return mapRowsFromDb<PaymentLog>(data || []);
}

// ============================================================================
// RESCHEDULE REQUESTS
// ============================================================================

export async function createRescheduleRequest(data: InsertRescheduleRequest): Promise<string> {
  const { data: row, error } = await sb()
    .from("reschedule_requests")
    .insert(mapToDb(data))
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

export async function getRescheduleRequestsByTrainer(trainerId: string): Promise<RescheduleRequest[]> {
  const { data, error } = await sb()
    .from("reschedule_requests")
    .select("*")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getRescheduleRequestsByTrainer:", error.message); return []; }
  return mapRowsFromDb<RescheduleRequest>(data || []);
}

export async function getPendingRescheduleRequests(trainerId: string): Promise<RescheduleRequest[]> {
  const { data, error } = await sb()
    .from("reschedule_requests")
    .select("*")
    .eq("trainer_id", trainerId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) { console.error("[Database] getPendingRescheduleRequests:", error.message); return []; }
  return mapRowsFromDb<RescheduleRequest>(data || []);
}

export async function updateRescheduleRequest(id: string, data: Partial<RescheduleRequest>) {
  const { error } = await sb().from("reschedule_requests").update(mapToDb(data)).eq("id", id);
  if (error) { console.error("[Database] updateRescheduleRequest:", error.message); throw error; }
}

export async function getRescheduleRequestById(id: string): Promise<RescheduleRequest | undefined> {
  const { data, error } = await sb()
    .from("reschedule_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[Database] getRescheduleRequestById:", error.message); return undefined; }
  return mapFromDb<RescheduleRequest>(data);
}
