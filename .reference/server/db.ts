import { eq, and, desc, asc, sql, inArray, like, or, isNull, isNotNull, gte, lte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  bundleTemplates,
  bundleDrafts,
  bundlePublications,
  products,
  clients,
  subscriptions,
  sessions,
  orders,
  orderItems,
  messages,
  calendarEvents,
  predictivePrompts,
  trainerApprovals,
  bundleReviews,
  activityLogs,
  recommendations,
  calendarConnections,
  invitations,
  joinRequests,
  impersonationLogs,
  impersonationShortcuts,
  revokedSessions,
  trainerMedia,
  InsertRevokedSession,
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
  InsertTrainerApproval,
  InsertBundleReview,
  InsertActivityLog,
  InsertRecommendation,
  InsertBundlePublication,
  InsertInvitation,
  InsertJoinRequest,
  InsertImpersonationLog,
  InsertImpersonationShortcut,
  InsertTrainerMedia,
  tagColors,
  productSPF,
  platformSettings,
  InsertProductSPF,
  InsertPlatformSetting,
  serviceDeliveries,
  trainerEarnings,
  InsertServiceDelivery,
  InsertTrainerEarning,
  localBusinesses,
  adPartnerships,
  adPlacements,
  adEarnings,
  InsertLocalBusiness,
  InsertAdPartnership,
  InsertAdPlacement,
  InsertAdEarning,
  orderLineItems,
  trainerPoints,
  pointTransactions,
  trainerAwards,
  InsertOrderLineItem,
  InsertTrainerPoint,
  InsertPointTransaction,
  InsertTrainerAward,
  productDeliveries,
  InsertProductDelivery,
  bundleInvitations,
  InsertBundleInvitation,
  analyticsReports,
  InsertAnalyticsReport,
  shopifySyncResults,
  InsertShopifySyncResult,
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

    const textFields = ["name", "email", "phone", "photoUrl", "loginMethod", "shopDomain"] as const;
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
      // Only set default role for owner on INSERT (first login)
      // Don't override existing role on UPDATE
      values.role = "manager";
      // Note: We intentionally do NOT add role to updateSet here
      // This preserves any manually-set role (like coordinator) on subsequent logins
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

export async function getPendingTrainers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trainerApprovals)
    .innerJoin(users, eq(trainerApprovals.trainerId, users.id))
    .where(eq(trainerApprovals.status, "pending"))
    .orderBy(desc(trainerApprovals.createdAt));
}

// Get all trainers with their approval status and stats
export async function getTrainersWithStats() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all trainers
  const trainers = await db
    .select()
    .from(users)
    .where(eq(users.role, "trainer"))
    .orderBy(desc(users.createdAt));
  
  // Guard against empty trainers array to prevent invalid SQL (IN ())
  if (trainers.length === 0) {
    return [];
  }
  
  const trainerIds = trainers.map(t => t.id);
  
  // Get approval statuses
  const approvals = await db
    .select()
    .from(trainerApprovals)
    .where(inArray(trainerApprovals.trainerId, trainerIds));
  
  // Get client counts per trainer
  const clientCounts = await db
    .select({
      trainerId: clients.trainerId,
      count: sql<number>`COUNT(*)`
    })
    .from(clients)
    .where(and(
      inArray(clients.trainerId, trainerIds),
      eq(clients.status, "active")
    ))
    .groupBy(clients.trainerId);
  
  // Get bundle counts per trainer
  const bundleCounts = await db
    .select({
      trainerId: bundleDrafts.trainerId,
      count: sql<number>`COUNT(*)`
    })
    .from(bundleDrafts)
    .where(and(
      inArray(bundleDrafts.trainerId, trainerIds),
      eq(bundleDrafts.status, "published")
    ))
    .groupBy(bundleDrafts.trainerId);
  
  // Combine data
  return trainers.map(trainer => {
    const approval = approvals.find(a => a.trainerId === trainer.id);
    const clientCount = clientCounts.find(c => c.trainerId === trainer.id);
    const bundleCount = bundleCounts.find(b => b.trainerId === trainer.id);
    
    return {
      ...trainer,
      approvalStatus: approval?.status || "pending",
      applicationData: approval?.applicationData,
      clientCount: clientCount?.count || 0,
      bundleCount: bundleCount?.count || 0,
    };
  });
}

// Get a single trainer with full details
export async function getTrainerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "trainer")))
    .limit(1);
  
  if (result.length === 0) return undefined;
  
  const trainer = result[0];
  
  // Get approval status
  const approvalResult = await db
    .select()
    .from(trainerApprovals)
    .where(eq(trainerApprovals.trainerId, id))
    .limit(1);
  
  // Get client count
  const clientCountResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(clients)
    .where(and(eq(clients.trainerId, id), eq(clients.status, "active")));
  
  // Get bundle count
  const bundleCountResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(bundleDrafts)
    .where(and(eq(bundleDrafts.trainerId, id), eq(bundleDrafts.status, "published")));
  
  // Get recent clients with user info
  const recentClientsRaw = await db
    .select({
      id: clients.id,
      status: clients.status,
      createdAt: clients.createdAt,
      userId: clients.userId,
      userName: users.name,
      userPhotoUrl: users.photoUrl,
    })
    .from(clients)
    .leftJoin(users, eq(clients.userId, users.id))
    .where(eq(clients.trainerId, id))
    .orderBy(desc(clients.createdAt))
    .limit(5);
  
  const recentClients = recentClientsRaw.map(c => ({
    ...c,
    name: c.userName || `Client #${c.id}`,
    photoUrl: c.userPhotoUrl,
  }));
  
  // Get published bundles with subscriber counts
  const publishedBundlesRaw = await db
    .select()
    .from(bundleDrafts)
    .where(and(eq(bundleDrafts.trainerId, id), eq(bundleDrafts.status, "published")))
    .orderBy(desc(bundleDrafts.updatedAt));
  
  // Get subscriber counts for each bundle from orders
  const publishedBundles = await Promise.all(
    publishedBundlesRaw.map(async (bundle) => {
      // Count unique customers who have ordered this bundle
      const subscriberCount = await db
        .select({ count: sql<number>`COUNT(DISTINCT customerEmail)` })
        .from(orders)
        .where(eq(orders.bundlePublicationId, bundle.id));
      return {
        ...bundle,
        subscriberCount: subscriberCount[0]?.count || 0,
      };
    })
  );
  
  return {
    ...trainer,
    approvalStatus: approvalResult[0]?.status || "pending",
    applicationData: approvalResult[0]?.applicationData,
    reviewNotes: approvalResult[0]?.reviewNotes,
    clientCount: clientCountResult[0]?.count || 0,
    bundleCount: bundleCountResult[0]?.count || 0,
    recentClients,
    publishedBundles,
  };
}

// Update trainer approval status
export async function updateTrainerApproval(
  trainerId: number,
  status: "pending" | "approved" | "rejected" | "suspended",
  reviewNotes?: string,
  managerId?: number
) {
  const db = await getDb();
  if (!db) return;
  
  // Check if approval record exists
  const existing = await db
    .select()
    .from(trainerApprovals)
    .where(eq(trainerApprovals.trainerId, trainerId))
    .limit(1);
  
  if (existing.length > 0) {
    await db
      .update(trainerApprovals)
      .set({
        status,
        reviewNotes,
        managerId,
        reviewedAt: new Date(),
      })
      .where(eq(trainerApprovals.trainerId, trainerId));
  } else {
    await db.insert(trainerApprovals).values({
      trainerId,
      status,
      reviewNotes,
      managerId,
      reviewedAt: status !== "pending" ? new Date() : undefined,
    });
  }
  
  // Update user active status based on approval
  if (status === "suspended" || status === "rejected") {
    await db.update(users).set({ active: false }).where(eq(users.id, trainerId));
  } else if (status === "approved") {
    await db.update(users).set({ active: true }).where(eq(users.id, trainerId));
  }
}

// ============================================================================
// BUNDLE TEMPLATE OPERATIONS
// ============================================================================

export async function getBundleTemplates(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const query = activeOnly
    ? db.select().from(bundleTemplates).where(eq(bundleTemplates.active, true))
    : db.select().from(bundleTemplates);
  return query.orderBy(desc(bundleTemplates.createdAt));
}

export async function getBundleTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bundleTemplates).where(eq(bundleTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBundleTemplate(template: InsertBundleTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bundleTemplates).values(template);
  return result[0].insertId;
}

export async function updateBundleTemplate(id: number, template: Partial<InsertBundleTemplate>) {
  const db = await getDb();
  if (!db) return;
  await db.update(bundleTemplates).set(template).where(eq(bundleTemplates.id, id));
}

export async function deleteBundleTemplate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(bundleTemplates).set({ active: false }).where(eq(bundleTemplates.id, id));
}

// ============================================================================
// BUNDLE DRAFT OPERATIONS
// ============================================================================

export async function getBundleDraftsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bundleDrafts)
    .where(eq(bundleDrafts.trainerId, trainerId))
    .orderBy(desc(bundleDrafts.updatedAt));
}

export async function getBundleDraftById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(bundleDrafts).where(eq(bundleDrafts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBundleDraft(draft: InsertBundleDraft) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bundleDrafts).values(draft);
  return result[0].insertId;
}

export async function updateBundleDraft(id: number, draft: Partial<InsertBundleDraft>) {
  const db = await getDb();
  if (!db) return;
  await db.update(bundleDrafts).set(draft).where(eq(bundleDrafts.id, id));
}

export async function deleteBundleDraft(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(bundleDrafts).where(eq(bundleDrafts.id, id));
}

export async function getPublishedBundles() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bundleDrafts)
    .where(eq(bundleDrafts.status, "published"))
    .orderBy(desc(bundleDrafts.updatedAt));
}

export async function getPublishedBundlesByGoal(goalType: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      draft: bundleDrafts,
      template: bundleTemplates,
    })
    .from(bundleDrafts)
    .leftJoin(bundleTemplates, eq(bundleDrafts.templateId, bundleTemplates.id))
    .where(
      and(
        eq(bundleDrafts.status, "published"),
        goalType !== "all" ? eq(bundleTemplates.goalType, goalType as any) : undefined
      )
    )
    .orderBy(desc(bundleDrafts.updatedAt));
}

// ============================================================================
// BUNDLE PUBLICATION OPERATIONS
// ============================================================================

export async function createBundlePublication(publication: InsertBundlePublication) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bundlePublications).values(publication);
  return result[0].insertId;
}

export async function updateBundlePublication(id: number, publication: Partial<InsertBundlePublication>) {
  const db = await getDb();
  if (!db) return;
  await db.update(bundlePublications).set(publication).where(eq(bundlePublications.id, id));
}

export async function getBundlePublicationByDraftId(draftId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(bundlePublications)
    .where(eq(bundlePublications.draftId, draftId))
    .orderBy(desc(bundlePublications.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBundlePublicationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(bundlePublications)
    .where(eq(bundlePublications.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getBundlePublicationByShopifyProductId(shopifyProductId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(bundlePublications)
    .where(eq(bundlePublications.shopifyProductId, shopifyProductId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Get all bundle publications (for filtering products)
export async function getAllBundlePublications() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: bundlePublications.id,
      shopifyProductId: bundlePublications.shopifyProductId,
    })
    .from(bundlePublications);
  return result;
}

// Get all published bundles for sync
export async function getPublishedBundlesForSync() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: bundlePublications.id,
      draftId: bundlePublications.draftId,
      shopifyProductId: bundlePublications.shopifyProductId,
      shopifyVariantId: bundlePublications.shopifyVariantId,
      syncStatus: bundlePublications.syncStatus,
      syncedAt: bundlePublications.syncedAt,
      lastSyncError: bundlePublications.lastSyncError,
    })
    .from(bundlePublications)
    .where(eq(bundlePublications.state, "published"));
  return result;
}

// Get bundles that need syncing (pending or failed)
export async function getBundlesNeedingSync() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({
      id: bundlePublications.id,
      draftId: bundlePublications.draftId,
      shopifyProductId: bundlePublications.shopifyProductId,
      shopifyVariantId: bundlePublications.shopifyVariantId,
      syncStatus: bundlePublications.syncStatus,
    })
    .from(bundlePublications)
    .where(
      and(
        eq(bundlePublications.state, "published"),
        or(
          eq(bundlePublications.syncStatus, "pending"),
          eq(bundlePublications.syncStatus, "failed")
        )
      )
    );
  return result;
}

// Update bundle sync status
export async function updateBundleSyncStatus(
  id: number,
  status: "synced" | "pending" | "failed" | "conflict",
  error?: string | null
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bundlePublications)
    .set({
      syncStatus: status,
      syncedAt: status === "synced" ? new Date() : undefined,
      lastSyncError: error ?? null,
    })
    .where(eq(bundlePublications.id, id));
}

// ============================================================================
// PRODUCT OPERATIONS
// ============================================================================

export async function getProducts(filters?: { category?: string; availability?: string }) {
  const db = await getDb();
  if (!db) return [];
  let conditions = [];
  if (filters?.category && filters.category !== "all") {
    conditions.push(eq(products.category, filters.category as any));
  }
  if (filters?.availability && filters.availability !== "all") {
    conditions.push(eq(products.availability, filters.availability as any));
  }
  const query =
    conditions.length > 0
      ? db.select().from(products).where(and(...conditions))
      : db.select().from(products);
  return query.orderBy(asc(products.name));
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getProductsByIds(ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  return db.select().from(products).where(inArray(products.id, ids));
}

export async function getProductByShopifyId(shopifyProductId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(products)
    .where(eq(products.shopifyProductId, shopifyProductId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProduct(product: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (product.shopifyProductId) {
    const existing = await db
      .select()
      .from(products)
      .where(eq(products.shopifyProductId, product.shopifyProductId))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(products)
        .set({ ...product, syncedAt: new Date() })
        .where(eq(products.id, existing[0].id));
      return existing[0].id;
    }
  }
  const result = await db.insert(products).values({ ...product, syncedAt: new Date() });
  return result[0].insertId;
}

// ============================================================================
// CLIENT OPERATIONS
// ============================================================================

export async function getClientsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(clients)
    .where(eq(clients.trainerId, trainerId))
    .orderBy(desc(clients.createdAt));
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createClient(client: InsertClient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clients).values(client);
  return result[0].insertId;
}

export async function updateClient(id: number, client: Partial<InsertClient>) {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set(client).where(eq(clients.id, id));
}

export async function deleteClient(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ status: "removed" }).where(eq(clients.id, id));
}

export async function updateClientStatus(id: number, status: "pending" | "active" | "inactive" | "removed") {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ status }).where(eq(clients.id, id));
}

export async function getClientByEmail(email: string, trainerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(clients)
    .where(and(eq(clients.email, email), eq(clients.trainerId, trainerId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// SUBSCRIPTION OPERATIONS
// ============================================================================

export async function getSubscriptionsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.clientId, clientId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function getSubscriptionsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.trainerId, trainerId))
    .orderBy(desc(subscriptions.createdAt));
}

export async function getActiveSubscriptions(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.trainerId, trainerId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.renewalDate));
}

export async function createSubscription(subscription: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(subscriptions).values(subscription);
  return result[0].insertId;
}

export async function updateSubscription(id: number, subscription: Partial<InsertSubscription>) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions).set(subscription).where(eq(subscriptions.id, id));
}

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

export async function getSessionsByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.clientId, clientId))
    .orderBy(desc(sessions.sessionDate));
}

export async function getUpcomingSessions(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      session: sessions,
      client: clients,
    })
    .from(sessions)
    .innerJoin(clients, eq(sessions.clientId, clients.id))
    .where(
      and(
        eq(clients.trainerId, trainerId),
        eq(sessions.status, "scheduled"),
        gte(sessions.sessionDate, new Date())
      )
    )
    .orderBy(asc(sessions.sessionDate));
}

export async function createSession(session: InsertSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sessions).values(session);
  return result[0].insertId;
}

export async function updateSession(id: number, session: Partial<InsertSession>) {
  const db = await getDb();
  if (!db) return;
  await db.update(sessions).set(session).where(eq(sessions.id, id));
}

// ============================================================================
// ORDER OPERATIONS
// ============================================================================

export async function getOrdersByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(eq(orders.trainerId, trainerId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrdersByClient(clientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(eq(orders.clientId, clientId))
    .orderBy(desc(orders.createdAt));
}

export async function getRecentOrders(trainerId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(orders)
    .where(eq(orders.trainerId, trainerId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function createOrder(order: InsertOrder) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orders).values(order);
  return result[0].insertId;
}

export async function updateOrder(id: number, order: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(orders).set(order).where(eq(orders.id, id));
}

export async function createOrderItems(items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db || items.length === 0) return;
  await db.insert(orderItems).values(items);
}

export async function getOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getOrderByShopifyId(shopifyOrderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.shopifyOrderId, shopifyOrderId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOrderItem(item: InsertOrderItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderItems).values(item);
  return result[0].insertId;
}

export async function updateOrderItemsFulfillment(
  orderId: number,
  fulfillmentStatus: "unfulfilled" | "fulfilled" | "restocked"
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(orderItems)
    .set({ fulfillmentStatus })
    .where(eq(orderItems.orderId, orderId));
}

export async function updateOrderItemByShopifyId(
  shopifyLineItemId: number,
  data: Partial<InsertOrderItem>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(orderItems)
    .set(data)
    .where(eq(orderItems.shopifyLineItemId, shopifyLineItemId));
}

// ============================================================================
// MESSAGE OPERATIONS
// ============================================================================

export async function getConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get distinct conversation IDs for this user
  const result = await db
    .select()
    .from(messages)
    .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
    .orderBy(desc(messages.createdAt));
  return result;
}

export async function getMessagesByConversation(conversationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

export async function createMessage(message: InsertMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(messages).values(message);
  return result[0].insertId;
}

export async function markMessagesAsRead(conversationId: string, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.receiverId, userId),
        isNull(messages.readAt)
      )
    );
}

// Alias for markMessagesAsRead
export const markMessagesRead = markMessagesAsRead;

// ============================================================================
// CALENDAR OPERATIONS
// ============================================================================

export async function getCalendarEvents(userId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  let conditions = [eq(calendarEvents.userId, userId)];
  if (startDate) conditions.push(gte(calendarEvents.startTime, startDate));
  if (endDate) conditions.push(lte(calendarEvents.endTime, endDate));
  return db
    .select()
    .from(calendarEvents)
    .where(and(...conditions))
    .orderBy(asc(calendarEvents.startTime));
}

export async function createCalendarEvent(event: InsertCalendarEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(calendarEvents).values(event);
  return result[0].insertId;
}

export async function updateCalendarEvent(id: number, event: Partial<InsertCalendarEvent>) {
  const db = await getDb();
  if (!db) return;
  await db.update(calendarEvents).set(event).where(eq(calendarEvents.id, id));
}

export async function deleteCalendarEvent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
}

// ============================================================================
// TRAINER APPROVAL OPERATIONS
// ============================================================================

export async function createTrainerApproval(approval: InsertTrainerApproval) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(trainerApprovals).values(approval);
  return result[0].insertId;
}

export async function getTrainerApprovalByTrainerId(trainerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(trainerApprovals)
    .where(eq(trainerApprovals.trainerId, trainerId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// ACTIVITY LOG OPERATIONS
// ============================================================================

export async function logActivity(log: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLogs).values(log);
}

export async function getRecentActivity(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

export async function getRecentActivityByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLogs).where(eq(activityLogs.userId, userId)).orderBy(desc(activityLogs.createdAt)).limit(limit);
}

// ============================================================================
// RECOMMENDATION OPERATIONS
// ============================================================================

export async function createRecommendation(recommendation: InsertRecommendation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(recommendations).values(recommendation);
  return result[0].insertId;
}

export async function getActiveRecommendations(targetType: string, targetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.targetType, targetType as any),
        eq(recommendations.targetId, targetId),
        eq(recommendations.status, "active")
      )
    )
    .orderBy(desc(recommendations.confidence));
}

// ============================================================================
// ANALYTICS / STATS HELPERS
// ============================================================================

