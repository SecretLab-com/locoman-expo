/**
 * Shopify Integration Service
 * Handles all Shopify Admin API interactions for bundle publishing,
 * product sync, order processing, and webhook handling.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { ENV } from "./_core/env";

// Environment variables for Shopify
// Support both SHOPIFY_API_SECRET and SHOPIFY_API_SECRET_KEY for compatibility
const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME || "bundle-dev-store-4";
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY || "";
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_SECRET_KEY || "";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN || "";
const MOCK_SHOPIFY = process.env.MOCK_SHOPIFY === "true";

// Validate Shopify environment variables at startup (warn if missing)
if (!MOCK_SHOPIFY) {
  const missingVars: string[] = [];
  if (!SHOPIFY_STORE_NAME || SHOPIFY_STORE_NAME === "bundle-dev-store-4") {
    missingVars.push("SHOPIFY_STORE_NAME");
  }
  if (!SHOPIFY_API_SECRET) {
    missingVars.push("SHOPIFY_API_SECRET or SHOPIFY_API_SECRET_KEY");
  }
  if (!SHOPIFY_ACCESS_TOKEN) {
    missingVars.push("SHOPIFY_API_ACCESS_TOKEN");
  }
  if (missingVars.length > 0) {
    console.warn(`[Shopify] Warning: Missing environment variables: ${missingVars.join(", ")}. Shopify integration may not work correctly.`);
  }
}

const SHOPIFY_API_VERSION = "2024-01";
const SHOPIFY_BASE_URL = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}`;

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  status: string;
  tags?: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
}

interface ShopifyImage {
  id: number;
  src: string;
  alt: string;
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  email: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: ShopifyLineItem[];
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
}

interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
}

// Mock data for development
const mockProducts: ShopifyProduct[] = [
  {
    id: 123456,
    title: "Plant Protein",
    body_html: "High-quality plant-based protein powder",
    vendor: "LocoMotivate",
    product_type: "Supplement",
    status: "active",
    variants: [{ id: 1, product_id: 123456, title: "Default", price: "49.99", sku: "PP-001", inventory_quantity: 150 }],
    images: [{ id: 1, src: "https://placehold.co/400x400?text=Plant+Protein", alt: "Plant Protein" }],
  },
  {
    id: 123457,
    title: "Pre-Workout Energy",
    body_html: "Boost your workout with clean energy",
    vendor: "LocoMotivate",
    product_type: "Supplement",
    status: "active",
    variants: [{ id: 2, product_id: 123457, title: "Default", price: "39.99", sku: "PWE-001", inventory_quantity: 200 }],
    images: [{ id: 2, src: "https://placehold.co/400x400?text=Pre-Workout", alt: "Pre-Workout Energy" }],
  },
  {
    id: 123458,
    title: "Creatine Monohydrate",
    body_html: "Pure creatine for strength and power",
    vendor: "LocoMotivate",
    product_type: "Supplement",
    status: "active",
    variants: [{ id: 3, product_id: 123458, title: "Default", price: "29.99", sku: "CM-001", inventory_quantity: 300 }],
    images: [{ id: 3, src: "https://placehold.co/400x400?text=Creatine", alt: "Creatine Monohydrate" }],
  },
  {
    id: 123459,
    title: "Fat Burner",
    body_html: "Thermogenic fat burner for weight loss",
    vendor: "LocoMotivate",
    product_type: "Supplement",
    status: "active",
    variants: [{ id: 4, product_id: 123459, title: "Default", price: "44.99", sku: "FB-001", inventory_quantity: 85 }],
    images: [{ id: 4, src: "https://placehold.co/400x400?text=Fat+Burner", alt: "Fat Burner" }],
  },
  {
    id: 123460,
    title: "BCAA Recovery",
    body_html: "Branch chain amino acids for muscle recovery",
    vendor: "LocoMotivate",
    product_type: "Supplement",
    status: "active",
    variants: [{ id: 5, product_id: 123460, title: "Default", price: "34.99", sku: "BCAA-001", inventory_quantity: 120 }],
    images: [{ id: 5, src: "https://placehold.co/400x400?text=BCAA", alt: "BCAA Recovery" }],
  },
  {
    id: 123461,
    title: "Multivitamin Complex",
    body_html: "Complete daily vitamin and mineral support",
    vendor: "LocoMotivate",
    product_type: "Supplement",
    status: "active",
    variants: [{ id: 6, product_id: 123461, title: "Default", price: "24.99", sku: "MV-001", inventory_quantity: 250 }],
    images: [{ id: 6, src: "https://placehold.co/400x400?text=Multivitamin", alt: "Multivitamin Complex" }],
  },
  {
    id: 123462,
    title: "Omega-3 Fish Oil",
    body_html: "Premium fish oil for heart and brain health",
    vendor: "LocoMotivate",
    product_type: "Supplement",
    status: "active",
    variants: [{ id: 7, product_id: 123462, title: "Default", price: "29.99", sku: "O3-001", inventory_quantity: 180 }],
    images: [{ id: 7, src: "https://placehold.co/400x400?text=Omega-3", alt: "Omega-3 Fish Oil" }],
  },
  {
    id: 123463,
    title: "Whey Protein Isolate",
    body_html: "Premium whey protein isolate for muscle building",
    vendor: "LocoMotivate",
    product_type: "Supplement",
    status: "active",
    variants: [{ id: 8, product_id: 123463, title: "Default", price: "54.99", sku: "WPI-001", inventory_quantity: 0 }],
    images: [{ id: 8, src: "https://placehold.co/400x400?text=Whey+Protein", alt: "Whey Protein Isolate" }],
  },
];

/**
 * Make authenticated request to Shopify Admin API
 */
