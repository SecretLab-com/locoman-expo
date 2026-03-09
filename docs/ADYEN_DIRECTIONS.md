# Adyen Payment Integration — Complete Implementation Guide

This document describes how to implement a full Adyen payment integration with Shopify Draft Orders in an Expo (iOS/Android/Web) app. Follow every section precisely. The architecture uses:

- **Backend**: Node.js + Express + Sequelize (Postgres)
- **Frontend**: Expo (React Native) with platform-specific Adyen components
- **Payment processor**: Adyen (session-based checkout)
- **Order management**: Shopify Admin GraphQL API (Draft Orders)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables](#2-environment-variables)
3. [Dependencies](#3-dependencies)
4. [Database Schema (Migrations)](#4-database-schema-migrations)
5. [Backend Services](#5-backend-services)
6. [Backend Controllers & Routes](#6-backend-controllers--routes)
7. [Backend Middleware](#7-backend-middleware)
8. [Mobile App — Services](#8-mobile-app--services)
9. [Mobile App — Utilities](#9-mobile-app--utilities)
10. [Mobile App — Hooks](#10-mobile-app--hooks)
11. [Mobile App — Payment Components](#11-mobile-app--payment-components)
12. [Mobile App — Checkout Screen Integration](#12-mobile-app--checkout-screen-integration)
13. [Complete Payment Flow](#13-complete-payment-flow)
14. [Testing](#14-testing)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Architecture Overview

### The Core Flow

```
User Cart
  → Backend calculates tax via Shopify (draftOrderCalculate mutation)
  → Backend creates Shopify Draft Order (reserves inventory)
  → Backend creates Adyen Payment Session
  → Frontend renders Adyen payment UI (Card + Apple Pay)
  → User pays
  → Adyen sends AUTHORISATION webhook to backend
  → Backend completes Shopify Draft Order → becomes real Shopify Order
  → Backend creates local Order record in database
  → Frontend polls for order → shows confirmation
```

### Key Principles

1. **Shopify is NOT the payment gateway.** Adyen handles all money. Shopify handles product catalog, tax calculation, inventory, and fulfillment.
2. **The Adyen webhook is the source of truth.** The frontend does NOT create orders. It polls the backend after payment, waiting for the webhook to process.
3. **Draft Order is the bridge.** Created before payment (reserves inventory), completed after payment (creates real Shopify order).
4. **Idempotency is critical.** Adyen may send the same webhook multiple times. Every handler must check for existing orders before creating duplicates.

### System Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Mobile App  │────▶│  Express Backend  │────▶│   Shopify    │
│  (Expo)      │     │  (Node.js)        │     │  Admin API   │
│              │     │                    │     │  (GraphQL)   │
│  Adyen SDK   │     │  Adyen API Library │     └─────────────┘
│  (frontend)  │     │  (backend)         │
└──────┬───────┘     └────────┬───────────┘
       │                      │
       │                      ▼
       │              ┌───────────────┐
       └─────────────▶│   Adyen API    │
                      │   (payments)   │
                      └───────┬───────┘
                              │ webhook
                              ▼
                      ┌───────────────┐
                      │  Your Backend  │
                      │  /api/webhooks │
                      │  /adyen        │
                      └───────────────┘
```

---

## 2. Environment Variables

### Backend `.env`

The project already has these Adyen keys defined:

```env
# Adyen — already defined in your .env
ADYEN_API_KEY=<your adyen api key>           # Server-side API key (NEVER expose to client)
ADYEN_CLIENT_SECRET=<your adyen client key>  # Client-side key (safe for frontend/mobile)
ADYEN_WEBHOOK_HMAC=<your hmac secret>        # HMAC key for verifying webhook signatures

# Adyen — additional required variables
ADYEN_MERCHANT_ACCOUNT=<your merchant account name>   # e.g. "YourCompanyECOM"
ADYEN_ENVIRONMENT=test                                 # "test" or "LIVE"
# For live environment only:
# ADYEN_LIVE_ENDPOINT_URL_PREFIX=<your live prefix>   # From Adyen Customer Area

# Adyen — optional
ADYEN_STORE=<store reference>                # Only if using Adyen for Platforms
ADYEN_APPLE_PAY_MERCHANT_ID=merchant.com.yourcompany.app  # For Apple Pay
ADYEN_MERCHANT_NAME=Your Company Name        # Display name in Apple Pay sheet
APPLE_PAY_DOMAIN=yourdomain.com              # Domain registered for Apple Pay

# Webhook URL (where Adyen sends payment notifications)
WEBHOOK_BASE_URL=https://locoman-backend-870100645593.us-central1.run.app  # Public URL of your backend

# Shopify
SHOPIFY_STORE_URL=yourstore.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=<your shopify admin api token>
SHOPIFY_API_VERSION=2024-10
```

### Mobile App `.env` (Expo)

```env
EXPO_PUBLIC_ADYEN_CLIENT_KEY=<same as ADYEN_CLIENT_SECRET>
EXPO_PUBLIC_ADYEN_ENVIRONMENT=test
EXPO_PUBLIC_ADYEN_MERCHANT_ACCOUNT=<your merchant account>
EXPO_PUBLIC_ADYEN_MERCHANT_NAME=Your Company Name
EXPO_PUBLIC_ADYEN_APPLE_PAY_MERCHANT_ID=merchant.com.yourcompany.app
EXPO_PUBLIC_API_BASE_URL=https://locoman-backend-870100645593.us-central1.run.app
```

Also expose these via `app.config.js` or `app.config.ts`:

```typescript
// app.config.ts
export default {
  expo: {
    // ... other config
    extra: {
      adyenClientKey: process.env.EXPO_PUBLIC_ADYEN_CLIENT_KEY,
      adyenEnvironment: process.env.EXPO_PUBLIC_ADYEN_ENVIRONMENT,
      adyenMerchantAccount: process.env.EXPO_PUBLIC_ADYEN_MERCHANT_ACCOUNT,
      adyenMerchantName: process.env.EXPO_PUBLIC_ADYEN_MERCHANT_NAME,
      adyenApplePayMerchantId: process.env.EXPO_PUBLIC_ADYEN_APPLE_PAY_MERCHANT_ID,
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    },
  },
};
```

---

## 3. Dependencies

### Backend

```bash
npm install @adyen/api-library uuid
```

- `@adyen/api-library` — Adyen server-side SDK (session creation, webhook validation)
- `uuid` — idempotency keys for Adyen API calls

### Mobile App

```bash
npm install @adyen/adyen-web@^6 @adyen/react-native expo-constants
```

- `@adyen/react-native` — Native Adyen SDK for iOS/Android (Drop-in component)
- `@adyen/adyen-web` — Web Adyen SDK for Expo Web (Card + Apple Pay components)
- `expo-constants` — Access to `app.config.js` extra values at runtime

**Important for iOS**: Add Apple Pay capability in `app.json`:

```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.developer.in-app-payments": ["merchant.com.yourcompany.app"]
      }
    }
  }
}
```

---

## 4. Database Schema (Migrations)

### 4a. Add payment fields to `orders` table

Create a migration that adds these columns to your `orders` table:

```javascript
// migrations/XXXXXX-add-payment-details-to-orders.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'payment_reference', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Adyen pspReference — unique payment identifier',
    });
    await queryInterface.addColumn('orders', 'payment_session_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Adyen payment session ID',
    });
    await queryInterface.addColumn('orders', 'payment_result_code', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Adyen result code (e.g. Authorised, Refused)',
    });
    await queryInterface.addColumn('orders', 'payment_details', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Full payment details from Adyen webhook',
    });
    await queryInterface.addColumn('orders', 'payment_splits', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Payment split configuration for multi-vendor',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'payment_reference');
    await queryInterface.removeColumn('orders', 'payment_session_id');
    await queryInterface.removeColumn('orders', 'payment_result_code');
    await queryInterface.removeColumn('orders', 'payment_details');
    await queryInterface.removeColumn('orders', 'payment_splits');
  },
};
```

### 4b. Add Shopify draft order fields to `carts` table

```javascript
// migrations/XXXXXX-add-draft-order-id-to-carts.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('carts', 'shopify_draft_order_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Shopify draft order numeric ID',
    });
    await queryInterface.addColumn('carts', 'shopify_draft_order_gid', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Shopify draft order GraphQL GID (gid://shopify/DraftOrder/XXX)',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('carts', 'shopify_draft_order_id');
    await queryInterface.removeColumn('carts', 'shopify_draft_order_gid');
  },
};
```

### 4c. Add Shopify order fields to `orders` table

```javascript
// migrations/XXXXXX-add-shopify-order-to-orders.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'shopify_order_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'shopify_order_gid', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'shopify_order_number', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('orders', 'shopify_order_name', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'e.g. #1001',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'shopify_order_id');
    await queryInterface.removeColumn('orders', 'shopify_order_gid');
    await queryInterface.removeColumn('orders', 'shopify_order_number');
    await queryInterface.removeColumn('orders', 'shopify_order_name');
  },
};
```

Also ensure your `carts` table has columns for `shipping_address` (JSONB), `billing_address` (JSONB), `guest_email` (STRING), and `metadata` (JSONB). And your `order_items` table has a `vendor` (STRING) column.

---

## 5. Backend Services

### 5a. `adyenService.ts` — Adyen API Client (Singleton)

This service wraps the Adyen API library. It creates payment sessions and handles Apple Pay validation.

```typescript
// src/services/adyenService.ts
import { Client, Config, EnvironmentEnum, CheckoutAPI } from '@adyen/api-library';
import {
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
} from '@adyen/api-library/lib/src/typings/checkout/models';
import { v4 as uuidv4 } from 'uuid';

