/**
 * Shopify Integration Service
 * Handles all Shopify Admin API interactions for product sync,
 * bundle publishing, and order processing.
 */

// Environment variables for Shopify
const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME || "bundle-dev-store-4";
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_API_ACCESS_TOKEN || "";
const MOCK_SHOPIFY = process.env.MOCK_SHOPIFY !== "false"; // Default to mock mode

const SHOPIFY_API_VERSION = "2024-01";
const SHOPIFY_BASE_URL = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}`;

// ============================================================================
// TYPES
// ============================================================================

export interface ShopifyProduct {
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

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  inventory_quantity: number;
}

export interface ShopifyImage {
  id: number;
  src: string;
  alt: string;
}

export interface ShopifyOrder {
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

export interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

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

// ============================================================================
// API HELPERS
// ============================================================================

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

// ============================================================================
// PRODUCT FUNCTIONS
// ============================================================================

/**
 * Fetch all products from Shopify
 */
export async function fetchProducts(): Promise<ShopifyProduct[]> {
  if (MOCK_SHOPIFY) {
    return mockProducts;
  }

  try {
    const response = await shopifyRequest<{ products: ShopifyProduct[] }>("/products.json?limit=250");
    return response.products;
  } catch (error) {
    console.error("[Shopify] Failed to fetch products:", error);
    return mockProducts; // Fallback to mock data
  }
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
 * Sync products from Shopify to database
 */
export async function syncProductsToDatabase(
  upsertProduct: (product: {
    shopifyId: number;
    title: string;
    description: string;
    price: string;
    imageUrl: string | null;
    vendor: string;
    productType: string;
    inventory: number;
    sku: string;
  }) => Promise<void>
): Promise<{ synced: number; errors: number }> {
  const products = await fetchProducts();
  let synced = 0;
  let errors = 0;

  for (const product of products) {
    try {
      const variant = product.variants[0];
      const image = product.images[0];

      await upsertProduct({
        shopifyId: product.id,
        title: product.title,
        description: product.body_html || "",
        price: variant?.price || "0.00",
        imageUrl: image?.src || null,
        vendor: product.vendor || "",
        productType: product.product_type || "",
        inventory: variant?.inventory_quantity || 0,
        sku: variant?.sku || "",
      });

      synced++;
    } catch (error) {
      console.error(`[Shopify] Failed to sync product ${product.id}:`, error);
      errors++;
    }
  }

  console.log(`[Shopify] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

// ============================================================================
// BUNDLE PUBLISHING
// ============================================================================

interface PublishBundleOptions {
  title: string;
  description: string;
  price: string;
  imageUrl?: string;
  products: Array<{ name: string; quantity: number }>;
  trainerId: number;
  trainerName: string;
}

/**
 * Publish a bundle to Shopify as a product
 */
export async function publishBundle(options: PublishBundleOptions): Promise<{ productId: number; variantId: number }> {
  if (MOCK_SHOPIFY) {
    // Return mock IDs
    const mockProductId = Math.floor(Math.random() * 1000000) + 200000;
    const mockVariantId = Math.floor(Math.random() * 1000000) + 300000;
    console.log(`[Shopify Mock] Published bundle: productId=${mockProductId}, variantId=${mockVariantId}`);
    return { productId: mockProductId, variantId: mockVariantId };
  }

  const { title, description, price, imageUrl, products, trainerName } = options;

  // Build product description with included items
  const itemsList = products.map((p) => `• ${p.name} (x${p.quantity})`).join("\n");
  const fullDescription = `${description}\n\n<strong>Included in this bundle:</strong>\n${itemsList}\n\n<em>Curated by ${trainerName}</em>`;

  const productData = {
    product: {
      title,
      body_html: fullDescription,
      vendor: "LocoMotivate",
      product_type: "Bundle",
      status: "active",
      variants: [
        {
          price,
          inventory_management: null, // Don't track inventory for bundles
          requires_shipping: true,
        },
      ],
      images: imageUrl ? [{ src: imageUrl }] : [],
    },
  };

  try {
    const response = await shopifyRequest<{ product: ShopifyProduct }>("/products.json", "POST", productData);
    const product = response.product;
    const variant = product.variants[0];

    console.log(`[Shopify] Published bundle: productId=${product.id}, variantId=${variant.id}`);
    return { productId: product.id, variantId: variant.id };
  } catch (error) {
    console.error("[Shopify] Failed to publish bundle:", error);
    throw error;
  }
}

