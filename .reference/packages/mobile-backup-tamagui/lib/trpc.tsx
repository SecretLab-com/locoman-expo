import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import superjson from 'superjson';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useState, ReactNode } from 'react';

// Import the AppRouter type from the server
// This should be the same type exported from your Express server
// In monorepo, we use a type-only import that will be resolved at build time
// For now, we define a placeholder type that matches the server's AppRouter
type AppRouter = any; // TODO: Set up proper type sharing in monorepo

// Create the tRPC React hooks
export const trpc = createTRPCReact<AppRouter>();

// Get the API URL - always point to the main app server
const getBaseUrl = (): string => {
  // Check for environment variable first
  const apiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (apiUrl) return apiUrl;
  
  // For web, we need to construct the main app URL
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const currentUrl = new URL(window.location.href);
    const hostname = currentUrl.hostname;
    const pathname = currentUrl.pathname;
    
    // If we're being served through the /expo-app proxy (same origin as main app),
    // use the same origin for API calls - this ensures cookies are shared!
    if (pathname.startsWith('/expo-app')) {
      // We're proxied through the main app, use same origin
      return currentUrl.origin;
    }
    
    // Handle Manus sandbox URLs (format: port-xxx.us2.manus.computer)
    // e.g., 8082-xxx.us2.manus.computer -> 3000-xxx.us2.manus.computer
    if (hostname.includes('.manus.computer')) {
      // If we're on the 3000 port (main app), use same origin
      if (hostname.startsWith('3000-')) {
        return currentUrl.origin;
      }
      // Replace the port prefix in the subdomain (8082 -> 3000)
      const newHostname = hostname.replace(/^8082-/, '3000-');
      return `${currentUrl.protocol}//${newHostname}`;
    }
    
    // If we're on the main app's /expo route (iframe), use the same origin
    if (pathname.includes('/expo') || currentUrl.port === '3000') {
      return currentUrl.origin;
    }
    
    // If we're on the expo dev server directly (port 8082), construct the main app URL
    if (currentUrl.port === '8082') {
      return currentUrl.origin.replace(':8082', ':3000');
    }
    
    // If we're on localhost without a port, assume main app is on 3000
    if (hostname === 'localhost' && !currentUrl.port) {
      return 'http://localhost:3000';
    }
    
    // Default: use same origin (might be production deployment)
    return currentUrl.origin;
  }
  
  // For iOS simulator, use localhost
  if (Platform.OS === 'ios') {
    return 'http://localhost:3000';
  }
  
  // For Android emulator, use 10.0.2.2 (special alias for host machine)
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  
  // Default fallback
  return 'http://localhost:3000';
};

// Token storage helpers with platform-specific implementations
const TOKEN_KEY = 'locomotivate_auth_token';
const REFRESH_TOKEN_KEY = 'locomotivate_refresh_token';

// In-memory fallback for web
let memoryToken: string | null = null;
let memoryRefreshToken: string | null = null;

export const getStoredToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(TOKEN_KEY);
      }
      return memoryToken;
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.warn('Error getting stored token:', error);
    return memoryToken;
  }
};

export const setStoredToken = async (token: string): Promise<void> => {
  try {
    memoryToken = token;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TOKEN_KEY, token);
      }
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  } catch (error) {
    console.warn('Error storing token:', error);
  }
};

export const removeStoredToken = async (): Promise<void> => {
  try {
    memoryToken = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(TOKEN_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch (error) {
    console.warn('Error removing token:', error);
  }
};

export const getStoredRefreshToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(REFRESH_TOKEN_KEY);
      }
      return memoryRefreshToken;
    }
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.warn('Error getting refresh token:', error);
    return memoryRefreshToken;
  }
};

export const setStoredRefreshToken = async (token: string): Promise<void> => {
  try {
    memoryRefreshToken = token;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
      }
    } else {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    }
  } catch (error) {
    console.warn('Error storing refresh token:', error);
  }
};

export const removeStoredRefreshToken = async (): Promise<void> => {
  try {
    memoryRefreshToken = null;
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    console.warn('Error removing refresh token:', error);
  }
};

// Clear all auth data
export const clearAuthStorage = async (): Promise<void> => {
  await Promise.all([
    removeStoredToken(),
    removeStoredRefreshToken(),
  ]);
};

// Create the tRPC client
// Note: The URL is calculated at runtime in the custom fetch function
export const createTRPCClient = () => {
  // Use a placeholder URL - the actual URL is calculated in the custom fetch
  const placeholderUrl = '/api/trpc';
  
  return trpc.createClient({
    links: [
      // Logger link for development
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === 'development' ||
          (opts.direction === 'down' && opts.result instanceof Error),
      }),
      httpBatchLink({
        url: placeholderUrl,
        transformer: superjson,
        async headers() {
          const token = await getStoredToken();
          console.log('[tRPC] headers() called, token:', token ? `Yes (${token.length} chars)` : 'No');
          return {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          };
        },
        // Custom fetch that calculates the correct URL at runtime
        // This handles sandbox URL changes and cross-origin requests
        // IMPORTANT: We calculate the URL inline to avoid Metro bundler caching
        fetch(url, options) {
          // Calculate the actual URL at runtime - inline to avoid bundler caching
          let baseUrl = '';
          if (typeof window !== 'undefined' && window.location) {
            const hostname = window.location.hostname;
            if (hostname.includes('.manus.computer')) {
              if (hostname.startsWith('3000-')) {
                baseUrl = window.location.origin;
              } else {
                // Replace port prefix (e.g., 8082- -> 3000-)
                const newHostname = hostname.replace(/^\d+-/, '3000-');
                baseUrl = `${window.location.protocol}//${newHostname}`;
              }
            } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
              baseUrl = 'http://localhost:3000';
            } else {
              baseUrl = window.location.origin;
            }
          } else {
            baseUrl = 'http://localhost:3000';
          }
          
          const urlObj = new URL(url.toString(), 'http://placeholder');
          const actualUrl = `${baseUrl}${urlObj.pathname}${urlObj.search}`;
          console.log('[tRPC] Fetching:', actualUrl);
          
          return fetch(actualUrl, {
            ...options,
            credentials: 'include', // Always include credentials for cookie auth
          });
        },
      }),
    ],
  });
};

// Create query client with default options
export const createQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
        retry: (failureCount, error: any) => {
          // Don't retry on 401/403 errors
          if (error?.data?.httpStatus === 401 || error?.data?.httpStatus === 403) {
            return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: Platform.OS === 'web',
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

// tRPC Provider component
interface TRPCProviderProps {
  children: ReactNode;
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const [queryClient] = useState(() => createQueryClient());
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// Export a lazy getter for the trpcClient to ensure it's created at runtime
// This is needed because the URL is calculated based on window.location
let _trpcClient: ReturnType<typeof createTRPCClient> | null = null;
export const getTrpcClient = () => {
  if (!_trpcClient) {
    _trpcClient = createTRPCClient();
  }
  return _trpcClient;
};

// For backward compatibility, export a getter that creates the client on first access
// Note: This should only be used in contexts where window.location is available
export const trpcClient = new Proxy({} as ReturnType<typeof createTRPCClient>, {
  get(target, prop) {
    return getTrpcClient()[prop as keyof ReturnType<typeof createTRPCClient>];
  }
});

// Export types for use in components
export type { AppRouter };

// Utility hook to get the query client
export const useQueryClient = () => {
  const queryClient = trpc.useUtils();
  return queryClient;
};
