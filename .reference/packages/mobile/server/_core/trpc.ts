import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Role-based procedure helpers
export const trainerProcedure = protectedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const user = ctx.user;
    if (!user || !["trainer", "manager", "coordinator"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Trainer access required" });
    }
    return next({ ctx: { ...ctx, user } });
  })
);

export const managerProcedure = protectedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const user = ctx.user;
    if (!user || !["manager", "coordinator"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Manager access required" });
    }
    return next({ ctx: { ...ctx, user } });
  })
);

export const coordinatorProcedure = protectedProcedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    const user = ctx.user;
    if (!user || user.role !== "coordinator") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Coordinator access required" });
    }
    return next({ ctx: { ...ctx, user } });
  })
);

// Legacy admin procedure - maps to coordinator
export const adminProcedure = coordinatorProcedure;
