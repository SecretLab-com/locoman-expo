import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { Platform, Linking } from 'react-native';
import { trpc } from '@/lib/trpc';
// Token refresh threshold - refresh if token expires within 7 days
const TOKEN_REFRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Helper to decode JWT without external dependency
function decodeJwt(token: string): { exp?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (error) {
    console.error('[Auth] Failed to decode JWT:', error);
    return null;
  }
}

// Helper to check if token needs refresh
function shouldRefreshToken(token: string | null): boolean {
  if (!token) return false;
  
  try {
    const decoded = decodeJwt(token);
    if (!decoded?.exp) return false;
    
    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const timeUntilExpiry = expirationTime - Date.now();
    
    // Refresh if token expires within threshold
    return timeUntilExpiry > 0 && timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS;
  } catch (error) {
    console.error('[Auth] Failed to decode token for refresh check:', error);
    return false;
  }
}

// Helper to check if token is expired
function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  
  try {
    const decoded = decodeJwt(token);
    if (!decoded?.exp) return false;
    
    return decoded.exp * 1000 < Date.now();
  } catch (error) {
    console.error('[Auth] Failed to decode token for expiry check:', error);
    return true;
  }
}

// User type matching the server
export interface User {
  id: number;
  openId: string;
  name: string;
  email: string | null;
  avatar: string | null;
  photoUrl: string | null;
  role: 'shopper' | 'client' | 'trainer' | 'manager' | 'coordinator';
  status: string;
  createdAt: Date;
}

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<User['role'], number> = {
  shopper: 0,
  client: 1,
  trainer: 2,
  manager: 3,
  coordinator: 4,
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetch: () => void;
  // Role helpers
  hasRole: (role: User['role']) => boolean;
  hasMinRole: (minRole: User['role']) => boolean;
  isAdmin: boolean;
  isTrainer: boolean;
  isClient: boolean;
  isShopper: boolean;
  // Navigation helpers
  getHomeRoute: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/login', '/catalog', '/shop', '/trainer-directory', '/invite'];

// Role-based route prefixes
const ROLE_ROUTES: Record<User['role'], string> = {
  coordinator: '/manager',
  manager: '/manager',
  trainer: '/trainer',
  client: '/client',
  shopper: '/',
};

// Get the main app URL based on current environment
function getMainAppUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const currentUrl = new URL(window.location.href);
    const hostname = currentUrl.hostname;
    const pathname = currentUrl.pathname;
    
    // If we're being served through the /expo-app proxy (same origin as main app),
    // use the same origin - this is the key for cookie sharing!
    if (pathname.startsWith('/expo-app')) {
      return currentUrl.origin;
    }
    
    // Handle Manus sandbox URLs (format: port-xxx.us2.manus.computer)
    // e.g., 8082-xxx.us2.manus.computer -> 3000-xxx.us2.manus.computer
    if (hostname.includes('.manus.computer')) {
      // If we're already on the 3000 port (main app), use same origin
      if (hostname.startsWith('3000-')) {
        return currentUrl.origin;
      }
      // Replace the port prefix in the subdomain
      const newHostname = hostname.replace(/^8082-/, '3000-');
      return `${currentUrl.protocol}//${newHostname}`;
    }
    
    // If we're on the main app's /expo route (iframe), use the parent origin
    if (pathname.includes('/expo') || currentUrl.port === '3000') {
      return currentUrl.origin;
    }
    
    // If we're on the expo dev server directly (port 8082), construct the main app URL
    if (currentUrl.port === '8082') {
      // Replace port 8082 with 3000
      return currentUrl.origin.replace(':8082', ':3000');
    }
    
    // Default: try to use the same origin
    return currentUrl.origin;
  }
  
  // For native apps, use the configured API URL
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [tokenReceived, setTokenReceived] = useState(false);
  
  // Track if we've already received a token to avoid duplicate processing
  const tokenReceivedRef = useRef(false);
  
  // Listen for session token from URL hash or parent window (when in iframe)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setTokenReceived(true);
      return;
    }
    
    // First, check for token in URL hash (passed by parent page)
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      const tokenMatch = hash.match(/token=([^&]+)/);
      if (tokenMatch && tokenMatch[1]) {
        const token = decodeURIComponent(tokenMatch[1]);
        console.log('[Auth] Found token in URL hash, length:', token.length);
        tokenReceivedRef.current = true;
        
        // Store the token for tRPC to use
        if (window.localStorage) {
          window.localStorage.setItem('locomotivate_auth_token', token);
          console.log('[Auth] Token stored in localStorage from URL hash');
        }
        
        // Clear the hash from URL to avoid exposing the token
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        
        // Small delay to ensure localStorage is written before queries run
        setTimeout(() => {
          setSessionToken(token);
          setTokenReceived(true);
        }, 50);
        return;
      }
    }
    
    const isInIframe = window.self !== window.top;
    console.log('[Auth] In iframe:', isInIframe);
    
    if (!isInIframe) {
      // Not in iframe, check if we have a stored token
      const storedToken = window.localStorage?.getItem('locomotivate_auth_token');
      if (storedToken) {
        console.log('[Auth] Found stored token in localStorage, using it');
        tokenReceivedRef.current = true;
        // Set token and enable query immediately - no delay needed since token is already in localStorage
        setSessionToken(storedToken);
        setTokenReceived(true);
      } else {
        console.log('[Auth] No stored token found, continuing without auth');
        setTokenReceived(true);
      }
      return;
    }
    
    const handleMessage = (event: MessageEvent) => {
      // Avoid processing duplicate messages
      if (tokenReceivedRef.current) return;
      
      if (event.data && event.data.type === 'sessionToken' && event.data.token) {
        console.log('[Auth] Received session token from parent window, length:', event.data.token.length);
        tokenReceivedRef.current = true;
        
        // Store the token FIRST, then update state
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('locomotivate_auth_token', event.data.token);
          console.log('[Auth] Token stored in localStorage');
        }
        
        // Small delay to ensure localStorage is written before queries run
        setTimeout(() => {
          setSessionToken(event.data.token);
          setTokenReceived(true);
        }, 50);
      }
    };
    
    window.addEventListener('message', handleMessage);
    console.log('[Auth] Message listener added');
    
    // Request token from parent
    try {
      console.log('[Auth] Requesting token from parent');
      window.parent.postMessage({ type: 'requestToken' }, '*');
    } catch (e) {
      console.log('[Auth] Failed to request token from parent:', e);
    }
    
    // Set a timeout in case no token is received - use ref to avoid stale closure
    const timeout = setTimeout(() => {
      if (!tokenReceivedRef.current) {
        console.log('[Auth] No token received from parent after timeout, continuing without auth');
        tokenReceivedRef.current = true;
        setTokenReceived(true);
      }
    }, 3000);
    
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, []);

  // Fetch current user - uses token-based auth (token received from parent window via postMessage)
  const { 
    data: user, 
    refetch, 
    isLoading: isQueryLoading,
    error,
    status,
    fetchStatus,
  } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    // Only enable the query after we've received the token (or timed out)
    enabled: tokenReceived,
  });
  
  // Debug logging
  useEffect(() => {
    console.log('[Auth] Query state:', { tokenReceived, status, fetchStatus, hasUser: !!user, error: error?.message });
  }, [tokenReceived, status, fetchStatus, user, error]);
  
  // Get the query client for invalidation
  const utils = trpc.useUtils();
  
  // Refetch when session token changes
  useEffect(() => {
    if (sessionToken && tokenReceived) {
      console.log('[Auth] Token received, invalidating and refetching user data');
      // Invalidate all queries to force refetch with new token
      utils.invalidate();
    }
  }, [sessionToken, tokenReceived, utils]);

  // Logout mutation
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // Clear any local storage
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.removeItem('manus-runtime-user-info');
      }
    },
  });

  // Token refresh mutation
  const refreshTokenMutation = trpc.auth.refreshToken.useMutation({
    onSuccess: (data) => {
      if (data.token && Platform.OS === 'web' && typeof window !== 'undefined') {
        // Store the new token
        window.localStorage.setItem('locomotivate_auth_token', data.token);
        setSessionToken(data.token);
        console.log('[Auth] Token refreshed successfully');
      }
    },
    onError: (error) => {
      console.error('[Auth] Token refresh failed:', error);
      // If refresh fails, the token might be invalid - clear it and log out
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.removeItem('locomotivate_auth_token');
      }
      setSessionToken(null);
    },
  });

  // Check token expiration and refresh if needed
  useEffect(() => {
    if (!sessionToken || !user) return;

    // Check if token is expired
    if (isTokenExpired(sessionToken)) {
      console.log('[Auth] Token is expired, clearing session');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.removeItem('locomotivate_auth_token');
      }
      setSessionToken(null);
      return;
    }

    // Check if token needs refresh
    if (shouldRefreshToken(sessionToken)) {
      console.log('[Auth] Token is expiring soon, refreshing...');
      refreshTokenMutation.mutate();
    }
  }, [sessionToken, user]);

  // Check if route is public
  const isPublicRoute = useMemo(() => {
    if (!pathname) return true;
    return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
  }, [pathname]);

  // Handle login - redirect to Manus OAuth portal
  const login = useCallback(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const mainAppUrl = getMainAppUrl();
      
      // Use the same OAuth flow as the main app
      // These values should match the main app's environment
      const oauthPortalUrl = 'https://login.manus.im';
      const appId = process.env.EXPO_PUBLIC_APP_ID || 'locomotivate';
      
      // The callback URL should be on the main app (port 3000)
      // Include returnTo=expo so the OAuth callback redirects back to /expo after login
      const redirectUri = `${mainAppUrl}/api/oauth/callback?returnTo=expo`;
      const state = btoa(redirectUri);
      
      // Construct the OAuth URL
      const url = new URL(`${oauthPortalUrl}/app-auth`);
      url.searchParams.set('appId', appId);
      url.searchParams.set('redirectUri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('type', 'signIn');
      
      const loginUrl = url.toString();
      console.log('Login redirect URL:', loginUrl);
      
      // Check if we're in an iframe
      const isInIframe = window.self !== window.top;
      
      if (isInIframe) {
        // Try postMessage first (most reliable for iframe communication)
        try {
          window.parent.postMessage({ type: 'navigate', url: loginUrl }, '*');
          return;
        } catch (e) {
          console.log('postMessage failed, trying direct navigation');
        }
        
        // Fallback: try to navigate the parent directly
        try {
          if (window.top) {
            window.top.location.href = loginUrl;
            return;
          }
        } catch (e) {
          console.log('top navigation failed, trying current window');
        }
      }
      
      // Not in iframe or fallback: navigate current window
      window.location.href = loginUrl;
    } else {
      // For native apps, use Linking to open the OAuth URL
      const mainAppUrl = getMainAppUrl();
      const oauthPortalUrl = 'https://login.manus.im';
      const appId = process.env.EXPO_PUBLIC_APP_ID || 'locomotivate';
      // Include returnTo=expo so the OAuth callback redirects back to /expo after login
      const redirectUri = `${mainAppUrl}/api/oauth/callback?returnTo=expo`;
      const state = btoa(redirectUri);
      
      const url = new URL(`${oauthPortalUrl}/app-auth`);
      url.searchParams.set('appId', appId);
      url.searchParams.set('redirectUri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('type', 'signIn');
      
      Linking.openURL(url.toString());
    }
  }, []);

  // Handle logout - clears both server session and local token
  const logout = useCallback(async () => {
    try {
      // Clear the stored token from localStorage FIRST
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.localStorage.removeItem('locomotivate_auth_token');
        window.localStorage.removeItem('manus-runtime-user-info');
        console.log('[Auth] Cleared stored tokens from localStorage');
      }
      
      // Reset the token state
      setSessionToken(null);
      tokenReceivedRef.current = false;
      
      // Call the server logout endpoint to invalidate the session
      await logoutMutation.mutateAsync();
      
      // Invalidate all cached queries
      utils.invalidate();
      
      console.log('[Auth] Logout successful');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if server logout fails, we've already cleared local state
    } finally {
      // Navigate to home after logout
      router.replace('/');
    }
  }, [logoutMutation, router, utils]);

  // Role checking helpers
  const hasRole = useCallback((role: User['role']) => {
    return user?.role === role;
  }, [user]);

  const hasMinRole = useCallback((minRole: User['role']) => {
    if (!user) return false;
    return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minRole];
  }, [user]);

  // Computed role flags
  const isAdmin = useMemo(() => hasMinRole('manager'), [hasMinRole]);
  const isTrainer = useMemo(() => hasRole('trainer') || hasMinRole('manager'), [hasRole, hasMinRole]);
  const isClient = useMemo(() => hasRole('client') || hasMinRole('trainer'), [hasRole, hasMinRole]);
  const isShopper = useMemo(() => hasRole('shopper') || !user, [hasRole, user]);

  // Get home route based on role
  const getHomeRoute = useCallback(() => {
    if (!user) return '/';
    return ROLE_ROUTES[user.role] || '/';
  }, [user]);

  // Initialize auth state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Handle route protection
  useEffect(() => {
    if (isInitializing || isQueryLoading) return;

    const inTabsGroup = segments[0] === '(tabs)';
    
    // If not authenticated and trying to access protected route, redirect to home
    if (!user && !isPublicRoute && inTabsGroup) {
      const routeRole = segments[1]; // e.g., 'manager', 'trainer', 'client'
      if (routeRole === 'manager' || routeRole === 'trainer' || routeRole === 'client') {
        router.replace('/');
        return;
      }
    }

    // Role-based route protection
    if (user && inTabsGroup) {
      const routeRole = segments[1];
      
      // Check if user is trying to access a role-specific route they don't have access to
      if (routeRole === 'manager' && !isAdmin) {
        router.replace(getHomeRoute() as any);
      } else if (routeRole === 'trainer' && !isTrainer) {
        router.replace(getHomeRoute() as any);
      } else if (routeRole === 'client' && user.role === 'shopper') {
        router.replace(getHomeRoute() as any);
      }
    }
  }, [user, segments, pathname, isInitializing, isQueryLoading, isPublicRoute, isAdmin, isTrainer, getHomeRoute, router]);

  const isLoading = isInitializing || isQueryLoading || !tokenReceived;

  const value: AuthContextType = {
    user: user || null,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refetch,
    hasRole,
    hasMinRole,
    isAdmin,
    isTrainer,
    isClient,
    isShopper,
    getHomeRoute,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for checking if user can access a specific role's features
export function useRoleAccess(requiredRole: User['role']) {
  const { user, hasMinRole } = useAuth();
  
  return useMemo(() => ({
    hasAccess: hasMinRole(requiredRole),
    currentRole: user?.role,
    requiredRole,
  }), [user, hasMinRole, requiredRole]);
}

export default AuthContext;
