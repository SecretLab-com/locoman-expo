# Shopify Bundle Implementation Research

## Two Implementation Options

### 1. Fixed Bundles (productBundleCreate mutation)
- **Definition**: Using the GraphQL Admin API
- **Pricing**: Price derived from parent variant, allocated across components using weighted price algorithm
- **Inventory**: Shopify maintains sellable quantities on the parent bundle variant
  - Parent inventory = minimum of component inventory quantities
- **Storefront**: Works without Liquid changes, buyer chooses parent bundle variant
- **Oversell Protection**: Always protected - Shopify maintains sellable quantities

### 2. Customized Bundles (cartTransform object)
- **Definition**: Through cartTransform object with metafields/metaobjects
- **Pricing**: For expand - price from parent; for merge - price from components with adjustment
- **Inventory**: App maintains in-stock/out-of-stock for parent
- **Storefront**: App responsible for variant picker on product details page
- **Oversell Protection**: 
  - Storefront: App maintains stock status
  - Post-add-to-cart: Components checked in cart/checkout

## Key Differences

| Aspect | Fixed Bundles | Customized Bundles |
|--------|---------------|-------------------|
| Inventory Management | Automatic by Shopify | Manual by App |
| Complexity | Lower | Higher |
| Flexibility | Limited | High |
| Theme Changes | Not required | Required (theme app block) |

## Recommendation for LocoMotivate

For LocoMotivate's trainer-created bundles, **Fixed Bundles** is the recommended approach because:

1. **Automatic Inventory Sync**: Shopify handles inventory - parent bundle quantity = min(component quantities)
2. **Simpler Implementation**: No need for Shopify Functions or theme app blocks
3. **Built-in Oversell Protection**: Shopify prevents overselling automatically
4. **Works with existing themes**: No Liquid changes needed

## Implementation Steps

1. Use `productBundleCreate` GraphQL mutation to create bundles
2. Store bundle metadata in our database for trainer attribution
3. Sync component products from Shopify to local DB for fast catalog loading
4. When trainer creates bundle:
   - Create product in Shopify via Admin API
   - Link component products via bundle API
   - Store local reference for attribution/analytics

## Inventory Handling

For Fixed Bundles, Shopify automatically:
- Calculates bundle inventory as MIN of all component inventories
- Decrements component inventory when bundle is sold
- Shows accurate stock levels across all channels

No manual inventory sync needed for bundles!


## Webhook Security Best Practices

### HMAC Signature Verification

Every Shopify webhook includes `X-Shopify-Hmac-SHA256` header for verification:

```javascript
const crypto = require('crypto');

function verifyWebhook(rawBody, hmacHeader, clientSecret) {
  const calculatedHmac = crypto
    .createHmac('sha256', clientSecret)
    .update(rawBody)
    .digest('base64');
  
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHmac, 'base64'),
    Buffer.from(hmacHeader, 'base64')
  );
}
```

### Critical Implementation Notes

1. **Raw Body Required**: Must use raw request body, not parsed JSON
2. **Timing-Safe Comparison**: Use `crypto.timingSafeEqual()` to prevent timing attacks
3. **Middleware Order**: Webhook verification must come BEFORE body parsing middleware
4. **Response Time**: Must respond with 200 OK within 5 seconds
5. **Idempotency**: Webhooks may be delivered multiple times - implement deduplication

### Recommended Webhooks for LocoMotivate

| Webhook Topic | Purpose |
|--------------|---------|
| `orders/create` | Track new bundle purchases |
| `orders/paid` | Confirm payment for fulfillment |
| `orders/fulfilled` | Update order status |
| `products/update` | Sync product changes |
| `inventory_levels/update` | Real-time inventory sync |

### Webhook Processing Pattern

```javascript
// 1. Respond immediately with 200 OK
res.status(200).send('OK');

// 2. Queue webhook for async processing
await webhookQueue.add({
  topic: req.headers['x-shopify-topic'],
  shop: req.headers['x-shopify-shop-domain'],
  payload: JSON.parse(rawBody)
});
```

## Product Catalog Caching Strategy

### Current Problem
- Products fetched from Shopify API on every request
- Slow response times for catalog browsing

### Recommended Solution

1. **Initial Sync**: On app install or manual trigger, sync all products to database
2. **Webhook Updates**: Subscribe to `products/update` and `inventory_levels/update`
3. **Reconciliation Job**: Periodic full sync (daily) to catch any missed webhooks
4. **Cache Layer**: Serve products from database, not Shopify API

### Database Schema (Already Exists)
```sql
products (
  id, shopifyProductId, shopifyVariantId, shopDomain,
  name, description, imageUrl, price, compareAtPrice,
  brand, category, phase, fulfillmentOptions,
  inventoryQuantity, availability, isApproved,
  syncedAt, createdAt, updatedAt
)
```

### Sync Flow
```
Shopify Store → Webhook → LocoMotivate Backend → Database
                                    ↓
                              Catalog API ← Frontend
```

## Summary: Recommended Architecture for LocoMotivate

### Bundle Creation Flow
1. Trainer selects products from cached catalog (fast)
2. Trainer configures bundle (name, price, description)
3. Backend creates Fixed Bundle in Shopify via Admin API
4. Shopify handles inventory automatically (min of components)
5. Store bundle reference in local DB for attribution

### Order Processing Flow
1. Customer purchases bundle on Shopify
2. Shopify sends `orders/create` webhook
3. Backend verifies HMAC signature
4. Queue webhook for processing
5. Update local order records
6. Notify trainer of sale

### Inventory Management
- **Shopify handles it** for Fixed Bundles
- Local DB caches inventory for fast display
- Webhooks keep cache in sync
- Daily reconciliation job as backup
