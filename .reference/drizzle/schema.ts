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
  username: varchar("username", { length: 64 }).unique(), // For trainer landing pages /t/{username}
  bio: text("bio"), // Trainer bio for landing page
  specialties: json("specialties"), // ["weight_loss", "strength", etc.]
  socialLinks: json("socialLinks"), // { instagram: "...", twitter: "..." }
  shopDomain: varchar("shopDomain", { length: 255 }),
  trainerId: int("trainerId"), // For clients assigned to trainers
  active: boolean("active").default(true).notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }), // For email/password auth (bcrypt hash)
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// TRAINER MEDIA (Profile photos, gallery images, videos)
// ============================================================================

export const trainerMedia = mysqlTable("trainer_media", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(), // References users.id where role = 'trainer'
  type: mysqlEnum("type", ["profile_photo", "gallery_image", "video", "bundle_cover"]).notNull(),
  url: text("url").notNull(), // S3 URL for images, or embed URL for videos
  thumbnailUrl: text("thumbnailUrl"), // For videos, store thumbnail
  title: varchar("title", { length: 255 }), // Optional caption/title
  description: text("description"), // Optional description
  sortOrder: int("sortOrder").default(0).notNull(), // For ordering gallery images
  videoProvider: mysqlEnum("videoProvider", ["youtube", "vimeo", "upload"]), // Video source
  videoId: varchar("videoId", { length: 64 }), // YouTube/Vimeo video ID
  fileKey: varchar("fileKey", { length: 512 }), // S3 file key for deletion
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"), // File size in bytes
  width: int("width"), // Image dimensions
  height: int("height"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainerMedia = typeof trainerMedia.$inferSelect;
export type InsertTrainerMedia = typeof trainerMedia.$inferInsert;

// ============================================================================
// REVOKED SESSIONS (Server-side session invalidation)
// ============================================================================

export const revokedSessions = mysqlTable("revoked_sessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(), // SHA-256 hash of the session token
  userId: int("userId"), // Optional: track which user's session was revoked
  revokedAt: timestamp("revokedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // When the original token would have expired (for cleanup)
});

export type RevokedSession = typeof revokedSessions.$inferSelect;
export type InsertRevokedSession = typeof revokedSessions.$inferInsert;

// ============================================================================
// SHOPS (Shopify Store Connections)
// ============================================================================

export const shops = mysqlTable("shops", {
  id: int("id").autoincrement().primaryKey(),
  shopifyDomain: varchar("shopifyDomain", { length: 255 }).notNull().unique(),
  shopifyShopId: varchar("shopifyShopId", { length: 64 }),
  accessToken: text("accessToken"), // Encrypted in production
  scopes: text("scopes"),
  status: mysqlEnum("status", ["active", "suspended", "uninstalled"]).default("active"),
  settings: json("settings"),
  installedAt: timestamp("installedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Shop = typeof shops.$inferSelect;
export type InsertShop = typeof shops.$inferInsert;

// ============================================================================
// BUNDLE TEMPLATES (Manager-created templates)
// ============================================================================

export const bundleTemplates = mysqlTable("bundle_templates", {
  id: int("id").autoincrement().primaryKey(),
  shopId: int("shopId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  goalType: mysqlEnum("goalType", ["weight_loss", "strength", "longevity", "power"]), // Kept for backwards compatibility
  goalsJson: json("goalsJson"), // Array of goal type strings (new tag-based system)
  imageUrl: text("imageUrl"),
  basePrice: decimal("basePrice", { precision: 10, scale: 2 }),
  minPrice: decimal("minPrice", { precision: 10, scale: 2 }),
  maxPrice: decimal("maxPrice", { precision: 10, scale: 2 }),
  rulesJson: json("rulesJson"), // Swap groups, constraints, etc.
  defaultServices: json("defaultServices"), // Default service configuration
  defaultProducts: json("defaultProducts"), // Default product selections
  active: boolean("active").default(true).notNull(),
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
  shopId: int("shopId"),
  trainerId: int("trainerId").notNull(),
  templateId: int("templateId"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  imageSource: mysqlEnum("imageSource", ["ai", "custom"]).default("ai"),
  price: decimal("price", { precision: 10, scale: 2 }),
  cadence: mysqlEnum("cadence", ["one_time", "weekly", "monthly"]).default("one_time"),
  selectionsJson: json("selectionsJson"), // Trainer's component selections
  servicesJson: json("servicesJson"), // Service configurations
  productsJson: json("productsJson"), // Product selections
  goalsJson: json("goalsJson"), // Array of selected goal types
  suggestedGoal: varchar("suggestedGoal", { length: 100 }), // Trainer-suggested new goal type
  eligibilityRules: json("eligibilityRules"),
  scarcityRules: json("scarcityRules"),
  status: mysqlEnum("status", ["draft", "validating", "ready", "pending_review", "pending_update", "publishing", "published", "failed", "rejected"])
    .default("draft")
    .notNull(),
  // Shopify product ID when published
  shopifyProductId: bigint("shopifyProductId", { mode: "number" }),
  shopifyVariantId: bigint("shopifyVariantId", { mode: "number" }),
  // Analytics tracking
  viewCount: int("viewCount").default(0),
  salesCount: int("salesCount").default(0),
  totalRevenue: decimal("totalRevenue", { precision: 10, scale: 2 }).default("0"),
  lastViewedAt: timestamp("lastViewedAt"),
  lastSoldAt: timestamp("lastSoldAt"),
  // Image analytics
  imageAnalytics: json("imageAnalytics"), // { colorPalette: [], hasText: bool, style: string, brightness: string }
  // Store the last published snapshot for comparison during update approval
  publishedSnapshot: json("publishedSnapshot"),
  submittedForReviewAt: timestamp("submittedForReviewAt"),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
  rejectionReason: text("rejectionReason"),
  version: int("version").default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BundleDraft = typeof bundleDrafts.$inferSelect;
export type InsertBundleDraft = typeof bundleDrafts.$inferInsert;

// ============================================================================
// BUNDLE PUBLICATIONS (Published to Shopify)
// ============================================================================

export const bundlePublications = mysqlTable("bundle_publications", {
  id: int("id").autoincrement().primaryKey(),
  draftId: int("draftId").notNull(),
  shopifyProductId: varchar("shopifyProductId", { length: 64 }),
  shopifyVariantId: varchar("shopifyVariantId", { length: 64 }),
  shopifyOperationId: varchar("shopifyOperationId", { length: 64 }),
  state: mysqlEnum("state", [
    "init",
    "product_created",
    "bundle_creating",
    "bundle_ready",
    "publishing",
    "published",
    "failed",
  ])
    .default("init")
    .notNull(),
  lastError: text("lastError"),
  retryCount: int("retryCount").default(0),
  publishedAt: timestamp("publishedAt"),
  syncedAt: timestamp("syncedAt"),
  syncStatus: mysqlEnum("syncStatus", ["synced", "pending", "failed", "conflict"]).default("pending"),
  lastSyncError: text("lastSyncError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BundlePublication = typeof bundlePublications.$inferSelect;
export type InsertBundlePublication = typeof bundlePublications.$inferInsert;

// ============================================================================
// PRODUCTS (Synced from Shopify)
// ============================================================================

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  shopifyProductId: bigint("shopifyProductId", { mode: "number" }),
  shopifyVariantId: bigint("shopifyVariantId", { mode: "number" }),
  shopDomain: varchar("shopDomain", { length: 255 }),
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
  fulfillmentOptions: json("fulfillmentOptions"), // ["home_ship", "trainer_delivery", "vending", "cafeteria"]
  inventoryQuantity: int("inventoryQuantity").default(0),
  availability: mysqlEnum("availability", ["available", "out_of_stock", "discontinued"]).default(
    "available"
  ),
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
  userId: int("userId"), // Links to users table if client has account
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  photoUrl: text("photoUrl"),
  goals: json("goals"), // ["weight_loss", "strength", etc.]
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "active", "inactive", "removed"]).default("pending"),
  invitedAt: timestamp("invitedAt"),
  acceptedAt: timestamp("acceptedAt"),
  shopDomain: varchar("shopDomain", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  trainerId: int("trainerId").notNull(),
  bundleDraftId: int("bundleDraftId"),
  bundlePublicationId: int("bundlePublicationId"),
  shopifySubscriptionId: varchar("shopifySubscriptionId", { length: 64 }),
  status: mysqlEnum("status", ["active", "paused", "cancelled", "expired"]).default("active"),
  subscriptionType: mysqlEnum("subscriptionType", ["weekly", "monthly", "yearly"]).default(
    "monthly"
  ),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  startDate: timestamp("startDate").notNull(),
  renewalDate: timestamp("renewalDate"),
  pausedAt: timestamp("pausedAt"),
  cancelledAt: timestamp("cancelledAt"),
  sessionsIncluded: int("sessionsIncluded").default(0),
  sessionsUsed: int("sessionsUsed").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

// ============================================================================
// SESSIONS (Training sessions)
// ============================================================================

export const sessions = mysqlTable("sessions", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  trainerId: int("trainerId").notNull(),
  subscriptionId: int("subscriptionId"),
  sessionDate: timestamp("sessionDate").notNull(),
  durationMinutes: int("durationMinutes").default(60),
  sessionType: mysqlEnum("sessionType", ["training", "check_in", "call", "plan_review"]).default(
    "training"
  ),
  location: varchar("location", { length: 255 }),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled", "no_show"]).default(
    "scheduled"
  ),
  notes: text("notes"),
  googleEventId: varchar("googleEventId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

// ============================================================================
// ORDERS (Synced from Shopify)
// ============================================================================

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  shopifyOrderId: bigint("shopifyOrderId", { mode: "number" }),
  shopifyOrderNumber: varchar("shopifyOrderNumber", { length: 64 }),
  clientId: int("clientId"),
  trainerId: int("trainerId"), // Attribution
  bundlePublicationId: int("bundlePublicationId"),
  subscriptionId: int("subscriptionId"),
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
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "refunded", "partially_refunded"]).default(
    "pending"
  ),
  fulfillmentMethod: mysqlEnum("fulfillmentMethod", [
    "home_ship",
    "trainer_delivery",
    "vending",
    "cafeteria",
  ]).default("home_ship"),
  deliveryDate: timestamp("deliveryDate"),
  deliveredAt: timestamp("deliveredAt"),
  proofOfDelivery: text("proofOfDelivery"),
  trackingNumber: varchar("trackingNumber", { length: 255 }),
  trackingUrl: text("trackingUrl"),
  carrier: varchar("carrier", { length: 100 }),
  estimatedDelivery: timestamp("estimatedDelivery"),
  shopDomain: varchar("shopDomain", { length: 255 }),
  orderData: json("orderData"), // Full Shopify order data
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
  shopifyLineItemId: bigint("shopifyLineItemId", { mode: "number" }),
  name: varchar("name", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  fulfillmentStatus: mysqlEnum("fulfillmentStatus", ["unfulfilled", "fulfilled", "restocked"]).default(
    "unfulfilled"
  ),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

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
// CALENDAR EVENTS (Synced from Google Calendar)
// ============================================================================

export const calendarEvents = mysqlTable("calendar_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  googleEventId: varchar("googleEventId", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime").notNull(),
  eventType: mysqlEnum("eventType", ["session", "delivery", "appointment", "other"]).default(
    "other"
  ),
  relatedClientId: int("relatedClientId"),
  relatedOrderId: int("relatedOrderId"),
  reminderSent: boolean("reminderSent").default(false),
  syncedAt: timestamp("syncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

// ============================================================================
// PREDICTIVE PROMPTS (Context-aware suggestions)
// ============================================================================

export const predictivePrompts = mysqlTable("predictive_prompts", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("clientId").notNull(),
  trainerId: int("trainerId"),
  triggerType: mysqlEnum("triggerType", [
    "pre_workout",
    "post_workout",
    "recovery",
    "location",
    "schedule",
    "reorder",
  ]).notNull(),
  triggerEventId: int("triggerEventId"),
  productId: int("productId"),
  bundlePublicationId: int("bundlePublicationId"),
  promptMessage: text("promptMessage").notNull(),
  suggestedProducts: json("suggestedProducts"),
  status: mysqlEnum("status", ["pending", "shown", "accepted", "dismissed", "expired"]).default(
    "pending"
  ),
  scheduledFor: timestamp("scheduledFor"),
  shownAt: timestamp("shownAt"),
  respondedAt: timestamp("respondedAt"),
  resultingOrderId: int("resultingOrderId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PredictivePrompt = typeof predictivePrompts.$inferSelect;
export type InsertPredictivePrompt = typeof predictivePrompts.$inferInsert;

// ============================================================================
// TRAINER APPROVALS (Manager workflow)
// ============================================================================

export const trainerApprovals = mysqlTable("trainer_approvals", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  managerId: int("managerId"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "suspended"]).default("pending"),
  applicationData: json("applicationData"),
  reviewNotes: text("reviewNotes"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainerApproval = typeof trainerApprovals.$inferSelect;
export type InsertTrainerApproval = typeof trainerApprovals.$inferInsert;

// ============================================================================
// BUNDLE REVIEWS (Manager/Coordinator review queue)
// ============================================================================

export const bundleReviews = mysqlTable("bundle_reviews", {
  id: int("id").autoincrement().primaryKey(),
  bundleDraftId: int("bundleDraftId").notNull(),
  reviewerId: int("reviewerId"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "changes_requested"]).default(
    "pending"
  ),
  reviewNotes: text("reviewNotes"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BundleReview = typeof bundleReviews.$inferSelect;
export type InsertBundleReview = typeof bundleReviews.$inferInsert;

// ============================================================================
// ACTIVITY LOG (Audit trail)
// ============================================================================

export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }),
  entityId: bigint("entityId", { mode: "number" }),
  details: json("details"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ============================================================================
// RECOMMENDATIONS (ML-powered suggestions)
// ============================================================================

export const recommendations = mysqlTable("recommendations", {
  id: int("id").autoincrement().primaryKey(),
  targetType: mysqlEnum("targetType", ["client", "trainer", "bundle"]).notNull(),
  targetId: int("targetId").notNull(),
  recommendationType: mysqlEnum("recommendationType", [
    "product",
    "bundle_composition",
    "pricing",
    "client_match",
  ]).notNull(),
  recommendedItems: json("recommendedItems").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  reasoning: text("reasoning"),
  status: mysqlEnum("status", ["active", "applied", "dismissed", "expired"]).default("active"),
  appliedAt: timestamp("appliedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = typeof recommendations.$inferInsert;

// ============================================================================
// GOOGLE CALENDAR CONNECTIONS
// ============================================================================

export const calendarConnections = mysqlTable("calendar_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  googleEmail: varchar("googleEmail", { length: 320 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  calendarId: varchar("calendarId", { length: 255 }),
  syncEnabled: boolean("syncEnabled").default(true),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CalendarConnection = typeof calendarConnections.$inferSelect;
export type InsertCalendarConnection = typeof calendarConnections.$inferInsert;

// ============================================================================
// INVITATIONS (Trainer invites customers)
// ============================================================================

// Join requests (customer-initiated trainer requests)
export const joinRequests = mysqlTable("join_requests", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  userId: int("userId").notNull(), // The customer requesting to join
  message: text("message"), // Optional message from customer
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending"),
  reviewedAt: timestamp("reviewedAt"),
  reviewNotes: text("reviewNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JoinRequest = typeof joinRequests.$inferSelect;
export type InsertJoinRequest = typeof joinRequests.$inferInsert;

// Invitations (trainer-initiated customer invites)
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "expired", "revoked"]).default("pending"),
  message: text("message"), // Personal message from trainer
  acceptedAt: timestamp("acceptedAt"),
  acceptedByUserId: int("acceptedByUserId"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;


// ============================================================================
// IMPERSONATION LOGS (Audit trail for admin testing)
// ============================================================================

export const impersonationLogs = mysqlTable("impersonation_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(), // The coordinator doing the impersonation
  targetUserId: int("targetUserId"), // The user being impersonated (null for role simulation)
  targetRole: mysqlEnum("targetRole", ["shopper", "client", "trainer", "manager", "coordinator"]), // For role simulation mode
  action: mysqlEnum("action", ["start", "stop", "switch"]).notNull(),
  mode: mysqlEnum("mode", ["user", "role"]).default("user").notNull(), // user = impersonate specific user, role = simulate role
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  notes: text("notes"), // Optional notes about why impersonating
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImpersonationLog = typeof impersonationLogs.$inferSelect;
export type InsertImpersonationLog = typeof impersonationLogs.$inferInsert;

// ============================================================================
// IMPERSONATION SHORTCUTS (Quick-switch favorites)
// ============================================================================

export const impersonationShortcuts = mysqlTable("impersonation_shortcuts", {
  id: int("id").autoincrement().primaryKey(),
  adminUserId: int("adminUserId").notNull(), // The coordinator who saved this shortcut
  targetUserId: int("targetUserId").notNull(), // The user to quick-switch to
  label: varchar("label", { length: 100 }), // Optional custom label
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ImpersonationShortcut = typeof impersonationShortcuts.$inferSelect;
export type InsertImpersonationShortcut = typeof impersonationShortcuts.$inferInsert;

// ============================================================================
// TAG COLORS (Persistent colors for goal types, service types, etc.)
// ============================================================================

export const tagColors = mysqlTable("tag_colors", {
  id: int("id").autoincrement().primaryKey(),
  tag: varchar("tag", { length: 100 }).notNull(), // The tag value (e.g., "weight_loss", "training")
  color: varchar("color", { length: 7 }).notNull(), // Hex color (e.g., "#3b82f6")
  category: mysqlEnum("category", ["goal", "service"]).notNull(), // Which field this tag belongs to
  label: varchar("label", { length: 100 }), // Human-readable label (e.g., "Weight Loss")
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TagColor = typeof tagColors.$inferSelect;
export type InsertTagColor = typeof tagColors.$inferInsert;

// ============================================================================
// PRODUCT SPF (Special Product Fee for trainer commissions)
// ============================================================================

export const productSPF = mysqlTable("product_spf", {
  id: int("id").autoincrement().primaryKey(),
  shopifyProductId: bigint("shopifyProductId", { mode: "number" }).notNull(),
  spfPercentage: decimal("spfPercentage", { precision: 5, scale: 4 }).notNull().default("0"), // e.g., 0.20 for 20%
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductSPF = typeof productSPF.$inferSelect;
export type InsertProductSPF = typeof productSPF.$inferInsert;

// ============================================================================
// PLATFORM SETTINGS (Global configuration like base commission rate)
// ============================================================================

export const platformSettings = mysqlTable("platform_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = typeof platformSettings.$inferInsert;


// ============================================================================
// SERVICE DELIVERIES (Track trainer service fulfillment for clients)
// ============================================================================

export const serviceDeliveries = mysqlTable("service_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(), // References orders.id
  trainerId: int("trainerId").notNull(), // The trainer who needs to deliver
  clientId: int("clientId").notNull(), // The client receiving the service
  bundleId: int("bundleId"), // References bundle_drafts.id (optional, for context)
  bundleTitle: varchar("bundleTitle", { length: 255 }), // Cached bundle title
  serviceType: varchar("serviceType", { length: 100 }).notNull(), // e.g., "training", "check_in"
  serviceName: varchar("serviceName", { length: 255 }).notNull(), // e.g., "Personal Training Session"
  totalQuantity: int("totalQuantity").notNull(), // Total sessions to deliver
  deliveredQuantity: int("deliveredQuantity").default(0).notNull(), // Sessions completed
  pricePerUnit: decimal("pricePerUnit", { precision: 10, scale: 2 }).notNull(), // Price per session
  status: mysqlEnum("status", ["pending", "in_progress", "completed"]).default("pending"),
  notes: text("notes"), // Trainer notes about delivery
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ServiceDelivery = typeof serviceDeliveries.$inferSelect;
export type InsertServiceDelivery = typeof serviceDeliveries.$inferInsert;

// ============================================================================
// TRAINER EARNINGS (Aggregated earnings records for dashboard)
// ============================================================================

export const trainerEarnings = mysqlTable("trainer_earnings", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  orderId: int("orderId").notNull(), // References orders.id
  bundleId: int("bundleId"), // References bundle_drafts.id
  bundleTitle: varchar("bundleTitle", { length: 255 }),
  clientId: int("clientId"),
  clientName: varchar("clientName", { length: 255 }),
  productCommission: decimal("productCommission", { precision: 10, scale: 2 }).default("0").notNull(), // Commission from products
  serviceRevenue: decimal("serviceRevenue", { precision: 10, scale: 2 }).default("0").notNull(), // Revenue from services (100%)
  totalEarnings: decimal("totalEarnings", { precision: 10, scale: 2 }).default("0").notNull(), // productCommission + serviceRevenue
  orderTotal: decimal("orderTotal", { precision: 10, scale: 2 }), // Total order amount for reference
  status: mysqlEnum("status", ["pending", "confirmed", "paid"]).default("pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TrainerEarning = typeof trainerEarnings.$inferSelect;
export type InsertTrainerEarning = typeof trainerEarnings.$inferInsert;


// ============================================================================
// LOCAL BUSINESSES (Advertisers on the platform)
// ============================================================================

export const localBusinesses = mysqlTable("local_businesses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  website: varchar("website", { length: 500 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  category: mysqlEnum("category", [
    "sports_nutrition",
    "fitness_equipment",
    "physiotherapy",
    "healthy_food",
    "sports_retail",
    "wellness_recovery",
    "gym_studio",
    "health_insurance",
    "sports_events",
    "other"
  ]).default("other"),
  logoUrl: text("logoUrl"),
  description: text("description"),
  contactName: varchar("contactName", { length: 255 }),
  status: mysqlEnum("status", ["pending", "active", "suspended", "inactive"]).default("pending"),
  referredByTrainerId: int("referredByTrainerId"), // Trainer who brought this business
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LocalBusiness = typeof localBusinesses.$inferSelect;
export type InsertLocalBusiness = typeof localBusinesses.$inferInsert;

// ============================================================================
// AD PARTNERSHIPS (Trainer-Business advertising agreements)
// ============================================================================

export const adPartnerships = mysqlTable("ad_partnerships", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(), // Trainer who sold the partnership
  businessId: int("businessId").notNull(), // References local_businesses.id
  packageTier: mysqlEnum("packageTier", ["bronze", "silver", "gold", "platinum"]).notNull(),
  monthlyFee: decimal("monthlyFee", { precision: 10, scale: 2 }).notNull(), // £99, £249, £499, £999
  trainerCommissionRate: decimal("trainerCommissionRate", { precision: 5, scale: 4 }).notNull(), // 0.15, 0.18, 0.20, 0.25
  bonusPointsAwarded: int("bonusPointsAwarded").default(0), // 500, 1000, 2000, 5000
  status: mysqlEnum("status", ["pending", "active", "paused", "cancelled", "expired"]).default("pending"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  renewalDate: timestamp("renewalDate"),
  autoRenew: boolean("autoRenew").default(true),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdPartnership = typeof adPartnerships.$inferSelect;
export type InsertAdPartnership = typeof adPartnerships.$inferInsert;

// ============================================================================
// AD PLACEMENTS (Where ads are displayed)
// ============================================================================

export const adPlacements = mysqlTable("ad_placements", {
  id: int("id").autoincrement().primaryKey(),
  partnershipId: int("partnershipId").notNull(), // References ad_partnerships.id
  businessId: int("businessId").notNull(), // References local_businesses.id
  placementType: mysqlEnum("placementType", [
    "bundle_sidebar",
    "vending_screen",
    "trainer_profile",
    "email_newsletter",
    "receipt_confirmation"
  ]).notNull(),
  locationId: int("locationId"), // For location-specific placements (vending machines)
  trainerId: int("trainerId"), // For trainer-specific placements
  bundleId: int("bundleId"), // For bundle-specific placements
  headline: varchar("headline", { length: 100 }),
  description: text("description"),
  imageUrl: text("imageUrl"),
  linkUrl: text("linkUrl"),
  ctaText: varchar("ctaText", { length: 50 }).default("Learn More"),
  impressions: int("impressions").default(0),
  clicks: int("clicks").default(0),
  isActive: boolean("isActive").default(true),
  priority: int("priority").default(0), // Higher = shown first
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdPlacement = typeof adPlacements.$inferSelect;
export type InsertAdPlacement = typeof adPlacements.$inferInsert;

// ============================================================================
// AD EARNINGS (Trainer earnings from ad partnerships)
// ============================================================================

export const adEarnings = mysqlTable("ad_earnings", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  partnershipId: int("partnershipId").notNull(),
  businessId: int("businessId").notNull(),
  businessName: varchar("businessName", { length: 255 }),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  monthlyFee: decimal("monthlyFee", { precision: 10, scale: 2 }).notNull(),
  commissionRate: decimal("commissionRate", { precision: 5, scale: 4 }).notNull(),
  commissionEarned: decimal("commissionEarned", { precision: 10, scale: 2 }).notNull(),
  bonusPoints: int("bonusPoints").default(0),
  status: mysqlEnum("status", ["pending", "confirmed", "paid"]).default("pending"),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdEarning = typeof adEarnings.$inferSelect;
export type InsertAdEarning = typeof adEarnings.$inferInsert;


// ============================================================================
// ORDER LINE ITEMS (Itemized breakdown for client receipts)
// ============================================================================

export const orderLineItems = mysqlTable("order_line_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(), // References orders.id
  category: mysqlEnum("category", ["product", "service", "facility"]).notNull(),
  itemName: varchar("itemName", { length: 255 }).notNull(),
  itemDescription: text("itemDescription"),
  shopifyProductId: varchar("shopifyProductId", { length: 100 }), // For products
  shopifyVariantId: varchar("shopifyVariantId", { length: 100 }),
  quantity: int("quantity").default(1).notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  vatRate: decimal("vatRate", { precision: 5, scale: 2 }).default("0"), // UK VAT rate (0%, 5%, 20%)
  vatAmount: decimal("vatAmount", { precision: 10, scale: 2 }).default("0"),
  trainerId: int("trainerId"), // Trainer who provided the service (for services)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderLineItem = typeof orderLineItems.$inferSelect;
export type InsertOrderLineItem = typeof orderLineItems.$inferInsert;

// ============================================================================
// TRAINER POINTS (Loyalty program points balance)
// ============================================================================

export const trainerPoints = mysqlTable("trainer_points", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull().unique(), // One record per trainer
  totalPoints: int("totalPoints").default(0).notNull(), // Current point balance
  lifetimePoints: int("lifetimePoints").default(0).notNull(), // Total points ever earned (for tier calculation)
  currentTier: mysqlEnum("currentTier", ["bronze", "silver", "gold", "platinum"]).default("bronze"),
  tierCalculatedAt: timestamp("tierCalculatedAt"), // When tier was last calculated
  yearToDatePoints: int("yearToDatePoints").default(0), // Points earned this calendar year
  yearToDateRevenue: decimal("yearToDateRevenue", { precision: 12, scale: 2 }).default("0"), // Revenue this year
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TrainerPoint = typeof trainerPoints.$inferSelect;
export type InsertTrainerPoint = typeof trainerPoints.$inferInsert;

// ============================================================================
// POINT TRANSACTIONS (Audit trail for all point changes)
// ============================================================================

export const pointTransactions = mysqlTable("point_transactions", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  transactionType: mysqlEnum("transactionType", [
    "bundle_sale",           // £1 = 1 point from sales
    "new_client_bonus",      // 100 points for first bundle to new client
    "client_retention",      // 50 points for repeat purchases
    "ad_partnership_sale",   // 500-5000 points for ad sales
    "ad_partnership_renewal",// 250 points for renewals
    "upsell_bonus",          // Points for vending machine upsells
    "monthly_target",        // Bonus for hitting targets
    "tier_bonus",            // Annual tier achievement bonus
    "referral_bonus",        // Points for referring trainers
    "redemption",            // Points spent on rewards
    "adjustment",            // Manual adjustment by admin
    "expiration"             // Points expired
  ]).notNull(),
  points: int("points").notNull(), // Positive for earned, negative for spent/expired
  referenceType: varchar("referenceType", { length: 50 }), // 'order', 'ad_partnership', 'client', etc.
  referenceId: int("referenceId"), // ID of the related record
  description: text("description"),
  balanceBefore: int("balanceBefore"),
  balanceAfter: int("balanceAfter"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PointTransaction = typeof pointTransactions.$inferSelect;
export type InsertPointTransaction = typeof pointTransactions.$inferInsert;

// ============================================================================
// TRAINER AWARDS (Achievements and milestones)
// ============================================================================

export const trainerAwards = mysqlTable("trainer_awards", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(),
  awardType: mysqlEnum("awardType", [
    "tier_achieved",         // Reached a new tier
    "monthly_top_seller",    // Top seller of the month
    "client_milestone",      // 10, 25, 50, 100 clients
    "revenue_milestone",     // Revenue milestones
    "perfect_delivery",      // 100% service delivery rate
    "five_star_reviews",     // Consistently high ratings
    "ad_champion",           // Most ad partnerships sold
    "retention_master"       // High client retention rate
  ]).notNull(),
  awardName: varchar("awardName", { length: 255 }).notNull(),
  description: text("description"),
  badgeIcon: varchar("badgeIcon", { length: 100 }), // Icon name or URL
  pointsAwarded: int("pointsAwarded").default(0),
  metadata: json("metadata"), // Additional award-specific data
  earnedAt: timestamp("earnedAt").defaultNow().notNull(),
});

export type TrainerAward = typeof trainerAwards.$inferSelect;
export type InsertTrainerAward = typeof trainerAwards.$inferInsert;


// ============================================================================
// PRODUCT DELIVERIES (Trainer-to-client product handoffs)
// ============================================================================

export const productDeliveries = mysqlTable("product_deliveries", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(), // References orders.id
  orderItemId: int("orderItemId").notNull(), // References order_items.id
  trainerId: int("trainerId").notNull(), // Trainer responsible for delivery
  clientId: int("clientId").notNull(), // Client receiving the product
  productName: varchar("productName", { length: 255 }).notNull(),
  quantity: int("quantity").notNull().default(1),
  status: mysqlEnum("status", [
    "pending",      // Awaiting trainer pickup/preparation
    "ready",        // Ready for delivery to client
    "delivered",    // Trainer marked as delivered
    "confirmed",    // Client confirmed receipt
    "disputed"      // Client reported issue
  ]).default("pending").notNull(),
  scheduledDate: timestamp("scheduledDate"), // When delivery is planned
  deliveredAt: timestamp("deliveredAt"), // When trainer marked delivered
  confirmedAt: timestamp("confirmedAt"), // When client confirmed receipt
  trainerNotes: text("trainerNotes"), // Notes from trainer about delivery
  clientNotes: text("clientNotes"), // Notes from client (feedback/issues)
  deliveryMethod: mysqlEnum("deliveryMethod", [
    "in_person",    // Handed directly to client
    "locker",       // Left in gym locker
    "front_desk",   // Left at front desk
    "shipped"       // Shipped to client address
  ]).default("in_person"),
  trackingNumber: varchar("trackingNumber", { length: 100 }), // For shipped items
  // Reschedule request fields
  rescheduleRequestedAt: timestamp("rescheduleRequestedAt"), // When client requested reschedule
  rescheduleRequestedDate: timestamp("rescheduleRequestedDate"), // Proposed new date
  rescheduleReason: text("rescheduleReason"), // Client's reason for reschedule
  rescheduleStatus: mysqlEnum("rescheduleStatus", [
    "none",      // No reschedule requested
    "pending",   // Awaiting trainer response
    "approved",  // Trainer approved new date
    "rejected"   // Trainer rejected request
  ]).default("none"),
  rescheduleResponseAt: timestamp("rescheduleResponseAt"), // When trainer responded
  rescheduleResponseNote: text("rescheduleResponseNote"), // Trainer's response note
  // Manager resolution fields (for disputed deliveries)
  resolvedAt: timestamp("resolvedAt"), // When manager resolved the dispute
  resolvedBy: int("resolvedBy"), // Manager user ID who resolved
  resolutionType: mysqlEnum("resolutionType", [
    "refund",       // Full refund issued
    "redeliver",    // Product will be redelivered
    "partial_refund", // Partial refund issued
    "closed"        // Closed without action (resolved between parties)
  ]),
  resolutionNotes: text("resolutionNotes"), // Manager's notes on resolution
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductDelivery = typeof productDeliveries.$inferSelect;
export type InsertProductDelivery = typeof productDeliveries.$inferInsert;


// ============================================================================
// BUNDLE INVITATIONS (Trainer suggests bundles to clients via email)
// ============================================================================

export const bundleInvitations = mysqlTable("bundle_invitations", {
  id: int("id").autoincrement().primaryKey(),
  trainerId: int("trainerId").notNull(), // Trainer sending the invitation
  bundleId: int("bundleId").notNull(), // References bundle_drafts.id (must be published)
  email: varchar("email", { length: 320 }).notNull(), // Recipient email
  recipientName: varchar("recipientName", { length: 255 }), // Optional recipient name
  token: varchar("token", { length: 64 }).notNull().unique(), // Unique invitation token
  personalMessage: text("personalMessage"), // Personal message from trainer
  status: mysqlEnum("status", [
    "pending",    // Invitation sent, awaiting action
    "viewed",     // Recipient clicked the link
    "accepted",   // Recipient accepted and paid
    "declined",   // Recipient explicitly declined
    "expired",    // Invitation expired without action
    "revoked"     // Trainer revoked the invitation
  ]).default("pending"),
  acceptedByUserId: int("acceptedByUserId"), // User who accepted (new or existing)
  orderId: int("orderId"), // Order created upon acceptance
  viewedAt: timestamp("viewedAt"), // When link was first clicked
  acceptedAt: timestamp("acceptedAt"), // When invitation was accepted
  declinedAt: timestamp("declinedAt"), // When invitation was declined
  expiresAt: timestamp("expiresAt").notNull(), // Invitation expiry date
  emailSentAt: timestamp("emailSentAt"), // When email was sent
  reminderSentAt: timestamp("reminderSentAt"), // When reminder was sent
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BundleInvitation = typeof bundleInvitations.$inferSelect;
export type InsertBundleInvitation = typeof bundleInvitations.$inferInsert;


// ============================================================================
// ANALYTICS REPORTS (Downloadable reports for managers)
// ============================================================================

export const analyticsReports = mysqlTable("analytics_reports", {
  id: int("id").autoincrement().primaryKey(),
  generatedBy: int("generatedBy").notNull(), // Manager who generated the report
  reportType: mysqlEnum("reportType", ["revenue", "trainers", "bundles", "orders", "full"]).default("full"),
  dateRangeStart: timestamp("dateRangeStart"), // Start of the report period
  dateRangeEnd: timestamp("dateRangeEnd"), // End of the report period
  dateRangeLabel: varchar("dateRangeLabel", { length: 50 }), // e.g., "7d", "30d", "90d", "1y", "all"
  fileName: varchar("fileName", { length: 255 }).notNull(), // Generated file name
  fileUrl: text("fileUrl").notNull(), // S3 URL to the CSV file
  fileSize: int("fileSize"), // File size in bytes
  totalRevenue: decimal("totalRevenue", { precision: 12, scale: 2 }), // Snapshot of total revenue
  orderCount: int("orderCount"), // Snapshot of order count
  trainerCount: int("trainerCount"), // Number of trainers in report
  bundleCount: int("bundleCount"), // Number of bundles in report
  metadata: json("metadata"), // Additional report metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsReport = typeof analyticsReports.$inferSelect;
export type InsertAnalyticsReport = typeof analyticsReports.$inferInsert;


// ============================================================================
// SHOPIFY SYNC RESULTS (Persistent sync history with details)
// ============================================================================

export const shopifySyncResults = mysqlTable("shopify_sync_results", {
  id: int("id").autoincrement().primaryKey(),
  triggeredBy: int("triggeredBy").notNull(), // Manager who triggered the sync
  status: mysqlEnum("status", ["success", "partial", "failed"]).default("success"),
  productsSynced: int("productsSynced").default(0),
  productsErrors: int("productsErrors").default(0),
  bundlesSynced: int("bundlesSynced").default(0),
  bundlesErrors: int("bundlesErrors").default(0),
  customersSynced: int("customersSynced").default(0),
  customersErrors: int("customersErrors").default(0),
  syncedItems: json("syncedItems"), // Array of { type, id, name } for all synced items
  errorItems: json("errorItems"), // Array of { type, id, name, error } for all errors
  durationMs: int("durationMs"), // How long the sync took
  csvFileUrl: text("csvFileUrl"), // S3 URL to CSV export of results
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShopifySyncResult = typeof shopifySyncResults.$inferSelect;
export type InsertShopifySyncResult = typeof shopifySyncResults.$inferInsert;
