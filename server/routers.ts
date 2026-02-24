import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, LOCO_ASSISTANT_NAME, LOCO_ASSISTANT_USER_ID } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { getInviteEmailFailureUserMessage, sendInviteEmail } from "./_core/email";
import { logError } from "./_core/logger";
import { generateImage } from "./_core/imageGeneration";
import { sendPushToUsers } from "./_core/push";
import { systemRouter } from "./_core/systemRouter";
import { runTrainerAssistant } from "./_core/trainerAssistant";
import { transcribeAudio } from "./_core/voiceTranscription";
import { coordinatorProcedure, managerProcedure, protectedProcedure, publicProcedure, router, trainerProcedure } from "./_core/trpc";
import { isUserOnline, notifyBadgeCounts, notifyNewMessage, sendToUser } from "./_core/websocket";
import * as adyen from "./adyen";
import * as db from "./db";
import {
    mapBundleToOffer,
    mapOfferInputToBundleDraft,
    type OfferPaymentType,
    type OfferType,
} from "./domains/offers";
import { mapPaymentSessionForView, mapPaymentState, summarizePaymentSessions } from "./domains/payments";
import * as googleCalendar from "./google-calendar";
import * as shopify from "./shopify";
import { storagePut } from "./storage";

const SERVER_USER_ID = LOCO_ASSISTANT_USER_ID;

function toMessagePushBody(content: string, messageType: "text" | "image" | "file" = "text"): string {
  const trimmed = content.trim();
  if (trimmed.length > 0) {
    return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
  }
  if (messageType === "image") return "Sent you an image";
  if (messageType === "file") return "Sent you a file";
  return "Sent you a message";
}

function isManagerLikeRole(role: string): boolean {
  return role === "manager" || role === "coordinator";
}

function toAbsoluteRequestUrl(req: { protocol?: string; get?: (name: string) => string | undefined; headers?: Record<string, unknown> }, value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) return value;

  const forwardedProtoRaw = String(req.headers?.["x-forwarded-proto"] || "");
  const forwardedProto = forwardedProtoRaw.split(",")[0]?.trim();
  const protocol = forwardedProto || req.protocol || "https";
  const host = req.get?.("host") || String(req.headers?.host || "");
  if (!host) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot resolve absolute URL for transcription" });
  }
  return `${protocol}://${host}${value}`;
}

async function notifyInviteFailureByMessage(user: { id: string; name?: string | null }, email: string, errorMessage: string) {
  const conversationId = `server-alert-${user.id}`;
  const content = `Server notice: We could not send an invite email to ${email}.\n\n${getInviteEmailFailureUserMessage(errorMessage)}`;
  try {
    const messageId = await db.createMessage({
      senderId: SERVER_USER_ID,
      receiverId: user.id,
      conversationId,
      content,
      messageType: "system",
    });

    notifyNewMessage(conversationId, {
      id: messageId,
      senderId: SERVER_USER_ID,
      senderName: "Server",
      receiverId: user.id,
      content,
      conversationId,
    }, [user.id]);
    notifyBadgeCounts([user.id]);
    await sendPushToUsers([user.id], {
      title: "Server notice",
      body: "Invite email failed. Open messages for details.",
      data: {
        type: "message",
        conversationId,
        senderId: SERVER_USER_ID,
        senderName: "Server",
      },
    });
  } catch (notifyError) {
    console.error("[Invite] Failed to send server failure message", notifyError);
  }
}

async function createSponsoredProductBonuses(params: {
  trainerId: string;
  orderId: string;
  bundleDraftId: string | null;
  productsJson: unknown;
}) {
  try {
    const items = parseBundleProducts(params.productsJson);
    if (!items.length) return;
    const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
    if (!productIds.length) return;

    const allProducts = await db.getProducts();
    const productMap = new Map(allProducts.map((p) => [p.id, p]));

    for (const item of items) {
      if (!item.productId) continue;
      const product = productMap.get(item.productId);
      if (!product?.isSponsored || !product.trainerBonus) continue;

      const bonus = Number.parseFloat(product.trainerBonus);
      if (!Number.isFinite(bonus) || bonus <= 0) continue;

      if (product.bonusExpiresAt && new Date(product.bonusExpiresAt).getTime() < Date.now()) continue;

      const totalBonus = bonus * (item.quantity || 1);
      await db.createEarning({
        trainerId: params.trainerId,
        orderId: params.orderId,
        bundleDraftId: params.bundleDraftId,
        earningType: "bonus",
        amount: totalBonus.toFixed(2),
        status: "pending",
        notes: `Sponsored product bonus: ${product.name} (${product.sponsoredBy || "brand"}) x${item.quantity || 1}`,
      });
    }
  } catch (error) {
    logError("sponsored_bonus.creation_failed", error, {
      trainerId: params.trainerId,
      orderId: params.orderId,
    });
  }
}

function queueTrainerAssistantReply(params: {
  user: db.User;
  conversationId: string;
  prompt: string;
}) {
  const { user, conversationId, prompt } = params;
  const userId = user.id;

  setTimeout(async () => {
    const startTyping = () => {
      sendToUser(userId, {
        type: "typing_start",
        conversationId,
        userId: LOCO_ASSISTANT_USER_ID,
        userName: LOCO_ASSISTANT_NAME,
      });
    };
    const stopTyping = () => {
      sendToUser(userId, {
        type: "typing_stop",
        conversationId,
        userId: LOCO_ASSISTANT_USER_ID,
      });
    };

    startTyping();
    const keepAlive = setInterval(startTyping, 2500);

    try {
      if (!["trainer", "manager", "coordinator"].includes(user.role)) {
        const unsupportedMessage =
          "I can automate trainer workflows right now. Switch to a trainer account to use invite and analytics tools.";
        const botMsgId = await db.createMessage({
          senderId: LOCO_ASSISTANT_USER_ID,
          receiverId: userId,
          conversationId,
          content: unsupportedMessage,
          messageType: "system",
        });
        notifyNewMessage(conversationId, {
          id: botMsgId,
          senderId: LOCO_ASSISTANT_USER_ID,
          senderName: LOCO_ASSISTANT_NAME,
          receiverId: userId,
          content: unsupportedMessage,
          conversationId,
        }, [userId]);
        notifyBadgeCounts([userId]);
        return;
      }

      const history = await db.getMessagesByConversation(conversationId);
      const assistant = await runTrainerAssistant({
        trainer: user,
        prompt,
        allowMutations: true,
        conversationMessages: history,
      });

      const assistantContent = assistant.reply.trim() || "I’m ready to help with trainer workflows.";
      const botMsgId = await db.createMessage({
        senderId: LOCO_ASSISTANT_USER_ID,
        receiverId: userId,
        conversationId,
        content: assistantContent,
        messageType: "system",
      });

      notifyNewMessage(conversationId, {
        id: botMsgId,
        senderId: LOCO_ASSISTANT_USER_ID,
        senderName: LOCO_ASSISTANT_NAME,
        receiverId: userId,
        content: assistantContent,
        conversationId,
      }, [userId]);
      notifyBadgeCounts([userId]);

      if (!isUserOnline(userId)) {
        await sendPushToUsers([userId], {
          title: LOCO_ASSISTANT_NAME,
          body: toMessagePushBody(assistantContent, "text"),
          data: {
            type: "message",
            conversationId,
            senderId: LOCO_ASSISTANT_USER_ID,
            senderName: LOCO_ASSISTANT_NAME,
          },
        });
      }
    } catch (error) {
      logError("assistant.reply_failed", error, {
        userId,
        conversationId,
      });

      const errorContent =
        "Sorry, I wasn't able to process that request. " +
        (error instanceof Error ? error.message : "An unexpected error occurred.") +
        " Please try again.";
      try {
        const errorMsgId = await db.createMessage({
          senderId: LOCO_ASSISTANT_USER_ID,
          receiverId: userId,
          conversationId,
          content: errorContent,
          messageType: "system",
        });
        notifyNewMessage(conversationId, {
          id: errorMsgId,
          senderId: LOCO_ASSISTANT_USER_ID,
          senderName: LOCO_ASSISTANT_NAME,
          receiverId: userId,
          content: errorContent,
          conversationId,
        }, [userId]);
        notifyBadgeCounts([userId]);
      } catch (notifyError) {
        logError("assistant.error_reply_failed", notifyError, { userId, conversationId });
      }
    } finally {
      clearInterval(keepAlive);
      stopTyping();
    }
  }, 200);
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

type TrainerPayoutBankDetails = {
  accountHolderName: string;
  bankName: string;
  sortCode: string;
  accountNumber: string;
  accountNumberLast4: string;
  connectedAt: string;
  updatedAt: string;
};

type TrainerGoogleCalendarIntegration = {
  connected: boolean;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
};

function toObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function toSanitizedDigits(value: string) {
  return value.replace(/\D/g, "");
}

function getTrainerPayoutBankDetails(metadataRaw: unknown): TrainerPayoutBankDetails | null {
  const metadata = toObjectRecord(metadataRaw);
  const payout = toObjectRecord(metadata.payout);
  const bank = toObjectRecord(payout.bank);

  const accountHolderName = String(bank.accountHolderName || "").trim();
  const bankName = String(bank.bankName || "").trim();
  const sortCode = toSanitizedDigits(String(bank.sortCode || ""));
  const accountNumber = toSanitizedDigits(String(bank.accountNumber || ""));
  const accountNumberLast4 = String(bank.accountNumberLast4 || accountNumber.slice(-4) || "").trim();
  const connectedAt = String(bank.connectedAt || "").trim();
  const updatedAt = String(bank.updatedAt || "").trim();

  if (!accountHolderName || !bankName || sortCode.length !== 6 || accountNumber.length < 6 || !connectedAt) {
    return null;
  }

  return {
    accountHolderName,
    bankName,
    sortCode,
    accountNumber,
    accountNumberLast4: accountNumberLast4 || accountNumber.slice(-4),
    connectedAt,
    updatedAt: updatedAt || connectedAt,
  };
}

function getGoogleCalendarIntegration(metadataRaw: unknown): TrainerGoogleCalendarIntegration | null {
  const metadata = toObjectRecord(metadataRaw);
  const google = toObjectRecord(metadata.googleCalendar);
  const accessToken = String(google.accessToken || "").trim();
  const refreshTokenRaw = String(google.refreshToken || "").trim();
  const expiresAtRaw = String(google.expiresAt || "").trim();
  const selectedCalendarIdRaw = String(google.selectedCalendarId || "").trim();
  const selectedCalendarNameRaw = String(google.selectedCalendarName || "").trim();
  if (!accessToken) return null;
  return {
    connected: true,
    accessToken,
    refreshToken: refreshTokenRaw || null,
    expiresAt: expiresAtRaw || null,
    selectedCalendarId: selectedCalendarIdRaw || null,
    selectedCalendarName: selectedCalendarNameRaw || null,
  };
}

function isIsoExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return false;
  return expiresMs <= Date.now() + 30_000;
}

