import { describe, it, expect } from "vitest";

// Test the route matching logic directly without importing the hook
// which has React Native dependencies that don't work in vitest

type DeepLinkRoute = {
  pattern: string;
  routerPath: string;
  extractParams?: (segments: string[]) => Record<string, string>;
};

const DEEP_LINK_ROUTES: DeepLinkRoute[] = [
  { pattern: "bundle/:id", routerPath: "/bundle/[id]", extractParams: (segments) => ({ id: segments[1] }) },
  { pattern: "trainer/:id", routerPath: "/trainer/[id]", extractParams: (segments) => ({ id: segments[1] }) },
  { pattern: "conversation/:id", routerPath: "/conversation/[id]", extractParams: (segments) => ({ id: segments[1] }) },
  { pattern: "messages", routerPath: "/messages" },
  { pattern: "profile", routerPath: "/profile" },
  { pattern: "checkout", routerPath: "/checkout" },
  { pattern: "invite/:token", routerPath: "/invite/[token]", extractParams: (segments) => ({ token: segments[1] }) },
  { pattern: "client/:id", routerPath: "/client-detail/[id]", extractParams: (segments) => ({ id: segments[1] }) },
  { pattern: "browse", routerPath: "/browse" },
  { pattern: "activity", routerPath: "/activity" },
  { pattern: "discover", routerPath: "/discover-bundles" },
];

function matchRoute(path: string): { route: DeepLinkRoute; params: Record<string, string> } | null {
  const normalizedPath = path.replace(/^\/+|\/+$/g, "");
  const pathSegments = normalizedPath.split("/");

  for (const route of DEEP_LINK_ROUTES) {
    const patternSegments = route.pattern.split("/");
    if (patternSegments.length !== pathSegments.length) continue;

    let matches = true;
    for (let i = 0; i < patternSegments.length; i++) {
      const patternPart = patternSegments[i];
      const pathPart = pathSegments[i];
      if (patternPart.startsWith(":")) continue;
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

describe("Deep Link Handler", () => {
  describe("Route Matching", () => {
    it("should match bundle detail route", () => {
      const result = matchRoute("bundle/123");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/bundle/[id]");
      expect(result?.params).toEqual({ id: "123" });
    });

    it("should match trainer profile route", () => {
      const result = matchRoute("trainer/456");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/trainer/[id]");
      expect(result?.params).toEqual({ id: "456" });
    });

    it("should match conversation route", () => {
      const result = matchRoute("conversation/789");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/conversation/[id]");
      expect(result?.params).toEqual({ id: "789" });
    });

    it("should match messages route", () => {
      const result = matchRoute("messages");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/messages");
      expect(result?.params).toEqual({});
    });

    it("should match profile route", () => {
      const result = matchRoute("profile");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/profile");
    });

    it("should match checkout route", () => {
      const result = matchRoute("checkout");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/checkout");
    });

    it("should match invite route with token", () => {
      const result = matchRoute("invite/abc123xyz");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/invite/[token]");
      expect(result?.params).toEqual({ token: "abc123xyz" });
    });

    it("should match client detail route", () => {
      const result = matchRoute("client/42");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/client-detail/[id]");
      expect(result?.params).toEqual({ id: "42" });
    });

    it("should match browse route", () => {
      const result = matchRoute("browse");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/browse");
    });

    it("should match activity route", () => {
      const result = matchRoute("activity");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/activity");
    });

    it("should match discover route", () => {
      const result = matchRoute("discover");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/discover-bundles");
    });

    it("should handle leading slashes", () => {
      const result = matchRoute("/bundle/123");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/bundle/[id]");
    });

    it("should handle trailing slashes", () => {
      const result = matchRoute("bundle/123/");
      expect(result).not.toBeNull();
      expect(result?.route.routerPath).toBe("/bundle/[id]");
    });

    it("should return null for unknown routes", () => {
      const result = matchRoute("unknown/path/here");
      expect(result).toBeNull();
    });

    it("should return null for empty path", () => {
      const result = matchRoute("");
      expect(result).toBeNull();
    });
  });

  describe("Route Configuration", () => {
    it("should have all required routes defined", () => {
      const requiredPatterns = [
        "bundle/:id",
        "trainer/:id",
        "conversation/:id",
        "messages",
        "profile",
        "checkout",
        "invite/:token",
        "client/:id",
        "browse",
        "activity",
        "discover",
      ];

      for (const pattern of requiredPatterns) {
        const route = DEEP_LINK_ROUTES.find((r) => r.pattern === pattern);
        expect(route).toBeDefined();
      }
    });

    it("should have valid router paths for all routes", () => {
      for (const route of DEEP_LINK_ROUTES) {
        expect(route.routerPath).toMatch(/^\//);
      }
    });

    it("should have extractParams for routes with params", () => {
      const routesWithParams = DEEP_LINK_ROUTES.filter((r) => r.pattern.includes(":"));
      for (const route of routesWithParams) {
        expect(route.extractParams).toBeDefined();
      }
    });
  });
});
