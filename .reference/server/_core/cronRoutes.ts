/**
 * Cron Job Routes
 * 
 * These endpoints are designed to be called by external cron services
 * (e.g., cron-job.org, Vercel Cron, GitHub Actions) to trigger scheduled tasks.
 * 
 * Security: Uses a simple API key check via query parameter or header.
 */

import { Express, Request, Response } from "express";
import { checkLowInventory } from "../jobs/lowInventoryCheck";
import { sendDeliveryReminders } from "../jobs/deliveryReminders";
import { ENV } from "./env";

// Generate a simple cron secret from cookie secret
const CRON_SECRET = ENV.cookieSecret ? 
  Buffer.from(ENV.cookieSecret).toString("base64").slice(0, 32) : 
  "default-cron-secret";

function verifyCronAuth(req: Request): boolean {
  const authHeader = req.headers.authorization;
  const queryKey = req.query.key as string;
  
  // Check Authorization header
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    if (token === CRON_SECRET) return true;
  }
  
  // Check query parameter
  if (queryKey === CRON_SECRET) return true;
  
  return false;
}

export function registerCronRoutes(app: Express) {
  /**
   * Health check endpoint (no auth required)
   * GET /api/cron/health
   */
  app.get("/api/cron/health", (_req: Request, res: Response) => {
    return res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      service: "locomotivate-cron"
    });
  });

  /**
   * Get cron secret for configuration (requires existing auth)
   * This is a one-time setup helper
   * GET /api/cron/secret
   */
  app.get("/api/cron/secret", (req: Request, res: Response) => {
    // Only allow from localhost or with valid session
    const isLocalhost = req.ip === "127.0.0.1" || req.ip === "::1";
    
    if (!isLocalhost) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    return res.json({ 
      secret: CRON_SECRET,
      usage: "Add ?key=SECRET or Authorization: Bearer SECRET header"
    });
  });

  /**
   * Run low inventory check
   * POST /api/cron/inventory-check
   * 
   * Query params:
   * - key: Cron secret for authentication
   * - threshold: Inventory threshold (default: 5)
   * - notify: Whether to send notification (default: true)
   */
  app.post("/api/cron/inventory-check", async (req: Request, res: Response) => {
    if (!verifyCronAuth(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const threshold = parseInt(req.query.threshold as string) || 5;
      const notify = req.query.notify !== "false";
      
      console.log(`[Cron] Running inventory check with threshold=${threshold}, notify=${notify}`);
      
      const result = await checkLowInventory(threshold, notify, false);
      
      console.log(`[Cron] Inventory check complete:`, result.message);
      
      return res.json({
        success: true,
        ...result,
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Cron] Inventory check failed:", error);
      return res.status(500).json({ 
        error: "Inventory check failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Send delivery reminder SMS to trainers
   * POST /api/cron/delivery-reminders
   */
  app.post("/api/cron/delivery-reminders", async (req: Request, res: Response) => {
    if (!verifyCronAuth(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      console.log("[Cron] Running delivery reminders...");
      
      const result = await sendDeliveryReminders();
      
      console.log(`[Cron] Delivery reminders complete:`, result.message);
      
      return res.json({
        ...result,
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Cron] Delivery reminders failed:", error);
      return res.status(500).json({ 
        error: "Delivery reminders failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  /**
   * Run all scheduled tasks
   * POST /api/cron/run-all
   * 
   * This endpoint runs all scheduled maintenance tasks.
   * Useful for a single daily cron job.
   */
  app.post("/api/cron/run-all", async (req: Request, res: Response) => {
    if (!verifyCronAuth(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const results: Record<string, unknown> = {};

    try {
      // Run inventory check
      console.log("[Cron] Running all scheduled tasks...");
      
      results.inventoryCheck = await checkLowInventory(5, true, false);
      
      // Run delivery reminders
      results.deliveryReminders = await sendDeliveryReminders();
      
      // Add more scheduled tasks here as needed
      // results.syncProducts = await syncProducts();
      // results.cleanupSessions = await cleanupExpiredSessions();
      
      console.log("[Cron] All scheduled tasks complete");
      
      return res.json({
        success: true,
        results,
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Cron] Scheduled tasks failed:", error);
      return res.status(500).json({ 
        error: "Scheduled tasks failed",
        message: error instanceof Error ? error.message : "Unknown error",
        partialResults: results
      });
    }
  });
}

// Export the cron secret for documentation
export function getCronSecret(): string {
  return CRON_SECRET;
}
