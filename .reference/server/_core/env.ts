export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Shopify integration
  shopifyStoreName: process.env.SHOPIFY_STORE_NAME ?? "",
  shopifyApiAccessToken: process.env.SHOPIFY_API_ACCESS_TOKEN ?? "",
  shopifyApiKey: process.env.SHOPIFY_API_KEY ?? "",
  shopifyApiSecretKey: process.env.SHOPIFY_API_SECRET_KEY ?? "",
  // Gemini API for image generation
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
};