export async function getTrainerStats(trainerId: number) {
  const db = await getDb();
  if (!db) return null;

  const [clientCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(clients)
    .where(and(eq(clients.trainerId, trainerId), eq(clients.status, "active")));

  const [bundleCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bundleDrafts)
    .where(and(eq(bundleDrafts.trainerId, trainerId), eq(bundleDrafts.status, "published")));

  const [revenueResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(totalAmount), 0)` })
    .from(orders)
    .where(eq(orders.trainerId, trainerId));

  const [subscriptionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscriptions)
    .where(and(eq(subscriptions.trainerId, trainerId), eq(subscriptions.status, "active")));

  return {
    activeClients: clientCount?.count || 0,
    publishedBundles: bundleCount?.count || 0,
    totalRevenue: revenueResult?.total || 0,
    activeSubscriptions: subscriptionCount?.count || 0,
  };
}

export async function getManagerStats() {
  const db = await getDb();
  if (!db) return null;

  const [trainerCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.role, "trainer"));

  const [activeTrainerCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, "trainer"), eq(users.active, true)));

  // Count pending trainer approvals
  const [pendingTrainerApprovalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainerApprovals)
    .where(eq(trainerApprovals.status, "pending"));

  // Count pending bundle approvals (bundles awaiting review)
  const [pendingBundleApprovalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.status, "pending_review"));

  const [bundleCount] = await db.select({ count: sql<number>`count(*)` }).from(bundleDrafts);

  const [publishedBundleCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.status, "published"));

  const [revenueResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(totalAmount), 0)` })
    .from(orders);

  // Total pending approvals = pending trainers + pending bundles
  const totalPendingApprovals = (pendingTrainerApprovalCount?.count || 0) + (pendingBundleApprovalCount?.count || 0);

  return {
    totalTrainers: trainerCount?.count || 0,
    activeTrainers: activeTrainerCount?.count || 0,
    pendingApprovals: totalPendingApprovals,
    totalBundles: bundleCount?.count || 0,
    publishedBundles: publishedBundleCount?.count || 0,
    totalRevenue: revenueResult?.total || 0,
  };
}


// ============================================================================
// INVITATION OPERATIONS
// ============================================================================

export async function createInvitation(invitation: InsertInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(invitations).values(invitation);
  return result[0].insertId;
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getInvitationsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(invitations)
    .where(eq(invitations.trainerId, trainerId))
    .orderBy(desc(invitations.createdAt));
}

export async function updateInvitation(id: number, data: Partial<InsertInvitation>) {
  const db = await getDb();
  if (!db) return;
  await db.update(invitations).set(data).where(eq(invitations.id, id));
}

export async function acceptInvitation(token: string, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  // Get the invitation
  const invitation = await getInvitationByToken(token);
  if (!invitation || invitation.status !== "pending") return undefined;
  
  // Check if expired
  if (invitation.expiresAt && invitation.expiresAt < new Date()) {
    await db.update(invitations).set({ status: "expired" }).where(eq(invitations.id, invitation.id));
    return undefined;
  }
  
  // Update invitation
  await db.update(invitations).set({
    status: "accepted",
    acceptedAt: new Date(),
    acceptedByUserId: userId,
  }).where(eq(invitations.id, invitation.id));
  
  // Update user role to client (keep existing trainerId if they already have one)
  // This allows users to be clients of multiple trainers
  const user = await getUserById(userId);
  if (user) {
    // Only update trainerId if user doesn't already have one (first trainer)
    // The clients table handles the many-to-many relationship
    const updateData: { role: "client"; trainerId?: number } = { role: "client" };
    if (!user.trainerId) {
      updateData.trainerId = invitation.trainerId;
    }
    await db.update(users).set(updateData).where(eq(users.id, userId));
    
    // Check if client record already exists for this trainer-user pair
    const existingClient = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.trainerId, invitation.trainerId),
        eq(clients.userId, userId)
      ))
      .limit(1);
    
    // Only create client record if it doesn't exist
    if (existingClient.length === 0) {
      await createClient({
        trainerId: invitation.trainerId,
        userId: userId,
        name: user.name || invitation.name || "Client",
        email: user.email || invitation.email,
        status: "active",
      });
    } else {
      // Update existing client record to active
      await db.update(clients).set({ status: "active", acceptedAt: new Date() })
        .where(eq(clients.id, existingClient[0].id));
    }
  }
  
  return invitation;
}

export async function getPendingInvitationByEmail(email: string, trainerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(invitations)
    .where(and(
      eq(invitations.email, email),
      eq(invitations.trainerId, trainerId),
      eq(invitations.status, "pending")
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// TRAINER LANDING PAGE OPERATIONS
// ============================================================================

export async function getTrainerByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(and(
      eq(users.username, username),
      eq(users.role, "trainer")
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTrainerProfile(userId: number, data: {
  username?: string;
  bio?: string;
  specialties?: string[];
  socialLinks?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({
    username: data.username,
    bio: data.bio,
    specialties: data.specialties,
    socialLinks: data.socialLinks,
  }).where(eq(users.id, userId));
}

export async function isUsernameAvailable(username: string, excludeUserId?: number) {
  const db = await getDb();
  if (!db) return false;
  const conditions = [eq(users.username, username)];
  if (excludeUserId) {
    conditions.push(sql`${users.id} != ${excludeUserId}`);
  }
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(...conditions));
  return (result[0]?.count || 0) === 0;
}

export async function getPublishedBundlesByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bundleDrafts)
    .where(and(
      eq(bundleDrafts.trainerId, trainerId),
      eq(bundleDrafts.status, "published")
    ))
    .orderBy(desc(bundleDrafts.createdAt));
}

// ============================================================================
// BUNDLE APPROVAL OPERATIONS (Admin)
// ============================================================================

export async function getAllBundles(status?: string) {
  const db = await getDb();
  if (!db) return [];
  
  if (status) {
    return db
      .select()
      .from(bundleDrafts)
      .where(eq(bundleDrafts.status, status as any))
      .orderBy(desc(bundleDrafts.createdAt));
  }
  
  return db
    .select()
    .from(bundleDrafts)
    .orderBy(desc(bundleDrafts.createdAt));
}

export async function getAllBundlesWithTrainer() {
  const db = await getDb();
  if (!db) return [];
  
  const bundles = await db
    .select()
    .from(bundleDrafts)
    .orderBy(desc(bundleDrafts.createdAt));
  
  // Get trainer info for each bundle
  const trainerIds = Array.from(new Set(bundles.map(b => b.trainerId).filter(Boolean)));
  const trainers = trainerIds.length > 0 
    ? await db.select().from(users).where(inArray(users.id, trainerIds as number[]))
    : [];
  
  return bundles.map(bundle => ({
    ...bundle,
    trainer: trainers.find(t => t.id === bundle.trainerId),
  }));
}

export async function getPendingBundleReviews() {
  const db = await getDb();
  if (!db) return [];
  
  // Get bundles that are pending_review
  const bundles = await db
    .select()
    .from(bundleDrafts)
    .where(eq(bundleDrafts.status, "pending_review"))
    .orderBy(asc(bundleDrafts.createdAt));
  
  // Get trainer info
  const trainerIds = Array.from(new Set(bundles.map(b => b.trainerId).filter(Boolean)));
  const trainers = trainerIds.length > 0 
    ? await db.select().from(users).where(inArray(users.id, trainerIds as number[]))
    : [];
  
  return bundles.map(bundle => ({
    ...bundle,
    trainer: trainers.find(t => t.id === bundle.trainerId),
  }));
}

export async function createBundleReview(review: InsertBundleReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bundleReviews).values(review);
  return result[0].insertId;
}

export async function approveBundleDraft(bundleId: number, reviewerId: number, notes?: string) {
  const db = await getDb();
  if (!db) return;
  
  // Update bundle status to published
  await db.update(bundleDrafts).set({ status: "published" }).where(eq(bundleDrafts.id, bundleId));
  
  // Create review record
  await createBundleReview({
    bundleDraftId: bundleId,
    reviewerId,
    status: "approved",
    reviewNotes: notes,
    reviewedAt: new Date(),
  });
}

export async function rejectBundleDraft(bundleId: number, reviewerId: number, notes: string) {
  const db = await getDb();
  if (!db) return;
  
  // Update bundle status back to draft
  await db.update(bundleDrafts).set({ status: "draft" }).where(eq(bundleDrafts.id, bundleId));
  
  // Create review record
  await createBundleReview({
    bundleDraftId: bundleId,
    reviewerId,
    status: "rejected",
    reviewNotes: notes,
    reviewedAt: new Date(),
  });
}

export async function requestBundleChanges(bundleId: number, reviewerId: number, notes: string) {
  const db = await getDb();
  if (!db) return;
  
  // Update bundle status back to draft
  await db.update(bundleDrafts).set({ status: "draft" }).where(eq(bundleDrafts.id, bundleId));
  
  // Create review record
  await createBundleReview({
    bundleDraftId: bundleId,
    reviewerId,
    status: "changes_requested",
    reviewNotes: notes,
    reviewedAt: new Date(),
  });
}

export async function getBundleReviewHistory(bundleId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bundleReviews)
    .where(eq(bundleReviews.bundleDraftId, bundleId))
    .orderBy(desc(bundleReviews.createdAt));
}

// ============================================================================
// ADMIN OVERSIGHT OPERATIONS
// ============================================================================

export async function getAllClients() {
  const db = await getDb();
  if (!db) return [];
  
  const clientList = await db
    .select()
    .from(clients)
    .orderBy(desc(clients.createdAt));
  
  // Get trainer info
  const trainerIds = Array.from(new Set(clientList.map(c => c.trainerId).filter(Boolean)));
  const trainers = trainerIds.length > 0 
    ? await db.select().from(users).where(inArray(users.id, trainerIds as number[]))
    : [];
  
  return clientList.map(client => ({
    ...client,
    trainer: trainers.find(t => t.id === client.trainerId),
  }));
}

export async function getAllInvitations() {
  const db = await getDb();
  if (!db) return [];
  
  // Get all bundle invitations
  const invitationList = await db
    .select()
    .from(bundleInvitations)
    .orderBy(desc(bundleInvitations.createdAt));
  
  // Get trainer info
  const trainerIds = Array.from(new Set(invitationList.map(i => i.trainerId).filter(Boolean)));
  const trainers = trainerIds.length > 0 
    ? await db.select().from(users).where(inArray(users.id, trainerIds as number[]))
    : [];
  
  // Get bundle info - need to join publications with drafts to get title
  const bundleIds = Array.from(new Set(invitationList.map(i => i.bundleId).filter(Boolean)));
  let bundleList: { id: number; title: string | null }[] = [];
  if (bundleIds.length > 0) {
    const pubs = await db.select().from(bundlePublications).where(inArray(bundlePublications.id, bundleIds as number[]));
    const draftIds = pubs.map(p => p.draftId).filter(Boolean);
    const drafts = draftIds.length > 0
      ? await db.select().from(bundleDrafts).where(inArray(bundleDrafts.id, draftIds))
      : [];
    bundleList = pubs.map(p => ({
      id: p.id,
      title: drafts.find(d => d.id === p.draftId)?.title || null,
    }));
  }
  
  // Get recipient user info (if they have accounts)
  const recipientEmails = Array.from(new Set(invitationList.map(i => i.email).filter(Boolean)));
  const recipients = recipientEmails.length > 0
    ? await db.select().from(users).where(inArray(users.email, recipientEmails as string[]))
    : [];
  
  return invitationList.map(invitation => {
    const trainer = trainers.find(t => t.id === invitation.trainerId);
    const bundle = bundleList.find(b => b.id === invitation.bundleId);
    const recipient = recipients.find(r => r.email === invitation.email);
    return {
      id: invitation.id,
      bundleId: invitation.bundleId,
      trainerId: invitation.trainerId,
      email: invitation.email,
      message: invitation.personalMessage,
      status: invitation.status,
      viewedAt: invitation.viewedAt,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      bundleTitle: bundle?.title || "Unknown Bundle",
      trainerName: trainer?.name || "Unknown Trainer",
      trainerPhotoUrl: trainer?.photoUrl,
      recipientName: recipient?.name || null,
      recipientPhotoUrl: recipient?.photoUrl || null,
    };
  });
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

// ============================================================================
// JOIN REQUESTS (Customer-initiated trainer requests)
// ============================================================================

export async function createJoinRequest(request: InsertJoinRequest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(joinRequests).values(request);
  return result[0].insertId;
}

export async function getJoinRequestsByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const requests = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.trainerId, trainerId))
    .orderBy(desc(joinRequests.createdAt));
  
  // Get user info for each request
  const userIds = requests.map(r => r.userId);
  const userList = userIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : [];
  
  return requests.map(request => ({
    ...request,
    user: userList.find(u => u.id === request.userId),
  }));
}

export async function getJoinRequestsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const requests = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.userId, userId))
    .orderBy(desc(joinRequests.createdAt));
  
  // Get trainer info for each request
  const trainerIds = requests.map(r => r.trainerId);
  const trainerList = trainerIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, trainerIds))
    : [];
  
  return requests.map(request => ({
    ...request,
    trainer: trainerList.find(t => t.id === request.trainerId),
  }));
}

export async function getPendingJoinRequest(trainerId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(joinRequests)
    .where(and(
      eq(joinRequests.trainerId, trainerId),
      eq(joinRequests.userId, userId),
      eq(joinRequests.status, "pending")
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getJoinRequestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateJoinRequest(id: number, data: Partial<InsertJoinRequest> & { reviewedAt?: Date }) {
  const db = await getDb();
  if (!db) return;
  await db.update(joinRequests).set(data).where(eq(joinRequests.id, id));
}

export async function approveJoinRequest(requestId: number, trainerId: number, notes?: string) {
  const db = await getDb();
  if (!db) return;
  
  const request = await getJoinRequestById(requestId);
  if (!request || request.trainerId !== trainerId) return;
  
  // Update request status
  await db.update(joinRequests).set({
    status: "approved",
    reviewedAt: new Date(),
    reviewNotes: notes,
  }).where(eq(joinRequests.id, requestId));
  
  // Get user info
  const userResult = await db.select().from(users).where(eq(users.id, request.userId)).limit(1);
  const user = userResult[0];
  
  // Create client record
  if (user) {
    await db.insert(clients).values({
      trainerId,
      userId: user.id,
      name: user.name || user.email || "Customer",
      email: user.email,
      phone: user.phone,
      photoUrl: user.photoUrl,
      status: "active",
      acceptedAt: new Date(),
    });
  }
  
  return { success: true };
}

export async function rejectJoinRequest(requestId: number, trainerId: number, notes?: string) {
  const db = await getDb();
  if (!db) return;
  
  const request = await getJoinRequestById(requestId);
  if (!request || request.trainerId !== trainerId) return;
  
  await db.update(joinRequests).set({
    status: "rejected",
    reviewedAt: new Date(),
    reviewNotes: notes,
  }).where(eq(joinRequests.id, requestId));
  
  return { success: true };
}

// ============================================================================
// TRAINER DIRECTORY (Public trainer discovery)
// ============================================================================

export async function getActiveTrainers() {
  const db = await getDb();
  if (!db) return [];
  
  const trainers = await db
    .select()
    .from(users)
    .where(and(
      eq(users.role, "trainer"),
      eq(users.active, true)
    ))
    .orderBy(asc(users.name));
  
  // Get bundle counts for each trainer
  const trainerIds = trainers.map(t => t.id);
  const bundleCounts = trainerIds.length > 0
    ? await db
        .select({
          trainerId: bundleDrafts.trainerId,
          count: sql<number>`count(*)`,
        })
        .from(bundleDrafts)
        .where(and(
          inArray(bundleDrafts.trainerId, trainerIds),
          eq(bundleDrafts.status, "published")
        ))
        .groupBy(bundleDrafts.trainerId)
    : [];
  
  // Get client counts for each trainer
  const clientCounts = trainerIds.length > 0
    ? await db
        .select({
          trainerId: clients.trainerId,
          count: sql<number>`count(*)`,
        })
        .from(clients)
        .where(and(
          inArray(clients.trainerId, trainerIds),
          eq(clients.status, "active")
        ))
        .groupBy(clients.trainerId)
    : [];
  
  return trainers.map(trainer => ({
    ...trainer,
    bundleCount: bundleCounts.find(b => b.trainerId === trainer.id)?.count || 0,
    clientCount: clientCounts.find(c => c.trainerId === trainer.id)?.count || 0,
  }));
}

export async function getTrainerWithBundles(trainerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const trainerResult = await db
    .select()
    .from(users)
    .where(and(
      eq(users.id, trainerId),
      eq(users.role, "trainer")
    ))
    .limit(1);
  
  if (trainerResult.length === 0) return undefined;
  
  const trainer = trainerResult[0];
  const bundles = await getPublishedBundlesByTrainer(trainerId);
  
  return {
    ...trainer,
    bundles,
  };
}

// Alias for getPendingBundleReviews
export const getBundlesPendingReview = getPendingBundleReviews;


// ============================================================================
// IMPERSONATION LOGS (Audit trail)
// ============================================================================

export async function createImpersonationLog(log: InsertImpersonationLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(impersonationLogs).values(log);
  return result[0].insertId;
}

export async function getImpersonationLogs(options?: { 
  adminUserId?: number; 
  limit?: number; 
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const { adminUserId, limit = 100, offset = 0 } = options || {};
  
  let query = db.select().from(impersonationLogs);
  
  if (adminUserId) {
    query = query.where(eq(impersonationLogs.adminUserId, adminUserId)) as typeof query;
  }
  
  const logs = await query
    .orderBy(desc(impersonationLogs.createdAt))
    .limit(limit)
    .offset(offset);
  
  // Get user info for admin and target users
  const adminIds = Array.from(new Set(logs.map(l => l.adminUserId)));
  const targetIds = Array.from(new Set(logs.map(l => l.targetUserId).filter(Boolean))) as number[];
  const allUserIds = Array.from(new Set([...adminIds, ...targetIds]));
  
  const userList = allUserIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, allUserIds))
    : [];
  
  return logs.map(log => ({
    ...log,
    adminUser: userList.find(u => u.id === log.adminUserId),
    targetUser: log.targetUserId ? userList.find(u => u.id === log.targetUserId) : null,
  }));
}

export async function getImpersonationLogCount(adminUserId?: number) {
  const db = await getDb();
  if (!db) return 0;
  
  let query = db.select({ count: sql<number>`count(*)` }).from(impersonationLogs);
  
  if (adminUserId) {
    query = query.where(eq(impersonationLogs.adminUserId, adminUserId)) as typeof query;
  }
  
  const result = await query;
  return result[0]?.count || 0;
}

export async function getRecentImpersonatedUsers(adminUserId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];
  
  // Get distinct recent impersonated users (only "start" actions, not "stop")
  const logs = await db
    .select({
      targetUserId: impersonationLogs.targetUserId,
      createdAt: sql<Date>`MAX(${impersonationLogs.createdAt})`.as('lastImpersonated'),
    })
    .from(impersonationLogs)
    .where(and(
      eq(impersonationLogs.adminUserId, adminUserId),
      eq(impersonationLogs.action, 'start'),
      isNotNull(impersonationLogs.targetUserId)
    ))
    .groupBy(impersonationLogs.targetUserId)
    .orderBy(desc(sql`MAX(${impersonationLogs.createdAt})`))
    .limit(limit);
  
  if (logs.length === 0) return [];
  
  // Get user info for target users
  const targetIds = logs.map(l => l.targetUserId).filter(Boolean) as number[];
  const userList = await db.select().from(users).where(inArray(users.id, targetIds));
  
  return logs.map(log => ({
    userId: log.targetUserId,
    lastImpersonated: log.createdAt,
    user: userList.find(u => u.id === log.targetUserId),
  })).filter(l => l.user); // Only return if user still exists
}

// ============================================================================
// IMPERSONATION SHORTCUTS (Quick-switch favorites)
// ============================================================================

export async function createImpersonationShortcut(shortcut: InsertImpersonationShortcut) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if shortcut already exists
  const existing = await db
    .select()
    .from(impersonationShortcuts)
    .where(and(
      eq(impersonationShortcuts.adminUserId, shortcut.adminUserId),
      eq(impersonationShortcuts.targetUserId, shortcut.targetUserId)
    ))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0].id; // Already exists
  }
  
  // Get max sort order
  const maxOrder = await db
    .select({ max: sql<number>`COALESCE(MAX(sortOrder), 0)` })
    .from(impersonationShortcuts)
    .where(eq(impersonationShortcuts.adminUserId, shortcut.adminUserId));
  
  const result = await db.insert(impersonationShortcuts).values({
    ...shortcut,
    sortOrder: (maxOrder[0]?.max || 0) + 1,
  });
  return result[0].insertId;
}