type AdyenEnvironment = 'test' | 'LIVE' | 'live-us' | 'live-au' | 'live-apse' | 'live-in';

// Singleton pattern — Adyen docs recommend reusing the client
let adyenClient: Client | undefined;

function getAdyenClient(): Client {
  if (!adyenClient) {
    const apiKey = process.env.ADYEN_API_KEY;
    const environment = process.env.ADYEN_ENVIRONMENT as AdyenEnvironment;
    const liveEndpointUrlPrefix = process.env.ADYEN_LIVE_ENDPOINT_URL_PREFIX;

    if (!apiKey) throw new Error('ADYEN_API_KEY environment variable is required');
    if (!environment) throw new Error('ADYEN_ENVIRONMENT environment variable is required');

    const clientConfig: Config = {
      apiKey,
      environment: environment as EnvironmentEnum,
    };

    // Live environments require the endpoint URL prefix
    if (environment === 'LIVE' && liveEndpointUrlPrefix) {
      clientConfig.liveEndpointUrlPrefix = liveEndpointUrlPrefix;
    }

    adyenClient = new Client(clientConfig);
  }
  return adyenClient;
}

export interface CreatePaymentSessionParams {
  amount: {
    value: number;    // Amount in MINOR UNITS (e.g., 1000 = £10.00)
    currency: string; // ISO 4217 (e.g., "GBP", "USD", "EUR")
  };
  reference: string;       // Your unique order reference (used to identify in webhooks)
  returnUrl: string;       // Where to redirect after payment (deep link for mobile)
  merchantAccount: string;
  countryCode?: string;    // ISO 3166-1 alpha-2 (e.g., "GB")
  channel?: string;        // "Web", "iOS", "Android"
  store?: string;          // Adyen for Platforms store reference
  shopperReference?: string;
  shopperEmail?: string;
  shopperLocale?: string;
  billingAddress?: {
    street: string;
    houseNumberOrName?: string; // Adyen REQUIRES this field
    city: string;
    postalCode: string;
    country: string;
    stateOrProvince?: string;
  };
  deliveryAddress?: {
    street: string;
    houseNumberOrName?: string;
    city: string;
    postalCode: string;
    country: string;
    stateOrProvince?: string;
  };
  metadata?: Record<string, string | undefined>;
}

export class AdyenService {
  /**
   * Create an Adyen payment session.
   * Returns session ID + sessionData that the frontend needs to render payment UI.
   */
  static async createPaymentSession(
    params: CreatePaymentSessionParams
  ): Promise<CreateCheckoutSessionResponse> {
    const client = getAdyenClient();
    const checkout = new CheckoutAPI(client);

    const sessionRequest: CreateCheckoutSessionRequest = {
      amount: {
        value: params.amount.value,
        currency: params.amount.currency,
      },
      reference: params.reference,
      returnUrl: params.returnUrl,
      merchantAccount: params.merchantAccount,
      countryCode: params.countryCode || 'GB',
      channel:
        (params.channel as CreateCheckoutSessionRequest.ChannelEnum) ||
        CreateCheckoutSessionRequest.ChannelEnum.Web,
      ...(params.store && { store: params.store }),
      shopperReference: params.shopperReference,
      shopperEmail: params.shopperEmail,
      shopperLocale: params.shopperLocale || 'en-GB',
      shopperInteraction: CreateCheckoutSessionRequest.ShopperInteractionEnum.Ecommerce,
      ...(params.billingAddress && {
        billingAddress: {
          street: params.billingAddress.street,
          city: params.billingAddress.city,
          postalCode: params.billingAddress.postalCode,
          country: params.billingAddress.country,
          ...(params.billingAddress.houseNumberOrName && {
            houseNumberOrName: params.billingAddress.houseNumberOrName,
          }),
          ...(params.billingAddress.stateOrProvince && {
            stateOrProvince: params.billingAddress.stateOrProvince,
          }),
        } as any,
      }),
      ...(params.deliveryAddress && {
        deliveryAddress: {
          street: params.deliveryAddress.street,
          city: params.deliveryAddress.city,
          postalCode: params.deliveryAddress.postalCode,
          country: params.deliveryAddress.country,
          ...(params.deliveryAddress.houseNumberOrName && {
            houseNumberOrName: params.deliveryAddress.houseNumberOrName,
          }),
          ...(params.deliveryAddress.stateOrProvince && {
            stateOrProvince: params.deliveryAddress.stateOrProvince,
          }),
        } as any,
      }),
    };

    // Idempotency key prevents duplicate sessions on retries
    const idempotencyKey = uuidv4();

    console.log('[AdyenService] Creating session', {
      reference: params.reference,
      amount: params.amount,
      merchantAccount: params.merchantAccount,
    });

    const response = await checkout.PaymentsApi.sessions(sessionRequest, {
      idempotencyKey,
    });

    console.log('[AdyenService] Session created', {
      sessionId: response.id,
      hasSessionData: !!response.sessionData,
    });

    return response;
  }
}
```

**Critical notes for the implementing AI:**
- The `amount.value` MUST be in minor units (cents/pence). £10.00 = `1000`.
- `houseNumberOrName` is required by Adyen for delivery addresses. If the user doesn't provide it, extract a number from the street address or use the first part of the street string.
- The `reference` field is how you identify the order in webhooks. Use format `ORDER-{cartId}-{timestamp}`.

---

### 5b. `shopifyAdminService.ts` — GraphQL Client for Shopify

```typescript
// src/services/shopifyAdminService.ts

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;       // e.g. "yourstore.myshopify.com"
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

/**
 * Execute a GraphQL query against the Shopify Admin API.
 */
export async function executeShopifyAdminQuery<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const url = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN!,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify Admin API error: ${response.status} - ${text}`);
  }

  const json = await response.json();

  if (json.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data as T;
}

/**
 * Execute a GraphQL mutation against the Shopify Admin API.
 * (Identical to query — separated for semantic clarity.)
 */
export async function executeShopifyAdminMutation<T>(
  mutation: string,
  variables?: Record<string, any>
): Promise<T> {
  return executeShopifyAdminQuery<T>(mutation, variables);
}
```

---

### 5c. `shopifyDraftOrderService.ts` — Draft Order Management

