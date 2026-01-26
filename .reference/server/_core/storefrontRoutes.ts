/**
 * Storefront API Routes
 * 
 * These endpoints are designed to be called from Shopify storefront themes
 * via JavaScript. They have CORS enabled to allow cross-origin requests.
 */

import { Express, Request, Response } from "express";
import * as db from "../db";

export function registerStorefrontRoutes(app: Express) {
  /**
   * Track a bundle product view
   * POST /api/storefront/track-view
   * Body: { productId: string }
   */
  app.post("/api/storefront/track-view", async (req: Request, res: Response) => {
    try {
      const { productId } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }
      
      // Increment view count for this bundle
      await db.incrementBundleViewCountByShopifyId(String(productId));
      
      return res.json({ success: true });
    } catch (error) {
      console.error("[Storefront] Error tracking view:", error);
      return res.status(500).json({ error: "Failed to track view" });
    }
  });

  /**
   * Get bundle info for storefront display
   * GET /api/storefront/bundle/:productId
   */
  app.get("/api/storefront/bundle/:productId", async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      
      if (!productId) {
        return res.status(400).json({ error: "productId is required" });
      }
      
      const bundle = await db.getBundleByShopifyProductId(productId);
      
      if (!bundle) {
        return res.status(404).json({ error: "Bundle not found" });
      }
      
      // Get trainer info
      const trainer = await db.getUserById(bundle.trainerId);
      
      // Return minimal info for storefront
      return res.json({
        id: bundle.id,
        title: bundle.title,
        description: bundle.description,
        trainer: trainer ? {
          name: trainer.name,
          username: trainer.username,
        } : null,
      });
    } catch (error) {
      console.error("[Storefront] Error getting bundle:", error);
      return res.status(500).json({ error: "Failed to get bundle" });
    }
  });

  /**
   * Pixel endpoint for tracking views via image tag (no JS required)
   * GET /api/storefront/pixel/:productId
   */
  app.get("/api/storefront/pixel/:productId", async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      
      if (productId) {
        // Fire and forget - don't wait for DB
        db.incrementBundleViewCountByShopifyId(String(productId)).catch(() => {});
      }
      
      // Return a 1x1 transparent GIF
      const pixel = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
      );
      
      res.set({
        "Content-Type": "image/gif",
        "Content-Length": pixel.length,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      });
      
      return res.send(pixel);
    } catch (error) {
      // Still return pixel even on error
      const pixel = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
      );
      res.set("Content-Type", "image/gif");
      return res.send(pixel);
    }
  });
}
