import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { systemRouter } from "./_core/systemRouter";
import { coordinatorProcedure, managerProcedure, protectedProcedure, publicProcedure, router, trainerProcedure } from "./_core/trpc";
import { notifyBadgeCounts, notifyNewMessage } from "./_core/websocket";
import * as adyen from "./adyen";
import * as db from "./db";
import * as shopify from "./shopify";
import { storagePut } from "./storage";

const BOT_REPLIES = [
  "Thanks for your message! How can I help you today?",
  "That's a great question! Let me think about it...",
  "I appreciate you reaching out. Is there anything specific you need?",
  "Got it! I'll make a note of that.",
  "Sounds good! Anything else I can help with?",
  "Interesting! Tell me more about that.",
  "I'm here to help. What would you like to know?",
  "Thanks for the update! I'll keep that in mind.",
];

function getBotReply(userMessage: string): string {
  if (/hello|hi|hey/i.test(userMessage)) return "Hey there! How can I help you today?";
  if (/bye|goodbye|later/i.test(userMessage)) return "Goodbye! Chat again anytime.";
  if (/help/i.test(userMessage)) return "I'm the test bot. Send me any message and I'll reply to help you test the messaging system!";
  if (/thanks|thank you/i.test(userMessage)) return "You're welcome! Let me know if you need anything else.";
  return BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
}

function isManagerLikeRole(role: string): boolean {
  return role === "manager" || role === "coordinator";
}