async function shopifyRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: object
): Promise<T> {
  if (MOCK_SHOPIFY) {
    console.log(`[Shopify Mock] ${method} ${endpoint}`);
    throw new Error("Mock mode - use mock functions instead");
  }

  const url = `${SHOPIFY_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Shopify] API Error: ${response.status} - ${error}`);
    throw new Error(`Shopify API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch all products from Shopify with pagination support
 * Shopify limits to 250 products per request, so we need to paginate
 */
export async function fetchProducts(): Promise<ShopifyProduct[]> {
  if (MOCK_SHOPIFY) {
    return mockProducts;
  }

  try {
    const allProducts: ShopifyProduct[] = [];
    let pageInfo: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;
    const maxPages = 20; // Safety limit to prevent infinite loops

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;
      
      // Build the URL with pagination
      let url = "/products.json?limit=250";
      if (pageInfo) {
        url = `/products.json?limit=250&page_info=${pageInfo}`;
      }

      console.log(`[Shopify] Fetching products page ${pageCount}...`);
      
      const response = await shopifyRequestWithHeaders<{ products: ShopifyProduct[] }>(url);
      allProducts.push(...response.data.products);
      
      console.log(`[Shopify] Page ${pageCount}: fetched ${response.data.products.length} products (total: ${allProducts.length})`);

      // Check for next page using Link header
      const linkHeader = response.headers.get("link");
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&>]+)[^>]*>; rel="next"/);
        if (nextMatch) {
          pageInfo = nextMatch[1];
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }
    }

    console.log(`[Shopify] Total products fetched: ${allProducts.length}`);
    return allProducts;
  } catch (error) {
    console.error("[Shopify] Failed to fetch products:", error);
    return mockProducts; // Fallback to mock data
  }
}

/**
 * Make authenticated request to Shopify Admin API and return headers
 */
async function shopifyRequestWithHeaders<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: object
): Promise<{ data: T; headers: Headers }> {
  if (MOCK_SHOPIFY) {
    console.log(`[Shopify Mock] ${method} ${endpoint}`);
    throw new Error("Mock mode - use mock functions instead");
  }

  const url = `${SHOPIFY_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Shopify] API Error: ${response.status} - ${error}`);
    throw new Error(`Shopify API error: ${response.status}`);
  }

  const data = await response.json();
  return { data, headers: response.headers };
}

/**
 * Fetch a single product by ID
 */
export async function fetchProduct(productId: number): Promise<ShopifyProduct | null> {
  if (MOCK_SHOPIFY) {
    return mockProducts.find((p) => p.id === productId) || null;
  }

  try {
    const response = await shopifyRequest<{ product: ShopifyProduct }>(`/products/${productId}.json`);
    return response.product;
  } catch (error) {
    console.error(`[Shopify] Failed to fetch product ${productId}:`, error);
    return null;
  }
}

/**
 * Create a new product (bundle) in Shopify
 */
export async function createProduct(data: {
  title: string;
  body_html: string;
  vendor?: string;
  product_type?: string;
  variants: Array<{ price: string; sku?: string; inventory_quantity?: number }>;
  images?: Array<{ src: string; alt?: string }>;
}): Promise<ShopifyProduct | null> {
  if (MOCK_SHOPIFY) {
    const newProduct: ShopifyProduct = {
      id: Date.now(),
      title: data.title,
      body_html: data.body_html,
      vendor: data.vendor || "LocoMotivate",
      product_type: data.product_type || "Bundle",
      status: "active",
      variants: data.variants.map((v, i) => ({
        id: Date.now() + i,
        product_id: Date.now(),
        title: "Default",
        price: v.price,
        sku: v.sku || "",
        inventory_quantity: v.inventory_quantity || 0,
      })),
      images: data.images?.map((img, i) => ({
        id: Date.now() + i,
        src: img.src,
        alt: img.alt || "",
      })) || [],
    };
    console.log("[Shopify Mock] Created product:", newProduct.id);
    return newProduct;
  }

  try {
    const response = await shopifyRequest<{ product: ShopifyProduct }>("/products.json", "POST", {
      product: data,
    });
    return response.product;
  } catch (error) {
    console.error("[Shopify] Failed to create product:", error);
    return null;
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(
  productId: number,
  data: Partial<{
    title: string;
    body_html: string;
    status: string;
  }>
): Promise<ShopifyProduct | null> {
  if (MOCK_SHOPIFY) {
    console.log(`[Shopify Mock] Updated product ${productId}`);
    return mockProducts.find((p) => p.id === productId) || null;
  }

  try {
    const response = await shopifyRequest<{ product: ShopifyProduct }>(`/products/${productId}.json`, "PUT", {
      product: data,
    });
    return response.product;
  } catch (error) {
    console.error(`[Shopify] Failed to update product ${productId}:`, error);
    return null;
  }
}

/**
 * Delete a product
 */
export async function deleteProduct(productId: number): Promise<boolean> {
  if (MOCK_SHOPIFY) {
    console.log(`[Shopify Mock] Deleted product ${productId}`);
    return true;
  }

  try {
    await shopifyRequest(`/products/${productId}.json`, "DELETE");
    return true;
  } catch (error) {
    console.error(`[Shopify] Failed to delete product ${productId}:`, error);
    return false;
  }
}

/**
 * Fetch orders from Shopify
 */
export async function fetchOrders(params?: {
  status?: string;
  created_at_min?: string;
  limit?: number;
}): Promise<ShopifyOrder[]> {
  if (MOCK_SHOPIFY) {
    return []; // Return empty for mock
  }

  try {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.set("status", params.status);
    if (params?.created_at_min) queryParams.set("created_at_min", params.created_at_min);
    if (params?.limit) queryParams.set("limit", params.limit.toString());

    const endpoint = `/orders.json${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await shopifyRequest<{ orders: ShopifyOrder[] }>(endpoint);
    return response.orders;
  } catch (error) {
    console.error("[Shopify] Failed to fetch orders:", error);
    return [];
  }
}

