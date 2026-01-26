import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// Mock the db module
vi.mock("./db", () => ({
  authenticateWithPassword: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  isSessionRevoked: vi.fn().mockResolvedValue(false),
  revokeSession: vi.fn(),
  hashSessionToken: vi.fn().mockReturnValue("mock-hash"),
}));

// Mock the sdk module
vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token-12345"),
    verifySession: vi.fn().mockResolvedValue({ openId: "test-user", appId: "test-app", name: "Test User" }),
    authenticateRequest: vi.fn(),
  },
}));

function createAuthContext(user?: AuthenticatedUser | null): { 
  ctx: TrpcContext; 
  setCookies: CookieCall[];
  clearedCookies: CookieCall[];
} {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];

  const defaultUser: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
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

  const ctx: TrpcContext = {
    user: user === null ? null : (user || defaultUser),
    isImpersonating: false,
    realAdminUser: null,
    req: {
      protocol: "https",
      headers: {
        cookie: `${COOKIE_NAME}=existing-session-token`,
      },
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, setCookies, clearedCookies };
}

describe("auth.refreshToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a new token for authenticated users", async () => {
    const { ctx, setCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.refreshToken();

    expect(result.success).toBe(true);
    expect(result.token).toBe("mock-session-token-12345");
    
    // Should set a new session cookie
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(setCookies[0]?.value).toBe("mock-session-token-12345");
  });

  it("throws error for unauthenticated users", async () => {
    const { ctx } = createAuthContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.refreshToken()).rejects.toThrow();
  });
});

describe("auth.loginWithPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns token and user data on successful login", async () => {
    const mockUser: AuthenticatedUser = {
      id: 42,
      openId: "password-user-123",
      email: "user@example.com",
      name: "Password User",
      loginMethod: "email",
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

    vi.mocked(db.authenticateWithPassword).mockResolvedValue(mockUser);

    const { ctx, setCookies } = createAuthContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.loginWithPassword({
      email: "user@example.com",
      password: "correct-password",
    });

    expect(result.success).toBe(true);
    expect(result.token).toBe("mock-session-token-12345");
    expect(result.user).toEqual({
      id: 42,
      name: "Password User",
      email: "user@example.com",
      role: "trainer",
    });

    // Should set session cookie
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
  });

  it("throws UNAUTHORIZED for invalid credentials", async () => {
    vi.mocked(db.authenticateWithPassword).mockResolvedValue(null);

    const { ctx } = createAuthContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "user@example.com",
        password: "wrong-password",
      })
    ).rejects.toThrow("Invalid email or password");
  });

  it("validates email format", async () => {
    const { ctx } = createAuthContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.loginWithPassword({
        email: "not-an-email",
        password: "password123",
      })
    ).rejects.toThrow();
  });
});

describe("auth.getSessionToken", () => {
  it("returns token for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.getSessionToken();

    expect(result.token).toBe("existing-session-token");
  });

  it("returns null token for unauthenticated users", async () => {
    const { ctx } = createAuthContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.getSessionToken();

    expect(result.token).toBeNull();
  });
});
