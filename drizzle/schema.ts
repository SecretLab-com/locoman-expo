import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  photoUrl: text("photoUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["shopper", "client", "trainer", "manager", "coordinator"])
    .default("shopper")
    .notNull(),
  username: varchar("username", { length: 64 }).unique(),
  bio: text("bio"),
  specialties: json("specialties"),
  socialLinks: json("socialLinks"),
  trainerId: int("trainerId"),
  active: boolean("active").default(true).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// BUNDLE TEMPLATES (Manager-created templates)
// ============================================================================

export const bundleTemplates = mysqlTable("bundle_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  goalType: mysqlEnum("goalType", ["weight_loss", "strength", "longevity", "power"]),
  goalsJson: json("goalsJson"),
  imageUrl: text("imageUrl"),
  basePrice: decimal("basePrice", { precision: 10, scale: 2 }),
  minPrice: decimal("minPrice", { precision: 10, scale: 2 }),
  maxPrice: decimal("maxPrice", { precision: 10, scale: 2 }),
  rulesJson: json("rulesJson"),
  defaultServices: json("defaultServices"),
  defaultProducts: json("defaultProducts"),
  active: boolean("active").default(true).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BundleTemplate = typeof bundleTemplates.$inferSelect;
export type InsertBundleTemplate = typeof bundleTemplates.$inferInsert;

// ============================================================================
// BUNDLE DRAFTS (Trainer work-in-progress)
// ============================================================================

export const bundleDrafts = mysqlTable("bundle_drafts", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  templateId: int("templateId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  imageSource: mysqlEnum("imageSource", ["ai", "custom"]).default("ai"),
  price: decimal("price", { precision: 10, scale: 2 }),
  cadence: mysqlEnum("cadence", ["one_time", "weekly", "monthly"]).default("one_time"),
  selectionsJson: json("selectionsJson"),
  servicesJson: json("servicesJson"),
  productsJson: json("productsJson"),
  goalsJson: json("goalsJson"),
  suggestedGoal: varchar("suggestedGoal", { length: 100 }),
  status: mysqlEnum("status", ["draft", "validating", "ready", "pending_review", "changes_requested", "pending_update", "publishing", "published", "failed", "rejected"])
    .default("draft")
    .notNull(),
  shopifyProductId: bigint("shopifyProductId", { mode: "number" }),
  shopifyVariantId: bigint("shopifyVariantId", { mode: "number" }),
  viewCount: int("viewCount").default(0),
  salesCount: int("salesCount").default(0),
  totalRevenue: decimal("totalRevenue", { precision: 10, scale: 2 }).default("0"),
  submittedForReviewAt: timestamp("submittedForReviewAt"),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
  rejectionReason: text("rejectionReason"),
  reviewComments: text("reviewComments"),
  version: int("version").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BundleDraft = typeof bundleDrafts.$inferSelect;
export type InsertBundleDraft = typeof bundleDrafts.$inferInsert;

// ============================================================================
// PRODUCTS (Synced from Shopify)
// ============================================================================

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  shopifyProductId: bigint("shopifyProductId", { mode: "number" }),
  shopifyVariantId: bigint("shopifyVariantId", { mode: "number" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal("compareAtPrice", { precision: 10, scale: 2 }),
  brand: varchar("brand", { length: 100 }),
  category: mysqlEnum("category", [
    "protein",
    "pre_workout",
    "post_workout",
    "recovery",
    "strength",
    "wellness",
    "hydration",
    "vitamins",
  ]),
  phase: mysqlEnum("phase", ["preworkout", "postworkout", "recovery"]),
  fulfillmentOptions: json("fulfillmentOptions"),
  inventoryQuantity: int("inventoryQuantity").default(0),
  availability: mysqlEnum("availability", ["available", "out_of_stock", "discontinued"]).default("available"),
  isApproved: boolean("isApproved").default(false),
  syncedAt: timestamp("syncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ============================================================================
// CLIENTS (Trainer's client relationships)
// ============================================================================

export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  photoUrl: text("photoUrl"),
  goals: json("goals"),
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "active", "inactive", "removed"]).default("pending"),
  invitedAt: timestamp("invitedAt"),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ============================================================================
// SUBSCRIPTIONS (with session tracking)
// ============================================================================

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  trainerId: int("trainerId").notNull(),
  bundleDraftId: int("bundleDraftId"),
  status: mysqlEnum("status", ["active", "paused", "cancelled", "expired"]).default("active"),
  subscriptionType: mysqlEnum("subscriptionType", ["weekly", "monthly", "yearly"]).default("monthly"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  renewalDate: timestamp("renewalDate"),
  pausedAt: timestamp("pausedAt"),
  cancelledAt: timestamp("cancelledAt"),
  // Session tracking - key feature for tracking service usage
  sessionsIncluded: int("sessionsIncluded").default(0),
  sessionsUsed: int("sessionsUsed").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ============================================================================
// SESSIONS (Training sessions with usage tracking)
// ============================================================================

export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  trainerId: int("trainerId").notNull(),
  subscriptionId: int("subscriptionId"),
  sessionDate: timestamp("sessionDate").notNull(),
  durationMinutes: int("durationMinutes").default(60),
  sessionType: mysqlEnum("sessionType", ["training", "check_in", "call", "plan_review"]).default("training"),
  location: varchar("location", { length: 255 }),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
  notes: text("notes"),
  // When marked as completed, this counts against sessionsUsed in subscription
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// ============================================================================
// ORDERS
// ============================================================================

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  shopifyOrderId: bigint("shopifyOrderId", { mode: "number" }),
  shopifyOrderNumber: varchar("shopifyOrderNumber", { length: 64 }),
  clientId: int("clientId"),
  trainerId: int("trainerId"),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerName: varchar("customerName", { length: 255 }),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  subtotalAmount: decimal("subtotalAmount", { precision: 10, scale: 2 }),
  taxAmount: decimal("taxAmount", { precision: 10, scale: 2 }),
  shippingAmount: decimal("shippingAmount", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ]).default("pending"),
  fulfillmentStatus: mysqlEnum("fulfillmentStatus", [
    "unfulfilled",
    "partial",
    "fulfilled",
    "restocked",
  ]).default("unfulfilled"),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "refunded", "partially_refunded"]).default("pending"),
  fulfillmentMethod: mysqlEnum("fulfillmentMethod", [
    "home_ship",
    "trainer_delivery",
    "vending",
    "cafeteria",
  ]).default("home_ship"),
  deliveryDate: timestamp("deliveryDate"),
  deliveredAt: timestamp("deliveredAt"),
  trackingNumber: varchar("trackingNumber", { length: 255 }),
  orderData: json("orderData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// ============================================================================
// ORDER ITEMS
// ============================================================================

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId"),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  fulfillmentStatus: mysqlEnum("fulfillmentStatus", ["unfulfilled", "fulfilled", "restocked"]).default("unfulfilled"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// ============================================================================
// PRODUCT DELIVERIES (Trainer-to-client deliveries)
// ============================================================================

export const productDeliveries = mysqlTable("product_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId"),
  orderItemId: int("orderItemId"),
  trainerId: int("trainerId").notNull(),
  clientId: int("clientId").notNull(),
  productId: int("productId"),
  productName: varchar("productName", { length: 255 }).notNull(),
  quantity: int("quantity").default(1).notNull(),
  status: mysqlEnum("status", [
    "pending",
    "ready",
    "scheduled",
    "out_for_delivery",
    "delivered",
    "confirmed",
    "disputed",
    "cancelled",
  ]).default("pending"),
  scheduledDate: timestamp("scheduledDate"),
  deliveredAt: timestamp("deliveredAt"),
  confirmedAt: timestamp("confirmedAt"),
  deliveryMethod: mysqlEnum("deliveryMethod", ["in_person", "locker", "front_desk", "shipped"]),
  trackingNumber: varchar("trackingNumber", { length: 255 }),
  notes: text("notes"),
  clientNotes: text("clientNotes"),
  disputeReason: text("disputeReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductDelivery = typeof productDeliveries.$inferSelect;
export type InsertProductDelivery = typeof productDeliveries.$inferInsert;

// ============================================================================
// MESSAGES (In-app messaging)
// ============================================================================

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  senderId: int("senderId").notNull(),
  receiverId: int("receiverId").notNull(),
  conversationId: varchar("conversationId", { length: 64 }).notNull(),
  content: text("content").notNull(),
  messageType: mysqlEnum("messageType", ["text", "image", "file", "system"]).default("text"),
  attachmentUrl: text("attachmentUrl"),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

// ============================================================================
// CALENDAR EVENTS
// ============================================================================

export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  eventType: mysqlEnum("eventType", ["session", "delivery", "appointment", "other"]).default("other"),
  relatedClientId: int("relatedClientId"),
  relatedOrderId: int("relatedOrderId"),
  reminderSent: boolean("reminderSent").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

// ============================================================================
// TRAINER EARNINGS
// ============================================================================

export const trainerEarnings = mysqlTable("trainer_earnings", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  orderId: int("orderId"),
  bundleDraftId: int("bundleDraftId"),
  subscriptionId: int("subscriptionId"),
  earningType: mysqlEnum("earningType", ["bundle_sale", "subscription", "commission", "bonus"]).default("bundle_sale"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "paid", "cancelled"]).default("pending"),
  paidAt: timestamp("paidAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainerEarning = typeof trainerEarnings.$inferSelect;
export type InsertTrainerEarning = typeof trainerEarnings.$inferInsert;

// ============================================================================
// ACTIVITY LOGS
// ============================================================================

export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }),
  entityId: int("entityId"),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ============================================================================
// INVITATIONS (Trainer invites client)
// ============================================================================

export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  bundleDraftId: int("bundleDraftId"),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"]).default("pending"),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  acceptedByUserId: int("acceptedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

// ============================================================================
// USER INVITATIONS (Manager invites new users with role)
// ============================================================================

export const userInvitations = mysqlTable("user_invitations", {
  id: int("id").autoincrement().primaryKey(),
  invitedBy: int("invitedBy").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: mysqlEnum("role", ["shopper", "client", "trainer", "manager", "coordinator"])
    .default("shopper")
    .notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"]).default("pending"),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  acceptedByUserId: int("acceptedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = typeof userInvitations.$inferInsert;

// ============================================================================
// USER ACTIVITY LOGS (Admin actions on users)
// ============================================================================

export const userActivityLogs = mysqlTable("user_activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  targetUserId: int("targetUserId").notNull(),
  performedBy: int("performedBy").notNull(),
  action: mysqlEnum("action", [
    "role_changed",
    "status_changed",
    "impersonation_started",
    "impersonation_ended",
    "profile_updated",
    "invited",
    "deleted",
  ]).notNull(),
  previousValue: varchar("previousValue", { length: 100 }),
  newValue: varchar("newValue", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserActivityLog = typeof userActivityLogs.$inferSelect;
export type InsertUserActivityLog = typeof userActivityLogs.$inferInsert;