async function ensureGoogleCalendarAccessToken(user: db.User): Promise<{
  token: string;
  metadata: Record<string, unknown>;
  integration: TrainerGoogleCalendarIntegration;
}> {
  const metadata = toObjectRecord(user.metadata);
  const integration = getGoogleCalendarIntegration(metadata);
  if (!integration) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Google Calendar is not connected." });
  }

  if (!isIsoExpired(integration.expiresAt)) {
    return { token: integration.accessToken, metadata, integration };
  }

  if (!integration.refreshToken) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Google Calendar token expired. Reconnect your Google account.",
    });
  }

  const refreshed = await googleCalendar.refreshGoogleCalendarAccessToken(integration.refreshToken);
  const nextMetadata = {
    ...metadata,
    googleCalendar: {
      ...toObjectRecord(metadata.googleCalendar),
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || integration.refreshToken,
      expiresAt: refreshed.expiresAt,
      updatedAt: new Date().toISOString(),
      selectedCalendarId: integration.selectedCalendarId,
      selectedCalendarName: integration.selectedCalendarName,
    },
  };
  await db.updateUser(user.id, { metadata: nextMetadata });
  return {
    token: refreshed.accessToken,
    metadata: nextMetadata,
    integration: {
      ...integration,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || integration.refreshToken,
      expiresAt: refreshed.expiresAt,
    },
  };
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