export async function getImpersonationShortcuts(adminUserId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const shortcuts = await db
    .select()
    .from(impersonationShortcuts)
    .where(eq(impersonationShortcuts.adminUserId, adminUserId))
    .orderBy(asc(impersonationShortcuts.sortOrder));
  
  // Get user info for target users
  const targetIds = shortcuts.map(s => s.targetUserId);
  const userList = targetIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, targetIds))
    : [];
  
  return shortcuts.map(shortcut => ({
    ...shortcut,
    targetUser: userList.find(u => u.id === shortcut.targetUserId),
  }));
}

export async function deleteImpersonationShortcut(id: number, adminUserId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.delete(impersonationShortcuts).where(and(
    eq(impersonationShortcuts.id, id),
    eq(impersonationShortcuts.adminUserId, adminUserId)
  ));
}

export async function updateImpersonationShortcutOrder(adminUserId: number, shortcutIds: number[]) {
  const db = await getDb();
  if (!db) return;
  
  // Update sort order for each shortcut
  for (let i = 0; i < shortcutIds.length; i++) {
    await db
      .update(impersonationShortcuts)
      .set({ sortOrder: i })
      .where(and(
        eq(impersonationShortcuts.id, shortcutIds[i]),
        eq(impersonationShortcuts.adminUserId, adminUserId)
      ));
  }
}


// ============================================================================
// ANALYTICS (Revenue, performance metrics)
// ============================================================================

export async function getRevenueAnalytics(options?: { 
  startDate?: Date; 
  endDate?: Date;
  trainerId?: number;
}) {
  const db = await getDb();
  if (!db) return { totalRevenue: 0, orderCount: 0, revenueByMonth: [], topBundles: [], trainerPerformance: [] };
  
  const { startDate, endDate, trainerId } = options || {};
  
  // Get all orders with optional date filtering
  let orderQuery = db.select().from(orders);
  const conditions = [];
  
  if (startDate) {
    conditions.push(sql`${orders.createdAt} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${orders.createdAt} <= ${endDate}`);
  }
  
  const allOrders = conditions.length > 0
    ? await orderQuery.where(and(...conditions))
    : await orderQuery;
  
  // Calculate total revenue
  const totalRevenue = allOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const orderCount = allOrders.length;
  
  // Revenue by month (last 12 months)
  const revenueByMonth: { month: string; revenue: number; orders: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthOrders = allOrders.filter(o => {
      const orderDate = new Date(o.createdAt || 0);
      return orderDate >= monthDate && orderDate <= monthEnd;
    });
    revenueByMonth.push({
      month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: monthOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
      orders: monthOrders.length,
    });
  }
  
  // Get order items to find top bundles
  const orderIds = allOrders.map(o => o.id);
  const items = orderIds.length > 0
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
    : [];
  
  // Aggregate by product (as proxy for bundle performance)
  const productRevenue: Record<number, { productId: number; revenue: number; quantity: number; name: string }> = {};
  for (const item of items) {
    if (item.productId) {
      if (!productRevenue[item.productId]) {
        productRevenue[item.productId] = { productId: item.productId, revenue: 0, quantity: 0, name: item.name };
      }
      productRevenue[item.productId].revenue += Number(item.price || 0) * Number(item.quantity || 1);
      productRevenue[item.productId].quantity += Number(item.quantity || 1);
    }
  }
  
  // Get top selling products
  const topProducts = Object.values(productRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  // For trainer performance, we'll aggregate from orders directly
  // Get trainers who have bundles
  const allBundles = await db.select().from(bundleDrafts).where(eq(bundleDrafts.status, "published"));
  const trainerRevenue: Record<number, { trainerId: number; revenue: number; bundlesSold: number }> = {};
  
  // Simple aggregation - attribute revenue to trainers based on their published bundles
  for (const bundle of allBundles) {
    if (bundle.trainerId) {
      if (!trainerRevenue[bundle.trainerId]) {
        trainerRevenue[bundle.trainerId] = { trainerId: bundle.trainerId, revenue: 0, bundlesSold: 0 };
      }
      // Estimate based on bundle price (simplified)
      trainerRevenue[bundle.trainerId].bundlesSold += 1;
    }
  }
  
  // Distribute total revenue proportionally among trainers with bundles
  const trainerCount = Object.keys(trainerRevenue).length;
  if (trainerCount > 0) {
    const revenuePerTrainer = totalRevenue / trainerCount;
    for (const tid of Object.keys(trainerRevenue)) {
      trainerRevenue[Number(tid)].revenue = revenuePerTrainer;
    }
  }
  
  const trainerIds = Object.keys(trainerRevenue).map(Number);
  const trainers = trainerIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, trainerIds))
    : [];
  
  const trainerPerformance = Object.values(trainerRevenue)
    .map(t => ({
      ...t,
      trainer: trainers.find(trainer => trainer.id === t.trainerId),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
  
  return {
    totalRevenue,
    orderCount,
    revenueByMonth,
    topProducts,
    trainerPerformance,
  };
}

export async function getPendingCounts() {
  const db = await getDb();
  if (!db) return { pendingApprovals: 0, pendingTrainers: 0, pendingJoinRequests: 0 };
  
  // Pending bundle approvals
  const pendingBundles = await db
    .select({ count: sql<number>`count(*)` })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.status, "pending_review"));
  
  // Pending trainer approvals
  const pendingTrainers = await db
    .select({ count: sql<number>`count(*)` })
    .from(trainerApprovals)
    .where(eq(trainerApprovals.status, "pending"));
  
  // Pending join requests (for all trainers)
  const pendingJoins = await db
    .select({ count: sql<number>`count(*)` })
    .from(joinRequests)
    .where(eq(joinRequests.status, "pending"));
  
  return {
    pendingApprovals: pendingBundles[0]?.count || 0,
    pendingTrainers: pendingTrainers[0]?.count || 0,
    pendingJoinRequests: pendingJoins[0]?.count || 0,
  };
}

export async function getAllBundlesWithTrainers(options?: {
  status?: string;
  trainerId?: number;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const { status, trainerId, search, limit = 50, offset = 0 } = options || {};
  
  const conditions = [];
  if (status) {
    conditions.push(eq(bundleDrafts.status, status as "draft" | "pending_review" | "published"));
  }
  if (trainerId) {
    conditions.push(eq(bundleDrafts.trainerId, trainerId));
  }
  if (search) {
    conditions.push(sql`${bundleDrafts.title} LIKE ${`%${search}%`}`);
  }
  
  const bundleList = conditions.length > 0
    ? await db.select().from(bundleDrafts).where(and(...conditions)).orderBy(desc(bundleDrafts.updatedAt)).limit(limit).offset(offset)
    : await db.select().from(bundleDrafts).orderBy(desc(bundleDrafts.updatedAt)).limit(limit).offset(offset);
  
  // Get trainer info
  const trainerIds = Array.from(new Set(bundleList.map(b => b.trainerId).filter(Boolean)));
  const trainers = trainerIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, trainerIds as number[]))
    : [];
  
  return bundleList.map(bundle => ({
    ...bundle,
    trainer: trainers.find(t => t.id === bundle.trainerId),
  }));
}

export async function getBundleCountByStatus() {
  const db = await getDb();
  if (!db) return { draft: 0, pending_review: 0, published: 0, total: 0 };
  
  const counts = await db
    .select({
      status: bundleDrafts.status,
      count: sql<number>`count(*)`,
    })
    .from(bundleDrafts)
    .groupBy(bundleDrafts.status);
  
  const result = { draft: 0, pending_review: 0, published: 0, total: 0 };
  for (const row of counts) {
    if (row.status === "draft") result.draft = row.count;
    if (row.status === "pending_review") result.pending_review = row.count;
    if (row.status === "published") result.published = row.count;
    result.total += row.count;
  }
  
  return result;
}

// ============================================================================
// USERNAME GENERATION
// ============================================================================

/**
 * Generate a unique username from a name
 * @param name - The user's display name
 * @param userId - Optional user ID to use as suffix if base username is taken
 * @returns A unique username
 */
export async function generateUniqueUsername(name: string, userId?: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Generate base username from name: lowercase, replace spaces with underscores, remove special chars
  const baseUsername = name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 25); // Leave room for suffix
  
  if (!baseUsername) {
    // Fallback if name produces empty string
    return `user_${userId || Date.now()}`;
  }
  
  // Check if base username is available
  const isAvailable = await isUsernameAvailable(baseUsername, userId);
  if (isAvailable) {
    return baseUsername;
  }
  
  // Try with numeric suffix
  for (let i = 2; i <= 100; i++) {
    const candidateUsername = `${baseUsername}_${i}`;
    const available = await isUsernameAvailable(candidateUsername, userId);
    if (available) {
      return candidateUsername;
    }
  }
  
  // Fallback: use user ID or timestamp
  const fallbackSuffix = userId || Date.now();
  return `${baseUsername}_${fallbackSuffix}`;
}

/**
 * Ensure a user has a username, generating one if needed
 * @param userId - The user's ID
 * @param name - The user's display name (for generating username)
 * @returns The username (existing or newly generated)
 */
export async function ensureUserHasUsername(userId: number, name: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if user already has a username
  const user = await getUserById(userId);
  if (user?.username) {
    return user.username;
  }
  
  // Generate and set username
  const username = await generateUniqueUsername(name, userId);
  await db.update(users).set({ username }).where(eq(users.id, userId));
  
  return username;
}


// ============================================================================
// SESSION BLACKLIST (Server-side session invalidation)
// ============================================================================

import { createHash } from "crypto";

/**
 * Hash a session token for storage in the blacklist
 * We store the hash instead of the raw token for security
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Add a session token to the revocation blacklist
 * @param token - The raw session token to revoke
 * @param userId - Optional user ID for tracking
 * @param expiresAt - When the original token would have expired
 */
export async function revokeSession(
  token: string,
  userId?: number,
  expiresAt?: Date
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot revoke session: database not available");
    return;
  }

  const tokenHash = hashSessionToken(token);
  // Default expiry to 1 year from now if not provided (matches session token lifetime)
  const expiry = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  try {
    await db.insert(revokedSessions).values({
      tokenHash,
      userId: userId || null,
      expiresAt: expiry,
    }).onDuplicateKeyUpdate({
      set: { revokedAt: new Date() }, // Update revocation time if already exists
    });
    console.log("[Auth] Session revoked successfully");
  } catch (error) {
    console.error("[Auth] Failed to revoke session:", error);
    throw error;
  }
}

/**
 * Check if a session token has been revoked
 * @param token - The raw session token to check
 * @returns true if the session is revoked (invalid), false if still valid
 */
export async function isSessionRevoked(token: string): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    // If database is unavailable, allow the session (fail open)
    // This is a trade-off: we prefer availability over strict security
    console.warn("[Database] Cannot check session revocation: database not available");
    return false;
  }

  const tokenHash = hashSessionToken(token);
  console.log("[Auth] Checking revocation for token hash:", tokenHash);

  try {
    const result = await db
      .select({ id: revokedSessions.id })
      .from(revokedSessions)
      .where(eq(revokedSessions.tokenHash, tokenHash))
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error("[Auth] Failed to check session revocation:", error);
    // Fail open on error
    return false;
  }
}

/**
 * Clean up expired entries from the revocation blacklist
 * Should be called periodically (e.g., daily) to prevent table bloat
 */
export async function cleanupExpiredRevokedSessions(): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot cleanup revoked sessions: database not available");
    return 0;
  }

  try {
    const result = await db
      .delete(revokedSessions)
      .where(lte(revokedSessions.expiresAt, new Date()));
    
    // MySQL returns affectedRows in the result
    const deletedCount = (result as any)[0]?.affectedRows || 0;
    console.log(`[Auth] Cleaned up ${deletedCount} expired revoked sessions`);
    return deletedCount;
  } catch (error) {
    console.error("[Auth] Failed to cleanup revoked sessions:", error);
    return 0;
  }
}

// ============================================================================
// PASSWORD AUTHENTICATION
// ============================================================================

import bcrypt from "bcrypt";

const BCRYPT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Get a user by email address
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Create a user with email/password authentication
 */
export async function createUserWithPassword(data: {
  email: string;
  password: string;
  name: string;
  role?: InsertUser["role"];
}): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const passwordHash = await hashPassword(data.password);
  
  // Generate a unique openId for password-based users
  const openId = `pwd_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  const result = await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    passwordHash,
    loginMethod: "password",
    role: data.role || "shopper",
  });
  
  return (result as any)[0]?.insertId || null;
}

/**
 * Update a user's password
 */
export async function updateUserPassword(userId: number, newPassword: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

/**
 * Authenticate a user with email and password
 * Returns the user if credentials are valid, null otherwise
 */
export async function authenticateWithPassword(email: string, password: string) {
  const user = await getUserByEmail(email);
  
  if (!user || !user.passwordHash) {
    // User doesn't exist or doesn't have password auth enabled
    return null;
  }
  
  const isValid = await verifyPassword(password, user.passwordHash);
  
  if (!isValid) {
    return null;
  }
  
  // Update last signed in timestamp
  const db = await getDb();
  if (db) {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  }
  
  return user;
}


// ============================================================================
// TRAINER MEDIA FUNCTIONS
// ============================================================================

/**
 * Get all media for a trainer
 */
export async function getTrainerMedia(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(trainerMedia)
    .where(eq(trainerMedia.trainerId, trainerId))
    .orderBy(asc(trainerMedia.sortOrder), desc(trainerMedia.createdAt));
  
  return result;
}

/**
 * Get trainer media by type
 */
export async function getTrainerMediaByType(
  trainerId: number,
  type: "profile_photo" | "gallery_image" | "video" | "bundle_cover"
) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(trainerMedia)
    .where(and(
      eq(trainerMedia.trainerId, trainerId),
      eq(trainerMedia.type, type)
    ))
    .orderBy(asc(trainerMedia.sortOrder), desc(trainerMedia.createdAt));
  
  return result;
}

/**
 * Get trainer's profile photo
 */
export async function getTrainerProfilePhoto(trainerId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(trainerMedia)
    .where(and(
      eq(trainerMedia.trainerId, trainerId),
      eq(trainerMedia.type, "profile_photo")
    ))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Create trainer media entry
 */
export async function createTrainerMedia(data: InsertTrainerMedia): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  // If it's a profile photo, delete existing one first
  if (data.type === "profile_photo") {
    await db.delete(trainerMedia).where(and(
      eq(trainerMedia.trainerId, data.trainerId),
      eq(trainerMedia.type, "profile_photo")
    ));
  }
  
  const result = await db.insert(trainerMedia).values(data);
  return (result as any)[0]?.insertId || null;
}

/**
 * Update trainer media entry
 */
export async function updateTrainerMedia(
  id: number,
  trainerId: number,
  data: Partial<InsertTrainerMedia>
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .update(trainerMedia)
    .set({ ...data, updatedAt: new Date() })
    .where(and(
      eq(trainerMedia.id, id),
      eq(trainerMedia.trainerId, trainerId)
    ));
  
  return (result as any)[0]?.affectedRows > 0;
}

/**
 * Delete trainer media entry
 */
export async function deleteTrainerMedia(id: number, trainerId: number): Promise<{ fileKey: string | null } | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get the file key before deleting
  const existing = await db
    .select({ fileKey: trainerMedia.fileKey })
    .from(trainerMedia)
    .where(and(
      eq(trainerMedia.id, id),
      eq(trainerMedia.trainerId, trainerId)
    ))
    .limit(1);
  
  if (existing.length === 0) return null;
  
  await db.delete(trainerMedia).where(and(
    eq(trainerMedia.id, id),
    eq(trainerMedia.trainerId, trainerId)
  ));
  
  return { fileKey: existing[0].fileKey };
}

/**
 * Reorder trainer gallery images
 */
export async function reorderTrainerGallery(
  trainerId: number,
  orderedIds: number[]
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  
  // Update sort order for each image
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(trainerMedia)
      .set({ sortOrder: i })
      .where(and(
        eq(trainerMedia.id, orderedIds[i]),
        eq(trainerMedia.trainerId, trainerId),
        eq(trainerMedia.type, "gallery_image")
      ));
  }
  
  return true;
}

/**
 * Get gallery image count for a trainer
 */
export async function getTrainerGalleryCount(trainerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(trainerMedia)
    .where(and(
      eq(trainerMedia.trainerId, trainerId),
      eq(trainerMedia.type, "gallery_image")
    ));
  
  return result[0]?.count || 0;
}

/**
 * Get video count for a trainer
 */
export async function getTrainerVideoCount(trainerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(trainerMedia)
    .where(and(
      eq(trainerMedia.trainerId, trainerId),
      eq(trainerMedia.type, "video")
    ));
  
  return result[0]?.count || 0;
}


/**
 * Update a user's photo URL
 */
export async function updateUserPhotoUrl(userId: number, photoUrl: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  await db.update(users).set({ photoUrl }).where(eq(users.id, userId));
}


// ============================================================================
// BUNDLE ANALYTICS OPERATIONS
// ============================================================================

/**
 * Get sales analytics for a specific bundle by Shopify product ID
 */
export async function getBundleSalesByShopifyProductId(shopifyProductId: string) {
  const db = await getDb();
  if (!db) return { salesCount: 0, totalRevenue: 0, lastSaleAt: null };
  
  // First find the bundle publication
  const publication = await getBundlePublicationByShopifyProductId(shopifyProductId);
  if (!publication) {
    return { salesCount: 0, totalRevenue: 0, lastSaleAt: null };
  }
  
  // Get orders for this bundle
  const result = await db
    .select({
      salesCount: sql<number>`COUNT(*)`,
      totalRevenue: sql<number>`COALESCE(SUM(totalAmount), 0)`,
      lastSaleAt: sql<Date>`MAX(createdAt)`,
    })
    .from(orders)
    .where(eq(orders.bundlePublicationId, publication.id));
  
  return {
    salesCount: result[0]?.salesCount || 0,
    totalRevenue: result[0]?.totalRevenue || 0,
    lastSaleAt: result[0]?.lastSaleAt || null,
  };
}

/**
 * Get sales analytics for a bundle by draft ID
 */
export async function getBundleSalesByDraftId(draftId: number) {
  const db = await getDb();
  if (!db) return { salesCount: 0, totalRevenue: 0, lastSaleAt: null };
  
  // First find the bundle publication
  const publication = await getBundlePublicationByDraftId(draftId);
  if (!publication) {
    return { salesCount: 0, totalRevenue: 0, lastSaleAt: null };
  }
  
  // Get orders for this bundle
  const result = await db
    .select({
      salesCount: sql<number>`COUNT(*)`,
      totalRevenue: sql<number>`COALESCE(SUM(totalAmount), 0)`,
      lastSaleAt: sql<Date>`MAX(createdAt)`,
    })
    .from(orders)
    .where(eq(orders.bundlePublicationId, publication.id));
  
  return {
    salesCount: result[0]?.salesCount || 0,
    totalRevenue: result[0]?.totalRevenue || 0,
    lastSaleAt: result[0]?.lastSaleAt || null,
  };
}

/**
 * Get bundles with low inventory components
 */
export async function getBundlesWithLowInventory(threshold: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  // Get all published bundles
  const publishedBundles = await db
    .select()
    .from(bundleDrafts)
    .where(eq(bundleDrafts.status, "published"));
  
  const lowInventoryBundles: Array<{
    bundleId: number;
    bundleTitle: string;
    trainerId: number;
    lowInventoryProducts: Array<{
      productId: number;
      productName: string;
      inventory: number;
    }>;
  }> = [];
  
  for (const bundle of publishedBundles) {
    const productsJson = bundle.productsJson as Array<{
      id?: number;
      shopifyId?: number;
      name?: string;
      title?: string;
      quantity?: number;
    }> | null;
    
    if (!productsJson || productsJson.length === 0) continue;
    
    const lowInventoryProducts: Array<{
      productId: number;
      productName: string;
      inventory: number;
    }> = [];
    
    for (const product of productsJson) {
      const productId = product.id || product.shopifyId;
      if (!productId) continue;
      
      // Check inventory in our products table
      const [productData] = await db
        .select()
        .from(products)
        .where(eq(products.shopifyProductId, productId))
        .limit(1);
      
      if (productData && (productData.inventoryQuantity || 0) <= threshold) {
        lowInventoryProducts.push({
          productId: productId,
          productName: product.name || product.title || "Unknown",
          inventory: productData.inventoryQuantity || 0,
        });
      }
    }
    
    if (lowInventoryProducts.length > 0) {
      lowInventoryBundles.push({
        bundleId: bundle.id,
        bundleTitle: bundle.title,
        trainerId: bundle.trainerId,
        lowInventoryProducts,
      });
    }
  }
  
  return lowInventoryBundles;
}

/**
 * Get bundle by Shopify product ID
 */
export async function getBundleByShopifyProductId(shopifyProductId: number | string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const productIdNum = typeof shopifyProductId === "string" 
    ? parseInt(shopifyProductId, 10) 
    : shopifyProductId;
  
  const result = await db
    .select()
    .from(bundleDrafts)
    .where(eq(bundleDrafts.shopifyProductId, productIdNum))
    .limit(1);
  
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Increment bundle view count
 */
export async function incrementBundleViewCount(bundleId: number) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(bundleDrafts)
    .set({
      viewCount: sql`COALESCE(${bundleDrafts.viewCount}, 0) + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(bundleDrafts.id, bundleId));
}

