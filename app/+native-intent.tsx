/**
 * Normalizes incoming native deep links before Expo Router tries to match routes.
 * This ensures bare app opens like `locomotivate:///` resolve to `/`.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const raw = (path || "").trim();
    if (!raw || raw === "/") return "/";

    if (!raw.includes("://")) {
      return raw.startsWith("/") ? raw : `/${raw}`;
    }

    const url = new URL(raw);
    const segments: string[] = [];

    if (url.hostname) segments.push(url.hostname);
    if (url.pathname && url.pathname !== "/") {
      segments.push(url.pathname.replace(/^\/+/, ""));
    }

    const basePath = segments.length > 0 ? `/${segments.join("/")}` : "/";
    return `${basePath}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

