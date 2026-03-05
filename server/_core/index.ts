import { createExpressMiddleware } from "@trpc/server/adapters/express";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import * as adyen from "../adyen";
import * as db from "../db";
import { appRouter } from "../routers";
import * as shopify from "../shopify";
import { createContext } from "./context";
import { ENV } from "./env";
import { logError, logEvent, logWarn } from "./logger";
import { processPhylloWebhookPayload } from "./phyllo-webhook";
import { verifyPhylloWebhookSignature } from "./phyllo";
let registerTrainerAssistantMcpHttpRoutes: ((app: any) => void) | null = null;
try {
  registerTrainerAssistantMcpHttpRoutes = require("./mcp-http").registerTrainerAssistantMcpHttpRoutes;
} catch (e) {
  console.warn("[MCP] HTTP routes not available:", (e as Error).message?.substring(0, 80));
}
import { registerOAuthRoutes } from "./oauth";
import { setupWebSocket } from "./websocket";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const configuredAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const derivedProdOrigins = [
    process.env.EXPO_PUBLIC_APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.EXPO_PUBLIC_API_BASE_URL,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  const allowedOrigins = Array.from(
    new Set([...configuredAllowedOrigins, ...derivedProdOrigins]),
  );
  const localDevOrigins = new Set([
    "http://localhost:8081",
    "http://localhost:3000",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:3000",
    "https://localhost:8081",
    "https://localhost:3000",
    "https://127.0.0.1:8081",
    "https://127.0.0.1:3000",
  ]);
  const allowAnyDevOrigin =
    process.env.NODE_ENV !== "production" && allowedOrigins.length === 0;

  // CORS: allow configured origins; in development only, allow all when no allowlist is set.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isLocalDevOrigin = Boolean(origin && localDevOrigins.has(origin));
    const isAllowedOrigin =
      !origin || isLocalDevOrigin || allowAnyDevOrigin || allowedOrigins.includes(origin);

    if (origin && isAllowedOrigin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Impersonate-User-Id, X-LOCO-MCP-KEY, MCP-Session-Id, Last-Event-ID",
    );
    if (isAllowedOrigin) {
      res.header("Access-Control-Allow-Credentials", "true");
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(isAllowedOrigin ? 200 : 403);
      return;
    }

    if (!isAllowedOrigin) {
      res.status(403).json({ error: "Origin not allowed" });
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

  app.post("/api/webhooks/phyllo", express.raw({ type: "application/json" }), async (req, res) => {
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
      res.status(400).json({ error: "Invalid webhook payload" });
      return;
    }
    const signature =
      req.get("x-phyllo-signature") || req.get("x-phyllo-signature-v2") || "";
    const webhookSecret = String(ENV.phylloWebhookSecret || "").trim();
    if (webhookSecret) {
      const valid = verifyPhylloWebhookSignature({
        rawBody,
        signatureHeader: signature,
        secret: webhookSecret,
      });
      if (!valid) {
        logError("phyllo.webhook_invalid_signature", new Error("Invalid webhook signature"));
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    } else {
      logWarn("phyllo.webhook_missing_secret", {
        path: "/api/webhooks/phyllo",
        environment: process.env.NODE_ENV || "development",
      });
      if (process.env.NODE_ENV === "production") {
        res.status(500).json({ error: "Webhook secret is not configured" });
        return;
      }
    }

    let payload: any = null;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      res.status(400).json({ error: "Webhook body must be valid JSON" });
      return;
    }

    res.status(200).json({ ok: true });

    setImmediate(() => {
      processPhylloWebhookPayload(payload)
        .then((eventsCount) => {
          logEvent("phyllo.webhook_enqueued", { eventsCount });
        })
        .catch((error) => {
          logError("phyllo.webhook_processing_failed", error);
        });
    });
  });

  // Native social connect bridge for iOS/Android.
  // This endpoint avoids requiring an authenticated bright.coach web session and
  // relies on the app-minted social token scoped to the current app user.
  app.get("/api/phyllo/connect", (req, res) => {
    const token = String(req.query.token || "");
    const userId = String(req.query.userId || "");
    const environmentRaw = String(req.query.environment || "").toLowerCase();
    const environment = environmentRaw === "production" ? "production" : "sandbox";
    const clientDisplayName = String(req.query.clientDisplayName || "LocoMotivate");
    const scriptUrl = String(
      req.query.scriptUrl || "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js",
    );
    const returnTo = String(req.query.returnTo || "");

    if (!token || !userId || !returnTo) {
      res.status(400).type("html").send(`<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
  <h3>Social connect error</h3>
  <p>Missing required connect parameters.</p>
</body></html>`);
      return;
    }

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connect social platforms</title>
  </head>
  <body style="margin:0;background:#0b1020;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;">
      <div>
        <div style="font-size:18px;font-weight:600;">Opening social connect...</div>
        <div style="font-size:14px;opacity:0.8;margin-top:8px;">Select your social platforms to continue.</div>
      </div>
    </div>
    <script>
      (function () {
        var TOKEN = ${JSON.stringify(token)};
        var USER_ID = ${JSON.stringify(userId)};
        var ENV = ${JSON.stringify(environment)};
        var CLIENT_NAME = ${JSON.stringify(clientDisplayName)};
        var SCRIPT_URL = ${JSON.stringify(scriptUrl)};
        var RETURN_TO = ${JSON.stringify(returnTo)};
        var settled = false;
        var sawConnected = false;
        var connectedAccountId = "";
        var connectedWorkPlatformId = "";

        function finish(status, reason, accountId, workPlatformId) {
          if (settled) return;
          settled = true;
          try {
            var url = new URL(decodeURIComponent(RETURN_TO));
            url.searchParams.set("status", status || "failed");
            if (reason) url.searchParams.set("reason", String(reason));
            if (accountId) url.searchParams.set("accountId", String(accountId));
            if (workPlatformId) url.searchParams.set("workPlatformId", String(workPlatformId));
            window.location.replace(url.toString());
          } catch (_) {
            document.body.innerHTML = "<div style='padding:24px;font-family:sans-serif;'>Could not return to app callback.</div>";
          }
        }

        function boot() {
          if (!window.PhylloConnect || typeof window.PhylloConnect.initialize !== "function") {
            finish("failed", "sdk_init_failed");
            return;
          }
          var connect = window.PhylloConnect.initialize({
            environment: ENV,
            userId: USER_ID,
            token: TOKEN,
            clientDisplayName: CLIENT_NAME
          });
          connect.on("accountConnected", function (accountId, workPlatformId) {
            sawConnected = true;
            connectedAccountId = String(accountId || "");
            connectedWorkPlatformId = String(workPlatformId || "");
          });
          connect.on("accountDisconnected", function () {});
          connect.on("connectionFailure", function (reason) {
            finish("failed", String(reason || "connection_failed"));
          });
          connect.on("tokenExpired", function () {
            finish("failed", "token_expired");
          });
          connect.on("exit", function (reason) {
            if (sawConnected) {
              finish("connected", String(reason || "exit"), connectedAccountId, connectedWorkPlatformId);
              return;
            }
            finish("cancelled", String(reason || "exit"));
          });
          try {
            connect.open();
          } catch (error) {
            var message = error && error.message ? error.message : "open_failed";
            finish("failed", String(message));
          }
        }

        var script = document.createElement("script");
        script.src = SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = boot;
        script.onerror = function () { finish("failed", "sdk_load_failed"); };
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>`;
    res.status(200).type("html").send(html);
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
        const paymentSession = merchantReference
          ? await db.getPaymentSessionByReference(merchantReference)
          : undefined;
        const orderId = paymentSession?.orderId ?? null;

        // Log every webhook event
        await db.createPaymentLog({
          paymentSessionId: paymentSession?.id,
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
          if (orderId) {
            await db.updateOrder(orderId, {
              paymentStatus: "paid",
              status: "confirmed",
            });
          }
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
          if (orderId) {
            await db.updateOrder(orderId, {
              paymentStatus: "paid",
              status: "processing",
            });
          }
          logEvent("adyen.payment_captured", { merchantReference });
        } else if (eventCode === "CANCELLATION" && success) {
          await db.updatePaymentSessionByReference(merchantReference, {
            status: "cancelled",
            pspReference,
          });
          if (orderId) {
            await db.updateOrder(orderId, {
              status: "cancelled",
            });
          }
          logEvent("adyen.payment_cancelled", { merchantReference });
        } else if (eventCode === "REFUND" && success) {
          await db.updatePaymentSessionByReference(merchantReference, {
            status: "refunded",
            pspReference,
          });
          if (orderId) {
            await db.updateOrder(orderId, {
              paymentStatus: "refunded",
              status: "refunded",
            });
          }
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
  registerTrainerAssistantMcpHttpRoutes?.(app);

  // Adyen redirect return endpoint (session-based payments)
  app.get("/api/payments/redirect", (req, res) => {
    const redirectResult = typeof req.query.redirectResult === "string"
      ? req.query.redirectResult
      : undefined;
    const payload = typeof req.query.payload === "string"
      ? req.query.payload
      : undefined;

    const appUrl = new URL("locomotivate://checkout/confirmation");
    if (redirectResult) appUrl.searchParams.set("redirectResult", redirectResult);
    if (payload) appUrl.searchParams.set("payload", payload);

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning to LocoMotivate</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px;">
    <h2>Returning to LocoMotivate…</h2>
    <p>If the app does not open automatically, use the button below.</p>
    <p><a href="${appUrl.toString()}">Open LocoMotivate</a></p>
    <script>
      window.location.replace(${JSON.stringify(appUrl.toString())});
    </script>
  </body>
</html>`;

    res.status(200).type("html").send(html);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Invite fallback route:
  // allows invite links on API host to still open the native app even when
  // a separate web app domain is not configured.
  app.get("/invite/:token", (req, res) => {
    const rawToken = typeof req.params.token === "string" ? req.params.token : "";
    const token = encodeURIComponent(rawToken);
    const appUrl = `locomotivate://invite/${token}`;
    const webBase = (
      process.env.PUBLIC_APP_URL ||
      process.env.EXPO_PUBLIC_APP_URL ||
      process.env.EXPO_PUBLIC_API_BASE_URL ||
      ""
    ).replace(/\/+$/g, "");
    const webInviteUrl = webBase ? `${webBase}/invite/${token}` : "";
    const forwardedProtoHeader = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const requestProtocol = forwardedProtoHeader || req.protocol || "https";
    const requestHost = req.get("host") || "";
    const currentInviteUrl = requestHost ? `${requestProtocol}://${requestHost}${req.originalUrl || ""}` : "";
    const webInviteIsSelf =
      Boolean(webInviteUrl) &&
      Boolean(currentInviteUrl) &&
      webInviteUrl.replace(/\/+$/g, "") === currentInviteUrl.replace(/\/+$/g, "");
    const safeWebInviteUrl = webInviteIsSelf ? "" : webInviteUrl;
    const iosStoreUrl =
      (process.env.IOS_APP_STORE_URL || process.env.EXPO_PUBLIC_IOS_APP_STORE_URL || "").trim() ||
      "https://apps.apple.com/us/search?term=LocoMotivate";
    const androidStoreUrl =
      (process.env.ANDROID_PLAY_STORE_URL || process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL || "").trim() ||
      "https://play.google.com/store/search?q=LocoMotivate&c=apps";
    const userAgent = String(req.headers["user-agent"] || "").toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isMobile = isIos || isAndroid;

    if (!isMobile && safeWebInviteUrl) {
      res.redirect(302, safeWebInviteUrl);
      return;
    }

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Open Invitation</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px;">
    <h2>Opening your invitation…</h2>
    <p>If the app does not open automatically, tap below.</p>
    <p><a href="${appUrl}">Open LocoMotivate app</a></p>
    ${safeWebInviteUrl ? `<p><a href="${safeWebInviteUrl}">Continue in browser</a></p>` : ""}
    ${isIos ? `<p><a href="${iosStoreUrl}">Get the iOS app</a></p>` : ""}
    ${isAndroid ? `<p><a href="${androidStoreUrl}">Get the Android app</a></p>` : ""}
    <script>
      window.location.replace(${JSON.stringify(appUrl)});
      ${
        safeWebInviteUrl
          ? `setTimeout(function () { window.location.replace(${JSON.stringify(safeWebInviteUrl)}); }, 1200);`
          : isIos
            ? `setTimeout(function () { window.location.replace(${JSON.stringify(iosStoreUrl)}); }, 1600);`
            : isAndroid
              ? `setTimeout(function () { window.location.replace(${JSON.stringify(androidStoreUrl)}); }, 1600);`
              : ""
      }
    </script>
  </body>
</html>`;

    res.status(200).type("html").send(html);
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