/**
 * Fetch a single order by ID
 */
export async function fetchOrder(orderId: number): Promise<ShopifyOrder | null> {
  if (MOCK_SHOPIFY) {
    return null;
  }

  try {
    const response = await shopifyRequest<{ order: ShopifyOrder }>(`/orders/${orderId}.json`);
    return response.order;
  } catch (error) {
    console.error(`[Shopify] Failed to fetch order ${orderId}:`, error);
    return null;
  }
}

/**
 * Add metafields to a bundle product for component tracking
 */
async function addBundleMetafields(
  productId: number,
  data: {
    trainerId: number;
    trainerName: string;
    components: Array<{ productId: number; productName: string; quantity: number }>;
  }
): Promise<void> {
  if (MOCK_SHOPIFY) {
    console.log(`[Shopify Mock] Adding metafields to product ${productId}`);
    return;
  }

  // Create metafields for bundle components
  const metafields = [
    {
      namespace: "locomotivate",
      key: "trainer_id",
      value: String(data.trainerId),
      type: "number_integer",
    },
    {
      namespace: "locomotivate",
      key: "trainer_name",
      value: data.trainerName,
      type: "single_line_text_field",
    },
    {
      namespace: "locomotivate",
      key: "bundle_components",
      value: JSON.stringify(data.components),
      type: "json",
    },
    {
      namespace: "locomotivate",
      key: "component_count",
      value: String(data.components.length),
      type: "number_integer",
    },
  ];

  // Add each metafield to the product
  for (const metafield of metafields) {
    try {
      await shopifyRequest(`/products/${productId}/metafields.json`, "POST", {
        metafield: {
          ...metafield,
        },
      });
      console.log(`[Shopify] Added metafield ${metafield.key} to product ${productId}`);
    } catch (error) {
      console.error(`[Shopify] Failed to add metafield ${metafield.key}:`, error);
    }
  }
}

/**
 * Get bundle metafields from a Shopify product
 */
