import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    isImpersonating: false,
    realAdminUser: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies };
}

describe("auth.register", () => {
  it("should register a new user with valid credentials", async () => {
    const { ctx, setCookies } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = "SecurePassword123!";
    const testName = "Test User";

    const result = await caller.auth.register({
      email: testEmail,
      password: testPassword,
      name: testName,
    });

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe(testEmail);
    expect(result.user?.name).toBe(testName);
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    // Should set a session cookie
    expect(setCookies.length).toBeGreaterThan(0);
  });

  it("should reject registration with existing email", async () => {
    const { ctx: ctx1 } = createPublicContext();
    const caller1 = appRouter.createCaller(ctx1);

    const testEmail = `duplicate-${Date.now()}@example.com`;
    const testPassword = "SecurePassword123!";
    const testName = "Test User";

    // First registration should succeed
    await caller1.auth.register({
      email: testEmail,
      password: testPassword,
      name: testName,
    });

    // Second registration with same email should fail
    const { ctx: ctx2 } = createPublicContext();
    const caller2 = appRouter.createCaller(ctx2);

    await expect(
      caller2.auth.register({
        email: testEmail,
        password: testPassword,
        name: "Another User",
      })
    ).rejects.toThrow();
  });

  it("should reject registration with short password", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `short-pwd-${Date.now()}@example.com`;
    const testPassword = "short"; // Less than 8 characters
    const testName = "Test User";

    await expect(
      caller.auth.register({
        email: testEmail,
        password: testPassword,
        name: testName,
      })
    ).rejects.toThrow();
  });

  it("should reject registration with invalid email format", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = "invalid-email";
    const testPassword = "SecurePassword123!";
    const testName = "Test User";

    await expect(
      caller.auth.register({
        email: testEmail,
        password: testPassword,
        name: testName,
      })
    ).rejects.toThrow();
  });

  it("should reject registration with empty name", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const testEmail = `empty-name-${Date.now()}@example.com`;
    const testPassword = "SecurePassword123!";
    const testName = "";

    await expect(
      caller.auth.register({
        email: testEmail,
        password: testPassword,
        name: testName,
      })
    ).rejects.toThrow();
  });
});
