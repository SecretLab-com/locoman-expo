/**
 * Script to sync products from Shopify to the database
 * Run with: npx tsx scripts/sync-shopify.ts
 */

import * as shopify from "../server/shopify";
import * as db from "../server/db";

async function main() {
  console.log("Starting Shopify product sync...");
  console.log("Shopify configured:", shopify.isShopifyConfigured());
  
  // Fetch products from Shopify
  console.log("\nFetching products from Shopify...");
  const products = await shopify.fetchProducts();
  console.log(`Found ${products.length} products in Shopify`);
  
  if (products.length === 0) {
    console.log("No products found. Check your Shopify credentials.");
    return;
  }
  
  // Show first few products
  console.log("\nFirst 5 products:");
  products.slice(0, 5).forEach((p, i) => {
    const variant = p.variants[0];
    console.log(`  ${i + 1}. ${p.title} - $${variant?.price || "0.00"} (${variant?.inventory_quantity || 0} in stock)`);
  });
  
  // Sync to database
  console.log("\nSyncing products to database...");
  let synced = 0;
  let errors = 0;
  
  for (const product of products) {
    try {
      const variant = product.variants[0];
      const image = product.images[0];
      
      // Map Shopify product_type to our category enum
      const categoryMap: Record<string, "protein" | "pre_workout" | "post_workout" | "recovery" | "strength" | "wellness" | "hydration" | "vitamins" | null> = {
        "Protein": "protein",
        "Pre-Workout": "pre_workout",
        "Post-Workout": "post_workout",
        "Recovery": "recovery",
        "Creatine": "strength",
        "Weight Loss": "wellness",
        "Vitamins": "vitamins",
        "Hydration": "hydration",
      };
      const category = categoryMap[product.product_type] || null;
      
      await db.upsertProduct({
        shopifyProductId: product.id,
        shopifyVariantId: variant?.id,
        name: product.title,
        description: product.body_html || null,
        price: variant?.price || "0.00",
        imageUrl: image?.src || null,
        brand: product.vendor || null,
        category,
        inventoryQuantity: variant?.inventory_quantity || 0,
        syncedAt: new Date(),
      });
      synced++;
      process.stdout.write(`\r  Synced: ${synced}/${products.length}`);
    } catch (error) {
      errors++;
      console.error(`\n  Error syncing ${product.title}:`, error);
    }
  }
  
  console.log(`\n\nSync complete!`);
  console.log(`  Synced: ${synced}`);
  console.log(`  Errors: ${errors}`);
}

main().catch(console.error);