This is the most important Shopify integration. It has three methods:
- `calculateDraftOrder()` — Preview totals including tax (used before payment)
- `createDraftOrder()` — Create a draft order (reserves inventory)
- `completeDraftOrder()` — Convert draft to real order (after payment)

```typescript
// src/services/shopifyDraftOrderService.ts
import { executeShopifyAdminMutation, executeShopifyAdminQuery } from './shopifyAdminService';

// ─── GraphQL Operations ───────────────────────────────────────────────

const CREATE_DRAFT_ORDER_MUTATION = `
  mutation createDraftOrder($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        currencyCode
        totalPriceSet {
          presentmentMoney { amount }
        }
      }
      userErrors { message field }
    }
  }
`;

const GET_DRAFT_ORDER_QUERY = `
  query getDraftOrder($id: ID!) {
    draftOrder(id: $id) {
      id
      status
      order {
        id
        name
      }
    }
  }
`;

const COMPLETE_DRAFT_ORDER_MUTATION = `
  mutation draftOrderComplete($id: ID!) {
    draftOrderComplete(id: $id) {
      draftOrder {
        id
        status
        order {
          id
          name
        }
      }
      userErrors { field message }
    }
  }
`;

const CALCULATE_DRAFT_ORDER_MUTATION = `
  mutation calculateDraftOrder($input: DraftOrderInput!) {
    draftOrderCalculate(input: $input) {
      calculatedDraftOrder {
        currencyCode
        taxLines {
          title
          rate
          priceSet {
            presentmentMoney { amount currencyCode }
          }
        }
        subtotalPriceSet {
          presentmentMoney { amount currencyCode }
        }
        totalPriceSet {
          presentmentMoney { amount currencyCode }
        }
        totalShippingPriceSet {
          presentmentMoney { amount currencyCode }
        }
        totalTaxSet {
          presentmentMoney { amount currencyCode }
        }
        totalDiscountsSet {
          presentmentMoney { amount currencyCode }
        }
      }
      userErrors { field message }
    }
  }