/**
 * Increment bundle view count by Shopify product ID
 */
export async function incrementBundleViewCountByShopifyId(shopifyProductId: number | string) {
  const db = await getDb();
  if (!db) return;
  
  const productIdNum = typeof shopifyProductId === "string" 
    ? parseInt(shopifyProductId, 10) 
    : shopifyProductId;
  
  await db
    .update(bundleDrafts)
    .set({
      viewCount: sql`COALESCE(${bundleDrafts.viewCount}, 0) + 1`,
      lastViewedAt: new Date(),
    })
    .where(eq(bundleDrafts.shopifyProductId, productIdNum));
}

/**
 * Record a bundle sale (increment sales count and revenue)
 */
export async function recordBundleSale(bundleId: number, saleAmount: number) {
  const db = await getDb();
  if (!db) return;
  
  await db
    .update(bundleDrafts)
    .set({
      salesCount: sql`COALESCE(${bundleDrafts.salesCount}, 0) + 1`,
      totalRevenue: sql`COALESCE(${bundleDrafts.totalRevenue}, 0) + ${saleAmount}`,
      lastSoldAt: new Date(),
    })
    .where(eq(bundleDrafts.id, bundleId));
}

/**
 * Get bundle analytics
 */
export async function getBundleAnalytics(bundleId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select({
      id: bundleDrafts.id,
      title: bundleDrafts.title,
      viewCount: bundleDrafts.viewCount,
      salesCount: bundleDrafts.salesCount,
      totalRevenue: bundleDrafts.totalRevenue,
      lastViewedAt: bundleDrafts.lastViewedAt,
      lastSoldAt: bundleDrafts.lastSoldAt,
    })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.id, bundleId))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const bundle = result[0];
  const viewCount = bundle.viewCount || 0;
  const salesCount = bundle.salesCount || 0;
  const conversionRate = viewCount > 0 ? (salesCount / viewCount) * 100 : 0;
  
  return {
    ...bundle,
    conversionRate: Math.round(conversionRate * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Get bundle analytics by Shopify product ID
 */
export async function getBundleAnalyticsByShopifyId(shopifyProductId: number | string) {
  const db = await getDb();
  if (!db) return null;
  
  const productIdNum = typeof shopifyProductId === "string" 
    ? parseInt(shopifyProductId, 10) 
    : shopifyProductId;
  
  const result = await db
    .select({
      id: bundleDrafts.id,
      title: bundleDrafts.title,
      viewCount: bundleDrafts.viewCount,
      salesCount: bundleDrafts.salesCount,
      totalRevenue: bundleDrafts.totalRevenue,
      lastViewedAt: bundleDrafts.lastViewedAt,
      lastSoldAt: bundleDrafts.lastSoldAt,
    })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.shopifyProductId, productIdNum))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const bundle = result[0];
  const viewCount = bundle.viewCount || 0;
  const salesCount = bundle.salesCount || 0;
  const conversionRate = viewCount > 0 ? (salesCount / viewCount) * 100 : 0;
  
  return {
    ...bundle,
    conversionRate: Math.round(conversionRate * 10) / 10, // Round to 1 decimal
  };
}


/**
 * Get top performing bundles by various metrics
 */
export async function getTopPerformingBundles(
  sortBy: "revenue" | "sales" | "views" | "conversion" = "revenue",
  limit: number = 10
) {
  const db = await getDb();
  if (!db) return [];
  
  const bundles = await db
    .select({
      id: bundleDrafts.id,
      title: bundleDrafts.title,
      trainerId: bundleDrafts.trainerId,
      price: bundleDrafts.price,
      status: bundleDrafts.status,
      viewCount: bundleDrafts.viewCount,
      salesCount: bundleDrafts.salesCount,
      totalRevenue: bundleDrafts.totalRevenue,
      lastViewedAt: bundleDrafts.lastViewedAt,
      lastSoldAt: bundleDrafts.lastSoldAt,
      shopifyProductId: bundleDrafts.shopifyProductId,
      imageUrl: bundleDrafts.imageUrl,
    })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.status, "published"));
  
  // Calculate conversion rate and sort
  const bundlesWithConversion = bundles.map(bundle => {
    const viewCount = bundle.viewCount || 0;
    const salesCount = bundle.salesCount || 0;
    const conversionRate = viewCount > 0 ? (salesCount / viewCount) * 100 : 0;
    
    return {
      ...bundle,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  });
  
  // Sort by requested metric
  bundlesWithConversion.sort((a, b) => {
    switch (sortBy) {
      case "revenue":
        return (parseFloat(String(b.totalRevenue || 0)) - parseFloat(String(a.totalRevenue || 0)));
      case "sales":
        return ((b.salesCount || 0) - (a.salesCount || 0));
      case "views":
        return ((b.viewCount || 0) - (a.viewCount || 0));
      case "conversion":
        return (b.conversionRate - a.conversionRate);
      default:
        return 0;
    }
  });
  
  return bundlesWithConversion.slice(0, limit);
}

/**
 * Get bundle performance summary
 */
export async function getBundlePerformanceSummary() {
  const db = await getDb();
  if (!db) return null;
  
  const bundles = await db
    .select({
      viewCount: bundleDrafts.viewCount,
      salesCount: bundleDrafts.salesCount,
      totalRevenue: bundleDrafts.totalRevenue,
    })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.status, "published"));
  
  const totalViews = bundles.reduce((sum, b) => sum + (b.viewCount || 0), 0);
  const totalSales = bundles.reduce((sum, b) => sum + (b.salesCount || 0), 0);
  const totalRevenue = bundles.reduce((sum, b) => sum + parseFloat(String(b.totalRevenue || 0)), 0);
  const avgConversionRate = totalViews > 0 ? (totalSales / totalViews) * 100 : 0;
  
  return {
    totalBundles: bundles.length,
    totalViews,
    totalSales,
    totalRevenue,
    avgConversionRate: Math.round(avgConversionRate * 10) / 10,
  };
}


// ============================================================================
// BUNDLE COVER IMAGE LIBRARY
// ============================================================================

/**
 * Get all bundle cover images for a trainer (image library)
 */
export async function getBundleCoverLibrary(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(trainerMedia)
    .where(and(
      eq(trainerMedia.trainerId, trainerId),
      eq(trainerMedia.type, "bundle_cover")
    ))
    .orderBy(desc(trainerMedia.createdAt));
  
  return result;
}

/**
 * Save an image to the bundle cover library
 */
export async function saveToBundleCoverLibrary(
  trainerId: number,
  data: {
    url: string;
    fileKey?: string;
    title?: string;
    mimeType?: string;
    fileSize?: number;
    width?: number;
    height?: number;
  }
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(trainerMedia).values({
    trainerId,
    type: "bundle_cover",
    url: data.url,
    fileKey: data.fileKey,
    title: data.title,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    width: data.width,
    height: data.height,
    sortOrder: 0,
  });
  
  return (result as any)[0]?.insertId || null;
}

/**
 * Delete an image from the bundle cover library
 */
export async function deleteFromBundleCoverLibrary(
  id: number,
  trainerId: number
): Promise<{ fileKey: string | null } | null> {
  const db = await getDb();
  if (!db) return null;
  
  // Get the file key before deleting
  const existing = await db
    .select({ fileKey: trainerMedia.fileKey })
    .from(trainerMedia)
    .where(and(
      eq(trainerMedia.id, id),
      eq(trainerMedia.trainerId, trainerId),
      eq(trainerMedia.type, "bundle_cover")
    ))
    .limit(1);
  
  if (existing.length === 0) return null;
  
  await db.delete(trainerMedia).where(and(
    eq(trainerMedia.id, id),
    eq(trainerMedia.trainerId, trainerId),
    eq(trainerMedia.type, "bundle_cover")
  ));
  
  return { fileKey: existing[0].fileKey };
}

/**
 * Count bundle cover images in library
 */
export async function countBundleCoverLibrary(trainerId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(trainerMedia)
    .where(and(
      eq(trainerMedia.trainerId, trainerId),
      eq(trainerMedia.type, "bundle_cover")
    ));
  
  return result[0]?.count || 0;
}


// ============================================================================
// IMAGE ANALYTICS
// ============================================================================

export interface ImageAnalyticsData {
  colorPalette: string[]; // Dominant colors in hex
  hasText: boolean; // Whether image contains text overlay
  style: 'photo' | 'illustration' | 'graphic' | 'collage' | 'ai_generated';
  brightness: 'dark' | 'medium' | 'light';
  hasProducts: boolean; // Whether products are visible
  hasPerson: boolean; // Whether a person is in the image
}

export async function updateImageAnalytics(
  bundleId: number,
  analytics: ImageAnalyticsData
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(bundleDrafts)
    .set({ imageAnalytics: analytics })
    .where(eq(bundleDrafts.id, bundleId));
}

export async function getImageAnalytics(bundleId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ imageAnalytics: bundleDrafts.imageAnalytics })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.id, bundleId))
    .limit(1);
  return result[0]?.imageAnalytics as ImageAnalyticsData | null;
}

export async function getTopPerformingImageStyles(trainerId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  // Get bundles with sales, grouped by image characteristics
  const whereConditions = [
    sql`${bundleDrafts.salesCount} > 0`,
    eq(bundleDrafts.status, 'published')
  ];
  
  if (trainerId) {
    whereConditions.push(eq(bundleDrafts.trainerId, trainerId));
  }
    
  const bundles = await db
    .select({
      id: bundleDrafts.id,
      title: bundleDrafts.title,
      imageUrl: bundleDrafts.imageUrl,
      imageSource: bundleDrafts.imageSource,
      imageAnalytics: bundleDrafts.imageAnalytics,
      viewCount: bundleDrafts.viewCount,
      salesCount: bundleDrafts.salesCount,
      totalRevenue: bundleDrafts.totalRevenue,
    })
    .from(bundleDrafts)
    .where(and(...whereConditions))
    .orderBy(desc(bundleDrafts.salesCount))
    .limit(50);
    
  return bundles;
}

export async function getImagePerformanceComparison() {
  const db = await getDb();
  if (!db) return { ai: { count: 0, totalViews: 0, totalSales: 0, totalRevenue: 0, avgConversionRate: '0.00' }, custom: { count: 0, totalViews: 0, totalSales: 0, totalRevenue: 0, avgConversionRate: '0.00' } };
  
  // Compare AI vs Custom image performance
  const aiImages = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalViews: sql<number>`COALESCE(SUM(${bundleDrafts.viewCount}), 0)`,
      totalSales: sql<number>`COALESCE(SUM(${bundleDrafts.salesCount}), 0)`,
      totalRevenue: sql<number>`COALESCE(SUM(${bundleDrafts.totalRevenue}), 0)`,
    })
    .from(bundleDrafts)
    .where(and(
      eq(bundleDrafts.imageSource, 'ai'),
      eq(bundleDrafts.status, 'published')
    ));
    
  const customImages = await db
    .select({
      count: sql<number>`COUNT(*)`,
      totalViews: sql<number>`COALESCE(SUM(${bundleDrafts.viewCount}), 0)`,
      totalSales: sql<number>`COALESCE(SUM(${bundleDrafts.salesCount}), 0)`,
      totalRevenue: sql<number>`COALESCE(SUM(${bundleDrafts.totalRevenue}), 0)`,
    })
    .from(bundleDrafts)
    .where(and(
      eq(bundleDrafts.imageSource, 'custom'),
      eq(bundleDrafts.status, 'published')
    ));
    
  const aiStats = aiImages[0] || { count: 0, totalViews: 0, totalSales: 0, totalRevenue: 0 };
  const customStats = customImages[0] || { count: 0, totalViews: 0, totalSales: 0, totalRevenue: 0 };
  
  return {
    ai: {
      count: Number(aiStats.count) || 0,
      totalViews: Number(aiStats.totalViews) || 0,
      totalSales: Number(aiStats.totalSales) || 0,
      totalRevenue: Number(aiStats.totalRevenue) || 0,
      avgConversionRate: Number(aiStats.totalViews) > 0 
        ? ((Number(aiStats.totalSales) / Number(aiStats.totalViews)) * 100).toFixed(2)
        : '0.00',
    },
    custom: {
      count: Number(customStats.count) || 0,
      totalViews: Number(customStats.totalViews) || 0,
      totalSales: Number(customStats.totalSales) || 0,
      totalRevenue: Number(customStats.totalRevenue) || 0,
      avgConversionRate: Number(customStats.totalViews) > 0 
        ? ((Number(customStats.totalSales) / Number(customStats.totalViews)) * 100).toFixed(2)
        : '0.00',
    },
  };
}

export async function getTrainerImageInsights(trainerId: number) {
  const db = await getDb();
  if (!db) return {
    totalBundles: 0,
    totalViews: 0,
    totalSales: 0,
    conversionRate: '0.00',
    imageSourceBreakdown: { ai: 0, custom: 0 },
    bestPerformer: null,
    bundles: [],
  };
  
  // Get trainer's bundle image performance
  const bundles = await db
    .select({
      id: bundleDrafts.id,
      title: bundleDrafts.title,
      imageUrl: bundleDrafts.imageUrl,
      imageSource: bundleDrafts.imageSource,
      imageAnalytics: bundleDrafts.imageAnalytics,
      viewCount: bundleDrafts.viewCount,
      salesCount: bundleDrafts.salesCount,
      totalRevenue: bundleDrafts.totalRevenue,
      status: bundleDrafts.status,
    })
    .from(bundleDrafts)
    .where(eq(bundleDrafts.trainerId, trainerId))
    .orderBy(desc(bundleDrafts.salesCount));
    
  // Calculate insights
  const publishedBundles = bundles.filter(b => b.status === 'published');
  const totalViews = publishedBundles.reduce((sum, b) => sum + (b.viewCount || 0), 0);
  const totalSales = publishedBundles.reduce((sum, b) => sum + (b.salesCount || 0), 0);
  
  const aiCount = publishedBundles.filter(b => b.imageSource === 'ai').length;
  const customCount = publishedBundles.filter(b => b.imageSource === 'custom').length;
  
  const bestPerformer = publishedBundles.length > 0 ? publishedBundles[0] : null;
  
  return {
    totalBundles: publishedBundles.length,
    totalViews,
    totalSales,
    conversionRate: totalViews > 0 ? ((totalSales / totalViews) * 100).toFixed(2) : '0.00',
    imageSourceBreakdown: {
      ai: aiCount,
      custom: customCount,
    },
    bestPerformer,
    bundles: publishedBundles,
  };
}

export async function getImageRecommendations(trainerId: number) {
  const db = await getDb();
  if (!db) return { recommendations: [], topPerformers: [] };
  
  // Get platform-wide top performers
  const topPerformers = await db
    .select({
      id: bundleDrafts.id,
      title: bundleDrafts.title,
      imageUrl: bundleDrafts.imageUrl,
      imageSource: bundleDrafts.imageSource,
      imageAnalytics: bundleDrafts.imageAnalytics,
      viewCount: bundleDrafts.viewCount,
      salesCount: bundleDrafts.salesCount,
      conversionRate: sql<number>`CASE WHEN ${bundleDrafts.viewCount} > 0 THEN (${bundleDrafts.salesCount} * 100.0 / ${bundleDrafts.viewCount}) ELSE 0 END`,
    })
    .from(bundleDrafts)
    .where(and(
      eq(bundleDrafts.status, 'published'),
      sql`${bundleDrafts.viewCount} >= 10` // Minimum views for statistical significance
    ))
    .orderBy(desc(sql`CASE WHEN ${bundleDrafts.viewCount} > 0 THEN (${bundleDrafts.salesCount} * 100.0 / ${bundleDrafts.viewCount}) ELSE 0 END`))
    .limit(10);
  
  // Get trainer's current bundles for comparison
  const trainerBundles = await db
    .select({
      imageSource: bundleDrafts.imageSource,
      imageAnalytics: bundleDrafts.imageAnalytics,
    })
    .from(bundleDrafts)
    .where(and(
      eq(bundleDrafts.trainerId, trainerId),
      eq(bundleDrafts.status, 'published')
    ));
  
  // Generate recommendations based on analysis
  const recommendations: string[] = [];
  
  // Check AI vs Custom performance
  const comparison = await getImagePerformanceComparison();
  const aiConversion = parseFloat(comparison.ai.avgConversionRate);
  const customConversion = parseFloat(comparison.custom.avgConversionRate);
  
  if (aiConversion > customConversion && customConversion > 0) {
    const diff = ((aiConversion - customConversion) / customConversion * 100).toFixed(0);
    recommendations.push(`AI-generated images are converting ${diff}% better than custom uploads on average. Consider trying AI for your next bundle.`);
  } else if (customConversion > aiConversion && aiConversion > 0) {
    const diff = ((customConversion - aiConversion) / aiConversion * 100).toFixed(0);
    recommendations.push(`Custom uploaded images are converting ${diff}% better than AI-generated ones. Your personal touch matters!`);
  }
  
  // Check if trainer is using only one type
  const trainerAiCount = trainerBundles.filter(b => b.imageSource === 'ai').length;
  const trainerCustomCount = trainerBundles.filter(b => b.imageSource === 'custom').length;
  
  if (trainerAiCount === 0 && trainerCustomCount > 0) {
    recommendations.push("You haven't tried AI-generated images yet. They can save time and often perform well!");
  } else if (trainerCustomCount === 0 && trainerAiCount > 0) {
    recommendations.push("Consider uploading a custom image for your next bundle. Personal branding can increase trust.");
  }
  
  // Add general tips
  if (topPerformers.length > 0) {
    recommendations.push("Top-performing bundles tend to have clear, high-contrast images that showcase the products.");
  }
  
  return {
    recommendations,
    topPerformers: topPerformers.map(p => ({
      ...p,
      conversionRate: Number(p.conversionRate).toFixed(2),
    })),
    comparison,
  };
}


// ============================================================================
// TAG COLORS
// ============================================================================

export async function getTagColors(category?: "goal" | "service") {
  const db = await getDb();
  if (!db) return [];
  if (category) {
    return db.select().from(tagColors).where(eq(tagColors.category, category));
  }
  return db.select().from(tagColors);
}

export async function getTagColor(tag: string, category: "goal" | "service") {
  const db = await getDb();
  if (!db) return null;
  const results = await db
    .select()
    .from(tagColors)
    .where(
      and(
        eq(tagColors.tag, tag),
        eq(tagColors.category, category)
      )
    )
    .limit(1);
  return results[0] || null;
}

export async function createTagColor(data: {
  tag: string;
  color: string;
  category: "goal" | "service";
  label?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tagColors).values({
    tag: data.tag,
    color: data.color,
    category: data.category,
    label: data.label || data.tag,
  });
  return result;
}

