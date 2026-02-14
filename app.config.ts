// Load environment variables with proper priority (system > .env)
// Inline implementation to avoid ESM/CommonJS compatibility issues
import type { ExpoConfig } from "expo/config";
import * as fs from "fs";
import * as path from "path";

// Load .env file if it exists (system env vars take priority)
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");
  lines.forEach((line) => {
    if (!line || line.trim().startsWith("#")) return;
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Bundle ID format: com.loco.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "com.loco.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "com.bright.blue.locomotivate";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "com.loco.app";
// Extract timestamp from bundle ID for deep link scheme
// e.g., "com.loco.my.app.t20240115103045" -> "locomotivate20240115103045"
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = timestamp || "locomotivate";

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "LocoMotivate",
  appSlug: "locomotivate",
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/Logo.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  updates: {
    url: "https://u.expo.dev/8980c95b-d28f-4d80-ad42-54b4d5fdd3e7",
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  extra: {
    eas: {
      projectId: "8980c95b-d28f-4d80-ad42-54b4d5fdd3e7",
    },
    // API base URL for native platforms - this is bundled into the app
    // Using the public tunnel URL so Expo Go can reach the API server
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || "https://locoman-backend-870100645593.us-central1.run.app",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    googleServicesFile: "./assets/GoogleService-Info.plist",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [
            "com.googleusercontent.apps.870100645593-po1mtmilfq2vi3ivba0bm8c1gpbhrg9g",
            "locolocomotivate",
            "locomotivate",
            "com.bright.blue.locomotivate",
          ],
        },
      ],
    },
    associatedDomains: [
      "applinks:locomotivate.app",
      "webcredentials:locomotivate.app",
    ],
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0A0A14",
      foregroundImage: "./assets/images/Logo.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "locomotivate.app",
            pathPrefix: "/bundle",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            pathPrefix: "/trainer",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            pathPrefix: "/conversation",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            pathPrefix: "/invite",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            pathPrefix: "/client",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            path: "/messages",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            path: "/profile",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            path: "/checkout",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            path: "/browse",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            path: "/activity",
          },
          {
            scheme: "https",
            host: "locomotivate.app",
            path: "/discover",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/Logo.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    "expo-notifications",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0A0A14",
        dark: {
          backgroundColor: "#0A0A14",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
