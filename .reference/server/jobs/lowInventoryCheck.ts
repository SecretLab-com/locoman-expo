/**
 * Low Inventory Check Job
 * 
 * This module provides functions to check for low inventory bundles
 * and send automated notifications to the store owner.
 * 
 * Can be triggered:
 * 1. Manually via the admin dashboard
 * 2. Via a scheduled cron job endpoint
 * 3. Via webhook from Shopify inventory updates
 */

import { getBundlesWithLowInventory } from "../db";
import { notifyOwner } from "../_core/notification";

// Track last notification time to avoid spam
let lastNotificationTime: number = 0;
const NOTIFICATION_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown

export interface LowInventoryCheckResult {
  checked: boolean;
  bundlesWithLowInventory: number;
  notificationSent: boolean;
  message: string;
  details?: Array<{
    bundleId: number;
    bundleTitle: string;
    lowProducts: Array<{
      productName: string;
      inventory: number;
    }>;
  }>;
}

/**
 * Check for bundles with low inventory and optionally send notification
 */
export async function checkLowInventory(
  threshold: number = 5,
  sendNotification: boolean = true,
  forceSend: boolean = false
): Promise<LowInventoryCheckResult> {
  try {
    // Get bundles with low inventory
    const lowInventoryBundles = await getBundlesWithLowInventory(threshold);
    
    if (lowInventoryBundles.length === 0) {
      return {
        checked: true,
        bundlesWithLowInventory: 0,
        notificationSent: false,
        message: "All bundles have sufficient inventory",
      };
    }

    // Build details for response
    const details = lowInventoryBundles.map((bundle: { bundleId: number; bundleTitle: string; lowInventoryProducts: Array<{ productName: string; inventory: number }> }) => ({
      bundleId: bundle.bundleId,
      bundleTitle: bundle.bundleTitle,
      lowProducts: bundle.lowInventoryProducts.map((p: { productName: string; inventory: number }) => ({
        productName: p.productName,
        inventory: p.inventory,
      })),
    }));

    // Check if we should send notification
    const now = Date.now();
    const shouldSend = sendNotification && (
      forceSend || 
      (now - lastNotificationTime) > NOTIFICATION_COOLDOWN_MS
    );

    let notificationSent = false;
    
    if (shouldSend) {
      // Build notification content
      const title = `⚠️ Low Inventory Alert: ${lowInventoryBundles.length} bundle${lowInventoryBundles.length > 1 ? 's' : ''} affected`;
      
      let content = `The following bundles have products with inventory at or below ${threshold} units:\n\n`;
      
      for (const bundle of lowInventoryBundles) {
        content += `**${bundle.bundleTitle}**\n`;
        for (const product of bundle.lowInventoryProducts) {
          const emoji = product.inventory === 0 ? "🔴" : "🟡";
          content += `  ${emoji} ${product.productName}: ${product.inventory} in stock\n`;
        }
        content += "\n";
      }
      
      content += "\nPlease restock these items to avoid bundle availability issues.";
      content += "\n\nView details in LocoMotivate Manager Dashboard.";
      
      try {
        notificationSent = await notifyOwner({ title, content });
        if (notificationSent) {
          lastNotificationTime = now;
        }
      } catch (error) {
        console.error("[LowInventoryCheck] Failed to send notification:", error);
      }
    }

    return {
      checked: true,
      bundlesWithLowInventory: lowInventoryBundles.length,
      notificationSent,
      message: `Found ${lowInventoryBundles.length} bundle${lowInventoryBundles.length > 1 ? 's' : ''} with low inventory`,
      details,
    };
  } catch (error) {
    console.error("[LowInventoryCheck] Error checking inventory:", error);
    return {
      checked: false,
      bundlesWithLowInventory: 0,
      notificationSent: false,
      message: `Error checking inventory: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get the time until next notification can be sent
 */
export function getNotificationCooldownRemaining(): number {
  const now = Date.now();
  const remaining = NOTIFICATION_COOLDOWN_MS - (now - lastNotificationTime);
  return Math.max(0, remaining);
}

/**
 * Reset the notification cooldown (for testing)
 */
export function resetNotificationCooldown(): void {
  lastNotificationTime = 0;
}
