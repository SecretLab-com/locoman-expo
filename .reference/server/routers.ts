import { COOKIE_NAME, IMPERSONATE_ADMIN_COOKIE, IMPERSONATE_STARTED_AT_COOKIE } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import cookie from "cookie";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as shopify from "./shopify";
import * as bundleImageGenerator from "./bundleImageGenerator";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";

// Role-based procedure helpers
const trainerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["trainer", "manager", "coordinator"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Trainer access required" });
  }
  return next({ ctx });
});

const managerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["manager", "coordinator"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager access required" });
  }
  return next({ ctx });
});

const clientProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!["client", "trainer", "manager", "coordinator"].includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Client access required" });
  }
  return next({ ctx });
});

const coordinatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  // For impersonation routes, we need to check the REAL admin user if impersonating
  const userToCheck = ctx.realAdminUser || ctx.user;
  if (userToCheck.role !== "coordinator") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Coordinator access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => {
      // Return null if user is not authenticated
      if (!opts.ctx.user) {
        return null;
      }
      return {
        ...opts.ctx.user,
        isImpersonating: opts.ctx.isImpersonating,
        realAdminUser: opts.ctx.realAdminUser ? {
          id: opts.ctx.realAdminUser.id,
          name: opts.ctx.realAdminUser.name,
          email: opts.ctx.realAdminUser.email,
          role: opts.ctx.realAdminUser.role,
        } : null,
      };
    }),
    // Get the session token for cross-origin iframe authentication
    // This allows the Expo app (in iframe) to get the token and use it for API calls
    getSessionToken: publicProcedure.query(({ ctx }) => {
      // Get the session cookie from the request
      const cookies = cookie.parse(ctx.req.headers.cookie || "");
      const sessionToken = cookies[COOKIE_NAME];
      
      // Only return the token if the user is authenticated
      if (!ctx.user || !sessionToken) {
        return { token: null };
      }
      
      return { token: sessionToken };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      // Get the session cookie before clearing it
      const cookies = cookie.parse(ctx.req.headers.cookie || "");
      const sessionToken = cookies[COOKIE_NAME];
      
      // Revoke the session server-side (add to blacklist)
      if (sessionToken) {
        console.log("[Auth] Logout - revoking session token, length:", sessionToken.length);
        console.log("[Auth] Logout - token hash will be:", db.hashSessionToken(sessionToken));
        try {
          await db.revokeSession(
            sessionToken,
            ctx.user?.id,
            // Token expires 1 year from now (matches session lifetime)
            new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          );
        } catch (error) {
          console.error("[Auth] Failed to revoke session:", error);
          // Continue with logout even if revocation fails
        }
      }
      
      // Clear cookies on the client side
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const clearOptions = { 
        ...cookieOptions, 
        maxAge: 0,
        expires: new Date(0)
      };
      ctx.res.clearCookie(COOKIE_NAME, clearOptions);
      ctx.res.clearCookie(IMPERSONATE_ADMIN_COOKIE, clearOptions);
      ctx.res.clearCookie(IMPERSONATE_STARTED_AT_COOKIE, clearOptions);
      return { success: true } as const;
    }),
    updateRole: managerProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["shopper", "client", "trainer", "manager", "coordinator"]) }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role);
        
        // Auto-generate username when promoting to trainer
        if (input.role === "trainer") {
          const user = await db.getUserById(input.userId);
          if (user && !user.username && user.name) {
            await db.ensureUserHasUsername(input.userId, user.name);
          }
        }
        
        return { success: true };
      }),
    
    // Refresh the session token (returns a new token with extended expiration)
    refreshToken: protectedProcedure.mutation(async ({ ctx }) => {
      // Create a new session token with the same user info
      const newToken = await sdk.createSessionToken(ctx.user.openId, {
        name: ctx.user.name || "",
      });
      
      // Set the new session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, newToken, cookieOptions);
      
      return {
        success: true,
        token: newToken,
      };
    }),

    // User registration with email/password
    register: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(1, "Name is required"),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if email is already registered
        const existingUser = await db.getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "An account with this email already exists",
          });
        }
        
        // Create the user
        const userId = await db.createUserWithPassword({
          email: input.email,
          password: input.password,
          name: input.name,
          role: "shopper", // Default role for new registrations
        });
        
        if (!userId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create account",
          });
        }
        
        // Get the created user
        const user = await db.getUserById(userId);
        if (!user) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to retrieve created account",
          });
        }
        
        // Create a session token for the user (auto-login after registration)
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
        });
        
        // Set the session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
        
        return {
          success: true,
          token: sessionToken,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
      }),

    // Email/password login
    loginWithPassword: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.authenticateWithPassword(input.email, input.password);
        
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }
        
        // Create a session token for the user
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
        });
        
        // Set the session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
        
        return {
          success: true,
          token: sessionToken, // Return token for cross-origin use (Expo app)
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
      }),
  }),

  // ============================================================================
  // IMPERSONATION (Coordinator only - for testing)
  // ============================================================================
  impersonate: router({
    // Get current impersonation status
    status: publicProcedure.query(({ ctx }) => {
      return {
        isImpersonating: ctx.isImpersonating,
        impersonatedUser: ctx.isImpersonating ? {
          id: ctx.user?.id,
          name: ctx.user?.name,
          email: ctx.user?.email,
          role: ctx.user?.role,
        } : null,
        realAdminUser: ctx.realAdminUser ? {
          id: ctx.realAdminUser.id,
          name: ctx.realAdminUser.name,
          email: ctx.realAdminUser.email,
        } : null,
        startedAt: ctx.impersonationStartedAt || null,
      };
    }),

    // List all users for impersonation selection
    listUsers: coordinatorProcedure
      .input(z.object({
        search: z.string().optional(),
        role: z.enum(["all", "shopper", "client", "trainer", "manager", "coordinator"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }).optional())
      .query(async ({ input }) => {
        const { search, role, limit = 50, offset = 0 } = input || {};
        const users = await db.getAllUsers();
        
        let filtered = users;
        
        // Filter by role
        if (role && role !== "all") {
          filtered = filtered.filter(u => u.role === role);
        }
        
        // Filter by search term (name or email)
        if (search && search.trim()) {
          const searchLower = search.toLowerCase().trim();
          filtered = filtered.filter(u => 
            (u.name?.toLowerCase().includes(searchLower)) ||
            (u.email?.toLowerCase().includes(searchLower)) ||
            (u.username?.toLowerCase().includes(searchLower))
          );
        }
        
        // Sort by role priority then name
        const rolePriority: Record<string, number> = { coordinator: 0, manager: 1, trainer: 2, client: 3, shopper: 4 };
        filtered.sort((a, b) => {
          const roleCompare = (rolePriority[a.role] || 5) - (rolePriority[b.role] || 5);
          if (roleCompare !== 0) return roleCompare;
          return (a.name || "").localeCompare(b.name || "");
        });
        
        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);
        
        return {
          users: paginated.map(u => ({
            id: u.id,
            openId: u.openId,
            name: u.name,
            email: u.email,
            role: u.role,
            username: u.username,
            photoUrl: u.photoUrl,
            createdAt: u.createdAt,
            lastSignedIn: u.lastSignedIn,
          })),
          total,
          hasMore: offset + limit < total,
        };
      }),

    // Start impersonating a user
    start: coordinatorProcedure
      .input(z.object({ userId: z.number(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }

        // Get the current admin's session cookie to store
        const cookies = cookie.parse(ctx.req.headers.cookie || "");
        const currentSession = cookies[COOKIE_NAME];
        
        if (!currentSession) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "No active session" });
        }

        // Create a new session token for the target user
        const newSessionToken = await sdk.createSessionToken(targetUser.openId, {
          name: targetUser.name || "",
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        
        // Store the admin's original session in the impersonation cookie
        ctx.res.cookie(IMPERSONATE_ADMIN_COOKIE, currentSession, {
          ...cookieOptions,
          maxAge: 1000 * 60 * 60 * 4, // 4 hours max impersonation
        });
        
        // Store the impersonation start time
        ctx.res.cookie(IMPERSONATE_STARTED_AT_COOKIE, new Date().toISOString(), {
          ...cookieOptions,
          maxAge: 1000 * 60 * 60 * 4, // 4 hours max impersonation
        });
        
        // Set the main session cookie to the impersonated user
        ctx.res.cookie(COOKIE_NAME, newSessionToken, cookieOptions);

        // Log the impersonation start
        await db.createImpersonationLog({
          adminUserId: ctx.user.id,
          targetUserId: targetUser.id,
          action: "start",
          mode: "user",
          ipAddress: ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString() || null,
          userAgent: ctx.req.headers["user-agent"] || null,
          notes: input.notes || null,
        });

        console.log(`[Impersonation] Admin ${ctx.user.name} (${ctx.user.id}) started impersonating ${targetUser.name} (${targetUser.id})`);

        return {
          success: true,
          impersonatedUser: {
            id: targetUser.id,
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
          },
        };
      }),

    // Stop impersonating and restore admin session
    stop: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.isImpersonating || !ctx.realAdminUser) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not currently impersonating" });
      }

      // Get the stored admin session
      const cookies = cookie.parse(ctx.req.headers.cookie || "");
      const adminSession = cookies[IMPERSONATE_ADMIN_COOKIE];
      
      if (!adminSession) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Admin session not found" });
      }

      const cookieOptions = getSessionCookieOptions(ctx.req);
      
      // Restore the admin session to the main cookie
      ctx.res.cookie(COOKIE_NAME, adminSession, cookieOptions);
      
      // Clear the impersonation cookies
      ctx.res.clearCookie(IMPERSONATE_ADMIN_COOKIE, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(IMPERSONATE_STARTED_AT_COOKIE, { ...cookieOptions, maxAge: -1 });

      // Log the impersonation stop
      await db.createImpersonationLog({
        adminUserId: ctx.realAdminUser.id,
        targetUserId: ctx.user?.id || null,
        action: "stop",
        mode: "user",
        ipAddress: ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString() || null,
        userAgent: ctx.req.headers["user-agent"] || null,
      });

      console.log(`[Impersonation] Admin ${ctx.realAdminUser.name} (${ctx.realAdminUser.id}) stopped impersonating ${ctx.user?.name} (${ctx.user?.id})`);

      return {
        success: true,
        restoredUser: {
          id: ctx.realAdminUser.id,
          name: ctx.realAdminUser.name,
          email: ctx.realAdminUser.email,
          role: ctx.realAdminUser.role,
        },
      };
    }),

    // Get audit logs
    logs: coordinatorProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const logs = await db.getImpersonationLogs({
          limit: input?.limit || 50,
          offset: input?.offset || 0,
        });
        const total = await db.getImpersonationLogCount();
        return { logs, total };
      }),

    // Get shortcuts for current admin
    shortcuts: coordinatorProcedure.query(async ({ ctx }) => {
      const adminId = ctx.realAdminUser?.id || ctx.user.id;
      return db.getImpersonationShortcuts(adminId);
    }),

    // Get recent impersonated users for quick-switch
    recentUsers: coordinatorProcedure
      .input(z.object({ limit: z.number().min(1).max(10).optional() }).optional())
      .query(async ({ input, ctx }) => {
        const adminId = ctx.realAdminUser?.id || ctx.user.id;
        const recent = await db.getRecentImpersonatedUsers(adminId, input?.limit || 5);
        return recent.map(r => ({
          id: r.user!.id,
          name: r.user!.name,
          email: r.user!.email,
          role: r.user!.role,
          photoUrl: r.user!.photoUrl,
          lastImpersonated: r.lastImpersonated,
        }));
      }),

    // Add a shortcut
    addShortcut: coordinatorProcedure
      .input(z.object({ userId: z.number(), label: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const adminId = ctx.realAdminUser?.id || ctx.user.id;
        const id = await db.createImpersonationShortcut({
          adminUserId: adminId,
          targetUserId: input.userId,
          label: input.label || null,
        });
        return { success: true, id };
      }),

    // Remove a shortcut
    removeShortcut: coordinatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const adminId = ctx.realAdminUser?.id || ctx.user.id;
        await db.deleteImpersonationShortcut(input.id, adminId);
        return { success: true };
      }),

    // Start role simulation (without specific user)
    startRoleSimulation: coordinatorProcedure
      .input(z.object({ role: z.enum(["shopper", "client", "trainer", "manager"]) }))
      .mutation(async ({ input, ctx }) => {
        // Find a user with this role to impersonate
        const users = await db.getAllUsers();
        const targetUser = users.find(u => u.role === input.role);
        
        if (!targetUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: `No ${input.role} user found to simulate` });
        }

        // Get the current admin's session cookie to store
        const cookies = cookie.parse(ctx.req.headers.cookie || "");
        const currentSession = cookies[COOKIE_NAME];
        
        if (!currentSession) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "No active session" });
        }

        // Create a new session token for the target user
        const newSessionToken = await sdk.createSessionToken(targetUser.openId, {
          name: targetUser.name || "",
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        
        // Store the admin's original session in the impersonation cookie
        ctx.res.cookie(IMPERSONATE_ADMIN_COOKIE, currentSession, {
          ...cookieOptions,
          maxAge: 1000 * 60 * 60 * 4, // 4 hours max
        });
        
        // Set the main session cookie to the impersonated user
        ctx.res.cookie(COOKIE_NAME, newSessionToken, cookieOptions);

        // Log the role simulation
        await db.createImpersonationLog({
          adminUserId: ctx.user.id,
          targetUserId: targetUser.id,
          targetRole: input.role,
          action: "start",
          mode: "role",
          ipAddress: ctx.req.ip || ctx.req.headers["x-forwarded-for"]?.toString() || null,
          userAgent: ctx.req.headers["user-agent"] || null,
          notes: `Role simulation: ${input.role}`,
        });

        return {
          success: true,
          role: input.role,
          impersonatedUser: {
            id: targetUser.id,
            name: targetUser.name,
            email: targetUser.email,
            role: targetUser.role,
          },
        };
      }),
  }),

  // ============================================================================
  // BUNDLE TEMPLATES (Manager)
  // ============================================================================
  templates: router({
    list: publicProcedure.query(async () => {
      return db.getBundleTemplates(false);
    }),
    listActive: publicProcedure.query(async () => {
      return db.getBundleTemplates(true);
    }),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getBundleTemplateById(input.id);
    }),
    create: managerProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          goalType: z.enum(["weight_loss", "strength", "longevity", "power"]).optional(),
          goalsJson: z.array(z.string()).optional(),
          basePrice: z.string().optional(),
          minPrice: z.string().optional(),
          maxPrice: z.string().optional(),
          rulesJson: z.any().optional(),
          defaultServices: z.any().optional(),
          defaultProducts: z.any().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = await db.createBundleTemplate({
          ...input,
          createdBy: ctx.user.id,
        });
        
        // Generate cover image if products are provided
        if (input.defaultProducts && Array.isArray(input.defaultProducts) && input.defaultProducts.length > 0) {
          try {
            const products = input.defaultProducts.map((p: { name?: string; title?: string; imageUrl?: string }) => ({
              name: p.name || p.title || "Product",
              imageUrl: p.imageUrl,
            }));
            const result = await bundleImageGenerator.generateBundleCoverImage({
              bundleId: id,
              title: input.title,
              products,
              goalType: input.goalType,
            });
            if (result.imageUrl) {
              await db.updateBundleTemplate(id, { imageUrl: result.imageUrl });
            }
          } catch (error) {
            console.error("[Template] Failed to generate cover image:", error);
          }
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "template_created",
          entityType: "bundle_template",
          entityId: id,
        });
        return { id };
      }),
    update: managerProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          goalType: z.enum(["weight_loss", "strength", "longevity", "power"]).optional(),
          goalsJson: z.array(z.string()).optional(),
          basePrice: z.string().optional(),
          minPrice: z.string().optional(),
          maxPrice: z.string().optional(),
          rulesJson: z.any().optional(),
          defaultServices: z.any().optional(),
          defaultProducts: z.any().optional(),
          active: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        
        // Check if products changed - regenerate cover image
        if (input.defaultProducts && Array.isArray(input.defaultProducts) && input.defaultProducts.length > 0) {
          try {
            // Get existing template to check for title and goalType
            const existingTemplate = await db.getBundleTemplateById(id);
            const title = input.title || existingTemplate?.title || "Bundle";
            const goalType = input.goalType || existingTemplate?.goalType || "strength";
            
            const products = input.defaultProducts.map((p: { name?: string; title?: string; imageUrl?: string }) => ({
              name: p.name || p.title || "Product",
              imageUrl: p.imageUrl,
            }));
            const result = await bundleImageGenerator.generateBundleCoverImage({
              bundleId: id,
              title,
              products,
              goalType,
              forceRegenerate: true,
            });
            if (result.imageUrl) {
              (data as { imageUrl?: string }).imageUrl = result.imageUrl;
            }
          } catch (error) {
            console.error("[Template] Failed to regenerate cover image:", error);
          }
        }
        
        await db.updateBundleTemplate(id, data);
        await db.logActivity({
          userId: ctx.user.id,
          action: "template_updated",
          entityType: "bundle_template",
          entityId: id,
        });
        return { success: true };
      }),
    delete: managerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.deleteBundleTemplate(input.id);
      await db.logActivity({
        userId: ctx.user.id,
        action: "template_deleted",
        entityType: "bundle_template",
        entityId: input.id,
      });
      return { success: true };
    }),
    regenerateImage: managerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const template = await db.getBundleTemplateById(input.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND" });
        
        // Get products from template
        const products = template.defaultProducts && Array.isArray(template.defaultProducts)
          ? (template.defaultProducts as Array<{ name?: string; title?: string; imageUrl?: string }>).map((p) => ({
              name: p.name || p.title || "Product",
              imageUrl: p.imageUrl,
            }))
          : [];
        
        if (products.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No products to generate image from" });
        }
        
        const result = await bundleImageGenerator.generateBundleCoverImage({
          bundleId: input.id,
          title: template.title,
          products,
          goalType: template.goalType || "strength",
          forceRegenerate: true,
        });
        
        if (!result.imageUrl) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate image" });
        }
        
        await db.updateBundleTemplate(input.id, { imageUrl: result.imageUrl });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "template_image_regenerated",
          entityType: "bundle_template",
          entityId: input.id,
        });
        
        return { imageUrl: result.imageUrl };
      }),
  }),

  // ============================================================================
  // BUNDLE DRAFTS (Trainer)
  // ============================================================================
  bundles: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getBundleDraftsByTrainer(ctx.user.id);
    }),
    get: trainerProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const draft = await db.getBundleDraftById(input.id);
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.trainerId !== ctx.user.id && !["manager", "coordinator"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return draft;
    }),
    create: trainerProcedure
      .input(
        z.object({
          templateId: z.number().optional(),
          title: z.string().min(1),
          description: z.string().optional(),
          price: z.string().optional(),
          cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
          productsJson: z.any().optional(),
          servicesJson: z.any().optional(),
          goalsJson: z.array(z.string()).optional(),
          suggestedGoal: z.string().optional(),
          imageSource: z.enum(["ai", "custom"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = await db.createBundleDraft({
          ...input,
          trainerId: ctx.user.id,
          status: "draft",
        });
        
        // Auto-generate cover image in background
        let imageUrl: string | undefined;
        if (input.productsJson) {
          try {
            const products = bundleImageGenerator.extractProductsFromBundle(input.productsJson);
            if (products.length > 0) {
              // Get goal type from template if available
              let goalType: string | null = null;
              if (input.templateId) {
                const template = await db.getBundleTemplateById(input.templateId);
                goalType = template?.goalType || null;
              }
              
              const result = await bundleImageGenerator.generateBundleCoverImage({
                bundleId: id,
                title: input.title,
                products,
                goalType,
              });
              imageUrl = result.imageUrl;
            }
          } catch (error) {
            console.error("[Bundles] Failed to generate cover image:", error);
            // Continue without image - don't fail the bundle creation
          }
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_created",
          entityType: "bundle_draft",
          entityId: id,
        });
        return { id, imageUrl };
      }),
    update: trainerProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().min(1).optional(),
          description: z.string().optional(),
          price: z.string().optional(),
          cadence: z.enum(["one_time", "weekly", "monthly"]).optional(),
          productsJson: z.any().optional(),
          servicesJson: z.any().optional(),
          goalsJson: z.array(z.string()).optional(),
          suggestedGoal: z.string().optional(),
          status: z.enum(["draft", "validating", "ready"]).optional(),
          imageSource: z.enum(["ai", "custom"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...inputData } = input;
        const draft = await db.getBundleDraftById(id);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
        if (draft.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        
        // Build update data with optional imageUrl
        const updateData: Record<string, unknown> = { ...inputData };
        
        // If bundle is published, set to pending_update and save snapshot
        if (draft.status === "published") {
          // Save current published state as snapshot for comparison
          const snapshot = {
            title: draft.title,
            description: draft.description,
            price: draft.price,
            productsJson: draft.productsJson,
            servicesJson: draft.servicesJson,
            imageUrl: draft.imageUrl,
          };
          updateData.status = "pending_update";
          updateData.publishedSnapshot = snapshot;
          updateData.submittedForReviewAt = new Date();
        }
        
        // Check if products changed and regenerate image if needed
        let imageUrl: string | undefined;
        if (input.productsJson) {
          const oldProducts = bundleImageGenerator.extractProductsFromBundle(draft.productsJson);
          const newProducts = bundleImageGenerator.extractProductsFromBundle(input.productsJson);
          
          if (bundleImageGenerator.shouldRegenerateImage(oldProducts, newProducts)) {
            try {
              // Get goal type from template if available
              let goalType: string | null = null;
              if (draft.templateId) {
                const template = await db.getBundleTemplateById(draft.templateId);
                goalType = template?.goalType || null;
              }
              
              const result = await bundleImageGenerator.generateBundleCoverImage({
                bundleId: id,
                title: input.title || draft.title,
                products: newProducts,
                goalType,
              });
              imageUrl = result.imageUrl;
              updateData.imageUrl = imageUrl;
            } catch (error) {
              console.error("[Bundles] Failed to regenerate cover image:", error);
              // Continue without updating image
            }
          }
        }
        
        await db.updateBundleDraft(id, updateData);
        return { success: true, imageUrl };
      }),
    
    // Manual image regeneration
    regenerateImage: trainerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const draft = await db.getBundleDraftById(input.id);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
        if (draft.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        
        const result = await bundleImageGenerator.generateImageForBundle(input.id);
        if (!result) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate image" });
        }
        
        return { imageUrl: result.imageUrl };
      }),
    
    // Upload custom cover image
    uploadCoverImage: trainerProcedure
      .input(z.object({
        id: z.number(),
        imageData: z.string(), // Base64 encoded image
        fileName: z.string(),
        mimeType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const draft = await db.getBundleDraftById(input.id);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
        if (draft.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        
        // Extract base64 data (remove data URL prefix if present)
        const base64Data = input.imageData.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Generate unique file key
        const ext = input.fileName.split('.').pop() || 'jpg';
        const fileKey = `bundles/${input.id}/cover-${Date.now()}.${ext}`;
        
        // Upload to S3
        const { storagePut } = await import("./storage");
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Update bundle with new image URL
        await db.updateBundleDraft(input.id, { imageUrl: url });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_cover_uploaded",
          entityType: "bundle_draft",
          entityId: input.id,
        });
        
        return { imageUrl: url };
      }),
    
    // Image Library endpoints
    imageLibrary: trainerProcedure.query(async ({ ctx }) => {
      return db.getBundleCoverLibrary(ctx.user.id);
    }),
    
    saveToLibrary: trainerProcedure
      .input(z.object({
        url: z.string(),
        fileKey: z.string().optional(),
        title: z.string().optional(),
        mimeType: z.string().optional(),
        fileSize: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.saveToBundleCoverLibrary(ctx.user.id, input);
        if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save to library" });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "image_saved_to_library",
          entityType: "trainer_media",
          entityId: id,
        });
        
        return { id };
      }),
    
    deleteFromLibrary: trainerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.deleteFromBundleCoverLibrary(input.id, ctx.user.id);
        if (!result) throw new TRPCError({ code: "NOT_FOUND" });
        
        // Note: S3 file deletion not implemented - files remain in storage
        // This is acceptable as S3 storage is cheap and we may want to recover images
        if (result.fileKey) {
          console.log("Image removed from library, S3 file retained:", result.fileKey);
        }
        
        return { success: true };
      }),
    
    libraryCount: trainerProcedure.query(async ({ ctx }) => {
      return db.countBundleCoverLibrary(ctx.user.id);
    }),
    
    // Image Analytics endpoints
    imageInsights: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerImageInsights(ctx.user.id);
    }),
    
    imageRecommendations: trainerProcedure.query(async ({ ctx }) => {
      return db.getImageRecommendations(ctx.user.id);
    }),
    
    imagePerformanceComparison: trainerProcedure.query(async () => {
      return db.getImagePerformanceComparison();
    }),
    
    // Tag Colors endpoints
    getTagColors: publicProcedure
      .input(z.object({ category: z.enum(["goal", "service"]).optional() }).optional())
      .query(async ({ input }) => {
        return db.getTagColors(input?.category);
      }),
    
    getOrCreateTagColor: trainerProcedure
      .input(z.object({
        tag: z.string(),
        category: z.enum(["goal", "service"]),
        label: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.getOrCreateTagColor(input.tag, input.category, input.label, input.color);
      }),

    updateTagColor: managerProcedure
      .input(z.object({
        id: z.number(),
        label: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.updateTagColor(input.id, { label: input.label, color: input.color });
      }),

    deleteTagColor: managerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.deleteTagColor(input.id);
      }),
    
    topPerformingImages: trainerProcedure.query(async ({ ctx }) => {
      return db.getTopPerformingImageStyles(ctx.user.id);
    }),
    
    updateImageAnalytics: trainerProcedure
      .input(z.object({
        bundleId: z.number(),
        analytics: z.object({
          colorPalette: z.array(z.string()),
          hasText: z.boolean(),
          style: z.enum(['photo', 'illustration', 'graphic', 'collage', 'ai_generated']),
          brightness: z.enum(['dark', 'medium', 'light']),
          hasProducts: z.boolean(),
          hasPerson: z.boolean(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const draft = await db.getBundleDraftById(input.bundleId);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
        if (draft.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        
        await db.updateImageAnalytics(input.bundleId, input.analytics);
        return { success: true };
      }),
    
    delete: trainerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const draft = await db.getBundleDraftById(input.id);
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.deleteBundleDraft(input.id);
      return { success: true };
    }),
    // Submit bundle for admin approval
    submitForReview: trainerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const draft = await db.getBundleDraftById(input.id);
        if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
        if (draft.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        
        // Only drafts can be submitted for review
        if (draft.status !== "draft" && draft.status !== "rejected") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only draft or rejected bundles can be submitted for review" });
        }
        
        await db.updateBundleDraft(input.id, {
          status: "pending_review",
          submittedForReviewAt: new Date(),
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_submitted_for_review",
          entityType: "bundle_draft",
          entityId: input.id,
        });
        
        return { success: true };
      }),
    
    publish: trainerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const draft = await db.getBundleDraftById(input.id);
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      // Create publication record
      const pubId = await db.createBundlePublication({
        draftId: input.id,
        state: "init",
      });

      // Update draft status
      await db.updateBundleDraft(input.id, { status: "publishing" });

      await db.logActivity({
        userId: ctx.user.id,
        action: "bundle_publishing",
        entityType: "bundle_draft",
        entityId: input.id,
      });

      // In production, this would trigger async Shopify publishing
      // For now, simulate success
      setTimeout(async () => {
        await db.updateBundlePublication(pubId, {
          state: "published",
          publishedAt: new Date(),
        });
        await db.updateBundleDraft(input.id, { status: "published" });
      }, 2000);

      return { publicationId: pubId };
    }),

    // Commission data endpoints
    getCommissionData: publicProcedure
      .input(z.object({ shopifyProductIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return db.getCommissionDataForProducts(input.shopifyProductIds);
      }),

    getBaseCommissionRate: publicProcedure.query(async () => {
      return db.getBaseCommissionRate();
    }),

    // ============================================================================
    // BUNDLE INVITATIONS
    // ============================================================================
    
    // Send bundle invitation to a user (existing or new)
    sendInvitation: trainerProcedure
      .input(z.object({
        bundleId: z.number(),
        email: z.string().email(),
        recipientName: z.string().optional(),
        personalMessage: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verify bundle exists and belongs to trainer
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
        if (bundle.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        if (bundle.status !== "published") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only published bundles can be shared" });
        }
        
        // Check for existing pending invitation
        const hasPending = await db.hasPendingBundleInvitation(
          ctx.user.id,
          input.bundleId,
          input.email
        );
        if (hasPending) {
          throw new TRPCError({ code: "CONFLICT", message: "An invitation is already pending for this email" });
        }
        
        // Generate unique token
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
        
        // Set expiry to 7 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // Create invitation
        const invitation = await db.createBundleInvitation({
          trainerId: ctx.user.id,
          bundleId: input.bundleId,
          email: input.email.toLowerCase(),
          recipientName: input.recipientName,
          token,
          personalMessage: input.personalMessage,
          expiresAt,
          emailSentAt: new Date(),
        });
        
        if (!invitation) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create invitation" });
        }
        
        const invitationId = invitation.id;
        
        // Log activity
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_invitation_sent",
          entityType: "bundle_invitation",
          entityId: invitationId,
          details: { bundleId: input.bundleId, email: input.email },
        });
        
        // Send notification to owner about the invitation
        // This uses the Manus notification service to alert the owner
        // In production, you would also send an email to the recipient
        const inviteUrl = `${process.env.VITE_OAUTH_PORTAL_URL?.replace('/login', '') || ''}/invite/${token}`;
        const trainerName = ctx.user.name || 'A trainer';
        const bundleTitle = bundle.title || 'a wellness bundle';
        
        // Notify owner about the invitation (for tracking purposes)
        await notifyOwner({
          title: `Bundle Invitation Sent`,
          content: `${trainerName} invited ${input.email} to the bundle "${bundleTitle}". Invite link: ${inviteUrl}`,
        }).catch((err: unknown) => console.warn('[Invitation] Failed to notify owner:', err));
        
        console.log(`[Invitation] Created invitation ${token} for ${input.email} to bundle ${input.bundleId}`);
        
        return { 
          success: true, 
          invitationId,
          token,
          inviteUrl: `/invite/${token}`,
        };
      }),
    
    // Get invitations sent by trainer
    getMyInvitations: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerBundleInvitations(ctx.user.id);
    }),
    
    // Get invitation statistics
    getInvitationStats: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerInvitationStats(ctx.user.id);
    }),
    
    // Get invitation by token (public - for invite page)
    getInvitationByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const invitation = await db.getBundleInvitationWithDetails(input.token);
        if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        
        // Check if expired
        if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
          await db.updateBundleInvitationStatus(invitation.id, "expired");
          throw new TRPCError({ code: "BAD_REQUEST", message: "This invitation has expired" });
        }
        
        // Mark as viewed if pending
        if (invitation.status === "pending") {
          await db.markBundleInvitationViewed(invitation.id);
        }
        
        return invitation;
      }),
    
    // Accept invitation (for logged-in users)
    acceptInvitation: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const invitation = await db.getBundleInvitationByToken(input.token);
        if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        
        // Check if already accepted
        if (invitation.status === "accepted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This invitation has already been accepted" });
        }
        
        // Check if expired
        if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
          await db.updateBundleInvitationStatus(invitation.id, "expired");
          throw new TRPCError({ code: "BAD_REQUEST", message: "This invitation has expired" });
        }
        
        // Assign trainer to user if not already assigned
        const user = await db.getUserById(ctx.user.id);
        if (user && !user.trainerId) {
          await db.updateUser(ctx.user.id, { 
            trainerId: invitation.trainerId,
            role: "client", // Upgrade from shopper to client
          });
        }
        
        // Accept the invitation
        await db.acceptBundleInvitation(invitation.id, ctx.user.id);
        
        // Log activity
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_invitation_accepted",
          entityType: "bundle_invitation",
          entityId: invitation.id,
        });
        
        return { 
          success: true,
          bundleId: invitation.bundleId,
          trainerId: invitation.trainerId,
        };
      }),
    
    // Decline invitation
    declineInvitation: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const invitation = await db.getBundleInvitationByToken(input.token);
        if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        
        if (invitation.status === "accepted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This invitation has already been accepted" });
        }
        
        await db.declineBundleInvitation(invitation.id);
        
        return { success: true };
      }),
    
    // Resend expired invitation (creates a new invitation with same details)
    resendInvitation: trainerProcedure
      .input(z.object({ invitationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const invitation = await db.getBundleInvitationById(input.invitationId);
        if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        
        // Verify trainer owns this invitation
        if (invitation.trainerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only resend your own invitations" });
        }
        
        // Only allow resending expired or declined invitations
        if (invitation.status !== "expired" && invitation.status !== "declined") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Can only resend expired or declined invitations" });
        }
        
        // Generate new token and expiry
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // Create a new invitation with the same details
        const newInvitation = await db.createBundleInvitation({
          bundleId: invitation.bundleId,
          trainerId: ctx.user.id,
          email: invitation.email,
          recipientName: invitation.recipientName,
          personalMessage: invitation.personalMessage,
          token,
          expiresAt,
          emailSentAt: new Date(),
        });
        
        if (!newInvitation) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create new invitation" });
        }
        
        // Send notification
        const inviteUrl = `${process.env.VITE_FRONTEND_FORGE_API_URL?.replace('/api', '')}/invite/${newInvitation.token}`;
        try {
          await notifyOwner({
            title: `Bundle Invitation Resent`,
            content: `${ctx.user.name || 'A trainer'} resent an invitation to ${invitation.email}.\n\nInvite Link: ${inviteUrl}`,
          });
        } catch (err: unknown) {
          console.error("Failed to send resend notification:", err);
        }
        
        return { success: true, newInvitationId: newInvitation.id };
      }),
    
    // Revoke pending invitation
    revokeInvitation: trainerProcedure
      .input(z.object({ invitationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const invitation = await db.getBundleInvitationById(input.invitationId);
        if (!invitation) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
        
        // Verify trainer owns this invitation
        if (invitation.trainerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only revoke your own invitations" });
        }
        
        // Only allow revoking pending invitations
        if (invitation.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Can only revoke pending invitations" });
        }
        
        // Update status to revoked
        await db.updateBundleInvitationStatus(invitation.id, "revoked");
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // COMMISSION MANAGEMENT (Admin/Manager)
  // ============================================================================
  commission: router({
    // Get all SPF rates (active and inactive)
    getAllSPF: managerProcedure.query(async () => {
      return db.getAllSPF();
    }),

    // Get active SPF rates only
    getActiveSPF: publicProcedure.query(async () => {
      return db.getAllActiveSPF();
    }),

    // Set/update SPF for a product
    setSPF: managerProcedure
      .input(z.object({
        shopifyProductId: z.number(),
        spfPercentage: z.number().min(0).max(1),
        startDate: z.date().optional().nullable(),
        endDate: z.date().optional().nullable(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.upsertProductSPF({
          shopifyProductId: input.shopifyProductId,
          spfPercentage: input.spfPercentage.toString(),
          startDate: input.startDate,
          endDate: input.endDate,
          notes: input.notes,
          createdBy: ctx.user.id,
        });

        await db.logActivity({
          userId: ctx.user.id,
          action: "spf_updated",
          entityType: "product_spf",
          details: { shopifyProductId: input.shopifyProductId, spfPercentage: input.spfPercentage },
        });

        return { success: true };
      }),

    // Delete SPF for a product
    deleteSPF: managerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteProductSPF(input.id);

        await db.logActivity({
          userId: ctx.user.id,
          action: "spf_deleted",
          entityType: "product_spf",
          entityId: input.id,
        });

        return { success: true };
      }),

    // Get/set base commission rate
    getBaseRate: publicProcedure.query(async () => {
      return db.getBaseCommissionRate();
    }),

    setBaseRate: managerProcedure
      .input(z.object({ rate: z.number().min(0).max(1) }))
      .mutation(async ({ input, ctx }) => {
        await db.setBaseCommissionRate(input.rate, ctx.user.id);

        await db.logActivity({
          userId: ctx.user.id,
          action: "base_commission_updated",
          entityType: "platform_settings",
          details: { rate: input.rate },
        });

        return { success: true };
      }),

    // Get all platform settings
    getSettings: managerProcedure.query(async () => {
      return db.getAllPlatformSettings();
    }),
  }),

  // ============================================================================
  // USER PROFILE (Any authenticated user)
  // ============================================================================
  userProfile: router({
    // Get current user's profile
    me: protectedProcedure.query(async ({ ctx }) => {
      return {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        phone: ctx.user.phone,
        photoUrl: ctx.user.photoUrl,
        role: ctx.user.role,
        bio: ctx.user.bio,
        createdAt: ctx.user.createdAt,
      };
    }),
    
    // Update profile info
    update: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100).optional(),
        phone: z.string().max(20).optional(),
        bio: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateUser(ctx.user.id, input);
        return { success: true };
      }),
    
    // Upload avatar photo
    uploadAvatar: protectedProcedure
      .input(z.object({
        base64Data: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import("./storage");
        
        // Decode base64 and upload to S3
        const buffer = Buffer.from(input.base64Data, "base64");
        const ext = input.fileName.split(".").pop() || "jpg";
        const fileKey = `user-avatars/${ctx.user.id}/avatar-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Update user's photoUrl
        await db.updateUserPhotoUrl(ctx.user.id, url);
        
        return { url };
      }),
    
    // Remove avatar photo
    removeAvatar: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.updateUser(ctx.user.id, { photoUrl: null });
        return { success: true };
      }),
  }),

  // ============================================================================
  // PUBLIC PROFILE (Public - Anyone can view)
  // ============================================================================
  publicProfile: router({
    getById: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getUserById(input.userId);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        
        // Return only public-safe information
        return {
          id: user.id,
          name: user.name,
          photoUrl: user.photoUrl,
          bio: user.bio,
          role: user.role,
          username: user.username,
          goals: user.role === "trainer" ? user.specialties : (user.metadata as any)?.goals || [],
          createdAt: user.createdAt,
        };
      }),
  }),

  // ============================================================================
  // CATALOG (Public - Shopper)
  // ============================================================================
  catalog: router({
    bundles: publicProcedure
      .input(z.object({ goalType: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getPublishedBundlesByGoal(input?.goalType || "all");
      }),
    bundleDetail: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const draft = await db.getBundleDraftById(input.id);
      if (!draft || draft.status !== "published") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return draft;
    }),
  }),

  // ============================================================================
  // PRODUCTS
  // ============================================================================
  products: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional(), availability: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getProducts(input);
      }),
    get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return db.getProductById(input.id);
    }),
    getByIds: publicProcedure.input(z.object({ ids: z.array(z.number()) })).query(async ({ input }) => {
      return db.getProductsByIds(input.ids);
    }),
    sync: managerProcedure.mutation(async ({ ctx }) => {
      console.log("[Products] Starting Shopify sync...");
      
      // Sync products from Shopify to database
      const result = await shopify.syncProductsToDatabase(db.upsertProduct);
      
      await db.logActivity({
        userId: ctx.user.id,
        action: "products_synced",
        entityType: "product",
        details: { synced: result.synced, errors: result.errors },
      });
      
      console.log(`[Products] Sync complete: ${result.synced} synced, ${result.errors} errors`);
      return { success: true, count: result.synced, errors: result.errors };
    }),
  }),

  // ============================================================================
  // CLIENTS (Trainer CRM)
  // ============================================================================
  clients: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getClientsByTrainer(ctx.user.id);
    }),
    get: trainerProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
      const client = await db.getClientById(input.id);
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });
      if (client.trainerId !== ctx.user.id && !["manager", "coordinator"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return client;
    }),
    create: trainerProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          goals: z.array(z.string()).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = await db.createClient({
          ...input,
          trainerId: ctx.user.id,
          status: "pending",
          invitedAt: new Date(),
        });
        await db.logActivity({
          userId: ctx.user.id,
          action: "client_invited",
          entityType: "client",
          entityId: id,
        });
        return { id };
      }),
    update: trainerProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          goals: z.array(z.string()).optional(),
          notes: z.string().optional(),
          status: z.enum(["pending", "active", "inactive"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const client = await db.getClientById(id);
        if (!client) throw new TRPCError({ code: "NOT_FOUND" });
        if (client.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
        await db.updateClient(id, data);
        return { success: true };
      }),
    delete: trainerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const client = await db.getClientById(input.id);
      if (!client) throw new TRPCError({ code: "NOT_FOUND" });
      if (client.trainerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      await db.deleteClient(input.id);
      return { success: true };
    }),
  }),

  // ============================================================================
  // SUBSCRIPTIONS
  // ============================================================================
  subscriptions: router({
    listByClient: clientProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      return db.getSubscriptionsByClient(input.clientId);
    }),
    listByTrainer: trainerProcedure.query(async ({ ctx }) => {
      return db.getSubscriptionsByTrainer(ctx.user.id);
    }),
    listActive: trainerProcedure.query(async ({ ctx }) => {
      return db.getActiveSubscriptions(ctx.user.id);
    }),
    create: trainerProcedure
      .input(
        z.object({
          clientId: z.number(),
          bundleDraftId: z.number().optional(),
          price: z.string(),
          subscriptionType: z.enum(["weekly", "monthly", "yearly"]),
          sessionsIncluded: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = await db.createSubscription({
          ...input,
          trainerId: ctx.user.id,
          status: "active",
          startDate: new Date(),
        });
        return { id };
      }),
    update: trainerProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["active", "paused", "cancelled"]).optional(),
          price: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.status === "paused") {
          await db.updateSubscription(id, { ...data, pausedAt: new Date() });
        } else if (data.status === "cancelled") {
          await db.updateSubscription(id, { ...data, cancelledAt: new Date() });
        } else {
          await db.updateSubscription(id, data);
        }
        return { success: true };
      }),
  }),

  // ============================================================================
  // SESSIONS
  // ============================================================================
  sessions: router({
    listByClient: trainerProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      return db.getSessionsByClient(input.clientId);
    }),
    upcoming: trainerProcedure.query(async ({ ctx }) => {
      return db.getUpcomingSessions(ctx.user.id);
    }),
    create: trainerProcedure
      .input(
        z.object({
          clientId: z.number(),
          subscriptionId: z.number().optional(),
          sessionDate: z.string(),
          durationMinutes: z.number().optional(),
          sessionType: z.enum(["training", "check_in", "call", "plan_review"]).optional(),
          location: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = await db.createSession({
          ...input,
          trainerId: ctx.user.id,
          sessionDate: new Date(input.sessionDate),
          status: "scheduled",
        });
        return { id };
      }),
    update: trainerProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSession(id, data);
        return { success: true };
      }),
  }),

  // ============================================================================
  // ORDERS
  // ============================================================================
  orders: router({
    listByTrainer: trainerProcedure.query(async ({ ctx }) => {
      return db.getOrdersByTrainer(ctx.user.id);
    }),
    listByClient: clientProcedure.input(z.object({ clientId: z.number() })).query(async ({ input }) => {
      return db.getOrdersByClient(input.clientId);
    }),
    recent: trainerProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      return db.getRecentOrders(ctx.user.id, input?.limit || 10);
    }),
    byId: trainerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const order = await db.getOrderById(input.id);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        const items = await db.getOrderItems(order.id);
        return { ...order, items };
      }),
    getItems: protectedProcedure.input(z.object({ orderId: z.number() })).query(async ({ input }) => {
      return db.getOrderItems(input.orderId);
    }),
    updateStatus: trainerProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["processing", "shipped", "delivered", "cancelled"]).optional(),
          fulfillmentStatus: z.enum(["unfulfilled", "partial", "fulfilled"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateOrder(id, data);
        return { success: true };
      }),
  }),

  // ============================================================================
  // MESSAGES
  // ============================================================================
  messages: router({
    conversations: protectedProcedure.query(async ({ ctx }) => {
      return db.getConversations(ctx.user.id);
    }),
    list: protectedProcedure.input(z.object({ conversationId: z.string() })).query(async ({ input }) => {
      return db.getMessagesByConversation(input.conversationId);
    }),
    send: protectedProcedure
      .input(
        z.object({
          receiverId: z.number(),
          content: z.string().min(1),
          messageType: z.enum(["text", "image", "file"]).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const conversationId = [ctx.user.id, input.receiverId].sort().join("-");
        const id = await db.createMessage({
          senderId: ctx.user.id,
          receiverId: input.receiverId,
          conversationId,
          content: input.content,
          messageType: input.messageType || "text",
        });
        return { id, conversationId };
      }),
    markRead: protectedProcedure.input(z.object({ conversationId: z.string() })).mutation(async ({ input, ctx }) => {
      await db.markMessagesAsRead(input.conversationId, ctx.user.id);
      return { success: true };
    }),
  }),

  // ============================================================================
  // CALENDAR
  // ============================================================================
  calendar: router({
    events: protectedProcedure
      .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return db.getCalendarEvents(
          ctx.user.id,
          input?.startDate ? new Date(input.startDate) : undefined,
          input?.endDate ? new Date(input.endDate) : undefined
        );
      }),
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          location: z.string().optional(),
          startTime: z.string(),
          endTime: z.string(),
          eventType: z.enum(["session", "delivery", "appointment", "other"]).optional(),
          relatedClientId: z.number().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const id = await db.createCalendarEvent({
          ...input,
          userId: ctx.user.id,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
        });
        return { id };
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          title: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, startTime, endTime, ...data } = input;
        await db.updateCalendarEvent(id, {
          ...data,
          ...(startTime && { startTime: new Date(startTime) }),
          ...(endTime && { endTime: new Date(endTime) }),
        });
        return { success: true };
      }),
  }),

  // ============================================================================
  // TRAINER MANAGEMENT & DIRECTORY
  // ============================================================================
  trainers: router({
    // Public: List all active trainers for directory
    directory: publicProcedure.query(async () => {
      return db.getActiveTrainers();
    }),
    
    // Public: Get trainer details with bundles
    getPublic: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const trainer = await db.getTrainerWithBundles(input.id);
        if (!trainer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trainer not found" });
        }
        return trainer;
      }),
    
    // Manager: List all trainers (admin view)
    list: managerProcedure.query(async () => {
      return db.getTrainers();
    }),
    pending: managerProcedure.query(async () => {
      return db.getPendingTrainers();
    }),
    approve: managerProcedure.input(z.object({ trainerId: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updateTrainerApproval(input.trainerId, "approved", undefined, ctx.user.id);
      await db.updateUserRole(input.trainerId, "trainer");
      
      // Auto-generate username for newly approved trainer
      const user = await db.getUserById(input.trainerId);
      if (user && !user.username && user.name) {
        await db.ensureUserHasUsername(input.trainerId, user.name);
      }
      
      await db.logActivity({
        userId: ctx.user.id,
        action: "trainer_approved",
        entityType: "user",
        entityId: input.trainerId,
      });
      return { success: true };
    }),
    reject: managerProcedure
      .input(z.object({ trainerId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateTrainerApproval(input.trainerId, "rejected", input.reason, ctx.user.id);
        await db.logActivity({
          userId: ctx.user.id,
          action: "trainer_rejected",
          entityType: "user",
          entityId: input.trainerId,
        });
        return { success: true };
      }),
    suspend: managerProcedure.input(z.object({ trainerId: z.number() })).mutation(async ({ input, ctx }) => {
      await db.updateTrainerApproval(input.trainerId, "suspended", undefined, ctx.user.id);
      await db.logActivity({
        userId: ctx.user.id,
        action: "trainer_suspended",
        entityType: "user",
        entityId: input.trainerId,
      });
      return { success: true };
    }),
    
    // Manager: Invite a new trainer by email
    invite: managerProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if user already exists with this email
        const existingUser = await db.getUserByEmail(input.email);
        
        if (existingUser) {
          // If user exists and is already a trainer, return error
          if (existingUser.role === "trainer") {
            throw new TRPCError({
              code: "CONFLICT",
              message: "This user is already a trainer",
            });
          }
          
          // Promote existing user to trainer
          await db.updateUserRole(existingUser.id, "trainer");
          
          // Auto-generate username if needed
          if (!existingUser.username && (input.name || existingUser.name)) {
            await db.ensureUserHasUsername(existingUser.id, input.name || existingUser.name || "trainer");
          }
          
          await db.logActivity({
            userId: ctx.user.id,
            action: "trainer_invited_existing",
            entityType: "user",
            entityId: existingUser.id,
            details: { email: input.email },
          });
          
          return {
            success: true,
            userId: existingUser.id,
            inviteLink: null,
            message: "Existing user promoted to trainer",
          };
        }
        
        // Create a new user with trainer role
        const tempPassword = crypto.randomUUID().slice(0, 12);
        const userId = await db.createUserWithPassword({
          email: input.email,
          password: tempPassword,
          name: input.name || input.email.split("@")[0],
          role: "trainer",
        });
        
        if (!userId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create trainer account",
          });
        }
        
        // Auto-generate username
        await db.ensureUserHasUsername(userId, input.name || input.email.split("@")[0]);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "trainer_invited_new",
          entityType: "user",
          entityId: userId,
          details: { email: input.email },
        });
        
        // Generate invite link with temp password
        const baseUrl = process.env.VITE_APP_URL || "https://locomotiva-fxqzdyym.manus.space";
        const inviteLink = `${baseUrl}/login?email=${encodeURIComponent(input.email)}&temp=${encodeURIComponent(tempPassword)}`;
        
        return {
          success: true,
          userId,
          inviteLink,
          tempPassword,
          message: "New trainer account created",
        };
      }),
  }),

  // ============================================================================
  // ANALYTICS / STATS
  // ============================================================================
  stats: router({
    trainer: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerStats(ctx.user.id);
    }),
    manager: managerProcedure.query(async () => {
      return db.getManagerStats();
    }),
    analytics: managerProcedure
      .input(z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        trainerId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getRevenueAnalytics({
          startDate: input?.startDate ? new Date(input.startDate) : undefined,
          endDate: input?.endDate ? new Date(input.endDate) : undefined,
          trainerId: input?.trainerId,
        });
      }),
    pendingCounts: managerProcedure.query(async () => {
      return db.getPendingCounts();
    }),
    bundleCounts: managerProcedure.query(async () => {
      return db.getBundleCountByStatus();
    }),
    
    // Bundle performance analytics
    bundlePerformance: managerProcedure
      .input(z.object({
        sortBy: z.enum(["revenue", "sales", "views", "conversion"]).default("revenue"),
        limit: z.number().min(1).max(50).default(10),
      }).optional())
      .query(async ({ input }) => {
        const topBundles = await db.getTopPerformingBundles(
          input?.sortBy || "revenue",
          input?.limit || 10
        );
        
        // Get trainer info for each bundle
        const bundlesWithTrainers = await Promise.all(
          topBundles.map(async (bundle) => {
            const trainer = await db.getUserById(bundle.trainerId);
            return {
              ...bundle,
              trainer: trainer ? {
                id: trainer.id,
                name: trainer.name,
                photoUrl: trainer.photoUrl,
              } : null,
            };
          })
        );
        
        return bundlesWithTrainers;
      }),
    
    // Bundle performance summary
    bundlePerformanceSummary: managerProcedure.query(async () => {
      return db.getBundlePerformanceSummary();
    }),
    
    // Generate and save analytics report
    generateReport: managerProcedure
      .input(z.object({
        dateRange: z.enum(["7d", "30d", "90d", "1y", "all"]).default("30d"),
        reportType: z.enum(["revenue", "trainers", "bundles", "orders", "full"]).default("full"),
      }))
      .mutation(async ({ input, ctx }) => {
        // Calculate date range
        const now = new Date();
        let startDate: Date | undefined;
        switch (input.dateRange) {
          case "7d":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "30d":
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "90d":
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case "1y":
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = undefined;
        }
        
        // Get analytics data
        const analytics = await db.getRevenueAnalytics({
          startDate,
          endDate: now,
        });
        
        // Generate CSV content
        const csvRows: string[] = [];
        
        // Header section
        csvRows.push("LocoMotivate Analytics Report");
        csvRows.push(`Generated: ${now.toISOString()}`);
        csvRows.push(`Date Range: ${input.dateRange === "all" ? "All Time" : input.dateRange}`);
        csvRows.push("");
        
        // Summary section
        csvRows.push("=== SUMMARY ===");
        csvRows.push(`Total Revenue,$${analytics.totalRevenue.toFixed(2)}`);
        csvRows.push(`Total Orders,${analytics.orderCount}`);
        csvRows.push("");
        
        // Monthly revenue
        csvRows.push("=== MONTHLY REVENUE ===");
        csvRows.push("Month,Revenue");
        for (const month of analytics.revenueByMonth) {
          csvRows.push(`${month.month},$${month.revenue.toFixed(2)}`);
        }
        csvRows.push("");
        
        // Top products
        csvRows.push("=== TOP SELLING PRODUCTS ===");
        csvRows.push("Product Name,Units Sold,Revenue");
        for (const product of analytics.topProducts || []) {
          csvRows.push(`"${product.name}",${product.quantity},$${product.revenue.toFixed(2)}`);
        }
        csvRows.push("");
        
        // Trainer performance
        csvRows.push("=== TRAINER PERFORMANCE ===");
        csvRows.push("Trainer Name,Bundles Sold,Revenue");
        for (const trainer of analytics.trainerPerformance) {
          const name = trainer.trainer?.name || `Trainer ${trainer.trainerId}`;
          csvRows.push(`"${name}",${trainer.bundlesSold},$${trainer.revenue.toFixed(2)}`);
        }
        
        const csvContent = csvRows.join("\n");
        
        // Upload to S3
        const { storagePut } = await import("./storage");
        const fileName = `analytics-report-${input.dateRange}-${Date.now()}.csv`;
        const { url } = await storagePut(
          `reports/${fileName}`,
          Buffer.from(csvContent, "utf-8"),
          "text/csv"
        );
        
        // Save report record to database
        const report = await db.saveAnalyticsReport({
          generatedBy: ctx.user.id,
          reportType: input.reportType,
          dateRangeStart: startDate,
          dateRangeEnd: now,
          dateRangeLabel: input.dateRange,
          fileName,
          fileUrl: url,
          fileSize: Buffer.byteLength(csvContent, "utf-8"),
          totalRevenue: analytics.totalRevenue.toString(),
          orderCount: analytics.orderCount,
          trainerCount: analytics.trainerPerformance.length,
          bundleCount: (analytics.topProducts || []).length,
        });
        
        return {
          id: report.id,
          fileName,
          fileUrl: url,
          createdAt: report.createdAt,
        };
      }),
    
    // List recent reports
    recentReports: managerProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getRecentAnalyticsReports(input?.limit || 10);
      }),
  }),

  // ============================================================================
  // BUNDLES MANAGEMENT (Manager)
  // ============================================================================
  bundlesManagement: router({
    list: managerProcedure
      .input(z.object({
        status: z.enum(["draft", "pending_review", "published"]).optional(),
        trainerId: z.number().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllBundlesWithTrainers(input);
      }),
  }),

  // ============================================================================
  // ACTIVITY LOG
  // ============================================================================
  activity: router({
    // Manager sees all activity, trainers see only their own
    recent: protectedProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const isManager = ctx.user.role === "manager" || ctx.user.role === "coordinator";
      if (isManager) {
        return db.getRecentActivity(input?.limit || 20);
      }
      // Trainers only see their own activity
      return db.getRecentActivityByUser(ctx.user.id, input?.limit || 20);
    }),
  }),

  // ============================================================================
  // INVITATIONS (Trainer invites customers)
  // ============================================================================
  invitations: router({
    list: trainerProcedure.query(async ({ ctx }) => {
      return db.getInvitationsByTrainer(ctx.user.id);
    }),
    send: trainerProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string().optional(),
        message: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if already invited
        const existing = await db.getPendingInvitationByEmail(input.email, ctx.user.id);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "This email has already been invited" });
        }
        
        // Generate unique token
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        
        const id = await db.createInvitation({
          trainerId: ctx.user.id,
          email: input.email,
          name: input.name,
          message: input.message,
          token,
          status: "pending",
          expiresAt,
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "invitation_sent",
          entityType: "invitation",
          entityId: id,
          details: { email: input.email },
        });
        
        // TODO: Send email with invitation link
        // For now, return the token for testing
        return { id, token };
      }),
    accept: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Please log in to accept the invitation" });
        }
        
        const result = await db.acceptInvitation(input.token, ctx.user.id);
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired invitation" });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "invitation_accepted",
          entityType: "invitation",
          entityId: result.id,
        });
        
        return { success: true, trainerId: result.trainerId };
      }),
    revoke: trainerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const invitations = await db.getInvitationsByTrainer(ctx.user.id);
        const invitation = invitations.find(i => i.id === input.id);
        if (!invitation) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        await db.updateInvitation(input.id, { status: "revoked" });
        return { success: true };
      }),
  }),

  // ============================================================================
  // TRAINER PROFILE (Public landing pages)
  // ============================================================================
  trainerProfile: router({
    // Public: Get trainer by username for landing page
    byUsername: publicProcedure
      .input(z.object({ username: z.string() }))
      .query(async ({ input }) => {
        const trainer = await db.getTrainerByUsername(input.username);
        if (!trainer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trainer not found" });
        }
        
        // Get published bundles
        const bundles = await db.getPublishedBundlesByTrainer(trainer.id);
        
        return {
          id: trainer.id,
          name: trainer.name,
          username: trainer.username,
          photoUrl: trainer.photoUrl,
          bio: trainer.bio,
          specialties: trainer.specialties,
          socialLinks: trainer.socialLinks,
          bundles,
        };
      }),
    
    // Protected: Update own profile
    update: trainerProcedure
      .input(z.object({
        username: z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/).optional(),
        bio: z.string().max(500).optional(),
        specialties: z.array(z.string()).optional(),
        socialLinks: z.record(z.string(), z.string()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check username availability
        if (input.username) {
          const available = await db.isUsernameAvailable(input.username, ctx.user.id);
          if (!available) {
            throw new TRPCError({ code: "CONFLICT", message: "Username is already taken" });
          }
        }
        
        await db.updateTrainerProfile(ctx.user.id, input);
        return { success: true };
      }),
    
    // Check username availability
    checkUsername: trainerProcedure
      .input(z.object({ username: z.string() }))
      .query(async ({ input, ctx }) => {
        const available = await db.isUsernameAvailable(input.username, ctx.user.id);
        return { available };
      }),
    
    // Get all media for current trainer
    getMedia: trainerProcedure.query(async ({ ctx }) => {
      const media = await db.getTrainerMedia(ctx.user.id);
      return media;
    }),
    
    // Get media by type
    getMediaByType: trainerProcedure
      .input(z.object({ type: z.enum(["profile_photo", "gallery_image", "video"]) }))
      .query(async ({ input, ctx }) => {
        return db.getTrainerMediaByType(ctx.user.id, input.type);
      }),
    
    // Upload profile photo
    uploadProfilePhoto: trainerProcedure
      .input(z.object({
        base64Data: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { storagePut } = await import("./storage");
        
        // Decode base64 and upload to S3
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileKey = `trainer-media/${ctx.user.id}/profile-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${input.fileName.split(".").pop()}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        // Save to database (will replace existing profile photo)
        const mediaId = await db.createTrainerMedia({
          trainerId: ctx.user.id,
          type: "profile_photo",
          url,
          fileKey,
          mimeType: input.mimeType,
          fileSize: buffer.length,
        });
        
        // Also update user's photoUrl for backwards compatibility
        await db.updateUserPhotoUrl(ctx.user.id, url);
        
        return { id: mediaId, url };
      }),
    
    // Upload gallery image
    uploadGalleryImage: trainerProcedure
      .input(z.object({
        base64Data: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        title: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check gallery limit (max 12 images)
        const count = await db.getTrainerGalleryCount(ctx.user.id);
        if (count >= 12) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 12 gallery images allowed" });
        }
        
        const { storagePut } = await import("./storage");
        
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileKey = `trainer-media/${ctx.user.id}/gallery-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${input.fileName.split(".").pop()}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        const mediaId = await db.createTrainerMedia({
          trainerId: ctx.user.id,
          type: "gallery_image",
          url,
          fileKey,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          title: input.title,
          sortOrder: count, // Add to end
        });
        
        return { id: mediaId, url };
      }),
    
    // Add video (YouTube/Vimeo embed)
    addVideo: trainerProcedure
      .input(z.object({
        url: z.string().url(),
        title: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check video limit (max 6 videos)
        const count = await db.getTrainerVideoCount(ctx.user.id);
        if (count >= 6) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 6 videos allowed" });
        }
        
        // Parse video URL to extract provider and ID
        let videoProvider: "youtube" | "vimeo" | "upload" = "upload";
        let videoId: string | undefined;
        let thumbnailUrl: string | undefined;
        
        const youtubeMatch = input.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
        const vimeoMatch = input.url.match(/vimeo\.com\/(\d+)/);
        
        if (youtubeMatch) {
          videoProvider = "youtube";
          videoId = youtubeMatch[1];
          thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        } else if (vimeoMatch) {
          videoProvider = "vimeo";
          videoId = vimeoMatch[1];
        }
        
        const mediaId = await db.createTrainerMedia({
          trainerId: ctx.user.id,
          type: "video",
          url: input.url,
          thumbnailUrl,
          title: input.title,
          description: input.description,
          videoProvider,
          videoId,
          sortOrder: count,
        });
        
        return { id: mediaId };
      }),
    
    // Upload video file directly
    uploadVideo: trainerProcedure
      .input(z.object({
        base64Data: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        title: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check video limit (max 6 videos)
        const count = await db.getTrainerVideoCount(ctx.user.id);
        if (count >= 6) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum 6 videos allowed" });
        }
        
        const { storagePut } = await import("./storage");
        
        const buffer = Buffer.from(input.base64Data, "base64");
        
        // 100MB limit
        if (buffer.length > 100 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Video must be less than 100MB" });
        }
        
        const ext = input.fileName.split(".").pop() || "mp4";
        const fileKey = `trainer-media/${ctx.user.id}/video-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        const mediaId = await db.createTrainerMedia({
          trainerId: ctx.user.id,
          type: "video",
          url,
          fileKey,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          title: input.title,
          videoProvider: "upload",
          sortOrder: count,
        });
        
        return { id: mediaId, url };
      }),
    
    // Delete media
    deleteMedia: trainerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.deleteTrainerMedia(input.id, ctx.user.id);
        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Media not found" });
        }
        return { success: true };
      }),
    
    // Reorder gallery images
    reorderGallery: trainerProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(async ({ input, ctx }) => {
        await db.reorderTrainerGallery(ctx.user.id, input.orderedIds);
        return { success: true };
      }),
    
    // Update media (title, description)
    updateMedia: trainerProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const success = await db.updateTrainerMedia(id, ctx.user.id, data);
        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Media not found" });
        }
        return { success: true };
      }),
    
    // Public: Get media for a trainer by username
    getPublicMedia: publicProcedure
      .input(z.object({ username: z.string() }))
      .query(async ({ input }) => {
        const trainer = await db.getTrainerByUsername(input.username);
        if (!trainer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trainer not found" });
        }
        return db.getTrainerMedia(trainer.id);
      }),
  }),

  // ============================================================================
  // BUNDLE APPROVAL (Admin workflow)
  // ============================================================================
  bundleApproval: router({
    // Get all bundles for admin view
    allBundles: managerProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(async ({ input }) => {
        return db.getAllBundlesWithTrainer();
      }),
    
    // Get pending review queue
    pending: managerProcedure.query(async () => {
      return db.getPendingBundleReviews();
    }),
    
    // Approve a bundle
    approve: managerProcedure
      .input(z.object({
        bundleId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.approveBundleDraft(input.bundleId, ctx.user.id, input.notes);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_approved",
          entityType: "bundle_draft",
          entityId: input.bundleId,
        });
        
        return { success: true };
      }),
    
    // Reject a bundle
    reject: managerProcedure
      .input(z.object({
        bundleId: z.number(),
        notes: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.rejectBundleDraft(input.bundleId, ctx.user.id, input.notes);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_rejected",
          entityType: "bundle_draft",
          entityId: input.bundleId,
        });
        
        return { success: true };
      }),
    
    // Request changes
    requestChanges: managerProcedure
      .input(z.object({
        bundleId: z.number(),
        notes: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.requestBundleChanges(input.bundleId, ctx.user.id, input.notes);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_changes_requested",
          entityType: "bundle_draft",
          entityId: input.bundleId,
        });
        
        return { success: true };
      }),
    
    // Get review history for a bundle
    history: managerProcedure
      .input(z.object({ bundleId: z.number() }))
      .query(async ({ input }) => {
        return db.getBundleReviewHistory(input.bundleId);
      }),
  }),

  // ============================================================================
  // JOIN REQUESTS (Customer-initiated trainer requests)
  // ============================================================================
  joinRequests: router({
    // Customer: Request to join a trainer
    create: protectedProcedure
      .input(z.object({
        trainerId: z.number(),
        message: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if already has pending request
        const existing = await db.getPendingJoinRequest(input.trainerId, ctx.user.id);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "You already have a pending request with this trainer" });
        }
        
        // Check if already a client
        const clientList = await db.getClientsByTrainer(input.trainerId);
        const isClient = clientList.some(c => c.userId === ctx.user.id);
        if (isClient) {
          throw new TRPCError({ code: "CONFLICT", message: "You are already a client of this trainer" });
        }
        
        const id = await db.createJoinRequest({
          trainerId: input.trainerId,
          userId: ctx.user.id,
          message: input.message,
          status: "pending",
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "join_request_sent",
          entityType: "join_request",
          entityId: id,
        });
        
        return { id };
      }),
    
    // Customer: View their requests
    myRequests: protectedProcedure.query(async ({ ctx }) => {
      return db.getJoinRequestsByUser(ctx.user.id);
    }),
    
    // Trainer: View requests to join
    listForTrainer: trainerProcedure.query(async ({ ctx }) => {
      return db.getJoinRequestsByTrainer(ctx.user.id);
    }),
    
    // Trainer: Approve a request
    approve: trainerProcedure
      .input(z.object({
        id: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getJoinRequestById(input.id);
        if (!request || request.trainerId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        await db.approveJoinRequest(input.id, ctx.user.id, input.notes);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "join_request_approved",
          entityType: "join_request",
          entityId: input.id,
        });
        
        return { success: true };
      }),
    
    // Trainer: Reject a request
    reject: trainerProcedure
      .input(z.object({
        id: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const request = await db.getJoinRequestById(input.id);
        if (!request || request.trainerId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        
        await db.rejectJoinRequest(input.id, ctx.user.id, input.notes);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "join_request_rejected",
          entityType: "join_request",
          entityId: input.id,
        });
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // ADMIN OVERSIGHT (Full visibility)
  // ============================================================================
  admin: router({
    // Get all clients across all trainers
    allClients: managerProcedure.query(async () => {
      return db.getAllClients();
    }),
    
    // Get all invitations across all trainers
    getAllInvitations: managerProcedure.query(async () => {
      return db.getAllInvitations();
    }),
    
    // Get all users (simple)
    allUsers: managerProcedure.query(async () => {
      return db.getAllUsers();
    }),
    
    // Get all users with filtering and pagination
    listUsers: managerProcedure
      .input(z.object({
        search: z.string().optional(),
        role: z.enum(["all", "shopper", "client", "trainer", "manager", "coordinator"]).optional(),
        status: z.enum(["all", "active", "suspended", "pending"]).optional(),
        sortBy: z.enum(["name", "email", "role", "createdAt", "lastSignedIn"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        limit: z.number().min(1).max(100).optional(),
        offset: z.number().min(0).optional(),
      }).optional())
      .query(async ({ input }) => {
        const { search, role, status, sortBy = "createdAt", sortOrder = "desc", limit = 50, offset = 0 } = input || {};
        const allUsers = await db.getAllUsers();
        
        // Get trainer approvals to determine status
        const trainerApprovals = await db.getPendingTrainers();
        const pendingTrainerIds = new Set(trainerApprovals.map(t => t.trainer_approvals.trainerId));
        const suspendedTrainerIds = new Set(
          trainerApprovals.filter(t => t.trainer_approvals.status === "suspended").map(t => t.trainer_approvals.trainerId)
        );
        
        let filtered = allUsers.map(u => ({
          ...u,
          status: pendingTrainerIds.has(u.id) ? "pending" : 
                  suspendedTrainerIds.has(u.id) ? "suspended" : "active"
        }));
        
        // Filter by role
        if (role && role !== "all") {
          filtered = filtered.filter(u => u.role === role);
        }
        
        // Filter by status
        if (status && status !== "all") {
          filtered = filtered.filter(u => u.status === status);
        }
        
        // Filter by search term
        if (search && search.trim()) {
          const searchLower = search.toLowerCase().trim();
          filtered = filtered.filter(u => 
            (u.name?.toLowerCase().includes(searchLower)) ||
            (u.email?.toLowerCase().includes(searchLower)) ||
            (u.username?.toLowerCase().includes(searchLower))
          );
        }
        
        // Sort
        filtered.sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case "name":
              comparison = (a.name || "").localeCompare(b.name || "");
              break;
            case "email":
              comparison = (a.email || "").localeCompare(b.email || "");
              break;
            case "role":
              const rolePriority: Record<string, number> = { coordinator: 0, manager: 1, trainer: 2, client: 3, shopper: 4 };
              comparison = (rolePriority[a.role] || 5) - (rolePriority[b.role] || 5);
              break;
            case "lastSignedIn":
              comparison = (a.lastSignedIn?.getTime() || 0) - (b.lastSignedIn?.getTime() || 0);
              break;
            case "createdAt":
            default:
              comparison = (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
              break;
          }
          return sortOrder === "desc" ? -comparison : comparison;
        });
        
        const total = filtered.length;
        const paginated = filtered.slice(offset, offset + limit);
        
        // Get role counts
        const roleCounts = {
          all: allUsers.length,
          shopper: allUsers.filter(u => u.role === "shopper").length,
          client: allUsers.filter(u => u.role === "client").length,
          trainer: allUsers.filter(u => u.role === "trainer").length,
          manager: allUsers.filter(u => u.role === "manager").length,
          coordinator: allUsers.filter(u => u.role === "coordinator").length,
        };
        
        return {
          users: paginated.map(u => ({
            id: u.id,
            openId: u.openId,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            username: u.username,
            photoUrl: u.photoUrl,
            createdAt: u.createdAt,
            lastSignedIn: u.lastSignedIn,
          })),
          total,
          hasMore: offset + limit < total,
          roleCounts,
        };
      }),
    
    // Get trainers with stats
    trainersWithStats: managerProcedure.query(async () => {
      return db.getTrainersWithStats();
    }),

    // Get single trainer details
    getTrainer: managerProcedure
      .input(z.object({ trainerId: z.number() }))
      .query(async ({ input }) => {
        const trainer = await db.getTrainerById(input.trainerId);
        if (!trainer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trainer not found" });
        }
        return trainer;
      }),
    
    // Get all bundles (for review history)
    allBundles: managerProcedure.query(async () => {
      return db.getAllBundles();
    }),

    // Get bundle details with components (from database and Shopify metafields)
    bundleDetails: managerProcedure
      .input(z.object({ bundleId: z.number() }))
      .query(async ({ input }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
        }

        // Get trainer info
        const trainer = await db.getUserById(bundle.trainerId);

        // Parse products from bundle's productsJson
        const products = (bundle.productsJson as Array<{
          id?: number;
          shopifyId?: number;
          name?: string;
          title?: string;
          quantity?: number;
          price?: string;
          image?: string;
          imageUrl?: string;
          inventory?: number;
        }>) || [];

        // Fetch inventory for products from database
        const productIds = products.map(p => p.id || p.shopifyId).filter(Boolean) as number[];
        const dbProducts = productIds.length > 0 ? await db.getProductsByIds(productIds) : [];

        // Get Shopify metafields if published
        let shopifyMetafields = null;
        if (bundle.shopifyProductId) {
          try {
            shopifyMetafields = await shopify.getBundleMetafields(bundle.shopifyProductId);
          } catch (error) {
            console.error("Failed to fetch Shopify metafields:", error);
          }
        }

        // Get publication info
        const publication = await db.getBundlePublicationByDraftId(bundle.id);

        return {
          id: bundle.id,
          title: bundle.title,
          description: bundle.description,
          price: bundle.price,
          imageUrl: bundle.imageUrl,
          status: bundle.status,
          cadence: bundle.cadence,
          createdAt: bundle.createdAt,
          updatedAt: bundle.updatedAt,
          trainer: trainer ? {
            id: trainer.id,
            name: trainer.name,
            email: trainer.email,
            photoUrl: trainer.photoUrl,
          } : null,
          products: products.map(p => {
            const dbProduct = dbProducts.find(dp => dp.id === (p.id || p.shopifyId));
            return {
              id: p.id || p.shopifyId || 0,
              name: p.name || p.title || "Product",
              quantity: p.quantity || 1,
              price: p.price,
              image: p.image || p.imageUrl,
              inventory: dbProduct?.inventoryQuantity ?? p.inventory,
            };
          }),
          shopify: bundle.shopifyProductId ? {
            productId: bundle.shopifyProductId,
            variantId: bundle.shopifyVariantId,
            adminUrl: `https://admin.shopify.com/store/bright-express-dev/products/${bundle.shopifyProductId}`,
            publicUrl: `https://bright-express-dev.myshopify.com/products/${bundle.title.toLowerCase().replace(/\s+/g, '-')}`,
            metafields: shopifyMetafields,
          } : null,
          publication: publication ? {
            id: publication.id,
            syncStatus: publication.syncStatus,
            lastSyncedAt: publication.syncedAt,
          } : null,
        };
      }),
    
    // Get bundles pending review
    pendingBundles: managerProcedure.query(async () => {
      return db.getBundlesPendingReview();
    }),
    
    // Approve bundle and publish to Shopify
    approveBundle: managerProcedure
      .input(z.object({
        bundleId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
        }
        if (bundle.status !== "pending_review" && bundle.status !== "pending_update") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bundle is not pending review or update" });
        }
        
        const isUpdate = bundle.status === "pending_update";
        
        // Get trainer info for the bundle
        const trainer = await db.getUserById(bundle.trainerId);
        const trainerName = trainer?.name || "Trainer";
        
        // Parse products from bundle
        const products = (bundle.productsJson as Array<{ id?: number; shopifyId?: number; name?: string; title?: string; quantity?: number }>) || [];
        const bundleProducts = products.map(p => ({
          id: p.id || p.shopifyId || 0,
          name: p.name || p.title || "Product",
          quantity: p.quantity || 1,
        }));
        
        // Update status to publishing
        await db.updateBundleDraft(input.bundleId, {
          status: "publishing",
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          rejectionReason: input.notes,
        });
        
        // Publish to Shopify (or update existing)
        let shopifyResult: { productId: number; variantId: number } | null = null;
        
        if (isUpdate) {
          // For updates, sync the existing product in Shopify
          const existingPub = await db.getBundlePublicationByDraftId(input.bundleId);
          if (existingPub?.shopifyProductId) {
            try {
              const priceNum = parseFloat(bundle.price?.toString() || "0");
              await shopify.syncBundleToShopify({
                shopifyProductId: existingPub.shopifyProductId,
                shopifyVariantId: existingPub.shopifyVariantId || "",
                title: bundle.title,
                description: bundle.description || "",
                basePrice: priceNum,
                minPrice: priceNum,
                maxPrice: priceNum,
                imageUrl: bundle.imageUrl || undefined,
                status: "active",
              });
              
              // Update publication sync status
              await db.updateBundleSyncStatus(existingPub.id, "synced");
              
              // Update draft status to published and clear snapshot
              await db.updateBundleDraft(input.bundleId, {
                status: "published",
                publishedSnapshot: null,
              });
              
              await db.logActivity({
                userId: ctx.user.id,
                action: "bundle_update_approved",
                entityType: "bundle_draft",
                entityId: input.bundleId,
              });
              
              return { success: true, isUpdate: true };
            } catch (error) {
              console.error("Failed to sync update to Shopify:", error);
              await db.updateBundleDraft(input.bundleId, { status: "failed" });
              throw new TRPCError({ 
                code: "INTERNAL_SERVER_ERROR", 
                message: "Failed to sync bundle update to Shopify" 
              });
            }
          }
        }
        
        // New bundle - publish to Shopify using native Bundles API
        try {
          // Try native bundle first (shows "Bundled products" UI in Shopify)
          shopifyResult = await shopify.publishNativeBundle({
            title: bundle.title,
            description: bundle.description || "",
            price: bundle.price?.toString() || "0",
            trainerId: bundle.trainerId,
            trainerName,
            products: bundleProducts,
            imageUrl: bundle.imageUrl || undefined,
          });
        } catch (error) {
          console.error("Failed to publish to Shopify:", error);
          // Update status to failed
          await db.updateBundleDraft(input.bundleId, {
            status: "failed",
          });
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Failed to publish bundle to Shopify" 
          });
        }
        
        if (shopifyResult) {
          // Create publication record with sync status
          await db.createBundlePublication({
            draftId: input.bundleId,
            shopifyProductId: shopifyResult.productId.toString(),
            shopifyVariantId: shopifyResult.variantId.toString(),
            state: "published",
            publishedAt: new Date(),
            syncedAt: new Date(),
            syncStatus: "synced",
          });
          
          // Update draft status to published and save Shopify IDs
          await db.updateBundleDraft(input.bundleId, {
            status: "published",
            shopifyProductId: shopifyResult.productId,
            shopifyVariantId: shopifyResult.variantId,
          });
        } else {
          // Update status to failed if no result
          await db.updateBundleDraft(input.bundleId, {
            status: "failed",
          });
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Failed to create Shopify product" 
          });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_approved_and_published",
          entityType: "bundle",
          entityId: input.bundleId,
        });
        
        return { 
          success: true,
          shopifyProductId: shopifyResult?.productId,
          shopifyVariantId: shopifyResult?.variantId,
        };
      }),
    
    // Reject bundle
    rejectBundle: managerProcedure
      .input(z.object({
        bundleId: z.number(),
        reason: z.string().min(1, "Rejection reason is required"),
      }))
      .mutation(async ({ input, ctx }) => {
        const bundle = await db.getBundleDraftById(input.bundleId);
        if (!bundle) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
        }
        if (bundle.status !== "pending_review") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Bundle is not pending review" });
        }
        
        await db.updateBundleDraft(input.bundleId, {
          status: "draft", // Send back to draft for revision
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          rejectionReason: input.reason,
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_rejected",
          entityType: "bundle",
          entityId: input.bundleId,
          details: { reason: input.reason },
        });
        
        return { success: true };
      }),
    
    // Get bundle sales analytics by Shopify product ID
    bundleAnalytics: managerProcedure
      .input(z.object({ shopifyProductId: z.string() }))
      .query(async ({ input }) => {
        const analytics = await db.getBundleSalesByShopifyProductId(input.shopifyProductId);
        return analytics;
      }),
    
    // Get bundles with low inventory components
    lowInventoryBundles: managerProcedure
      .input(z.object({ threshold: z.number().optional().default(10) }))
      .query(async ({ input }) => {
        return db.getBundlesWithLowInventory(input.threshold);
      }),
    
    // Automated low inventory check with notification
    runInventoryCheck: managerProcedure
      .input(z.object({
        threshold: z.number().min(0).max(100).default(5),
        sendNotification: z.boolean().default(true),
        forceSend: z.boolean().default(false),
      }).optional())
      .mutation(async ({ input }) => {
        const { checkLowInventory } = await import("./jobs/lowInventoryCheck");
        const threshold = input?.threshold ?? 5;
        const sendNotification = input?.sendNotification ?? true;
        const forceSend = input?.forceSend ?? false;
        
        return checkLowInventory(threshold, sendNotification, forceSend);
      }),
    
    // Send low inventory alert notification
    sendLowInventoryAlert: managerProcedure
      .input(z.object({
        bundleId: z.number(),
        bundleTitle: z.string(),
        lowInventoryProducts: z.array(z.object({
          productId: z.number(),
          productName: z.string(),
          inventory: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { notifyOwner } = await import("./_core/notification");
        
        const productList = input.lowInventoryProducts
          .map(p => `• ${p.productName}: ${p.inventory} in stock`)
          .join("\n");
        
        const delivered = await notifyOwner({
          title: `⚠️ Low Inventory Alert: ${input.bundleTitle}`,
          content: `The following products in bundle "${input.bundleTitle}" (ID: ${input.bundleId}) have low inventory:\n\n${productList}\n\nPlease restock these products to avoid stockouts.`,
        });
        
        return { success: delivered };
      }),
  }),

  // ============================================================================
  // RECOMMENDATIONS
  // ============================================================================
  recommendations: router({
    get: protectedProcedure
      .input(z.object({ targetType: z.enum(["client", "trainer", "bundle"]), targetId: z.number() }))
      .query(async ({ input }) => {
        return db.getActiveRecommendations(input.targetType, input.targetId);
      }),
  }),

  // ============================================================================
  // SHOPIFY PRODUCTS
  // ============================================================================
  shopify: router({
    // Fetch all products from Shopify store (excluding bundles)
    products: publicProcedure.query(async () => {
      const products = await shopify.fetchProducts();
      
      // Get all published bundle Shopify product IDs to filter them out
      const publishedBundles = await db.getAllBundlePublications();
      const bundleShopifyIds = new Set(
        publishedBundles
          .filter(b => b.shopifyProductId)
          .map(b => parseInt(b.shopifyProductId!, 10))
      );
      
      // Filter out products that are:
      // 1. Published bundles from our database
      // 2. Products with product_type "Bundle" in Shopify
      // 3. Products with "bundle" tag in Shopify
      const filteredProducts = products.filter(p => {
        // Exclude if in our published bundles
        if (bundleShopifyIds.has(p.id)) return false;
        
        // Exclude if product_type is "Bundle" (case-insensitive)
        if (p.product_type?.toLowerCase() === 'bundle') return false;
        
        // Exclude if has "bundle" tag (case-insensitive)
        if (p.tags?.toLowerCase().includes('bundle')) return false;
        
        return true;
      });
      
      return filteredProducts.map(p => ({
        id: p.id,
        title: p.title,
        description: p.body_html,
        vendor: p.vendor,
        productType: p.product_type,
        status: p.status,
        price: p.variants[0]?.price || "0",
        variantId: p.variants[0]?.id || 0,
        sku: p.variants[0]?.sku || "",
        inventory: p.variants[0]?.inventory_quantity || 0,
        imageUrl: p.images[0]?.src || "",
      }));
    }),

    // Fetch single product
    product: publicProcedure
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
          price: product.variants[0]?.price || "0",
          variantId: product.variants[0]?.id || 0,
          sku: product.variants[0]?.sku || "",
          inventory: product.variants[0]?.inventory_quantity || 0,
          imageUrl: product.images[0]?.src || "",
          images: product.images.map(img => ({ src: img.src, alt: img.alt })),
          variants: product.variants.map(v => ({
            id: v.id,
            title: v.title,
            price: v.price,
            sku: v.sku,
            inventory: v.inventory_quantity,
          })),
        };
      }),

    // Sync products to local database
    sync: managerProcedure.mutation(async ({ ctx }) => {
      const result = await shopify.syncProductsToDatabase(db.upsertProduct);
      await db.logActivity({
        userId: ctx.user.id,
        action: "products_synced",
        entityType: "product",
        entityId: 0,
        details: result,
      });
      return result;
    }),

    // Comprehensive sync of everything from Shopify (products, bundles, customers)
    syncEverything: managerProcedure.mutation(async ({ ctx }) => {
      console.log("[Shopify] Starting comprehensive sync...");
      const startTime = Date.now();
      
      const result = await shopify.syncEverythingFromShopify({
        upsertProduct: db.upsertProduct,
        getBundlePublications: async () => {
          const pubs = await db.getAllBundlePublications();
          return pubs.map(p => ({ shopifyProductId: p.shopifyProductId || "" }));
        },
        updateBundlePublication: async (shopifyProductId, data) => {
          // Find the publication by shopifyProductId and update it
          const pubs = await db.getAllBundlePublications();
          const pub = pubs.find(p => p.shopifyProductId === shopifyProductId);
          if (pub) {
            await db.updateBundleSyncStatus(pub.id, data.syncStatus, data.lastSyncError || undefined);
          }
        },
      });
      
      const durationMs = Date.now() - startTime;
      
      // Determine overall status
      const totalErrors = (result.products?.errors || 0) + (result.bundles?.errors || 0) + (result.customers?.errors || 0);
      const totalSynced = (result.products?.synced || 0) + (result.bundles?.synced || 0) + (result.customers?.synced || 0);
      const status = totalErrors === 0 ? "success" : (totalSynced > 0 ? "partial" : "failed");
      
      // Combine all synced and error items
      type SyncedItem = { id: number | string; name: string };
      type ErrorItem = { id: number | string; name: string; error: string };
      const allSyncedItems = [
        ...(result.products?.syncedItems || []).map((item: SyncedItem) => ({ type: "product", ...item })),
        ...(result.bundles?.syncedItems || []).map((item: SyncedItem) => ({ type: "bundle", ...item })),
        ...(result.customers?.syncedItems || []).map((item: SyncedItem) => ({ type: "customer", ...item })),
      ];
      const allErrorItems = [
        ...(result.products?.errorItems || []).map((item: ErrorItem) => ({ type: "product", ...item })),
        ...(result.bundles?.errorItems || []).map((item: ErrorItem) => ({ type: "bundle", ...item })),
        ...(result.customers?.errorItems || []).map((item: ErrorItem) => ({ type: "customer", ...item })),
      ];
      
      // Save sync result to database
      const syncResult = await db.saveSyncResult({
        triggeredBy: ctx.user.id,
        status: status as "success" | "partial" | "failed",
        productsSynced: result.products?.synced || 0,
        productsErrors: result.products?.errors || 0,
        bundlesSynced: result.bundles?.synced || 0,
        bundlesErrors: result.bundles?.errors || 0,
        customersSynced: result.customers?.synced || 0,
        customersErrors: result.customers?.errors || 0,
        syncedItems: allSyncedItems,
        errorItems: allErrorItems,
        durationMs,
      });
      
      await db.logActivity({
        userId: ctx.user.id,
        action: "shopify_full_sync",
        entityType: "system",
        entityId: syncResult.id,
        details: result,
      });
      
      console.log("[Shopify] Comprehensive sync complete:", result);
      return {
        success: true,
        syncResultId: syncResult.id,
        products: result.products,
        bundles: result.bundles,
        customers: result.customers,
        durationMs,
      };
    }),
    
    // Get the most recent sync result
    getLastSyncResult: managerProcedure.query(async () => {
      return await db.getLastSyncResult();
    }),
    
    // Get sync result by ID
    getSyncResult: managerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getSyncResultById(input.id);
      }),
    
    // Generate CSV for a sync result
    generateSyncCsv: managerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const syncResult = await db.getSyncResultById(input.id);
        if (!syncResult) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Sync result not found" });
        }
        
        // Generate CSV content
        const lines: string[] = [];
        lines.push("Type,Status,ID,Name,Error");
        
        // Add synced items
        const syncedItems = (syncResult.syncedItems as Array<{ type: string; id: string; name: string }>) || [];
        for (const item of syncedItems) {
          lines.push(`${item.type},synced,${item.id},"${(item.name || "").replace(/"/g, '""')}",`);
        }
        
        // Add error items
        const errorItems = (syncResult.errorItems as Array<{ type: string; id: string; name: string; error: string }>) || [];
        for (const item of errorItems) {
          lines.push(`${item.type},error,${item.id},"${(item.name || "").replace(/"/g, '""')}","${(item.error || "").replace(/"/g, '""')}"`);
        }
        
        const csvContent = lines.join("\n");
        
        // Upload to S3
        const { storagePut } = await import("./storage");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `sync-results/sync-${syncResult.id}-${timestamp}.csv`;
        const { url } = await storagePut(fileName, csvContent, "text/csv");
        
        // Update the sync result with the CSV URL
        await db.updateSyncResultCsvUrl(syncResult.id, url);
        
        return { url, fileName };
      }),

    // Publish bundle to Shopify
    publishBundle: trainerProcedure
      .input(z.object({
        title: z.string(),
        description: z.string(),
        price: z.string(),
        products: z.array(z.object({ id: z.number(), name: z.string(), quantity: z.number() })),
        imageUrl: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        console.log("[Shopify] publishBundle called with input:", JSON.stringify(input, null, 2));
        const user = ctx.user;
        console.log("[Shopify] User:", user.id, user.name);
        try {
          const result = await shopify.publishBundle({
            ...input,
            trainerId: user.id,
            trainerName: user.name || "Trainer",
          });
          console.log("[Shopify] publishBundle result:", result);
          if (result) {
            await db.logActivity({
              userId: user.id,
              action: "bundle_published_shopify",
              entityType: "product",
              entityId: result.productId,
            });
          }
          return result;
        } catch (error) {
          console.error("[Shopify] publishBundle error:", error);
          throw error;
        }
      }),

    // Get checkout URL
    checkoutUrl: publicProcedure
      .input(z.object({ variantId: z.number(), quantity: z.number().optional() }))
      .query(({ input }) => {
        return { url: shopify.getCheckoutUrl(input.variantId, input.quantity || 1) };
      }),

    // Sync all published bundles with Shopify
    syncBundles: managerProcedure.mutation(async ({ ctx }) => {
      console.log("[Shopify] Starting bundle sync...");
      
      const publications = await db.getPublishedBundlesForSync();
      let synced = 0;
      let failed = 0;
      
      for (const pub of publications) {
        if (!pub.shopifyProductId || !pub.shopifyVariantId) {
          continue;
        }
        
        // Get the bundle draft to get current data
        const draft = await db.getBundleDraftById(pub.draftId);
        if (!draft) {
          await db.updateBundleSyncStatus(pub.id, "failed", "Bundle draft not found");
          failed++;
          continue;
        }
        
        try {
          const result = await shopify.syncBundleToShopify({
            shopifyProductId: pub.shopifyProductId,
            shopifyVariantId: pub.shopifyVariantId,
            title: draft.title,
            description: draft.description || "",
            basePrice: parseFloat(draft.price?.toString() || "0"),
            minPrice: parseFloat(draft.price?.toString() || "0"),
            maxPrice: parseFloat(draft.price?.toString() || "0"),
            imageUrl: draft.imageUrl || undefined,
            status: draft.status === "published" ? "active" : "draft",
          });
          
          if (result.success) {
            await db.updateBundleSyncStatus(pub.id, "synced");
            synced++;
          } else {
            await db.updateBundleSyncStatus(pub.id, "failed", result.error);
            failed++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          await db.updateBundleSyncStatus(pub.id, "failed", errorMessage);
          failed++;
        }
      }
      
      await db.logActivity({
        userId: ctx.user.id,
        action: "bundles_synced",
        entityType: "bundle",
        details: { synced, failed, total: publications.length },
      });
      
      console.log(`[Shopify] Bundle sync complete: ${synced} synced, ${failed} failed`);
      return { success: true, synced, failed, total: publications.length };
    }),

    // Get bundle sync status
    getBundleSyncStatus: managerProcedure.query(async () => {
      const publications = await db.getPublishedBundlesForSync();
      const synced = publications.filter(p => p.syncStatus === "synced").length;
      const pending = publications.filter(p => p.syncStatus === "pending" || !p.syncStatus).length;
      const failed = publications.filter(p => p.syncStatus === "failed").length;
      const lastSyncedAt = publications
        .filter(p => p.syncedAt)
        .sort((a, b) => (b.syncedAt?.getTime() || 0) - (a.syncedAt?.getTime() || 0))[0]?.syncedAt || null;
      
      return {
        total: publications.length,
        synced,
        pending,
        failed,
        lastSyncedAt,
      };
    }),
    
    // Track bundle view (for analytics)
    trackBundleView: publicProcedure
      .input(z.object({ shopifyProductId: z.string() }))
      .mutation(async ({ input }) => {
        await db.incrementBundleViewCountByShopifyId(input.shopifyProductId);
        return { success: true };
      }),
    
    // Get bundle info by Shopify product ID (for extension API)
    getBundleByShopifyId: publicProcedure
      .input(z.object({ shopifyProductId: z.string() }))
      .query(async ({ input }) => {
        const productIdNum = parseInt(input.shopifyProductId, 10);
        const bundle = await db.getBundleByShopifyProductId(productIdNum);
        if (!bundle) return null;
        
        // Get trainer info
        const trainer = await db.getUserById(bundle.trainerId);
        
        // Get sales analytics from orders
        const orderAnalytics = await db.getBundleSalesByShopifyProductId(input.shopifyProductId);
        
        // Get view/conversion analytics from bundle record
        const bundleAnalytics = await db.getBundleAnalyticsByShopifyId(input.shopifyProductId);
        
        // Parse products
        const products = (bundle.productsJson as Array<{
          id?: number;
          shopifyId?: number;
          name?: string;
          title?: string;
          quantity?: number;
          price?: string;
          image?: string;
          imageUrl?: string;
        }>) || [];
        
        return {
          id: bundle.id,
          title: bundle.title,
          description: bundle.description,
          price: bundle.price,
          status: bundle.status,
          trainer: trainer ? {
            id: trainer.id,
            name: trainer.name,
          } : null,
          products: products.map(p => ({
            id: p.id || p.shopifyId || 0,
            name: p.name || p.title || "Product",
            quantity: p.quantity || 1,
            price: p.price,
            image: p.image || p.imageUrl,
          })),
          analytics: {
            salesCount: orderAnalytics.salesCount,
            totalRevenue: orderAnalytics.totalRevenue,
            lastSaleAt: orderAnalytics.lastSaleAt,
            viewCount: bundleAnalytics?.viewCount || 0,
            conversionRate: bundleAnalytics?.conversionRate || 0,
          },
        };
      }),
    
    // Update bundle component quantity (for extension editing)
    updateBundleComponent: managerProcedure
      .input(z.object({
        shopifyProductId: z.string(),
        componentId: z.number(),
        newQuantity: z.number().min(1).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        const productIdNum = parseInt(input.shopifyProductId, 10);
        const bundle = await db.getBundleByShopifyProductId(productIdNum);
        if (!bundle) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
        }
        
        // Parse and update products
        const products = (bundle.productsJson as Array<{
          id?: number;
          shopifyId?: number;
          name?: string;
          title?: string;
          quantity?: number;
          price?: string;
          image?: string;
        }>) || [];
        
        const updatedProducts = products.map(p => {
          const productId = p.id || p.shopifyId;
          if (productId === input.componentId) {
            return { ...p, quantity: input.newQuantity };
          }
          return p;
        });
        
        await db.updateBundleDraft(bundle.id, {
          productsJson: updatedProducts,
          status: "pending_update",
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_component_updated",
          entityType: "bundle",
          entityId: bundle.id,
          details: { componentId: input.componentId, newQuantity: input.newQuantity },
        });
        
        return { success: true };
      }),
    
    // Add component to bundle (for extension editing)
    addBundleComponent: managerProcedure
      .input(z.object({
        shopifyProductId: z.string(),
        componentId: z.number(),
        componentName: z.string(),
        quantity: z.number().min(1).max(100).default(1),
        price: z.string().optional(),
        image: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const productIdNum = parseInt(input.shopifyProductId, 10);
        const bundle = await db.getBundleByShopifyProductId(productIdNum);
        if (!bundle) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
        }
        
        // Parse products and add new component
        const products = (bundle.productsJson as Array<{
          id?: number;
          shopifyId?: number;
          name?: string;
          title?: string;
          quantity?: number;
          price?: string;
          image?: string;
        }>) || [];
        
        // Check if component already exists
        const existingIndex = products.findIndex(p => (p.id || p.shopifyId) === input.componentId);
        if (existingIndex >= 0) {
          // Update quantity instead
          products[existingIndex].quantity = (products[existingIndex].quantity || 1) + input.quantity;
        } else {
          products.push({
            id: input.componentId,
            name: input.componentName,
            quantity: input.quantity,
            price: input.price,
            image: input.image,
          });
        }
        
        await db.updateBundleDraft(bundle.id, {
          productsJson: products,
          status: "pending_update",
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_component_added",
          entityType: "bundle",
          entityId: bundle.id,
          details: { componentId: input.componentId, componentName: input.componentName, quantity: input.quantity },
        });
        
        return { success: true };
      }),
    
    // Remove component from bundle (for extension editing)
    removeBundleComponent: managerProcedure
      .input(z.object({
        shopifyProductId: z.string(),
        componentId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const productIdNum = parseInt(input.shopifyProductId, 10);
        const bundle = await db.getBundleByShopifyProductId(productIdNum);
        if (!bundle) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Bundle not found" });
        }
        
        // Parse and filter products
        const products = (bundle.productsJson as Array<{
          id?: number;
          shopifyId?: number;
          name?: string;
          title?: string;
          quantity?: number;
          price?: string;
          image?: string;
        }>) || [];
        
        const updatedProducts = products.filter(p => {
          const productId = p.id || p.shopifyId;
          return productId !== input.componentId;
        });
        
        if (updatedProducts.length === products.length) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Component not found in bundle" });
        }
        
        await db.updateBundleDraft(bundle.id, {
          productsJson: updatedProducts,
          status: "pending_update",
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "bundle_component_removed",
          entityType: "bundle",
          entityId: bundle.id,
          details: { componentId: input.componentId },
        });
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // TRAINER EARNINGS DASHBOARD
  // ============================================================================
  
  earnings: router({
    // Get earnings summary for a time period
    summary: trainerProcedure
      .input(z.object({
        period: z.enum(["week", "month", "year", "all"]),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return db.getTrainerEarningsSummary(ctx.user.id, input);
      }),
    
    // Get detailed earnings breakdown
    breakdown: trainerProcedure
      .input(z.object({
        period: z.enum(["week", "month", "year", "all"]),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return db.getTrainerEarningsBreakdown(ctx.user.id, input);
      }),
    
    // Get earnings history (recent transactions)
    history: trainerProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        return db.getTrainerEarningsHistory(ctx.user.id, input.limit);
      }),
    
    // Get delivery schedule
    deliveries: trainerProcedure
      .input(z.object({
        status: z.enum(["all", "pending", "in_progress", "completed"]).optional(),
        clientId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return db.getServiceDeliveriesByTrainer(ctx.user.id, {
          status: input.status as "pending" | "in_progress" | "completed" | "all" | undefined,
          clientId: input.clientId,
        });
      }),
    
    // Update delivery progress
    updateDelivery: trainerProcedure
      .input(z.object({
        deliveryId: z.number(),
        deliveredCount: z.number().optional(),
        status: z.enum(["pending", "in_progress", "completed"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verify the delivery belongs to this trainer
        const delivery = await db.getServiceDeliveryById(input.deliveryId);
        if (!delivery) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found" });
        }
        if (delivery.trainerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your delivery" });
        }
        
        // Calculate new status based on delivered count
        let newStatus = input.status;
        if (input.deliveredCount !== undefined) {
          if (input.deliveredCount >= delivery.totalQuantity) {
            newStatus = "completed";
          } else if (input.deliveredCount > 0) {
            newStatus = "in_progress";
          }
        }
        
        await db.updateServiceDelivery(input.deliveryId, {
          deliveredQuantity: input.deliveredCount,
          status: newStatus,
          notes: input.notes,
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "delivery_updated",
          entityType: "delivery",
          entityId: input.deliveryId,
          details: { deliveredCount: input.deliveredCount, status: newStatus },
        });
        
        return { success: true };
      }),
    
    // Increment delivery by 1 (quick action)
    incrementDelivery: trainerProcedure
      .input(z.object({ deliveryId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const delivery = await db.getServiceDeliveryById(input.deliveryId);
        if (!delivery) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found" });
        }
        if (delivery.trainerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Not your delivery" });
        }
        
        const newCount = (delivery.deliveredQuantity || 0) + 1;
        const newStatus = newCount >= delivery.totalQuantity ? "completed" : "in_progress";
        
        await db.updateServiceDelivery(input.deliveryId, {
          deliveredQuantity: newCount,
          status: newStatus,
        });
        
        return { success: true, newCount, status: newStatus };
      }),
  }),

  // ============================================================================
  // AD PARTNERSHIPS (Local Business Advertising)
  // ============================================================================
  
  ads: router({
    // Get trainer's referral code
    getReferralCode: trainerProcedure.query(({ ctx }) => {
      return { code: db.generateTrainerReferralCode(ctx.user.id) };
    }),
    
    // Get trainer's ad partnerships
    myPartnerships: trainerProcedure
      .input(z.object({
        status: z.enum(["all", "pending", "active", "paused", "cancelled", "expired"]).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getAdPartnershipsByTrainer(ctx.user.id, input?.status as any);
      }),
    
    // Get trainer's ad earnings summary
    earningsSummary: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerAdEarningsSummary(ctx.user.id);
    }),
    
    // Get trainer's ad earnings history
    earningsHistory: trainerProcedure
      .input(z.object({
        period: z.enum(["month", "year", "all"]).optional(),
        status: z.enum(["pending", "confirmed", "paid"]).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getAdEarningsByTrainer(ctx.user.id, input);
      }),
    
    // Get businesses referred by trainer
    myBusinesses: trainerProcedure.query(async ({ ctx }) => {
      return db.getLocalBusinessesByTrainer(ctx.user.id);
    }),
    
    // Create a new business referral (trainer submits business info)
    submitBusiness: trainerProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        website: z.string().url().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        category: z.enum([
          "sports_nutrition", "fitness_equipment", "physiotherapy",
          "healthy_food", "sports_retail", "wellness_recovery",
          "gym_studio", "health_insurance", "sports_events", "other"
        ]),
        contactName: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const businessId = await db.createLocalBusiness({
          ...input,
          referredByTrainerId: ctx.user.id,
          status: "pending",
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "business_referral_submitted",
          entityType: "local_business",
          entityId: businessId,
        });
        
        return { id: businessId };
      }),
    
    // Create ad partnership proposal
    createPartnership: trainerProcedure
      .input(z.object({
        businessId: z.number(),
        packageTier: z.enum(["bronze", "silver", "gold", "platinum"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Verify business exists and was referred by this trainer
        const business = await db.getLocalBusinessById(input.businessId);
        if (!business) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Business not found" });
        }
        if (business.referredByTrainerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only create partnerships for businesses you referred" });
        }
        
        const partnershipId = await db.createAdPartnership({
          trainerId: ctx.user.id,
          businessId: input.businessId,
          packageTier: input.packageTier,
          notes: input.notes,
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "ad_partnership_created",
          entityType: "ad_partnership",
          entityId: partnershipId,
        });
        
        return { id: partnershipId };
      }),
    
    // Get active ad placements for bundle sidebar
    getBundleSidebarAds: publicProcedure
      .input(z.object({
        bundleId: z.number().optional(),
        trainerId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        return db.getActiveAdPlacements("bundle_sidebar", input);
      }),
    
    // Record ad impression
    recordImpression: publicProcedure
      .input(z.object({ placementId: z.number() }))
      .mutation(async ({ input }) => {
        await db.recordAdImpression(input.placementId);
        return { success: true };
      }),
    
    // Record ad click
    recordClick: publicProcedure
      .input(z.object({ placementId: z.number() }))
      .mutation(async ({ input }) => {
        await db.recordAdClick(input.placementId);
        return { success: true };
      }),
    
    // Manager: Get all pending businesses
    pendingBusinesses: managerProcedure.query(async () => {
      return db.getAllLocalBusinesses("pending");
    }),
    
    // Manager: Approve business
    approveBusiness: managerProcedure
      .input(z.object({ businessId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.approveLocalBusiness(input.businessId, ctx.user.id);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "business_approved",
          entityType: "local_business",
          entityId: input.businessId,
        });
        
        return { success: true };
      }),
    
    // Manager: Get all pending partnerships
    pendingPartnerships: managerProcedure.query(async () => {
      return db.getAllAdPartnerships("pending");
    }),
    
    // Manager: Approve partnership
    approvePartnership: managerProcedure
      .input(z.object({ partnershipId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.approveAdPartnership(input.partnershipId, ctx.user.id);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "ad_partnership_approved",
          entityType: "ad_partnership",
          entityId: input.partnershipId,
        });
        
        return { success: true };
      }),
    
    // Manager: Create ad placement for approved partnership
    createPlacement: managerProcedure
      .input(z.object({
        partnershipId: z.number(),
        placementType: z.enum(["bundle_sidebar", "vending_screen", "trainer_profile", "email_newsletter", "receipt_confirmation"]),
        headline: z.string().optional(),
        description: z.string().optional(),
        imageUrl: z.string().url().optional(),
        linkUrl: z.string().url().optional(),
        ctaText: z.string().optional(),
        trainerId: z.number().optional(),
        bundleId: z.number().optional(),
        priority: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const partnership = await db.getAdPartnershipById(input.partnershipId);
        if (!partnership) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Partnership not found" });
        }
        
        const placementId = await db.createAdPlacement({
          partnershipId: input.partnershipId,
          businessId: partnership.businessId,
          placementType: input.placementType,
          headline: input.headline,
          description: input.description,
          imageUrl: input.imageUrl,
          linkUrl: input.linkUrl,
          ctaText: input.ctaText,
          trainerId: input.trainerId,
          bundleId: input.bundleId,
          priority: input.priority || 0,
          isActive: true,
        });
        
        return { id: placementId };
      }),
    
    // Manager: Get all partnerships
    allPartnerships: managerProcedure
      .input(z.object({
        status: z.enum(["pending", "active", "paused", "cancelled", "expired"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllAdPartnerships(input?.status);
      }),
    
    // Manager: Get all businesses
    allBusinesses: managerProcedure
      .input(z.object({
        status: z.enum(["pending", "active", "suspended", "inactive"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllLocalBusinesses(input?.status);
      }),
  }),

  // ============================================================================
  // BUSINESS SIGNUP (Public endpoint for business referral landing page)
  // ============================================================================
  
  businessSignup: router({
    // Validate referral code and get trainer info
    validateReferral: publicProcedure
      .input(z.object({ code: z.string() }))
      .query(async ({ input }) => {
        // Parse trainer ID from referral code (format: LM{trainerId}{6chars})
        const match = input.code.match(/^LM(\d+)/);
        if (!match) {
          return { valid: false, trainer: null };
        }
        
        const trainerId = parseInt(match[1], 10);
        const trainer = await db.getUserById(trainerId);
        
        if (!trainer || trainer.role !== "trainer") {
          return { valid: false, trainer: null };
        }
        
        return {
          valid: true,
          trainer: {
            id: trainer.id,
            name: trainer.name,
            photoUrl: trainer.photoUrl,
          },
        };
      }),
    
    // Submit business signup from landing page
    submit: publicProcedure
      .input(z.object({
        referralCode: z.string(),
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        website: z.string().url().optional().or(z.literal("")),
        address: z.string().optional(),
        city: z.string().optional(),
        category: z.enum([
          "sports_nutrition", "fitness_equipment", "physiotherapy",
          "healthy_food", "sports_retail", "wellness_recovery",
          "gym_studio", "health_insurance", "sports_events", "other"
        ]),
        contactName: z.string(),
        description: z.string().optional(),
        interestedPackage: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
      }))
      .mutation(async ({ input }) => {
        // Parse trainer ID from referral code
        const match = input.referralCode.match(/^LM(\d+)/);
        if (!match) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid referral code" });
        }
        
        const trainerId = parseInt(match[1], 10);
        const trainer = await db.getUserById(trainerId);
        
        if (!trainer || trainer.role !== "trainer") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid referral code" });
        }
        
        // Create the business
        const businessId = await db.createLocalBusiness({
          name: input.name,
          email: input.email,
          phone: input.phone,
          website: input.website || undefined,
          address: input.address,
          city: input.city,
          category: input.category,
          contactName: input.contactName,
          description: input.description,
          referredByTrainerId: trainerId,
          status: "pending",
        });
        
        // If interested in a package, create a pending partnership
        if (input.interestedPackage) {
          await db.createAdPartnership({
            trainerId,
            businessId,
            packageTier: input.interestedPackage,
            notes: `Business signup via referral link. Contact: ${input.contactName}`,
          });
        }
        
        return { success: true, businessId };
      }),
  }),

  // ============================================================================
  // CLIENT SPENDING DASHBOARD
  // ============================================================================
  
  clientSpending: router({
    // Get spending summary
    summary: protectedProcedure
      .input(z.object({
        period: z.enum(["month", "year", "all"]),
        trainerId: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return db.getClientSpendingSummary(ctx.user.id, input);
      }),
    
    // Get transaction list
    transactions: protectedProcedure
      .input(z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
        trainerId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input, ctx }) => {
        return db.getClientTransactions(ctx.user.id, input);
      }),
    
    // Get transaction detail
    transactionDetail: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input, ctx }) => {
        return db.getTransactionDetail(input.orderId, ctx.user.id);
      }),
    
    // Generate PDF receipt
    generateReceipt: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const { generateReceiptHTML, buildReceiptData } = await import("./pdfReceipt");
        const { storagePut } = await import("./storage");
        
        // Get order details
        const detail = await db.getTransactionDetail(input.orderId, ctx.user.id);
        if (!detail) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
        }
        
        // Build line items from order
        const lineItems = [
          ...detail.products.map(p => ({
            type: "product" as const,
            name: p.name,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            totalPrice: p.totalPrice,
          })),
          ...detail.services.map(s => ({
            type: "service" as const,
            name: s.name,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            totalPrice: s.totalPrice,
          })),
        ];
        
        // Build receipt data
        const receiptData = buildReceiptData(
          {
            id: detail.order.id,
            totalAmount: String(detail.order.total),
            createdAt: detail.order.date,
            paymentMethod: null,
          },
          {
            name: ctx.user.name,
            email: ctx.user.email,
          },
          {
            name: detail.trainer?.name || null,
          },
          detail.order.bundleTitle || "Bundle",
          lineItems
        );
        
        // Generate HTML
        const html = generateReceiptHTML(receiptData);
        
        // Store HTML as file (can be converted to PDF client-side or via service)
        const fileKey = `receipts/${ctx.user.id}/receipt-${input.orderId}-${Date.now()}.html`;
        const { url } = await storagePut(fileKey, Buffer.from(html), "text/html");
        
        return { 
          receiptUrl: url,
          receiptNumber: receiptData.receiptNumber,
          html: html,
        };
      }),
  }),

  // ============================================================================
  // TRAINER POINTS & LOYALTY SYSTEM
  // ============================================================================
  
  points: router({
    // Get points summary
    summary: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerPointsSummary(ctx.user.id);
    }),
    
    // Get point transactions history
    transactions: trainerProcedure
      .input(z.object({
        limit: z.number().optional(),
        offset: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getTrainerPointTransactions(ctx.user.id, input);
      }),
    
    // Get awards
    awards: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerAwards(ctx.user.id);
    }),
    
    // Manager: Add points manually (for adjustments)
    addPoints: managerProcedure
      .input(z.object({
        trainerId: z.number(),
        points: z.number(),
        description: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.addTrainerPoints(
          input.trainerId,
          input.points,
          "adjustment",
          { description: input.description }
        );
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "points_adjusted",
          entityType: "trainer_points",
          entityId: input.trainerId,
          details: { points: input.points, description: input.description },
        });
        
        return result;
      }),
    
    // Manager: Create award
    createAward: managerProcedure
      .input(z.object({
        trainerId: z.number(),
        awardType: z.enum([
          "tier_achieved", "monthly_top_seller", "client_milestone",
          "revenue_milestone", "perfect_delivery", "five_star_reviews",
          "ad_champion", "retention_master"
        ]),
        awardName: z.string(),
        description: z.string().optional(),
        pointsAwarded: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.createTrainerAward(input);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "award_created",
          entityType: "trainer_award",
          entityId: input.trainerId,
          details: { awardType: input.awardType, awardName: input.awardName },
        });
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // MANAGER AD APPROVAL WORKFLOW
  // ============================================================================
  
  adApprovals: router({
    // Get approval stats
    stats: managerProcedure.query(async () => {
      return db.getAdApprovalStats();
    }),
    
    // Get pending business applications
    pendingBusinesses: managerProcedure.query(async () => {
      return db.getPendingBusinessApplications();
    }),
    
    // Get pending ad partnerships
    pendingPartnerships: managerProcedure.query(async () => {
      return db.getPendingAdPartnerships();
    }),
    
    // Approve business
    approveBusiness: managerProcedure
      .input(z.object({ businessId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.approveBusinessApplication(input.businessId, ctx.user.id);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "business_application_approved",
          entityType: "local_business",
          entityId: input.businessId,
        });
        
        return { success: true };
      }),
    
    // Reject business
    rejectBusiness: managerProcedure
      .input(z.object({
        businessId: z.number(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.rejectBusinessApplication(input.businessId, input.reason);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "business_application_rejected",
          entityType: "local_business",
          entityId: input.businessId,
          details: { reason: input.reason },
        });
        
        return { success: true };
      }),
    
    // Approve partnership
    approvePartnership: managerProcedure
      .input(z.object({
        partnershipId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.approveAdPartnership(input.partnershipId, ctx.user.id);
        
        // Award bonus points to trainer
        const partnership = await db.getAdPartnershipById(input.partnershipId);
        if (partnership && partnership.bonusPointsAwarded) {
          await db.addTrainerPoints(
            partnership.trainerId,
            partnership.bonusPointsAwarded,
            "ad_partnership_sale",
            {
              referenceType: "ad_partnership",
              referenceId: input.partnershipId,
              description: `Ad partnership approved - ${partnership.packageTier} tier`,
            }
          );
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "ad_partnership_approved",
          entityType: "ad_partnership",
          entityId: input.partnershipId,
        });
        
        return { success: true };
      }),
    
    // Reject partnership
    rejectPartnership: managerProcedure
      .input(z.object({
        partnershipId: z.number(),
        reason: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateAdPartnership(input.partnershipId, {
          status: "cancelled",
          notes: `Rejected: ${input.reason}`,
        });
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "ad_partnership_rejected",
          entityType: "ad_partnership",
          entityId: input.partnershipId,
          details: { reason: input.reason },
        });
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // MONTHLY AWARDS MANAGEMENT
  // ============================================================================
  
  monthlyAwards: router({
    // Calculate awards for a specific month (preview without saving)
    calculate: managerProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return db.calculateMonthlyAwards(input.year, input.month);
      }),
    
    // Process and save awards for a specific month
    process: managerProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .mutation(async ({ input, ctx }) => {
        const awardsCreated = await db.processMonthlyAwards(input.year, input.month);
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "monthly_awards_processed",
          entityType: "monthly_awards",
          entityId: input.year * 100 + input.month,
          details: { year: input.year, month: input.month, awardsCreated },
        });
        
        return { success: true, awardsCreated };
      }),
    
    // Get awards summary for a specific month
    summary: managerProcedure
      .input(z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      }))
      .query(async ({ input }) => {
        return db.getMonthlyAwardsSummary(input.year, input.month);
      }),
  }),

  // ============================================================================
  // PRODUCT DELIVERIES
  // ============================================================================
  productDeliveries: router({
    // Trainer: Get pending deliveries
    trainerPending: trainerProcedure
      .query(async ({ ctx }) => {
        return db.getTrainerPendingDeliveries(ctx.user.id);
      }),
    
    // Trainer: Get all deliveries with filters
    trainerList: trainerProcedure
      .input(z.object({
        status: z.string().optional(),
        clientId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getTrainerDeliveries(ctx.user.id, input);
      }),
    
    // Trainer: Get delivery statistics
    trainerStats: trainerProcedure
      .query(async ({ ctx }) => {
        return db.getTrainerDeliveryStats(ctx.user.id);
      }),
    
    // Trainer: Mark delivery as ready
    markReady: trainerProcedure
      .input(z.object({ deliveryId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.markDeliveryReady(input.deliveryId, ctx.user.id);
        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found or already processed" });
        }
        return { success: true };
      }),
    
    // Trainer: Mark delivery as delivered
    markDelivered: trainerProcedure
      .input(z.object({
        deliveryId: z.number(),
        notes: z.string().optional(),
        deliveryMethod: z.enum(["in_person", "locker", "front_desk", "shipped"]).optional(),
        trackingNumber: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.markDeliveryDelivered(input.deliveryId, ctx.user.id, {
          notes: input.notes,
          deliveryMethod: input.deliveryMethod,
          trackingNumber: input.trackingNumber,
        });
        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found or already delivered" });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "product_delivered",
          entityType: "product_delivery",
          entityId: input.deliveryId,
          details: { deliveryMethod: input.deliveryMethod },
        });
        
        return { success: true };
      }),
    
    // Trainer: Schedule a delivery
    schedule: trainerProcedure
      .input(z.object({
        deliveryId: z.number(),
        scheduledDate: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.scheduleDelivery(input.deliveryId, ctx.user.id, input.scheduledDate);
        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found" });
        }
        return { success: true };
      }),
    
    // Client: Get deliveries
    clientList: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        trainerId: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        return db.getClientDeliveries(ctx.user.id, input);
      }),
    
    // Client: Confirm receipt
    confirmReceipt: protectedProcedure
      .input(z.object({
        deliveryId: z.number(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.confirmDeliveryReceipt(input.deliveryId, ctx.user.id, input.notes);
        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found or not yet delivered" });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "delivery_confirmed",
          entityType: "product_delivery",
          entityId: input.deliveryId,
        });
        
        return { success: true };
      }),
    
    // Client: Report issue
    reportIssue: protectedProcedure
      .input(z.object({
        deliveryId: z.number(),
        notes: z.string().min(10, "Please provide details about the issue"),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.reportDeliveryIssue(input.deliveryId, ctx.user.id, input.notes);
        if (!result.success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found or not yet delivered" });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "delivery_issue_reported",
          entityType: "product_delivery",
          entityId: input.deliveryId,
          details: { notes: input.notes },
        });
        
        // Send SMS notification to all managers about the dispute
        if (result.delivery) {
          const { sendSms } = await import("./_core/sms");
          const managers = await db.getManagerPhoneNumbers();
          const client = await db.getUserById(ctx.user.id);
          const trainer = await db.getUserById(result.delivery.trainerId);
          
          const message = `🚨 Delivery Dispute: ${client?.name || "Client"} has disputed delivery of "${result.delivery.productName}" from trainer ${trainer?.name || "Unknown"}. Please review in the manager dashboard.`;
          
          // Send to all managers with phone numbers
          for (const manager of managers) {
            try {
              await sendSms({ to: manager.phone, message });
            } catch (e) {
              console.error(`Failed to send dispute SMS to manager ${manager.id}:`, e);
            }
          }
        }
        
        return { success: true };
      }),
    
    // Client: Request reschedule
    requestReschedule: protectedProcedure
      .input(z.object({
        deliveryId: z.number(),
        proposedDate: z.date(),
        reason: z.string().min(5, "Please provide a reason for rescheduling"),
      }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.requestDeliveryReschedule(
          input.deliveryId,
          ctx.user.id,
          input.proposedDate,
          input.reason
        );
        if (!success) {
          throw new TRPCError({ 
            code: "BAD_REQUEST", 
            message: "Cannot reschedule this delivery. It may already have a pending request or be in an invalid state." 
          });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "reschedule_requested",
          entityType: "product_delivery",
          entityId: input.deliveryId,
          details: { proposedDate: input.proposedDate, reason: input.reason },
        });
        
        return { success: true };
      }),
    
    // Trainer: Get pending reschedule requests
    rescheduleRequests: trainerProcedure
      .query(async ({ ctx }) => {
        return db.getTrainerRescheduleRequests(ctx.user.id);
      }),
    
    // Trainer: Approve reschedule request
    approveReschedule: trainerProcedure
      .input(z.object({
        deliveryId: z.number(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.approveDeliveryReschedule(input.deliveryId, ctx.user.id, input.note);
        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Reschedule request not found" });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "reschedule_approved",
          entityType: "product_delivery",
          entityId: input.deliveryId,
        });
        
        return { success: true };
      }),
    
    // Trainer: Reject reschedule request
    rejectReschedule: trainerProcedure
      .input(z.object({
        deliveryId: z.number(),
        note: z.string().min(5, "Please provide a reason for rejecting"),
      }))
      .mutation(async ({ input, ctx }) => {
        const success = await db.rejectDeliveryReschedule(input.deliveryId, ctx.user.id, input.note);
        if (!success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Reschedule request not found" });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "reschedule_rejected",
          entityType: "product_delivery",
          entityId: input.deliveryId,
          details: { note: input.note },
        });
        
        return { success: true };
      }),

    // Manager: List all deliveries with filters
    managerList: managerProcedure
      .input(z.object({
        status: z.string().optional(),
        trainerId: z.number().optional(),
        clientId: z.number().optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.getAllDeliveries(input);
      }),

    // Manager: Resolve a dispute
    resolveDispute: managerProcedure
      .input(z.object({
        deliveryId: z.number(),
        resolutionType: z.enum(["refund", "redeliver", "close", "escalate"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await db.resolveDeliveryDispute(
          input.deliveryId,
          ctx.user.id,
          input.resolutionType,
          input.notes
        );
        if (!result.success) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found or not disputed" });
        }
        
        await db.logActivity({
          userId: ctx.user.id,
          action: "dispute_resolved",
          entityType: "product_delivery",
          entityId: input.deliveryId,
          details: { resolutionType: input.resolutionType, notes: input.notes },
        });
        
        // Send SMS notification to client about resolution
        if (result.clientId) {
          const { sendSms } = await import("./_core/sms");
          const client = await db.getClientForNotification(result.clientId);
          
          if (client?.phone) {
            const resolutionMessages: Record<string, string> = {
              refund: "A full refund will be processed to your original payment method.",
              redeliver: "The product will be redelivered to you. Your trainer will contact you to arrange a new delivery date.",
              close: "The dispute has been closed after review.",
              escalate: "Your case has been escalated for further review. We will contact you shortly.",
            };
            
            const message = `✅ Dispute Resolved: Your dispute for "${result.productName}" has been resolved. ${resolutionMessages[input.resolutionType] || ""} ${input.notes ? `Note: ${input.notes}` : ""}`;
            
            try {
              await sendSms({ to: client.phone, message });
            } catch (e) {
              console.error(`Failed to send resolution SMS to client ${result.clientId}:`, e);
            }
          }
        }
        
        return { success: true };
      }),
  }),

  // ============================================================================
  // TRAINER LOYALTY POINTS
  // ============================================================================
  trainerPoints: router({
    // Get points summary for current trainer
    summary: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerPointsSummary(ctx.user.id);
    }),
    
    // Get transaction history
    transactions: trainerProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ ctx, input }) => {
        return db.getTrainerPointTransactions(ctx.user.id, input);
      }),
    
    // Get awards
    awards: trainerProcedure.query(async ({ ctx }) => {
      return db.getTrainerAwards(ctx.user.id);
    }),
    
    // Get tier benefits info (public info about all tiers)
    tierInfo: publicProcedure.query(() => {
      return {
        tiers: [
          { name: "bronze", threshold: 0, label: "Bronze", color: "#CD7F32" },
          { name: "silver", threshold: 1000, label: "Silver", color: "#C0C0C0" },
          { name: "gold", threshold: 5000, label: "Gold", color: "#FFD700" },
          { name: "platinum", threshold: 20000, label: "Platinum", color: "#E5E4E2" },
        ],
        benefits: {
          bronze: {
            commissionBonus: 0,
            prioritySupport: false,
            featuredListing: false,
            exclusiveProducts: false,
          },
          silver: {
            commissionBonus: 2,
            prioritySupport: true,
            featuredListing: false,
            exclusiveProducts: false,
          },
          gold: {
            commissionBonus: 5,
            prioritySupport: true,
            featuredListing: true,
            exclusiveProducts: false,
          },
          platinum: {
            commissionBonus: 10,
            prioritySupport: true,
            featuredListing: true,
            exclusiveProducts: true,
          },
        },
        howToEarn: [
          { type: "bundle_sale", description: "Earn 1 point per £1 of commission earned", icon: "shopping-cart" },
          { type: "new_client_bonus", description: "100 bonus points for first sale to a new client", icon: "user-plus" },
          { type: "client_retention", description: "50 bonus points for repeat purchases from existing clients", icon: "heart" },
          { type: "ad_partnership_sale", description: "500-5,000 points for selling ad partnerships", icon: "megaphone" },
          { type: "referral_bonus", description: "500 points for referring a new trainer who makes their first sale", icon: "users" },
        ],
      };
    }),
  }),

});

export type AppRouter = typeof appRouter;