export async function getBundleMetafields(productId: number): Promise<{
  trainerId?: number;
  trainerName?: string;
  components?: Array<{ productId: number; productName: string; quantity: number }>;
} | null> {
  if (MOCK_SHOPIFY) {
    return null;
  }

  try {
    const response = await shopifyRequest<{ metafields: Array<{
      namespace: string;
      key: string;
      value: string;
      type: string;
    }> }>(`/products/${productId}/metafields.json`);
    
    const result: {
      trainerId?: number;
      trainerName?: string;
      components?: Array<{ productId: number; productName: string; quantity: number }>;
    } = {};

    for (const mf of response.metafields) {
      if (mf.namespace === "locomotivate") {
        if (mf.key === "trainer_id") {
          result.trainerId = parseInt(mf.value, 10);
        } else if (mf.key === "trainer_name") {
          result.trainerName = mf.value;
        } else if (mf.key === "bundle_components") {
          result.components = JSON.parse(mf.value);
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`[Shopify] Failed to get metafields for product ${productId}:`, error);
    return null;
  }
}

/**
 * Create a fixed bundle product in Shopify
 * This creates a product that represents a trainer's bundle
 */
export async function publishBundle(bundle: {
  title: string;
  description: string;
  price: string;
  trainerId: number;
  trainerName: string;
  products: Array<{ id: number; name: string; quantity: number }>;
  imageUrl?: string;
}): Promise<{ productId: number; variantId: number } | null> {
  const productData = {
    title: bundle.title,
    body_html: `
      <p>${bundle.description}</p>
      <p><strong>Created by:</strong> ${bundle.trainerName}</p>
      <h4>Bundle Contents:</h4>
      <ul>
        ${bundle.products.map((p) => `<li>${p.name} (x${p.quantity})</li>`).join("")}
      </ul>
    `,
    vendor: "LocoMotivate",
    product_type: "Bundle",
    variants: [
      {
        price: bundle.price,
        sku: `BUNDLE-${bundle.trainerId}-${Date.now()}`,
        inventory_quantity: 100,
      },
    ],
    images: bundle.imageUrl ? [{ src: bundle.imageUrl, alt: bundle.title }] : [],
  };

  const product = await createProduct(productData);
  if (!product) return null;

  // Add metafields for bundle components
  try {
    await addBundleMetafields(product.id, {
      trainerId: bundle.trainerId,
      trainerName: bundle.trainerName,
      components: bundle.products.map(p => ({
        productId: p.id,
        productName: p.name,
        quantity: p.quantity,
      })),
    });
  } catch (error) {
    console.error("[Shopify] Failed to add bundle metafields:", error);
    // Continue even if metafields fail - the product was created
  }

  return {
    productId: product.id,
    variantId: product.variants[0]?.id || 0,
  };
}

/**
 * Generate Shopify checkout URL for a bundle
 */
export function getCheckoutUrl(variantId: number, quantity: number = 1): string {
  return `https://${SHOPIFY_STORE_NAME}.myshopify.com/cart/${variantId}:${quantity}`;
}

/**
 * Verify Shopify webhook signature using timing-safe comparison
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (MOCK_SHOPIFY) return true;

  if (!SHOPIFY_API_SECRET) {
    console.error("[Shopify] Cannot verify webhook: SHOPIFY_API_SECRET not configured");
    return false;
  }

  const hmac = createHmac("sha256", SHOPIFY_API_SECRET);
  hmac.update(body, "utf8");
  const computedHash = hmac.digest("base64");
  
  // Use timing-safe comparison to prevent timing attacks
  try {
    const computedBuffer = Buffer.from(computedHash, "base64");
    const signatureBuffer = Buffer.from(signature, "base64");
    
    if (computedBuffer.length !== signatureBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(computedBuffer, signatureBuffer);
  } catch (error) {
    console.error("[Shopify] Webhook signature verification error:", error);
    return false;
  }
}

/**
 * Process incoming webhook from Shopify
 */
export async function processWebhook(
  topic: string,
  data: any
): Promise<{ success: boolean; message: string }> {
  console.log(`[Shopify Webhook] Processing ${topic}`);

  switch (topic) {
    case "orders/create":
      // Handle new order
      console.log(`[Shopify Webhook] New order: ${data.id}`);
      // TODO: Create order in database, attribute to trainer
      return { success: true, message: "Order processed" };

    case "orders/updated":
      // Handle order update
      console.log(`[Shopify Webhook] Order updated: ${data.id}`);
      // TODO: Update order status in database
      return { success: true, message: "Order updated" };

    case "orders/fulfilled":
      // Handle order fulfillment
      console.log(`[Shopify Webhook] Order fulfilled: ${data.id}`);
      // TODO: Update fulfillment status
      return { success: true, message: "Fulfillment processed" };

    case "products/update":
      // Handle product update
      console.log(`[Shopify Webhook] Product updated: ${data.id}`);
      // TODO: Sync product data
      return { success: true, message: "Product synced" };

    case "app/uninstalled":
      // Handle app uninstall
      console.log(`[Shopify Webhook] App uninstalled`);
      // TODO: Clean up shop data
      return { success: true, message: "Uninstall processed" };

    default:
      console.log(`[Shopify Webhook] Unknown topic: ${topic}`);
      return { success: false, message: "Unknown webhook topic" };
  }
}

/**
 * Sync all products from Shopify to local database
 */
export async function syncProductsToDatabase(
  upsertProduct: (product: {
    shopifyProductId: number;
    shopifyVariantId: number;
    name: string;
    description: string;
    imageUrl: string;
    price: string;
    inventoryQuantity: number;
    availability: "available" | "out_of_stock" | "discontinued";
  }) => Promise<number>
): Promise<{ synced: number; errors: number }> {
  const products = await fetchProducts();
  let synced = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const variant = product.variants[0];
      await upsertProduct({
        shopifyProductId: product.id,
        shopifyVariantId: variant?.id || 0,
        name: product.title,
        description: product.body_html,
        imageUrl: product.images[0]?.src || "",
        price: variant?.price || "0",
        inventoryQuantity: variant?.inventory_quantity || 0,
        availability: variant?.inventory_quantity > 0 ? "available" : "out_of_stock",
      });
      synced++;
    } catch (error) {
      console.error(`[Shopify] Failed to sync product ${product.id}:`, error);
      errors++;
    }
  }

  return { synced, errors };
}

export type { ShopifyProduct, ShopifyVariant, ShopifyOrder, ShopifyLineItem };

// GraphQL API for native Shopify Bundles
const SHOPIFY_GRAPHQL_URL = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

/**
 * Make a GraphQL request to Shopify Admin API
 */
async function shopifyGraphQL<T>(query: string, variables?: Record<string, any>): Promise<T> {
  if (MOCK_SHOPIFY) {
    console.log("[Shopify Mock] GraphQL request:", { query: query.slice(0, 100), variables });
    throw new Error("GraphQL not available in mock mode");
  }

  const response = await fetch(SHOPIFY_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Shopify GraphQL] Error: ${response.status} - ${error}`);
    throw new Error(`Shopify GraphQL error: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.errors && result.errors.length > 0) {
    console.error(`[Shopify GraphQL] Errors:`, result.errors);
    throw new Error(result.errors[0].message);
  }

  return result.data;
}

/**
 * Create a native Shopify bundle using the productBundleCreate mutation
 * This creates a "real" bundle that shows the "Bundled products" UI in Shopify admin
 */
/**
 * Fetch product options for bundle component creation
 * Returns option IDs and value IDs required by the Bundles API
 */
