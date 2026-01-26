import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getUserById: vi.fn(),
  getAllUsers: vi.fn(),
  createImpersonationLog: vi.fn(),
  getImpersonationLogs: vi.fn(),
  getImpersonationLogCount: vi.fn(),
  getImpersonationShortcuts: vi.fn(),
  createImpersonationShortcut: vi.fn(),
  deleteImpersonationShortcut: vi.fn(),
}));

// Mock the SDK
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
    verifySessionToken: vi.fn(),
  },
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCoordinatorContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "coordinator-123",
    email: "coordinator@example.com",
    name: "Test Coordinator",
    loginMethod: "manus",
    role: "coordinator",
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
      ip: "127.0.0.1",
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createNonCoordinatorContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "trainer-123",
    email: "trainer@example.com",
    name: "Test Trainer",
    loginMethod: "manus",
    role: "trainer",
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

function createImpersonatingContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 3,
    openId: "shopper-123",
    email: "shopper@example.com",
    name: "Test Shopper",
    loginMethod: "manus",
    role: "shopper",
    phone: null,
    photoUrl: null,
    bio: null,
    location: null,
    timezone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const realAdmin: AuthenticatedUser = {
    id: 1,
    openId: "coordinator-123",
    email: "coordinator@example.com",
    name: "Test Coordinator",
    loginMethod: "manus",
    role: "coordinator",
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
    isImpersonating: true,
    realAdminUser: realAdmin,
    req: {
      protocol: "https",
      headers: {
        cookie: "impersonate_admin=mock-admin-session",
      },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Impersonation System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("impersonate.status", () => {
    it("returns not impersonating for coordinator", async () => {
      const ctx = createCoordinatorContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.impersonate.status();

      expect(result.isImpersonating).toBe(false);
      expect(result.impersonatedUser).toBeNull();
      expect(result.realAdminUser).toBeNull();
    });

    it("returns impersonating status when active", async () => {
      const ctx = createImpersonatingContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.impersonate.status();

      expect(result.isImpersonating).toBe(true);
      expect(result.impersonatedUser).toEqual({
        id: 3,
        name: "Test Shopper",
        email: "shopper@example.com",
        role: "shopper",
      });
      expect(result.realAdminUser).toEqual({
        id: 1,
        name: "Test Coordinator",
        email: "coordinator@example.com",
      });
    });
  });

  describe("impersonate.listUsers", () => {
    it("requires coordinator role", async () => {
      const ctx = createNonCoordinatorContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.impersonate.listUsers({})).rejects.toThrow();
    });

    it("returns user list for coordinator", async () => {
      const ctx = createCoordinatorContext();
      const caller = appRouter.createCaller(ctx);
      
      const db = await import("./db");
      (db.getAllUsers as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, name: "User 1", email: "user1@test.com", role: "shopper", createdAt: new Date() },
        { id: 2, name: "User 2", email: "user2@test.com", role: "trainer", createdAt: new Date() },
      ]);

      const result = await caller.impersonate.listUsers({});

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe("impersonate.logs", () => {
    it("requires coordinator role", async () => {
      const ctx = createNonCoordinatorContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.impersonate.logs({})).rejects.toThrow();
    });

    it("returns audit logs for coordinator", async () => {
      const ctx = createCoordinatorContext();
      const caller = appRouter.createCaller(ctx);
      
      const db = await import("./db");
      (db.getImpersonationLogs as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, adminUserId: 1, targetUserId: 2, action: "start", mode: "user", createdAt: new Date() },
      ]);
      (db.getImpersonationLogCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await caller.impersonate.logs({});

      expect(result.logs).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("impersonate.shortcuts", () => {
    it("requires coordinator role", async () => {
      const ctx = createNonCoordinatorContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.impersonate.shortcuts()).rejects.toThrow();
    });

    it("returns shortcuts for coordinator", async () => {
      const ctx = createCoordinatorContext();
      const caller = appRouter.createCaller(ctx);
      
      const db = await import("./db");
      (db.getImpersonationShortcuts as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, adminUserId: 1, targetUserId: 2, label: "Test User", targetUser: { name: "Test" } },
      ]);

      const result = await caller.impersonate.shortcuts();

      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("Test User");
    });
  });

  describe("impersonate.addShortcut", () => {
    it("adds a shortcut for coordinator", async () => {
      const ctx = createCoordinatorContext();
      const caller = appRouter.createCaller(ctx);
      
      const db = await import("./db");
      (db.createImpersonationShortcut as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      const result = await caller.impersonate.addShortcut({ userId: 2 });

      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
    });
  });

  describe("impersonate.removeShortcut", () => {
    it("removes a shortcut for coordinator", async () => {
      const ctx = createCoordinatorContext();
      const caller = appRouter.createCaller(ctx);
      
      const db = await import("./db");
      (db.deleteImpersonationShortcut as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await caller.impersonate.removeShortcut({ id: 1 });

      expect(result.success).toBe(true);
    });
  });
});
