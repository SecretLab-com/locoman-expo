import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { AuthProvider } from "@/contexts/auth-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { CartProvider } from "@/contexts/cart-context";
import { OfflineProvider } from "@/contexts/offline-context";
import { OfflineIndicator } from "@/components/offline-indicator";
import { ImpersonationBanner } from "@/components/impersonation-banner";
import { ProfileFAB } from "@/components/profile-fab";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

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
                <OfflineProvider>
                  <View style={{ flex: 1 }}>
                    <ImpersonationBanner />
                    <View style={{ flex: 1 }}>
                      <ProfileFAB />
                      <OfflineIndicator />
                      {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
                      {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
                      {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
                      <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="login" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="register" options={{ presentation: "fullScreenModal" }} />
                    <Stack.Screen name="bundle/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="bundle-editor/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="client-detail/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="checkout/index" options={{ presentation: "card" }} />
                    <Stack.Screen name="checkout/confirmation" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
                    <Stack.Screen name="messages/index" options={{ presentation: "card" }} />
                    <Stack.Screen name="messages/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="trainer/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="browse/index" options={{ presentation: "card" }} />
                    <Stack.Screen name="invite/[token]" options={{ presentation: "fullScreenModal" }} />
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