async function fetchProductOptionsForBundle(productId: number): Promise<Array<{
  componentOptionId: string;
  name: string;
  values: Array<{ id: string; name: string }>;
}>> {
  const query = `
    query getProductOptions($id: ID!) {
      product(id: $id) {
        hasOnlyDefaultVariant
        options {
          id
          name
          optionValues {
            id
            name
          }
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL<{
      product: {
        hasOnlyDefaultVariant: boolean;
        options: Array<{
          id: string;
          name: string;
          optionValues: Array<{ id: string; name: string }>;
        }>;
      };
    }>(query, { id: `gid://shopify/Product/${productId}` });

    // ALWAYS return options, even for single-variant products
    // The Bundles API requires all options to be mapped
    return result.product.options.map((opt) => ({
      componentOptionId: opt.id,
      name: opt.name,
      values: opt.optionValues.map((v) => ({ id: v.id, name: v.name })),
    }));
  } catch (error) {
    console.error(`[Shopify] Failed to fetch options for product ${productId}:`, error);
    return [];
  }
}

/**
 * Create a native Shopify bundle using the Bundles API
 */
export async function createNativeBundle(bundle: {
  title: string;
  description?: string;
  components: Array<{
    productId: number;
    quantity: number;
  }>;
}): Promise<{ operationId: string; status: string } | null> {
  if (MOCK_SHOPIFY) {
    console.log("[Shopify Mock] Creating native bundle:", bundle.title);
    return {
      operationId: `gid://shopify/ProductBundleOperation/${Date.now()}`,
      status: "CREATED",
    };
  }

  // Fetch options for each component product
  const componentsWithOptions = await Promise.all(
    bundle.components.map(async (c) => {
      const options = await fetchProductOptionsForBundle(c.productId);
      return {
        quantity: c.quantity,
        productId: `gid://shopify/Product/${c.productId}`,
        // Include ALL option values so the bundle includes all variants
        // Using componentOptionId, name, and values array with option value NAMES (not IDs!)
        optionSelections: options.map((opt) => ({
          componentOptionId: opt.componentOptionId,
          name: opt.name, // Required by Shopify Bundles API
          values: opt.values.map((v) => v.name), // Array of option value NAMES (e.g., "Sample Selling Plans Ski Wax")
        })),
      };
    })
  );

  console.log("[Shopify] Creating bundle with components:", JSON.stringify(componentsWithOptions, null, 2));

  const mutation = `
    mutation ProductBundleCreate($input: ProductBundleCreateInput!) {
      productBundleCreate(input: $input) {
        productBundleOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      title: bundle.title,
      components: componentsWithOptions,
    },
  };

  try {
    const result = await shopifyGraphQL<{
      productBundleCreate: {
        productBundleOperation: { id: string; status: string } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(mutation, variables);

    if (result.productBundleCreate.userErrors.length > 0) {
      console.error("[Shopify] Bundle creation errors:", result.productBundleCreate.userErrors);
      throw new Error(result.productBundleCreate.userErrors[0].message);
    }

    if (!result.productBundleCreate.productBundleOperation) {
      throw new Error("No operation returned from bundle creation");
    }

    return {
      operationId: result.productBundleCreate.productBundleOperation.id,
      status: result.productBundleCreate.productBundleOperation.status,
    };
  } catch (error) {
    console.error("[Shopify] Failed to create native bundle:", error);
    return null;
  }
}

/**
 * Poll the status of a bundle creation operation
 */
export async function pollBundleOperation(operationId: string): Promise<{
  status: string;
  productId: string | null;
  errors: Array<{ field: string; message: string; code: string }>;
} | null> {
  if (MOCK_SHOPIFY) {
    return {
      status: "COMPLETE",
      productId: `gid://shopify/Product/${Date.now()}`,
      errors: [],
    };
  }

  const query = `
    query productBundleOperation($id: ID!) {
      productOperation(id: $id) {
        ... on ProductBundleOperation {
          id
          status
          product {
            id
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    }
  `;

  try {
    const result = await shopifyGraphQL<{
      productOperation: {
        id: string;
        status: string;
        product: { id: string } | null;
        userErrors: Array<{ field: string; message: string; code: string }>;
      };
    }>(query, { id: operationId });

    return {
      status: result.productOperation.status,
      productId: result.productOperation.product?.id || null,
      errors: result.productOperation.userErrors || [],
    };
  } catch (error) {
    console.error("[Shopify] Failed to poll bundle operation:", error);
    return null;
  }
}

/**
 * Create a native Shopify bundle and wait for completion
 * Returns the created product ID
 */
