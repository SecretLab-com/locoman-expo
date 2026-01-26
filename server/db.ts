import { eq, and, desc, asc, sql, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  bundleTemplates,
  bundleDrafts,
  products,
  clients,
  subscriptions,
  sessions,
  orders,
  orderItems,
  messages,
  calendarEvents,
  trainerEarnings,
  activityLogs,
  invitations,
  productDeliveries,
  InsertBundleTemplate,
  InsertBundleDraft,
  InsertClient,
  InsertSubscription,
  InsertSession,
  InsertMessage,
  InsertCalendarEvent,
  InsertProduct,
  InsertOrder,
  InsertOrderItem,
  InsertActivityLog,
  InsertInvitation,
  InsertProductDelivery,
  InsertTrainerEarning,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "phone", "photoUrl", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "coordinator";
      updateSet.role = "coordinator";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(userId: number, role: InsertUser["role"]) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getTrainers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, "trainer")).orderBy(desc(users.createdAt));
}

export async function getAllUsers(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
}

export async function searchUsers(query: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(
    or(
      like(users.name, `%${query}%`),
      like(users.email, `%${query}%`)
    )
  ).limit(50);
}

// ============================================================================
// BUNDLE TEMPLATES
// ============================================================================

export async function getBundleTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bundleTemplates).where(eq(bundleTemplates.active, true)).orderBy(desc(bundleTemplates.createdAt));
}

export async function getBundleTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bundleTemplates).where(eq(bundleTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBundleTemplate(data: InsertBundleTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bundleTemplates).values(data);
  return result[0].insertId;
}

export async function incrementTemplateUsage(templateId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(bundleTemplates)
    .set({ usageCount: sql`${bundleTemplates.usageCount} + 1` })
    .where(eq(bundleTemplates.id, templateId));
}

// ============================================================================
// BUNDLE DRAFTS
// ============================================================================

export async function getBundleDraftsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bundleDrafts).where(eq(bundleDrafts.trainerId, trainerId)).orderBy(desc(bundleDrafts.updatedAt));
}

export async function getBundleDraftById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bundleDrafts).where(eq(bundleDrafts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBundleDraft(data: InsertBundleDraft) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bundleDrafts).values(data);
  return result[0].insertId;
}

export async function updateBundleDraft(id: number, data: Partial<InsertBundleDraft>) {
  const db = await getDb();
  if (!db) return;
  await db.update(bundleDrafts).set(data).where(eq(bundleDrafts.id, id));
}

export async function getPublishedBundles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bundleDrafts).where(eq(bundleDrafts.status, "published")).orderBy(desc(bundleDrafts.updatedAt));
}

export async function getPendingReviewBundles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bundleDrafts).where(eq(bundleDrafts.status, "pending_review")).orderBy(asc(bundleDrafts.submittedForReviewAt));
}

// ============================================================================
// PRODUCTS
// ============================================================================

export async function getProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.availability, "available")).orderBy(asc(products.name));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function searchProducts(query: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(
    and(
      eq(products.availability, "available"),
      or(
        like(products.name, `%${query}%`),
        like(products.brand, `%${query}%`)
      )
    )
  ).limit(50);
}

export async function upsertProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(products).values(data).onDuplicateKeyUpdate({ set: data });
}

// ============================================================================
// CLIENTS
// ============================================================================

export async function getClientsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clients).where(eq(clients.trainerId, trainerId)).orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createClient(data: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(data);
  return result[0].insertId;
}

export async function updateClient(id: number, data: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set(data).where(eq(clients.id, id));
}

// ============================================================================
// SUBSCRIPTIONS (with session tracking)
// ============================================================================

export async function getSubscriptionsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).orderBy(desc(subscriptions.createdAt));
}

export async function getSubscriptionsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptions).where(eq(subscriptions.trainerId, trainerId)).orderBy(desc(subscriptions.createdAt));
}

export async function getActiveSubscription(clientId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subscriptions).where(
    and(eq(subscriptions.clientId, clientId), eq(subscriptions.status, "active"))
  ).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createSubscription(data: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(subscriptions).values(data);
  return result[0].insertId;
}

export async function updateSubscription(id: number, data: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

// Increment sessions used - key function for session tracking
export async function incrementSessionsUsed(subscriptionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions)
    .set({ sessionsUsed: sql`${subscriptions.sessionsUsed} + 1` })
    .where(eq(subscriptions.id, subscriptionId));
}

// ============================================================================
// SESSIONS (Training sessions)
// ============================================================================

export async function getSessionsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(eq(sessions.clientId, clientId)).orderBy(desc(sessions.sessionDate));
}

export async function getSessionsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(eq(sessions.trainerId, trainerId)).orderBy(desc(sessions.sessionDate));
}

export async function getUpcomingSessions(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sessions).where(
    and(
      eq(sessions.trainerId, trainerId),
      eq(sessions.status, "scheduled")
    )
  ).orderBy(asc(sessions.sessionDate)).limit(10);
}

export async function createSession(data: InsertSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sessions).values(data);
  return result[0].insertId;
}

export async function updateSession(id: number, data: Partial<InsertSession>) {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions).set(data).where(eq(sessions.id, id));
}

