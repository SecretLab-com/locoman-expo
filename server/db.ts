import { and, asc, desc, eq, gte, inArray, isNull, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
    activityLogs,
    bundleDrafts,
    bundleTemplates,
    calendarEvents,
    clients,
    InsertActivityLog,
    InsertBundleDraft,
    InsertBundleTemplate,
    InsertCalendarEvent,
    InsertClient,
    InsertInvitation,
    InsertMessage,
    InsertMessageReaction,
    InsertOrder,
    InsertOrderItem,
    InsertProduct,
    InsertProductDelivery,
    InsertSession,
    InsertSubscription,
    InsertTrainerEarning,
    InsertUser,
    InsertUserActivityLog,
    InsertUserInvitation,
    invitations,
    messageReactions,
    messages,
    orderItems,
    orders,
    productDeliveries,
    products,
    sessions,
    subscriptions,
    trainerEarnings,
    userActivityLogs,
    userInvitations,
    users,
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

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
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

export async function getUsersWithFilters(options: {
  limit?: number;
  offset?: number;
  role?: string;
  status?: "active" | "inactive";
  search?: string;
  joinedAfter?: Date;
  joinedBefore?: Date;
}) {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };
  
  const { limit = 20, offset = 0, role, status, search, joinedAfter, joinedBefore } = options;
  
  const conditions = [];
  
  if (role && role !== "all") {
    conditions.push(eq(users.role, role as any));
  }
  
  if (status === "active") {
    conditions.push(eq(users.active, true));
  } else if (status === "inactive") {
    conditions.push(eq(users.active, false));
  }
  
  if (search) {
    conditions.push(
      or(
        like(users.name, `%${search}%`),
        like(users.email, `%${search}%`)
      )!
    );
  }
  
  if (joinedAfter) {
    conditions.push(gte(users.createdAt, joinedAfter));
  }
  
  if (joinedBefore) {
    conditions.push(lte(users.createdAt, joinedBefore));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(whereClause);
  const total = countResult[0]?.count ?? 0;
  
  // Get paginated users
  const userList = await db
    .select()
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
  
  return { users: userList, total };
}

export async function updateUserStatus(userId: number, active: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ active }).where(eq(users.id, userId));
}

export async function bulkUpdateUserRole(userIds: number[], role: InsertUser["role"]) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(inArray(users.id, userIds));
}

export async function bulkUpdateUserStatus(userIds: number[], active: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ active }).where(inArray(users.id, userIds));
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
  try {
    return db
      .select()
      .from(bundleDrafts)
      .where(eq(bundleDrafts.status, "published"))
      .orderBy(desc(bundleDrafts.updatedAt));
  } catch (error) {
    console.error("[Database] Failed to load published bundles:", error);
    return [];
  }
}

export async function getPendingReviewBundles() {
  const db = await getDb();
  if (!db) return [];
  try {
    return db
      .select()
      .from(bundleDrafts)
      .where(eq(bundleDrafts.status, "pending_review"))
      .orderBy(asc(bundleDrafts.submittedForReviewAt));
  } catch (error) {
    console.error("[Database] Failed to load pending review bundles:", error);
    return [];
  }
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

export async function getDeliveryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(productDeliveries)
    .where(eq(productDeliveries.id, id))
    .limit(1);
  return result[0] ?? null;
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

export async function getUserIdsByRoles(roles: InsertUser["role"][]) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, roles as any));
  return result.map((row) => row.id);
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

export async function getConversationSummaries(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const conversationRows = await db
    .select({ conversationId: messages.conversationId })
    .from(messages)
    .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
    .groupBy(messages.conversationId);

  const summaries = [];
  for (const row of conversationRows) {
    const conversationId = row.conversationId;

    const lastMessageRows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    const lastMessage = lastMessageRows[0];

    const participantRows = await db
      .select({ senderId: messages.senderId, receiverId: messages.receiverId })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    const participantIds = new Set<number>();
    participantRows.forEach((participant) => {
      participantIds.add(participant.senderId);
      participantIds.add(participant.receiverId);
    });
    participantIds.delete(userId);
    const participants = participantIds.size
      ? await db
          .select({
            id: users.id,
            name: users.name,
            photoUrl: users.photoUrl,
            role: users.role,
          })
          .from(users)
          .where(inArray(users.id, Array.from(participantIds)))
      : [];

    const unreadCountRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.receiverId, userId),
          isNull(messages.readAt),
        ),
      );

    summaries.push({
      conversationId,
      lastMessage,
      participants,
      unreadCount: unreadCountRows[0]?.count ?? 0,
    });
  }

  return summaries;
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
// MESSAGE REACTIONS
// ============================================================================

