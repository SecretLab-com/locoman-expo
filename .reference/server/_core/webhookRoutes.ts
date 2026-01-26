import { Express, Request, Response } from "express";
import {
  verifyShopifyWebhook,
  handleOrderCreated,
  handleOrderPaid,
  handleOrderFulfilled,
  handleFulfillmentUpdate,
} from "../shopifyWebhooks";

/**
 * Register Shopify webhook routes
 * 
 * IMPORTANT: These routes must use raw body parsing for HMAC verification.
 * The express.raw() middleware is applied specifically to these routes.
 */
export function registerWebhookRoutes(app: Express) {
  // Shopify webhook endpoint - uses raw body for HMAC verification
  app.post(
    "/api/shopify/webhooks",
    // Use raw body parser for this route only (required for HMAC verification)
    (req: Request, res: Response, next) => {
      let rawBody = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        rawBody += chunk;
      });
      req.on("end", () => {
        (req as any).rawBody = rawBody;
        try {
          req.body = JSON.parse(rawBody);
        } catch (e) {
          req.body = {};
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      const topic = req.headers["x-shopify-topic"] as string;
      const hmac = req.headers["x-shopify-hmac-sha256"] as string;
      const shopDomain = req.headers["x-shopify-shop-domain"] as string;
      const rawBody = (req as any).rawBody;

      console.log(`[Webhook] Received ${topic} from ${shopDomain}`);

      // Step 1: Verify webhook signature
      if (!verifyShopifyWebhook(rawBody, hmac)) {
        console.warn(`[Webhook] Invalid signature for ${topic}`);
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      // Step 2: Respond immediately with 200 OK (Shopify requires response within 5 seconds)
      res.status(200).json({ received: true });

      // Step 3: Process webhook asynchronously
      try {
        const payload = req.body;

        switch (topic) {
          case "orders/create":
            await handleOrderCreated(payload);
            break;

          case "orders/paid":
            await handleOrderPaid(payload);
            break;

          case "orders/fulfilled":
            await handleOrderFulfilled(payload);
            break;

          case "fulfillments/create":
          case "fulfillments/update":
            await handleFulfillmentUpdate(payload);
            break;

          case "products/update":
            // TODO: Implement product sync on update
            console.log(`[Webhook] Product updated: ${payload.id}`);
            break;

          case "inventory_levels/update":
            // TODO: Implement inventory sync
            console.log(`[Webhook] Inventory updated for item ${payload.inventory_item_id}`);
            break;

          default:
            console.log(`[Webhook] Unhandled topic: ${topic}`);
        }
      } catch (error) {
        // Log error but don't fail - we already responded with 200
        console.error(`[Webhook] Error processing ${topic}:`, error);
      }
    }
  );

  // Health check endpoint for webhook verification
  app.get("/api/shopify/webhooks/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      message: "Webhook endpoint is active",
      supportedTopics: [
        "orders/create",
        "orders/paid",
        "orders/fulfilled",
        "fulfillments/create",
        "fulfillments/update",
        "products/update",
        "inventory_levels/update",
      ],
    });
  });
}
