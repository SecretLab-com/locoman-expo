# Shopify Integration Architecture

This document describes how LocoMotivate integrates with Shopify to provide a seamless commerce experience for fitness trainers and their clients.

## Overview

LocoMotivate serves as the **training platform** while Shopify acts as the **commerce engine**. This separation allows each system to handle what it does best while maintaining a unified experience for users.

## System Responsibilities

| Function | System | Rationale |
|----------|--------|-----------|
| Bundle Creation & Editing | LocoMotivate | Custom UI for trainers, template system, service configuration |
| Product Catalog | Shopify → LocoMotivate | Shopify manages inventory, pricing, variants; synced to LocoMotivate |
| Checkout & Payment | Shopify | PCI compliance, payment processing, tax calculation |
| Order Management | Shopify | Fulfillment workflows, shipping labels, tracking numbers |
| Delivery Tracking | Shopify | Native carrier integrations, customer notifications |
| Subscriptions | Shopify Subscriptions API | Recurring billing, subscription lifecycle management |
| Training Sessions | LocoMotivate | Calendar, scheduling, session tracking, check-ins |
| Client Communication | Both | Order updates via Shopify; training communication via LocoMotivate |

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CUSTOMER JOURNEY                                │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │   Browse     │         │   Checkout   │         │   Receive    │
    │   Bundles    │────────▶│   & Pay      │────────▶│   Products   │
    │              │         │              │         │   & Services │
    └──────────────┘         └──────────────┘         └──────────────┘
           │                        │                        │
           ▼                        ▼                        ▼
    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │ LocoMotivate │         │   Shopify    │         │ LocoMotivate │
    │   Catalog    │         │   Checkout   │         │   Training   │
    └──────────────┘         └──────────────┘         └──────────────┘
```

## Webhook Integration

### Inbound Webhooks (Shopify → LocoMotivate)

LocoMotivate receives webhooks from Shopify to stay synchronized with order and fulfillment events.

#### orders/create

Triggered when a customer places an order containing a LocoMotivate bundle.

**Actions:**
1. Create order record in `orders` table
2. Create order items in `order_items` table
3. Auto-create client record if new customer
4. Link client to trainer (based on bundle attribution)
5. Log activity for trainer notification

**Payload Processing:**
```typescript
{
  id: number,              // Shopify order ID
  order_number: string,    // Human-readable order number
  email: string,           // Customer email
  customer: {
    id: number,
    email: string,
    first_name: string,
    last_name: string
  },
  line_items: [{
    product_id: number,
    variant_id: number,
    title: string,
    quantity: number,
    price: string
  }],
  total_price: string,
  fulfillment_status: string
}
```

#### orders/paid

Triggered when payment is confirmed for an order.

**Actions:**
1. Update order payment status to "paid"
2. Activate client's training services
3. Create subscription record if bundle is recurring
4. Send notification to trainer about new client

#### orders/fulfilled

Triggered when all items in an order have been fulfilled.

**Actions:**
1. Update order fulfillment status
2. Update delivery tracking information
3. Notify trainer that products have shipped

#### fulfillments/create & fulfillments/update

Triggered when fulfillment is created or tracking info is updated.

**Actions:**
1. Store tracking number and carrier information
2. Update estimated delivery date
3. Make tracking info visible in trainer dashboard

### Outbound API Calls (LocoMotivate → Shopify)

#### Product Sync

```typescript
// Fetch products from Shopify
GET /admin/api/2024-01/products.json