export async function upsertTagColor(data: {
  tag: string;
  color: string;
  category: "goal" | "service";
  label?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if tag exists
  const existing = await getTagColor(data.tag, data.category);
  if (existing) {
    // Update color
    await db
      .update(tagColors)
      .set({ color: data.color, label: data.label || data.tag })
      .where(eq(tagColors.id, existing.id));
    return { ...existing, color: data.color, label: data.label || data.tag };
  }
  // Create new
  await createTagColor(data);
  return data;
}

// Generate a random color for new custom tags
const TAG_COLORS_PALETTE = [
  "#e11d48", "#db2777", "#c026d3", "#9333ea", "#7c3aed",
  "#6366f1", "#3b82f6", "#0ea5e9", "#06b6d4", "#14b8a6",
  "#10b981", "#22c55e", "#84cc16", "#eab308", "#f97316",
  "#ef4444"
];

export async function getOrCreateTagColor(
  tag: string,
  category: "goal" | "service",
  label?: string,
  customColor?: string
): Promise<{ tag: string; color: string; label: string }> {
  const existing = await getTagColor(tag, category);
  if (existing) {
    return { tag: existing.tag, color: existing.color, label: existing.label || tag };
  }
  
  // Use custom color or generate a deterministic color based on tag name
  let color = customColor;
  if (!color) {
    const hash = tag.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    color = TAG_COLORS_PALETTE[hash % TAG_COLORS_PALETTE.length];
  }
  
  await createTagColor({ tag, color, category, label: label || tag });
  return { tag, color, label: label || tag };
}

export async function updateTagColor(
  id: number,
  data: { label?: string; color?: string }
): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update tag color: database not available");
    return { success: false };
  }
  await db
    .update(tagColors)
    .set(data)
    .where(eq(tagColors.id, id));
  return { success: true };
}

export async function deleteTagColor(id: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot delete tag color: database not available");
    return { success: false };
  }
  await db.delete(tagColors).where(eq(tagColors.id, id));
  return { success: true };
}


// ============================================================================
// PRODUCT SPF (Special Product Fee) OPERATIONS
// ============================================================================

export async function getProductSPF(shopifyProductId: number) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const results = await db
    .select()
    .from(productSPF)
    .where(
      and(
        eq(productSPF.shopifyProductId, shopifyProductId),
        or(isNull(productSPF.startDate), lte(productSPF.startDate, now)),
        or(isNull(productSPF.endDate), gte(productSPF.endDate, now))
      )
    )
    .limit(1);
  return results[0] || null;
}

export async function getAllActiveSPF() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(productSPF)
    .where(
      and(
        or(isNull(productSPF.startDate), lte(productSPF.startDate, now)),
        or(isNull(productSPF.endDate), gte(productSPF.endDate, now))
      )
    );
}

export async function getAllSPF() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productSPF).orderBy(desc(productSPF.updatedAt));
}

export async function createProductSPF(data: Omit<InsertProductSPF, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productSPF).values(data);
  return result;
}

export async function updateProductSPF(id: number, data: Partial<InsertProductSPF>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productSPF).set(data).where(eq(productSPF.id, id));
}

export async function deleteProductSPF(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productSPF).where(eq(productSPF.id, id));
}

export async function upsertProductSPF(data: {
  shopifyProductId: number;
  spfPercentage: string;
  startDate?: Date | null;
  endDate?: Date | null;
  notes?: string;
  createdBy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if SPF exists for this product
  const existing = await db
    .select()
    .from(productSPF)
    .where(eq(productSPF.shopifyProductId, data.shopifyProductId))
    .limit(1);
  
  if (existing[0]) {
    // Update existing
    await db
      .update(productSPF)
      .set({
        spfPercentage: data.spfPercentage,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes,
      })
      .where(eq(productSPF.id, existing[0].id));
    return { ...existing[0], ...data };
  }
  
  // Create new
  await db.insert(productSPF).values({
    shopifyProductId: data.shopifyProductId,
    spfPercentage: data.spfPercentage,
    startDate: data.startDate,
    endDate: data.endDate,
    notes: data.notes,
    createdBy: data.createdBy,
  });
  return data;
}

// ============================================================================
// PLATFORM SETTINGS OPERATIONS
// ============================================================================

export async function getPlatformSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const results = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  return results[0]?.value || null;
}

export async function setPlatformSetting(key: string, value: string, updatedBy?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Check if setting exists
  const existing = await getPlatformSetting(key);
  if (existing !== null) {
    await db
      .update(platformSettings)
      .set({ value, updatedBy })
      .where(eq(platformSettings.key, key));
  } else {
    await db.insert(platformSettings).values({ key, value, updatedBy });
  }
}

export async function getAllPlatformSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(platformSettings);
}

// Get base commission rate (default 10% = 0.10)
export async function getBaseCommissionRate(): Promise<number> {
  const value = await getPlatformSetting("base_commission_rate");
  return value ? parseFloat(value) : 0.10;
}

// Set base commission rate
export async function setBaseCommissionRate(rate: number, updatedBy?: number) {
  await setPlatformSetting("base_commission_rate", rate.toString(), updatedBy);
}

// Get commission data for all products in a list
export async function getCommissionDataForProducts(shopifyProductIds: number[]): Promise<{
  baseCommissionRate: number;
  productSPF: Array<{
    shopifyProductId: number;
    spfPercentage: number;
    endDate: Date | null;
  }>;
}> {
  const baseRate = await getBaseCommissionRate();
  const activeSPF = await getAllActiveSPF();
  
  // Filter to only requested products and map to simpler format
  const relevantSPF = activeSPF
    .filter(spf => shopifyProductIds.includes(spf.shopifyProductId))
    .map(spf => ({
      shopifyProductId: spf.shopifyProductId,
      spfPercentage: parseFloat(spf.spfPercentage || "0"),
      endDate: spf.endDate,
    }));
  
  return {
    baseCommissionRate: baseRate,
    productSPF: relevantSPF,
  };
}


// ============================================================================
// SERVICE DELIVERIES OPERATIONS
// ============================================================================

export async function createServiceDelivery(data: Omit<InsertServiceDelivery, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(serviceDeliveries).values(data);
  return result;
}

export async function getServiceDeliveriesByTrainer(
  trainerId: number,
  options?: {
    status?: "pending" | "in_progress" | "completed" | "all";
    clientId?: number;
  }
) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(serviceDeliveries.trainerId, trainerId)];
  
  if (options?.status && options.status !== "all") {
    conditions.push(eq(serviceDeliveries.status, options.status));
  }
  
  if (options?.clientId) {
    conditions.push(eq(serviceDeliveries.clientId, options.clientId));
  }
  
  const deliveries = await db
    .select()
    .from(serviceDeliveries)
    .where(and(...conditions))
    .orderBy(desc(serviceDeliveries.createdAt));
  
  // Join with users to get client names
  const clientIds = Array.from(new Set(deliveries.map(d => d.clientId)));
  const clientsData = clientIds.length > 0 
    ? await db.select().from(users).where(inArray(users.id, clientIds))
    : [];
  
  const clientMap = new Map(clientsData.map(c => [c.id, c]));
  
  return deliveries.map(d => ({
    ...d,
    client: clientMap.get(d.clientId) || null,
  }));
}

export async function updateServiceDelivery(
  id: number,
  data: {
    deliveredQuantity?: number;
    status?: "pending" | "in_progress" | "completed";
    notes?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, unknown> = { ...data };
  
  // Auto-complete if all sessions delivered
  if (data.status === "completed") {
    updateData.completedAt = new Date();
  }
  
  await db.update(serviceDeliveries).set(updateData).where(eq(serviceDeliveries.id, id));
}

export async function getServiceDeliveryById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(serviceDeliveries).where(eq(serviceDeliveries.id, id)).limit(1);
  return results[0] || null;
}

// ============================================================================
// TRAINER EARNINGS OPERATIONS
// ============================================================================

export async function createTrainerEarning(data: Omit<InsertTrainerEarning, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(trainerEarnings).values(data);
  return result;
}

export async function getTrainerEarningsSummary(
  trainerId: number,
  options: {
    period: "week" | "month" | "year" | "all";
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{
  totalEarnings: number;
  productCommissions: number;
  serviceRevenue: number;
  bundlesSold: number;
  periodComparison?: { previous: number; change: number };
}> {
  const db = await getDb();
  if (!db) {
    return { totalEarnings: 0, productCommissions: 0, serviceRevenue: 0, bundlesSold: 0 };
  }
  
  // Calculate date range based on period
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  let previousStartDate: Date;
  let previousEndDate: Date;
  
  switch (options.period) {
    case "week":
      // Start of current week (Monday)
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay() + 1);
      startDate.setHours(0, 0, 0, 0);
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 7);
      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
      previousEndDate = new Date(startDate);
      previousEndDate.setMilliseconds(-1);
      break;
    case "all":
    default:
      startDate = new Date(0); // Beginning of time
      previousStartDate = new Date(0);
      previousEndDate = new Date(0);
      break;
  }
  
  // Override with custom dates if provided
  if (options.startDate) startDate = options.startDate;
  if (options.endDate) endDate = options.endDate;
  
  // Query current period earnings
  const currentEarnings = await db
    .select({
      totalEarnings: sql<string>`COALESCE(SUM(${trainerEarnings.totalEarnings}), 0)`,
      productCommissions: sql<string>`COALESCE(SUM(${trainerEarnings.productCommission}), 0)`,
      serviceRevenue: sql<string>`COALESCE(SUM(${trainerEarnings.serviceRevenue}), 0)`,
      bundlesSold: sql<number>`COUNT(*)`,
    })
    .from(trainerEarnings)
    .where(
      and(
        eq(trainerEarnings.trainerId, trainerId),
        gte(trainerEarnings.createdAt, startDate),
        lte(trainerEarnings.createdAt, endDate)
      )
    );
  
  const current = currentEarnings[0] || { totalEarnings: "0", productCommissions: "0", serviceRevenue: "0", bundlesSold: 0 };
  
  // Query previous period for comparison (only if not "all")
  let periodComparison: { previous: number; change: number } | undefined;
  if (options.period !== "all") {
    const previousEarnings = await db
      .select({
        totalEarnings: sql<string>`COALESCE(SUM(${trainerEarnings.totalEarnings}), 0)`,
      })
      .from(trainerEarnings)
      .where(
        and(
          eq(trainerEarnings.trainerId, trainerId),
          gte(trainerEarnings.createdAt, previousStartDate),
          lte(trainerEarnings.createdAt, previousEndDate)
        )
      );
    
    const previousTotal = parseFloat(previousEarnings[0]?.totalEarnings || "0");
    const currentTotal = parseFloat(current.totalEarnings);
    const change = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
    
    periodComparison = { previous: previousTotal, change };
  }
  
  return {
    totalEarnings: parseFloat(current.totalEarnings),
    productCommissions: parseFloat(current.productCommissions),
    serviceRevenue: parseFloat(current.serviceRevenue),
    bundlesSold: Number(current.bundlesSold),
    periodComparison,
  };
}

export async function getTrainerEarningsBreakdown(
  trainerId: number,
  options: {
    period: "week" | "month" | "year" | "all";
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{
  byProduct: Array<{ name: string; quantity: number; commission: number; percentage: number }>;
  byService: Array<{ name: string; quantity: number; revenue: number; percentage: number }>;
  revenueByDay: Array<{ date: string; products: number; services: number; total: number }>;
}> {
  const db = await getDb();
  if (!db) {
    return { byProduct: [], byService: [], revenueByDay: [] };
  }
  
  // Calculate date range
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  
  switch (options.period) {
    case "week":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay() + 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case "all":
    default:
      startDate = new Date(0);
      break;
  }
  
  if (options.startDate) startDate = options.startDate;
  if (options.endDate) endDate = options.endDate;
  
  // Get earnings records for the period
  const earnings = await db
    .select()
    .from(trainerEarnings)
    .where(
      and(
        eq(trainerEarnings.trainerId, trainerId),
        gte(trainerEarnings.createdAt, startDate),
        lte(trainerEarnings.createdAt, endDate)
      )
    )
    .orderBy(trainerEarnings.createdAt);
  
  // Get service deliveries for breakdown
  const deliveries = await db
    .select()
    .from(serviceDeliveries)
    .where(
      and(
        eq(serviceDeliveries.trainerId, trainerId),
        gte(serviceDeliveries.createdAt, startDate),
        lte(serviceDeliveries.createdAt, endDate)
      )
    );
  
  // Aggregate by service type
  const serviceMap = new Map<string, { quantity: number; revenue: number }>();
  for (const d of deliveries) {
    const key = d.serviceName || d.serviceType;
    const existing = serviceMap.get(key) || { quantity: 0, revenue: 0 };
    existing.quantity += d.totalQuantity;
    existing.revenue += parseFloat(d.pricePerUnit || "0") * d.totalQuantity;
    serviceMap.set(key, existing);
  }
  
  const totalServiceRevenue = Array.from(serviceMap.values()).reduce((sum, s) => sum + s.revenue, 0);
  const byService = Array.from(serviceMap.entries()).map(([name, data]) => ({
    name,
    quantity: data.quantity,
    revenue: data.revenue,
    percentage: totalServiceRevenue > 0 ? (data.revenue / totalServiceRevenue) * 100 : 0,
  })).sort((a, b) => b.revenue - a.revenue);
  
  // Aggregate by day for chart
  const dayMap = new Map<string, { products: number; services: number }>();
  for (const e of earnings) {
    const dateKey = e.createdAt.toISOString().split("T")[0];
    const existing = dayMap.get(dateKey) || { products: 0, services: 0 };
    existing.products += parseFloat(e.productCommission || "0");
    existing.services += parseFloat(e.serviceRevenue || "0");
    dayMap.set(dateKey, existing);
  }
  
  const revenueByDay = Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      products: data.products,
      services: data.services,
      total: data.products + data.services,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  // For products, we'd need to track which products were in each order
  // For now, return empty array - would need order_items with product details
  const byProduct: Array<{ name: string; quantity: number; commission: number; percentage: number }> = [];
  
  return { byProduct, byService, revenueByDay };
}

export async function getTrainerEarningsHistory(trainerId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  
  const earnings = await db
    .select()
    .from(trainerEarnings)
    .where(eq(trainerEarnings.trainerId, trainerId))
    .orderBy(desc(trainerEarnings.createdAt))
    .limit(limit);
  
  return earnings;
}

// Create earnings record when an order is placed
export async function createEarningsFromOrder(
  orderId: number,
  trainerId: number,
  bundleId: number | null,
  bundleTitle: string | null,
  clientId: number | null,
  clientName: string | null,
  productCommission: number,
  serviceRevenue: number,
  orderTotal: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(trainerEarnings).values({
    orderId,
    trainerId,
    bundleId,
    bundleTitle,
    clientId,
    clientName,
    productCommission: productCommission.toFixed(2),
    serviceRevenue: serviceRevenue.toFixed(2),
    totalEarnings: (productCommission + serviceRevenue).toFixed(2),
    orderTotal: orderTotal.toFixed(2),
    status: "pending",
  });
}

// Create service deliveries when an order is placed
export async function createDeliveriesFromOrder(
  orderId: number,
  trainerId: number,
  clientId: number,
  bundleId: number | null,
  bundleTitle: string | null,
  services: Array<{
    type: string;
    name: string;
    quantity: number;
    pricePerUnit: number;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  for (const service of services) {
    await db.insert(serviceDeliveries).values({
      orderId,
      trainerId,
      clientId,
      bundleId,
      bundleTitle,
      serviceType: service.type,
      serviceName: service.name,
      totalQuantity: service.quantity,
      deliveredQuantity: 0,
      pricePerUnit: service.pricePerUnit.toFixed(2),
      status: "pending",
    });
  }
}


// ============================================================================
// LOCAL BUSINESS OPERATIONS
// ============================================================================

export async function createLocalBusiness(data: Omit<InsertLocalBusiness, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(localBusinesses).values(data);
  return (result as any)[0]?.insertId;
}

export async function getLocalBusinessById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(localBusinesses).where(eq(localBusinesses.id, id)).limit(1);
  return results[0] || null;
}

export async function getLocalBusinessesByTrainer(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(localBusinesses)
    .where(eq(localBusinesses.referredByTrainerId, trainerId))
    .orderBy(desc(localBusinesses.createdAt));
}

export async function getAllLocalBusinesses(status?: "pending" | "active" | "suspended" | "inactive") {
  const db = await getDb();
  if (!db) return [];
  
  if (status) {
    return db
      .select()
      .from(localBusinesses)
      .where(eq(localBusinesses.status, status))
      .orderBy(desc(localBusinesses.createdAt));
  }
  
  return db.select().from(localBusinesses).orderBy(desc(localBusinesses.createdAt));
}

export async function updateLocalBusiness(id: number, data: Partial<InsertLocalBusiness>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(localBusinesses).set(data).where(eq(localBusinesses.id, id));
}

export async function approveLocalBusiness(id: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(localBusinesses).set({
    status: "active",
    approvedBy,
    approvedAt: new Date(),
  }).where(eq(localBusinesses.id, id));
}

// ============================================================================
// AD PARTNERSHIP OPERATIONS
// ============================================================================

const PACKAGE_CONFIG = {
  bronze: { monthlyFee: 99, commissionRate: 0.15, bonusPoints: 500 },
  silver: { monthlyFee: 249, commissionRate: 0.18, bonusPoints: 1000 },
  gold: { monthlyFee: 499, commissionRate: 0.20, bonusPoints: 2000 },
  platinum: { monthlyFee: 999, commissionRate: 0.25, bonusPoints: 5000 },
} as const;

export async function createAdPartnership(data: {
  trainerId: number;
  businessId: number;
  packageTier: "bronze" | "silver" | "gold" | "platinum";
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const config = PACKAGE_CONFIG[data.packageTier];
  const startDate = data.startDate || new Date();
  const endDate = data.endDate || new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const renewalDate = new Date(endDate);
  
  const result = await db.insert(adPartnerships).values({
    trainerId: data.trainerId,
    businessId: data.businessId,
    packageTier: data.packageTier,
    monthlyFee: config.monthlyFee.toFixed(2),
    trainerCommissionRate: config.commissionRate.toFixed(4),
    bonusPointsAwarded: config.bonusPoints,
    status: "pending",
    startDate,
    endDate,
    renewalDate,
    autoRenew: true,
    notes: data.notes,
  });
  
  return (result as any)[0]?.insertId;
}

export async function getAdPartnershipById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(adPartnerships).where(eq(adPartnerships.id, id)).limit(1);
  return results[0] || null;
}

export async function getAdPartnershipsByTrainer(trainerId: number, status?: "pending" | "active" | "paused" | "cancelled" | "expired" | "all") {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(adPartnerships.trainerId, trainerId)];
  if (status && status !== "all") {
    conditions.push(eq(adPartnerships.status, status));
  }
  
  const partnerships = await db
    .select()
    .from(adPartnerships)
    .where(and(...conditions))
    .orderBy(desc(adPartnerships.createdAt));
  
  // Join with business info
  const businessIds = partnerships.map(p => p.businessId);
  const businesses = businessIds.length > 0
    ? await db.select().from(localBusinesses).where(inArray(localBusinesses.id, businessIds))
    : [];
  
  const businessMap = new Map(businesses.map(b => [b.id, b]));
  
  return partnerships.map(p => ({
    ...p,
    business: businessMap.get(p.businessId) || null,
  }));
}

export async function getAdPartnershipsByBusiness(businessId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(adPartnerships)
    .where(eq(adPartnerships.businessId, businessId))
    .orderBy(desc(adPartnerships.createdAt));
}

export async function getAllAdPartnerships(status?: "pending" | "active" | "paused" | "cancelled" | "expired") {
  const db = await getDb();
  if (!db) return [];
  
  const partnerships = status
    ? await db.select().from(adPartnerships).where(eq(adPartnerships.status, status)).orderBy(desc(adPartnerships.createdAt))
    : await db.select().from(adPartnerships).orderBy(desc(adPartnerships.createdAt));
  
  // Join with business and trainer info
  const businessIds = partnerships.map(p => p.businessId);
  const trainerIds = partnerships.map(p => p.trainerId);
  
  const businesses = businessIds.length > 0
    ? await db.select().from(localBusinesses).where(inArray(localBusinesses.id, businessIds))
    : [];
  const trainers = trainerIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, trainerIds))
    : [];
  
  const businessMap = new Map(businesses.map(b => [b.id, b]));
  const trainerMap = new Map(trainers.map(t => [t.id, t]));
  
  return partnerships.map(p => ({
    ...p,
    business: businessMap.get(p.businessId) || null,
    trainer: trainerMap.get(p.trainerId) || null,
  }));
}

export async function updateAdPartnership(id: number, data: Partial<InsertAdPartnership>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(adPartnerships).set(data).where(eq(adPartnerships.id, id));
}

