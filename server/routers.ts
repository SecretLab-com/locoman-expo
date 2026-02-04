import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { generateImage } from "./_core/imageGeneration";
import { systemRouter } from "./_core/systemRouter";
import { coordinatorProcedure, managerProcedure, protectedProcedure, publicProcedure, router, trainerProcedure } from "./_core/trpc";
import { notifyBadgeCounts } from "./_core/websocket";
import * as db from "./db";
import * as shopify from "./shopify";
import { storagePut } from "./storage";

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
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getBundleDraftById(input.id);
      }),

    trainers: publicProcedure.query(async () => {
      return db.getTrainers();
    }),

    trainerProfile: publicProcedure
      .input(z.object({ id: z.number() }))
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
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getBundleDraftById(input.id);
      }),

    create: trainerProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        templateId: z.number().optional(),
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
        id: z.number(),
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
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateBundleDraft(input.id, {
          status: "pending_review",
          submittedForReviewAt: new Date(),
        });
        const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    templates: trainerProcedure.query(async () => {
      return db.getBundleTemplates();
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
      .input(z.object({ id: z.number() }))
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
        id: z.number(),
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
        bundleDraftId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
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
        bundleDraftId: z.number().optional(),
        message: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = [];
        for (const invite of input.invitations) {
          const token = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
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
    // Client gets their subscriptions
    mySubscriptions: protectedProcedure.query(async ({ ctx }) => {
      // Find client record for this user
      const clients = await db.getClientsByTrainer(0); // This needs adjustment
      // For now, return subscriptions where user is the client
      return [];
    }),

    // Trainer gets subscriptions for their clients
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getSubscriptionsByTrainer(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db2 = await db.getDb();
        if (!db2) return undefined;
        // Get subscription with remaining sessions calculation
        const subs = await db.getSubscriptionsByClient(input.id);
        return subs[0];
      }),

    create: trainerProcedure
      .input(z.object({
        clientId: z.number(),
        bundleDraftId: z.number().optional(),
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
          startDate: input.startDate || new Date(),
        });
      }),

    // Get session usage stats for a subscription
    sessionStats: protectedProcedure
      .input(z.object({ subscriptionId: z.number() }))
      .query(async ({ input }) => {
        const db2 = await db.getDb();
        if (!db2) return { included: 0, used: 0, remaining: 0 };

        // This would need to query the subscription
        return { included: 10, used: 3, remaining: 7 };
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
        clientId: z.number(),
        subscriptionId: z.number().optional(),
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
          sessionDate: input.sessionDate,
          durationMinutes: input.durationMinutes,
          sessionType: input.sessionType,
          location: input.location,
          notes: input.notes,
        });
      }),

    // Mark session as completed - this increments the usage count
    complete: trainerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.completeSession(input.id);
        return { success: true };
      }),

    cancel: trainerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateSession(input.id, { status: "cancelled" });
        return { success: true };
      }),

    markNoShow: trainerProcedure
      .input(z.object({ id: z.number() }))
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
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) return undefined;
        const items = await db.getOrderItems(input.id);
        return { ...order, items };
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
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markDeliveryReady(input.id);
        const delivery = await db.getDeliveryById(input.id);
        if (delivery) {
          notifyBadgeCounts([delivery.trainerId, delivery.clientId]);
        }
        return { success: true };
      }),

    markDelivered: trainerProcedure
      .input(z.object({ id: z.number() }))
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
      .input(z.object({ id: z.number() }))
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
        id: z.number(),
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
        id: z.number(),
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
        id: z.number(),
        newDate: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.updateDelivery(input.id, {
          scheduledDate: new Date(input.newDate),
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
        id: z.number(),
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
        orderId: z.number(),
        clientId: z.number(),
        products: z.array(z.object({
          productId: z.number().optional(),
          productName: z.string(),
          quantity: z.number(),
        })),
        scheduledDate: z.string().optional(),
        deliveryMethod: z.enum(["in_person", "locker", "front_desk", "shipped"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const deliveryIds: number[] = [];
        for (const product of input.products) {
          const id = await db.createDelivery({
            orderId: input.orderId,
            trainerId: ctx.user.id,
            clientId: input.clientId,
            productId: product.productId,
            productName: product.productName,
            quantity: product.quantity,
            status: "pending",
            scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : undefined,
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
        receiverId: z.number(),
        content: z.string().min(1),
        conversationId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Generate conversation ID if not provided
        const conversationId = input.conversationId ||
          [ctx.user.id, input.receiverId].sort().join("-");

        return db.createMessage({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          conversationId,
          content: input.content,
        });
      }),

    sendGroup: protectedProcedure
      .input(z.object({
        receiverIds: z.array(z.number()).min(1),
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
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markMessageRead(input.id);
        return { success: true };
      }),

    // Send message with attachment
    sendWithAttachment: protectedProcedure
      .input(z.object({
        receiverId: z.number(),
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

        return db.createMessage({
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
      }),

    sendGroupWithAttachment: protectedProcedure
      .input(z.object({
        receiverIds: z.array(z.number()).min(1),
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
      .input(z.object({ messageId: z.number() }))
      .query(async ({ input }) => {
        return db.getMessageReactions(input.messageId);
      }),

    // Add reaction to a message
    addReaction: protectedProcedure
      .input(z.object({
        messageId: z.number(),
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
        messageId: z.number(),
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
        relatedClientId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createCalendarEvent({
          userId: ctx.user.id,
          ...input,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        location: z.string().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCalendarEvent(id, data);
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
      .input(z.object({ trainerId: z.number() }))
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
        trainerId: z.number(),
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
      .input(z.object({ requestId: z.number() }))
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
        userId: z.number(),
        role: z.enum(["shopper", "client", "trainer", "manager", "coordinator"]),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        return { success: true };
      }),

    updateUserStatus: managerProcedure
      .input(z.object({
        userId: z.number(),
        active: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserStatus(input.userId, input.active);
        return { success: true };
      }),

    bulkUpdateRole: managerProcedure
      .input(z.object({
        userIds: z.array(z.number()).min(1),
        role: z.enum(["shopper", "client", "trainer", "manager", "coordinator"]),
      }))
      .mutation(async ({ input }) => {
        await db.bulkUpdateUserRole(input.userIds, input.role);
        return { success: true, count: input.userIds.length };
      }),

    bulkUpdateStatus: managerProcedure
      .input(z.object({
        userIds: z.array(z.number()).min(1),
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
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateBundleDraft(input.id, {
          status: "published",
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
        });
        const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    rejectBundle: managerProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateBundleDraft(input.id, {
          status: "rejected",
          reviewedAt: new Date(),
          reviewedBy: ctx.user.id,
          rejectionReason: input.reason,
        });
        const managerIds = await db.getUserIdsByRoles(["manager", "coordinator"]);
        notifyBadgeCounts(managerIds);
        return { success: true };
      }),

    requestChanges: managerProcedure
      .input(z.object({
        id: z.number(),
        comments: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateBundleDraft(input.id, {
          status: "changes_requested",
          reviewedAt: new Date(),
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
      .input(z.object({ userId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getUserActivityLogs(input.userId, input.limit);
      }),

    getRecentActivityLogs: managerProcedure
      .input(z.object({ limit: z.number().default(100) }))
      .query(async ({ input }) => {
        return db.getRecentActivityLogs(input.limit);
      }),

    logUserAction: managerProcedure
      .input(z.object({
        targetUserId: z.number(),
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
      .input(z.object({ userId: z.number() }))
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
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

        const id = await db.createUserInvitation({
          invitedBy: ctx.user.id,
          email: input.email,
          name: input.name,
          role: input.role,
          token,
          expiresAt,
        });

        // Log the invitation
        await db.logUserActivity({
          targetUserId: 0, // No target user yet
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
      .input(z.object({ id: z.number() }))
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
      .input(z.object({ userId: z.number() }))
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
          entityId: input.userId,
          details: { targetUserName: targetUser.name },
        });
        // Return target user info for client to use
        return { targetUser };
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
        bundleId: z.number(),
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
