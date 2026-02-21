import "@/global.css";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Stack, usePathname, useRouter } from "expo-router";
import { ShareIntentProvider } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, AppStateStatus, LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

import { ShareIntentRouter } from "@/components/share-intent-router";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { MobileAppBanner } from "@/components/mobile-app-banner";
import { IncomingMessageFAB } from "@/components/incoming-message-fab";
import { NavigationHeader } from "@/components/navigation-header";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PostAuthOnboardingResolver } from "@/components/post-auth-onboarding-resolver";
import { ProfileFAB } from "@/components/profile-fab";
import { AuthProvider, useAuthContext } from "@/contexts/auth-context";
import { BadgeProvider } from "@/contexts/badge-context";
import { CartProvider } from "@/contexts/cart-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { OfflineProvider } from "@/contexts/offline-context";
import { RealtimeProvider } from "@/contexts/realtime-context";
import { useDeepLink } from "@/hooks/use-deep-link";
import { initPortalRuntime, subscribeSafeAreaInsets } from "@/lib/_core/portal-runtime";
import { getHomeRoute } from "@/lib/navigation";
import { createTRPCClient, trpc } from "@/lib/trpc";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

const HEADER_TITLES: Record<string, string> = {
  "activity/index": "Activity",
  "bundle/[id]": "Bundle Details",
  "bundle-editor/[id]": "Bundle Editor",
  "browse/index": "Browse",
  "checkout/index": "Checkout",
  "checkout/confirmation": "Confirmation",
  "discover-bundles/index": "Discover",
  "client-detail/[id]": "Client Details",
  "conversation/[id]": "Conversation",
  "invite/[token]": "Accept Invite",
  "login": "Sign In",
  "messages/index": "Messages",
  "messages/[id]": "Message",
  "my-trainers/index": "My Trainers",
  "my-trainers/find": "Find Trainers",
  "new-message": "New Message",
  "share-intent": "Share To",
  "oauth/callback": "Connecting",
  "profile/index": "Profile",
  "register": "Create Account",
  "template-editor/[id]": "Template Editor",
  "trainer/[id]": "Trainer",
};

const IGNORED_WARNINGS = [
  "props.pointerEvents is deprecated. Use style.pointerEvents",
  "\"shadow*\" style props are deprecated. Use \"boxShadow\".",
  "[expo-notifications] Listening to push token changes is not yet fully supported on web.",
];
const LAST_NOTIFIED_UPDATE_ID_KEY = "app:last_notified_update_id";
const AUTH_REDIRECT_GRACE_MS = 5000;
const OTA_CHECK_COOLDOWN_MS = 60_000;

