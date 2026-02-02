import "@/global.css";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogBox, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";
import {
    SafeAreaFrameContext,
    SafeAreaInsetsContext,
    SafeAreaProvider,
    initialWindowMetrics,
} from "react-native-safe-area-context";

import { ImpersonationBanner } from "@/components/impersonation-banner";
import { NavigationHeader } from "@/components/navigation-header";
import { OfflineIndicator } from "@/components/offline-indicator";
import { ProfileFAB } from "@/components/profile-fab";
import { AuthProvider } from "@/contexts/auth-context";
import { BadgeProvider } from "@/contexts/badge-context";
import { CartProvider } from "@/contexts/cart-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { OfflineProvider } from "@/contexts/offline-context";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { navigateToHome } from "@/lib/navigation";
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

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

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

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationProvider>
              <CartProvider>
                <BadgeProvider>
                <OfflineProvider>
                  <View style={{ flex: 1 }}>
                    <ImpersonationBanner />
                    <View style={{ flex: 1 }}>
                      <ProfileFAB />
                      <OfflineIndicator />
                      {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
                      {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
                      {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
                      {/* Enable swipe-back gesture globally for native iOS/Android feel */}
                      <Stack
                        screenOptions={{
                          headerShown: true,
                          header: ({ route }) => (
                            <NavigationHeader
                              title={getHeaderTitle(route.name)}
                              onBack={() => navigateToHome()}
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
                    <Stack.Screen name="login" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="register" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="bundle/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="bundle-editor/[id]" options={{ presentation: "card", headerShown: false }} />
                    <Stack.Screen name="client-detail/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="checkout/index" options={{ presentation: "card" }} />
                    <Stack.Screen name="checkout/confirmation" options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "fade" }} />
                    <Stack.Screen name="messages/index" options={{ presentation: "card", headerShown: false }} />
                    <Stack.Screen name="messages/[id]" options={{ presentation: "card", headerShown: false }} />
                    <Stack.Screen name="trainer/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="browse/index" options={{ presentation: "card" }} />
                    <Stack.Screen name="activity/index" options={{ presentation: "card" }} />
                    <Stack.Screen name="discover-bundles/index" options={{ presentation: "card" }} />
                    <Stack.Screen name="my-trainers/index" options={{ presentation: "card", headerShown: false }} />
                    <Stack.Screen name="my-trainers/find" options={{ presentation: "card", headerShown: false }} />
                    <Stack.Screen name="profile/index" options={{ presentation: "card", headerShown: false }} />
                    <Stack.Screen name="invite/[token]" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="conversation/[id]" options={{ presentation: "card", headerShown: false }} />
                    <Stack.Screen name="new-message" options={{ presentation: "card" }} />
                    <Stack.Screen name="template-editor/[id]" options={{ presentation: "card", headerShown: false }} />
                    <Stack.Screen name="(trainer)" options={{ headerShown: false }} />
                    <Stack.Screen name="(client)" options={{ headerShown: false }} />
                    <Stack.Screen name="(manager)" options={{ headerShown: false }} />
                    <Stack.Screen name="(coordinator)" options={{ headerShown: false }} />
                    <Stack.Screen name="oauth/callback" />
                      </Stack>
                      <StatusBar style="auto" />
                    </View>
                  </View>
                </OfflineProvider>
                </BadgeProvider>
              </CartProvider>
            </NotificationProvider>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
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
