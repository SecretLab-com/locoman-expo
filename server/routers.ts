import { z } from "zod";
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
      .query(async ({ input }) => {
        return db.getBundleDraftById(input.id);
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateBundleDraft(id, data);
        return { success: true };
      }),

    submitForReview: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        await db.updateBundleDraft(input.id, { status: "draft" });
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
      .query(async ({ input }) => {
        return db.getClientById(input.id);
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
      .mutation(async ({ input }) => {
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
      .query(async ({ input }) => {
        // Get subscription with remaining sessions calculation
        const subs = await db.getSubscriptionsByClient(input.id);
        return subs[0];
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
        return db.createSubscription({
          clientId: input.clientId,
          trainerId: ctx.user.id,
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
      .query(async ({ input }) => {
        const sub = await db.getActiveSubscription(input.subscriptionId);
        if (!sub) return { included: 0, used: 0, remaining: 0 };
        const included = sub.sessionsIncluded || 0;
        const used = sub.sessionsUsed || 0;
        return { included, used, remaining: Math.max(0, included - used) };
      }),

    // Pause a subscription
    pause: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.updateSubscription(input.id, { status: "paused", pausedAt: new Date().toISOString() });
        return { success: true };
      }),

    // Resume a paused subscription
    resume: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.updateSubscription(input.id, { status: "active", pausedAt: null });
        return { success: true };
      }),

    // Cancel a subscription
    cancel: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
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
      // Would need to find client record first
      return [];
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
        return db.createSession({
          clientId: input.clientId,
          trainerId: ctx.user.id,
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
      .mutation(async ({ input }) => {
        await db.completeSession(input.id);
        return { success: true };
      }),

    cancel: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.updateSession(input.id, { status: "cancelled" });
        return { success: true };
      }),

    markNoShow: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
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

    get: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) return undefined;
        const items = await db.getOrderItems(input.id);
        return { ...order, items };
      }),

    // Update order status
    updateStatus: trainerProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateOrder(input.id, { status: input.status });
        return { success: true };
      }),

    // Update fulfillment status
    updateFulfillment: trainerProcedure
      .input(z.object({
        id: z.string(),
        fulfillmentStatus: z.enum(["unfulfilled", "partial", "fulfilled", "restocked"]),
      }))
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        await db.markDeliveryReady(input.id);
        const delivery = await db.getDeliveryById(input.id);
        if (delivery) {
          notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        }
        return { success: true };
      }),

    markDelivered: trainerProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.markDeliveryDelivered(input.id);
        const delivery = await db.getDeliveryById(input.id);
        if (delivery) {
          notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        }
        return { success: true };
      }),

    // Client confirms receipt
    confirmReceipt: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await db.confirmDeliveryReceipt(input.id);
        const delivery = await db.getDeliveryById(input.id);
        if (delivery) {
          notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        }
        return { success: true };
      }),

    // Client reports issue
    reportIssue: protectedProcedure
      .input(z.object({
        id: z.string(),
        reason: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updateDelivery(input.id, {
          status: "disputed",
          disputeReason: input.reason,
        });
        const delivery = await db.getDeliveryById(input.id);
        if (delivery) {
          notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        }
        return { success: true };
      }),

    // Client requests reschedule
    requestReschedule: protectedProcedure
      .input(z.object({
        id: z.string(),
        requestedDate: z.string(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateDelivery(input.id, {
          clientNotes: input.reason ? `Reschedule requested: ${input.reason}` : "Reschedule requested",
        });
        // Note: In a full implementation, we'd add rescheduleRequestedDate field
        const delivery = await db.getDeliveryById(input.id);
        if (delivery) {
          notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        }
        return { success: true };
      }),

    // Trainer approves reschedule
    approveReschedule: trainerProcedure
      .input(z.object({
        id: z.string(),
        newDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updateDelivery(input.id, {
          scheduledDate: new Date(input.newDate).toISOString(),
          clientNotes: null, // Clear the reschedule request
        });
        const delivery = await db.getDeliveryById(input.id);
        if (delivery) {
          notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        }
        return { success: true };
      }),

    // Trainer rejects reschedule
    rejectReschedule: trainerProcedure
      .input(z.object({
        id: z.string(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateDelivery(input.id, {
          notes: input.reason ? `Reschedule rejected: ${input.reason}` : "Reschedule rejected",
          clientNotes: null, // Clear the reschedule request
        });
        const delivery = await db.getDeliveryById(input.id);
        if (delivery) {
          notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        }
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
        const deliveryIds: string[] = [];
        for (const product of input.products) {
          const id = await db.createDelivery({
            orderId: input.orderId,
            trainerId: ctx.user.id,
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
      .query(async ({ input }) => {
        return db.getMessagesByConversation(input.conversationId);
      }),

    send: protectedProcedure
      .input(z.object({
        receiverId: z.string(),
        content: z.string().min(1),
        conversationId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
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
      .mutation(async ({ input }) => {
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
      .query(async ({ input }) => {
        return db.getMessageReactions(input.messageId);
      }),

    // Add reaction to a message
    addReaction: protectedProcedure
      .input(z.object({
        messageId: z.string(),
        reaction: z.string().max(32),
      }))
      .mutation(async ({ ctx, input }) => {
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
        await db.removeMessageReaction(input.messageId, ctx.user.id, input.reaction);
        return { success: true };
      }),

    // Get all reactions for messages in a conversation
    getConversationReactions: protectedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ input }) => {
        return db.getConversationReactions(input.conversationId);
      }),

    // Upload attachment for message
    uploadAttachment: protectedProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded
        mimeType: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Generate unique key with user ID and timestamp
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const ext = input.fileName.split(".").pop() || "bin";
        const key = `messages/${ctx.user.id}/${timestamp}-${randomSuffix}.${ext}`;

        // Decode base64 and upload
        const buffer = Buffer.from(input.fileData, "base64");
        const { url } = await storagePut(key, buffer, input.mimeType);

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
        await db.updateBundleDraft(input.id, {
          status: "published",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
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
        await db.updateBundleDraft(input.id, {
          status: "rejected",
          reviewedAt: new Date().toISOString(),
          reviewedBy: ctx.user.id,
          rejectionReason: input.reason,
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
    createTemplate: managerProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        goalType: z.enum(["weight_loss", "strength", "longevity", "power"]).optional(),
        basePrice: z.string().optional(),
        defaultServices: z.any().optional(),
        defaultProducts: z.any().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createBundleTemplate({
          ...input,
          createdBy: ctx.user.id,
        });
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
      if (totalPoints >= 5000) statusTier = "Platinum";
      else if (totalPoints >= 2000) statusTier = "Gold";
      else if (totalPoints >= 1000) statusTier = "Silver";

      return { totalPoints, statusTier };
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
