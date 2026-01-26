import crypto from "crypto";
import { ENV } from "./_core/env";
import * as db from "./db";

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

/**
 * Verify Shopify webhook signature using HMAC-SHA256
 */
export function verifyShopifyWebhook(
  rawBody: string | Buffer,
  hmacHeader: string | undefined
): boolean {
  if (!hmacHeader || !ENV.shopifyApiSecretKey) {
    console.warn("[Shopify Webhook] Missing HMAC header or secret key");
    return false;
  }

  const body = typeof rawBody === "string" ? rawBody : rawBody.toString("utf8");
  const hash = crypto
    .createHmac("sha256", ENV.shopifyApiSecretKey)
    .update(body, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

// ============================================================================
// WEBHOOK PAYLOAD TYPES
// ============================================================================

interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
  sku?: string;
  vendor?: string;
  properties?: Array<{ name: string; value: string }>;
}

interface ShopifyFulfillment {
  id: number;
  status: string;
  tracking_number?: string;
  tracking_url?: string;
  tracking_company?: string;
  shipment_status?: string;
  estimated_delivery_at?: string;
  line_items: ShopifyLineItem[];
}

interface ShopifyOrderPayload {
  id: number;
  order_number: number;
  name: string; // e.g., "#1001"
  email: string;
  customer?: ShopifyCustomer;
  line_items: ShopifyLineItem[];
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_shipping_price_set?: {
    shop_money: { amount: string };
  };
  financial_status: string;
  fulfillment_status: string | null;
  fulfillments?: ShopifyFulfillment[];
  created_at: string;
  updated_at: string;
  note?: string;
  tags?: string;
}

interface ShopifyFulfillmentPayload {
  id: number;
  order_id: number;
  status: string;
  tracking_number?: string;
  tracking_url?: string;
  tracking_company?: string;
  shipment_status?: string;
  estimated_delivery_at?: string;
  line_items: ShopifyLineItem[];
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Handle orders/create webhook
 * Creates order record and auto-creates client if needed
 */
export async function handleOrderCreated(payload: ShopifyOrderPayload) {
  console.log(`[Shopify Webhook] Processing orders/create for order #${payload.order_number}`);

  try {
    // Check if order already exists (idempotency)
    const existingOrder = await db.getOrderByShopifyId(payload.id);
    if (existingOrder) {
      console.log(`[Shopify Webhook] Order ${payload.id} already exists, skipping`);
      return { success: true, message: "Order already processed" };
    }

    // Find trainer attribution from bundle metafields or line item properties
    let trainerId: number | undefined;
    let bundlePublicationId: number | undefined;

    for (const item of payload.line_items) {
      // Check for locomotivate bundle properties
      const bundleIdProp = item.properties?.find((p) => p.name === "_locomotivate_bundle_id");
      const trainerIdProp = item.properties?.find((p) => p.name === "_locomotivate_trainer_id");

      if (bundleIdProp) {
        bundlePublicationId = parseInt(bundleIdProp.value, 10);
      }
      if (trainerIdProp) {
        trainerId = parseInt(trainerIdProp.value, 10);
      }

      // Also check if product matches a published bundle
      if (!bundlePublicationId && item.product_id) {
        const publication = await db.getBundlePublicationByShopifyProductId(item.product_id.toString());
        if (publication) {
          bundlePublicationId = publication.id;
          const draft = await db.getBundleDraftById(publication.draftId);
          if (draft) {
            trainerId = draft.trainerId;
          }
        }
      }
    }

    // Auto-create or find client
    let clientId: number | undefined;
    if (payload.email && trainerId) {
      clientId = await findOrCreateClient(payload, trainerId);
    }

    // Create order record
    const orderId = await db.createOrder({
      shopifyOrderId: payload.id,
      shopifyOrderNumber: payload.name,
      clientId,
      trainerId,
      bundlePublicationId,
      customerEmail: payload.email,
      customerName: payload.customer
        ? `${payload.customer.first_name} ${payload.customer.last_name}`.trim()
        : undefined,
      totalAmount: payload.total_price,
      subtotalAmount: payload.subtotal_price,
      taxAmount: payload.total_tax,
      shippingAmount: payload.total_shipping_price_set?.shop_money?.amount,
      status: "pending",
      fulfillmentStatus: (payload.fulfillment_status as "unfulfilled" | "partial" | "fulfilled" | "restocked") || "unfulfilled",
      paymentStatus: mapFinancialStatus(payload.financial_status),
      orderData: payload,
    });

    // Create order items
    for (const item of payload.line_items) {
      // Try to find matching product in our database
      const product = await db.getProductByShopifyId(item.product_id);

      await db.createOrderItem({
        orderId,
        productId: product?.id,
        shopifyLineItemId: item.id,
        name: item.title,
        quantity: item.quantity,
        price: item.price,
        totalPrice: (parseFloat(item.price) * item.quantity).toFixed(2),
        fulfillmentStatus: "unfulfilled",
      });
    }

    // Log activity for trainer
    if (trainerId) {
      await db.logActivity({
        userId: trainerId,
        action: "order_received",
        entityType: "order",
        entityId: orderId,
        details: {
          orderNumber: payload.name,
          customerEmail: payload.email,
          totalAmount: payload.total_price,
        },
      });
      
      // Award points to trainer for the sale
      try {
        const saleAmount = parseFloat(payload.total_price || "0");
        const points = Math.floor(saleAmount); // £1 = 1 point
        
        if (points > 0) {
          await db.addTrainerPoints(
            trainerId,
            points,
            "bundle_sale",
            {
              referenceType: "order",
              referenceId: orderId,
              description: `Bundle sale: ${payload.name} (£${payload.total_price})`,
            }
          );
          console.log(`[Shopify Webhook] Awarded ${points} points to trainer ${trainerId} for order ${payload.name}`);
        }
        
        // Check if this is a new client and award bonus points
        if (clientId) {
          const clientOrders = await db.getOrdersByClient(clientId);
          if (clientOrders.length === 1) {
            // This is the client's first order - award new client bonus
            await db.addTrainerPoints(
              trainerId,
              100, // New client bonus
              "new_client_bonus",
              {
                referenceType: "client",
                referenceId: clientId,
                description: `New client: ${payload.email}`,
              }
            );
            console.log(`[Shopify Webhook] Awarded 100 new client bonus points to trainer ${trainerId}`);
          } else if (clientOrders.length > 1) {
            // Returning client - award retention bonus
            await db.addTrainerPoints(
              trainerId,
              50, // Client retention bonus
              "client_retention",
              {
                referenceType: "client",
                referenceId: clientId,
                description: `Repeat purchase #${clientOrders.length} by ${payload.email}`,
              }
            );
            console.log(`[Shopify Webhook] Awarded 50 retention bonus points to trainer ${trainerId}`);
          }
        }
      } catch (pointsError) {
        // Don't fail the order if points awarding fails
        console.error(`[Shopify Webhook] Failed to award points:`, pointsError);
      }
    }

    console.log(`[Shopify Webhook] Created order ${orderId} for Shopify order ${payload.id}`);
    return { success: true, orderId };
  } catch (error) {
    console.error("[Shopify Webhook] Error processing orders/create:", error);
    throw error;
  }
}

/**
 * Handle orders/paid webhook
 * Updates payment status and activates services
 */
export async function handleOrderPaid(payload: ShopifyOrderPayload) {
  console.log(`[Shopify Webhook] Processing orders/paid for order #${payload.order_number}`);

  try {
    const order = await db.getOrderByShopifyId(payload.id);
    if (!order) {
      // Order doesn't exist yet, create it first
      await handleOrderCreated(payload);
      return { success: true, message: "Order created and marked as paid" };
    }

    // Update payment status
    await db.updateOrder(order.id, {
      paymentStatus: "paid",
      status: "confirmed",
    });

    // Activate client services if applicable
    if (order.clientId && order.bundlePublicationId) {
      const publication = await db.getBundlePublicationById(order.bundlePublicationId);
      if (publication) {
        const draft = await db.getBundleDraftById(publication.draftId);
        if (draft && draft.cadence !== "one_time") {
          // Create subscription for recurring bundles
          await db.createSubscription({
            clientId: order.clientId,
            trainerId: order.trainerId!,
            bundleDraftId: draft.id,
            bundlePublicationId: publication.id,
            status: "active",
            subscriptionType: draft.cadence === "weekly" ? "weekly" : "monthly",
            price: draft.price || "0",
            startDate: new Date(),
          });
        }
      }

      // Update client status to active
      await db.updateClient(order.clientId, { status: "active" });
    }

    // Log activity
    if (order.trainerId) {
      await db.logActivity({
        userId: order.trainerId,
        action: "order_paid",
        entityType: "order",
        entityId: order.id,
        details: {
          orderNumber: payload.name,
          totalAmount: payload.total_price,
        },
      });
    }

    // Create product delivery records for trainer_delivery items
    if (order.trainerId && order.clientId) {
      try {
        const orderItems = await db.getOrderItems(order.id);
        const deliveryItems: { orderItemId: number; productName: string; quantity: number }[] = [];
        
        for (const item of orderItems) {
          // Check if this product requires trainer delivery
          if (item.productId) {
            const product = await db.getProductById(item.productId);
            if (product?.fulfillmentOptions) {
              const fulfillmentOptions = product.fulfillmentOptions as string[];
              if (fulfillmentOptions.includes("trainer_delivery")) {
                deliveryItems.push({
                  orderItemId: item.id,
                  productName: item.name,
                  quantity: item.quantity,
                });
              }
            }
          }
        }
        
        if (deliveryItems.length > 0) {
          // Schedule delivery for 7 days from now by default
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + 7);
          
          const deliveryIds = await db.createProductDeliveries(
            order.id,
            order.trainerId,
            order.clientId,
            deliveryItems
          );
          
          // Update scheduled dates for all created deliveries
          for (const deliveryId of deliveryIds) {
            await db.scheduleDelivery(deliveryId, order.trainerId, scheduledDate);
          }
          
          console.log(`[Shopify Webhook] Created ${deliveryIds.length} product delivery records for order ${order.id}`);
        }
      } catch (deliveryError) {
        // Don't fail the order if delivery creation fails
        console.error(`[Shopify Webhook] Failed to create product deliveries:`, deliveryError);
      }
    }

    console.log(`[Shopify Webhook] Order ${order.id} marked as paid`);
    return { success: true };
  } catch (error) {
    console.error("[Shopify Webhook] Error processing orders/paid:", error);
    throw error;
  }
}

/**
 * Handle orders/fulfilled webhook
 * Updates fulfillment status
 */
export async function handleOrderFulfilled(payload: ShopifyOrderPayload) {
  console.log(`[Shopify Webhook] Processing orders/fulfilled for order #${payload.order_number}`);

  try {
    const order = await db.getOrderByShopifyId(payload.id);
    if (!order) {
      console.warn(`[Shopify Webhook] Order ${payload.id} not found for fulfillment update`);
      return { success: false, message: "Order not found" };
    }

    // Extract tracking info from fulfillments
    const fulfillment = payload.fulfillments?.[0];
    const updateData: Parameters<typeof db.updateOrder>[1] = {
      fulfillmentStatus: "fulfilled",
      status: "shipped",
    };

    if (fulfillment) {
      updateData.trackingNumber = fulfillment.tracking_number;
      updateData.trackingUrl = fulfillment.tracking_url;
      updateData.carrier = fulfillment.tracking_company;
      if (fulfillment.estimated_delivery_at) {
        updateData.estimatedDelivery = new Date(fulfillment.estimated_delivery_at);
      }
    }

    await db.updateOrder(order.id, updateData);

    // Update all order items to fulfilled
    await db.updateOrderItemsFulfillment(order.id, "fulfilled");

    // Log activity
    if (order.trainerId) {
      await db.logActivity({
        userId: order.trainerId,
        action: "order_shipped",
        entityType: "order",
        entityId: order.id,
        details: {
          orderNumber: payload.name,
          trackingNumber: fulfillment?.tracking_number,
          carrier: fulfillment?.tracking_company,
        },
      });
    }

    console.log(`[Shopify Webhook] Order ${order.id} marked as fulfilled`);
    return { success: true };
  } catch (error) {
    console.error("[Shopify Webhook] Error processing orders/fulfilled:", error);
    throw error;
  }
}

/**
 * Handle fulfillments/create and fulfillments/update webhooks
 * Updates tracking information
 */
export async function handleFulfillmentUpdate(payload: ShopifyFulfillmentPayload) {
  console.log(`[Shopify Webhook] Processing fulfillment update for order ${payload.order_id}`);

  try {
    const order = await db.getOrderByShopifyId(payload.order_id);
    if (!order) {
      console.warn(`[Shopify Webhook] Order ${payload.order_id} not found for fulfillment`);
      return { success: false, message: "Order not found" };
    }

    const updateData: Parameters<typeof db.updateOrder>[1] = {};

    if (payload.tracking_number) {
      updateData.trackingNumber = payload.tracking_number;
    }
    if (payload.tracking_url) {
      updateData.trackingUrl = payload.tracking_url;
    }
    if (payload.tracking_company) {
      updateData.carrier = payload.tracking_company;
    }
    if (payload.estimated_delivery_at) {
      updateData.estimatedDelivery = new Date(payload.estimated_delivery_at);
    }

    // Update status based on shipment status
    if (payload.shipment_status === "delivered") {
      updateData.status = "delivered";
      updateData.deliveredAt = new Date();
    } else if (payload.status === "success") {
      updateData.status = "shipped";
      updateData.fulfillmentStatus = "fulfilled";
    }

    if (Object.keys(updateData).length > 0) {
      await db.updateOrder(order.id, updateData);
    }

    // Update specific line items if provided
    for (const item of payload.line_items) {
      await db.updateOrderItemByShopifyId(item.id, { fulfillmentStatus: "fulfilled" });
    }

    console.log(`[Shopify Webhook] Updated fulfillment for order ${order.id}`);
    return { success: true };
  } catch (error) {
    console.error("[Shopify Webhook] Error processing fulfillment update:", error);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find existing client or create new one from order data
 */
async function findOrCreateClient(
  payload: ShopifyOrderPayload,
  trainerId: number
): Promise<number | undefined> {
  // Check if client already exists by email
  const existingClient = await db.getClientByEmail(payload.email, trainerId);
  if (existingClient) {
    return existingClient.id;
  }

  // Create new client
  const customerName = payload.customer
    ? `${payload.customer.first_name} ${payload.customer.last_name}`.trim()
    : payload.email.split("@")[0];

  const clientId = await db.createClient({
    trainerId,
    name: customerName,
    email: payload.email,
    phone: payload.customer?.phone,
    status: "pending", // Trainer needs to accept
    notes: `Auto-created from Shopify order ${payload.name}`,
  });

  // Log activity
  await db.logActivity({
    userId: trainerId,
    action: "client_auto_created",
    entityType: "client",
    entityId: clientId,
    details: {
      email: payload.email,
      orderNumber: payload.name,
    },
  });

  return clientId;
}

/**
 * Map Shopify financial status to our payment status
 */
function mapFinancialStatus(
  status: string
): "pending" | "paid" | "refunded" | "partially_refunded" {
  switch (status) {
    case "paid":
    case "partially_paid":
      return "paid";
    case "refunded":
      return "refunded";
    case "partially_refunded":
      return "partially_refunded";
    default:
      return "pending";
  }
}

// ============================================================================
// PRODUCT WEBHOOK HANDLERS (for bundle sync)
// ============================================================================

interface ShopifyProductPayload {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  handle: string;
  status: string;
  variants: Array<{
    id: number;
    title: string;
    price: string;
    sku?: string;
    inventory_quantity?: number;
  }>;
  images: Array<{
    id: number;
    src: string;
    position: number;
  }>;
  updated_at: string;
}

/**
 * Handle products/update webhook
 * Triggers bundle sync when a product used in bundles is updated
 * Also detects conflicts when Shopify product is edited externally
 */
export async function handleProductUpdated(payload: ShopifyProductPayload) {
  console.log(`[Shopify Webhook] Processing products/update for product ${payload.id}: ${payload.title}`);

  try {
    // Check if this product is used in any published bundles
    const bundlePublication = await db.getBundlePublicationByShopifyProductId(payload.id.toString());
    
    if (bundlePublication) {
      console.log(`[Shopify Webhook] Product ${payload.id} is a published bundle, checking for conflicts`);
      
      // Get the bundle draft to compare data
      const bundleDraft = await db.getBundleDraftById(bundlePublication.draftId);
      
      if (bundleDraft) {
        // Detect if Shopify data differs from LocoMotivate data (conflict)
        const shopifyPrice = payload.variants[0]?.price || "0";
        const localPrice = bundleDraft.price || "0";
        const shopifyTitle = payload.title;
        const localTitle = bundleDraft.title;
        
        const hasConflict = 
          shopifyPrice !== localPrice.toString() || 
          shopifyTitle !== localTitle;
        
        if (hasConflict) {
          console.log(`[Shopify Webhook] Conflict detected for bundle ${bundleDraft.id}`);
          console.log(`  - Title: Shopify="${shopifyTitle}" vs Local="${localTitle}"`);
          console.log(`  - Price: Shopify="${shopifyPrice}" vs Local="${localPrice}"`);
          
          // Mark as conflict - admin needs to resolve
          await db.updateBundleSyncStatus(bundlePublication.id, "conflict");
          
          // Log the conflict details
          await db.logActivity({
            userId: 1, // System user
            action: "bundle_conflict_detected",
            entityType: "bundle_publication",
            entityId: bundlePublication.id,
            details: {
              shopifyProductId: payload.id,
              productTitle: payload.title,
              conflictType: "external_edit",
              shopifyData: {
                title: shopifyTitle,
                price: shopifyPrice,
              },
              localData: {
                title: localTitle,
                price: localPrice,
              },
              message: "Product was edited directly in Shopify. Review and resolve the conflict.",
            },
          });
          
          return { success: true, message: "Bundle conflict detected - needs admin review" };
        }
      }
      
      // No conflict, just mark for sync
      await db.updateBundleSyncStatus(bundlePublication.id, "pending");
      
      // Log activity
      await db.logActivity({
        userId: 1, // System user
        action: "bundle_sync_triggered",
        entityType: "bundle_publication",
        entityId: bundlePublication.id,
        details: {
          shopifyProductId: payload.id,
          productTitle: payload.title,
          trigger: "products/update webhook",
        },
      });
      
      return { success: true, message: "Bundle marked for sync" };
    }
    
    // Also sync the product to our local database
    console.log(`[Shopify Webhook] Upserting local product ${payload.id}`);
    await db.upsertProduct({
      shopifyProductId: payload.id,
      name: payload.title,
      description: payload.body_html || undefined,
      brand: payload.vendor || undefined,
      price: payload.variants[0]?.price || "0",
      imageUrl: payload.images[0]?.src || undefined,
      syncedAt: new Date(),
    });

    return { success: true, message: "Product update processed" };
  } catch (error) {
    console.error("[Shopify Webhook] Error processing products/update:", error);
    throw error;
  }
}

/**
 * Handle products/delete webhook
 * Marks bundles as needing attention when their Shopify product is deleted
 */
export async function handleProductDeleted(payload: { id: number }) {
  console.log(`[Shopify Webhook] Processing products/delete for product ${payload.id}`);

  try {
    // Check if this product is a published bundle
    const bundlePublication = await db.getBundlePublicationByShopifyProductId(payload.id.toString());
    
    if (bundlePublication) {
      console.log(`[Shopify Webhook] Product ${payload.id} was a published bundle, marking as failed`);
      
      // Mark the bundle sync as failed since the Shopify product no longer exists
      await db.updateBundleSyncStatus(bundlePublication.id, "failed");
      
      // Log activity
      await db.logActivity({
        userId: 1, // System user
        action: "bundle_shopify_deleted",
        entityType: "bundle_publication",
        entityId: bundlePublication.id,
        details: {
          shopifyProductId: payload.id,
          message: "Shopify product was deleted, bundle needs republishing",
        },
      });
      
      return { success: true, message: "Bundle marked as needing attention" };
    }
    
    // Also archive the product in our local database (mark as deleted by name)
    console.log(`[Shopify Webhook] Archiving local product ${payload.id}`);
    await db.upsertProduct({
      shopifyProductId: payload.id,
      name: "[Deleted Product]",
      price: "0",
      syncedAt: new Date(),
    });

    return { success: true, message: "Product deletion processed" };
  } catch (error) {
    console.error("[Shopify Webhook] Error processing products/delete:", error);
    throw error;
  }
}

// ============================================================================
// WEBHOOK TOPIC ROUTER
// ============================================================================

export async function processWebhook(topic: string, payload: unknown) {
  switch (topic) {
    case "orders/create":
      return handleOrderCreated(payload as ShopifyOrderPayload);
    case "orders/paid":
      return handleOrderPaid(payload as ShopifyOrderPayload);
    case "orders/fulfilled":
      return handleOrderFulfilled(payload as ShopifyOrderPayload);
    case "fulfillments/create":
    case "fulfillments/update":
      return handleFulfillmentUpdate(payload as ShopifyFulfillmentPayload);
    case "products/update":
      return handleProductUpdated(payload as ShopifyProductPayload);
    case "products/delete":
      return handleProductDeleted(payload as { id: number });
    default:
      console.log(`[Shopify Webhook] Unhandled topic: ${topic}`);
      return { success: true, message: `Topic ${topic} not handled` };
  }
}
