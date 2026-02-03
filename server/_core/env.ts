const isProduction = process.env.NODE_ENV === "production";
const rawAppId = process.env.VITE_APP_ID ?? process.env.EXPO_PUBLIC_APP_ID ?? "";
const rawOAuthServerUrl =
  process.env.OAUTH_SERVER_URL ?? process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "";
const cookieSecret = process.env.JWT_SECRET ?? "";
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const appId = rawAppId || (!isProduction ? "dev-app-id" : "");

if (!cookieSecret && isProduction) {
  console.error("[Auth] JWT_SECRET is missing in production.");
}
if (!rawAppId && !isProduction) {
  console.warn("[Auth] App ID is missing, using dev fallback.");
}
if (!rawOAuthServerUrl && !isProduction) {
  console.warn("[Auth] OAuth server URL is missing.");
}
if ((!googleClientId || !googleClientSecret) && !isProduction) {
  console.warn("[Auth] Google OAuth credentials are missing.");
}

export const ENV = {
  appId,
  cookieSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: rawOAuthServerUrl,
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleClientId,
  googleClientSecret,
};