export async function approveAdPartnership(id: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const partnership = await getAdPartnershipById(id);
  if (!partnership) throw new Error("Partnership not found");
  
  await db.update(adPartnerships).set({
    status: "active",
    approvedBy,
    approvedAt: new Date(),
  }).where(eq(adPartnerships.id, id));
  
  // Create initial ad earning record
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const business = await getLocalBusinessById(partnership.businessId);
  
  await db.insert(adEarnings).values({
    trainerId: partnership.trainerId,
    partnershipId: id,
    businessId: partnership.businessId,
    businessName: business?.name || "Unknown Business",
    periodStart: now,
    periodEnd,
    monthlyFee: partnership.monthlyFee,
    commissionRate: partnership.trainerCommissionRate,
    commissionEarned: (parseFloat(partnership.monthlyFee) * parseFloat(partnership.trainerCommissionRate)).toFixed(2),
    bonusPoints: partnership.bonusPointsAwarded || 0,
    status: "pending",
  });
}

// ============================================================================
// AD PLACEMENT OPERATIONS
// ============================================================================

export async function createAdPlacement(data: Omit<InsertAdPlacement, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(adPlacements).values(data);
  return (result as any)[0]?.insertId;
}

export async function getAdPlacementsByPartnership(partnershipId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(adPlacements)
    .where(eq(adPlacements.partnershipId, partnershipId))
    .orderBy(desc(adPlacements.priority));
}

export async function getActiveAdPlacements(placementType: "bundle_sidebar" | "vending_screen" | "trainer_profile" | "email_newsletter" | "receipt_confirmation", options?: {
  trainerId?: number;
  bundleId?: number;
  locationId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(adPlacements.placementType, placementType),
    eq(adPlacements.isActive, true),
  ];
  
  if (options?.trainerId) {
    conditions.push(or(
      eq(adPlacements.trainerId, options.trainerId),
      isNull(adPlacements.trainerId)
    )!);
  }
  
  if (options?.bundleId) {
    conditions.push(or(
      eq(adPlacements.bundleId, options.bundleId),
      isNull(adPlacements.bundleId)
    )!);
  }
  
  const placements = await db
    .select()
    .from(adPlacements)
    .where(and(...conditions))
    .orderBy(desc(adPlacements.priority))
    .limit(5);
  
  // Only return placements from active partnerships
  const partnershipIds = placements.map(p => p.partnershipId);
  const partnerships = partnershipIds.length > 0
    ? await db.select().from(adPartnerships).where(
        and(
          inArray(adPartnerships.id, partnershipIds),
          eq(adPartnerships.status, "active")
        )
      )
    : [];
  
  const activePartnershipIds = new Set(partnerships.map(p => p.id));
  
  // Join with business info
  const businessIds = placements.map(p => p.businessId);
  const businesses = businessIds.length > 0
    ? await db.select().from(localBusinesses).where(inArray(localBusinesses.id, businessIds))
    : [];
  
  const businessMap = new Map(businesses.map(b => [b.id, b]));
  
  return placements
    .filter(p => activePartnershipIds.has(p.partnershipId))
    .map(p => ({
      ...p,
      business: businessMap.get(p.businessId) || null,
    }));
}

export async function recordAdImpression(placementId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(adPlacements)
    .set({ impressions: sql`${adPlacements.impressions} + 1` })
    .where(eq(adPlacements.id, placementId));
}

export async function recordAdClick(placementId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(adPlacements)
    .set({ clicks: sql`${adPlacements.clicks} + 1` })
    .where(eq(adPlacements.id, placementId));
}

export async function updateAdPlacement(id: number, data: Partial<InsertAdPlacement>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(adPlacements).set(data).where(eq(adPlacements.id, id));
}

export async function deleteAdPlacement(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(adPlacements).where(eq(adPlacements.id, id));
}

// ============================================================================
// AD EARNINGS OPERATIONS
// ============================================================================

export async function getAdEarningsByTrainer(trainerId: number, options?: {
  period?: "month" | "year" | "all";
  status?: "pending" | "confirmed" | "paid";
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(adEarnings.trainerId, trainerId)];
  
  if (options?.status) {
    conditions.push(eq(adEarnings.status, options.status));
  }
  
  if (options?.period && options.period !== "all") {
    const now = new Date();
    let startDate: Date;
    
    if (options.period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getFullYear(), 0, 1);
    }
    
    conditions.push(gte(adEarnings.periodStart, startDate));
  }
  
  return db
    .select()
    .from(adEarnings)
    .where(and(...conditions))
    .orderBy(desc(adEarnings.periodStart));
}

export async function getTrainerAdEarningsSummary(trainerId: number) {
  const db = await getDb();
  if (!db) return { totalEarnings: 0, totalBonusPoints: 0, activePartnerships: 0, pendingEarnings: 0 };
  
  // Get total earnings
  const [earningsResult] = await db
    .select({
      totalEarnings: sql<number>`COALESCE(SUM(${adEarnings.commissionEarned}), 0)`,
      totalBonusPoints: sql<number>`COALESCE(SUM(${adEarnings.bonusPoints}), 0)`,
      pendingEarnings: sql<number>`COALESCE(SUM(CASE WHEN ${adEarnings.status} = 'pending' THEN ${adEarnings.commissionEarned} ELSE 0 END), 0)`,
    })
    .from(adEarnings)
    .where(eq(adEarnings.trainerId, trainerId));
  
  // Get active partnerships count
  const [partnershipCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(adPartnerships)
    .where(and(
      eq(adPartnerships.trainerId, trainerId),
      eq(adPartnerships.status, "active")
    ));
  
  return {
    totalEarnings: parseFloat(String(earningsResult?.totalEarnings || 0)),
    totalBonusPoints: Number(earningsResult?.totalBonusPoints || 0),
    activePartnerships: Number(partnershipCount?.count || 0),
    pendingEarnings: parseFloat(String(earningsResult?.pendingEarnings || 0)),
  };
}

// Generate unique referral code for trainer
export function generateTrainerReferralCode(trainerId: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `LM${trainerId}${code}`;
}


// ============================================================================
// CLIENT SPENDING OPERATIONS
// ============================================================================

export async function getClientSpendingSummary(
  clientId: number,
  options: {
    period: "month" | "year" | "all";
    trainerId?: number;
  }
): Promise<{
  totalSpent: number;
  productTotal: number;
  serviceTotal: number;
  facilityTotal: number;
  transactionCount: number;
  periodComparison: { previous: number; change: number } | null;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalSpent: 0,
      productTotal: 0,
      serviceTotal: 0,
      facilityTotal: 0,
      transactionCount: 0,
      periodComparison: null,
    };
  }
  
  // Calculate date range
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;
  
  switch (options.period) {
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case "all":
    default:
      startDate = new Date(0);
      break;
  }
  
  // Get orders for this client
  const clientOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.clientId, clientId),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        options.trainerId ? eq(orders.trainerId, options.trainerId) : undefined
      )
    );
  
  const orderIds = clientOrders.map(o => o.id);
  
  if (orderIds.length === 0) {
    return {
      totalSpent: 0,
      productTotal: 0,
      serviceTotal: 0,
      facilityTotal: 0,
      transactionCount: 0,
      periodComparison: null,
    };
  }
  
  // Get line items for these orders
  const lineItems = await db
    .select()
    .from(orderLineItems)
    .where(inArray(orderLineItems.orderId, orderIds));
  
  // Calculate totals by category
  let productTotal = 0;
  let serviceTotal = 0;
  let facilityTotal = 0;
  
  for (const item of lineItems) {
    const amount = parseFloat(item.totalPrice || "0");
    switch (item.category) {
      case "product":
        productTotal += amount;
        break;
      case "service":
        serviceTotal += amount;
        break;
      case "facility":
        facilityTotal += amount;
        break;
    }
  }
  
  const totalSpent = productTotal + serviceTotal + facilityTotal;
  
  // Calculate period comparison
  let periodComparison: { previous: number; change: number } | null = null;
  
  if (options.period !== "all") {
    let previousStartDate: Date;
    let previousEndDate: Date;
    
    if (options.period === "month") {
      previousStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
      previousStartDate = new Date(now.getFullYear() - 1, 0, 1);
      previousEndDate = new Date(now.getFullYear() - 1, 11, 31);
    }
    
    const previousOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.clientId, clientId),
          gte(orders.createdAt, previousStartDate),
          lte(orders.createdAt, previousEndDate)
        )
      );
    
    const previousOrderIds = previousOrders.map(o => o.id);
    let previousTotal = 0;
    
    if (previousOrderIds.length > 0) {
      const previousItems = await db
        .select()
        .from(orderLineItems)
        .where(inArray(orderLineItems.orderId, previousOrderIds));
      
      previousTotal = previousItems.reduce((sum, item) => sum + parseFloat(item.totalPrice || "0"), 0);
    }
    
    const change = previousTotal > 0 ? ((totalSpent - previousTotal) / previousTotal) * 100 : 0;
    periodComparison = { previous: previousTotal, change };
  }
  
  return {
    totalSpent,
    productTotal,
    serviceTotal,
    facilityTotal,
    transactionCount: orderIds.length,
    periodComparison,
  };
}

export async function getClientTransactions(
  clientId: number,
  options: {
    page?: number;
    limit?: number;
    trainerId?: number;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{
  transactions: Array<{
    id: number;
    date: Date;
    trainerName: string | null;
    trainerId: number | null;
    bundleName: string | null;
    grossAmount: number;
    status: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
}> {
  const db = await getDb();
  if (!db) {
    return { transactions: [], total: 0, page: 1, totalPages: 0 };
  }
  
  const page = options.page || 1;
  const limit = options.limit || 20;
  const offset = (page - 1) * limit;
  
  const conditions = [eq(orders.clientId, clientId)];
  
  if (options.trainerId) {
    conditions.push(eq(orders.trainerId, options.trainerId));
  }
  if (options.startDate) {
    conditions.push(gte(orders.createdAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(orders.createdAt, options.endDate));
  }
  
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(orders)
    .where(and(...conditions));
  
  const total = Number(countResult?.count || 0);
  
  // Get paginated orders
  const clientOrders = await db
    .select()
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);
  
  // Get trainer info
  const trainerIds = Array.from(new Set(clientOrders.map(o => o.trainerId).filter(Boolean)));
  const trainers = trainerIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, trainerIds as number[]))
    : [];
  const trainerMap = new Map(trainers.map(t => [t.id, t]));
  
  const transactions = clientOrders.map(order => {
    const trainer = order.trainerId ? trainerMap.get(order.trainerId) : null;
    return {
      id: order.id,
      date: order.createdAt,
      trainerName: trainer?.name || null,
      trainerId: order.trainerId,
      bundleName: (order.orderData as any)?.bundleTitle || null,
      grossAmount: parseFloat(order.totalAmount || "0"),
      status: order.status || "pending",
    };
  });
  
  return {
    transactions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getTransactionDetail(orderId: number, clientId: number) {
  const db = await getDb();
  if (!db) return null;
  
  // Get the order
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.clientId, clientId)))
    .limit(1);
  
  if (!order) return null;
  
  // Get line items
  const lineItems = await db
    .select()
    .from(orderLineItems)
    .where(eq(orderLineItems.orderId, orderId));
  
  // Get trainer info
  const trainer = order.trainerId
    ? (await db.select().from(users).where(eq(users.id, order.trainerId)).limit(1))[0]
    : null;
  
  // Group items by category
  const products = lineItems.filter(i => i.category === "product");
  const services = lineItems.filter(i => i.category === "service");
  const facilities = lineItems.filter(i => i.category === "facility");
  
  return {
    order: {
      id: order.id,
      date: order.createdAt,
      status: order.status,
      total: parseFloat(order.totalAmount || "0"),
      bundleTitle: (order.orderData as any)?.bundleTitle || null,
    },
    trainer: trainer ? { id: trainer.id, name: trainer.name, email: trainer.email } : null,
    products: products.map(p => ({
      name: p.itemName,
      description: p.itemDescription,
      quantity: p.quantity,
      unitPrice: parseFloat(p.unitPrice || "0"),
      totalPrice: parseFloat(p.totalPrice || "0"),
      vatRate: parseFloat(p.vatRate || "0"),
      vatAmount: parseFloat(p.vatAmount || "0"),
    })),
    services: services.map(s => ({
      name: s.itemName,
      description: s.itemDescription,
      quantity: s.quantity,
      unitPrice: parseFloat(s.unitPrice || "0"),
      totalPrice: parseFloat(s.totalPrice || "0"),
      vatRate: parseFloat(s.vatRate || "0"),
      vatAmount: parseFloat(s.vatAmount || "0"),
    })),
    facilities: facilities.map(f => ({
      name: f.itemName,
      description: f.itemDescription,
      quantity: f.quantity,
      unitPrice: parseFloat(f.unitPrice || "0"),
      totalPrice: parseFloat(f.totalPrice || "0"),
      vatRate: parseFloat(f.vatRate || "0"),
      vatAmount: parseFloat(f.vatAmount || "0"),
    })),
    totals: {
      products: products.reduce((sum, p) => sum + parseFloat(p.totalPrice || "0"), 0),
      services: services.reduce((sum, s) => sum + parseFloat(s.totalPrice || "0"), 0),
      facilities: facilities.reduce((sum, f) => sum + parseFloat(f.totalPrice || "0"), 0),
      vat: lineItems.reduce((sum, i) => sum + parseFloat(i.vatAmount || "0"), 0),
      grand: parseFloat(order.totalAmount || "0"),
    },
  };
}

export async function createOrderLineItem(data: Omit<InsertOrderLineItem, "id" | "createdAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orderLineItems).values(data);
  return (result as any)[0]?.insertId;
}


// ============================================================================
// TRAINER POINTS OPERATIONS
// ============================================================================

export const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 5000,
  gold: 15000,
  platinum: 35000,
};

export const TIER_BENEFITS = {
  bronze: { commissionBonus: 0, prioritySupport: false, featuredListing: false, exclusiveProducts: false },
  silver: { commissionBonus: 0.02, prioritySupport: true, featuredListing: false, exclusiveProducts: false },
  gold: { commissionBonus: 0.05, prioritySupport: true, featuredListing: true, exclusiveProducts: false },
  platinum: { commissionBonus: 0.10, prioritySupport: true, featuredListing: true, exclusiveProducts: true },
};

export function calculateTier(lifetimePoints: number): "bronze" | "silver" | "gold" | "platinum" {
  if (lifetimePoints >= TIER_THRESHOLDS.platinum) return "platinum";
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return "gold";
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export function getNextTierInfo(currentTier: "bronze" | "silver" | "gold" | "platinum", lifetimePoints: number) {
  const tiers = ["bronze", "silver", "gold", "platinum"] as const;
  const currentIndex = tiers.indexOf(currentTier);
  
  if (currentIndex >= tiers.length - 1) {
    return { nextTier: null, pointsNeeded: 0, progress: 100 };
  }
  
  const nextTier = tiers[currentIndex + 1];
  const nextThreshold = TIER_THRESHOLDS[nextTier];
  const currentThreshold = TIER_THRESHOLDS[currentTier];
  const pointsNeeded = nextThreshold - lifetimePoints;
  const progress = ((lifetimePoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
  
  return { nextTier, pointsNeeded, progress: Math.min(100, Math.max(0, progress)) };
}

export async function getOrCreateTrainerPoints(trainerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [existing] = await db
    .select()
    .from(trainerPoints)
    .where(eq(trainerPoints.trainerId, trainerId))
    .limit(1);
  
  if (existing) return existing;
  
  // Create new record
  await db.insert(trainerPoints).values({
    trainerId,
    totalPoints: 0,
    lifetimePoints: 0,
    currentTier: "bronze",
    yearToDatePoints: 0,
    yearToDateRevenue: "0",
  });
  
  const [created] = await db
    .select()
    .from(trainerPoints)
    .where(eq(trainerPoints.trainerId, trainerId))
    .limit(1);
  
  return created;
}

export async function addTrainerPoints(
  trainerId: number,
  points: number,
  transactionType: InsertPointTransaction["transactionType"],
  options?: {
    referenceType?: string;
    referenceId?: number;
    description?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get current balance
  const trainerPoint = await getOrCreateTrainerPoints(trainerId);
  const balanceBefore = trainerPoint.totalPoints;
  const balanceAfter = balanceBefore + points;
  
  // Update points balance
  const newLifetime = Math.max(trainerPoint.lifetimePoints, trainerPoint.lifetimePoints + (points > 0 ? points : 0));
  const newTier = calculateTier(newLifetime);
  
  await db
    .update(trainerPoints)
    .set({
      totalPoints: balanceAfter,
      lifetimePoints: newLifetime,
      currentTier: newTier,
      yearToDatePoints: (trainerPoint.yearToDatePoints || 0) + (points > 0 ? points : 0),
      tierCalculatedAt: new Date(),
    })
    .where(eq(trainerPoints.trainerId, trainerId));
  
  // Record transaction
  await db.insert(pointTransactions).values({
    trainerId,
    transactionType,
    points,
    referenceType: options?.referenceType,
    referenceId: options?.referenceId,
    description: options?.description,
    balanceBefore,
    balanceAfter,
  });
  
  return { balanceBefore, balanceAfter, newTier };
}

export async function getTrainerPointsSummary(trainerId: number) {
  const db = await getDb();
  if (!db) {
    return {
      totalPoints: 0,
      lifetimePoints: 0,
      currentTier: "bronze" as const,
      yearToDatePoints: 0,
      yearToDateRevenue: 0,
      nextTierInfo: { nextTier: "silver", pointsNeeded: 5000, progress: 0 },
      tierBenefits: TIER_BENEFITS.bronze,
    };
  }
  
  const trainerPoint = await getOrCreateTrainerPoints(trainerId);
  const nextTierInfo = getNextTierInfo(trainerPoint.currentTier as any, trainerPoint.lifetimePoints);
  
  return {
    totalPoints: trainerPoint.totalPoints,
    lifetimePoints: trainerPoint.lifetimePoints,
    currentTier: trainerPoint.currentTier as "bronze" | "silver" | "gold" | "platinum",
    yearToDatePoints: trainerPoint.yearToDatePoints,
    yearToDateRevenue: parseFloat(trainerPoint.yearToDateRevenue || "0"),
    nextTierInfo,
    tierBenefits: TIER_BENEFITS[trainerPoint.currentTier as keyof typeof TIER_BENEFITS],
  };
}

export async function getTrainerPointTransactions(
  trainerId: number,
  options?: { limit?: number; offset?: number }
) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(pointTransactions)
    .where(eq(pointTransactions.trainerId, trainerId))
    .orderBy(desc(pointTransactions.createdAt))
    .limit(options?.limit || 50)
    .offset(options?.offset || 0);
}

export async function getTrainerAwards(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select()
    .from(trainerAwards)
    .where(eq(trainerAwards.trainerId, trainerId))
    .orderBy(desc(trainerAwards.earnedAt));
}

export async function createTrainerAward(data: Omit<InsertTrainerAward, "id" | "earnedAt">) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(trainerAwards).values(data);
  
  // Award points if applicable
  if (data.pointsAwarded && data.pointsAwarded > 0) {
    await addTrainerPoints(data.trainerId, data.pointsAwarded, "tier_bonus", {
      referenceType: "award",
      description: data.awardName,
    });
  }
}


// ============================================================================
// AD APPROVAL WORKFLOW OPERATIONS
// ============================================================================

export async function getPendingAdPartnerships() {
  const db = await getDb();
  if (!db) return [];
  
  const partnerships = await db
    .select()
    .from(adPartnerships)
    .where(eq(adPartnerships.status, "pending"))
    .orderBy(adPartnerships.createdAt);
  
  // Join with business and trainer info
  const businessIds = partnerships.map(p => p.businessId);
  const trainerIds = partnerships.map(p => p.trainerId);
  
  const businesses = businessIds.length > 0
    ? await db.select().from(localBusinesses).where(inArray(localBusinesses.id, businessIds))
    : [];
  const trainers = trainerIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, trainerIds))
    : [];
  
  const businessMap = new Map(businesses.map(b => [b.id, b]));
  const trainerMap = new Map(trainers.map(t => [t.id, t]));
  
  return partnerships.map(p => ({
    ...p,
    business: businessMap.get(p.businessId) || null,
    trainer: trainerMap.get(p.trainerId) || null,
  }));
}

