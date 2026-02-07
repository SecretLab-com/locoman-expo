import { createExpressMiddleware } from "@trpc/server/adapters/express";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import { appRouter } from "../routers";
import * as adyen from "../adyen";
import * as db from "../db";
import * as shopify from "../shopify";
import { createContext } from "./context";
import { logError, logEvent } from "./logger";
import { registerOAuthRoutes } from "./oauth";
import { setupWebSocket } from "./websocket";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Impersonate-User-Id",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.post("/api/shopify/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const hmac = req.get("x-shopify-hmac-sha256") || "";
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody) || !shopify.verifyShopifyWebhook(rawBody, hmac)) {
      logError("shopify.webhook_invalid", new Error("Invalid webhook signature"));
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    res.status(200).json({ ok: true });

    setImmediate(() => {
      shopify
        .syncProductsFromShopify()
        .then(({ synced, errors }) => {
          logEvent("shopify.webhook_synced", { synced, errors });
        })
        .catch((error) => {
          logError("shopify.webhook_sync_failed", error);
        });
    });
  });

  // Adyen webhook — must be before JSON body parser for raw body access
  app.post("/api/webhooks/adyen", express.json(), async (req, res) => {
    try {
      const notificationItems = req.body?.notificationItems || [];
      for (const item of notificationItems) {
        const notification = item?.NotificationRequestItem;
        if (!notification) continue;

        const hmacSignature =
          notification.additionalData?.hmacSignature || "";
        if (!adyen.verifyAdyenWebhook(notification, hmacSignature)) {
          logError("adyen.webhook_invalid_hmac", new Error("Invalid HMAC"));
          continue;
        }

        const eventCode = notification.eventCode || "";
        const merchantReference = notification.merchantReference || "";
        const pspReference = notification.pspReference || "";
        const success = notification.success === "true";
        const amountMinor = notification.amount?.value;
        const currency = notification.amount?.currency;
        const paymentMethod = notification.paymentMethod || "";
        const reason = notification.reason || "";

        // Log every webhook event
        await db.createPaymentLog({
          merchantReference,
          pspReference,
          eventCode,
          success,
          amountMinor,
          currency,
          paymentMethod,
          rawPayload: notification,
          reason,
        });

        // Update payment session status
        if (eventCode === "AUTHORISATION" && success) {
          await db.updatePaymentSessionByReference(merchantReference, {
            status: "authorised",
            pspReference,
            completedAt: new Date().toISOString(),
          });
          logEvent("adyen.payment_authorised", { merchantReference, pspReference });
        } else if (eventCode === "AUTHORISATION" && !success) {
          await db.updatePaymentSessionByReference(merchantReference, {
            status: "refused",
            pspReference,
          });
          logEvent("adyen.payment_refused", { merchantReference, reason });
        } else if (eventCode === "CAPTURE" && success) {
          await db.updatePaymentSessionByReference(merchantReference, {
            status: "captured",
            pspReference,
          });
          logEvent("adyen.payment_captured", { merchantReference });
        } else if (eventCode === "CANCELLATION" && success) {
          await db.updatePaymentSessionByReference(merchantReference, {
            status: "cancelled",
            pspReference,
          });
          logEvent("adyen.payment_cancelled", { merchantReference });
        } else if (eventCode === "REFUND" && success) {
          await db.updatePaymentSessionByReference(merchantReference, {
            status: "refunded",
            pspReference,
          });
          logEvent("adyen.payment_refunded", { merchantReference });
        }
      }

      // Adyen requires [accepted] response
      res.status(200).json({ notificationResponse: "[accepted]" });
    } catch (error) {
      logError("adyen.webhook_error", error);
      res.status(200).json({ notificationResponse: "[accepted]" });
    }
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve static uploads
  app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");

  setupWebSocket(server);

  server.listen(preferredPort, () => {
    logEvent("server.started", { port: preferredPort });
    logEvent("websocket.ready", { url: `ws://localhost:${preferredPort}/ws` });
  });
  server.on("error", (error) => {
    logError("server.start_failed", error, { port: preferredPort });
    process.exit(1);
  });
}

startServer().catch(console.error);