function normalizeLookupKey(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function safePositiveInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function computeBundleProgress(
  subscription: db.Subscription,
  bundle: db.BundleDraft | undefined,
  deliveredQtyByProductName?: Map<string, number>,
) {
  const sessionsFromSubscription = safePositiveInt(subscription.sessionsIncluded);
  const sessionsFromServices = parseBundleServices(bundle?.servicesJson).reduce(
    (sum, service) => sum + safePositiveInt(service.sessions),
    0,
  );
  const sessionsFromGoals = safePositiveInt(
    bundle && bundle.goalsJson && typeof bundle.goalsJson === "object"
      ? (bundle.goalsJson as Record<string, unknown>).sessionCount
      : 0,
  );
  const sessionsIncluded =
    sessionsFromSubscription || sessionsFromServices || sessionsFromGoals;
  const sessionsUsed = Math.max(0, safePositiveInt(subscription.sessionsUsed));

  const plannedProducts = parseBundleProducts(bundle?.productsJson);
  const productsIncluded = plannedProducts.reduce(
    (sum, product) => sum + safePositiveInt(product.quantity || 1),
    0,
  );
  const productsUsed = plannedProducts.reduce((sum, product) => {
    const key = normalizeLookupKey(product.name);
    const deliveredQty = deliveredQtyByProductName?.get(key) || 0;
    return sum + Math.max(0, deliveredQty);
  }, 0);

  const sessionsProgressPct =
    sessionsIncluded > 0 ? Math.min(100, Math.round((sessionsUsed / sessionsIncluded) * 100)) : 0;
  const productsProgressPct =
    productsIncluded > 0 ? Math.min(100, Math.round((productsUsed / productsIncluded) * 100)) : 0;
  const sessionsRemaining = Math.max(sessionsIncluded - sessionsUsed, 0);
  const productsRemaining = Math.max(productsIncluded - productsUsed, 0);
  const alerts: string[] = [];

  if (sessionsIncluded > 0) {
    if (sessionsUsed >= sessionsIncluded) alerts.push("Sessions exhausted");
    else if (sessionsUsed / sessionsIncluded >= 0.8) alerts.push("Sessions are running low");
  }
  if (productsIncluded > 0) {
    if (productsUsed >= productsIncluded) alerts.push("Products exhausted");
    else if (productsUsed / productsIncluded >= 0.8) alerts.push("Products are running low");
  }
  if (sessionsUsed > 0 && productsUsed > sessionsUsed + 1) {
    alerts.push("Product usage is outpacing sessions");
  }

  return {
    subscriptionId: subscription.id,
    bundleDraftId: subscription.bundleDraftId || null,
    bundleTitle: bundle?.title || "Current bundle",
    status: subscription.status || "active",
    sessionsUsed,
    sessionsIncluded,
    sessionsRemaining,
    sessionsProgressPct,
    productsUsed,
    productsIncluded,
    productsRemaining,
    productsProgressPct,
    alerts,
  };
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
    inviteRegistrationContext: publicProcedure
      .input(z.object({ token: z.string().min(1) }))
      .query(async ({ input }) => {
        const token = String(input.token || "").trim();
        if (!token) return null;

        const userInvitation = await db.getUserInvitationByToken(token);
        if (userInvitation) {
          const expiresAtMs = new Date(userInvitation.expiresAt).getTime();
          const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs < Date.now();
          const status = isExpired && userInvitation.status === "pending" ? "expired" : userInvitation.status;
          return {
            source: "user_invitation" as const,
            email: userInvitation.email || null,
            name: userInvitation.name || null,
            role: userInvitation.role || null,
            status,
            expiresAt: userInvitation.expiresAt || null,
          };
        }

        const trainerInvitation = await db.getInvitationByToken(token);
        if (!trainerInvitation) return null;
        const expiresAtMs = new Date(trainerInvitation.expiresAt).getTime();
        const isExpired = Number.isFinite(expiresAtMs) && expiresAtMs < Date.now();
        const status = isExpired && trainerInvitation.status === "pending" ? "expired" : trainerInvitation.status;
        return {
          source: "trainer_invitation" as const,
          email: trainerInvitation.email || null,
          name: trainerInvitation.name || null,
          role: null,
          status,
          expiresAt: trainerInvitation.expiresAt || null,
        };
      }),
    acceptUserInvitation: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const invitation = await db.getUserInvitationByToken(input.token);
        if (!invitation) {
          return { matched: false, applied: false } as const;
        }

        const now = Date.now();
        const expiresAtMs = new Date(invitation.expiresAt).getTime();
        if (Number.isFinite(expiresAtMs) && expiresAtMs < now) {
          if (invitation.status === "pending") {
            await db.updateUserInvitation(invitation.id, { status: "expired" });
          }
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This invitation has expired. Ask for a new invite.",
          });
        }

        if (invitation.status === "revoked" || invitation.status === "expired") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `This invitation is ${invitation.status}.`,
          });
        }

        if (invitation.status === "accepted") {
          if (invitation.acceptedByUserId && invitation.acceptedByUserId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "This invitation has already been accepted by another user.",
            });
          }
          await db.updateUserRole(ctx.user.id, invitation.role);
          return {
            matched: true,
            applied: true,
            alreadyAccepted: true,
            role: invitation.role,
          } as const;
        }

        // Token possession is sufficient proof — no strict email match required.
        // The user arrived through the invite link itself.
        await db.updateUserRole(ctx.user.id, invitation.role);
        await db.updateUserInvitation(invitation.id, {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          acceptedByUserId: ctx.user.id,
        });
        await db.revokeOtherPendingUserInvitationsByEmail(invitation.email, invitation.id);
        await db.logUserActivity({
          targetUserId: ctx.user.id,
          performedBy: invitation.invitedBy,
          action: "role_changed",
          previousValue: ctx.user.role || "shopper",
          newValue: invitation.role,
          notes: `Applied invited role via token for ${ctx.user.email || "unknown email"}`,
        });

        return {
          matched: true,
          applied: true,
          alreadyAccepted: false,
          role: invitation.role,
        } as const;
      }),
  }),

  // ============================================================================
  // CATALOG (Public bundle browsing)
  // ============================================================================
  catalog: router({
    bundles: publicProcedure.query(async ({ ctx }) => {
      // Clients only see bundles from trainers they are actively assigned to.
      // Shoppers/guests keep full catalog browsing behavior.
      if (ctx.user?.role === "client") {
        const myTrainers = await db.getMyTrainers(ctx.user.id);
        const activeTrainerIds = myTrainers
          .filter((trainer: any) => trainer.relationshipStatus === "active")
          .map((trainer: any) => trainer.id)
          .filter((id: unknown): id is string => typeof id === "string" && id.length > 0);
        if (activeTrainerIds.length === 0) return [];
        return db.getPublishedBundlesByTrainerIds(activeTrainerIds);
      }
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

    collections: publicProcedure.query(async () => {
      const collections = await db.getCollections(true);
      return collections.map((c) => ({
        id: c.shopifyCollectionId,
        title: c.title,
        handle: c.handle,
        imageUrl: c.imageUrl,
        channels: c.channels || [],
        updatedAt: c.syncedAt || null,
        productIds: c.productIds || [],
      }));
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
          const sessionsFromServices = parseBundleServices(bundle.servicesJson)
            .reduce((sum, service) => sum + service.sessions, 0);
          const goals =
            bundle.goalsJson && typeof bundle.goalsJson === "object"
              ? (bundle.goalsJson as Record<string, unknown>)
              : {};
          const sessionsFromGoalRaw = Number(goals.sessionCount ?? 0);
          const sessionsFromGoal =
            Number.isFinite(sessionsFromGoalRaw) && sessionsFromGoalRaw > 0
              ? Math.floor(sessionsFromGoalRaw)
              : 0;
          const sessionsIncluded = sessionsFromGoal || sessionsFromServices || 0;
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

        await createSponsoredProductBonuses({
          trainerId,
          orderId,
          bundleDraftId: bundle.id,
          productsJson: bundle.productsJson,
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
      const [legacyTemplates, promotedBundles] = await Promise.all([
        db.getBundleTemplates(),
        db.getPromotedTemplates(),
      ]);

      const allProducts = await db.getProducts();
      const productBonusMap = new Map<string, { bonus: number; sponsoredBy: string | null; expiresAt: string | null }>();
      for (const p of allProducts) {
        if (p.isSponsored && p.trainerBonus) {
          const bonus = Number.parseFloat(p.trainerBonus);
          if (bonus > 0) {
            const expired = p.bonusExpiresAt && new Date(p.bonusExpiresAt).getTime() < Date.now();
            if (!expired) {
              productBonusMap.set(p.id, { bonus, sponsoredBy: p.sponsoredBy, expiresAt: p.bonusExpiresAt });
            }
          }
        }
      }

      function calcTotalBonus(productsJson: unknown): number {
        const items = parseBundleProducts(productsJson);
        let total = 0;
        for (const item of items) {
          if (item.productId && productBonusMap.has(item.productId)) {
            total += productBonusMap.get(item.productId)!.bonus * (item.quantity || 1);
          }
        }
        return total;
      }

      const promotedAsTpl = promotedBundles.map((b) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        goalType: null as string | null,
        goalsJson: b.goalsJson,
        imageUrl: b.imageUrl,
        basePrice: b.price,
        minPrice: null as string | null,
        maxPrice: null as string | null,
        rulesJson: null,
        defaultServices: b.servicesJson,
        defaultProducts: b.productsJson,
        active: b.templateActive,
        usageCount: 0,
        createdBy: b.trainerId,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        discountType: b.discountType,
        discountValue: b.discountValue,
        availabilityStart: b.availabilityStart,
        availabilityEnd: b.availabilityEnd,
        templateVisibility: b.templateVisibility,
        isPromoted: true,
        totalTrainerBonus: calcTotalBonus(b.productsJson),
      }));

      return [...legacyTemplates.map((t) => ({ ...t, isPromoted: false })), ...promotedAsTpl];
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
  // OFFERS (Trainer monetization model for MVP)
  // ============================================================================
  offers: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      const bundles = await db.getBundleDraftsByTrainer(ctx.user.id);
      const offers = await Promise.all(
        bundles.map(async (bundle) => {
          const mapped = mapBundleToOffer(bundle);
          if (mapped.imageUrl || !bundle.shopifyProductId) return mapped;
          const linkedProduct = await db.getProductByShopifyProductId(bundle.shopifyProductId);
          return {
            ...mapped,
            imageUrl: linkedProduct?.imageUrl || null,
          };
        }),
      );
      return offers;
    }),

    get: trainerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) return undefined;
        assertTrainerOwned(ctx.user, bundle.trainerId, "offer");
        const mapped = mapBundleToOffer(bundle);
        if (mapped.imageUrl || !bundle.shopifyProductId) return mapped;
        const linkedProduct = await db.getProductByShopifyProductId(bundle.shopifyProductId);
        return {
          ...mapped,
          imageUrl: linkedProduct?.imageUrl || null,
        };
      }),

    create: trainerProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
          type: z.enum(["one_off_session", "multi_session_package", "product_bundle"]),
          priceMinor: z.number().int().min(1),
          included: z.array(z.string()).default([]),
          sessionCount: z.number().int().min(1).optional(),
          paymentType: z.enum(["one_off", "recurring"]),
          publish: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const draft = mapOfferInputToBundleDraft(input as {
          title: string;
          description?: string;
          type: OfferType;
          priceMinor: number;
          included?: string[];
          sessionCount?: number;
          paymentType: OfferPaymentType;
          publish?: boolean;
        });

        const id = await db.createBundleDraft({
          trainerId: ctx.user.id,
          title: draft.title,
          description: draft.description,
          price: draft.price,
          cadence: draft.cadence as "one_time" | "weekly" | "monthly",
          servicesJson: draft.servicesJson,
          productsJson: draft.productsJson,
          goalsJson: draft.goalsJson,
          status: draft.status as any,
        });

        const created = await db.getBundleDraftById(id);
        if (!created) notFound("Offer");
        return mapBundleToOffer(created);
      }),

    update: trainerProcedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          type: z.enum(["one_off_session", "multi_session_package", "product_bundle"]).optional(),
          priceMinor: z.number().int().min(1).optional(),
          included: z.array(z.string()).optional(),
          sessionCount: z.number().int().min(1).optional(),
          paymentType: z.enum(["one_off", "recurring"]).optional(),
          publish: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Offer");
        assertTrainerOwned(ctx.user, bundle.trainerId, "offer");

        const mapped = mapOfferInputToBundleDraft({
          title: input.title || bundle.title,
          description: input.description ?? bundle.description ?? undefined,
          type: (input.type ||
            mapBundleToOffer(bundle).type) as OfferType,
          priceMinor: input.priceMinor ?? Math.round((parseFloat(bundle.price || "0") || 0) * 100),
          included: input.included || mapBundleToOffer(bundle).included,
          sessionCount: input.sessionCount ?? mapBundleToOffer(bundle).sessionCount ?? undefined,
          paymentType: (input.paymentType || mapBundleToOffer(bundle).paymentType) as OfferPaymentType,
          publish: input.publish ?? (bundle.status === "published"),
        });

        await db.updateBundleDraft(input.id, {
          title: mapped.title,
          description: mapped.description,
          price: mapped.price,
          cadence: mapped.cadence as "one_time" | "weekly" | "monthly",
          servicesJson: mapped.servicesJson,
          productsJson: mapped.productsJson,
          goalsJson: mapped.goalsJson,
          status: mapped.status as any,
        });

        const updated = await db.getBundleDraftById(input.id);
        if (!updated) notFound("Offer");
        return mapBundleToOffer(updated);
      }),

    publish: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Offer");
        assertTrainerOwned(ctx.user, bundle.trainerId, "offer");
        await db.updateBundleDraft(input.id, { status: "published" });
        const updated = await db.getBundleDraftById(input.id);
        if (!updated) notFound("Offer");
        return mapBundleToOffer(updated);
      }),

    submitForReview: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Offer");
        assertTrainerOwned(ctx.user, bundle.trainerId, "offer");
        await db.updateBundleDraft(input.id, {
          status: "pending_review",
          submittedForReviewAt: new Date().toISOString(),
        });
        const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
        notifyBadgeCounts(managerIds);
        const updated = await db.getBundleDraftById(input.id);
        if (!updated) notFound("Offer");
        return mapBundleToOffer(updated);
      }),
  }),

  // ============================================================================
  // CLIENTS (Trainer's client management)
  // ============================================================================
  clients: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      const [trainerClients, trainerSubscriptions, trainerDeliveries] = await Promise.all([
        db.getClientsByTrainer(ctx.user.id),
        db.getSubscriptionsByTrainer(ctx.user.id),
        db.getDeliveriesByTrainer(ctx.user.id),
      ]);

      const activeBundleCountsByClient = new Map<string, number>();
      const activeSubscriptionByClient = new Map<string, db.Subscription>();
      for (const subscription of trainerSubscriptions) {
        if (subscription.status !== "active") continue;
        activeBundleCountsByClient.set(
          subscription.clientId,
          (activeBundleCountsByClient.get(subscription.clientId) || 0) + 1,
        );
        if (!activeSubscriptionByClient.has(subscription.clientId)) {
          activeSubscriptionByClient.set(subscription.clientId, subscription);
        }
      }

      const activeBundleIds = Array.from(
        new Set(
          Array.from(activeSubscriptionByClient.values())
            .map((subscription) => subscription.bundleDraftId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const bundleById = new Map<string, db.BundleDraft>();
      if (activeBundleIds.length > 0) {
        const bundles = await Promise.all(activeBundleIds.map((id) => db.getBundleDraftById(id)));
        for (const bundle of bundles) {
          if (bundle?.id) bundleById.set(bundle.id, bundle);
        }
      }

      const consumedDeliveriesByClientAndProduct = new Map<string, Map<string, number>>();
      for (const delivery of trainerDeliveries) {
        const status = String(delivery.status || "").toLowerCase();
        if (status !== "delivered" && status !== "confirmed") continue;
        const clientId = delivery.clientId;
        const productKey = normalizeLookupKey(delivery.productName);
        if (!clientId || !productKey) continue;
        const perClient = consumedDeliveriesByClientAndProduct.get(clientId) || new Map<string, number>();
        perClient.set(productKey, (perClient.get(productKey) || 0) + Math.max(1, Number(delivery.quantity || 1)));
        consumedDeliveriesByClientAndProduct.set(clientId, perClient);
      }

      return Promise.all(
        trainerClients.map(async (client) => {
          const [totalSpent, linkedUser] = await Promise.all([
            db.getTotalSpentByClient(client.id),
            client.userId ? db.getUserById(client.userId) : Promise.resolve(undefined),
          ]);
          const resolvedPhotoUrl = client.photoUrl || linkedUser?.photoUrl || null;
          const currentSubscription = activeSubscriptionByClient.get(client.id);
          const currentBundle = currentSubscription
            ? computeBundleProgress(
                currentSubscription,
                currentSubscription.bundleDraftId
                  ? bundleById.get(currentSubscription.bundleDraftId)
                  : undefined,
                consumedDeliveriesByClientAndProduct.get(client.id),
              )
            : null;
          return {
            ...client,
            photoUrl: resolvedPhotoUrl,
            activeBundles: activeBundleCountsByClient.get(client.id) || 0,
            totalSpent,
            currentBundle,
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

    detail: trainerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const client = await db.getClientById(input.id);
        if (!client) return undefined;
        assertTrainerOwned(ctx.user, client.trainerId, "client");

        const [subscriptions, trainerOrders, deliveriesByClient] = await Promise.all([
          db.getSubscriptionsByClient(client.id),
          db.getOrdersByTrainer(ctx.user.id),
          db.getDeliveriesByClient(client.id),
        ]);

        const consumedDeliveriesByProduct = new Map<string, number>();
        for (const delivery of deliveriesByClient) {
          const status = String(delivery.status || "").toLowerCase();
          if (status !== "delivered" && status !== "confirmed") continue;
          const productKey = normalizeLookupKey(delivery.productName);
          if (!productKey) continue;
          consumedDeliveriesByProduct.set(
            productKey,
            (consumedDeliveriesByProduct.get(productKey) || 0) + Math.max(1, Number(delivery.quantity || 1)),
          );
        }

        const activeOffers = await Promise.all(
          subscriptions
            .filter((sub) => sub.status === "active")
            .map(async (sub) => {
              const bundle = sub.bundleDraftId ? await db.getBundleDraftById(sub.bundleDraftId) : undefined;
              const progress = computeBundleProgress(sub, bundle, consumedDeliveriesByProduct);
              return {
                id: sub.id,
                bundleDraftId: sub.bundleDraftId || null,
                title: bundle?.title || "Offer",
                price: sub.price,
                cadence: sub.subscriptionType || "monthly",
                status: sub.status || "active",
                sessionsUsed: progress.sessionsUsed,
                sessionsIncluded: progress.sessionsIncluded,
                sessionsRemaining: progress.sessionsRemaining,
                sessionsProgressPct: progress.sessionsProgressPct,
                productsUsed: progress.productsUsed,
                productsIncluded: progress.productsIncluded,
                productsRemaining: progress.productsRemaining,
                productsProgressPct: progress.productsProgressPct,
                alerts: progress.alerts,
              };
            }),
        );

        const paymentHistory = trainerOrders
          .filter((order) => {
            if (client.email && order.customerEmail) {
              return order.customerEmail.trim().toLowerCase() === client.email.trim().toLowerCase();
            }
            return Boolean(order.customerName && client.name && order.customerName === client.name);
          })
          .map((order) => ({
            id: order.id,
            amount: parseFloat(order.totalAmount || "0"),
            status: order.paymentStatus || "pending",
            createdAt: order.createdAt,
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
          ...client,
          currentBundle: activeOffers[0] || null,
          activeOffers,
          paymentHistory,
        };
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
        message: z.string().optional(),
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
        try {
          const emailMessageId = await sendInviteEmail({
            to: input.email,
            token,
            recipientName: input.name,
            trainerName: ctx.user.name || ctx.user.email || "Your trainer",
            expiresAtIso: expiresAt,
            personalMessage: input.message,
          });
          console.log("[Invite] trainer invite email queued", {
            trainerId: ctx.user.id,
            recipient: input.email,
            emailMessageId,
          });
        } catch (error: any) {
          logError("invite.email_failed", error, {
            trainerId: ctx.user.id,
            trainerRole: ctx.user.role,
            recipient: input.email,
            flow: "single",
          });
          await notifyInviteFailureByMessage(ctx.user, input.email, error?.message || "unknown error");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: getInviteEmailFailureUserMessage(error),
          });
        }
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
          try {
            const emailMessageId = await sendInviteEmail({
              to: invite.email,
              token,
              recipientName: invite.name,
              trainerName: ctx.user.name || ctx.user.email || "Your trainer",
              expiresAtIso: expiresAt,
              personalMessage: input.message,
            });
            console.log("[Invite] trainer bulk invite email queued", {
              trainerId: ctx.user.id,
              recipient: invite.email,
              emailMessageId,
            });
          } catch (error: any) {
            logError("invite.email_failed", error, {
              trainerId: ctx.user.id,
              trainerRole: ctx.user.role,
              recipient: invite.email,
              flow: "bulk",
            });
            await notifyInviteFailureByMessage(ctx.user, invite.email, error?.message || "unknown error");
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Invite email to ${invite.email} failed. ${getInviteEmailFailureUserMessage(error)}`,
            });
          }
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
        const sessionId = await db.createSession({
          clientId: input.clientId,
          trainerId: client.trainerId,
          subscriptionId: input.subscriptionId,
          sessionDate: input.sessionDate.toISOString(),
          durationMinutes: input.durationMinutes,
          sessionType: input.sessionType,
          location: input.location,
          notes: input.notes,
        });

        // Best-effort sync to connected Google Calendar.
        try {
          const trainer = await db.getUserById(client.trainerId);
          if (trainer) {
            const ensured = await ensureGoogleCalendarAccessToken(trainer);
            const calendarId = ensured.integration.selectedCalendarId || "primary";
            const eventEnd = new Date(input.sessionDate.getTime() + input.durationMinutes * 60_000).toISOString();
            const gcEvent = await googleCalendar.createGoogleCalendarEvent({
              accessToken: ensured.token,
              calendarId,
              summary: `${input.sessionType || "Training"} with ${client.name || "Client"}`,
              description: input.notes || "Scheduled from LocoMotivate trainer calendar.",
              location: input.location || undefined,
              startTimeIso: input.sessionDate.toISOString(),
              endTimeIso: eventEnd,
              attendeeEmails: client.email ? [client.email] : [],
            });
            if (gcEvent.id) {
              await db.updateSession(sessionId, { googleCalendarEventId: gcEvent.id });
            }
          }
        } catch (error) {
          console.warn("[GoogleCalendar] Session sync failed:", error);
        }

        return sessionId;
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

        if (session.googleCalendarEventId) {
          try {
            const trainer = await db.getUserById(session.trainerId);
            if (trainer) {
              const ensured = await ensureGoogleCalendarAccessToken(trainer);
              const calendarId = ensured.integration.selectedCalendarId || "primary";
              await googleCalendar.deleteGoogleCalendarEvent({
                accessToken: ensured.token,
                calendarId,
                eventId: session.googleCalendarEventId,
              });
            }
          } catch (error) {
            console.warn("[GoogleCalendar] Failed to delete event on cancel:", error);
          }
        }

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

    suggestReschedule: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          proposedStartTime: z.date(),
          durationMinutes: z.number().int().min(15).max(480),
          note: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const session = await db.getSessionById(input.id);
        if (!session) notFound("Session");
        if (!(isManagerLikeRole(ctx.user.role) || session.trainerId === ctx.user.id || session.clientId === ctx.user.id)) {
          forbidden("You do not have access to this session");
        }

        const proposer = session.trainerId === ctx.user.id ? "trainer" : session.clientId === ctx.user.id ? "client" : "manager";
        const proposedEnd = new Date(input.proposedStartTime.getTime() + input.durationMinutes * 60_000);
        const noteLine = input.note?.trim() ? ` Note: ${input.note.trim()}` : "";
        const suggestionLine = `\n[Reschedule suggestion by ${proposer}] ${input.proposedStartTime.toISOString()} (${input.durationMinutes}m).${noteLine}`;
        const nextNotes = `${session.notes || ""}${suggestionLine}`.trim();

        await db.updateSession(input.id, { notes: nextNotes });

        // Best-effort Google Calendar suggestion event.
        try {
          const trainer = await db.getUserById(session.trainerId);
          const client = await db.getClientById(session.clientId);
          if (trainer) {
            const ensured = await ensureGoogleCalendarAccessToken(trainer);
            const calendarId = ensured.integration.selectedCalendarId || "primary";
            await googleCalendar.createGoogleCalendarEvent({
              accessToken: ensured.token,
              calendarId,
              summary: `Reschedule suggestion: ${client?.name || "Client"}`,
              description: `Suggested move from LocoMotivate by ${proposer}.${noteLine || ""}`.trim(),
              startTimeIso: input.proposedStartTime.toISOString(),
              endTimeIso: proposedEnd.toISOString(),
              attendeeEmails: client?.email ? [client.email] : [],
            });
          }
        } catch (error) {
          console.warn("[GoogleCalendar] Reschedule suggestion sync failed:", error);
        }

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
        const isAssistantConversation = s.conversationId === `bot-${ctx.user.id}`;
        const participants =
          isAssistantConversation && s.participants.length === 0
            ? [
                {
                  id: LOCO_ASSISTANT_USER_ID,
                  name: LOCO_ASSISTANT_NAME,
                  photoUrl: null,
                  role: "assistant",
                },
              ]
            : s.participants;
        const otherUser = participants[0];
        const isGroup = !isAssistantConversation && (s.conversationId.startsWith("group-") || participants.length > 1);
        const participantNames = participants.map(p => p.name).filter(Boolean);
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
          isGroup,
          participantCount: s.participants.length,
          participantNames,
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

        const isAssistantReceiver = input.receiverId === LOCO_ASSISTANT_USER_ID;

        notifyNewMessage(conversationId, {
          id: messageId,
          senderId: ctx.user.id,
          senderName: ctx.user.name ?? "Someone",
          receiverId: input.receiverId,
          content: input.content,
          conversationId,
        }, isAssistantReceiver ? [ctx.user.id] : [input.receiverId, ctx.user.id], ctx.user.id);

        if (isAssistantReceiver) {
          queueTrainerAssistantReply({
            user: ctx.user,
            conversationId,
            prompt: input.content,
          });
          return messageId;
        }

        notifyBadgeCounts([input.receiverId]);
        if (!isUserOnline(input.receiverId)) {
          await sendPushToUsers([input.receiverId], {
            title: ctx.user.name ?? "New message",
            body: toMessagePushBody(input.content, "text"),
            data: {
              type: "message",
              conversationId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
            },
          });
        }

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
        const recipients = input.receiverIds.filter((id) => id !== ctx.user.id);
        const allParticipantIds = [...recipients, ctx.user.id];
        let firstMessageId: string | null = null;
        for (const receiverId of recipients) {
          const messageId = await db.createMessage({
            senderId: ctx.user.id,
            receiverId,
            conversationId,
            content: input.content,
          });
          if (!firstMessageId) firstMessageId = messageId;
        }
        if (firstMessageId) {
          notifyNewMessage(
            conversationId,
            {
              id: firstMessageId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
              content: input.content,
              conversationId,
            },
            allParticipantIds,
            ctx.user.id,
          );
          notifyBadgeCounts(recipients);
        }
        const pushRecipients = recipients.filter((id) => !isUserOnline(id));
        if (pushRecipients.length > 0) {
          await sendPushToUsers(pushRecipients, {
            title: ctx.user.name ?? "New message",
            body: toMessagePushBody(input.content, "text"),
            data: {
              type: "message",
              conversationId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
            },
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

    edit: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          content: z.string().min(1).max(4000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.id);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        if (!isManagerLikeRole(ctx.user.role) && message.senderId !== ctx.user.id) {
          forbidden("Only the sender can edit this message");
        }
        if (message.messageType && message.messageType !== "text") {
          forbidden("Only text messages can be edited");
        }

        await db.updateMessageContent(input.id, input.content.trim());
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const message = await db.getMessageById(input.id);
        if (!message) notFound("Message");
        assertMessageAccess(ctx.user, message);
        if (!isManagerLikeRole(ctx.user.role) && message.senderId !== ctx.user.id) {
          forbidden("Only the sender can delete this message");
        }

        await db.deleteMessage(input.id);
        return { success: true };
      }),

    deleteConversation: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const isParticipant = await db.isConversationParticipant(input.conversationId, ctx.user.id);
        if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
          forbidden("You do not have access to this conversation");
        }

        await db.deleteConversation(input.conversationId);
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

        const isAssistantReceiver = input.receiverId === LOCO_ASSISTANT_USER_ID;

        notifyNewMessage(conversationId, {
          id: messageId,
          senderId: ctx.user.id,
          senderName: ctx.user.name ?? "Someone",
          receiverId: input.receiverId,
          content: input.content,
          conversationId,
        }, isAssistantReceiver ? [ctx.user.id] : [input.receiverId, ctx.user.id], ctx.user.id);

        if (isAssistantReceiver) {
          queueTrainerAssistantReply({
            user: ctx.user,
            conversationId,
            prompt: input.content,
          });
          return messageId;
        }

        notifyBadgeCounts([input.receiverId]);
        if (!isUserOnline(input.receiverId)) {
          await sendPushToUsers([input.receiverId], {
            title: ctx.user.name ?? "New message",
            body: toMessagePushBody(input.content, input.messageType),
            data: {
              type: "message",
              conversationId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
            },
          });
        }

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
        const recipients = input.receiverIds.filter((id) => id !== ctx.user.id);
        const allParticipantIds = [...recipients, ctx.user.id];
        let firstMessageId: string | null = null;
        for (const receiverId of recipients) {
          const messageId = await db.createMessage({
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
          if (!firstMessageId) firstMessageId = messageId;
        }
        if (firstMessageId) {
          notifyNewMessage(
            conversationId,
            {
              id: firstMessageId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
              content: input.content,
              conversationId,
            },
            allParticipantIds,
            ctx.user.id,
          );
          notifyBadgeCounts(recipients);
        }
        const pushRecipients = recipients.filter((id) => !isUserOnline(id));
        if (pushRecipients.length > 0) {
          await sendPushToUsers(pushRecipients, {
            title: ctx.user.name ?? "New message",
            body: toMessagePushBody(input.content, input.messageType),
            data: {
              type: "message",
              conversationId,
              senderId: ctx.user.id,
              senderName: ctx.user.name ?? "Someone",
            },
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

    // Send a message to Loco Assistant
    sendToBot: protectedProcedure
      .input(z.object({
        content: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const conversationId = `bot-${ctx.user.id}`;

        // Save user's message
        const userMsgId = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: LOCO_ASSISTANT_USER_ID,
          conversationId,
          content: input.content,
        });

        notifyNewMessage(conversationId, {
          id: userMsgId,
          senderId: ctx.user.id,
          senderName: ctx.user.name ?? "You",
          receiverId: LOCO_ASSISTANT_USER_ID,
          content: input.content,
          conversationId,
        }, [ctx.user.id]);

        queueTrainerAssistantReply({
          user: ctx.user,
          conversationId,
          prompt: input.content,
        });

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

  googleCalendar: router({
    status: trainerProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) notFound("Trainer");
      const integration = getGoogleCalendarIntegration(user.metadata);
      return {
        connected: Boolean(integration),
        selectedCalendarId: integration?.selectedCalendarId || null,
        selectedCalendarName: integration?.selectedCalendarName || null,
      };
    }),

    getAuthUrl: trainerProcedure
      .input(
        z.object({
          redirectUri: z.string().url(),
        }),
      )
      .mutation(async ({ input }) => {
        const authUrl = googleCalendar.buildGoogleCalendarAuthUrl(input.redirectUri);
        return { authUrl };
      }),

    connectWithCode: trainerProcedure
      .input(
        z.object({
          code: z.string().min(1),
          redirectUri: z.string().url(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) notFound("Trainer");

        const token = await googleCalendar.exchangeGoogleCalendarCode({
          code: input.code,
          redirectUri: input.redirectUri,
        });
        const calendars = await googleCalendar.listGoogleCalendars(token.accessToken);
        const trainingCalendar = calendars.find((calendar) =>
          String(calendar.summary || "").trim().toLowerCase() === "training",
        );
        const primaryCalendar = calendars.find((calendar) => calendar.primary);
        const selected = trainingCalendar || primaryCalendar || calendars[0] || null;

        const metadata = toObjectRecord(user.metadata);
        const nextMetadata = {
          ...metadata,
          googleCalendar: {
            ...toObjectRecord(metadata.googleCalendar),
            accessToken: token.accessToken,
            refreshToken: token.refreshToken,
            expiresAt: token.expiresAt,
            scope: token.scope,
            tokenType: token.tokenType,
            selectedCalendarId: selected?.id || null,
            selectedCalendarName: selected?.summary || null,
            connectedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
        await db.updateUser(ctx.user.id, { metadata: nextMetadata });

        return {
          success: true,
          selectedCalendarId: selected?.id || null,
          selectedCalendarName: selected?.summary || null,
          calendarsCount: calendars.length,
        };
      }),

    calendars: trainerProcedure.query(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) notFound("Trainer");
      const ensured = await ensureGoogleCalendarAccessToken(user);
      const calendars = await googleCalendar.listGoogleCalendars(ensured.token);
      return {
        selectedCalendarId: ensured.integration.selectedCalendarId,
        selectedCalendarName: ensured.integration.selectedCalendarName,
        calendars,
      };
    }),

    selectCalendar: trainerProcedure
      .input(
        z.object({
          calendarId: z.string().min(1),
          calendarName: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user) notFound("Trainer");
        const metadata = toObjectRecord(user.metadata);
        const nextMetadata = {
          ...metadata,
          googleCalendar: {
            ...toObjectRecord(metadata.googleCalendar),
            selectedCalendarId: input.calendarId,
            selectedCalendarName: input.calendarName,
            updatedAt: new Date().toISOString(),
          },
        };
        await db.updateUser(ctx.user.id, { metadata: nextMetadata });
        return { success: true };
      }),

    disconnect: trainerProcedure.mutation(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) notFound("Trainer");
      const metadata = toObjectRecord(user.metadata);
      const nextMetadata = { ...metadata };
      delete (nextMetadata as any).googleCalendar;
      await db.updateUser(ctx.user.id, { metadata: nextMetadata });
      return { success: true };
    }),

    syncFromGoogle: trainerProcedure.mutation(async ({ ctx }) => {
      const user = await db.getUserById(ctx.user.id);
      if (!user) notFound("Trainer");
      const ensured = await ensureGoogleCalendarAccessToken(user);
      const calendarId = ensured.integration.selectedCalendarId || "primary";

      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const twoWeeksAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const gcEvents = await googleCalendar.listGoogleCalendarEvents({
        accessToken: ensured.token,
        calendarId,
        timeMin: twoWeeksAgo.toISOString(),
        timeMax: twoWeeksAhead.toISOString(),
      });

      const sessions = await db.getSessionsByTrainer(ctx.user.id);
      const sessionsByGcId = new Map<string, db.Session>();
      for (const s of sessions) {
        if (s.googleCalendarEventId) sessionsByGcId.set(s.googleCalendarEventId, s);
      }

      let updated = 0;
      let cancelled = 0;

      for (const gcEvent of gcEvents) {
        if (!gcEvent.id) continue;
        const session = sessionsByGcId.get(gcEvent.id);
        if (!session) continue;

        if (gcEvent.status === "cancelled" && session.status !== "cancelled") {
          await db.updateSession(session.id, { status: "cancelled" });
          cancelled++;
          continue;
        }

        const changes: Partial<db.InsertSession> = {};
        if (gcEvent.start && gcEvent.start !== session.sessionDate) {
          changes.sessionDate = gcEvent.start;
        }
        if (gcEvent.location && gcEvent.location !== session.location) {
          changes.location = gcEvent.location;
        }
        if (gcEvent.summary && gcEvent.summary !== session.sessionType) {
          changes.notes = `[Updated from Google Calendar] ${gcEvent.summary}`;
        }

        if (Object.keys(changes).length > 0) {
          await db.updateSession(session.id, changes);
          updated++;
        }
      }

      // Check for sessions whose Google Calendar events were deleted
      for (const [gcId, session] of sessionsByGcId) {
        if (session.status === "cancelled") continue;
        const stillExists = gcEvents.some((e) => e.id === gcId);
        if (!stillExists) {
          const gcEvent = await googleCalendar.getGoogleCalendarEvent({
            accessToken: ensured.token,
            calendarId,
            eventId: gcId,
          });
          if (!gcEvent || gcEvent.status === "cancelled") {
            await db.updateSession(session.id, { status: "cancelled" });
            cancelled++;
          }
        }
      }

      return { synced: true, updated, cancelled, checked: gcEvents.length };
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

  notifications: router({
    registerPushToken: protectedProcedure
      .input(
        z.object({
          token: z.string().min(10),
          platform: z.enum(["ios", "android", "unknown"]).default("unknown"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserPushToken(ctx.user.id, input.token, input.platform);
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
        if (bundle?.trainerId) {
          await sendPushToUsers([bundle.trainerId], {
            title: "Bundle approved",
            body: `Your bundle "${bundle.title}" is now live.`,
            data: {
              type: "bundle_approval",
              bundleId: input.id,
              status: "approved",
            },
          });
        }
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
        if (bundle?.trainerId) {
          await sendPushToUsers([bundle.trainerId], {
            title: "Bundle needs revision",
            body: `Your bundle "${bundle.title}" was rejected: ${input.reason}`,
            data: {
              type: "bundle_approval",
              bundleId: input.id,
              status: "rejected",
            },
          });
        }
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
        const bundle = await db.getBundleDraftById(input.id);
        await db.updateBundleDraft(input.id, {
          status: "changes_requested",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
          reviewComments: input.comments,
        });
        if (bundle?.trainerId) {
          await sendPushToUsers([bundle.trainerId], {
            title: "Changes requested",
            body: `Review feedback for "${bundle.title}": ${input.comments}`,
            data: {
              type: "bundle_approval",
              bundleId: input.id,
              status: "changes_requested",
            },
          });
        }
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

    // Bundle management (coordinator/manager-created bundles)
    myBundles: managerProcedure.query(async () => {
      return db.getAdminBundles();
    }),

    nonTemplateBundles: managerProcedure.query(async () => {
      return db.getNonTemplateBundles();
    }),

    createBundle: managerProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        price: z.string().optional(),
        cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
        goalsJson: z.any().optional(),
        servicesJson: z.any().optional(),
        productsJson: z.any().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createBundleDraft({
          trainerId: null,
          title: input.title,
          description: input.description,
          price: input.price,
          cadence: input.cadence,
          goalsJson: input.goalsJson,
          servicesJson: input.servicesJson,
          productsJson: input.productsJson,
          imageUrl: input.imageUrl,
          status: "draft",
        });
      }),

    updateBundle: managerProcedure
      .input(z.object({
        id: z.string(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
        goalsJson: z.any().optional(),
        servicesJson: z.any().optional(),
        productsJson: z.any().optional(),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) notFound("Bundle");
        const { id, ...data } = input;
        await db.updateBundleDraft(id, data);
        return { success: true };
      }),

    getBundle: managerProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.id);
        if (!bundle) return undefined;
        return bundle;
      }),

    promotedTemplates: managerProcedure.query(async () => {
      return db.getAllPromotedTemplates();
    }),

    promoteBundleToTemplate: managerProcedure
      .input(z.object({
        bundleId: z.string(),
        templateVisibility: z.array(z.string()).optional(),
        discountType: z.enum(["percentage", "fixed"]).nullable().optional(),
        discountValue: z.string().nullable().optional(),
        availabilityStart: z.string().nullable().optional(),
        availabilityEnd: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        await db.promoteBundleToTemplate(input.bundleId, {
          templateVisibility: input.templateVisibility,
          discountType: input.discountType,
          discountValue: input.discountValue,
          availabilityStart: input.availabilityStart,
          availabilityEnd: input.availabilityEnd,
        });
        return { success: true };
      }),

    updateTemplateSettings: managerProcedure
      .input(z.object({
        bundleId: z.string(),
        templateVisibility: z.array(z.string()).optional(),
        discountType: z.enum(["percentage", "fixed"]).nullable().optional(),
        discountValue: z.string().nullable().optional(),
        availabilityStart: z.string().nullable().optional(),
        availabilityEnd: z.string().nullable().optional(),
        templateActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        if (!bundle.isTemplate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This bundle is not a template." });
        }
        const { bundleId, ...settings } = input;
        await db.updateTemplateSettings(bundleId, settings);
        return { success: true };
      }),

    demoteTemplate: managerProcedure
      .input(z.object({ bundleId: z.string() }))
      .mutation(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) notFound("Bundle");
        if (!bundle.isTemplate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This bundle is not a template." });
        }
        await db.demoteTemplate(input.bundleId);
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
        const expiresAtIso = expiresAtDate.toISOString();

        const id = await db.createUserInvitation({
          invitedBy: ctx.user.id,
          email: input.email,
          name: input.name,
          role: input.role,
          token,
          expiresAt: expiresAtIso,
        });

        let emailMessageId: string;
        try {
          emailMessageId = await sendInviteEmail({
            to: input.email,
            token,
            recipientName: input.name,
            trainerName: ctx.user.name || ctx.user.email || "Bright Coach",
            expiresAtIso,
          });
        } catch (error) {
          // Keep manager/coordinator invite flow fail-closed: no "sent" success when email fails.
          try {
            await db.revokeUserInvitation(id);
          } catch (revokeError) {
            console.error("[Invite] Failed to revoke user invitation after email failure", revokeError);
          }
          logError("invite.user.email_failed", error, {
            inviterId: ctx.user.id,
            inviterRole: ctx.user.role,
            recipient: input.email,
            inviteRole: input.role,
          });
          const message = error instanceof Error ? error.message : String(error || "Invite email failed");
          await notifyInviteFailureByMessage(ctx.user, input.email, message);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: getInviteEmailFailureUserMessage(error),
          });
        }

        // Log the invitation
        await db.logUserActivity({
          targetUserId: ctx.user.id, // No target user yet — log under inviter
          performedBy: ctx.user.id,
          action: "invited",
          newValue: input.role,
          notes: `Invited ${input.email} as ${input.role} (emailMessageId: ${emailMessageId})`,
        });

        return { success: true, id, token, emailMessageId };
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

    resendUserInvitation: managerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const invitation = await db.getUserInvitationById(input.id);
        if (!invitation) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        }
        if (invitation.status === "accepted") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has already been accepted." });
        }
        if (invitation.status === "revoked") {
          throw new TRPCError({ code: "FORBIDDEN", message: "This invitation has been revoked." });
        }

        // Rotate token and extend expiry whenever invite is resent.
        const refreshedToken = crypto.randomUUID().replace(/-/g, "");
        const refreshedExpiry = new Date();
        refreshedExpiry.setDate(refreshedExpiry.getDate() + 7);
        await db.updateUserInvitation(invitation.id, {
          token: refreshedToken,
          expiresAt: refreshedExpiry.toISOString(),
          status: "pending",
        });

        let emailMessageId: string;
        try {
          emailMessageId = await sendInviteEmail({
            to: invitation.email,
            token: refreshedToken,
            recipientName: invitation.name || undefined,
            trainerName: ctx.user.name || "Bright Coach",
            expiresAtIso: refreshedExpiry.toISOString(),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error || "Invite email failed");
          await notifyInviteFailureByMessage(ctx.user, invitation.email, message);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: getInviteEmailFailureUserMessage(error),
          });
        }

        return { success: true, emailMessageId };
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

      let statusTier = "Getting Started";
      if (totalPoints >= 5000) statusTier = "Elite";
      else if (totalPoints >= 2000) statusTier = "Pro";
      else if (totalPoints >= 1000) statusTier = "Growing";

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
    trainerAssistant: trainerProcedure
      .input(z.object({
        message: z.string().min(1).max(4000),
        provider: z.enum(["auto", "chatgpt", "claude", "gemini"]).optional(),
        allowMutations: z.boolean().optional(),
        conversationId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        let conversationMessages: db.Message[] | undefined;
        if (input.conversationId) {
          const isParticipant = await db.isConversationParticipant(input.conversationId, ctx.user.id);
          if (!isParticipant && !isManagerLikeRole(ctx.user.role)) {
            forbidden("You do not have access to this conversation");
          }
          conversationMessages = await db.getMessagesByConversation(input.conversationId);
        }

        return runTrainerAssistant({
          trainer: ctx.user,
          prompt: input.message,
          provider: input.provider || "auto",
          allowMutations: input.allowMutations !== false,
          conversationMessages,
        });
      }),

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
  // VOICE (Speech-to-text)
  // ============================================================================
  voice: router({
    transcribe: protectedProcedure
      .input(z.object({
        audioUrl: z.string().min(1).max(2048),
        language: z.string().min(2).max(16).optional(),
        prompt: z.string().min(1).max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const audioUrl = toAbsoluteRequestUrl(ctx.req, input.audioUrl.trim());
        const result = await transcribeAudio({
          audioUrl,
          language: input.language?.trim(),
          prompt: input.prompt?.trim(),
        });

        if ("error" in result) {
          const code =
            result.code === "FILE_TOO_LARGE"
              ? "PAYLOAD_TOO_LARGE"
              : result.code === "INVALID_FORMAT" || result.code === "TRANSCRIPTION_FAILED"
                ? "BAD_REQUEST"
                : "INTERNAL_SERVER_ERROR";

          throw new TRPCError({
            code,
            message: result.details ? `${result.error}: ${result.details}` : result.error,
          });
        }

        return result;
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
        onboardingUrl: adyen.getOnboardingUrl(),
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

    /** Cancel a pending payment link */
    cancelLink: trainerProcedure
      .input(
        z.object({
          merchantReference: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const session = await db.getPaymentSessionByReference(input.merchantReference);
        if (!session) notFound("Payment link");
        if (session.requestedBy !== ctx.user.id) {
          forbidden("You do not have access to this payment link");
        }
        if ((session.method || "").toLowerCase() !== "link") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only payment links can be cancelled" });
        }

        const rawStatus = (session.status || "").toLowerCase();
        const isSettled = rawStatus === "authorised" || rawStatus === "captured" || rawStatus === "paid_out";
        if (isSettled) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Paid links cannot be cancelled" });
        }
        if (rawStatus === "cancelled") {
          return { success: true, cancelled: false };
        }

        await db.updatePaymentSessionByReference(input.merchantReference, {
          status: "cancelled",
        });
        return { success: true, cancelled: true };
      }),

    /** Get payment history for the current trainer */
    history: trainerProcedure
      .input(
        z.object({
          limit: z.number().default(50),
          offset: z.number().default(0),
          status: z.enum(["awaiting_payment", "paid", "paid_out"]).optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const allSessions = await db.getPaymentSessionsByTrainer(ctx.user.id);
        const filtered = input.status
          ? allSessions.filter((session) => mapPaymentState(session.status) === input.status)
          : allSessions;
        const page = filtered.slice(input.offset, input.offset + input.limit);
        return page.map(mapPaymentSessionForView);
      }),

    /** Get payment stats for the current trainer */
    stats: trainerProcedure.query(async ({ ctx }) => {
      const allSessions = await db.getPaymentSessionsByTrainer(ctx.user.id);
      const summary = summarizePaymentSessions(allSessions);
      return {
        ...summary,
        // Compatibility fields for existing clients during migration.
        pending: summary.awaitingPayment,
        captured: summary.paid,
        totalAmount: summary.totalPaidMinor,
      };
    }),

    trainerServices: trainerProcedure.query(async ({ ctx }) => {
      const bundles = await db.getBundleDraftsByTrainer(ctx.user.id);
      const seen = new Map<string, { id: string; name: string; sessions: number }>();
      for (const bundle of bundles) {
        const services = parseBundleServices(bundle.servicesJson);
        for (const s of services) {
          const key = s.name.toLowerCase();
          if (!seen.has(key)) seen.set(key, s);
        }
      }
      return Array.from(seen.values());
    }),

    payoutSummary: trainerProcedure.query(async ({ ctx }) => {
      const earnings = await db.getEarningsSummary(ctx.user.id);
      const available = Math.max((earnings.total || 0) - (earnings.pending || 0), 0);
      const trainer = await db.getUserById(ctx.user.id);
      const payoutBank = getTrainerPayoutBankDetails(trainer?.metadata);
      const destination = payoutBank
        ? `${payoutBank.bankName} ••••${payoutBank.accountNumberLast4}`
        : null;
      return {
        available,
        pending: earnings.pending || 0,
        nextPayoutDate: null as string | null,
        automatic: Boolean(payoutBank),
        destination,
        bankConnected: Boolean(payoutBank),
        message: payoutBank
          ? `Payouts are enabled to ${destination}.`
          : "Connect your bank account to receive payouts.",
      };
    }),

    payoutSetup: trainerProcedure.query(async ({ ctx }) => {
      const trainer = await db.getUserById(ctx.user.id);
      if (!trainer) notFound("Trainer");

      const payoutBank = getTrainerPayoutBankDetails(trainer.metadata);
      if (!payoutBank) {
        return {
          connected: false,
          accountHolderName: null,
          bankName: null,
          sortCode: null,
          accountNumberLast4: null,
          connectedAt: null,
          updatedAt: null,
        };
      }

      return {
        connected: true,
        accountHolderName: payoutBank.accountHolderName,
        bankName: payoutBank.bankName,
        sortCode: payoutBank.sortCode,
        accountNumberLast4: payoutBank.accountNumberLast4,
        connectedAt: payoutBank.connectedAt,
        updatedAt: payoutBank.updatedAt,
      };
    }),

    connectPayoutBank: trainerProcedure
      .input(
        z.object({
          accountHolderName: z.string().min(2).max(120),
          bankName: z.string().min(2).max(120),
          sortCode: z.string().min(6).max(12),
          accountNumber: z.string().min(6).max(20),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const trainer = await db.getUserById(ctx.user.id);
        if (!trainer) notFound("Trainer");

        const sortCode = toSanitizedDigits(input.sortCode);
        if (sortCode.length !== 6) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Sort code must be 6 digits." });
        }

        const accountNumber = toSanitizedDigits(input.accountNumber);
        if (accountNumber.length < 6 || accountNumber.length > 10) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Account number must be between 6 and 10 digits.",
          });
        }

        const nowIso = new Date().toISOString();
        const existingMetadata = toObjectRecord(trainer.metadata);
        const existingPayout = toObjectRecord(existingMetadata.payout);
        const existingBank = toObjectRecord(existingPayout.bank);
        const connectedAt =
          typeof existingBank.connectedAt === "string" && existingBank.connectedAt.trim().length > 0
            ? existingBank.connectedAt
            : nowIso;

        const nextMetadata = {
          ...existingMetadata,
          payout: {
            ...existingPayout,
            bank: {
              accountHolderName: input.accountHolderName.trim(),
              bankName: input.bankName.trim(),
              sortCode,
              accountNumber,
              accountNumberLast4: accountNumber.slice(-4),
              connectedAt,
              updatedAt: nowIso,
            },
          },
        };

        await db.updateUser(ctx.user.id, { metadata: nextMetadata });
        return { success: true };
      }),
  }),

  // ============================================================================
  // SHOPIFY (Product sync and bundle publishing)
  // ============================================================================
  shopify: router({
    products: trainerProcedure.query(async () => {
      const products = await db.getProducts();
      return products.map((p) => ({
        id: p.shopifyProductId || 0,
        title: p.name,
        description: p.description,
        vendor: p.brand,
        productType: p.category,
        status: p.availability === "available" ? "active" : "draft",
        price: p.price || "0.00",
        inventory: p.inventoryQuantity || 0,
        sku: "",
        imageUrl: p.imageUrl,
      }));
    }),

    product: managerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const product = await db.getProductByShopifyProductId(input.id);
        if (!product) return null;
        return {
          id: product.shopifyProductId || input.id,
          title: product.name,
          description: product.description,
          vendor: product.brand,
          productType: product.category,
          status: product.availability === "available" ? "active" : "draft",
          price: product.price || "0.00",
          inventory: product.inventoryQuantity || 0,
          sku: "",
          imageUrl: product.imageUrl,
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