`;

// ─── Types ────────────────────────────────────────────────────────────

export interface DraftOrderInput {
  lineItems: Array<{ variantId: string; quantity: number }>;
  customerId?: string;
  email?: string;
  phone?: string;
  billingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    zip: string;
    countryCode: string;
    firstName?: string;
    lastName?: string;
  };
  shippingAddress?: {
    address1: string;
    address2?: string;
    city: string;
    province?: string;
    zip: string;
    countryCode: string;
    firstName?: string;
    lastName?: string;
  };
  customAttributes?: Array<{ key: string; value: string }>;
  note?: string;
  taxExempt?: boolean;
}

export interface DraftOrderCalculation {
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  taxLines: Array<{ title: string; rate: number; amount: number }>;
}

// ─── Service ──────────────────────────────────────────────────────────

export class ShopifyDraftOrderService {

  /**
   * Helper: Build a DraftOrderInput from cart items and address options.
   * Reused by both calculateDraftOrder and createDraftOrder.
   */
  private static buildDraftOrderInput(
    cartItems: Array<{ product_variant_id: string; quantity: number }>,
    options?: {
      email?: string;
      billingAddress?: any;
      shippingAddress?: any;
    },
    customAttributes?: Array<{ key: string; value: string }>
  ): DraftOrderInput {
    // Convert your variant IDs to Shopify GID format
    const lineItems = cartItems.map((item) => ({
      variantId: `gid://shopify/ProductVariant/${item.product_variant_id}`,
      quantity: item.quantity,
    }));

    return {
      lineItems,
      taxExempt: false, // Let Shopify calculate tax
      ...(customAttributes && { customAttributes }),
      ...(options?.email && { email: options.email }),
      ...(options?.billingAddress && {
        billingAddress: {
          address1: options.billingAddress.street || options.billingAddress.address1 || '',
          address2: options.billingAddress.address2,
          city: options.billingAddress.city || '',
          province: options.billingAddress.stateOrProvince || options.billingAddress.province,
          zip: options.billingAddress.postalCode || options.billingAddress.zip || '',
          countryCode: options.billingAddress.country || 'GB',
          firstName: options.billingAddress.firstName,
          lastName: options.billingAddress.lastName,
        },
      }),
      ...(options?.shippingAddress && {
        shippingAddress: {
          address1: options.shippingAddress.street || options.shippingAddress.address1 || '',
          address2: options.shippingAddress.address2,
          city: options.shippingAddress.city || '',
          province: options.shippingAddress.stateOrProvince || options.shippingAddress.province,
          zip: options.shippingAddress.postalCode || options.shippingAddress.zip || '',
          countryCode: options.shippingAddress.country || 'GB',
          firstName: options.shippingAddress.firstName,
          lastName: options.shippingAddress.lastName,
        },
      }),
    };
  }

  /**
   * STEP 1: Calculate totals (tax, shipping, discounts) WITHOUT creating a draft order.
   * Call this BEFORE createDraftOrder to know exactly what amount to charge via Adyen.
   */
  static async calculateDraftOrder(
    cartItems: Array<{ product_variant_id: string; quantity: number }>,
    options?: {
      email?: string;
      billingAddress?: any;
      shippingAddress?: any;
    }
  ): Promise<DraftOrderCalculation> {
    const input = this.buildDraftOrderInput(cartItems, options);

    const response = await executeShopifyAdminMutation<{
      draftOrderCalculate: {
        calculatedDraftOrder: any;
        userErrors: Array<{ message: string; field?: string[] }>;
      };
    }>(CALCULATE_DRAFT_ORDER_MUTATION, { input });

    if (response.draftOrderCalculate.userErrors?.length > 0) {
      const errors = response.draftOrderCalculate.userErrors.map((e) => e.message).join(', ');
      throw new Error(`Shopify draft order calculation failed: ${errors}`);
    }

    const calc = response.draftOrderCalculate.calculatedDraftOrder;
    if (!calc) throw new Error('Shopify draft order calculation returned no data');

    const subtotalFromShopify = parseFloat(calc.subtotalPriceSet.presentmentMoney.amount);
    const tax = parseFloat(calc.totalTaxSet.presentmentMoney.amount);
    const shipping = parseFloat(calc.totalShippingPriceSet.presentmentMoney.amount);
    const discount = parseFloat(calc.totalDiscountsSet.presentmentMoney.amount);
    const total = parseFloat(calc.totalPriceSet.presentmentMoney.amount);
    const currency = calc.currencyCode;

    // In tax-inclusive regions (UK, EU), Shopify's subtotal includes tax.
    // Subtract tax for a proper breakdown.
    const subtotal = subtotalFromShopify - tax;

    const taxLines = calc.taxLines.map((line: any) => ({
      title: line.title,
      rate: line.rate,
      amount: parseFloat(line.priceSet.presentmentMoney.amount),
    }));

    return { subtotal, tax, shipping, discount, total, currency, taxLines };
  }

  /**
   * STEP 2: Create a Shopify Draft Order from cart items.
   * This reserves inventory but does NOT create a real order yet.
   */
  static async createDraftOrder(
    cartItems: Array<{ product_variant_id: string; quantity: number }>,
    cartId: string,
    options?: {
      email?: string;
      billingAddress?: any;
      shippingAddress?: any;
    }
  ): Promise<{ draftOrderId: string; draftOrderGid: string }> {
    // Store cartId as a custom attribute for traceability
    const customAttributes = [{ key: 'cartId', value: cartId }];
    const input = this.buildDraftOrderInput(cartItems, options, customAttributes);

    const response = await executeShopifyAdminMutation<{
      draftOrderCreate: {
        draftOrder: { id: string; currencyCode: string; totalPriceSet: any } | null;
        userErrors: Array<{ message: string; field?: string[] }>;
      };
    }>(CREATE_DRAFT_ORDER_MUTATION, { input });

    if (response.draftOrderCreate.userErrors?.length > 0) {
      const errors = response.draftOrderCreate.userErrors.map((e) => e.message).join(', ');
      throw new Error(`Shopify draft order creation failed: ${errors}`);
    }

    if (!response.draftOrderCreate.draftOrder) {
      throw new Error('Shopify draft order creation returned no draft order');
    }

    const draftOrder = response.draftOrderCreate.draftOrder;
    const draftOrderGid = draftOrder.id; // e.g. "gid://shopify/DraftOrder/123456789"
    const draftOrderId = draftOrderGid.split('/').pop() || '';

    return { draftOrderId, draftOrderGid };
  }

  /**
   * STEP 3: Complete a draft order — converts it to a REAL Shopify order.
   * Call this from the webhook handler AFTER payment is confirmed.
   * Handles race conditions (duplicate webhook calls, concurrent completion).
   */
  static async completeDraftOrder(
    draftOrderGid: string
  ): Promise<{ orderId: string; orderNumber: number; orderName: string }> {

    // First check if draft order is already completed (idempotency)
    try {
      const check = await executeShopifyAdminQuery<{
        draftOrder: {
          id: string;
          status: string;
          order: { id: string; name: string } | null;
        } | null;
      }>(GET_DRAFT_ORDER_QUERY, { id: draftOrderGid });

      if (check.draftOrder?.order) {
        // Already completed — return the existing order
        const orderGid = check.draftOrder.order.id;
        const orderId = orderGid.split('/').pop() || '';
        const orderNumber = parseInt(check.draftOrder.order.name?.match(/#(\d+)/)?.[1] || '0', 10);
        return { orderId, orderNumber, orderName: check.draftOrder.order.name };
      }
    } catch {
      // If check fails, proceed with completion attempt
    }

    // Complete the draft order
    const response = await executeShopifyAdminMutation<{
      draftOrderComplete: {
        draftOrder: {
          id: string;
          status: string;
          order: { id: string; name: string } | null;
        } | null;
        userErrors: Array<{ message: string; field?: string[] }>;
      };
    }>(COMPLETE_DRAFT_ORDER_MUTATION, { id: draftOrderGid });

    // Handle user errors
    if (response.draftOrderComplete.userErrors?.length > 0) {
      const errors = response.draftOrderComplete.userErrors.map((e) => e.message).join(', ');

      // Handle race condition: "Another staff member is processing"
      const isProcessingError = response.draftOrderComplete.userErrors.some(
        (e) => e.message?.toLowerCase().includes('another staff member is processing')
      );

      if (isProcessingError) {
        // Wait and retry the check
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const retryCheck = await executeShopifyAdminQuery<{
          draftOrder: {
            id: string;
            status: string;
            order: { id: string; name: string } | null;
          } | null;
        }>(GET_DRAFT_ORDER_QUERY, { id: draftOrderGid });

        if (retryCheck.draftOrder?.order) {
          const orderGid = retryCheck.draftOrder.order.id;
          const orderId = orderGid.split('/').pop() || '';
          const orderNumber = parseInt(retryCheck.draftOrder.order.name?.match(/#(\d+)/)?.[1] || '0', 10);
          return { orderId, orderNumber, orderName: retryCheck.draftOrder.order.name };
        }
      }

      throw new Error(`Shopify draft order completion failed: ${errors}`);
    }

    if (!response.draftOrderComplete.draftOrder?.order) {
      throw new Error('Draft order completed but no order was created');
    }

    const order = response.draftOrderComplete.draftOrder.order;
    const orderGid = order.id;
    const orderId = orderGid.split('/').pop() || '';
    const orderNumber = parseInt(order.name?.match(/#(\d+)/)?.[1] || '0', 10);

    return { orderId, orderNumber, orderName: order.name };
  }
}
```

---

### 5d. `paymentService.ts` — Payment Session Orchestration

This is the main orchestrator. It:
1. Loads the cart
2. Calculates tax via Shopify
3. Creates a Shopify Draft Order
4. Stores draft order info on the cart
5. Creates an Adyen Payment Session
6. Returns session ID + sessionData to the frontend

```typescript
// src/services/paymentService.ts
import { AdyenService, CreatePaymentSessionParams } from './adyenService';
import { ShopifyDraftOrderService } from './shopifyDraftOrderService';
// Import your cart service / model — adjust to your project
// import { getCartWithItems } from './cartService';
// import { Cart } from '../db/models/Cart';

export interface PaymentSessionRequest {
  cartId: string;
  userId?: string;
  returnUrl: string;          // Deep link: "yourapp://payment/return"
  shopperEmail?: string;
  shopperReference?: string;
  billingAddress?: {
    street: string;
    address2?: string;
    houseNumberOrName?: string;
    city: string;
    postalCode: string;
    country: string;
    stateOrProvince?: string;
    firstName?: string;
    lastName?: string;
  };
  deliveryAddress?: {
    street: string;
    address2?: string;
    houseNumberOrName?: string;
    city: string;
    postalCode: string;
    country: string;
    stateOrProvince?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

export interface PaymentSessionResponse {
  id: string;          // Adyen session ID
  sessionData: string; // Adyen session data (opaque string)
}

export class PaymentService {
  static async createPaymentSession(
    request: PaymentSessionRequest
  ): Promise<PaymentSessionResponse> {

    // ─── 1. Load the cart ───────────────────────────────────────────
    const cart = await getCartWithItems(request.cartId);
    if (!cart) throw new Error('Cart not found');
    if (!cart.cart_items || cart.cart_items.length === 0) throw new Error('Cart is empty');

    // ─── 2. Calculate tax via Shopify ───────────────────────────────
    const taxCalculation = await ShopifyDraftOrderService.calculateDraftOrder(
      cart.cart_items,
      {
        email: request.shopperEmail,
        billingAddress: request.billingAddress,
        shippingAddress: request.deliveryAddress,
      }
    );

    // ─── 3. Create Shopify Draft Order ──────────────────────────────
    const draftOrderResult = await ShopifyDraftOrderService.createDraftOrder(
      cart.cart_items,
      cart.id,
      {
        email: request.shopperEmail,
        billingAddress: request.billingAddress,
        shippingAddress: request.deliveryAddress,
      }
    );

    // ─── 4. Store draft order info + tax calculation on cart ────────
    await cart.update({
      shopify_draft_order_id: draftOrderResult.draftOrderId,
      shopify_draft_order_gid: draftOrderResult.draftOrderGid,
      shipping_address: request.deliveryAddress || null,
      billing_address: request.billingAddress || null,
      guest_email: request.shopperEmail || null,
      metadata: {
        tax_calculation: {
          subtotal: taxCalculation.subtotal,
          tax: taxCalculation.tax,
          shipping: taxCalculation.shipping,
          discount: taxCalculation.discount,
          total: taxCalculation.total,
          currency: taxCalculation.currency,
          taxLines: taxCalculation.taxLines,
        },
      },
    });

    // ─── 5. Prepare Adyen session ───────────────────────────────────
    // Use the Shopify-calculated total (includes tax, shipping, discounts)
    const amountInMinorUnits = Math.round(taxCalculation.total * 100);
    const reference = `ORDER-${cart.id}-${Date.now()}`;

    const merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT;
    if (!merchantAccount) throw new Error('ADYEN_MERCHANT_ACCOUNT is required');

    // Helper: extract house number from street address for Adyen
    const formatAddressForAdyen = (address: any) => {
      if (!address) return undefined;
      let houseNumberOrName = address.houseNumberOrName;
      if (!houseNumberOrName && address.street) {
        const match = address.street.match(/^(\d+[A-Za-z]?)\s+(.+)/);
        houseNumberOrName = match ? match[1] : address.street.substring(0, 20);
      }
      if (!houseNumberOrName) houseNumberOrName = 'N/A';
      return {
        street: address.street,
        houseNumberOrName,
        city: address.city,
        postalCode: address.postalCode,
        country: address.country || 'GB',
        ...(address.stateOrProvince && { stateOrProvince: address.stateOrProvince }),
      };
    };

    const adyenParams: CreatePaymentSessionParams = {
      amount: {
        value: amountInMinorUnits,
        currency: taxCalculation.currency,
      },
      reference,
      returnUrl: request.returnUrl,
      merchantAccount,
      countryCode: 'GB',
      channel: 'Web',
      shopperReference: request.shopperReference || request.userId || `guest-${Date.now()}`,
      shopperEmail: request.shopperEmail,
      shopperLocale: 'en-GB',
      billingAddress: formatAddressForAdyen(request.billingAddress),
      deliveryAddress: formatAddressForAdyen(request.deliveryAddress),
      metadata: {
        cartId: cart.id,
        draftOrderId: draftOrderResult.draftOrderId,
        draftOrderGid: draftOrderResult.draftOrderGid,
      },
    };

    // ─── 6. Create Adyen session ────────────────────────────────────
    const adyenSession = await AdyenService.createPaymentSession(adyenParams);

    if (!adyenSession.sessionData) {
      throw new Error('No session data returned from Adyen');
    }

    return {
      id: adyenSession.id,
      sessionData: adyenSession.sessionData,
    };
  }
}
```

---

### 5e. `webhookService.ts` — Adyen Webhook Processing

This is the most critical service. It runs when Adyen sends an `AUTHORISATION` webhook after payment.

```typescript
// src/services/webhookService.ts
import {
  Notification,
  NotificationRequestItem,
} from '@adyen/api-library/lib/src/typings/notification/models';
import { ShopifyDraftOrderService } from './shopifyDraftOrderService';
import { Order, OrderStatus, PaymentStatus } from '../db/models/Order';
// import { OrderService } from './orderService';
// import { getCartWithItems } from './cartService';
// import { sequelize } from '../db';

export interface WebhookProcessingResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

export class WebhookService {
  static async processAuthorisationWebhook(
    notificationRequest: Notification
  ): Promise<WebhookProcessingResult> {

    const items = notificationRequest.notificationItems;
    if (!items || items.length === 0) {
      return { success: false, error: 'No notification items' };
    }

    const item = items[0].NotificationRequestItem;

    // ─── Validate event type ──────────────────────────────────────
    if (item.eventCode !== NotificationRequestItem.EventCodeEnum.Authorisation) {
      return { success: false, error: `Unexpected event: ${item.eventCode}` };
    }

    // ─── Validate success ─────────────────────────────────────────
    if (item.success !== NotificationRequestItem.SuccessEnum.True) {
      return { success: false, error: `Authorization failed: ${item.reason}` };
    }

    // ─── Extract cart ID ──────────────────────────────────────────
    const merchantReference = item.merchantReference || '';
    const additionalData = item.additionalData;
    let cartId = additionalData?.['metadata.cartId'];

    // Fallback: parse from reference (format: ORDER-{cartId}-{timestamp})
    if (!cartId && merchantReference.startsWith('ORDER-')) {
      const withoutPrefix = merchantReference.substring(6);
      const uuidMatch = withoutPrefix.match(
        /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
      );
      if (uuidMatch) cartId = uuidMatch[1];
    }

    if (!cartId) {
      return { success: false, error: 'Cart ID not found in webhook' };
    }

    // ─── Idempotency check ────────────────────────────────────────
    const paymentReference = item.pspReference;
    const existingOrder = await Order.findOne({
      where: { payment_reference: paymentReference },
    });
    if (existingOrder) {
      return { success: true, orderId: existingOrder.id }; // Already processed
    }

    // ─── Load cart ────────────────────────────────────────────────
    const cart = await getCartWithItems(cartId);
    if (!cart) return { success: false, error: `Cart not found: ${cartId}` };
    if (!cart.cart_items || cart.cart_items.length === 0) {
      // Check if order already exists for this cart (cart cleared after order)
      const existingByCart = await Order.findOne({ where: { cart_id: cartId } });
      if (existingByCart) return { success: true, orderId: existingByCart.id };
      return { success: false, error: 'Cart is empty and no order exists' };
    }

    // ─── Get draft order GID ──────────────────────────────────────
    const draftOrderGid =
      cart.shopify_draft_order_gid || additionalData?.['metadata.draftOrderGid'];

    if (!draftOrderGid) {
      return { success: false, error: 'No Shopify draft order found' };
    }

    // ─── Complete Shopify Draft Order ─────────────────────────────
    // This is the critical step: converts draft → real Shopify order
    let shopifyOrderId: string;
    let shopifyOrderGid: string;
    let shopifyOrderNumber: number;
    let shopifyOrderName: string;

    try {
      const result = await ShopifyDraftOrderService.completeDraftOrder(draftOrderGid);
      shopifyOrderId = result.orderId;
      shopifyOrderGid = `gid://shopify/Order/${result.orderId}`;
      shopifyOrderNumber = result.orderNumber;
      shopifyOrderName = result.orderName;
    } catch (error) {
      return {
        success: false,
        error: `Failed to complete Shopify draft order: ${
          error instanceof Error ? error.message : 'Unknown'
        }`,
      };
    }

    // ─── Create local order ───────────────────────────────────────
    // Build payment details from webhook data
    const paymentDetails = {
      paymentMethod: item.paymentMethod,
      amount: item.amount,
      merchantReference: item.merchantReference,
      eventCode: item.eventCode,
      eventDate: item.eventDate,
      success: item.success,
    };

    try {
      const order = await OrderService.createOrder({
        cartId: cart.id,
        userId: cart.user_id || undefined,
        paymentMethod: 'adyen',
        paymentStatus: PaymentStatus.PAID,
        status: OrderStatus.PROCESSING,
        paymentReference,
        paymentResultCode: 'Authorised',
        paymentDetails,
        shippingAddress: cart.shipping_address,
        billingAddress: cart.billing_address,
        shopifyOrderId,
        shopifyOrderGid,
        shopifyOrderNumber,
        shopifyOrderName,
        notes: `Order via Adyen webhook. PSP: ${paymentReference}`,
      });

      return { success: true, orderId: order.id };
    } catch (error) {
      // NOTE: Shopify order exists but local order failed.
      // This needs manual intervention or a retry mechanism.
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order',
      };
    }
  }
}
```

---

## 6. Backend Controllers & Routes

### 6a. Payment Controller

```typescript
// src/controllers/payment.controller.ts
import { Request, Response } from 'express';
import { PaymentService } from '../services/paymentService';

export class PaymentController {
  static async createSession(req: Request, res: Response) {
    try {
      const { cartId, userId, returnUrl, shopperEmail, billingAddress, deliveryAddress } = req.body;

      if (!cartId || !returnUrl) {
        return res.status(400).json({ message: 'cartId and returnUrl are required' });
      }

      const session = await PaymentService.createPaymentSession({
        cartId,
        userId,
        returnUrl,
        shopperEmail,
        billingAddress,
        deliveryAddress,
      });

      return res.json(session);
    } catch (error) {
      console.error('[PaymentController] Error creating session', error);
      return res.status(500).json({
        message: error instanceof Error ? error.message : 'Failed to create payment session',
      });
    }
  }
}
```

### 6b. Webhook Controller

```typescript
// src/controllers/webhook.controller.ts
import { Request, Response } from 'express';
import { WebhookService } from '../services/webhookService';

export class WebhookController {
  static async handleAdyenWebhook(req: Request, res: Response) {
    try {
      const result = await WebhookService.processAuthorisationWebhook(req.body);

      if (!result.success) {
        console.error('[WebhookController] Webhook processing failed', result.error);
      }

      // IMPORTANT: Always return 200 to Adyen, even on failure.
      // Adyen will retry on non-200, which could cause infinite loops.
      // Log errors for investigation instead.
      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('[WebhookController] Unexpected error', error);
      // Still return 200 to prevent Adyen retries
      return res.status(200).json({ received: true });
    }
  }
}
```

**CRITICAL**: The webhook endpoint MUST always return HTTP 200. If you return anything else, Adyen will keep retrying the webhook.

### 6c. Routes

```typescript
// src/routes/payment.routes.ts
import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();
router.post('/session', PaymentController.createSession);
export default router;

// src/routes/webhook.routes.ts
import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { verifyAdyenHmac } from '../middleware/adyenWebhook.middleware';

const router = Router();
// The HMAC middleware verifies the webhook is authentic
router.post('/adyen', verifyAdyenHmac, WebhookController.handleAdyenWebhook);
export default router;
```

Register in your Express app:

```typescript
// src/index.ts (or app.ts)
import paymentRoutes from './routes/payment.routes';
import webhookRoutes from './routes/webhook.routes';

app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);

// Also add an endpoint to poll for orders by cart ID
// The frontend calls this after payment to check if the webhook processed
app.get('/api/orders/by-cart/:cartId', async (req, res) => {
  const order = await OrderService.getOrderByCartId(req.params.cartId);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json(order);
});
```

---

## 7. Backend Middleware

### `adyenWebhook.middleware.ts` — HMAC Signature Verification

```typescript
// src/middleware/adyenWebhook.middleware.ts
import { hmacValidator } from '@adyen/api-library';
import { Notification } from '@adyen/api-library/lib/src/typings/notification/models';
import { Request, Response, NextFunction } from 'express';

export const verifyAdyenHmac = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hmacSecret = process.env.ADYEN_WEBHOOK_HMAC;
    if (!hmacSecret) {
      console.error('[WebhookMiddleware] ADYEN_WEBHOOK_HMAC not configured');
      return res.status(500).json({ message: 'Webhook verification not configured' });
    }

    const validator = new hmacValidator();
    const notification: Notification = req.body;

    if (!notification.notificationItems || notification.notificationItems.length === 0) {
      return res.status(400).json({ message: 'Invalid webhook format' });
    }

    // Check if HMAC signatures are present
    const hasHmac = notification.notificationItems.some(
      (item) => item.NotificationRequestItem.additionalData?.hmacSignature
    );

    // In development, allow unsigned test webhooks from Adyen dashboard
    if (!hasHmac) {
      if (process.env.NODE_ENV !== 'production') {
        return next(); // Allow test webhooks
      }
      return res.status(401).json({ message: 'Missing HMAC signature' });
    }

    // Validate each notification item's HMAC
    const allValid = notification.notificationItems.every((item) => {
      const notifItem = item.NotificationRequestItem;
      if (notifItem.additionalData?.hmacSignature) {
        return validator.validateHMAC(notifItem, hmacSecret);
      }
      return true;
    });

    if (!allValid) {
      return res.status(401).json({ message: 'Invalid HMAC signature' });
    }

    return next();
  } catch (error) {
    // Handle "Missing hmacSignature" error for test webhooks
    if (error instanceof Error && error.message.includes('Missing hmacSignature')) {
      if (process.env.NODE_ENV !== 'production') return next();
      return res.status(401).json({ message: 'Missing HMAC signature' });
    }
    console.error('[WebhookMiddleware] HMAC verification error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
```

---

## 8. Mobile App — Services

### `payment-api.ts` — API Client

```typescript
// services/api/payment-api.ts
import Constants from 'expo-constants';

const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'http://localhost:3001';

export interface PaymentSessionResponse {
  id: string;
  sessionData: string;
}

export async function createPaymentSession(params: {
  cartId: string;
  userId?: string;
  returnUrl: string;
  shopperEmail?: string;
  billingAddress?: any;
  deliveryAddress?: any;
  authToken?: string;
}): Promise<PaymentSessionResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (params.authToken) {
    headers['Authorization'] = `Bearer ${params.authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/payments/session`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      cartId: params.cartId,
      userId: params.userId,
      returnUrl: params.returnUrl,
      shopperEmail: params.shopperEmail,
      billingAddress: params.billingAddress,
      deliveryAddress: params.deliveryAddress,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Payment session creation failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Poll for order by cart ID. Call this after payment succeeds.
 * The order is created asynchronously by the webhook.
 */
export async function getOrderByCartId(
  cartId: string,
  authToken?: string
): Promise<any | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const response = await fetch(`${API_BASE_URL}/api/orders/by-cart/${cartId}`, { headers });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to fetch order: ${response.status}`);
  return response.json();
}
```

---

## 9. Mobile App — Utilities

### `adyen.utils.ts` — Adyen Configuration

```typescript
// utils/adyen.utils.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { Configuration } from '@adyen/react-native';

const getEnv = (key: string): string => {
  const extraKeyMap: Record<string, string> = {
    EXPO_PUBLIC_ADYEN_CLIENT_KEY: 'adyenClientKey',
    EXPO_PUBLIC_ADYEN_ENVIRONMENT: 'adyenEnvironment',
    EXPO_PUBLIC_ADYEN_MERCHANT_ACCOUNT: 'adyenMerchantAccount',
    EXPO_PUBLIC_ADYEN_MERCHANT_NAME: 'adyenMerchantName',
    EXPO_PUBLIC_ADYEN_APPLE_PAY_MERCHANT_ID: 'adyenApplePayMerchantId',
  };
  const extraKey = extraKeyMap[key] || key;
  return Constants.expoConfig?.extra?.[extraKey] || process.env[key] || '';
};

export const ADYEN_ENVIRONMENT = getEnv('EXPO_PUBLIC_ADYEN_ENVIRONMENT') || 'test';

/**
 * Build the Adyen checkout configuration for the React Native SDK.
 * Used by AdyenPayment.native.tsx.
 */
export function getAdyenCheckoutConfiguration(): Configuration {
  return {
    environment: ADYEN_ENVIRONMENT as any,
    clientKey: getEnv('EXPO_PUBLIC_ADYEN_CLIENT_KEY'),
    countryCode: 'GB',
    amount: { value: 0, currency: 'GBP' }, // Will be overridden by session
    locale: 'en-GB',
    dropin: {
      skipListWhenSinglePaymentMethod: false,
    },
    card: {
      holderNameRequired: true,
      addressVisibility: 'none',
    },
    // Apple Pay (iOS only)
    ...(Platform.OS === 'ios' && {
      applepay: {
        merchantID: getEnv('EXPO_PUBLIC_ADYEN_APPLE_PAY_MERCHANT_ID'),
        merchantName: getEnv('EXPO_PUBLIC_ADYEN_MERCHANT_NAME'),
      },
    }),
  };
}
```

---

## 10. Mobile App — Hooks

### `useAdyenCheckout.native.ts` — Native Payment Result Handler

```typescript
// hooks/useAdyenCheckout.native.ts
import { useCallback } from 'react';
import type { SessionConfiguration } from '@adyen/react-native/lib/typescript/core/types';
import type { PaymentResponse } from '@adyen/react-native';

interface UseAdyenCheckoutProps {
  session: SessionConfiguration;
  onSuccess?: (paymentResult?: any) => void;
  onError?: (error: string) => void;
}

export function useAdyenCheckout({ session, onSuccess, onError }: UseAdyenCheckoutProps) {
  const handleComplete = useCallback(
    (result: PaymentResponse, _nativeComponent: any) => {
      console.log('[useAdyenCheckout] Payment complete', result);
      if (result.resultCode === 'Authorised' || result.resultCode === 'Received') {
        onSuccess?.(result);
      } else {
        onError?.(`Payment ${result.resultCode || 'failed'}`);
      }
    },
    [onSuccess, onError]
  );

  const handleError = useCallback(
    (error: any, _nativeComponent: any) => {
      console.error('[useAdyenCheckout] Payment error', error);
      const message =
        error?.message || error?.error?.message || 'Payment failed. Please try again.';
      onError?.(message);
    },
    [onError]
  );

  return { handleComplete, handleError };
}
```

### `useAdyenCheckout.ts` — Web stub (throws error if accidentally used)

```typescript
// hooks/useAdyenCheckout.ts
// Web platform — this hook is not used. The web component handles everything internally.
export function useAdyenCheckout(_props: any) {
  throw new Error('useAdyenCheckout is only available on native platforms');
}
```

---

## 11. Mobile App — Payment Components

You need **three files** using React Native's platform-specific file extensions:

### 11a. `AdyenPayment.tsx` — Fallback (should never render)

```typescript
// components/payment/AdyenPayment.tsx
// Fallback — platform-specific files (.native.tsx / .web.tsx) should load instead
import React from 'react';
import { View, Text } from 'react-native';

export const AdyenPayment = () => (
  <View>
    <Text>Payment not available on this platform</Text>
  </View>
);
```

### 11b. `AdyenPayment.native.tsx` — iOS & Android

Uses the `@adyen/react-native` SDK's Drop-in component.

```typescript
// components/payment/AdyenPayment.native.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { AdyenCheckout, useAdyenCheckout as useNativeAdyenCheckout } from '@adyen/react-native';
import { getAdyenCheckoutConfiguration } from '../../utils/adyen.utils';
import { useAdyenCheckout } from '../../hooks/useAdyenCheckout';
import type { SessionConfiguration } from '@adyen/react-native/lib/typescript/core/types';

type Props = {
  session: SessionConfiguration;
  onSuccess?: (paymentResult?: any) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
};

// Inner component: auto-starts the Drop-in when payment methods load
const PaymentContent = () => {
  const [hasOpened, setHasOpened] = useState(false);
  const nativeCheckout = useNativeAdyenCheckout();

  useEffect(() => {
    if (
      nativeCheckout.paymentMethods &&
      nativeCheckout.paymentMethods.paymentMethods.length > 0 &&
      !hasOpened
    ) {
      nativeCheckout.start('dropIn');
      setHasOpened(true);
    }
  }, [nativeCheckout, hasOpened]);

  return <View style={styles.container} />;
};

export const AdyenPayment: React.FC<Props> = ({ session, onSuccess, onError, onCancel }) => {
  const { handleComplete, handleError } = useAdyenCheckout({ session, onSuccess, onError });

  // Force re-creation when session changes
  const [key, setKey] = useState(session.id);
  useEffect(() => { setKey(session.id); }, [session.id]);

  return (
    <AdyenCheckout
      key={key}
      config={getAdyenCheckoutConfiguration()}
      session={session}
      onComplete={handleComplete}
      onError={handleError}
    >
      <PaymentContent />
    </AdyenCheckout>
  );
};

const styles = StyleSheet.create({
  container: { minHeight: 0, flex: 1, padding: 0 },
});

export default AdyenPayment;
```

### 11c. `AdyenPayment.web.tsx` — Expo Web

Uses the `@adyen/adyen-web` SDK. Mounts Card and Apple Pay components separately.

```typescript
// components/payment/AdyenPayment.web.tsx
import '@adyen/adyen-web/styles/adyen.css';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdyenCheckout,
  ApplePay,
  Card,
  CardConfiguration,
  CoreConfiguration,
} from '@adyen/adyen-web/auto';
import Constants from 'expo-constants';
import type { SessionConfiguration } from '@adyen/react-native/lib/typescript/core/types';

type AdyenComponentInstance = { mount: (el: HTMLElement) => void; unmount: () => void } | null;

type Props = {
  session: SessionConfiguration;
  onSuccess?: (result?: any) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
};

export const AdyenPayment = memo(({ session, onSuccess, onCancel, onError }: Props) => {
  const cardContainerRef = useRef<HTMLDivElement | null>(null);
  const applePayContainerRef = useRef<HTMLDivElement | null>(null);
  const cardInstance = useRef<AdyenComponentInstance>(null);
  const applePayInstance = useRef<AdyenComponentInstance>(null);
  const checkoutRef = useRef<any>(null);
  const isInitialized = useRef(false);
  const [visible, setVisible] = useState(true);

  // Read env vars
  const getEnv = (key: string): string => {
    const map: Record<string, string> = {
      EXPO_PUBLIC_ADYEN_CLIENT_KEY: 'adyenClientKey',
      EXPO_PUBLIC_ADYEN_ENVIRONMENT: 'adyenEnvironment',
    };
    return Constants.expoConfig?.extra?.[map[key] || key] || process.env[key] || '';
  };

  const adyenEnv = (getEnv('EXPO_PUBLIC_ADYEN_ENVIRONMENT') || 'test') as 'test' | 'live';

  const checkoutConfig: CoreConfiguration = useMemo(() => ({
    environment: adyenEnv,
    clientKey: getEnv('EXPO_PUBLIC_ADYEN_CLIENT_KEY'),
    locale: 'en-GB',
    onPaymentCompleted: (result, component) => {
      console.log('[AdyenPayment.web] Payment completed', result);
      setTimeout(() => {
        component?.unmount();
        onSuccess?.(result);
      }, 1500);
    },
    onPaymentFailed: (_result, _component) => {
      onError?.('Payment declined. Please try again or contact your bank.');
    },
    onError: (_error, _component) => {
      onError?.('A payment error occurred. Please try again.');
    },
  }), [adyenEnv, onSuccess, onError]);

  const cardConfig: CardConfiguration = useMemo(() => ({
    styles: {
      base: { color: '#000', fontSize: '16px' },
      error: { color: '#ff4444' },
      placeholder: { color: '#888' },
    },
  }), []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!cardContainerRef.current) return;
      if (isInitialized.current) return;

      try {
        const checkout = await AdyenCheckout({ session, ...checkoutConfig });
        if (!mounted) return;
        checkoutRef.current = checkout;

        // Mount card component
        if (cardContainerRef.current) {
          cardInstance.current = new Card(checkout, cardConfig);
          cardInstance.current.mount(cardContainerRef.current);
        }

        // Mount Apple Pay (if container exists and on Safari/iOS)
        if (applePayContainerRef.current) {
          try {
            applePayInstance.current = new ApplePay(checkout, {
              buttonType: 'check-out',
              buttonColor: 'black',
            });
            applePayInstance.current.mount(applePayContainerRef.current);
          } catch (e) {
            console.log('[AdyenPayment.web] Apple Pay not available:', e);
          }
        }

        isInitialized.current = true;
      } catch (error) {
        console.error('[AdyenPayment.web] Init error', error);
        onError?.('Failed to load payment form. Please refresh and try again.');
      }
    };

    // Small delay for DOM readiness (especially in React Native Web modals)
    const timer = setTimeout(init, 200);

    return () => {
      mounted = false;
      clearTimeout(timer);
      try {
        cardInstance.current?.unmount();
        applePayInstance.current?.unmount();
      } catch { /* ignore cleanup errors */ }
      cardInstance.current = null;
      applePayInstance.current = null;
      checkoutRef.current = null;
      isInitialized.current = false;
    };
  }, [session, checkoutConfig, cardConfig, onError]);

  if (!visible) return null;

  return (
    <div style={{ minHeight: 200, width: '100%' }}>
      {/* Apple Pay — renders only if available */}
      <div ref={applePayContainerRef} style={{ marginBottom: 16 }} />
      {/* Card payment form */}
      <div ref={cardContainerRef} style={{ minHeight: 200, width: '100%' }} />
    </div>
  );
});

AdyenPayment.displayName = 'AdyenPayment';
```

---

## 12. Mobile App — Checkout Screen Integration

Here is how to integrate the payment components in your checkout screen:

```typescript
// app/checkout.tsx (or wherever your checkout screen is)
import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { AdyenPayment } from '../components/payment/AdyenPayment';
import { createPaymentSession, getOrderByCartId } from '../services/api/payment-api';

export default function CheckoutScreen() {
  const [sessionData, setSessionData] = useState<{ id: string; sessionData: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);

  // Call this when user taps "Proceed to Payment"
  const handleCreateSession = async () => {
    setLoading(true);
    try {
      const session = await createPaymentSession({
        cartId: cartId,                // Get from your cart state
        returnUrl: 'yourapp://payment/return', // Your app's deep link
        shopperEmail: user?.email || '',
        billingAddress: { /* ... */ },
        deliveryAddress: { /* ... */ },
      });
      setSessionData(session);
    } catch (error) {
      Alert.alert('Error', 'Failed to start payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Called when Adyen reports payment success
  const handlePaymentSuccess = useCallback(async (result?: any) => {
    console.log('Payment succeeded, polling for order...');

    // Poll the backend for the order (webhook creates it asynchronously)
    const maxAttempts = 20;
    const intervalMs = 2000; // 2 seconds

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const order = await getOrderByCartId(cartId);
        if (order) {
          console.log('Order found!', order.order_number);
          setOrderConfirmed(true);
          // Navigate to order confirmation screen
          return;
        }
      } catch { /* ignore 404s */ }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    // Fallback if polling times out
    Alert.alert(
      'Payment Received',
      'Your payment was successful. Your order is being processed and will appear shortly.'
    );
  }, []);

  const handlePaymentError = useCallback((error: string) => {
    Alert.alert('Payment Failed', error);
    setSessionData(null); // Allow retry
  }, []);

  const handlePaymentCancel = useCallback(() => {
    setSessionData(null);
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  // Show Adyen payment UI when session is ready
  if (sessionData) {
    return (
      <View style={{ flex: 1 }}>
        <AdyenPayment
          session={{
            id: sessionData.id,
            sessionData: sessionData.sessionData,
          }}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onCancel={handlePaymentCancel}
        />
      </View>
    );
  }

  // Show checkout form / "Pay" button
  return (
    <View>
      <Text>Your checkout form here</Text>
      {/* Address forms, order summary, etc. */}
      <Button title="Proceed to Payment" onPress={handleCreateSession} />
    </View>
  );
}
```

---

## 13. Complete Payment Flow

### Sequence Summary

```
1. User fills checkout form (addresses, email)
2. User taps "Pay"
3. Frontend calls POST /api/payments/session
     → Backend calculates tax via Shopify (draftOrderCalculate)
     → Backend creates Shopify Draft Order (draftOrderCreate)
     → Backend stores draft order ID on cart record
     → Backend creates Adyen session (checkout.sessions)
     → Backend returns { id, sessionData }
4. Frontend renders AdyenPayment component with session
5. User enters card / taps Apple Pay
6. Adyen processes payment
7. On success:
     → Frontend shows "Processing..." and starts polling
     → Adyen sends AUTHORISATION webhook to POST /api/webhooks/adyen
     → Backend verifies HMAC
     → Backend extracts cart ID from webhook
     → Backend checks idempotency (existing order?)
     → Backend completes Shopify Draft Order (draftOrderComplete)
       → This creates a REAL Shopify order
     → Backend creates local Order record with:
       - Adyen payment details (pspReference, result code)
       - Shopify order details (order ID, number, name)
     → Backend clears the cart
8. Frontend poll finds the order → shows confirmation
```

### What Happens If Things Fail

| Failure Point | Result | Recovery |
|---|---|---|
| Tax calculation fails | Payment session not created | User retries |
| Draft order creation fails | Payment session not created | User retries |
| Adyen session creation fails | Payment session not created | User retries |
| Payment declined by Adyen | `onPaymentFailed` callback fires | User retries with different card |
| Webhook HMAC invalid | Returns 401, Adyen retries | Fix HMAC secret |
| Draft order completion fails | Order NOT created, return error | Manual fix needed |
| Local order creation fails | Shopify order exists, local doesn't | Manual reconciliation needed |

---

## 14. Testing

### Adyen Test Cards

Use in the `test` environment:

| Card Type | Number | Expiry | CVC |
|---|---|---|---|
| Visa (success) | `4111 1111 1111 1111` | Any future date | Any 3 digits |
| Visa (3DS2) | `4212 3456 7891 0006` | `03/30` | `737` |
| Mastercard | `5555 3412 4444 1115` | Any future date | Any 3 digits |
| Refused | `4000 0000 0000 0002` | Any future date | Any 3 digits |

Full list: https://docs.adyen.com/development-resources/testing/test-card-numbers

### Test Webhook Locally

1. Expose your local server with ngrok:
   ```bash
   ngrok http 3001
   ```

2. Set `WEBHOOK_BASE_URL` to your ngrok URL.

3. Create a payment and complete it with a test card.

4. Or send a test webhook from Adyen Customer Area → Developers → Webhooks → "Test webhook".

### Verify the Flow

1. Create payment session → check logs for draft order creation
2. Complete payment → check Adyen dashboard for AUTHORISATION
3. Check backend logs for webhook receipt
4. Check database for new Order record
5. Check Shopify admin for new order (converted from draft)

---

## 15. Troubleshooting

### Payment session creation fails
- Check `ADYEN_API_KEY` and `ADYEN_MERCHANT_ACCOUNT` are correct
- Check `ADYEN_ENVIRONMENT` matches your credentials (test vs live)
- Check Shopify credentials if draft order creation fails

### Adyen payment component doesn't render
- Check `EXPO_PUBLIC_ADYEN_CLIENT_KEY` is set correctly
- Verify the session `id` and `sessionData` are being passed to the component
- Check browser console for errors (web) or Metro logs (native)

### Webhook not received
- Check webhook URL is publicly accessible (not localhost in production)
- Check Adyen Customer Area → Developers → Webhooks → Logs
- Verify `ADYEN_WEBHOOK_HMAC` matches the HMAC key in Adyen Customer Area
- Ensure AUTHORISATION events are enabled in your webhook configuration

### Order not created after payment
- Check backend logs for webhook receipt
- Verify cart ID extraction from merchant reference works
- Check if draft order completion succeeded
- Look for idempotency hits (order already exists)

### Apple Pay not working
- Verify Apple Pay Merchant ID is registered in Apple Developer account
- Verify domain is registered for Apple Pay in Adyen Customer Area
- Check `EXPO_PUBLIC_ADYEN_APPLE_PAY_MERCHANT_ID` is set
- Apple Pay only works on Safari (web) or iOS devices (native)

---

## Adyen Customer Area Configuration

### Required Setup in Adyen Dashboard

1. **API Credentials** (Developers → API credentials):
   - Create or note your API Key (for backend)
   - Create or note your Client Key (for frontend/mobile)
   - Ensure allowed origins include your web domain

2. **Webhooks** (Developers → Webhooks):
   - Create a Standard Webhook
   - URL: `https://locoman-backend-870100645593.us-central1.run.app/api/webhooks/adyen`
   - Events: Enable `AUTHORISATION` (minimum required)
   - HMAC Key: Generate and save as `ADYEN_WEBHOOK_HMAC`
   - SSL Version: TLSv1.2 or higher

3. **Apple Pay** (if needed):
   - Register your domain for Apple Pay
   - Upload domain verification file
   - Configure Apple Pay Merchant ID

---

## File Structure Summary

```
backend/
├── src/
│   ├── services/
│   │   ├── adyenService.ts              # Adyen API client (singleton)
│   │   ├── paymentService.ts            # Payment session orchestration
│   │   ├── webhookService.ts            # Webhook processing (creates orders)
│   │   ├── shopifyAdminService.ts       # Shopify GraphQL client
│   │   ├── shopifyDraftOrderService.ts  # Draft order CRUD
│   │   └── orderService.ts             # Local order creation
│   ├── controllers/
│   │   ├── payment.controller.ts
│   │   └── webhook.controller.ts
│   ├── routes/
│   │   ├── payment.routes.ts
│   │   └── webhook.routes.ts
│   ├── middleware/
│   │   └── adyenWebhook.middleware.ts   # HMAC verification
│   └── db/
│       └── migrations/
│           ├── XXXX-add-payment-details-to-orders.js
│           ├── XXXX-add-draft-order-id-to-carts.js
│           └── XXXX-add-shopify-order-to-orders.js

mobile-app/
├── components/
│   └── payment/
│       ├── AdyenPayment.tsx             # Fallback
│       ├── AdyenPayment.native.tsx      # iOS/Android (React Native SDK)
│       └── AdyenPayment.web.tsx         # Expo Web (@adyen/adyen-web)
├── hooks/
│   ├── useAdyenCheckout.ts             # Web stub
│   └── useAdyenCheckout.native.ts      # Native payment handler
├── utils/
│   └── adyen.utils.ts                  # Adyen config builder
└── services/
    └── api/
        └── payment-api.ts              # Payment API client
```
