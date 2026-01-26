import { useEffect, useState } from 'react';
import { useColorScheme, View, Text as RNText } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { TamaguiProvider, Theme } from 'tamagui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, createTRPCClient, createQueryClient } from '@/lib/trpc';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import config from '../tamagui.config';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [queryClient] = useState(() => createQueryClient());
  const [trpcClient] = useState(() => createTRPCClient());
  const [error, setError] = useState<string | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    Inter: require('@tamagui/font-inter/otf/Inter-Regular.otf'),
    InterMedium: require('@tamagui/font-inter/otf/Inter-Medium.otf'),
    InterSemiBold: require('@tamagui/font-inter/otf/Inter-SemiBold.otf'),
    InterBold: require('@tamagui/font-inter/otf/Inter-Bold.otf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Show loading state while fonts load
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <RNText>Loading fonts...</RNText>
      </View>
    );
  }

  // Show font error if any
  if (fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <RNText>Font Error: {fontError.message}</RNText>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <TamaguiProvider config={config} defaultTheme={colorScheme || 'light'}>
            <Theme name={colorScheme || 'light'}>
              <SafeAreaProvider>
                <ToastProvider>
                  <AuthProvider>
                    <CartProvider>
                      <ThemeProvider>
                        <Stack
                    screenOptions={{
                      headerShown: false,
                    }}
                  >
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="login" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="cart" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="shop/bundles/[id]" />
                    <Stack.Screen name="trainer/bundles/new" />
                    <Stack.Screen name="trainer/bundles/[id]/index" />
                    <Stack.Screen name="trainer/bundles/[id]/edit" />
                    <Stack.Screen name="+not-found" />
                    </Stack>
                        <StatusBar style="auto" />
                      </ThemeProvider>
                    </CartProvider>
                  </AuthProvider>
                </ToastProvider>
              </SafeAreaProvider>
            </Theme>
          </TamaguiProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );
}
