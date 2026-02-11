import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { User } from "../server/db";
import * as db from "../server/db";

vi.mock("../server/_core/websocket", () => ({
  notifyBadgeCounts: vi.fn(),
  notifyNewMessage: vi.fn(),
}));

function createUser(role: User["role"]): User {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-0000-0000-000000000001",
    authId: null,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    phone: null,
    photoUrl: null,
    loginMethod: "manus",
    role,
    username: null,
    bio: null,
    specialties: null,
    socialLinks: null,
    trainerId: null,
    active: true,
    metadata: null,
    passwordHash: null,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

function createCaller(role: User["role"]) {
  const ctx: TrpcContext = {
    user: createUser(role),
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return appRouter.createCaller(ctx);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("router integration", () => {
  it("blocks trainers from placing orders", async () => {
    const caller = createCaller("trainer");

    await expect(
      caller.orders.create({
        items: [
          {
            title: "Starter Bundle",
            quantity: 1,
            unitPrice: 25,
            fulfillment: "trainer_delivery",
          },
        ],
      })
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("creates order + deliveries for shopper checkout", async () => {
    const caller = createCaller("shopper");

    vi.spyOn(db, "getBundleDraftById").mockResolvedValue({
      id: "bundle-1",
      title: "Starter Bundle",
      price: "30.00",
      trainerId: "trainer-1",
    } as any);
    const createOrderSpy = vi.spyOn(db, "createOrder").mockResolvedValue("order-1");
    const createOrderItemSpy = vi.spyOn(db, "createOrderItem").mockResolvedValue("item-1");
    const createDeliverySpy = vi.spyOn(db, "createDelivery").mockResolvedValue("delivery-1");

    const result = await caller.orders.create({
      items: [
        {
          title: "Starter Bundle",
          quantity: 2,
          bundleId: "bundle-1",
          unitPrice: 20,
          fulfillment: "trainer_delivery",
        },
      ],
      subtotalAmount: 60,
      taxAmount: 0,
      shippingAmount: 0,
      totalAmount: 60,
    });

    expect(result).toMatchObject({
      success: true,
      orderId: "order-1",
      deliveryIds: ["delivery-1"],
    });
    expect(result.payment).toMatchObject({
      required: true,
      configured: false,
      provisioned: false,
      paymentLink: null,
    });
    expect(createOrderSpy).toHaveBeenCalledTimes(1);
    expect(createOrderItemSpy).toHaveBeenCalledTimes(1);
    expect(createDeliverySpy).toHaveBeenCalledTimes(1);
  });

  it("returns no payment link for already-paid orders", async () => {
    const caller = createCaller("client");

    vi.spyOn(db, "getOrderById").mockResolvedValue({
      id: "order-1",
      clientId: "00000000-0000-0000-0000-000000000001",
      trainerId: "trainer-1",
      totalAmount: "0.00",
      paymentStatus: "paid",
      status: "confirmed",
    } as any);

    const result = await caller.orders.createPaymentLink({ orderId: "order-1" });
    expect(result.success).toBe(true);
    expect(result.payment).toMatchObject({
      required: false,
      provisioned: false,
    });
  });

  it("returns pending payment payload when provider is unavailable", async () => {
    const caller = createCaller("client");

    vi.spyOn(db, "getOrderById").mockResolvedValue({
      id: "order-2",
      clientId: "00000000-0000-0000-0000-000000000001",
      trainerId: "trainer-1",
      totalAmount: "49.99",
      paymentStatus: "pending",
      status: "pending",
      customerEmail: "sample@example.com",
    } as any);

    const result = await caller.orders.createPaymentLink({ orderId: "order-2" });
    expect(result.success).toBe(true);
    expect(result.payment).toMatchObject({
      required: true,
      configured: false,
      provisioned: false,
      paymentLink: null,
    });
  });

  it("returns invitation details from public catalog endpoint", async () => {
    const caller = createCaller("shopper");

    vi.spyOn(db, "getInvitationByToken").mockResolvedValue({
      id: "invite-1",
      token: "abc",
      trainerId: "trainer-1",
      email: "sample@example.com",
      bundleDraftId: "bundle-1",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    } as any);
    vi.spyOn(db, "getUserById").mockResolvedValue({
      id: "trainer-1",
      name: "Coach Alex",
      photoUrl: "https://example.com/trainer.png",
    } as any);
    vi.spyOn(db, "getBundleDraftById").mockResolvedValue({
      id: "bundle-1",
      title: "Strength Program",
      description: "8-week strength focus",
      price: "149.00",
      cadence: "monthly",
      productsJson: [{ id: "p1", name: "Protein", quantity: 1 }],
      servicesJson: [{ id: "s1", name: "1:1 Session", sessions: 4 }],
      goalsJson: ["Build strength"],
    } as any);

    const invitation = await caller.catalog.invitation({ token: "abc" });

    expect(invitation).toBeTruthy();
    expect(invitation?.trainerName).toBe("Coach Alex");
    expect(invitation?.products).toHaveLength(1);
    expect(invitation?.services).toHaveLength(1);
    expect(invitation?.goals).toContain("Build strength");
  });

  it("requires trainer role for trainer-side join request moderation", async () => {
    const caller = createCaller("client");

    await expect(caller.myTrainers.forTrainerPendingRequests()).rejects.toBeInstanceOf(TRPCError);
  });

  it("blocks manager account from accepting invitations", async () => {
    const caller = createCaller("manager");

    await expect(caller.catalog.acceptInvitation({ token: "abc" })).rejects.toBeInstanceOf(TRPCError);
  });

  it("returns trainer point history derived from clients, sessions, and orders", async () => {
    const caller = createCaller("trainer");

    vi.spyOn(db, "getClientsByTrainer").mockResolvedValue([
      {
        id: "client-1",
        name: "Client One",
        acceptedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-01-20T00:00:00.000Z",
      },
    ] as any);
    vi.spyOn(db, "getSessionsByTrainer").mockResolvedValue([
      {
        id: "session-1",
        clientId: "client-1",
        status: "completed",
        completedAt: "2026-02-03T00:00:00.000Z",
        sessionDate: "2026-02-03T00:00:00.000Z",
        createdAt: "2026-02-03T00:00:00.000Z",
      },
    ] as any);
    vi.spyOn(db, "getOrdersByTrainer").mockResolvedValue([
      {
        id: "order-1",
        customerName: "Client One",
        paymentStatus: "paid",
        status: "processing",
        deliveredAt: null,
        updatedAt: "2026-02-04T00:00:00.000Z",
        createdAt: "2026-02-02T00:00:00.000Z",
      },
    ] as any);

    const history = await caller.trainerDashboard.pointHistory({ limit: 10 });

    expect(history).toHaveLength(3);
    expect(history[0]).toMatchObject({
      id: "order-order-1",
      activity: "Client completed an order",
      points: 5,
      clientName: "Client One",
    });
    expect(history[1]).toMatchObject({
      id: "session-session-1",
      activity: "Completed a session",
      points: 10,
      clientName: "Client One",
    });
    expect(history[2]).toMatchObject({
      id: "client-client-1",
      activity: "New client joined",
      points: 50,
      clientName: "Client One",
    });
  });

  it("returns client mySessions from linked trainer relationships", async () => {
    const caller = createCaller("client");

    vi.spyOn(db, "getMyTrainers").mockResolvedValue([
      { relationshipId: "client-rel-1" },
    ] as any);
    vi.spyOn(db, "getSessionsByClient").mockResolvedValue([
      { id: "s-older", sessionDate: "2026-02-01T00:00:00.000Z" },
      { id: "s-newer", sessionDate: "2026-02-05T00:00:00.000Z" },
    ] as any);

    const sessions = await caller.sessions.mySessions();

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.id).toBe("s-newer");
    expect(sessions[1]?.id).toBe("s-older");
  });

  it("uses consistent trainer status tier thresholds", async () => {
    const caller = createCaller("trainer");

    vi.spyOn(db, "getUserById")
      .mockResolvedValueOnce({ totalPoints: 6000 } as any)
      .mockResolvedValueOnce({ totalPoints: 16000 } as any);

    const gold = await caller.trainerDashboard.points();
    const platinum = await caller.trainerDashboard.points();

    expect(gold).toMatchObject({ totalPoints: 6000, statusTier: "Gold" });
    expect(platinum).toMatchObject({ totalPoints: 16000, statusTier: "Platinum" });
  });

  it("allows managers to fetch a single template", async () => {
    const caller = createCaller("manager");

    vi.spyOn(db, "getBundleTemplateById").mockResolvedValue({
      id: "template-1",
      title: "Strength Starter",
      active: true,
    } as any);

    const template = await caller.admin.template({ id: "template-1" });

    expect(template).toMatchObject({
      id: "template-1",
      title: "Strength Starter",
      active: true,
    });
  });

  it("blocks non-managers from admin template endpoint", async () => {
    const caller = createCaller("client");

    await expect(caller.admin.template({ id: "template-1" })).rejects.toBeInstanceOf(TRPCError);
  });

  it("returns trainer partnerships list", async () => {
    const caller = createCaller("trainer");

    vi.spyOn(db, "getTrainerPartnerships").mockResolvedValue([
      {
        id: "partnership-1",
        trainerId: "trainer-1",
        businessId: "business-1",
        status: "pending",
        businessName: "PowerLift Gym",
        businessType: "Gym",
      },
    ] as any);

    const partnerships = await caller.partnerships.list();

    expect(partnerships).toHaveLength(1);
    expect(partnerships[0]).toMatchObject({
      id: "partnership-1",
      businessName: "PowerLift Gym",
      status: "pending",
    });
  });

  it("creates a trainer partnership request for available business", async () => {
    const caller = createCaller("trainer");

    vi.spyOn(db, "getPartnershipBusinessById").mockResolvedValue({
      id: "business-1",
      name: "PowerLift Gym",
      isAvailable: true,
      status: "available",
      commissionRate: 12,
    } as any);
    const createSpy = vi.spyOn(db, "createTrainerPartnership").mockResolvedValue("partnership-1");
    vi.spyOn(db, "logActivity").mockResolvedValue(undefined);

    const result = await caller.partnerships.request({ businessId: "business-1" });

    expect(result).toEqual({ success: true, id: "partnership-1" });
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      trainerId: "00000000-0000-0000-0000-000000000001",
      businessId: "business-1",
      status: "pending",
    }));
  });

  it("allows trainers to submit a new partnership business", async () => {
    const caller = createCaller("trainer");

    const createBusinessSpy = vi.spyOn(db, "createPartnershipBusiness").mockResolvedValue("business-9");
    vi.spyOn(db, "logActivity").mockResolvedValue(undefined);

    const result = await caller.partnerships.submitBusiness({
      name: "My Gym Co",
      type: "Gym",
      description: "Independent gym chain",
      website: "https://mygym.example.com",
      contactEmail: "hello@mygym.example.com",
    });

    expect(result).toEqual({ success: true, id: "business-9" });
    expect(createBusinessSpy).toHaveBeenCalledWith(expect.objectContaining({
      name: "My Gym Co",
      type: "Gym",
      status: "submitted",
      submittedBy: "00000000-0000-0000-0000-000000000001",
    }));
  });
});
