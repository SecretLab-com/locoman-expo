import { useEffect, useCallback } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { Platform } from "react-native";

/**
 * Deep link route mapping configuration.
 * Maps URL paths to Expo Router paths with optional parameter extraction.
 */
type DeepLinkRoute = {
  /** Pattern to match (supports :param placeholders) */
  pattern: string;
  /** Expo Router path to navigate to */
  routerPath: string;
  /** Function to extract params from URL path segments */
  extractParams?: (segments: string[]) => Record<string, string>;
};

/**
 * Define supported deep link routes.
 * Add new routes here as the app grows.
 */
const DEEP_LINK_ROUTES: DeepLinkRoute[] = [
  // Bundle detail: /bundle/123 -> /bundle/[id]
  {
    pattern: "bundle/:id",
    routerPath: "/bundle/[id]",
    extractParams: (segments) => ({ id: segments[1] }),
  },
  // Trainer profile: /trainer/123 -> /trainer/[id]
  {
    pattern: "trainer/:id",
    routerPath: "/trainer/[id]",
    extractParams: (segments) => ({ id: segments[1] }),
  },
  // Conversation: /conversation/123 -> /conversation/[id]
  {
    pattern: "conversation/:id",
    routerPath: "/conversation/[id]",
    extractParams: (segments) => ({ id: segments[1] }),
  },
  // Messages list: /messages -> /messages
  {
    pattern: "messages",
    routerPath: "/messages",
  },
  // Profile: /profile -> /profile
  {
    pattern: "profile",
    routerPath: "/profile",
  },
  // Checkout: /checkout -> /checkout
  {
    pattern: "checkout",
    routerPath: "/checkout",
  },
  // Invite: /invite/abc123 -> /invite/[token]
  {
    pattern: "invite/:token",
    routerPath: "/invite/[token]",
    extractParams: (segments) => ({ token: segments[1] }),
  },
  // Client detail: /client/123 -> /client-detail/[id]
  {
    pattern: "client/:id",
    routerPath: "/client-detail/[id]",
    extractParams: (segments) => ({ id: segments[1] }),
  },
  // Browse products: /browse -> /browse
  {
    pattern: "browse",
    routerPath: "/browse",
  },
  // Activity: /activity -> /activity
  {
    pattern: "activity",
    routerPath: "/activity",
  },
  // Discover bundles: /discover -> /discover-bundles
  {
    pattern: "discover",
    routerPath: "/discover-bundles",
  },
];

/**
 * Match a URL path against defined routes and return the matching route with params.
 */
function matchRoute(path: string): { route: DeepLinkRoute; params: Record<string, string> } | null {
  // Normalize path: remove leading/trailing slashes
  const normalizedPath = path.replace(/^\/+|\/+$/g, "");
  const pathSegments = normalizedPath.split("/");

  for (const route of DEEP_LINK_ROUTES) {
    const patternSegments = route.pattern.split("/");

    // Quick length check (patterns with params can match different lengths)
    if (patternSegments.length !== pathSegments.length) continue;

    let matches = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const patternPart = patternSegments[i];
      const pathPart = pathSegments[i];

      // Skip param placeholders (they match anything)
      if (patternPart.startsWith(":")) continue;

      // Exact match required for non-param segments
      if (patternPart !== pathPart) {
        matches = false;
        break;
      }
    }

    if (matches) {
      const params = route.extractParams ? route.extractParams(pathSegments) : {};
      return { route, params };
    }
  }

  return null;
}

/**
 * Handle a deep link URL by navigating to the appropriate screen.
 */
function handleDeepLink(url: string): boolean {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path;

    if (!path) {
      console.log("[DeepLink] No path in URL:", url);
      return false;
    }

    const match = matchRoute(path);
    if (!match) {
      console.log("[DeepLink] No matching route for path:", path);
      return false;
    }

    console.log("[DeepLink] Navigating to:", match.route.routerPath, "with params:", match.params);

    // Navigate to the matched route
    router.push({
      pathname: match.route.routerPath as any,
      params: match.params,
    });

    return true;
  } catch (error) {
    console.error("[DeepLink] Error handling deep link:", error);
    return false;
  }
}

/**
 * Hook to handle incoming deep links.
 * Automatically handles:
 * - Initial URL when app is launched from a deep link
 * - URL events when app is already open and receives a deep link
 * 
 * Usage:
 * ```tsx
 * // In your root layout or main component
 * useDeepLink();
 * ```
 */
export function useDeepLink() {
  const handleUrl = useCallback((event: { url: string }) => {
    handleDeepLink(event.url);
  }, []);

  useEffect(() => {
    // Handle initial URL (app launched from deep link)
    const checkInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log("[DeepLink] Initial URL:", initialUrl);
        handleDeepLink(initialUrl);
      }
    };

    // Only check initial URL on native platforms
    // On web, the URL is already in the browser address bar
    if (Platform.OS !== "web") {
      checkInitialUrl();
    }

    // Listen for URL events (app already open)
    const subscription = Linking.addEventListener("url", handleUrl);

    return () => {
      subscription.remove();
    };
  }, [handleUrl]);
}

/**
 * Create a deep link URL for the app.
 * 
 * Usage:
 * ```tsx
 * const url = createDeepLink("bundle/123");
 * // Returns: manus20260125130603://bundle/123
 * ```
 */
export function createDeepLink(path: string, queryParams?: Record<string, string>): string {
  return Linking.createURL(path, { queryParams });
}

/**
 * Parse a deep link URL.
 */
export function parseDeepLink(url: string) {
  return Linking.parse(url);
}

/**
 * Handle a deep link from a push notification.
 * This is a convenience wrapper that handles both full URLs and path-only strings.
 * 
 * @param deepLinkOrPath - Either a full deep link URL or just the path (e.g., "bundle/123")
 * @returns true if navigation was successful, false otherwise
 */
export function handleNotificationDeepLink(deepLinkOrPath: string): boolean {
  // If it looks like a full URL (has scheme), use handleDeepLink directly
  if (deepLinkOrPath.includes("://")) {
    return handleDeepLink(deepLinkOrPath);
  }
  
  // Otherwise, treat it as a path and try to match directly
  const match = matchRoute(deepLinkOrPath);
  if (!match) {
    console.log("[DeepLink] No matching route for notification path:", deepLinkOrPath);
    return false;
  }

  console.log("[DeepLink] Navigating from notification to:", match.route.routerPath, "with params:", match.params);

  router.push({
    pathname: match.route.routerPath as any,
    params: match.params,
  });

  return true;
}

export { handleDeepLink, matchRoute, DEEP_LINK_ROUTES };