export async function getMessageReactions(messageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select()
    .from(messageReactions)
    .where(eq(messageReactions.messageId, messageId));
}

export async function addMessageReaction(data: InsertMessageReaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if reaction already exists
  const existing = await db.select()
    .from(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, data.messageId),
        eq(messageReactions.userId, data.userId),
        eq(messageReactions.reaction, data.reaction)
      )
    );
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const result = await db.insert(messageReactions).values(data);
  return { id: result[0].insertId, ...data };
}

export async function removeMessageReaction(messageId: number, userId: number, reaction: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messageReactions).where(
    and(
      eq(messageReactions.messageId, messageId),
      eq(messageReactions.userId, userId),
      eq(messageReactions.reaction, reaction)
    )
  );
}

export async function getConversationReactions(conversationId: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all message IDs in the conversation
  const conversationMessages = await db.select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversationId, conversationId));
  
  if (conversationMessages.length === 0) return [];
  
  const messageIds = conversationMessages.map(m => m.id);
  return db.select()
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, messageIds));
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


// ============================================================================
// USER INVITATIONS (Manager-created invites)
// ============================================================================

export async function createUserInvitation(data: InsertUserInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userInvitations).values(data);
  return result[0].insertId;
}

export async function getUserInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userInvitations).where(eq(userInvitations.token, token)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserInvitations(options: {
  limit?: number;
  offset?: number;
  status?: "pending" | "accepted" | "expired" | "revoked";
}) {
  const db = await getDb();
  if (!db) return { invitations: [], total: 0 };
  
  const { limit = 20, offset = 0, status } = options;
  
  const conditions = [];
  if (status) {
    conditions.push(eq(userInvitations.status, status));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userInvitations)
    .where(whereClause);
  const total = countResult[0]?.count ?? 0;
  
  const invitationList = await db
    .select()
    .from(userInvitations)
    .where(whereClause)
    .orderBy(desc(userInvitations.createdAt))
    .limit(limit)
    .offset(offset);
  
  return { invitations: invitationList, total };
}

export async function updateUserInvitation(id: number, data: Partial<InsertUserInvitation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(userInvitations).set(data).where(eq(userInvitations.id, id));
}

export async function revokeUserInvitation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(userInvitations).set({ status: "revoked" }).where(eq(userInvitations.id, id));
}

// ============================================================================
// USER ACTIVITY LOGS (Admin actions on users)
// ============================================================================

export async function logUserActivity(data: InsertUserActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(userActivityLogs).values(data);
}

export async function getUserActivityLogs(targetUserId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userActivityLogs)
    .where(eq(userActivityLogs.targetUserId, targetUserId))
    .orderBy(desc(userActivityLogs.createdAt))
    .limit(limit);
}

export async function getRecentActivityLogs(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(userActivityLogs)
    .orderBy(desc(userActivityLogs.createdAt))
    .limit(limit);
}


// ============================================================================
// CLIENT-TRAINER RELATIONSHIPS (My Trainers feature)
// ============================================================================

/**
 * Get all trainers that a client is currently working with
 * Returns trainers where the user has an active client relationship
 */
export async function getMyTrainers(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Find all client records where this user is linked
  const clientRecords = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.userId, userId),
        inArray(clients.status, ["active", "pending"])
      )
    );
  
  if (clientRecords.length === 0) return [];
  
  // Get trainer IDs
  const trainerIds = clientRecords.map(c => c.trainerId);
  
  // Get trainer details
  const trainers = await db
    .select()
    .from(users)
    .where(inArray(users.id, trainerIds));
  
  // Combine trainer info with relationship info
  return trainers.map(trainer => {
    const clientRecord = clientRecords.find(c => c.trainerId === trainer.id);
    return {
      ...trainer,
      relationshipId: clientRecord?.id,
      relationshipStatus: clientRecord?.status,
      joinedDate: clientRecord?.acceptedAt || clientRecord?.createdAt,
      isPrimary: clientRecord?.id === clientRecords[0]?.id, // First trainer is primary
    };
  });
}

