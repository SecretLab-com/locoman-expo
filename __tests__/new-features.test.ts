import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const projectRoot = path.join(__dirname, "..");

describe("Pull-to-Refresh Implementation", () => {
  it("should have RefreshableScrollView component", () => {
    const componentPath = path.join(projectRoot, "components/refreshable-scroll-view.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("RefreshControl");
    expect(content).toContain("onRefresh");
    expect(content).toContain("refreshing");
  });

  it("should have pull-to-refresh in products screen", () => {
    const screenPath = path.join(projectRoot, "app/(tabs)/products.tsx");
    expect(fs.existsSync(screenPath)).toBe(true);
    const content = fs.readFileSync(screenPath, "utf-8");
    expect(content).toContain("RefreshControl");
    expect(content).toContain("onRefresh");
  });
});

describe("Loading Skeletons", () => {
  it("should have skeleton component", () => {
    const componentPath = path.join(projectRoot, "components/skeleton.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("Skeleton");
    expect(content).toContain("BundleCardSkeleton");
    expect(content).toContain("ProductCardSkeleton");
    expect(content).toContain("TrainerCardSkeleton");
  });

  it("should have animation in skeleton", () => {
    const componentPath = path.join(projectRoot, "components/skeleton.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("Animated");
  });
});

describe("Media Gallery", () => {
  it("should have media picker component", () => {
    const componentPath = path.join(projectRoot, "components/media-picker.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("expo-image-picker");
    expect(content).toContain("launchImageLibraryAsync");
  });

  it("should have SingleImagePicker component", () => {
    const componentPath = path.join(projectRoot, "components/media-picker.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("SingleImagePicker");
    expect(content).toContain("onImageChange");
  });

  it("should have MediaPicker component", () => {
    const componentPath = path.join(projectRoot, "components/media-picker.tsx");
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("MediaPicker");
    expect(content).toContain("MediaItem");
  });
});

describe("Bundle Image Generation", () => {
  it("should have image generation service", () => {
    const servicePath = path.join(projectRoot, "lib/image-generation.ts");
    expect(fs.existsSync(servicePath)).toBe(true);
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("buildBundleImagePrompt");
  });

  it("should have AI generate button in bundle editor", () => {
    const editorPath = path.join(projectRoot, "app/bundle-editor/[id].tsx");
    expect(fs.existsSync(editorPath)).toBe(true);
    const content = fs.readFileSync(editorPath, "utf-8");
    expect(content).toContain("Generate with AI");
    expect(content).toContain("generateImageMutation");
    expect(content).toContain("generatingImage");
  });

  it("should have AI router in server", () => {
    const routerPath = path.join(projectRoot, "server/routers.ts");
    const content = fs.readFileSync(routerPath, "utf-8");
    expect(content).toContain("ai:");
    expect(content).toContain("generateBundleImage");
  });
});

describe("Shopify Integration", () => {
  it("should have Shopify service", () => {
    const servicePath = path.join(projectRoot, "server/shopify.ts");
    expect(fs.existsSync(servicePath)).toBe(true);
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("ShopifyProduct");
    expect(content).toContain("fetchProducts");
    expect(content).toContain("createCheckout");
  });

  it("should have Shopify router in server", () => {
    const routerPath = path.join(projectRoot, "server/routers.ts");
    const content = fs.readFileSync(routerPath, "utf-8");
    expect(content).toContain("shopify:");
    expect(content).toContain("products");
    expect(content).toContain("sync");
  });

  it("should have manager products screen", () => {
    const screenPath = path.join(projectRoot, "app/(manager)/products.tsx");
    expect(fs.existsSync(screenPath)).toBe(true);
    const content = fs.readFileSync(screenPath, "utf-8");
    expect(content).toContain("Products");
  });
});

describe("OAuth Login", () => {
  it("should have OAuth buttons component", () => {
    const componentPath = path.join(projectRoot, "components/oauth-buttons.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("OAuthButtons");
    expect(content).toContain("GoogleIcon");
    expect(content).toContain("expo-apple-authentication");
  });

  it("should have OAuth buttons in login screen", () => {
    const loginPath = path.join(projectRoot, "app/login.tsx");
    expect(fs.existsSync(loginPath)).toBe(true);
    const content = fs.readFileSync(loginPath, "utf-8");
    expect(content).toContain("OAuthButtons");
    expect(content).toContain("oauth-buttons");
  });
});

describe("Push Notifications", () => {
  it("should have notifications service", () => {
    const servicePath = path.join(projectRoot, "lib/notifications.ts");
    expect(fs.existsSync(servicePath)).toBe(true);
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("registerForPushNotificationsAsync");
    expect(content).toContain("scheduleDeliveryNotification");
    expect(content).toContain("scheduleSessionReminder");
  });

  it("should have notification context", () => {
    const contextPath = path.join(projectRoot, "contexts/notification-context.tsx");
    expect(fs.existsSync(contextPath)).toBe(true);
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("NotificationProvider");
    expect(content).toContain("useNotifications");
  });

  it("should handle web platform gracefully", () => {
    const servicePath = path.join(projectRoot, "lib/notifications.ts");
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("Platform.OS");
    expect(content).toContain("web");
  });
});

describe("Icon Mappings", () => {
  it("should have all required icon mappings", () => {
    const iconPath = path.join(projectRoot, "components/ui/icon-symbol.tsx");
    const content = fs.readFileSync(iconPath, "utf-8");
    
    // Check for new icons added
    expect(content).toContain("sparkles");
    expect(content).toContain("sync");
    expect(content).toContain("photo");
    expect(content).toContain("megaphone.fill");
    expect(content).toContain("barcode");
  });
});

describe("Trainer Features", () => {
  it("should have trainer deliveries screen", () => {
    const screenPath = path.join(projectRoot, "app/(trainer)/deliveries.tsx");
    expect(fs.existsSync(screenPath)).toBe(true);
    const content = fs.readFileSync(screenPath, "utf-8");
    expect(content).toContain("Mark Ready");
    expect(content).toContain("Mark Delivered");
  });

  it("should have trainer partnerships screen", () => {
    const screenPath = path.join(projectRoot, "app/(trainer)/partnerships.tsx");
    expect(fs.existsSync(screenPath)).toBe(true);
    const content = fs.readFileSync(screenPath, "utf-8");
    expect(content).toContain("Ad Partnerships");
    expect(content).toContain("Submit Business");
  });
});

describe("Manager Features", () => {
  it("should have manager approvals screen", () => {
    const screenPath = path.join(projectRoot, "app/(manager)/approvals.tsx");
    expect(fs.existsSync(screenPath)).toBe(true);
    const content = fs.readFileSync(screenPath, "utf-8");
    expect(content).toContain("Approvals");
    expect(content).toContain("Bundles");
    expect(content).toContain("pending");
  });

  it("should have manager deliveries screen", () => {
    const screenPath = path.join(projectRoot, "app/(manager)/deliveries.tsx");
    expect(fs.existsSync(screenPath)).toBe(true);
    const content = fs.readFileSync(screenPath, "utf-8");
    expect(content).toContain("All Deliveries");
  });
});


describe("Superadmin Impersonation Feature", () => {
  it("should have impersonation banner component", () => {
    const componentPath = path.join(projectRoot, "components/impersonation-banner.tsx");
    expect(fs.existsSync(componentPath)).toBe(true);
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("ImpersonationBanner");
    expect(content).toContain("impersonating");
  });

  it("should have coordinator dashboard screen", () => {
    const screenPath = path.join(projectRoot, "app/(coordinator)/index.tsx");
    expect(fs.existsSync(screenPath)).toBe(true);
    const content = fs.readFileSync(screenPath, "utf-8");
    expect(content).toContain("CoordinatorHomeScreen");
  });

  it("should have impersonation banner in root layout", () => {
    const layoutPath = path.join(projectRoot, "app/_layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("ImpersonationBanner");
  });
});

describe("Test Accounts", () => {
  it("should have trainer test account", () => {
    const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
    const content = fs.readFileSync(oauthPath, "utf-8");
    expect(content).toContain("trainer@secretlab.com");
  });

  it("should have client test account", () => {
    const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
    const content = fs.readFileSync(oauthPath, "utf-8");
    expect(content).toContain("client@secretlab.com");
  });

  it("should have manager test account", () => {
    const oauthPath = path.join(projectRoot, "server/_core/oauth.ts");
    const content = fs.readFileSync(oauthPath, "utf-8");
    expect(content).toContain("manager@secretlab.com");
  });
});

describe("Push Notifications - New Features", () => {
  it("should have bundle approval notification function", () => {
    const servicePath = path.join(projectRoot, "lib/notifications.ts");
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("scheduleBundleApprovalNotification");
    expect(content).toContain("Bundle Approved");
    expect(content).toContain("Bundle Needs Revision");
  });

  it("should have new order notification function", () => {
    const servicePath = path.join(projectRoot, "lib/notifications.ts");
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("scheduleNewOrderNotification");
    expect(content).toContain("New Order Received");
  });

  it("should have delivery update notification function", () => {
    const servicePath = path.join(projectRoot, "lib/notifications.ts");
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain("scheduleDeliveryUpdateNotification");
    expect(content).toContain("Order Shipped");
    expect(content).toContain("Order Delivered");
  });

  it("should handle bundle_approval notification type in context", () => {
    const contextPath = path.join(projectRoot, "contexts/notification-context.tsx");
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("bundle_approval");
  });

  it("should handle new_order notification type in context", () => {
    const contextPath = path.join(projectRoot, "contexts/notification-context.tsx");
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("new_order");
  });

  it("should handle delivery_update notification type in context", () => {
    const contextPath = path.join(projectRoot, "contexts/notification-context.tsx");
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("delivery_update");
  });
});

describe("Dark Mode Toggle", () => {
  it("should have theme preference support in theme provider", () => {
    const providerPath = path.join(projectRoot, "lib/theme-provider.tsx");
    const content = fs.readFileSync(providerPath, "utf-8");
    expect(content).toContain("themePreference");
    expect(content).toContain("setThemePreference");
    expect(content).toContain("isSystemTheme");
  });

  it("should persist theme preference to AsyncStorage", () => {
    const providerPath = path.join(projectRoot, "lib/theme-provider.tsx");
    const content = fs.readFileSync(providerPath, "utf-8");
    expect(content).toContain("AsyncStorage");
    expect(content).toContain("THEME_STORAGE_KEY");
  });

  it("should support system, light, and dark modes", () => {
    const providerPath = path.join(projectRoot, "lib/theme-provider.tsx");
    const content = fs.readFileSync(providerPath, "utf-8");
    expect(content).toContain('"system"');
    expect(content).toContain('"light"');
    expect(content).toContain('"dark"');
  });

  it("should have theme toggle in profile screen", () => {
    const profilePath = path.join(projectRoot, "app/(tabs)/profile.tsx");
    const content = fs.readFileSync(profilePath, "utf-8");
    expect(content).toContain("useThemeContext");
    expect(content).toContain("cycleTheme");
    expect(content).toContain("getThemeLabel");
  });

  it("should have theme toggle in trainer settings", () => {
    const settingsPath = path.join(projectRoot, "app/(trainer)/settings.tsx");
    const content = fs.readFileSync(settingsPath, "utf-8");
    expect(content).toContain("useThemeContext");
    expect(content).toContain("Appearance");
    expect(content).toContain("Theme");
  });

  it("should have sun and moon icon mappings", () => {
    const iconPath = path.join(projectRoot, "components/ui/icon-symbol.tsx");
    const content = fs.readFileSync(iconPath, "utf-8");
    expect(content).toContain("sun.max.fill");
    expect(content).toContain("moon.fill");
    expect(content).toContain("light-mode");
    expect(content).toContain("dark-mode");
  });
});

describe("Login Enhancements", () => {
  it("should have remember me option", () => {
    const loginPath = path.join(projectRoot, "app/login.tsx");
    const content = fs.readFileSync(loginPath, "utf-8");
    expect(content).toContain("rememberMe");
    expect(content).toContain("Remember me");
  });

  it("should have password visibility toggle", () => {
    const loginPath = path.join(projectRoot, "app/login.tsx");
    const content = fs.readFileSync(loginPath, "utf-8");
    expect(content).toContain("showPassword");
    expect(content).toContain("eye.fill");
    expect(content).toContain("eye.slash.fill");
  });

  it("should have test account quick fill buttons", () => {
    const loginPath = path.join(projectRoot, "app/login.tsx");
    const content = fs.readFileSync(loginPath, "utf-8");
    expect(content).toContain("Test Accounts");
    expect(content).toContain("trainer@secretlab.com");
    expect(content).toContain("client@secretlab.com");
    expect(content).toContain("manager@secretlab.com");
  });
});