// Mark session as completed and increment subscription usage
export async function completeSession(sessionId: number) {
  const db = await getDb();
  if (!db) return;
  
  // Get the session to find subscription
  const sessionResult = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  if (sessionResult.length === 0) return;
  
  const session = sessionResult[0];
  
  // Update session status
  await db.update(sessions).set({
    status: "completed",
    completedAt: new Date(),
  }).where(eq(sessions.id, sessionId));
  
  // Increment subscription sessions used if linked
  if (session.subscriptionId) {
    await incrementSessionsUsed(session.subscriptionId);
  }
}

// ============================================================================
// ORDERS
// ============================================================================

export async function getOrdersByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.clientId, clientId)).orderBy(desc(orders.createdAt));
}

export async function getOrdersByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.trainerId, trainerId)).orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(data);
  return result[0].insertId;
}

export async function updateOrder(id: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set(data).where(eq(orders.id, id));
}

// ============================================================================
// ORDER ITEMS
// ============================================================================

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function createOrderItem(data: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderItems).values(data);
  return result[0].insertId;
}

// ============================================================================
// PRODUCT DELIVERIES
// ============================================================================

export async function getDeliveriesByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productDeliveries).where(eq(productDeliveries.clientId, clientId)).orderBy(desc(productDeliveries.createdAt));
}

export async function getDeliveriesByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productDeliveries).where(eq(productDeliveries.trainerId, trainerId)).orderBy(desc(productDeliveries.createdAt));
}

export async function getPendingDeliveries(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productDeliveries).where(
    and(
      eq(productDeliveries.trainerId, trainerId),
      inArray(productDeliveries.status, ["pending", "ready", "scheduled", "out_for_delivery"])
    )
  ).orderBy(asc(productDeliveries.scheduledDate));
}

export async function createDelivery(data: InsertProductDelivery) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productDeliveries).values(data);
  return result[0].insertId;
}

export async function updateDelivery(id: number, data: Partial<InsertProductDelivery>) {
  const db = await getDb();
  if (!db) return;
  await db.update(productDeliveries).set(data).where(eq(productDeliveries.id, id));
}

export async function markDeliveryReady(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(productDeliveries).set({ status: "ready" }).where(eq(productDeliveries.id, id));
}

export async function markDeliveryDelivered(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(productDeliveries).set({
    status: "delivered",
    deliveredAt: new Date(),
  }).where(eq(productDeliveries.id, id));
}

export async function confirmDeliveryReceipt(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(productDeliveries).set({
    status: "confirmed",
    confirmedAt: new Date(),
  }).where(eq(productDeliveries.id, id));
}

// ============================================================================
// MESSAGES
// ============================================================================

export async function getConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get unique conversation IDs for this user
  const sent = await db.select({ conversationId: messages.conversationId }).from(messages).where(eq(messages.senderId, userId));
  const received = await db.select({ conversationId: messages.conversationId }).from(messages).where(eq(messages.receiverId, userId));
  const allConversations = [...new Set([...sent, ...received].map(m => m.conversationId))];
  return allConversations;
}

export async function getMessagesByConversation(conversationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
}

export async function createMessage(data: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(data);
  return result[0].insertId;
}

export async function markMessageRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(messages).set({ readAt: new Date() }).where(eq(messages.id, id));
}

// ============================================================================
// CALENDAR EVENTS
// ============================================================================

export async function getCalendarEvents(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(calendarEvents).where(eq(calendarEvents.userId, userId)).orderBy(asc(calendarEvents.startTime));
}

export async function createCalendarEvent(data: InsertCalendarEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(calendarEvents).values(data);
  return result[0].insertId;
}

export async function updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>) {
  const db = await getDb();
  if (!db) return;
  await db.update(calendarEvents).set(data).where(eq(calendarEvents.id, id));
}

// ============================================================================
// TRAINER EARNINGS
// ============================================================================

export async function getEarningsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trainerEarnings).where(eq(trainerEarnings.trainerId, trainerId)).orderBy(desc(trainerEarnings.createdAt));
}

export async function createEarning(data: InsertTrainerEarning) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(trainerEarnings).values(data);
  return result[0].insertId;
}

export async function getEarningsSummary(trainerId: number) {
  const db = await getDb();
  if (!db) return { total: 0, pending: 0, paid: 0 };
  
  const earnings = await db.select().from(trainerEarnings).where(eq(trainerEarnings.trainerId, trainerId));
  
  let total = 0;
  let pending = 0;
  let paid = 0;
  
  for (const e of earnings) {
    const amount = parseFloat(e.amount as string) || 0;
    total += amount;
    if (e.status === "pending" || e.status === "approved") {
      pending += amount;
    } else if (e.status === "paid") {
      paid += amount;
    }
  }
  
  return { total, pending, paid };
}

// ============================================================================
// INVITATIONS
// ============================================================================

export async function createInvitation(data: InsertInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invitations).values(data);
  return result[0].insertId;
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getInvitationsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invitations).where(eq(invitations.trainerId, trainerId)).orderBy(desc(invitations.createdAt));
}

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

export async function logActivity(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(data);
}