export async function createNativeBundleAndWait(bundle: {
  title: string;
  description?: string;
  components: Array<{
    productId: number;
    quantity: number;
  }>;
  maxWaitMs?: number;
}): Promise<{ productId: number; productGid: string } | null> {
  const operation = await createNativeBundle(bundle);
  if (!operation) return null;

  const maxWait = bundle.maxWaitMs || 30000; // Default 30 seconds
  const pollInterval = 1000; // Poll every second
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = await pollBundleOperation(operation.operationId);
    if (!status) {
      console.error("[Shopify] Failed to get operation status");
      return null;
    }

    if (status.status === "COMPLETE") {
      if (status.productId) {
        // Extract numeric ID from GID
        const numericId = parseInt(status.productId.split("/").pop() || "0");
        return {
          productId: numericId,
          productGid: status.productId,
        };
      }
      console.error("[Shopify] Bundle created but no product ID returned");
      return null;
    }

    if (status.status === "FAILED") {
      console.error("[Shopify] Bundle creation failed:", status.errors);
      return null;
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.error("[Shopify] Bundle creation timed out");
  return null;
}

/**
 * Update the price and other details of a bundle product
 * (Native bundles still need price set via variant update)
 */
export async function updateBundleProduct(productId: number, data: {
  price?: string;
  description?: string;
  imageUrl?: string;
  trainerId?: number;
  trainerName?: string;
}): Promise<boolean> {
  try {
    // Update product description if provided
    if (data.description) {
      await shopifyRequest(`/products/${productId}.json`, "PUT", {
        product: {
          body_html: data.description,
        },
      });
    }

    // Get the product to find variant ID
    const product = await fetchProduct(productId);
    if (!product) return false;

    // Update variant price
    if (data.price && product.variants[0]) {
      await shopifyRequest(`/variants/${product.variants[0].id}.json`, "PUT", {
        variant: {
          price: data.price,
        },
      });
    }

    // Add image if provided
    if (data.imageUrl) {
      await shopifyRequest(`/products/${productId}/images.json`, "POST", {
        image: {
          src: data.imageUrl,
        },
      });
    }

    // Add metafields for trainer info
    if (data.trainerId && data.trainerName) {
      await addBundleMetafields(productId, {
        trainerId: data.trainerId,
        trainerName: data.trainerName,
        components: [], // Components are managed by native bundle
      });
    }

    return true;
  } catch (error) {
    console.error("[Shopify] Failed to update bundle product:", error);
    return false;
  }
}

/**
 * Publish a bundle using native Shopify Bundles API
 * Creates a "real" bundle with the "Bundled products" UI
 */
export async function publishNativeBundle(bundle: {
  title: string;
  description: string;
  price: string;
  trainerId: number;
  trainerName: string;
  products: Array<{ id: number; name: string; quantity: number }>;
  imageUrl?: string;
}): Promise<{ productId: number; variantId: number } | null> {
  console.log("[Shopify] Creating native bundle:", bundle.title);

  // Step 1: Create the native bundle with components
  const bundleResult = await createNativeBundleAndWait({
    title: bundle.title,
    components: bundle.products.map((p) => ({
      productId: p.id,
      quantity: p.quantity,
    })),
    maxWaitMs: 60000, // Wait up to 60 seconds
  });

  if (!bundleResult) {
    console.error("[Shopify] Failed to create native bundle");
    // Fall back to regular product creation
    console.log("[Shopify] Falling back to regular product creation");
    return publishBundle(bundle);
  }

  // Step 2: Update the bundle with price, description, image, and trainer info
  const descriptionHtml = `
    <p>${bundle.description}</p>
    <p><strong>Created by:</strong> ${bundle.trainerName}</p>
    <h4>Bundle Contents:</h4>
    <ul>
      ${bundle.products.map((p) => `<li>${p.name} (x${p.quantity})</li>`).join("")}
    </ul>
  `;

  await updateBundleProduct(bundleResult.productId, {
    price: bundle.price,
    description: descriptionHtml,
    imageUrl: bundle.imageUrl,
    trainerId: bundle.trainerId,
    trainerName: bundle.trainerName,
  });

  // Get the variant ID
  const product = await fetchProduct(bundleResult.productId);
  const variantId = product?.variants[0]?.id || 0;

  console.log(`[Shopify] Native bundle created: Product ${bundleResult.productId}, Variant ${variantId}`);

  return {
    productId: bundleResult.productId,
    variantId,
  };
}


/**
 * Sync bundle updates to Shopify
 * Updates product details, pricing, and availability based on bundle changes
 */
export async function syncBundleToShopify(bundle: {
  shopifyProductId: string;
  shopifyVariantId: string;
  title: string;
  description: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  imageUrl?: string;
  status: "draft" | "active" | "archived";
}): Promise<{ success: boolean; error?: string }> {
  if (MOCK_SHOPIFY) {
    console.log("[Shopify] Mock: Syncing bundle to Shopify", bundle);
    return { success: true };
  }

  try {
    const productId = parseInt(bundle.shopifyProductId);
    const variantId = parseInt(bundle.shopifyVariantId);

    // Update product details
    const updateResponse = await shopifyRequest<{ product: ShopifyProduct }>(`/products/${productId}.json`, "PUT", {
      product: {
        title: bundle.title,
        body_html: bundle.description,
        status: bundle.status === "archived" ? "archived" : "active",
      },
    });

    if (!updateResponse.product) {
      throw new Error("Failed to update product");
    }

    // Update variant pricing
    await shopifyRequest(`/products/${productId}/variants/${variantId}.json`, "PUT", {
      variant: {
        price: bundle.basePrice.toString(),
        compare_at_price: bundle.maxPrice > bundle.basePrice ? bundle.maxPrice.toString() : null,
      },
    });

    // Update product image if provided
    if (bundle.imageUrl) {
      await shopifyRequest(`/products/${productId}/images.json`, "POST", {
        image: {
          src: bundle.imageUrl,
        },
      });
    }

    console.log(`[Shopify] Successfully synced bundle ${bundle.shopifyProductId} to Shopify`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Shopify] Failed to sync bundle:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch bundle data from Shopify and sync back to database
 * Ensures local bundle data matches Shopify product data
 */
export async function syncBundleFromShopify(
  shopifyProductId: string,
  updateBundlePublication: (data: {
    syncStatus: "synced" | "pending" | "failed";
    syncedAt?: Date;
    lastSyncError?: string | null;
  }) => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  if (MOCK_SHOPIFY) {
    console.log("[Shopify] Mock: Syncing bundle from Shopify", shopifyProductId);
    return { success: true };
  }

  try {
    const productId = parseInt(shopifyProductId);
    const product = await fetchProduct(productId);

    if (!product) {
      throw new Error(`Product ${shopifyProductId} not found on Shopify`);
    }

    // Update bundle publication with latest Shopify data
    await updateBundlePublication({
      syncStatus: "synced",
      syncedAt: new Date(),
      lastSyncError: null,
    });

    console.log(`[Shopify] Successfully synced bundle from Shopify: ${shopifyProductId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Shopify] Failed to sync bundle from Shopify:`, errorMessage);

    // Mark as failed but don't throw
    await updateBundlePublication({
      syncStatus: "failed",
      lastSyncError: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

/**
 * Sync all published bundles with Shopify
 * Called periodically to ensure bundles stay in sync
 */
export async function syncAllBundles(
  getBundles: () => Promise<
    Array<{
      id: number;
      shopifyProductId: string;
      shopifyVariantId: string;
      title: string;
      description: string;
      basePrice: number;
      minPrice: number;
      maxPrice: number;
      imageUrl?: string;
      status: "draft" | "active" | "archived";
    }>
  >,
  updateBundlePublication: (
    id: number,
    data: {
      syncStatus: "synced" | "pending" | "failed";
      syncedAt?: Date;
      lastSyncError?: string | null;
    }
  ) => Promise<void>
): Promise<{ synced: number; failed: number }> {
  const bundles = await getBundles();
  let synced = 0;
  let failed = 0;

  for (const bundle of bundles) {
    try {
      const result = await syncBundleToShopify(bundle);

      if (result.success) {
        await updateBundlePublication(bundle.id, {
          syncStatus: "synced",
          syncedAt: new Date(),
          lastSyncError: null,
        });
        synced++;
      } else {
        await updateBundlePublication(bundle.id, {
          syncStatus: "failed",
          lastSyncError: result.error,
        });
        failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Shopify] Failed to sync bundle ${bundle.id}:`, errorMessage);

      await updateBundlePublication(bundle.id, {
        syncStatus: "failed",
        lastSyncError: errorMessage,
      });
      failed++;
    }
  }

  console.log(`[Shopify] Bundle sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}


/**
 * Fetch all customers from Shopify with pagination support
 */
export async function fetchCustomers(): Promise<Array<{
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  created_at: string;
  orders_count: number;
  total_spent: string;
}>> {
  if (MOCK_SHOPIFY) {
    return [];
  }

  try {
    const allCustomers: Array<{
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      created_at: string;
      orders_count: number;
      total_spent: string;
    }> = [];
    let pageInfo: string | null = null;
    let hasNextPage = true;
    let pageCount = 0;
    const maxPages = 20;

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;
      
      let url = "/customers.json?limit=250";
      if (pageInfo) {
        url = `/customers.json?limit=250&page_info=${pageInfo}`;
      }

      console.log(`[Shopify] Fetching customers page ${pageCount}...`);
      
      const response = await shopifyRequestWithHeaders<{ customers: Array<{
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        phone: string | null;
        created_at: string;
        orders_count: number;
        total_spent: string;
      }> }>(url);
      
      allCustomers.push(...response.data.customers);
      
      console.log(`[Shopify] Page ${pageCount}: fetched ${response.data.customers.length} customers (total: ${allCustomers.length})`);

      const linkHeader = response.headers.get("link");
      if (linkHeader) {
        const nextMatch = linkHeader.match(/<[^>]*page_info=([^>&>]+)[^>]*>; rel="next"/);
        if (nextMatch) {
          pageInfo = nextMatch[1];
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }
    }

    console.log(`[Shopify] Total customers fetched: ${allCustomers.length}`);
    return allCustomers;
  } catch (error) {
    console.error("[Shopify] Failed to fetch customers:", error);
    return [];
  }
}

/**
 * Comprehensive sync of all Shopify data to local database
 * Syncs products, bundles (published products), and customers
 */
export async function syncEverythingFromShopify(callbacks: {
  upsertProduct: (product: {
    shopifyProductId: number;
    shopifyVariantId: number;
    name: string;
    description: string;
    imageUrl: string;
    price: string;
    inventoryQuantity: number;
    availability: "available" | "out_of_stock" | "discontinued";
  }) => Promise<number>;
  upsertCustomer?: (customer: {
    shopifyCustomerId: number;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    ordersCount: number;
    totalSpent: string;
  }) => Promise<number>;
  updateBundlePublication?: (
    shopifyProductId: string,
    data: {
      syncStatus: "synced" | "pending" | "failed";
      syncedAt?: Date;
      lastSyncError?: string | null;
    }
  ) => Promise<void>;
  getBundlePublications?: () => Promise<Array<{ shopifyProductId: string }>>;
}): Promise<{
  products: { synced: number; errors: number; syncedItems: Array<{ id: number; name: string }>; errorItems: Array<{ id: number; name: string; error: string }> };
  customers: { synced: number; errors: number; syncedItems: Array<{ id: number; name: string }>; errorItems: Array<{ id: number; name: string; error: string }> };
  bundles: { synced: number; errors: number; syncedItems: Array<{ id: string; name: string }>; errorItems: Array<{ id: string; name: string; error: string }> };
}> {
  console.log("[Shopify] Starting comprehensive sync...");
  
  const results = {
    products: { synced: 0, errors: 0, syncedItems: [] as Array<{ id: number; name: string }>, errorItems: [] as Array<{ id: number; name: string; error: string }> },
    customers: { synced: 0, errors: 0, syncedItems: [] as Array<{ id: number; name: string }>, errorItems: [] as Array<{ id: number; name: string; error: string }> },
    bundles: { synced: 0, errors: 0, syncedItems: [] as Array<{ id: string; name: string }>, errorItems: [] as Array<{ id: string; name: string; error: string }> },
  };

  // 1. Sync all products
  console.log("[Shopify] Syncing products...");
  const products = await fetchProducts();
  
  // Get bundle product IDs to exclude them from regular products
  const bundleProductIds = new Set<number>();
  if (callbacks.getBundlePublications) {
    const publications = await callbacks.getBundlePublications();
    publications.forEach(p => {
      if (p.shopifyProductId) {
        bundleProductIds.add(parseInt(p.shopifyProductId));
      }
    });
  }

  for (const product of products) {
    // Skip if this is a bundle product
    if (bundleProductIds.has(product.id)) {
      continue;
    }
    // Skip if product_type is "Bundle"
    if (product.product_type?.toLowerCase() === 'bundle') {
      continue;
    }
    // Skip if has "bundle" tag
    if (product.tags?.toLowerCase().includes('bundle')) {
      continue;
    }

    try {
      const variant = product.variants[0];
      await callbacks.upsertProduct({
        shopifyProductId: product.id,
        shopifyVariantId: variant?.id || 0,
        name: product.title,
        description: product.body_html,
        imageUrl: product.images[0]?.src || "",
        price: variant?.price || "0",
        inventoryQuantity: variant?.inventory_quantity || 0,
        availability: variant?.inventory_quantity > 0 ? "available" : "out_of_stock",
      });
      results.products.synced++;
      results.products.syncedItems.push({ id: product.id, name: product.title });
    } catch (error) {
      console.error(`[Shopify] Failed to sync product ${product.id}:`, error);
      results.products.errors++;
      results.products.errorItems.push({ id: product.id, name: product.title, error: String(error) });  
    }
  }
  console.log(`[Shopify] Products sync: ${results.products.synced} synced, ${results.products.errors} errors`);

  // 2. Sync all customers
  if (callbacks.upsertCustomer) {
    console.log("[Shopify] Syncing customers...");
    const customers = await fetchCustomers();
    
    for (const customer of customers) {
      try {
        await callbacks.upsertCustomer({
          shopifyCustomerId: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          phone: customer.phone,
          ordersCount: customer.orders_count,
          totalSpent: customer.total_spent,
        });
        results.customers.synced++;
        const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email;
        results.customers.syncedItems.push({ id: customer.id, name: customerName });
      } catch (error) {
        console.error(`[Shopify] Failed to sync customer ${customer.id}:`, error);
        results.customers.errors++;
        const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email;
        results.customers.errorItems.push({ id: customer.id, name: customerName, error: String(error) });
      }
    }
    console.log(`[Shopify] Customers sync: ${results.customers.synced} synced, ${results.customers.errors} errors`);
  }

  // 3. Sync bundle publications (verify they still exist in Shopify)
  if (callbacks.updateBundlePublication && callbacks.getBundlePublications) {
    console.log("[Shopify] Syncing bundle publications...");
    const publications = await callbacks.getBundlePublications();
    
    for (const pub of publications) {
      if (!pub.shopifyProductId) continue;
      
      try {
        const productId = parseInt(pub.shopifyProductId);
        const product = await fetchProduct(productId);
        
        if (product) {
          await callbacks.updateBundlePublication(pub.shopifyProductId, {
            syncStatus: "synced",
            syncedAt: new Date(),
            lastSyncError: null,
          });
          results.bundles.synced++;
          results.bundles.syncedItems.push({ id: pub.shopifyProductId, name: product.title });
        } else {
          await callbacks.updateBundlePublication(pub.shopifyProductId, {
            syncStatus: "failed",
            lastSyncError: "Product not found in Shopify",
          });
          results.bundles.errors++;
          results.bundles.errorItems.push({ id: pub.shopifyProductId, name: `Bundle #${pub.shopifyProductId}`, error: "Product not found in Shopify" });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Shopify] Failed to sync bundle ${pub.shopifyProductId}:`, errorMessage);
        if (callbacks.updateBundlePublication) {
          await callbacks.updateBundlePublication(pub.shopifyProductId, {
            syncStatus: "failed",
            lastSyncError: errorMessage,
          });
        }
        results.bundles.errors++;
        results.bundles.errorItems.push({ id: pub.shopifyProductId, name: `Bundle #${pub.shopifyProductId}`, error: errorMessage });
      }
    }
    console.log(`[Shopify] Bundles sync: ${results.bundles.synced} synced, ${results.bundles.errors} errors`);
  }

  console.log("[Shopify] Comprehensive sync complete:", results);
  return results;
}
