import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock database functions - comprehensive list matching actual db.ts exports
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  updateUserRole: vi.fn(),
  // Products
  getProducts: vi.fn().mockResolvedValue([]),
  getProductById: vi.fn(),
  // Bundles
  getBundles: vi.fn().mockResolvedValue([]),
  getBundleDrafts: vi.fn().mockResolvedValue([]),
  getBundleDraftsByTrainer: vi.fn().mockResolvedValue([]),
  getBundleDraftById: vi.fn(),
  createBundleDraft: vi.fn().mockResolvedValue(1),
  updateBundleDraft: vi.fn(),
  // Bundle Templates
  getBundleTemplates: vi.fn().mockResolvedValue([]),
  getBundleTemplateById: vi.fn(),
  createBundleTemplate: vi.fn().mockResolvedValue(1),
  updateBundleTemplate: vi.fn(),
  deleteBundleTemplate: vi.fn(),
  // Clients
  getClients: vi.fn().mockResolvedValue([]),
  getClientsByTrainer: vi.fn().mockResolvedValue([]),
  getClientById: vi.fn(),
  createClient: vi.fn().mockResolvedValue(1),
  updateClient: vi.fn(),
  // Orders
  getOrders: vi.fn().mockResolvedValue([]),
  getRecentOrders: vi.fn().mockResolvedValue([]),
  getOrderById: vi.fn(),
  getOrderItems: vi.fn().mockResolvedValue([]),
  createOrder: vi.fn().mockResolvedValue(1),
  // Subscriptions
  getSubscriptions: vi.fn().mockResolvedValue([]),
  getSubscriptionsByClient: vi.fn().mockResolvedValue([]),
  getSubscriptionsByTrainer: vi.fn().mockResolvedValue([]),
  getSubscriptionById: vi.fn(),
  createSubscription: vi.fn().mockResolvedValue(1),
  updateSubscription: vi.fn(),
  // Sessions
  getSessions: vi.fn().mockResolvedValue([]),
  getUpcomingSessions: vi.fn().mockResolvedValue([]),
  createSession: vi.fn().mockResolvedValue(1),
  // Calendar
  getCalendarEvents: vi.fn().mockResolvedValue([]),
  createCalendarEvent: vi.fn().mockResolvedValue(1),
  // Trainers
  getTrainers: vi.fn().mockResolvedValue([]),
  getPendingTrainers: vi.fn().mockResolvedValue([]),
  approveTrainer: vi.fn(),
  rejectTrainer: vi.fn(),
  // Activity
  getActivityLogs: vi.fn().mockResolvedValue([]),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  logActivity: vi.fn(),
  // Stats
  getTrainerStats: vi.fn().mockResolvedValue({
    totalRevenue: 0,
    activeClients: 0,
    publishedBundles: 0,
    activeSubscriptions: 0,
  }),
  getManagerStats: vi.fn().mockResolvedValue({
    totalTrainers: 0,
    activeTrainers: 0,
    pendingApprovals: 0,
    totalBundles: 0,
    publishedBundles: 0,
    totalRevenue: 0,
  }),
  // Messages
  getMessages: vi.fn().mockResolvedValue([]),
  getMessagesByConversation: vi.fn().mockResolvedValue([]),
  createMessage: vi.fn().mockResolvedValue(1),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(role: AuthenticatedUser["role"] = "shopper"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    phone: null,
    photoUrl: null,
    bio: null,
    location: null,
    timezone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    isImpersonating: false,
    realAdminUser: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    isImpersonating: false,
    realAdminUser: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Auth Router", () => {
  it("returns user for authenticated request", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.email).toBe("test@example.com");
    expect(result?.role).toBe("trainer");
  });

  it("returns null user with impersonation fields for unauthenticated request", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    // auth.me returns null when user is not authenticated
    expect(result).toBeNull();
  });

  it("clears cookie on logout", async () => {
    const ctx = createMockContext("shopper");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalled();
  });
});

describe("Products Router", () => {
  it("lists products without authentication", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.list({ limit: 10 });

    expect(Array.isArray(result)).toBe(true);
  });

  it("lists products with category filter", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.products.list({ category: "protein", limit: 10 });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Bundles Router", () => {
  it("lists trainer bundle drafts", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    // bundles.list returns trainer's bundle drafts
    const result = await caller.bundles.list();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Stats Router", () => {
  it("returns trainer stats for authenticated trainer", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    // stats.trainer uses ctx.user.id internally
    const result = await caller.stats.trainer();

    expect(result).toBeDefined();
    expect(typeof result.totalRevenue).toBe("number");
    expect(typeof result.activeClients).toBe("number");
    expect(typeof result.publishedBundles).toBe("number");
  });

  it("returns manager stats for authenticated manager", async () => {
    const ctx = createMockContext("manager");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.stats.manager();

    expect(result).toBeDefined();
    expect(typeof result.totalTrainers).toBe("number");
    expect(typeof result.activeTrainers).toBe("number");
    expect(typeof result.pendingApprovals).toBe("number");
  });
});

describe("Clients Router", () => {
  it("lists clients for authenticated trainer", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    // clients.list doesn't take input, it uses ctx.user.id
    const result = await caller.clients.list();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Sessions Router", () => {
  it("lists upcoming sessions for authenticated trainer", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sessions.upcoming({ trainerId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Orders Router", () => {
  it("lists recent orders for authenticated user", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.orders.recent({ trainerId: 1, limit: 5 });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Subscriptions Router", () => {
  it("lists subscriptions for a client", async () => {
    const ctx = createMockContext("client");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.subscriptions.listByClient({ clientId: 1 });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Calendar Router", () => {
  it("lists calendar events for date range", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.calendar.events({
      trainerId: 1,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Templates Router", () => {
  it("lists templates without authentication", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    // templates.list calls db.getBundleTemplates
    const result = await caller.templates.list();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Trainers Router", () => {
  it("lists all trainers for manager", async () => {
    const ctx = createMockContext("manager");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.trainers.list({});

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Activity Router", () => {
  it("lists recent activity for manager", async () => {
    const ctx = createMockContext("manager");
    const caller = appRouter.createCaller(ctx);

    // activity.recent calls db.getActivityLogs
    const result = await caller.activity.recent({ limit: 5 });

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Messages Router", () => {
  it("lists messages for authenticated user", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.messages.list({ conversationId: "conv-1" });

    expect(Array.isArray(result)).toBe(true);
  });
});