export async function getPendingBusinessApplications() {
  const db = await getDb();
  if (!db) return [];
  
  const businesses = await db
    .select()
    .from(localBusinesses)
    .where(eq(localBusinesses.status, "pending"))
    .orderBy(localBusinesses.createdAt);
  
  // Get referring trainer info
  const trainerIds = businesses.map(b => b.referredByTrainerId).filter(Boolean) as number[];
  const trainers = trainerIds.length > 0
    ? await db.select().from(users).where(inArray(users.id, trainerIds))
    : [];
  
  const trainerMap = new Map(trainers.map(t => [t.id, t]));
  
  return businesses.map(b => ({
    ...b,
    referringTrainer: b.referredByTrainerId ? trainerMap.get(b.referredByTrainerId) || null : null,
  }));
}

export async function approveBusinessApplication(businessId: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(localBusinesses)
    .set({
      status: "active",
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(localBusinesses.id, businessId));
}

export async function rejectBusinessApplication(businessId: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(localBusinesses)
    .set({
      status: "inactive",
      description: reason ? `Rejected: ${reason}` : undefined,
    })
    .where(eq(localBusinesses.id, businessId));
}

export async function getAdApprovalStats() {
  const db = await getDb();
  if (!db) return { pendingBusinesses: 0, pendingPartnerships: 0, activePartnerships: 0, totalRevenue: 0 };
  
  const [businessCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(localBusinesses)
    .where(eq(localBusinesses.status, "pending"));
  
  const [partnershipCounts] = await db
    .select({
      pending: sql<number>`SUM(CASE WHEN ${adPartnerships.status} = 'pending' THEN 1 ELSE 0 END)`,
      active: sql<number>`SUM(CASE WHEN ${adPartnerships.status} = 'active' THEN 1 ELSE 0 END)`,
    })
    .from(adPartnerships);
  
  const [revenueResult] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${adPartnerships.monthlyFee}), 0)`,
    })
    .from(adPartnerships)
    .where(eq(adPartnerships.status, "active"));
  
  return {
    pendingBusinesses: Number(businessCount?.count || 0),
    pendingPartnerships: Number(partnershipCounts?.pending || 0),
    activePartnerships: Number(partnershipCounts?.active || 0),
    totalRevenue: parseFloat(String(revenueResult?.total || 0)),
  };
}


// ============================================================================
// MONTHLY AWARDS CALCULATION OPERATIONS
// ============================================================================

export interface MonthlyAwardsResult {
  topSeller: { trainerId: number; trainerName: string; revenue: number } | null;
  perfectDelivery: { trainerId: number; trainerName: string; deliveryRate: number }[];
  retentionMasters: { trainerId: number; trainerName: string; retentionRate: number }[];
  clientMilestones: { trainerId: number; trainerName: string; clientCount: number; milestone: number }[];
  revenueMilestones: { trainerId: number; trainerName: string; revenue: number; milestone: number }[];
}

export async function calculateMonthlyAwards(
  year: number,
  month: number
): Promise<MonthlyAwardsResult> {
  const db = await getDb();
  if (!db) {
    return {
      topSeller: null,
      perfectDelivery: [],
      retentionMasters: [],
      clientMilestones: [],
      revenueMilestones: [],
    };
  }
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  // Get all trainers
  const allTrainers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "trainer"));
  
  const trainerMap = new Map(allTrainers.map(t => [t.id, t.name || "Unknown Trainer"]));
  
  // 1. Top Seller - trainer with highest revenue this month
  const revenueByTrainer = await db
    .select({
      trainerId: orders.trainerId,
      totalRevenue: sql<string>`SUM(${orders.totalAmount})`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate),
        eq(orders.paymentStatus, "paid")
      )
    )
    .groupBy(orders.trainerId)
    .orderBy(desc(sql`SUM(${orders.totalAmount})`))
    .limit(1);
  
  const topSeller = revenueByTrainer[0]
    ? {
        trainerId: revenueByTrainer[0].trainerId!,
        trainerName: trainerMap.get(revenueByTrainer[0].trainerId!) || "Unknown",
        revenue: parseFloat(revenueByTrainer[0].totalRevenue || "0"),
      }
    : null;
  
  // 2. Perfect Delivery - trainers with 100% service delivery rate
  const deliveryStats = await db
    .select({
      trainerId: serviceDeliveries.trainerId,
      totalSessions: sql<number>`COUNT(*)`,
      completedSessions: sql<number>`SUM(CASE WHEN ${serviceDeliveries.status} = 'completed' THEN 1 ELSE 0 END)`,
    })
    .from(serviceDeliveries)
    .where(
      and(
        gte(serviceDeliveries.createdAt, startDate),
        lte(serviceDeliveries.createdAt, endDate)
      )
    )
    .groupBy(serviceDeliveries.trainerId);
  
  const perfectDelivery = deliveryStats
    .filter(d => d.totalSessions >= 5 && d.completedSessions === d.totalSessions)
    .map(d => ({
      trainerId: d.trainerId,
      trainerName: trainerMap.get(d.trainerId) || "Unknown",
      deliveryRate: 100,
    }));
  
  // 3. Retention Masters - trainers with high client retention (>80% returning clients)
  const clientStats = await db
    .select({
      trainerId: orders.trainerId,
      uniqueClients: sql<number>`COUNT(DISTINCT ${orders.clientId})`,
      returningClients: sql<number>`COUNT(DISTINCT CASE WHEN (
        SELECT COUNT(*) FROM orders o2 WHERE o2.clientId = ${orders.clientId} AND o2.trainerId = ${orders.trainerId}
      ) > 1 THEN ${orders.clientId} END)`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      )
    )
    .groupBy(orders.trainerId);
  
  const retentionMasters = clientStats
    .filter(c => c.uniqueClients >= 3 && (c.returningClients / c.uniqueClients) >= 0.8)
    .map(c => ({
      trainerId: c.trainerId!,
      trainerName: trainerMap.get(c.trainerId!) || "Unknown",
      retentionRate: Math.round((c.returningClients / c.uniqueClients) * 100),
    }));
  
  // 4. Client Milestones - trainers who reached 10, 25, 50, 100 clients
  const clientCounts = await db
    .select({
      trainerId: users.trainerId,
      clientCount: sql<number>`COUNT(*)`,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "client"),
        isNotNull(users.trainerId)
      )
    )
    .groupBy(users.trainerId);
  
  const milestones = [10, 25, 50, 100];
  const clientMilestones: { trainerId: number; trainerName: string; clientCount: number; milestone: number }[] = [];
  
  for (const stat of clientCounts) {
    if (!stat.trainerId) continue;
    for (const milestone of milestones) {
      if (stat.clientCount >= milestone) {
        // Check if this milestone was already awarded
        const existingAward = await db
          .select()
          .from(trainerAwards)
          .where(
            and(
              eq(trainerAwards.trainerId, stat.trainerId),
              eq(trainerAwards.awardType, "client_milestone"),
              sql`JSON_EXTRACT(${trainerAwards.metadata}, '$.milestone') = ${milestone}`
            )
          )
          .limit(1);
        
        if (existingAward.length === 0) {
          clientMilestones.push({
            trainerId: stat.trainerId,
            trainerName: trainerMap.get(stat.trainerId) || "Unknown",
            clientCount: stat.clientCount,
            milestone,
          });
        }
      }
    }
  }
  
  // 5. Revenue Milestones - trainers who reached £1k, £5k, £10k, £25k, £50k total revenue
  const revenueMilestoneValues = [1000, 5000, 10000, 25000, 50000];
  const totalRevenueByTrainer = await db
    .select({
      trainerId: orders.trainerId,
      totalRevenue: sql<string>`SUM(${orders.totalAmount})`,
    })
    .from(orders)
    .where(eq(orders.paymentStatus, "paid"))
    .groupBy(orders.trainerId);
  
  const revenueMilestones: { trainerId: number; trainerName: string; revenue: number; milestone: number }[] = [];
  
  for (const stat of totalRevenueByTrainer) {
    if (!stat.trainerId) continue;
    const revenue = parseFloat(stat.totalRevenue || "0");
    
    for (const milestone of revenueMilestoneValues) {
      if (revenue >= milestone) {
        // Check if this milestone was already awarded
        const existingAward = await db
          .select()
          .from(trainerAwards)
          .where(
            and(
              eq(trainerAwards.trainerId, stat.trainerId),
              eq(trainerAwards.awardType, "revenue_milestone"),
              sql`JSON_EXTRACT(${trainerAwards.metadata}, '$.milestone') = ${milestone}`
            )
          )
          .limit(1);
        
        if (existingAward.length === 0) {
          revenueMilestones.push({
            trainerId: stat.trainerId,
            trainerName: trainerMap.get(stat.trainerId) || "Unknown",
            revenue,
            milestone,
          });
        }
      }
    }
  }
  
  return {
    topSeller,
    perfectDelivery,
    retentionMasters,
    clientMilestones,
    revenueMilestones,
  };
}

export async function processMonthlyAwards(year: number, month: number): Promise<number> {
  const awards = await calculateMonthlyAwards(year, month);
  let awardsCreated = 0;
  
  // Award Top Seller
  if (awards.topSeller) {
    await createTrainerAward({
      trainerId: awards.topSeller.trainerId,
      awardType: "monthly_top_seller",
      awardName: `Top Seller - ${getMonthName(month)} ${year}`,
      description: `Highest revenue of £${awards.topSeller.revenue.toFixed(2)} for the month`,
      badgeIcon: "trophy",
      pointsAwarded: 500,
      metadata: { month, year, revenue: awards.topSeller.revenue },
    });
    awardsCreated++;
  }
  
  // Award Perfect Delivery
  for (const trainer of awards.perfectDelivery) {
    await createTrainerAward({
      trainerId: trainer.trainerId,
      awardType: "perfect_delivery",
      awardName: `Perfect Delivery - ${getMonthName(month)} ${year}`,
      description: "100% service delivery completion rate",
      badgeIcon: "check-circle",
      pointsAwarded: 250,
      metadata: { month, year, deliveryRate: trainer.deliveryRate },
    });
    awardsCreated++;
  }
  
  // Award Retention Masters
  for (const trainer of awards.retentionMasters) {
    await createTrainerAward({
      trainerId: trainer.trainerId,
      awardType: "retention_master",
      awardName: `Retention Master - ${getMonthName(month)} ${year}`,
      description: `${trainer.retentionRate}% client retention rate`,
      badgeIcon: "users",
      pointsAwarded: 300,
      metadata: { month, year, retentionRate: trainer.retentionRate },
    });
    awardsCreated++;
  }
  
  // Award Client Milestones
  for (const milestone of awards.clientMilestones) {
    await createTrainerAward({
      trainerId: milestone.trainerId,
      awardType: "client_milestone",
      awardName: `${milestone.milestone} Clients Milestone`,
      description: `Reached ${milestone.milestone} total clients`,
      badgeIcon: "users-plus",
      pointsAwarded: milestone.milestone * 10,
      metadata: { milestone: milestone.milestone, clientCount: milestone.clientCount },
    });
    awardsCreated++;
  }
  
  // Award Revenue Milestones
  for (const milestone of awards.revenueMilestones) {
    await createTrainerAward({
      trainerId: milestone.trainerId,
      awardType: "revenue_milestone",
      awardName: `£${(milestone.milestone / 1000).toFixed(0)}k Revenue Milestone`,
      description: `Total revenue exceeded £${milestone.milestone.toLocaleString()}`,
      badgeIcon: "pound-sterling",
      pointsAwarded: milestone.milestone / 10,
      metadata: { milestone: milestone.milestone, revenue: milestone.revenue },
    });
    awardsCreated++;
  }
  
  return awardsCreated;
}

function getMonthName(month: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1] || "Unknown";
}

// Get all awards for a specific month (for admin view)
export async function getMonthlyAwardsSummary(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  
  const monthlyAwards = await db
    .select({
      id: trainerAwards.id,
      trainerId: trainerAwards.trainerId,
      awardType: trainerAwards.awardType,
      awardName: trainerAwards.awardName,
      description: trainerAwards.description,
      badgeIcon: trainerAwards.badgeIcon,
      pointsAwarded: trainerAwards.pointsAwarded,
      earnedAt: trainerAwards.earnedAt,
      trainerName: users.name,
    })
    .from(trainerAwards)
    .leftJoin(users, eq(trainerAwards.trainerId, users.id))
    .where(
      and(
        gte(trainerAwards.earnedAt, startDate),
        lte(trainerAwards.earnedAt, endDate)
      )
    )
    .orderBy(desc(trainerAwards.earnedAt));
  
  return monthlyAwards;
}



// ============================================================================
// PRODUCT DELIVERY OPERATIONS
// ============================================================================

// Create product delivery records when an order is placed
export async function createProductDeliveries(
  orderId: number,
  trainerId: number,
  clientId: number,
  items: { orderItemId: number; productName: string; quantity: number }[]
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  
  const deliveryIds: number[] = [];
  
  for (const item of items) {
    const [result] = await db.insert(productDeliveries).values({
      orderId,
      orderItemId: item.orderItemId,
      trainerId,
      clientId,
      productName: item.productName,
      quantity: item.quantity,
      status: "pending",
    });
    deliveryIds.push(result.insertId);
  }
  
  return deliveryIds;
}

// Get pending deliveries for a trainer
export async function getTrainerPendingDeliveries(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const deliveries = await db
    .select({
      id: productDeliveries.id,
      orderId: productDeliveries.orderId,
      orderItemId: productDeliveries.orderItemId,
      clientId: productDeliveries.clientId,
      productName: productDeliveries.productName,
      quantity: productDeliveries.quantity,
      status: productDeliveries.status,
      scheduledDate: productDeliveries.scheduledDate,
      deliveryMethod: productDeliveries.deliveryMethod,
      createdAt: productDeliveries.createdAt,
      clientName: users.name,
      clientEmail: users.email,
      orderNumber: orders.shopifyOrderNumber,
    })
    .from(productDeliveries)
    .leftJoin(users, eq(productDeliveries.clientId, users.id))
    .leftJoin(orders, eq(productDeliveries.orderId, orders.id))
    .where(
      and(
        eq(productDeliveries.trainerId, trainerId),
        inArray(productDeliveries.status, ["pending", "ready"])
      )
    )
    .orderBy(asc(productDeliveries.createdAt));
  
  return deliveries;
}

// Get all deliveries for a trainer (with filters)
export async function getTrainerDeliveries(
  trainerId: number,
  options?: {
    status?: string;
    clientId?: number;
    startDate?: Date;
    endDate?: Date;
  }
) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(productDeliveries.trainerId, trainerId)];
  
  if (options?.status) {
    conditions.push(eq(productDeliveries.status, options.status as any));
  }
  if (options?.clientId) {
    conditions.push(eq(productDeliveries.clientId, options.clientId));
  }
  if (options?.startDate) {
    conditions.push(gte(productDeliveries.createdAt, options.startDate));
  }
  if (options?.endDate) {
    conditions.push(lte(productDeliveries.createdAt, options.endDate));
  }
  
  const deliveries = await db
    .select({
      id: productDeliveries.id,
      orderId: productDeliveries.orderId,
      orderItemId: productDeliveries.orderItemId,
      clientId: productDeliveries.clientId,
      productName: productDeliveries.productName,
      quantity: productDeliveries.quantity,
      status: productDeliveries.status,
      scheduledDate: productDeliveries.scheduledDate,
      deliveredAt: productDeliveries.deliveredAt,
      confirmedAt: productDeliveries.confirmedAt,
      trainerNotes: productDeliveries.trainerNotes,
      clientNotes: productDeliveries.clientNotes,
      deliveryMethod: productDeliveries.deliveryMethod,
      trackingNumber: productDeliveries.trackingNumber,
      createdAt: productDeliveries.createdAt,
      clientName: users.name,
      clientEmail: users.email,
      orderNumber: orders.shopifyOrderNumber,
    })
    .from(productDeliveries)
    .leftJoin(users, eq(productDeliveries.clientId, users.id))
    .leftJoin(orders, eq(productDeliveries.orderId, orders.id))
    .where(and(...conditions))
    .orderBy(desc(productDeliveries.createdAt));
  
  return deliveries;
}

// Get deliveries for a client
export async function getClientDeliveries(
  clientId: number,
  options?: {
    status?: string;
    trainerId?: number;
  }
) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(productDeliveries.clientId, clientId)];
  
  if (options?.status) {
    conditions.push(eq(productDeliveries.status, options.status as any));
  }
  if (options?.trainerId) {
    conditions.push(eq(productDeliveries.trainerId, options.trainerId));
  }
  
  const deliveries = await db
    .select({
      id: productDeliveries.id,
      orderId: productDeliveries.orderId,
      productName: productDeliveries.productName,
      quantity: productDeliveries.quantity,
      status: productDeliveries.status,
      scheduledDate: productDeliveries.scheduledDate,
      deliveredAt: productDeliveries.deliveredAt,
      confirmedAt: productDeliveries.confirmedAt,
      trainerNotes: productDeliveries.trainerNotes,
      clientNotes: productDeliveries.clientNotes,
      deliveryMethod: productDeliveries.deliveryMethod,
      trackingNumber: productDeliveries.trackingNumber,
      createdAt: productDeliveries.createdAt,
      trainerId: productDeliveries.trainerId,
      trainerName: users.name,
      orderNumber: orders.shopifyOrderNumber,
    })
    .from(productDeliveries)
    .leftJoin(users, eq(productDeliveries.trainerId, users.id))
    .leftJoin(orders, eq(productDeliveries.orderId, orders.id))
    .where(and(...conditions))
    .orderBy(desc(productDeliveries.createdAt));
  
  return deliveries;
}

// Mark delivery as ready
export async function markDeliveryReady(deliveryId: number, trainerId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .update(productDeliveries)
    .set({ status: "ready" })
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.trainerId, trainerId),
        eq(productDeliveries.status, "pending")
      )
    );
  
  return result.affectedRows > 0;
}

// Mark delivery as delivered by trainer
export async function markDeliveryDelivered(
  deliveryId: number,
  trainerId: number,
  options?: {
    notes?: string;
    deliveryMethod?: "in_person" | "locker" | "front_desk" | "shipped";
    trackingNumber?: string;
  }
) {
  const db = await getDb();
  if (!db) return false;
  
  const updateData: any = {
    status: "delivered",
    deliveredAt: new Date(),
  };
  
  if (options?.notes) updateData.trainerNotes = options.notes;
  if (options?.deliveryMethod) updateData.deliveryMethod = options.deliveryMethod;
  if (options?.trackingNumber) updateData.trackingNumber = options.trackingNumber;
  
  const [result] = await db
    .update(productDeliveries)
    .set(updateData)
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.trainerId, trainerId),
        inArray(productDeliveries.status, ["pending", "ready"])
      )
    );
  
  return result.affectedRows > 0;
}

// Client confirms receipt
export async function confirmDeliveryReceipt(
  deliveryId: number,
  clientId: number,
  notes?: string
) {
  const db = await getDb();
  if (!db) return false;
  
  const updateData: any = {
    status: "confirmed",
    confirmedAt: new Date(),
  };
  
  if (notes) updateData.clientNotes = notes;
  
  const [result] = await db
    .update(productDeliveries)
    .set(updateData)
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.clientId, clientId),
        eq(productDeliveries.status, "delivered")
      )
    );
  
  return result.affectedRows > 0;
}

// Client reports issue with delivery - returns delivery details for notification
export async function reportDeliveryIssue(
  deliveryId: number,
  clientId: number,
  notes: string
): Promise<{ success: boolean; delivery?: { productName: string; trainerId: number; clientId: number } }> {
  const db = await getDb();
  if (!db) return { success: false };
  
  // First get the delivery details for notification
  const [delivery] = await db
    .select({
      productName: productDeliveries.productName,
      trainerId: productDeliveries.trainerId,
      clientId: productDeliveries.clientId,
    })
    .from(productDeliveries)
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.clientId, clientId),
        eq(productDeliveries.status, "delivered")
      )
    );
  
  if (!delivery) return { success: false };
  
  const [result] = await db
    .update(productDeliveries)
    .set({
      status: "disputed",
      clientNotes: notes,
    })
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.clientId, clientId),
        eq(productDeliveries.status, "delivered")
      )
    );
  
  return { success: result.affectedRows > 0, delivery };
}

// Get delivery statistics for a trainer
export async function getTrainerDeliveryStats(trainerId: number) {
  const db = await getDb();
  if (!db) return { pending: 0, ready: 0, delivered: 0, confirmed: 0, disputed: 0, total: 0 };
  
  const stats = await db
    .select({
      status: productDeliveries.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(productDeliveries)
    .where(eq(productDeliveries.trainerId, trainerId))
    .groupBy(productDeliveries.status);
  
  const result = { pending: 0, ready: 0, delivered: 0, confirmed: 0, disputed: 0, total: 0 };
  
  for (const stat of stats) {
    const count = Number(stat.count);
    result[stat.status as keyof typeof result] = count;
    result.total += count;
  }
  
  return result;
}

// Schedule a delivery
export async function scheduleDelivery(
  deliveryId: number,
  trainerId: number,
  scheduledDate: Date
) {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .update(productDeliveries)
    .set({ scheduledDate })
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.trainerId, trainerId)
      )
    );
  
  return result.affectedRows > 0;
}


// ============================================================================
// BUNDLE INVITATIONS
// ============================================================================

// Create a new bundle invitation
export async function createBundleInvitation(data: InsertBundleInvitation) {
  const db = await getDb();
  if (!db) return null;
  
  const [result] = await db.insert(bundleInvitations).values(data);
  const insertId = result.insertId;
  
  // Return the full invitation object
  const [invitation] = await db
    .select()
    .from(bundleInvitations)
    .where(eq(bundleInvitations.id, insertId))
    .limit(1);
  
  return invitation || null;
}

// Get bundle invitation by token
export async function getBundleInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [invitation] = await db
    .select()
    .from(bundleInvitations)
    .where(eq(bundleInvitations.token, token))
    .limit(1);
  
  return invitation || null;
}

// Get bundle invitation with full details (trainer, bundle info)
export async function getBundleInvitationWithDetails(token: string) {
  const db = await getDb();
  if (!db) return null;
  
  const [invitation] = await db
    .select({
      id: bundleInvitations.id,
      trainerId: bundleInvitations.trainerId,
      bundleId: bundleInvitations.bundleId,
      email: bundleInvitations.email,
      recipientName: bundleInvitations.recipientName,
      token: bundleInvitations.token,
      personalMessage: bundleInvitations.personalMessage,
      status: bundleInvitations.status,
      expiresAt: bundleInvitations.expiresAt,
      createdAt: bundleInvitations.createdAt,
      trainerName: users.name,
      trainerPhoto: users.photoUrl,
      trainerBio: users.bio,
      trainerSpecialties: users.specialties,
      bundleTitle: bundleDrafts.title,
      bundleDescription: bundleDrafts.description,
      bundleImageUrl: bundleDrafts.imageUrl,
      bundlePrice: bundleDrafts.price,
      bundleGoals: bundleDrafts.goalsJson,
      bundleProductsJson: bundleDrafts.productsJson,
      bundleServicesJson: bundleDrafts.servicesJson,
    })
    .from(bundleInvitations)
    .leftJoin(users, eq(bundleInvitations.trainerId, users.id))
    .leftJoin(bundleDrafts, eq(bundleInvitations.bundleId, bundleDrafts.id))
    .where(eq(bundleInvitations.token, token))
    .limit(1);
  
  return invitation || null;
}

// Update invitation status
export async function updateBundleInvitationStatus(
  id: number,
  status: "pending" | "viewed" | "accepted" | "declined" | "expired" | "revoked",
  additionalData?: {
    viewedAt?: Date;
    acceptedAt?: Date;
    declinedAt?: Date;
    acceptedByUserId?: number;
    orderId?: number;
  }
) {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .update(bundleInvitations)
    .set({
      status,
      ...additionalData,
    })
    .where(eq(bundleInvitations.id, id));
  
  return result.affectedRows > 0;
}

// Mark invitation as viewed
export async function markBundleInvitationViewed(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .update(bundleInvitations)
    .set({
      status: "viewed",
      viewedAt: new Date(),
    })
    .where(
      and(
        eq(bundleInvitations.id, id),
        eq(bundleInvitations.status, "pending")
      )
    );
  
  return result.affectedRows > 0;
}

// Accept bundle invitation
export async function acceptBundleInvitation(
  id: number,
  userId: number,
  orderId?: number
) {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .update(bundleInvitations)
    .set({
      status: "accepted",
      acceptedAt: new Date(),
      acceptedByUserId: userId,
      orderId,
    })
    .where(eq(bundleInvitations.id, id));
  
  return result.affectedRows > 0;
}

// Decline bundle invitation
export async function declineBundleInvitation(id: number) {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .update(bundleInvitations)
    .set({
      status: "declined",
      declinedAt: new Date(),
    })
    .where(eq(bundleInvitations.id, id));
  
  return result.affectedRows > 0;
}

// Get invitations sent by a trainer
export async function getTrainerBundleInvitations(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const invites = await db
    .select({
      id: bundleInvitations.id,
      email: bundleInvitations.email,
      recipientName: bundleInvitations.recipientName,
      recipientPhotoUrl: users.photoUrl,
      status: bundleInvitations.status,
      bundleId: bundleInvitations.bundleId,
      bundleTitle: bundleDrafts.title,
      bundleImageUrl: bundleDrafts.imageUrl,
      token: bundleInvitations.token,
      createdAt: bundleInvitations.createdAt,
      viewedAt: bundleInvitations.viewedAt,
      acceptedAt: bundleInvitations.acceptedAt,
      expiresAt: bundleInvitations.expiresAt,
    })
    .from(bundleInvitations)
    .leftJoin(bundleDrafts, eq(bundleInvitations.bundleId, bundleDrafts.id))
    .leftJoin(users, eq(bundleInvitations.email, users.email))
    .where(eq(bundleInvitations.trainerId, trainerId))
    .orderBy(desc(bundleInvitations.createdAt));
  
  return invites;
}

// Check if email already has pending invitation for this bundle
export async function hasPendingBundleInvitation(
  trainerId: number,
  bundleId: number,
  email: string
) {
  const db = await getDb();
  if (!db) return false;
  
  const [existing] = await db
    .select({ id: bundleInvitations.id })
    .from(bundleInvitations)
    .where(
      and(
        eq(bundleInvitations.trainerId, trainerId),
        eq(bundleInvitations.bundleId, bundleId),
        eq(bundleInvitations.email, email.toLowerCase()),
        inArray(bundleInvitations.status, ["pending", "viewed"])
      )
    )
    .limit(1);
  
  return !!existing;
}

// Expire old invitations
export async function expireOldBundleInvitations() {
  const db = await getDb();
  if (!db) return 0;
  
  const [result] = await db
    .update(bundleInvitations)
    .set({ status: "expired" })
    .where(
      and(
        inArray(bundleInvitations.status, ["pending", "viewed"]),
        lt(bundleInvitations.expiresAt, new Date())
      )
    );
  
  return result.affectedRows;
}

// Get invitation statistics for a trainer
export async function getTrainerInvitationStats(trainerId: number) {
  const db = await getDb();
  if (!db) return { sent: 0, viewed: 0, accepted: 0, declined: 0, expired: 0, pending: 0 };
  
  const stats = await db
    .select({
      status: bundleInvitations.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(bundleInvitations)
    .where(eq(bundleInvitations.trainerId, trainerId))
    .groupBy(bundleInvitations.status);
  
  const result = { sent: 0, viewed: 0, accepted: 0, declined: 0, expired: 0, pending: 0 };
  
  for (const stat of stats) {
    const count = Number(stat.count);
    if (stat.status === "pending") result.pending = count;
    else if (stat.status === "viewed") result.viewed = count;
    else if (stat.status === "accepted") result.accepted = count;
    else if (stat.status === "declined") result.declined = count;
    else if (stat.status === "expired") result.expired = count;
    result.sent += count;
  }
  
  return result;
}

// Get bundle invitation by ID
export async function getBundleInvitationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [invitation] = await db
    .select()
    .from(bundleInvitations)
    .where(eq(bundleInvitations.id, id))
    .limit(1);
  
  return invitation || null;
}


// Get all pending deliveries across all trainers (for cron job reminders)
export async function getAllPendingDeliveries() {
  const db = await getDb();
  if (!db) return [];
  
  const deliveries = await db
    .select({
      id: productDeliveries.id,
      orderId: productDeliveries.orderId,
      orderItemId: productDeliveries.orderItemId,
      trainerId: productDeliveries.trainerId,
      clientId: productDeliveries.clientId,
      productName: productDeliveries.productName,
      quantity: productDeliveries.quantity,
      status: productDeliveries.status,
      scheduledDate: productDeliveries.scheduledDate,
      deliveryMethod: productDeliveries.deliveryMethod,
      createdAt: productDeliveries.createdAt,
      clientName: users.name,
      clientEmail: users.email,
      trainerName: sql<string>`(SELECT name FROM users WHERE id = ${productDeliveries.trainerId})`,
    })
    .from(productDeliveries)
    .leftJoin(users, eq(productDeliveries.clientId, users.id))
    .where(inArray(productDeliveries.status, ["pending", "ready"]))
    .orderBy(asc(productDeliveries.scheduledDate));
  
  return deliveries;
}


// ============================================================================
// DELIVERY RESCHEDULE REQUESTS
// ============================================================================

// Client requests to reschedule a delivery
export async function requestDeliveryReschedule(
  deliveryId: number,
  clientId: number,
  proposedDate: Date,
  reason: string
) {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .update(productDeliveries)
    .set({
      rescheduleRequestedAt: new Date(),
      rescheduleRequestedDate: proposedDate,
      rescheduleReason: reason,
      rescheduleStatus: "pending",
    })
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.clientId, clientId),
        inArray(productDeliveries.status, ["pending", "ready"]),
        // Only allow one pending reschedule request at a time
        sql`(${productDeliveries.rescheduleStatus} IS NULL OR ${productDeliveries.rescheduleStatus} = 'none' OR ${productDeliveries.rescheduleStatus} = 'rejected')`
      )
    );
  
  return result.affectedRows > 0;
}

// Trainer approves reschedule request
export async function approveDeliveryReschedule(
  deliveryId: number,
  trainerId: number,
  note?: string
) {
  const db = await getDb();
  if (!db) return false;
  
  // First get the proposed date
  const [delivery] = await db
    .select({ rescheduleRequestedDate: productDeliveries.rescheduleRequestedDate })
    .from(productDeliveries)
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.trainerId, trainerId),
        eq(productDeliveries.rescheduleStatus, "pending")
      )
    )
    .limit(1);
  
  if (!delivery?.rescheduleRequestedDate) return false;
  
  const [result] = await db
    .update(productDeliveries)
    .set({
      scheduledDate: delivery.rescheduleRequestedDate,
      rescheduleStatus: "approved",
      rescheduleResponseAt: new Date(),
      rescheduleResponseNote: note || null,
    })
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.trainerId, trainerId),
        eq(productDeliveries.rescheduleStatus, "pending")
      )
    );
  
  return result.affectedRows > 0;
}

// Trainer rejects reschedule request
export async function rejectDeliveryReschedule(
  deliveryId: number,
  trainerId: number,
  note: string
) {
  const db = await getDb();
  if (!db) return false;
  
  const [result] = await db
    .update(productDeliveries)
    .set({
      rescheduleStatus: "rejected",
      rescheduleResponseAt: new Date(),
      rescheduleResponseNote: note,
    })
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.trainerId, trainerId),
        eq(productDeliveries.rescheduleStatus, "pending")
      )
    );
  
  return result.affectedRows > 0;
}

// Get pending reschedule requests for a trainer
export async function getTrainerRescheduleRequests(trainerId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db
    .select({
      id: productDeliveries.id,
      productName: productDeliveries.productName,
      quantity: productDeliveries.quantity,
      currentScheduledDate: productDeliveries.scheduledDate,
      rescheduleRequestedAt: productDeliveries.rescheduleRequestedAt,
      rescheduleRequestedDate: productDeliveries.rescheduleRequestedDate,
      rescheduleReason: productDeliveries.rescheduleReason,
      clientId: productDeliveries.clientId,
      clientName: users.name,
      clientEmail: users.email,
    })
    .from(productDeliveries)
    .leftJoin(users, eq(productDeliveries.clientId, users.id))
    .where(
      and(
        eq(productDeliveries.trainerId, trainerId),
        eq(productDeliveries.rescheduleStatus, "pending")
      )
    )
    .orderBy(asc(productDeliveries.rescheduleRequestedAt));
}


// ============================================================================
// MANAGER DELIVERY OPERATIONS
// ============================================================================

// Get all deliveries for manager with optional filters
export async function getAllDeliveries(filters?: {
  status?: string;
  trainerId?: number;
  clientId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions: ReturnType<typeof eq>[] = [];
  
  if (filters?.status) {
    conditions.push(eq(productDeliveries.status, filters.status as any));
  }
  if (filters?.trainerId) {
    conditions.push(eq(productDeliveries.trainerId, filters.trainerId));
  }
  if (filters?.clientId) {
    conditions.push(eq(productDeliveries.clientId, filters.clientId));
  }
  
  const deliveries = await db
    .select({
      id: productDeliveries.id,
      orderId: productDeliveries.orderId,
      orderItemId: productDeliveries.orderItemId,
      clientId: productDeliveries.clientId,
      trainerId: productDeliveries.trainerId,
      productName: productDeliveries.productName,
      quantity: productDeliveries.quantity,
      status: productDeliveries.status,
      scheduledDate: productDeliveries.scheduledDate,
      deliveredAt: productDeliveries.deliveredAt,
      confirmedAt: productDeliveries.confirmedAt,
      trainerNotes: productDeliveries.trainerNotes,
      clientNotes: productDeliveries.clientNotes,
      deliveryMethod: productDeliveries.deliveryMethod,
      trackingNumber: productDeliveries.trackingNumber,
      createdAt: productDeliveries.createdAt,
      clientName: users.name,
      clientEmail: users.email,
      trainerName: sql<string>`(SELECT name FROM users WHERE id = ${productDeliveries.trainerId})`,
      orderNumber: orders.shopifyOrderNumber,
      resolvedAt: productDeliveries.resolvedAt,
      resolvedBy: productDeliveries.resolvedBy,
      resolutionType: productDeliveries.resolutionType,
      resolutionNotes: productDeliveries.resolutionNotes,
    })
    .from(productDeliveries)
    .leftJoin(users, eq(productDeliveries.clientId, users.id))
    .leftJoin(orders, eq(productDeliveries.orderId, orders.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(productDeliveries.createdAt));
  
  return deliveries;
}

// Resolve a delivery dispute (manager action) - returns client info for notification
export async function resolveDeliveryDispute(
  deliveryId: number,
  resolvedBy: number,
  resolutionType: string,
  notes?: string
): Promise<{ success: boolean; clientId?: number; productName?: string }> {
  const db = await getDb();
  if (!db) return { success: false };
  
  // First get the delivery details for notification
  const [delivery] = await db
    .select({
      clientId: productDeliveries.clientId,
      productName: productDeliveries.productName,
    })
    .from(productDeliveries)
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.status, "disputed")
      )
    );
  
  if (!delivery) return { success: false };
  
  const [result] = await db
    .update(productDeliveries)
    .set({
      status: "confirmed", // Use 'confirmed' as resolved state since 'resolved' is not in enum
      resolvedAt: new Date(),
      resolvedBy,
      resolutionType: resolutionType as any,
      resolutionNotes: notes || null,
    })
    .where(
      and(
        eq(productDeliveries.id, deliveryId),
        eq(productDeliveries.status, "disputed")
      )
    );
  
  return { 
    success: result.affectedRows > 0, 
    clientId: delivery.clientId, 
    productName: delivery.productName 
  };
}


// Get all manager phone numbers for notifications
export async function getManagerPhoneNumbers(): Promise<{ id: number; name: string | null; phone: string }[]> {
  const db = await getDb();
  if (!db) return [];
  
  const managers = await db
    .select({
      id: users.id,
      name: users.name,
      phone: users.phone,
    })
    .from(users)
    .where(
      and(
        inArray(users.role, ["manager", "coordinator"]),
        isNotNull(users.phone)
      )
    );
  
  return managers.filter(m => m.phone) as { id: number; name: string | null; phone: string }[];
}

// Get client details for notification
export async function getClientForNotification(clientId: number): Promise<{ name: string | null; phone: string | null } | null> {
  const db = await getDb();
  if (!db) return null;
  
  const [client] = await db
    .select({
      name: users.name,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, clientId));
  
  return client || null;
}


// ============================================================================
// ANALYTICS REPORTS
// ============================================================================

export async function saveAnalyticsReport(data: {
  generatedBy: number;
  reportType: "revenue" | "trainers" | "bundles" | "orders" | "full";
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  dateRangeLabel: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  totalRevenue?: string;
  orderCount?: number;
  trainerCount?: number;
  bundleCount?: number;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const [result] = await db.insert(analyticsReports).values({
    generatedBy: data.generatedBy,
    reportType: data.reportType,
    dateRangeStart: data.dateRangeStart,
    dateRangeEnd: data.dateRangeEnd,
    dateRangeLabel: data.dateRangeLabel,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    fileSize: data.fileSize,
    totalRevenue: data.totalRevenue,
    orderCount: data.orderCount,
    trainerCount: data.trainerCount,
    bundleCount: data.bundleCount,
    metadata: data.metadata,
  });
  
  // Fetch the inserted record
  const [report] = await db
    .select()
    .from(analyticsReports)
    .where(eq(analyticsReports.id, result.insertId));
  
  return report;
}

export async function getRecentAnalyticsReports(limit: number = 10) {
  const db = await getDb();
  if (!db) return [];
  
  const reports = await db
    .select({
      id: analyticsReports.id,
      reportType: analyticsReports.reportType,
      dateRangeLabel: analyticsReports.dateRangeLabel,
      fileName: analyticsReports.fileName,
      fileUrl: analyticsReports.fileUrl,
      fileSize: analyticsReports.fileSize,
      totalRevenue: analyticsReports.totalRevenue,
      orderCount: analyticsReports.orderCount,
      trainerCount: analyticsReports.trainerCount,
      bundleCount: analyticsReports.bundleCount,
      createdAt: analyticsReports.createdAt,
      generatedBy: analyticsReports.generatedBy,
    })
    .from(analyticsReports)
    .orderBy(desc(analyticsReports.createdAt))
    .limit(limit);
  
  // Get generator names
  const generatorIds = Array.from(new Set(reports.map(r => r.generatedBy)));
  const generators = generatorIds.length > 0
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, generatorIds))
    : [];
  
  return reports.map(report => ({
    ...report,
    generatedByName: generators.find(g => g.id === report.generatedBy)?.name || "Unknown",
  }));
}


// ============================================================================
// SHOPIFY SYNC RESULTS
// ============================================================================

export async function saveSyncResult(data: {
  triggeredBy: number;
  status: "success" | "partial" | "failed";
  productsSynced: number;
  productsErrors: number;
  bundlesSynced: number;
  bundlesErrors: number;
  customersSynced: number;
  customersErrors: number;
  syncedItems: unknown[];
  errorItems: unknown[];
  durationMs: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(shopifySyncResults).values({
    triggeredBy: data.triggeredBy,
    status: data.status,
    productsSynced: data.productsSynced,
    productsErrors: data.productsErrors,
    bundlesSynced: data.bundlesSynced,
    bundlesErrors: data.bundlesErrors,
    customersSynced: data.customersSynced,
    customersErrors: data.customersErrors,
    syncedItems: data.syncedItems,
    errorItems: data.errorItems,
    durationMs: data.durationMs,
  });
  
  return { id: Number(result[0].insertId) };
}

export async function getLastSyncResult() {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db
    .select()
    .from(shopifySyncResults)
    .orderBy(desc(shopifySyncResults.createdAt))
    .limit(1);
  
  if (results.length === 0) return null;
  
  const result = results[0];
  
  // Get the user who triggered the sync
  const triggeredByUser = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, result.triggeredBy))
    .limit(1);
  
  return {
    ...result,
    triggeredByName: triggeredByUser[0]?.name || "Unknown",
  };
}

export async function getSyncResultById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db
    .select()
    .from(shopifySyncResults)
    .where(eq(shopifySyncResults.id, id))
    .limit(1);
  
  if (results.length === 0) return null;
  
  const result = results[0];
  
  // Get the user who triggered the sync
  const triggeredByUser = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, result.triggeredBy))
    .limit(1);
  
  return {
    ...result,
    triggeredByName: triggeredByUser[0]?.name || "Unknown",
  };
}

export async function updateSyncResultCsvUrl(id: number, csvFileUrl: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(shopifySyncResults)
    .set({ csvFileUrl })
    .where(eq(shopifySyncResults.id, id));
}
