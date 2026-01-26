import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the shopify module
vi.mock("./shopify", () => ({
  fetchProducts: vi.fn().mockResolvedValue([
    {
      id: 8888888888,
      title: "Gift Card",
      body_html: "This is a gift card",
      vendor: "Snowboard Vendor",
      product_type: "Gift Cards",
      status: "active",
      variants: [
        {
          id: 44444444444,
          product_id: 8888888888,
          title: "Default",
          price: "100.00",
          sku: "GC-001",
          inventory_quantity: 0,
        },
      ],
      images: [],
    },
    {
      id: 9999999999,
      title: "The Collection Snowboard: Hydrogen",
      body_html: "Premium snowboard for all skill levels",
      vendor: "Hydrogen Vendor",
      product_type: "Snowboard",
      status: "active",
      variants: [
        {
          id: 55555555555,
          product_id: 9999999999,
          title: "Default",
          price: "600.00",
          sku: "SB-001",
          inventory_quantity: 50,
        },
      ],
      images: [
        {
          id: 1,
          src: "https://cdn.shopify.com/snowboard.jpg",
          alt: "Snowboard",
        },
      ],
    },
  ]),
  fetchProduct: vi.fn().mockImplementation(async (id: number) => {
    if (id === 9999999999) {
      return {
        id: 9999999999,
        title: "The Collection Snowboard: Hydrogen",
        body_html: "Premium snowboard for all skill levels",
        vendor: "Hydrogen Vendor",
        product_type: "Snowboard",
        status: "active",
        variants: [
          {
            id: 55555555555,
            product_id: 9999999999,
            title: "Default",
            price: "600.00",
            sku: "SB-001",
            inventory_quantity: 50,
          },
        ],
        images: [
          {
            id: 1,
            src: "https://cdn.shopify.com/snowboard.jpg",
            alt: "Snowboard",
          },
        ],
      };
    }
    return null;
  }),
  syncProductsToDatabase: vi.fn().mockResolvedValue({ synced: 2, errors: 0 }),
  publishBundle: vi.fn().mockResolvedValue({ productId: 12345, variantId: 67890 }),
  getCheckoutUrl: vi.fn().mockImplementation((variantId: number, quantity: number) => {
    return `https://bright-express-dev.myshopify.com/cart/${variantId}:${quantity}`;
  }),
}));

// Mock database functions
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  updateUserRole: vi.fn(),
  upsertProduct: vi.fn().mockResolvedValue(1),
  logActivity: vi.fn(),
  getBundleTemplates: vi.fn().mockResolvedValue([]),
  getBundleDraftsByTrainer: vi.fn().mockResolvedValue([]),
  createBundleDraft: vi.fn().mockResolvedValue(1),
  getAllBundlePublications: vi.fn().mockResolvedValue([]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(role: AuthenticatedUser["role"] = "shopper"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
    phone: null,
    photoUrl: null,
    bio: null,
    location: null,
    timezone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    isImpersonating: false,
    realAdminUser: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    isImpersonating: false,
    realAdminUser: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Shopify Products Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches products from Shopify without authentication", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.products();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].title).toBe("Gift Card");
    expect(result[1].title).toBe("The Collection Snowboard: Hydrogen");
  });

  it("returns transformed product data with correct fields", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.products();

    // Check first product (Gift Card)
    expect(result[0]).toMatchObject({
      id: 8888888888,
      title: "Gift Card",
      vendor: "Snowboard Vendor",
      productType: "Gift Cards",
      price: "100.00",
      variantId: 44444444444,
      sku: "GC-001",
      inventory: 0,
      imageUrl: "",
    });

    // Check second product (Snowboard)
    expect(result[1]).toMatchObject({
      id: 9999999999,
      title: "The Collection Snowboard: Hydrogen",
      vendor: "Hydrogen Vendor",
      productType: "Snowboard",
      price: "600.00",
      variantId: 55555555555,
      sku: "SB-001",
      inventory: 50,
      imageUrl: "https://cdn.shopify.com/snowboard.jpg",
    });
  });

  it("fetches a single product by ID", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.product({ id: 9999999999 });

    expect(result).not.toBeNull();
    expect(result?.title).toBe("The Collection Snowboard: Hydrogen");
    expect(result?.price).toBe("600.00");
    expect(result?.images).toHaveLength(1);
    expect(result?.variants).toHaveLength(1);
  });

  it("returns null for non-existent product", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.product({ id: 1 });

    expect(result).toBeNull();
  });

  it("generates checkout URL correctly", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.checkoutUrl({ variantId: 55555555555, quantity: 2 });

    expect(result.url).toBe("https://bright-express-dev.myshopify.com/cart/55555555555:2");
  });

  it("generates checkout URL with default quantity of 1", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.checkoutUrl({ variantId: 44444444444 });

    expect(result.url).toBe("https://bright-express-dev.myshopify.com/cart/44444444444:1");
  });
});

describe("Shopify Sync Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs products to database for manager", async () => {
    const ctx = createMockContext("manager");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.sync();

    expect(result).toEqual({ synced: 2, errors: 0 });
  });

  it("rejects sync for non-manager users", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    await expect(caller.shopify.sync()).rejects.toThrow();
  });

  it("rejects sync for unauthenticated users", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.shopify.sync()).rejects.toThrow();
  });
});

describe("Shopify Publish Bundle Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes bundle to Shopify for trainer", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.publishBundle({
      title: "Strength Bundle Week 1",
      description: "Complete strength training bundle",
      price: "149.99",
      products: [
        { id: 1001, name: "Protein Powder", quantity: 1 },
        { id: 1002, name: "Creatine", quantity: 1 },
      ],
    });

    expect(result).toEqual({ productId: 12345, variantId: 67890 });
  });

  it("publishes bundle with optional image URL", async () => {
    const ctx = createMockContext("trainer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.publishBundle({
      title: "Weight Loss Bundle",
      description: "Kickstart your weight loss journey",
      price: "199.99",
      products: [{ id: 1003, name: "Fat Burner", quantity: 1 }],
      imageUrl: "https://example.com/bundle-image.jpg",
    });

    expect(result).toEqual({ productId: 12345, variantId: 67890 });
  });

  it("rejects bundle publish for unauthenticated users", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.shopify.publishBundle({
        title: "Test Bundle",
        description: "Test",
        price: "99.99",
        products: [{ id: 1004, name: "Product", quantity: 1 }],
      })
    ).rejects.toThrow();
  });

  it("rejects bundle publish for shopper role", async () => {
    const ctx = createMockContext("shopper");
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.shopify.publishBundle({
        title: "Test Bundle",
        description: "Test",
        price: "99.99",
        products: [{ id: 1005, name: "Product", quantity: 1 }],
      })
    ).rejects.toThrow();
  });

  it("allows manager to publish bundles", async () => {
    const ctx = createMockContext("manager");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.shopify.publishBundle({
      title: "Manager Bundle",
      description: "Created by manager",
      price: "299.99",
      products: [{ id: 1006, name: "Premium Product", quantity: 2 }],
    });

    expect(result).toEqual({ productId: 12345, variantId: 67890 });
  });
});