// Response stored in `products` table with:
// - shopifyProductId
// - shopifyVariantId
// - name, description, price
// - inventoryQuantity
// - imageUrl
```

#### Bundle Publishing

```typescript
// Create product for bundle
POST /admin/api/2024-01/products.json
{
  product: {
    title: "Bundle: Strength Builder Pro",
    body_html: "<p>Includes: 4x Training Sessions, Protein Powder, Pre-Workout</p>",
    vendor: "Trainer Name",
    product_type: "Bundle",
    variants: [{
      price: "199.99",
      inventory_management: null
    }],
    metafields: [{
      namespace: "locomotivate",
      key: "bundle_id",
      value: "123",
      type: "number_integer"
    }]
  }
}
```

## Database Schema

### Orders Table

```sql
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shopifyOrderId BIGINT,
  shopifyOrderNumber VARCHAR(64),
  clientId INT,
  trainerId INT,
  bundlePublicationId INT,
  customerEmail VARCHAR(320),
  customerName VARCHAR(255),
  totalAmount DECIMAL(10,2),
  status ENUM('pending','confirmed','processing','shipped','delivered','cancelled','refunded'),
  fulfillmentStatus ENUM('unfulfilled','partial','fulfilled','restocked'),
  paymentStatus ENUM('pending','paid','refunded','partially_refunded'),
  trackingNumber VARCHAR(255),
  trackingUrl TEXT,
  carrier VARCHAR(100),
  estimatedDelivery TIMESTAMP,
  deliveredAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### Order Items Table

```sql
CREATE TABLE order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  orderId INT NOT NULL,
  productId INT,
  shopifyLineItemId BIGINT,
  name VARCHAR(255),
  quantity INT,
  price DECIMAL(10,2),
  fulfillmentStatus ENUM('unfulfilled','fulfilled','restocked')
);
```

## Webhook Security

All incoming webhooks are verified using Shopify's HMAC signature:

```typescript
function verifyShopifyWebhook(req: Request): boolean {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = req.rawBody;
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET_KEY)
    .update(body)
    .digest('base64');
  return hmac === hash;
}
```

## Client Auto-Creation Flow

When an order webhook is received:

```
1. Extract customer email from order
2. Check if client exists in `clients` table
3. If not exists:
   a. Create new client record
   b. Link to trainer based on bundle attribution
   c. Set status to "pending" (awaiting trainer acceptance)
   d. Send notification to trainer
4. If exists:
   a. Update client's order history
   b. Link new subscription if applicable
```

## Trainer Dashboard Integration

### Orders View

Trainers can see:
- Recent orders containing their bundles
- Order status (pending, processing, shipped, delivered)
- Tracking information with carrier links
- Customer details (name, email)
- Products included in each order

### Fulfillment Tracking

```typescript
// Display in trainer dashboard
{
  orderId: "1234",
  orderNumber: "#1001",
  customer: "John Smith",
  status: "shipped",
  tracking: {
    number: "1Z999AA10123456784",
    carrier: "UPS",
    url: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    estimatedDelivery: "2024-01-20"
  },
  items: [
    { name: "Protein Powder", quantity: 1, fulfilled: true },
    { name: "Pre-Workout", quantity: 1, fulfilled: true }
  ]
}
```

## Environment Variables

Required environment variables for Shopify integration:

| Variable | Description |
|----------|-------------|
| `SHOPIFY_STORE_NAME` | Store subdomain (e.g., "bright-express-dev") |
| `SHOPIFY_API_ACCESS_TOKEN` | Admin API access token |
| `SHOPIFY_API_KEY` | API key for app |
| `SHOPIFY_API_SECRET_KEY` | Secret key for webhook verification |

## Error Handling

### Webhook Failures

- Webhooks are idempotent - duplicate deliveries are handled gracefully
- Failed webhook processing is logged with full payload for debugging
- Shopify retries failed webhooks for up to 48 hours

### API Rate Limits

- Shopify Admin API: 2 requests/second (leaky bucket)
- Implement exponential backoff for rate limit errors
- Queue bulk operations for off-peak processing

## Testing

### Webhook Testing

Use Shopify's webhook testing tools or create test webhooks:

```bash
curl -X POST https://your-app.com/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/create" \
  -H "X-Shopify-Hmac-Sha256: <calculated-hmac>" \
  -d '{"id": 123, "email": "test@example.com", ...}'
```

### Local Development

Use ngrok or similar to expose local server for webhook testing:

```bash
ngrok http 3000
# Update webhook URL in Shopify to ngrok URL
```

## Future Enhancements

1. **Subscription Management** - Handle subscription webhooks for recurring bundles
2. **Inventory Sync** - Real-time inventory updates from Shopify
3. **Refund Processing** - Handle refund webhooks and update client status
4. **Multi-location Fulfillment** - Support for trainer-specific fulfillment locations