function notFound(resource: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${resource} not found` });
}

function forbidden(message: string): never {
  throw new TRPCError({ code: "FORBIDDEN", message });
}

function assertTrainerOwned(
  user: { id: string; role: string },
  trainerId: string | null | undefined,
  resource: string,
) {
  if (!trainerId) notFound(resource);
  if (trainerId !== user.id && !isManagerLikeRole(user.role)) {
    forbidden(`You do not have access to this ${resource}`);
  }
}

function assertSubscriptionAccess(
  user: { id: string; role: string },
  subscription: { trainerId: string; clientId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (subscription.trainerId === user.id || subscription.clientId === user.id) return;
  forbidden("You do not have access to this subscription");
}

function assertOrderAccess(
  user: { id: string; role: string },
  order: { trainerId: string | null; clientId: string | null },
) {
  if (isManagerLikeRole(user.role)) return;
  if (order.trainerId === user.id || order.clientId === user.id) return;
  forbidden("You do not have access to this order");
}

function assertOrderManageAccess(
  user: { id: string; role: string },
  order: { trainerId: string | null },
) {
  if (isManagerLikeRole(user.role)) return;
  if (order.trainerId === user.id) return;
  forbidden("You do not have permission to modify this order");
}

function assertDeliveryAccess(
  user: { id: string; role: string },
  delivery: { trainerId: string; clientId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (delivery.trainerId === user.id || delivery.clientId === user.id) return;
  forbidden("You do not have access to this delivery");
}

function assertDeliveryManageAccess(
  user: { id: string; role: string },
  delivery: { trainerId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (delivery.trainerId === user.id) return;
  forbidden("You do not have permission to modify this delivery");
}

function assertDeliveryClientAccess(
  user: { id: string; role: string },
  delivery: { clientId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (delivery.clientId === user.id) return;
  forbidden("You do not have permission to modify this delivery");
}

function assertMessageAccess(
  user: { id: string; role: string },
  message: { senderId: string; receiverId: string },
) {
  if (isManagerLikeRole(user.role)) return;
  if (message.senderId === user.id || message.receiverId === user.id) return;
  forbidden("You do not have access to this message");
}

function toArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === "object") {
    const maybeItems = (value as { items?: unknown }).items;
    return Array.isArray(maybeItems) ? (maybeItems as T[]) : [];
  }
  return [];
}

function parseBundleProducts(productsJson: unknown) {
  const parsed = toArray<Record<string, any>>(productsJson)
    .map((product, index) => {
      const name = String(
        product.name ||
        product.title ||
        product.productName ||
        product.label ||
        ""
      ).trim();
      const quantityRaw = Number(product.quantity ?? product.qty ?? 1);
      const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
      const productId = product.productId ? String(product.productId) : undefined;
      if (!name) return null;
      return {
        id: String(product.id ?? productId ?? index),
        productId,
        name,
        quantity,
      };
    })
    .filter((item) => item !== null) as Array<{
      id: string;
      productId?: string;
      name: string;
      quantity: number;
    }>;
  return parsed;
}

function parseBundleServices(servicesJson: unknown) {
  return toArray<Record<string, any>>(servicesJson)
    .map((service, index) => {
      const name = String(service.name || service.title || service.serviceName || "").trim();
      const sessionsRaw = Number(service.sessions ?? service.quantity ?? service.count ?? 1);
      const sessions = Number.isFinite(sessionsRaw) && sessionsRaw > 0 ? sessionsRaw : 1;
      if (!name) return null;
      return {
        id: String(service.id ?? index),
        name,
        sessions,
      };
    })
    .filter((item): item is { id: string; name: string; sessions: number } => Boolean(item));
}

type OrderPaymentProvision = {
  required: boolean;
  configured: boolean;
  provisioned: boolean;
  paymentLink: string | null;
  merchantReference: string | null;
  expiresAt: string | null;
};

async function provisionOrderPaymentLink(input: {
  orderId: string;
  requestedBy: string;
  payerId: string | null;
  amountMinor: number;
  shopperEmail?: string | null;
  description?: string | null;
}): Promise<OrderPaymentProvision> {
  if (input.amountMinor <= 0) {
    return {
      required: false,
      configured: adyen.isAdyenConfigured(),
      provisioned: false,
      paymentLink: null,
      merchantReference: null,
      expiresAt: null,
    };
  }

  if (!adyen.isAdyenConfigured()) {
    return {
      required: true,
      configured: false,
      provisioned: false,
      paymentLink: null,
      merchantReference: null,
      expiresAt: null,
    };
  }

  try {
    const merchantReference = adyen.generateMerchantReference("ORD");
    const link = await adyen.createPaymentLink({
      amountMinor: input.amountMinor,
      currency: "GBP",
      merchantReference,
      description: input.description || `Order ${input.orderId}`,
      shopperEmail: input.shopperEmail || undefined,
      expiresInMinutes: 60,
    });

    await db.createPaymentSession({
      adyenSessionId: link.id,
      merchantReference,
      requestedBy: input.requestedBy,
      payerId: input.payerId,
      amountMinor: input.amountMinor,
      currency: "GBP",
      description: input.description || `Order ${input.orderId}`,
      method: "link",
      status: "created",
      orderId: input.orderId,
      paymentLink: link.url,
      expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString() : undefined,
      metadata: {
        source: "order_checkout",
      },
    });

    return {
      required: true,
      configured: true,
      provisioned: true,
      paymentLink: link.url || null,
      merchantReference,
      expiresAt: link.expiresAt ? String(link.expiresAt) : null,
    };
  } catch (error) {
    console.error("[Payments] Failed to provision order payment link:", error);
    return {
      required: true,
      configured: true,
      provisioned: false,
      paymentLink: null,
      merchantReference: null,
      expiresAt: null,
    };
  }
}

const RESCHEDULE_REQUEST_PREFIX = "reschedule_request_v1:";

type RescheduleRequestPayload = {
  requestedDate: string | null;
  reason: string | null;
  requestedAt: string;
};

function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function encodeRescheduleRequest(payload: RescheduleRequestPayload): string {
  return `${RESCHEDULE_REQUEST_PREFIX}${JSON.stringify(payload)}`;
}

function decodeRescheduleRequest(notes: string | null | undefined): RescheduleRequestPayload | null {
  if (!notes) return null;

  if (notes.startsWith(RESCHEDULE_REQUEST_PREFIX)) {
    try {
      const raw = JSON.parse(notes.slice(RESCHEDULE_REQUEST_PREFIX.length)) as Partial<RescheduleRequestPayload>;
      return {
        requestedDate: normalizeIsoDate(raw.requestedDate ?? null),
        reason: raw.reason ? String(raw.reason) : null,
        requestedAt: normalizeIsoDate(raw.requestedAt ?? null) ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  if (!notes.toLowerCase().includes("reschedule requested")) return null;

  const [, maybeReason] = notes.split(":");
  return {
    requestedDate: null,
    reason: maybeReason ? maybeReason.trim() : null,
    requestedAt: new Date().toISOString(),
  };
}

function parseBundleGoals(goalsJson: unknown): string[] {
  return toArray<any>(goalsJson)
    .map((goal) => {
      if (typeof goal === "string") return goal.trim();
      if (goal && typeof goal === "object") {
        return String((goal as Record<string, any>).name || (goal as Record<string, any>).title || "").trim();
      }
      return "";
    })
    .filter((goal) => goal.length > 0);
}

function toDeliveryMethod(
  fulfillment?: "home_ship" | "trainer_delivery" | "vending" | "cafeteria",
): "in_person" | "locker" | "front_desk" | "shipped" {
  switch (fulfillment) {
    case "home_ship":
      return "shipped";
    case "vending":
      return "locker";
    case "cafeteria":
      return "front_desk";
    default:
      return "in_person";
  }
}

export const appRouter = router({
  system: systemRouter,

  // ============================================================================
  // AUTH
  // ============================================================================
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================================
  // CATALOG (Public bundle browsing)
  // ============================================================================
  catalog: router({
    bundles: publicProcedure.query(async () => {
      return db.getPublishedBundles();
    }),

    bundleDetail: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return db.getBundleDraftById(input.id);
      }),

    trainers: publicProcedure.query(async () => {
      return db.getTrainers();
    }),

    trainerProfile: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return db.getUserById(input.id);
      }),

    products: publicProcedure.query(async () => {
      // Always serve from local database. Shopify sync happens separately.
      return db.getProducts();
    }),

    searchProducts: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return db.searchProducts(input.query);
      }),

    invitation: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const invitation = await db.getInvitationByToken(input.token);
        if (!invitation) return null;

        const trainer = invitation.trainerId ? await db.getUserById(invitation.trainerId) : undefined;
        const bundle = invitation.bundleDraftId
          ? await db.getBundleDraftById(invitation.bundleDraftId)
          : undefined;

        const products = parseBundleProducts(bundle?.productsJson);
        const services = parseBundleServices(bundle?.servicesJson);
        const goals = parseBundleGoals(bundle?.goalsJson);
        const bundlePrice = Number.parseFloat(String(bundle?.price ?? "0"));

        const expiresAt = invitation.expiresAt ? new Date(invitation.expiresAt) : null;
        const isExpired = Boolean(expiresAt && expiresAt.getTime() < Date.now());

        return {
          id: invitation.id,
          token: invitation.token,
          trainerId: invitation.trainerId,
          trainerName: trainer?.name || "Trainer",
          trainerAvatar: trainer?.photoUrl || null,
          bundleId: bundle?.id || null,
          bundleTitle: bundle?.title || "Bundle Invitation",
          bundleDescription: bundle?.description || "",
          bundlePrice: Number.isFinite(bundlePrice) ? bundlePrice : 0,
          bundleDuration: bundle?.cadence || "program",
          products,
          services,
          goals,
          personalMessage: null,
          status: isExpired && invitation.status === "pending" ? "expired" : (invitation.status || "pending"),
          expiresAt: invitation.expiresAt,
          email: invitation.email,
        };
      }),

    acceptInvitation: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (isManagerLikeRole(ctx.user.role) || ctx.user.role === "trainer") {
          forbidden("Only shoppers and clients can accept invitations");
        }

        const invitation = await db.getInvitationByToken(input.token);
        if (!invitation) notFound("Invitation");
        if (invitation.status && invitation.status !== "pending") {
          forbidden(`Invitation has already been ${invitation.status}`);
        }

        const expiresAt = new Date(invitation.expiresAt);
        if (expiresAt.getTime() < Date.now()) {
          await db.updateInvitation(invitation.id, { status: "expired" });
          forbidden("Invitation has expired");
        }

        if (ctx.user.email && invitation.email) {
          const invitedEmail = invitation.email.trim().toLowerCase();
          const signedInEmail = ctx.user.email.trim().toLowerCase();
          if (invitedEmail !== signedInEmail) {
            forbidden("Signed-in account does not match the invited email");
          }
        }

        const bundle = invitation.bundleDraftId
          ? await db.getBundleDraftById(invitation.bundleDraftId)
          : undefined;
        if (!bundle) notFound("Bundle");
        const trainerId = invitation.trainerId || bundle.trainerId;
        if (!trainerId) notFound("Trainer");

        let clientRecord = await db.getClientByTrainerAndUser(trainerId, ctx.user.id);
        if (!clientRecord) {
          const clientId = await db.createClient({
            trainerId,
            userId: ctx.user.id,
            name: ctx.user.name || invitation.name || "Client",
            email: ctx.user.email || invitation.email,
            phone: ctx.user.phone,
            photoUrl: ctx.user.photoUrl,
            status: "active",
            invitedAt: invitation.createdAt,
            acceptedAt: new Date().toISOString(),
          });
          clientRecord = await db.getClientById(clientId);
        } else if (clientRecord.status !== "active") {
          await db.updateClient(clientRecord.id, {
            status: "active",
            acceptedAt: new Date().toISOString(),
          });
          clientRecord = await db.getClientById(clientRecord.id);
        }
        if (!clientRecord) notFound("Client relationship");

        const amount = Number.parseFloat(String(bundle.price || "0"));
        const safeAmount = Number.isFinite(amount) ? amount : 0;
        const subtotal = safeAmount;
        const tax = 0;
        const shipping = 0;
        const total = subtotal + tax + shipping;
        const paymentStatus = total > 0 ? "pending" : "paid";

        const orderId = await db.createOrder({
          clientId: ctx.user.id,
          trainerId,
          customerEmail: ctx.user.email || invitation.email,
          customerName: ctx.user.name || invitation.name || "Client",
          totalAmount: total.toFixed(2),
          subtotalAmount: subtotal.toFixed(2),
          taxAmount: tax.toFixed(2),
          shippingAmount: shipping.toFixed(2),
          status: "pending",
          paymentStatus,
          fulfillmentStatus: "unfulfilled",
          fulfillmentMethod: "trainer_delivery",
          orderData: {
            source: "invitation_acceptance",
            invitationId: invitation.id,
            bundleDraftId: bundle.id,
            paymentRequired: total > 0,
          },
        });

        const bundleProducts = parseBundleProducts(bundle.productsJson);
        const orderLineItems: Array<{
          id: string;
          name: string;
          quantity: number;
          productId?: string;
        }> = bundleProducts.length > 0
          ? bundleProducts
          : [{ id: "bundle", name: bundle.title, quantity: 1, productId: undefined }];

        const deliveryIds: string[] = [];
        for (const lineItem of orderLineItems) {
          const lineTotal = safeAmount * lineItem.quantity;
          await db.createOrderItem({
            orderId,
            productId: lineItem.productId,
            name: lineItem.name,
            quantity: lineItem.quantity,
            price: safeAmount.toFixed(2),
            totalPrice: lineTotal.toFixed(2),
            fulfillmentStatus: "unfulfilled",
          });

          if (lineItem.productId || bundleProducts.length > 0) {
            const deliveryId = await db.createDelivery({
              orderId,
              trainerId,
              clientId: ctx.user.id,
              productId: lineItem.productId,
              productName: lineItem.name,
              quantity: lineItem.quantity,
              status: "pending",
              deliveryMethod: "in_person",
            });
            deliveryIds.push(deliveryId);
          }
        }

        let subscriptionId: string | null = null;
        if (bundle.cadence && bundle.cadence !== "one_time") {
          const sessionsIncluded = parseBundleServices(bundle.servicesJson)
            .reduce((sum, service) => sum + service.sessions, 0);
          subscriptionId = await db.createSubscription({
            clientId: clientRecord.id,
            trainerId,
            bundleDraftId: bundle.id,
            price: safeAmount.toFixed(2),
            subscriptionType: bundle.cadence,
            sessionsIncluded,
            sessionsUsed: 0,
            startDate: new Date().toISOString(),
          });
        }

        await db.updateInvitation(invitation.id, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          acceptedByUserId: ctx.user.id,
        });

        const payment = await provisionOrderPaymentLink({
          orderId,
          requestedBy: ctx.user.id,
          payerId: ctx.user.id,
          amountMinor: Math.round(total * 100),
          shopperEmail: ctx.user.email,
          description: `Invitation order ${orderId}`,
        });

        notifyBadgeCounts([ctx.user.id, trainerId]);
        return { success: true, orderId, deliveryIds, subscriptionId, payment };
      }),

    declineInvitation: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const invitation = await db.getInvitationByToken(input.token);
        if (!invitation) {
          return { success: true };
        }

        if (invitation.status === "accepted") {
          forbidden("Accepted invitations cannot be declined");
        }

        if (invitation.status === "pending") {
          await db.updateInvitation(invitation.id, { status: "declined" });
        }

        return { success: true };
      }),
  }),

  // ============================================================================
  // BUNDLES (Trainer bundle management)
  // ============================================================================
  bundles: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getBundleDraftsByTrainer(ctx.user.id);
    }),

    get: trainerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) return undefined;
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        return bundle;
      }),

    create: trainerProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        templateId: z.string().optional(),
        price: z.string().optional(),
        cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
        goalsJson: z.any().optional(),
        servicesJson: z.any().optional(),
        productsJson: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Increment template usage count if creating from template
        if (input.templateId) {
          await db.incrementTemplateUsage(input.templateId);
        }
        return db.createBundleDraft({
          trainerId: ctx.user.id,
          title: input.title,
          description: input.description,
          templateId: input.templateId,
          price: input.price,
          cadence: input.cadence,
          goalsJson: input.goalsJson,
          servicesJson: input.servicesJson,
          productsJson: input.productsJson,
        });
      }),

    update: trainerProcedure
      .input(z.object({
        id: z.string(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
        imageUrl: z.string().optional(),
        goalsJson: z.any().optional(),
        servicesJson: z.any().optional(),
        productsJson: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        const { id, ...data } = input;
        await db.updateBundleDraft(id, data);
        return { success: true };
      }),

    submitForReview: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        await db.updateBundleDraft(input.id, {
          status: "pending_review",
          submittedForReviewAt: new Date().toISOString(),
        });
        const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    templates: trainerProcedure.query(async () => {
      return db.getBundleTemplates();
    }),

    delete: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        if (bundle.status === "pending_review" || bundle.status === "publishing") {
          forbidden("Cannot delete a bundle while it is under review or publishing");
        }
        await db.deleteBundleDraft(input.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // CLIENTS (Trainer's client management)
  // ============================================================================
  clients: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      const trainerClients = await db.getClientsByTrainer(ctx.user.id);
      return Promise.all(
        trainerClients.map(async (client) => {
          const activeBundles = await db.getActiveBundlesCountForClient(client.id);
          const totalSpent = await db.getTotalSpentByClient(client.id);
          return {
            ...client,
            activeBundles,
            totalSpent,
          };
        }),
      );
    }),

    get: trainerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) return undefined;
        assertTrainerOwned(ctx.user, client.trainerId, "client");
        return client;
      }),

    create: trainerProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        goals: z.any().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createClient({
          trainerId: ctx.user.id,
          name: input.name,
          email: input.email,
          phone: input.phone,
          goals: input.goals,
          notes: input.notes,
        });
      }),

    update: trainerProcedure
      .input(z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        goals: z.any().optional(),
        notes: z.string().optional(),
        status: z.enum(["pending", "active", "inactive", "removed"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) notFound("Client");
        assertTrainerOwned(ctx.user, client.trainerId, "client");
        const { id, ...data } = input;
        await db.updateClient(id, data);
        return { success: true };
      }),

    invite: trainerProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        bundleDraftId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.bundleDraftId) {
          const bundle = await db.getBundleDraftById(input.bundleDraftId);
          if (!bundle) notFound("Bundle");
          assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        }
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
        await db.createInvitation({
          trainerId: ctx.user.id,
          email: input.email,
          name: input.name,
          token,
          bundleDraftId: input.bundleDraftId,
          expiresAt,
        });
        return { token, expiresAt };
      }),

    invitations: trainerProcedure.query(async ({ ctx }) => {
      return db.getInvitationsByTrainer(ctx.user.id);
    }),

    bulkInvite: trainerProcedure
      .input(z.object({
        invitations: z.array(z.object({
          email: z.string().email(),
          name: z.string().optional(),
        })),
        bundleDraftId: z.string().optional(),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.bundleDraftId) {
          const bundle = await db.getBundleDraftById(input.bundleDraftId);
          if (!bundle) notFound("Bundle");
          assertTrainerOwned(ctx.user, bundle.trainerId, "bundle");
        }
        const results = [];
        for (const invite of input.invitations) {
          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
          await db.createInvitation({
            trainerId: ctx.user.id,
            email: invite.email,
            name: invite.name,
            token,
            bundleDraftId: input.bundleDraftId,
            expiresAt,
          });
          results.push({ email: invite.email, token, success: true });
        }
        return { sent: results.length, results };
      }),
  }),

  // ============================================================================
  // SUBSCRIPTIONS (with session tracking)
  // ============================================================================
  subscriptions: router({
    // Client gets their subscriptions (finds client records linked to this user)
    mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
      const myTrainers = await db.getMyTrainers(ctx.user.id);
      if (myTrainers.length === 0) return [];
      const allSubs = [];
      for (const trainer of myTrainers) {
        if (trainer.relationshipId) {
          const subs = await db.getSubscriptionsByClient(trainer.relationshipId);
          allSubs.push(...subs);
        }
      }
      return allSubs;
    }),

    // Trainer gets subscriptions for their clients
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getSubscriptionsByTrainer(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        let subscription = await db.getSubscriptionById(input.id);
        if (!subscription) {
          const subs = await db.getSubscriptionsByClient(input.id);
          subscription = subs[0];
        }
        if (!subscription) return undefined;
        assertSubscriptionAccess(ctx.user, subscription);
        return subscription;
      }),

    create: trainerProcedure
      .input(z.object({
        clientId: z.string(),
        bundleDraftId: z.string().optional(),
        price: z.string(),
        subscriptionType: z.enum(["weekly", "monthly", "yearly"]).optional(),
        sessionsIncluded: z.number().default(0),
        startDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) notFound("Client");
        assertTrainerOwned(ctx.user, client.trainerId, "client");
        return db.createSubscription({
          clientId: input.clientId,
          trainerId: client.trainerId,
          bundleDraftId: input.bundleDraftId,
          price: input.price,
          subscriptionType: input.subscriptionType,
          sessionsIncluded: input.sessionsIncluded,
          sessionsUsed: 0,
          startDate: input.startDate ? input.startDate.toISOString() : new Date().toISOString(),
        });
      }),

    // Get session usage stats for a subscription
    sessionStats: protectedProcedure
      .input(z.object({ subscriptionId: z.string() }))
      .query(async ({ ctx, input }) => {
        let sub = await db.getSubscriptionById(input.subscriptionId);
        if (!sub) {
          sub = await db.getActiveSubscription(input.subscriptionId);
        }
        if (!sub) return { included: 0, used: 0, remaining: 0 };
        assertSubscriptionAccess(ctx.user, sub);
        const included = sub.sessionsIncluded || 0;
        const used = sub.sessionsUsed || 0;
        return { included, used, remaining: Math.max(0, included - used) };
      }),

    // Pause a subscription
    pause: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubscriptionById(input.id);
        if (!sub) notFound("Subscription");
        assertSubscriptionAccess(ctx.user, sub);
        await db.updateSubscription(input.id, { status: "paused", pausedAt: new Date().toISOString() });
        return { success: true };
      }),

    // Resume a paused subscription
    resume: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubscriptionById(input.id);
        if (!sub) notFound("Subscription");
        assertSubscriptionAccess(ctx.user, sub);
        await db.updateSubscription(input.id, { status: "active", pausedAt: null });
        return { success: true };
      }),

    // Cancel a subscription
    cancel: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const sub = await db.getSubscriptionById(input.id);
        if (!sub) notFound("Subscription");
        assertSubscriptionAccess(ctx.user, sub);
        await db.updateSubscription(input.id, { status: "cancelled", cancelledAt: new Date().toISOString() });
        return { success: true };
      }),
  }),

  // ============================================================================
  // SESSIONS (Training sessions with usage tracking)
  // ============================================================================
  sessions: router({
    // Trainer gets their sessions
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getSessionsByTrainer(ctx.user.id);
    }),

    upcoming: trainerProcedure.query(async ({ ctx }) => {
      return db.getUpcomingSessions(ctx.user.id);
    }),

    // Client gets their sessions
    mySessions: protectedProcedure.query(async ({ ctx }) => {
      const myTrainers = await db.getMyTrainers(ctx.user.id);
      if (myTrainers.length === 0) return [];

      const allSessions = [];
      for (const trainer of myTrainers) {
        if (trainer.relationshipId) {
          const sessions = await db.getSessionsByClient(trainer.relationshipId);
          allSessions.push(...sessions);
        }
      }

      return allSessions.sort(
        (a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
      );
    }),

    create: trainerProcedure
      .input(z.object({
        clientId: z.string(),
        subscriptionId: z.string().optional(),
        sessionDate: z.date(),
        durationMinutes: z.number().default(60),
        sessionType: z.enum(["training", "check_in", "call", "plan_review"]).optional(),
        location: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const client = await db.getClientById(input.clientId);
        if (!client) notFound("Client");
        assertTrainerOwned(ctx.user, client.trainerId, "client");
        return db.createSession({
          clientId: input.clientId,
          trainerId: client.trainerId,
          subscriptionId: input.subscriptionId,
          sessionDate: input.sessionDate.toISOString(),
          durationMinutes: input.durationMinutes,
          sessionType: input.sessionType,
          location: input.location,
          notes: input.notes,
        });
      }),

    // Mark session as completed - this increments the usage count
    complete: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) notFound("Session");
        assertTrainerOwned(ctx.user, session.trainerId, "session");
        await db.completeSession(input.id);
        return { success: true };
      }),

    cancel: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) notFound("Session");
        assertTrainerOwned(ctx.user, session.trainerId, "session");
        await db.updateSession(input.id, { status: "cancelled" });
        return { success: true };
      }),

    markNoShow: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) notFound("Session");
        assertTrainerOwned(ctx.user, session.trainerId, "session");
        await db.updateSession(input.id, { status: "no_show" });
        return { success: true };
      }),
  }),

  // ============================================================================
  // ORDERS
  // ============================================================================
  orders: router({
    // Client gets their orders
    myOrders: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrdersByClient(ctx.user.id);
    }),

    // Trainer gets orders attributed to them
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getOrdersByTrainer(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        items: z.array(z.object({
          title: z.string().min(1),
          quantity: z.number().int().min(1),
          bundleId: z.string().optional(),
          productId: z.string().optional(),
          trainerId: z.string().optional(),
          unitPrice: z.number().min(0),
          fulfillment: z.enum(["home_ship", "trainer_delivery", "vending", "cafeteria"]).optional(),
        })).min(1),
        subtotalAmount: z.number().min(0).optional(),
        taxAmount: z.number().min(0).optional(),
        shippingAmount: z.number().min(0).optional(),
        totalAmount: z.number().min(0).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "trainer" || isManagerLikeRole(ctx.user.role)) {
          forbidden("Only shoppers and clients can place orders");
        }

        const resolvedItems = await Promise.all(input.items.map(async (item) => {
          let name = item.title;
          let unitPrice = item.unitPrice;
          let trainerId = item.trainerId;
          let productId = item.productId;

          if (item.bundleId) {
            const bundle = await db.getBundleDraftById(item.bundleId);
            if (bundle) {
              name = bundle.title || name;
              const price = Number.parseFloat(String(bundle.price || unitPrice));
              unitPrice = Number.isFinite(price) ? price : unitPrice;
              trainerId = trainerId || bundle.trainerId || undefined;
            }
          } else if (item.productId) {
            const product = await db.getProductById(item.productId);
            if (product) {
              name = product.name || name;
              const price = Number.parseFloat(String(product.price || unitPrice));
              unitPrice = Number.isFinite(price) ? price : unitPrice;
              productId = product.id;
            }
          }

          return {
            ...item,
            name,
            unitPrice,
            trainerId,
            productId,
          };
        }));

        const trainerIds = Array.from(
          new Set(resolvedItems.map((item) => item.trainerId).filter((id): id is string => Boolean(id)))
        );
        if (trainerIds.length > 1) {
          forbidden("Mixed-trainer carts are not supported yet");
        }

        const subtotalComputed = resolvedItems.reduce(
          (sum, item) => sum + (item.unitPrice * item.quantity),
          0,
        );
        const subtotalAmount = input.subtotalAmount ?? subtotalComputed;
        const shippingAmount = input.shippingAmount ?? 0;
        const taxAmount = input.taxAmount ?? 0;
        const totalAmount = input.totalAmount ?? (subtotalAmount + shippingAmount + taxAmount);
        const paymentStatus = totalAmount > 0 ? "pending" : "paid";

        const orderId = await db.createOrder({
          clientId: ctx.user.id,
          trainerId: trainerIds[0] || null,
          customerEmail: ctx.user.email,
          customerName: ctx.user.name,
          totalAmount: totalAmount.toFixed(2),
          subtotalAmount: subtotalAmount.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          shippingAmount: shippingAmount.toFixed(2),
          status: "pending",
          paymentStatus,
          fulfillmentStatus: "unfulfilled",
          fulfillmentMethod: resolvedItems[0]?.fulfillment || "trainer_delivery",
          orderData: {
            source: "checkout",
            itemCount: resolvedItems.length,
            paymentRequired: totalAmount > 0,
          },
        });

        const deliveryIds: string[] = [];
        for (const item of resolvedItems) {
          const lineTotal = item.unitPrice * item.quantity;
          await db.createOrderItem({
            orderId,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.unitPrice.toFixed(2),
            totalPrice: lineTotal.toFixed(2),
            fulfillmentStatus: "unfulfilled",
          });

          if (item.trainerId) {
            const deliveryId = await db.createDelivery({
              orderId,
              trainerId: item.trainerId,
              clientId: ctx.user.id,
              productId: item.productId,
              productName: item.name,
              quantity: item.quantity,
              status: "pending",
              deliveryMethod: toDeliveryMethod(item.fulfillment),
            });
            deliveryIds.push(deliveryId);
          }
        }

        notifyBadgeCounts([ctx.user.id, ...trainerIds]);
        const payment = await provisionOrderPaymentLink({
          orderId,
          requestedBy: ctx.user.id,
          payerId: ctx.user.id,
          amountMinor: Math.round(totalAmount * 100),
          shopperEmail: ctx.user.email,
          description: `Checkout order ${orderId}`,
        });

        return { success: true, orderId, deliveryIds, payment };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) return undefined;
        assertOrderAccess(ctx.user, order);
        const items = await db.getOrderItems(input.id);
        return { ...order, items };
      }),

    createPaymentLink: protectedProcedure
      .input(z.object({ orderId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) notFound("Order");
        assertOrderAccess(ctx.user, order);

        if (order.paymentStatus === "paid") {
          return {
            success: true,
            payment: {
              required: false,
              configured: adyen.isAdyenConfigured(),
              provisioned: false,
              paymentLink: null,
              merchantReference: null,
              expiresAt: null,
            } as OrderPaymentProvision,
          };
        }

        const amountMinor = Math.round(Number.parseFloat(String(order.totalAmount || "0")) * 100);
        const payment = await provisionOrderPaymentLink({
          orderId: order.id,
          requestedBy: ctx.user.id,
          payerId: order.clientId ?? ctx.user.id,
          amountMinor: Number.isFinite(amountMinor) ? amountMinor : 0,
          shopperEmail: order.customerEmail,
          description: `Order ${order.id}`,
        });

        return { success: true, payment };
      }),

    // Update order status
    updateStatus: trainerProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) notFound("Order");
        assertOrderManageAccess(ctx.user, order);
        await db.updateOrder(input.id, { status: input.status });
        return { success: true };
      }),

    // Update fulfillment status
    updateFulfillment: trainerProcedure
      .input(z.object({
        id: z.string(),
        fulfillmentStatus: z.enum(["unfulfilled", "partial", "fulfilled", "restocked"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) notFound("Order");
        assertOrderManageAccess(ctx.user, order);
        await db.updateOrder(input.id, { fulfillmentStatus: input.fulfillmentStatus });
        return { success: true };
      }),
  }),

  // ============================================================================
  // DELIVERIES (Product deliveries)
  // ============================================================================
  deliveries: router({
    // Client gets their deliveries
    myDeliveries: protectedProcedure.query(async ({ ctx }) => {
      // Get client ID from user (client's trainerId links to their trainer)
      // For clients, we query by clientId which is the user's ID
      return db.getDeliveriesByClient(ctx.user.id);
    }),

    // Trainer gets deliveries they need to fulfill
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getDeliveriesByTrainer(ctx.user.id);
    }),

    pending: trainerProcedure.query(async ({ ctx }) => {
      return db.getPendingDeliveries(ctx.user.id);
    }),

    markReady: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryManageAccess(ctx.user, delivery);
        await db.markDeliveryReady(input.id);
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    markDelivered: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryManageAccess(ctx.user, delivery);
        await db.markDeliveryDelivered(input.id);
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Client confirms receipt
    confirmReceipt: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryClientAccess(ctx.user, delivery);
        await db.confirmDeliveryReceipt(input.id);
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Client reports issue
    reportIssue: protectedProcedure
      .input(z.object({
        id: z.string(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryClientAccess(ctx.user, delivery);
        await db.updateDelivery(input.id, {
          status: "disputed",
          disputeReason: input.reason,
        });
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Client requests reschedule
    requestReschedule: protectedProcedure
      .input(z.object({
        id: z.string(),
        requestedDate: z.string(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryClientAccess(ctx.user, delivery);
        const requestedDate = normalizeIsoDate(input.requestedDate);
        if (!requestedDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid requestedDate" });
        }
        await db.updateDelivery(input.id, {
          clientNotes: encodeRescheduleRequest({
            requestedDate,
            reason: input.reason?.trim() ? input.reason.trim() : null,
            requestedAt: new Date().toISOString(),
          }),
        });
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Trainer approves reschedule
    approveReschedule: trainerProcedure
      .input(z.object({
        id: z.string(),
        newDate: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryManageAccess(ctx.user, delivery);
        const normalizedNewDate = normalizeIsoDate(input.newDate);
        if (!normalizedNewDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid newDate" });
        }
        const request = decodeRescheduleRequest(delivery.clientNotes);
        const priorDate = normalizeIsoDate(delivery.scheduledDate);
        const transition = [
          "Reschedule approved",
          priorDate ? `from ${priorDate}` : null,
          `to ${normalizedNewDate}`,
          request?.reason ? `(reason: ${request.reason})` : null,
        ]
          .filter(Boolean)
          .join(" ");
        const updatedNotes = [delivery.notes?.trim(), transition].filter(Boolean).join("\n");
        await db.updateDelivery(input.id, {
          scheduledDate: normalizedNewDate,
          notes: updatedNotes,
          clientNotes: null,
        });
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Trainer rejects reschedule
    rejectReschedule: trainerProcedure
      .input(z.object({
        id: z.string(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const delivery = await db.getDeliveryById(input.id);
        if (!delivery) notFound("Delivery");
        assertDeliveryManageAccess(ctx.user, delivery);
        const request = decodeRescheduleRequest(delivery.clientNotes);
        const rejectionReason = input.reason?.trim() || request?.reason || "No reason provided";
        const updatedNotes = [
          delivery.notes?.trim(),
          `Reschedule rejected: ${rejectionReason}`,
        ]
          .filter(Boolean)
          .join("\n");
        await db.updateDelivery(input.id, {
          notes: updatedNotes,
          clientNotes: null,
        });
        notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        return { success: true };
      }),

    // Create delivery records for an order (called after order is placed)
    createForOrder: trainerProcedure
      .input(z.object({
        orderId: z.string(),
        clientId: z.string(),
        products: z.array(z.object({
          productId: z.string().optional(),
          productName: z.string(),
          quantity: z.number(),
        })),
        scheduledDate: z.string().optional(),
        deliveryMethod: z.enum(["in_person", "locker", "front_desk", "shipped"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) notFound("Order");
        assertOrderManageAccess(ctx.user, order);
        if (!order.trainerId) {
          forbidden("Order is missing a trainer");
        }
        if (order.clientId && order.clientId !== input.clientId) {
          forbidden("Order does not belong to the provided client");
        }
        const deliveryIds: string[] = [];
        for (const product of input.products) {
          const id = await db.createDelivery({
            orderId: input.orderId,
            trainerId: order.trainerId,
            clientId: input.clientId,
            productId: product.productId,
            productName: product.productName,
            quantity: product.quantity,
            status: "pending",
            scheduledDate: input.scheduledDate || undefined,
            deliveryMethod: input.deliveryMethod || "in_person",
          });
          deliveryIds.push(id);
        }
        notifyBadgeCounts([ctx.user.id, input.clientId]);
        return { success: true, deliveryIds };
      }),
  }),

  // ============================================================================
  // MESSAGES
  // ============================================================================
  messages: router({
    conversations: protectedProcedure.query(async ({ ctx }) => {
      const summaries = await db.getConversationSummaries(ctx.user.id);
      return summaries.map(s => {
        const otherUser = s.participants[0];
        return {
          id: s.conversationId,
          conversationId: s.conversationId,
          otherUserId: otherUser?.id,
          otherUserName: otherUser?.name,
          otherUserAvatar: otherUser?.photoUrl,
          otherUserRole: otherUser?.role,
          lastMessageContent: s.lastMessage?.content,
          lastMessageSenderId: s.lastMessage?.senderId,
          unreadCount: s.unreadCount,
          updatedAt: s.lastMessage?.createdAt,
          currentUserId: ctx.user.id,
        };
      });
    }),

    thread: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ ctx, input }) => {
        const isParticipant = await db.isConversationParticipant(input.conversationId, ctx.user.id);
        if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
          forbidden("You do not have access to this conversation");
        }
        return db.getMessagesByConversation(input.conversationId);
      }),

    send: protectedProcedure
      .input(z.object({
        receiverId: z.string(),
        content: z.string().min(1),
        conversationId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(input.conversationId, ctx.user.id);
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
        }
        const conversationId = input.conversationId ||
          [ctx.user.id, input.receiverId].sort().join("-");

        const messageId = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          conversationId,
          content: input.content,
        });

        // Real-time notification
        notifyNewMessage(conversationId, {
          id: messageId,
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          content: input.content,
          conversationId,
        }, [input.receiverId, ctx.user.id]);
        notifyBadgeCounts([input.receiverId]);

        return messageId;
      }),

    sendGroup: protectedProcedure
      .input(z.object({
        receiverIds: z.array(z.string()).min(1),
        content: z.string().min(1),
        conversationId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(input.conversationId, ctx.user.id);
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
        }
        const conversationId =
          input.conversationId || `group-${ctx.user.id}-${Date.now()}`;
        for (const receiverId of input.receiverIds) {
          await db.createMessage({
            senderId: ctx.user.id,
            receiverId,
            conversationId,
            content: input.content,
          });
        }
        return { conversationId };
      }),

    markRead: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.id);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        if (!isManagerLikeRole(ctx.user.role) && message.receiverId !== ctx.user.id) {
          forbidden("Only the recipient can mark this message as read");
        }
        await db.markMessageRead(input.id);
        return { success: true };
      }),

    // Send message with attachment
    sendWithAttachment: protectedProcedure
      .input(z.object({
        receiverId: z.string(),
        content: z.string(),
        conversationId: z.string().optional(),
        messageType: z.enum(["text", "image", "file"]).default("text"),
        attachmentUrl: z.string().optional(),
        attachmentName: z.string().optional(),
        attachmentSize: z.number().optional(),
        attachmentMimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(input.conversationId, ctx.user.id);
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
        }
        const conversationId = input.conversationId ||
          [ctx.user.id, input.receiverId].sort().join("-");

        const messageId = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          conversationId,
          content: input.content,
          messageType: input.messageType,
          attachmentUrl: input.attachmentUrl,
          attachmentName: input.attachmentName,
          attachmentSize: input.attachmentSize,
          attachmentMimeType: input.attachmentMimeType,
        });

        notifyNewMessage(conversationId, {
          id: messageId,
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          content: input.content,
          conversationId,
        }, [input.receiverId, ctx.user.id]);
        notifyBadgeCounts([input.receiverId]);

        return messageId;
      }),

    sendGroupWithAttachment: protectedProcedure
      .input(z.object({
        receiverIds: z.array(z.string()).min(1),
        content: z.string(),
        conversationId: z.string().optional(),
        messageType: z.enum(["text", "image", "file"]).default("text"),
        attachmentUrl: z.string().optional(),
        attachmentName: z.string().optional(),
        attachmentSize: z.number().optional(),
        attachmentMimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(input.conversationId, ctx.user.id);
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
        }
        const conversationId =
          input.conversationId || `group-${ctx.user.id}-${Date.now()}`;
        for (const receiverId of input.receiverIds) {
          await db.createMessage({
            senderId: ctx.user.id,
            receiverId,
            conversationId,
            content: input.content,
            messageType: input.messageType,
            attachmentUrl: input.attachmentUrl,
            attachmentName: input.attachmentName,
            attachmentSize: input.attachmentSize,
            attachmentMimeType: input.attachmentMimeType,
          });
        }
        return { conversationId };
      }),

    // Get reactions for a message
    getReactions: protectedProcedure
      .input(z.object({ messageId: z.string() }))
      .query(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.messageId);
        if (!message) return [];
        assertMessageAccess(ctx.user, message);
        return db.getMessageReactions(input.messageId);
      }),

    // Add reaction to a message
    addReaction: protectedProcedure
      .input(z.object({
        messageId: z.string(),
        reaction: z.string().max(32),
      }))
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.messageId);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        return db.addMessageReaction({
          messageId: input.messageId,
          userId: ctx.user.id,
          reaction: input.reaction,
        });
      }),

    // Remove reaction from a message
    removeReaction: protectedProcedure
      .input(z.object({
        messageId: z.string(),
        reaction: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.messageId);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        await db.removeMessageReaction(input.messageId, ctx.user.id, input.reaction);
        return { success: true };
      }),

    // Get all reactions for messages in a conversation
    getConversationReactions: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ ctx, input }) => {
        const isParticipant = await db.isConversationParticipant(input.conversationId, ctx.user.id);
        if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
          forbidden("You do not have access to this conversation");
        }
        return db.getConversationReactions(input.conversationId);
      }),

    // Upload attachment for message
    uploadAttachment: protectedProcedure
      .input(z.object({
        fileName: z.string().min(1).max(255),
        fileData: z.string(), // Base64 encoded
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB decoded size
        const allowedMimePrefixes = ["image/", "video/", "audio/", "text/"];
        const allowedMimeExact = new Set([
          "application/pdf",
          "application/zip",
          "application/json",
          "application/octet-stream",
        ]);

        const mimeType = input.mimeType.trim().toLowerCase();
        const mimeAllowed =
          allowedMimeExact.has(mimeType) ||
          allowedMimePrefixes.some((prefix) => mimeType.startsWith(prefix)) ||
          mimeType.startsWith("application/vnd.");
        if (!mimeAllowed) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported attachment type" });
        }

        // Quick guard against obviously oversized payloads before decoding.
        const estimatedBytes = Math.ceil((input.fileData.length * 3) / 4);
        if (estimatedBytes > MAX_ATTACHMENT_BYTES) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Attachment exceeds 8 MB limit" });
        }

        let buffer: Buffer;
        try {
          buffer = Buffer.from(input.fileData, "base64");
        } catch {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid attachment payload" });
        }
        if (buffer.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Attachment payload is empty" });
        }
        if (buffer.length > MAX_ATTACHMENT_BYTES) {
          throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Attachment exceeds 8 MB limit" });
        }

        // Generate unique key with user ID and timestamp
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const extCandidate = input.fileName.split(".").pop() || "bin";
        const ext = extCandidate.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
        const key = `messages/${ctx.user.id}/${timestamp}-${randomSuffix}.${ext}`;

        const { url } = await storagePut(key, buffer, mimeType);

        return { url, key };
      }),

    // Send a message to the test bot — bot replies after 1s
    sendToBot: protectedProcedure
      .input(z.object({
        content: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const BOT_USER_ID = "00000000-0000-0000-0000-000000000000"; // System bot
        const conversationId = `bot-${ctx.user.id}`;

        // Save user's message
        const userMsgId = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: BOT_USER_ID,
          conversationId,
          content: input.content,
        });

        notifyNewMessage(conversationId, {
          id: userMsgId,
          senderId: ctx.user.id,
          receiverId: BOT_USER_ID,
          content: input.content,
          conversationId,
        }, [ctx.user.id]);

        // Bot replies after 1 second
        const userId = ctx.user.id;
        setTimeout(async () => {
          try {
            const botReply = getBotReply(input.content);
            const botMsgId = await db.createMessage({
              senderId: BOT_USER_ID,
              receiverId: userId,
              conversationId,
              content: botReply,
            });

            notifyNewMessage(conversationId, {
              id: botMsgId,
              senderId: BOT_USER_ID,
              receiverId: userId,
              content: botReply,
              conversationId,
            }, [userId]);
            notifyBadgeCounts([userId]);
          } catch (err) {
            console.error("[Bot] Failed to reply:", err);
          }
        }, 1000);

        return { conversationId, messageId: userMsgId };
      }),
  }),

  // ============================================================================
  // EARNINGS (Trainer earnings)
  // ============================================================================
  earnings: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getEarningsByTrainer(ctx.user.id);
    }),

    summary: trainerProcedure.query(async ({ ctx }) => {
      return db.getEarningsSummary(ctx.user.id);
    }),
  }),

  // ============================================================================
  // CALENDAR
  // ============================================================================
  calendar: router({
    events: protectedProcedure.query(async ({ ctx }) => {
      return db.getCalendarEvents(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        location: z.string().optional(),
        startTime: z.date(),
        endTime: z.date(),
        eventType: z.enum(["session", "delivery", "appointment", "other"]).optional(),
        relatedClientId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createCalendarEvent({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          location: input.location,
          startTime: input.startTime.toISOString(),
          endTime: input.endTime.toISOString(),
          eventType: input.eventType,
          relatedClientId: input.relatedClientId,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, startTime, endTime, ...rest } = input;
        await db.updateCalendarEvent(id, {
          ...rest,
          ...(startTime && { startTime: startTime.toISOString() }),
          ...(endTime && { endTime: endTime.toISOString() }),
        });
        return { success: true };
      }),
  }),

  // ============================================================================
  // PROFILE (User profile management)
  // ============================================================================
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserById(ctx.user.id);
    }),

    update: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        bio: z.string().optional(),
        username: z.string().optional(),
        photoUrl: z.string().optional(),
        specialties: z.any().optional(),
        socialLinks: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUser(ctx.user.id, input);
        return { success: true };
      }),
  }),

  // ============================================================================
  // MY TRAINERS (Client's trainer relationships)
  // ============================================================================
  myTrainers: router({
    // Get all trainers the current user is working with
    list: protectedProcedure.query(async ({ ctx }) => {
      const trainers = await db.getMyTrainers(ctx.user.id);

      // Enrich with active bundles count
      const enrichedTrainers = await Promise.all(
        trainers.map(async (trainer) => {
          const activeBundles = await db.getActiveBundlesCount(trainer.id, ctx.user.id);
          return {
            ...trainer,
            activeBundles,
          };
        })
      );

      return enrichedTrainers;
    }),

    // Remove a trainer from the client's roster
    remove: protectedProcedure
      .input(z.object({ trainerId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.removeTrainerFromClient(input.trainerId, ctx.user.id);
        return { success: true };
      }),

    // Get available trainers for discovery (not already connected)
    discover: protectedProcedure
      .input(z.object({
        search: z.string().optional(),
        specialty: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        const trainers = await db.getAvailableTrainers(
          ctx.user.id,
          input?.search,
          input?.specialty
        );

        // Enrich with bundle count
        const enrichedTrainers = await Promise.all(
          trainers.map(async (trainer) => {
            const bundleCount = await db.getTrainerBundleCount(trainer.id);
            const bundles = await db.getPublishedBundlesPreviewByTrainer(trainer.id, 2);
            let presentationHtml: string | null = null;
            if (trainer.metadata) {
              try {
                const metadata =
                  typeof trainer.metadata === "string"
                    ? JSON.parse(trainer.metadata)
                    : trainer.metadata;
                presentationHtml =
                  metadata && typeof metadata === "object"
                    ? (metadata as { presentationHtml?: string }).presentationHtml ?? null
                    : null;
              } catch (error) {
                console.warn("[Trainers] Failed to parse trainer metadata:", error);
              }
            }
            return {
              ...trainer,
              bundleCount,
              bundles,
              presentationHtml,
            };
          })
        );

        return enrichedTrainers;
      }),

    // Send a join request to a trainer
    requestToJoin: protectedProcedure
      .input(z.object({
        trainerId: z.string(),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const requestId = await db.createJoinRequest(
          input.trainerId,
          ctx.user.id,
          input.message
        );
        notifyBadgeCounts([ctx.user.id, input.trainerId]);
        return { success: true, requestId };
      }),

    // Get pending join requests (requests the user has sent)
    pendingRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.getPendingJoinRequests(ctx.user.id);
    }),

    // Cancel a pending join request
    cancelRequest: protectedProcedure
      .input(z.object({ requestId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await db.cancelJoinRequest(input.requestId, ctx.user.id);
        notifyBadgeCounts([ctx.user.id]);
        return { success: true };
      }),

    // Trainer-side moderation
    forTrainerPendingRequests: trainerProcedure.query(async ({ ctx }) => {
      return db.getPendingJoinRequestsForTrainer(ctx.user.id);
    }),

    approveRequest: trainerProcedure
      .input(z.object({ requestId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const approved = await db.approveJoinRequest(input.requestId, ctx.user.id);
        notifyBadgeCounts([ctx.user.id, approved.userId || ctx.user.id]);
        return { success: true };
      }),

    rejectRequest: trainerProcedure
      .input(z.object({ requestId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const rejected = await db.rejectJoinRequest(input.requestId, ctx.user.id);
        notifyBadgeCounts([ctx.user.id, rejected.userId || ctx.user.id]);
        return { success: true };
      }),
  }),

  // ============================================================================
  // PARTNERSHIPS (Trainer ad/affiliate partnerships)
  // ============================================================================
  partnerships: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerPartnerships(ctx.user.id);
    }),

    availableBusinesses: trainerProcedure.query(async () => {
      return db.getAvailablePartnershipBusinesses();
    }),

    request: trainerProcedure
      .input(z.object({ businessId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const business = await db.getPartnershipBusinessById(input.businessId);
        if (!business) notFound("Business");

        if (business.isAvailable === false || business.status === "inactive") {
          forbidden("This business is not currently accepting partnership requests");
        }

        const commissionRate = Number.parseFloat(String(business.commissionRate ?? 0));
        const partnershipId = await db.createTrainerPartnership({
          trainerId: ctx.user.id,
          businessId: input.businessId,
          status: "pending",
          commissionRate: Number.isFinite(commissionRate) ? commissionRate : 0,
          totalEarnings: "0",
          clickCount: 0,
          conversionCount: 0,
        });

        await db.logActivity({
          userId: ctx.user.id,
          action: "partnership_requested",
          entityType: "partnership_business",
          entityId: input.businessId,
          details: {
            partnershipId,
            businessName: business.name,
          },
        });

        return { success: true, id: partnershipId };
      }),

    submitBusiness: trainerProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(255),
        type: z.string().trim().min(1).max(100),
        description: z.string().trim().max(2000).optional(),
        website: z.string().trim().max(512).optional(),
        contactEmail: z.string().trim().email(),
      }))
      .mutation(async ({ ctx, input }) => {
        const businessId = await db.createPartnershipBusiness({
          name: input.name,
          type: input.type,
          description: input.description || undefined,
          website: input.website || undefined,
          contactEmail: input.contactEmail,
          commissionRate: 0,
          isAvailable: false,
          status: "submitted",
          submittedBy: ctx.user.id,
        });

        await db.logActivity({
          userId: ctx.user.id,
          action: "partnership_business_submitted",
          entityType: "partnership_business",
          entityId: businessId,
          details: {
            businessName: input.name,
            contactEmail: input.contactEmail,
          },
        });

        return { success: true, id: businessId };
      }),
  }),

  // ============================================================================
  // ADMIN (Manager/Coordinator features)
  // ============================================================================
  admin: router({
    users: managerProcedure.query(async () => {
      return db.getAllUsers();
    }),

    usersWithFilters: managerProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        role: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        search: z.string().optional(),
        joinedAfter: z.string().optional(),
        joinedBefore: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getUsersWithFilters({
          limit: input.limit,
          offset: input.offset,
          role: input.role,
          status: input.status,
          search: input.search,
          joinedAfter: input.joinedAfter ? new Date(input.joinedAfter) : undefined,
          joinedBefore: input.joinedBefore ? new Date(input.joinedBefore) : undefined,
        });
      }),

    searchUsers: managerProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        return db.searchUsers(input.query);
      }),

    deliveries: managerProcedure
      .input(z.object({
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
        status: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllDeliveries({
          limit: input?.limit,
          offset: input?.offset,
          status: input?.status,
          search: input?.search,
        });
      }),

    lowInventory: managerProcedure
      .input(z.object({
        threshold: z.number().int().min(0).max(100).default(5),
        limit: z.number().int().min(1).max(100).default(20),
      }).optional())
      .query(async ({ input }) => {
        return db.getLowInventoryProducts({
          threshold: input?.threshold,
          limit: input?.limit,
        });
      }),

    revenueSummary: managerProcedure.query(async () => {
      return db.getRevenueSummary();
    }),

    revenueTrend: managerProcedure
      .input(z.object({ months: z.number().int().min(1).max(24).default(6) }).optional())
      .query(async ({ input }) => {
        return db.getRevenueTrend({ months: input?.months });
      }),

    updateUserRole: managerProcedure
      .input(z.object({
        userId: z.string(),
        role: z.enum(["shopper", "client", "trainer", "manager", "coordinator"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    updateUserStatus: managerProcedure
      .input(z.object({
        userId: z.string(),
        active: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.userId, input.active);
        return { success: true };
      }),

    bulkUpdateRole: managerProcedure
      .input(z.object({
        userIds: z.array(z.string()).min(1),
        role: z.enum(["shopper", "client", "trainer", "manager", "coordinator"]),
      }))
      .mutation(async ({ input }) => {
        await db.bulkUpdateUserRole(input.userIds, input.role);
        return { success: true, count: input.userIds.length };
      }),

    bulkUpdateStatus: managerProcedure
      .input(z.object({
        userIds: z.array(z.string()).min(1),
        active: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.bulkUpdateUserStatus(input.userIds, input.active);
        return { success: true, count: input.userIds.length };
      }),

    pendingBundles: managerProcedure.query(async () => {
      return db.getPendingReviewBundles();
    }),

    approveBundle: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        await db.updateBundleDraft(input.id, {
          status: "published",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_approved",
          entityType: "bundle_draft",
          entityId: input.id,
          details: { bundleTitle: bundle?.title },
        });
        const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    rejectBundle: managerProcedure
      .input(z.object({
        id: z.string(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        await db.updateBundleDraft(input.id, {
          status: "rejected",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
          rejectionReason: input.reason,
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_rejected",
          entityType: "bundle_draft",
          entityId: input.id,
          details: { bundleTitle: bundle?.title, reason: input.reason },
        });
        const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    requestChanges: managerProcedure
      .input(z.object({
        id: z.string(),
        comments: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateBundleDraft(input.id, {
          status: "changes_requested",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
          reviewComments: input.comments,
        });
        const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    // Template management
    templates: managerProcedure.query(async () => {
      return db.getAllBundleTemplates();
    }),

    template: managerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const template = await db.getBundleTemplateById(input.id);
        if (!template) notFound("Template");
        return template;
      }),

    createTemplate: managerProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        goalType: z.enum(["weight_loss", "strength", "longevity", "power"]).optional(),
        goalsJson: z.any().optional(),
        imageUrl: z.string().optional(),
        basePrice: z.string().optional(),
        defaultServices: z.any().optional(),
        defaultProducts: z.any().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createBundleTemplate({
          ...input,
          createdBy: ctx.user.id,
        });
      }),

    updateTemplate: managerProcedure
      .input(z.object({
        id: z.string(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        goalType: z.enum(["weight_loss", "strength", "longevity", "power"]).optional(),
        goalsJson: z.any().optional(),
        imageUrl: z.string().optional(),
        basePrice: z.string().optional(),
        defaultServices: z.any().optional(),
        defaultProducts: z.any().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const template = await db.getBundleTemplateById(input.id);
        if (!template) notFound("Template");
        const { id, ...data } = input;
        await db.updateBundleTemplate(id, data);
        return { success: true };
      }),

    deleteTemplate: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const template = await db.getBundleTemplateById(input.id);
        if (!template) notFound("Template");
        await db.deleteBundleTemplate(input.id);
        return { success: true };
      }),

    // User Activity Logs
    getUserActivityLogs: managerProcedure
      .input(z.object({ userId: z.string(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getUserActivityLogs(input.userId, input.limit);
      }),

    getRecentActivityLogs: managerProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ input }) => {
        return db.getRecentActivityLogs(input.limit);
      }),

    /** Unified activity feed — combines user actions, system logs, and payment events */
    activityFeed: managerProcedure
      .input(z.object({
        limit: z.number().default(50),
        category: z.enum(["all", "auth", "admin", "payments", "shopify"]).default("all"),
      }))
      .query(async ({ input }) => {
        const items: Array<{
          id: string;
          category: string;
          action: string;
          description: string;
          userId: string | null;
          userName: string | null;
          metadata: any;
          createdAt: string;
        }> = [];

        // 1. User activity logs (admin actions)
        if (input.category === "all" || input.category === "admin" || input.category === "auth") {
          const userLogs = await db.getRecentActivityLogs(input.limit);
          // Resolve user names for the logs
          const userIds = new Set<string>();
          userLogs.forEach((log) => {
            if (log.performedBy) userIds.add(log.performedBy);
            if (log.targetUserId) userIds.add(log.targetUserId);
          });
          const userMap = new Map<string, string>();
          for (const uid of userIds) {
            const u = await db.getUserById(uid);
            if (u?.name) userMap.set(uid, u.name);
          }

          for (const log of userLogs) {
            const performer = userMap.get(log.performedBy) || "Unknown";
            const target = userMap.get(log.targetUserId) || "Unknown user";
            let description = "";
            const cat = log.action.includes("impersonation") ? "auth" : "admin";

            switch (log.action) {
              case "role_changed":
                description = `${performer} changed ${target}'s role: ${log.previousValue || "?"} → ${log.newValue || "?"}`;
                break;
              case "status_changed":
                description = `${performer} ${log.newValue === "true" ? "activated" : "deactivated"} ${target}`;
                break;
              case "impersonation_started":
                description = `${performer} started impersonating ${target}`;
                break;
              case "impersonation_ended":
                description = `${performer} stopped impersonating ${target}`;
                break;
              case "profile_updated":
                description = `${performer} updated ${target}'s profile`;
                break;
              case "invited":
                description = `${performer} invited ${log.notes || target}`;
                break;
              case "deleted":
                description = `${performer} deleted ${target}`;
                break;
              default:
                description = `${performer}: ${log.action}${log.notes ? ` — ${log.notes}` : ""}`;
            }

            if (input.category === "all" || input.category === cat) {
              items.push({
                id: log.id,
                category: cat,
                action: log.action,
                description,
                userId: log.performedBy,
                userName: performer,
                metadata: { targetUserId: log.targetUserId, previousValue: log.previousValue, newValue: log.newValue },
                createdAt: log.createdAt,
              });
            }
          }
        }

        // 2. Payment events
        if (input.category === "all" || input.category === "payments") {
          const paymentLogs = await db.getPaymentLogsByReference("%"); // we need a new function
          // Actually, let's query payment_sessions directly for a feed
          const { getServerSupabase } = await import("../lib/supabase");
          const sb = getServerSupabase();
          const { data: recentPayments } = await sb
            .from("payment_sessions")
            .select("id, merchant_reference, requested_by, amount_minor, currency, status, description, method, created_at, updated_at")
            .order("updated_at", { ascending: false })
            .limit(input.limit);

          for (const ps of recentPayments || []) {
            const requester = await db.getUserById(ps.requested_by);
            const amount = (ps.amount_minor / 100).toFixed(2);
            items.push({
              id: `pay-${ps.id}`,
              category: "payments",
              action: ps.status,
              description: `${requester?.name || "Unknown"} — ${ps.currency} ${amount} ${ps.description || ""} (${ps.status})`,
              userId: ps.requested_by,
              userName: requester?.name || null,
              metadata: { merchantReference: ps.merchant_reference, method: ps.method, amountMinor: ps.amount_minor },
              createdAt: ps.updated_at || ps.created_at,
            });
          }
        }

        // 3. Shopify product sync — check activity_logs for shopify events
        if (input.category === "all" || input.category === "shopify") {
          const { getServerSupabase: getSb } = await import("../lib/supabase");
          const sb2 = getSb();
          const { data: actLogs } = await sb2
            .from("activity_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(input.limit);

          for (const al of actLogs || []) {
            items.push({
              id: `act-${al.id}`,
              category: al.action?.includes("shopify") ? "shopify" : "admin",
              action: al.action,
              description: `${al.action}${al.entity_type ? ` (${al.entity_type})` : ""}`,
              userId: al.user_id,
              userName: null,
              metadata: al.details,
              createdAt: al.created_at,
            });
          }
        }

        // Sort by createdAt descending and limit
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return items.slice(0, input.limit);
      }),

    logUserAction: managerProcedure
      .input(z.object({
        targetUserId: z.string(),
        action: z.enum(["role_changed", "status_changed", "impersonation_started", "impersonation_ended", "profile_updated", "invited", "deleted"]),
        previousValue: z.string().optional(),
        newValue: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.logUserActivity({
          targetUserId: input.targetUserId,
          performedBy: ctx.user.id,
          action: input.action,
          previousValue: input.previousValue,
          newValue: input.newValue,
          notes: input.notes,
        });
        return { success: true };
      }),

    // User Impersonation
    getUserForImpersonation: managerProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ input }) => {
        return db.getUserById(input.userId);
      }),

    // User Invitations
    createUserInvitation: managerProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        role: z.enum(["shopper", "client", "trainer", "manager", "coordinator"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const token = crypto.randomUUID().replace(/-/g, "");
        const expiresAtDate = new Date();
        expiresAtDate.setDate(expiresAtDate.getDate() + 7); // Expires in 7 days

        const id = await db.createUserInvitation({
          invitedBy: ctx.user.id,
          email: input.email,
          name: input.name,
          role: input.role,
          token,
          expiresAt: expiresAtDate.toISOString(),
        });

        // Log the invitation
        await db.logUserActivity({
          targetUserId: ctx.user.id, // No target user yet — log under inviter
          performedBy: ctx.user.id,
          action: "invited",
          newValue: input.role,
          notes: `Invited ${input.email} as ${input.role}`,
        });

        return { success: true, id, token };
      }),

    getUserInvitations: managerProcedure
      .input(z.object({
        limit: z.number().default(20),
        offset: z.number().default(0),
        status: z.enum(["pending", "accepted", "expired", "revoked"]).optional(),
      }))
      .query(async ({ input }) => {
        return db.getUserInvitations(input);
      }),

    revokeUserInvitation: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.revokeUserInvitation(input.id);
        return { success: true };
      }),
  }),

  // ============================================================================
  // TRAINER DASHBOARD
  // ============================================================================
  trainerDashboard: router({
    stats: trainerProcedure.query(async ({ ctx }) => {
      const clients = await db.getClientsByTrainer(ctx.user.id);
      const bundles = await db.getBundleDraftsByTrainer(ctx.user.id);
      const orders = await db.getOrdersByTrainer(ctx.user.id);
      const earnings = await db.getEarningsByTrainer(ctx.user.id);

      const totalEarnings = earnings.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyEarnings = earnings
        .filter(e => new Date(e.createdAt) >= startOfMonth)
        .reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

      return {
        totalEarnings,
        monthlyEarnings,
        activeClients: clients.filter(c => c.status === "active").length,
        activeBundles: bundles.filter(b => b.status === "published").length,
        pendingOrders: orders.filter(o => o.status === "pending").length,
        completedDeliveries: 0, // Would need delivery query
      };
    }),

    recentOrders: trainerProcedure.query(async ({ ctx }) => {
      const orders = await db.getOrdersByTrainer(ctx.user.id);
      return orders.slice(0, 5);
    }),

    todaySessions: trainerProcedure.query(async ({ ctx }) => {
      const sessions = await db.getUpcomingSessions(ctx.user.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return sessions.filter(s => {
        const sessionDate = new Date(s.sessionDate);
        return sessionDate >= today && sessionDate < tomorrow;
      });
    }),

    points: trainerProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      const totalPoints = (user as any)?.totalPoints || 0;

      let statusTier = "Bronze";
      if (totalPoints >= 15000) statusTier = "Platinum";
      else if (totalPoints >= 5000) statusTier = "Gold";
      else if (totalPoints >= 1000) statusTier = "Silver";

      return { totalPoints, statusTier };
    }),

    pointHistory: trainerProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }).optional())
      .query(async ({ ctx, input }) => {
        const limit = input?.limit ?? 20;

        const [clients, sessions, orders] = await Promise.all([
          db.getClientsByTrainer(ctx.user.id),
          db.getSessionsByTrainer(ctx.user.id),
          db.getOrdersByTrainer(ctx.user.id),
        ]);

        const clientNameById = new Map<string, string>();
        clients.forEach((client) => {
          clientNameById.set(client.id, client.name || "Client");
        });

        const entries: Array<{
          id: string;
          activity: string;
          points: number;
          date: string;
          clientName?: string;
        }> = [];

        sessions
          .filter((session) => session.status === "completed")
          .forEach((session) => {
            const date = session.completedAt || session.sessionDate || session.createdAt;
            if (!date) return;
            entries.push({
              id: `session-${session.id}`,
              activity: "Completed a session",
              points: 10,
              date,
              clientName: session.clientId ? clientNameById.get(session.clientId) : undefined,
            });
          });

        orders
          .filter((order) => ["paid", "completed", "delivered"].includes(String(order.paymentStatus || order.status || "")))
          .forEach((order) => {
            const date = order.deliveredAt || order.updatedAt || order.createdAt;
            if (!date) return;
            entries.push({
              id: `order-${order.id}`,
              activity: "Client completed an order",
              points: 5,
              date,
              clientName: order.customerName || undefined,
            });
          });

        clients.forEach((client) => {
          const date = client.acceptedAt || client.createdAt;
          if (!date) return;
          entries.push({
            id: `client-${client.id}`,
            activity: "New client joined",
            points: 50,
            date,
            clientName: client.name || undefined,
          });
        });

        return entries
          .filter((entry) => !Number.isNaN(new Date(entry.date).getTime()))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, limit);
      }),
  }),

  // ============================================================================
  // AI (Image generation and LLM features)
  // ============================================================================
  ai: router({
    generateImage: protectedProcedure
      .input(z.object({
        prompt: z.string().min(1).max(1000),
        style: z.enum(["modern", "fitness", "wellness", "professional"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await generateImage({
          prompt: input.prompt,
        });
        return { url: result.url };
      }),

    generateBundleImage: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        goals: z.array(z.string()).optional(),
        style: z.enum(["modern", "fitness", "wellness", "professional"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const goalsText = input.goals?.length ? `focusing on ${input.goals.join(", ")}` : "";
        const styleDescriptions: Record<string, string> = {
          modern: "clean, minimalist, modern design with geometric shapes and gradients",
          fitness: "energetic, dynamic fitness imagery with athletic elements",
          wellness: "calm, serene wellness imagery with natural elements and soft colors",
          professional: "professional, corporate style with clean lines and business aesthetics",
        };
        const styleDesc = styleDescriptions[input.style || "fitness"];

        const prompt = `Create a professional fitness bundle cover image for "${input.title}". ${input.description ? `The bundle is about: ${input.description}.` : ""} ${goalsText}. Style: ${styleDesc}. The image should be suitable as a product thumbnail, with no text overlays, high quality, and visually appealing for a fitness/wellness mobile app.`;

        const result = await generateImage({ prompt });
        return { url: result.url };
      }),
  }),

  // ============================================================================
  // COORDINATOR (Impersonation and system config)
  // ============================================================================
  coordinator: router({
    stats: coordinatorProcedure.query(async () => {
      return db.getCoordinatorStats();
    }),

    topTrainers: coordinatorProcedure.query(async () => {
      return db.getTopTrainers(5);
    }),

    topBundles: coordinatorProcedure.query(async () => {
      return db.getTopBundles(5);
    }),

    impersonate: coordinatorProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser) {
          throw new Error("User not found");
        }
        // Log the impersonation
        await db.logActivity({
          userId: ctx.user.id,
          action: "impersonate",
          entityType: "user",
          entityId: input.userId as string,
          details: { targetUserName: targetUser.name },
        });
        // Return target user info for client to use
        return { targetUser };
      }),
  }),

  // ============================================================================
  // PAYMENTS (Adyen integration)
  // ============================================================================
  payments: router({
    /** Get Adyen client config (safe for frontend) */
    config: protectedProcedure.query(() => {
      return {
        clientKey: adyen.getClientKey(),
        environment: adyen.getEnvironment(),
        configured: adyen.isAdyenConfigured(),
      };
    }),

    /** Create a checkout session for card/Apple Pay */
    createSession: trainerProcedure
      .input(z.object({
        amountMinor: z.number().min(1),
        currency: z.string().default("GBP"),
        description: z.string().optional(),
        payerId: z.string().optional(),
        method: z.enum(["card", "apple_pay", "tap"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ref = adyen.generateMerchantReference("PAY");
        const session = await adyen.createCheckoutSession({
          amountMinor: input.amountMinor,
          currency: input.currency,
          merchantReference: ref,
          shopperEmail: ctx.user.email || undefined,
        });

        await db.createPaymentSession({
          adyenSessionId: session.id,
          adyenSessionData: session.sessionData,
          merchantReference: ref,
          requestedBy: ctx.user.id,
          payerId: input.payerId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          description: input.description,
          method: input.method || "card",
          status: "created",
          expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : undefined,
        });

        return {
          sessionId: session.id,
          sessionData: session.sessionData,
          merchantReference: ref,
          clientKey: adyen.getClientKey(),
          environment: adyen.getEnvironment(),
        };
      }),

    /** Create a payment link (for QR codes and shareable URLs) */
    createLink: trainerProcedure
      .input(z.object({
        amountMinor: z.number().min(1),
        currency: z.string().default("GBP"),
        description: z.string().optional(),
        payerId: z.string().optional(),
        expiresInMinutes: z.number().default(60),
      }))
      .mutation(async ({ ctx, input }) => {
        const ref = adyen.generateMerchantReference("LINK");
        const link = await adyen.createPaymentLink({
          amountMinor: input.amountMinor,
          currency: input.currency,
          merchantReference: ref,
          description: input.description || "Payment request",
          expiresInMinutes: input.expiresInMinutes,
        });

        await db.createPaymentSession({
          adyenSessionId: link.id,
          merchantReference: ref,
          requestedBy: ctx.user.id,
          payerId: input.payerId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          description: input.description,
          method: "link",
          status: "created",
          paymentLink: link.url,
          expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString() : undefined,
        });

        return {
          linkUrl: link.url,
          merchantReference: ref,
          expiresAt: link.expiresAt ? String(link.expiresAt) : null,
        };
      }),

    /** Get payment history for the current trainer */
    history: trainerProcedure
      .input(z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        status: z.string().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return db.getPaymentHistory(ctx.user.id, {
          limit: input.limit,
          offset: input.offset,
          status: input.status,
        });
      }),

    /** Get payment stats for the current trainer */
    stats: trainerProcedure.query(async ({ ctx }) => {
      return db.getPaymentStats(ctx.user.id);
    }),
  }),

  // ============================================================================
  // SHOPIFY (Product sync and bundle publishing)
  // ============================================================================
  shopify: router({
    products: trainerProcedure.query(async () => {
      const products = await shopify.fetchProducts();
      return products.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.body_html,
        vendor: p.vendor,
        productType: p.product_type,
        status: p.status,
        price: p.variants[0]?.price || "0.00",
        inventory: p.variants[0]?.inventory_quantity || 0,
        sku: p.variants[0]?.sku || "",
        imageUrl: p.images[0]?.src || null,
      }));
    }),

    product: managerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await shopify.fetchProduct(input.id);
        if (!product) return null;
        return {
          id: product.id,
          title: product.title,
          description: product.body_html,
          vendor: product.vendor,
          productType: product.product_type,
          status: product.status,
          price: product.variants[0]?.price || "0.00",
          inventory: product.variants[0]?.inventory_quantity || 0,
          sku: product.variants[0]?.sku || "",
          imageUrl: product.images[0]?.src || null,
        };
      }),

    sync: managerProcedure.mutation(async () => {
      return shopify.syncProductsFromShopify();
    }),

    publishBundle: trainerProcedure
      .input(z.object({
        bundleId: z.string(),
        title: z.string(),
        description: z.string(),
        price: z.string(),
        imageUrl: z.string().optional(),
        products: z.array(z.object({
          name: z.string(),
          quantity: z.number(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await shopify.publishBundle({
          ...input,
          trainerId: ctx.user.id,
          trainerName: ctx.user.name || "Trainer",
        });

        // Update bundle with Shopify IDs
        await db.updateBundleDraft(input.bundleId, {
          shopifyProductId: result.productId,
          shopifyVariantId: result.variantId,
        });

        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