/**
 * Update an existing bundle on Shopify
 */
export async function updateBundle(
  shopifyProductId: number,
  options: Partial<PublishBundleOptions>
): Promise<void> {
  if (MOCK_SHOPIFY) {
    console.log(`[Shopify Mock] Updated bundle: productId=${shopifyProductId}`);
    return;
  }

  const updateData: Record<string, unknown> = {};

  if (options.title) updateData.title = options.title;
  if (options.description) updateData.body_html = options.description;
  if (options.price) {
    updateData.variants = [{ price: options.price }];
  }

  try {
    await shopifyRequest(`/products/${shopifyProductId}.json`, "PUT", { product: updateData });
    console.log(`[Shopify] Updated bundle: productId=${shopifyProductId}`);
  } catch (error) {
    console.error(`[Shopify] Failed to update bundle ${shopifyProductId}:`, error);
    throw error;
  }
}

/**
 * Unpublish a bundle from Shopify (set to draft)
 */
export async function unpublishBundle(shopifyProductId: number): Promise<void> {
  if (MOCK_SHOPIFY) {
    console.log(`[Shopify Mock] Unpublished bundle: productId=${shopifyProductId}`);
    return;
  }

  try {
    await shopifyRequest(`/products/${shopifyProductId}.json`, "PUT", {
      product: { status: "draft" },
    });
    console.log(`[Shopify] Unpublished bundle: productId=${shopifyProductId}`);
  } catch (error) {
    console.error(`[Shopify] Failed to unpublish bundle ${shopifyProductId}:`, error);
    throw error;
  }
}

// ============================================================================
// ORDER FUNCTIONS
// ============================================================================

/**
 * Fetch orders from Shopify
 */
export async function fetchOrders(status?: string): Promise<ShopifyOrder[]> {
  if (MOCK_SHOPIFY) {
    return []; // Return empty array for mock mode
  }

  try {
    const statusParam = status ? `&status=${status}` : "";
    const response = await shopifyRequest<{ orders: ShopifyOrder[] }>(`/orders.json?limit=50${statusParam}`);
    return response.orders;
  } catch (error) {
    console.error("[Shopify] Failed to fetch orders:", error);
    return [];
  }
}

/**
 * Create a checkout URL for a cart
 */
export async function createCheckout(
  items: Array<{ variantId: number; quantity: number }>
): Promise<string | null> {
  if (MOCK_SHOPIFY) {
    // Return a mock checkout URL
    return `https://${SHOPIFY_STORE_NAME}.myshopify.com/cart/mock-checkout`;
  }

  // For real Shopify, we'd use the Storefront API to create a checkout
  // This is a simplified version
  const lineItems = items.map((item) => `${item.variantId}:${item.quantity}`).join(",");
  return `https://${SHOPIFY_STORE_NAME}.myshopify.com/cart/${lineItems}`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if Shopify integration is configured
 */
export function isShopifyConfigured(): boolean {
  return !MOCK_SHOPIFY && !!SHOPIFY_ACCESS_TOKEN;
}

/**
 * Get Shopify admin URL for a product
 */
export function getShopifyAdminUrl(productId: number): string {
  return `https://admin.shopify.com/store/${SHOPIFY_STORE_NAME}/products/${productId}`;
}

/**
 * Get Shopify storefront URL for a product
 */
export function getShopifyStorefrontUrl(productHandle: string): string {
  return `https://${SHOPIFY_STORE_NAME}.myshopify.com/products/${productHandle}`;
}