function getHeaderTitle(routeName: string): string {
  if (HEADER_TITLES[routeName]) {
    return HEADER_TITLES[routeName];
  }
  const cleaned = routeName
    .replace(/\[.*?\]/g, "")
    .replace(/[-/]/g, " ")
    .trim();
  if (!cleaned) {
    return "Back";
  }
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function RootAccessGate({ children }: { children: React.ReactNode }) {
  const { loading, hasSession, profileHydrated, isAuthenticated, effectiveRole, isImpersonating } =
    useAuthContext();
  const pathname = usePathname();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [authGraceActive, setAuthGraceActive] = useState(false);
  const [authGateReady, setAuthGateReady] = useState(false);

  const isAuthTransit = loading || (hasSession && !profileHydrated);
  useEffect(() => {
    const timer = setTimeout(() => setAuthGateReady(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const APP_NAME = "Locomotivate";
    const path = pathname || "/";
    const segment = path.split("/").filter(Boolean).pop() || "";
    const PAGE_TITLES: Record<string, string> = {
      "": APP_NAME,
      "dashboard": "Dashboard",
      "clients": "Clients",
      "get-paid": "Get Paid",
      "request-payment": "Request Payment",
      "payment-setup": "Payment Setup",
      "payment-history": "Payment History",
      "rewards": "Rewards",
      "more": "More",
      "offers": "Offers",
      "templates": "Templates",
      "analytics": "Analytics",
      "messages": "Messages",
      "alerts": "Alerts",
      "invite": "Invite",
      "deliveries": "Deliveries",
      "calendar": "Calendar",
      "settings": "Settings",
      "products": "Products",
      "trainers": "Trainers",
      "cart": "Cart",
      "profile": "Profile",
      "login": "Sign In",
      "register": "Create Account",
      "welcome": "Welcome",
      "checkout": "Checkout",
      "approvals": "Approvals",
      "users": "Users",
      "bundles": "Bundles",
      "logs": "Logs",
      "orders": "Orders",
      "subscriptions": "Subscriptions",
      "spending": "Account",
    };
    const pageTitle = PAGE_TITLES[segment];
    document.title = pageTitle ? `${pageTitle} — ${APP_NAME}` : APP_NAME;
  }, [pathname]);

  useEffect(() => {
    if (!authGateReady) return;
    if (!isAuthenticated) return;
    setAuthGraceActive(true);
    const timer = setTimeout(() => setAuthGraceActive(false), AUTH_REDIRECT_GRACE_MS);
    return () => clearTimeout(timer);
  }, [authGateReady, isAuthenticated]);
  const isGuestSafeRoute = useMemo(() => {
    const path = pathname || "";
    if (path === "/welcome" || path === "/login" || path === "/register" || path === "/share-intent" || path.startsWith("/oauth/callback")) {
      return true;
    }
    // Guests may browse bundles/trainers only.
    if (path === "/(tabs)/products" || path === "/(tabs)/trainers") return true;
    if (path.startsWith("/bundle/") || path.startsWith("/trainer/")) return true;
    return false;
  }, [pathname]);

  useEffect(() => {
    if (!authGateReady || isAuthTransit) {
      setRedirecting(false);
      return;
    }
    if (authGraceActive) {
      setRedirecting(false);
      return;
    }
    if (!isAuthenticated && !isGuestSafeRoute) {
      setRedirecting(true);
      router.replace("/welcome");
      return;
    }
    const rolePathChecks: Array<{ prefix: string; role: string }> = [
      { prefix: "/(coordinator)", role: "coordinator" },
      { prefix: "/(manager)", role: "manager" },
      { prefix: "/(trainer)", role: "trainer" },
      { prefix: "/(client)", role: "client" },
    ];
    const mismatchedRolePath = rolePathChecks.find(
      ({ prefix, role }) => pathname.startsWith(prefix) && effectiveRole !== role
    );
    if (mismatchedRolePath) {
      setRedirecting(true);
      router.replace(getHomeRoute(effectiveRole) as any);
      return;
    }
    if (pathname.startsWith("/(tabs)") && effectiveRole && effectiveRole !== "shopper") {
      setRedirecting(true);
      router.replace(getHomeRoute(effectiveRole) as any);
      return;
    }
    setRedirecting(false);
  }, [
    authGateReady,
    isAuthTransit,
    authGraceActive,
    isAuthenticated,
    isGuestSafeRoute,
    pathname,
    effectiveRole,
    router,
  ]);

  if (
    !authGateReady ||
    isAuthTransit ||
    redirecting ||
    (!isAuthenticated && !isGuestSafeRoute)
  ) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const roleScope = isAuthenticated ? effectiveRole || "shopper" : "guest";
  const navigatorKey = `${roleScope}:${isImpersonating ? "impersonating" : "base"}`;
  return <View key={navigatorKey} style={{ flex: 1 }}>{children}</View>;
}

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);
  const [isHydrated, setIsHydrated] = useState(false);
  const isCheckingUpdateRef = useRef(false);
  const lastUpdateCheckAtRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Initialize Portal runtime for cookie injection from parent container
  useEffect(() => {
    initPortalRuntime();
  }, []);

  // Handle incoming deep links from push notifications and external links
  useDeepLink();

  useEffect(() => {
    if (!__DEV__) return;
    LogBox.ignoreLogs(IGNORED_WARNINGS);
    if (Platform.OS !== "web") return;
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      const firstArg = typeof args[0] === "string" ? args[0] : "";
      if (IGNORED_WARNINGS.some((warning) => firstArg.includes(warning))) {
        return;
      }
      originalWarn(...args);
    };
    return () => {
      console.warn = originalWarn;
    };
  }, []);

  useEffect(() => {
    const maybeShowUpdateAlert = async () => {
      if (__DEV__ || Platform.OS === "web" || !Updates.isEnabled) return;

      const currentUpdateId = Updates.updateId;
      if (!currentUpdateId) return;

      // Only show for OTA launches, not the binary's embedded bundle.
      if (Updates.isEmbeddedLaunch) return;

      const lastNotifiedUpdateId = await AsyncStorage.getItem(LAST_NOTIFIED_UPDATE_ID_KEY);
      if (lastNotifiedUpdateId === currentUpdateId) return;

      await AsyncStorage.setItem(LAST_NOTIFIED_UPDATE_ID_KEY, currentUpdateId);

      // Prefer installed native values so this always reflects the actual build on device.
      const appVersion =
        Constants.nativeAppVersion ??
        Constants.expoConfig?.version ??
        "1.0.0";
      const buildNumber =
        Constants.nativeBuildVersion ??
        Constants.expoConfig?.ios?.buildNumber ??
        Constants.expoConfig?.android?.versionCode?.toString() ??
        "8";

      const otaShortId = currentUpdateId.slice(0, 8);
      const channel = Updates.channel ?? "production";
      Alert.alert(
        "Updated",
        `App has been updated to ${appVersion} (${buildNumber})\nOTA: ${otaShortId}\nChannel: ${channel}`,
      );
    };

    void maybeShowUpdateAlert();
  }, []);

  useEffect(() => {
    const checkAndApplyUpdate = async (reason: "initial" | "foreground") => {
      if (__DEV__ || Platform.OS === "web" || !Updates.isEnabled) return;
      if (isCheckingUpdateRef.current) return;

      const now = Date.now();
      if (reason === "foreground" && now - lastUpdateCheckAtRef.current < OTA_CHECK_COOLDOWN_MS) {
        return;
      }

      isCheckingUpdateRef.current = true;
      lastUpdateCheckAtRef.current = now;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (!update.isAvailable) return;

        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Update ready",
          "A new version has been downloaded. Reload now?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Reload",
              onPress: () => {
                void Updates.reloadAsync();
              },
            },
          ]
        );
      } catch (error) {
        console.log("[OTA] update check failed:", error);
      } finally {
        isCheckingUpdateRef.current = false;
      }
    };

    void checkAndApplyUpdate("initial");

    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;
      if (wasBackground && nextState === "active") {
        void checkAndApplyUpdate("foreground");
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile/web
  // On web, we default to 0 during server-render to ensure hydration stability
  const providerInitialMetrics = useMemo(() => {
    const metrics = (isHydrated && initialWindowMetrics) ? initialWindowMetrics : { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame, isHydrated]);

  const content = (
    <ShareIntentProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationProvider>
              <CartProvider>
                <BadgeProvider>
                  <OfflineProvider>
                  <RealtimeProvider>
                    <View
                      style={{ flex: 1 }}
                      {...(Platform.OS === 'web' ? { suppressHydrationWarning: true } : {})}
                    >
                      <ImpersonationBanner />
                      <MobileAppBanner />
                      <PostAuthOnboardingResolver />
                      <ShareIntentRouter />
                      <View style={{ flex: 1 }}>
                        <ProfileFAB />
                        <IncomingMessageFAB />
                        <OfflineIndicator />
                        {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
                        {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
                        {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
                        {/* Enable swipe-back gesture globally for native iOS/Android feel */}
                        <RootAccessGate>
                          <Stack
                            screenOptions={{
                              headerShown: true,
                              header: ({ route }) => (
                                <NavigationHeader
                                  title={getHeaderTitle(route.name)}
                                />
                              ),
                              // Enable swipe-back gesture on all screens by default
                              gestureEnabled: true,
                              // iOS: Full-width swipe from left edge
                              fullScreenGestureEnabled: true,
                              // Animation configuration for smooth transitions
                              animation: "slide_from_right",
                              // Gesture direction for swipe-back
                              gestureDirection: "horizontal",
                            }}
                          >
                            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                            <Stack.Screen
                              name="login"
                              options={{ presentation: "modal", animation: "slide_from_bottom", gestureDirection: "vertical" }}
                            />
                            <Stack.Screen
                              name="register"
                              options={{ presentation: "modal", animation: "slide_from_bottom", gestureDirection: "vertical" }}
                            />
                            <Stack.Screen name="bundle/[id]" options={{ presentation: "card" }} />
                            <Stack.Screen name="bundle-editor/[id]" options={{ presentation: "card", headerShown: false }} />
                            <Stack.Screen name="client-detail/[id]" options={{ presentation: "card" }} />
                            <Stack.Screen name="checkout/index" options={{ presentation: "card" }} />
                            <Stack.Screen
                              name="checkout/confirmation"
                              options={{ presentation: "modal", animation: "slide_from_bottom", gestureDirection: "vertical" }}
                            />
                            <Stack.Screen name="messages/index" options={{ presentation: "card", headerShown: false }} />
                            <Stack.Screen name="messages/[id]" options={{ presentation: "card", headerShown: false }} />
                            <Stack.Screen name="trainer/[id]" options={{ presentation: "card" }} />
                            <Stack.Screen name="browse/index" options={{ presentation: "card" }} />
                            <Stack.Screen name="activity/index" options={{ presentation: "card" }} />
                            <Stack.Screen name="discover-bundles/index" options={{ presentation: "card" }} />
                            <Stack.Screen name="my-trainers/index" options={{ presentation: "card", headerShown: false }} />
                            <Stack.Screen name="my-trainers/find" options={{ presentation: "card", headerShown: false }} />
                            <Stack.Screen name="profile/index" options={{ presentation: "card", headerShown: false }} />
                            <Stack.Screen
                              name="invite/[token]"
                              options={{ presentation: "modal", animation: "slide_from_bottom", gestureDirection: "vertical" }}
                            />
                            <Stack.Screen name="conversation/[id]" options={{ presentation: "card", headerShown: false }} />
                            <Stack.Screen name="new-message" options={{ presentation: "card" }} />
                            <Stack.Screen
                              name="share-intent"
                              options={{ presentation: "modal", animation: "slide_from_bottom", gestureDirection: "vertical" }}
                            />
                            <Stack.Screen name="template-editor/[id]" options={{ presentation: "card", headerShown: false }} />
                            <Stack.Screen
                              name="(trainer)"
                              options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }}
                            />
                            <Stack.Screen
                              name="(client)"
                              options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }}
                            />
                            <Stack.Screen
                              name="(manager)"
                              options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }}
                            />
                            <Stack.Screen
                              name="(coordinator)"
                              options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }}
                            />
                            <Stack.Screen name="welcome" options={{ headerShown: false }} />
                            <Stack.Screen name="oauth/callback" />
                          </Stack>
                        </RootAccessGate>
                        <StatusBar style="auto" />
                      </View>
                    </View>
                  </RealtimeProvider>
                  </OfflineProvider>
                </BadgeProvider>
              </CartProvider>
            </NotificationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
    </ShareIntentProvider>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