/**
 * Get active bundles count for a client-trainer relationship
 */
export async function getActiveBundlesCount(trainerId: number, clientUserId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  // Find the client record
  const clientRecord = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.trainerId, trainerId),
        eq(clients.userId, clientUserId)
      )
    )
    .limit(1);
  
  if (clientRecord.length === 0) return 0;
  
  // Count active subscriptions
  const subs = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.clientId, clientRecord[0].id),
        eq(subscriptions.status, "active")
      )
    );
  
  return subs[0]?.count ?? 0;
}

/**
 * Remove a trainer from client's roster (soft delete - marks as removed)
 */
export async function removeTrainerFromClient(trainerId: number, clientUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(clients)
    .set({ status: "removed" })
    .where(
      and(
        eq(clients.trainerId, trainerId),
        eq(clients.userId, clientUserId)
      )
    );
}

/**
 * Get trainers available for discovery (not already connected to user)
 */
export async function getAvailableTrainers(userId: number, search?: string, specialty?: string) {
  const db = await getDb();
  if (!db) return [];
  
  // Get IDs of trainers already connected to this user
  const existingConnections = await db
    .select({ trainerId: clients.trainerId })
    .from(clients)
    .where(
      and(
        eq(clients.userId, userId),
        inArray(clients.status, ["active", "pending"])
      )
    );
  
  const connectedTrainerIds = existingConnections.map(c => c.trainerId);
  
  // Build conditions for trainer search
  const conditions = [eq(users.role, "trainer"), eq(users.active, true)];
  
  // Exclude already connected trainers
  if (connectedTrainerIds.length > 0) {
    conditions.push(sql`${users.id} NOT IN (${connectedTrainerIds.join(",")})`);
  }
  
  // Add search filter
  if (search) {
    conditions.push(
      or(
        like(users.name, `%${search}%`),
        like(users.bio, `%${search}%`),
        like(users.username, `%${search}%`)
      )!
    );
  }
  
  return db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(50);
}

/**
 * Create a join request from client to trainer
 */
export async function createJoinRequest(trainerId: number, userId: number, message?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if relationship already exists
  const existing = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.trainerId, trainerId),
        eq(clients.userId, userId)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    // Reactivate if previously removed
    if (existing[0].status === "removed") {
      await db
        .update(clients)
        .set({ status: "pending", notes: message })
        .where(eq(clients.id, existing[0].id));
      return existing[0].id;
    }
    throw new Error("Already connected to this trainer");
  }
  
  // Get user info for the client record
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (user.length === 0) throw new Error("User not found");
  
  // Create new pending client record
  const result = await db.insert(clients).values({
    trainerId,
    userId,
    name: user[0].name || "Unknown",
    email: user[0].email,
    phone: user[0].phone,
    photoUrl: user[0].photoUrl,
    status: "pending",
    notes: message,
    invitedAt: new Date(),
  });
  
  return result[0].insertId;
}

/**
 * Get pending join requests for a user (requests they've sent)
 */
export async function getPendingJoinRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const pending = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.userId, userId),
        eq(clients.status, "pending")
      )
    );
  
  if (pending.length === 0) return [];
  
  // Get trainer details
  const trainerIds = pending.map(p => p.trainerId);
  const trainers = await db
    .select()
    .from(users)
    .where(inArray(users.id, trainerIds));
  
  return pending.map(request => ({
    ...request,
    trainer: trainers.find(t => t.id === request.trainerId),
  }));
}

/**
 * Cancel a pending join request
 */
export async function cancelJoinRequest(requestId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Verify the request belongs to this user
  const request = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.id, requestId),
        eq(clients.userId, userId),
        eq(clients.status, "pending")
      )
    )
    .limit(1);
  
  if (request.length === 0) throw new Error("Request not found");
  
  await db.delete(clients).where(eq(clients.id, requestId));
}

/**
 * Get trainer's published bundles count
 */
export async function getTrainerBundleCount(trainerId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(bundleDrafts)
    .where(
      and(
        eq(bundleDrafts.trainerId, trainerId),
        eq(bundleDrafts.status, "published")
      )
    );
  
  return result[0]?.count ?? 0;
}
