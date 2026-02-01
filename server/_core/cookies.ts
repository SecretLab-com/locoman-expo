import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");

  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}

/**
 * Extract parent domain for cookie sharing across subdomains.
 * 
 * Manus preview domain structure:
 * - Metro: 8081-sandboxid-hash.region.manus.computer
 * - API: 3000-sandboxid-hash.region.manus.computer
 * 
 * The cookie domain should be ".region.manus.computer" to allow sharing
 * between the 8081 and 3000 subdomains.
 * 
 * For other domains like "3000-xxx.manuspre.computer", use ".manuspre.computer"
 */
function getParentDomain(hostname: string): string | undefined {
  // Don't set domain for localhost or IP addresses
  if (LOCAL_HOSTS.has(hostname) || isIpAddress(hostname)) {
    return undefined;
  }

  // Split hostname into parts
  const parts = hostname.split(".");

  // Need at least 3 parts for a subdomain
  if (parts.length < 3) {
    return undefined;
  }

  // Check for Manus preview pattern: PORT-sandboxid-hash.region.manus.computer
  // This has 4 parts after splitting: [PORT-sandboxid-hash, region, manus, computer]
  // We need to return ".region.manus.computer" (last 3 parts)
  if (parts.length >= 4 && parts[parts.length - 1] === "computer" && parts[parts.length - 2] === "manus") {
    // Return last 3 parts: .region.manus.computer
    return "." + parts.slice(-3).join(".");
  }

  // For other domains, use last 2 parts (e.g., ".manuspre.computer")
  return "." + parts.slice(-2).join(".");
}

export function getSessionCookieOptions(
  req: Request,
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const hostname = req.hostname;
  const domain = getParentDomain(hostname);
  const secure = isSecureRequest(req);
  const sameSite = secure ? "none" : "lax";

  console.log("[Cookies] getSessionCookieOptions:", { hostname, domain });

  return {
    domain,
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
  };
}
