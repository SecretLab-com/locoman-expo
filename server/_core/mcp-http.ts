import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Express, Request, Response } from "express";
import {
  createTrainerAssistantMcpServer,
  runWithTrainerAssistantMcpAuthContext,
} from "../../scripts/mcp-trainer-assistant";
import { logError, logEvent } from "./logger";

const MCP_PATH = "/mcp";
const MCP_KEY_HEADER = "x-loco-mcp-key";

function isFeatureEnabled(): boolean {
  const raw = String(process.env.LOCO_MCP_HTTP_ENABLED || "true")
    .trim()
    .toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off" && raw !== "no";
}

function getBearerToken(req: Request): string {
  const header = String(req.headers.authorization || "").trim();
  if (!header) return "";
  const [scheme, token] = header.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return "";
  return token.trim();
}

function hasValidMcpKey(req: Request, requiredToken: string): boolean {
  if (!requiredToken) return true;
  const headerToken = String(req.headers[MCP_KEY_HEADER] || "").trim();
  return headerToken === requiredToken;
}

function sendJsonRpcError(
  res: Response,
  statusCode: number,
  code: number,
  message: string,
) {
  res.status(statusCode).json({
    jsonrpc: "2.0",
    error: { code, message },
    id: null,
  });
}

export function registerTrainerAssistantMcpHttpRoutes(app: Express) {
  if (!isFeatureEnabled()) {
    logEvent("mcp.http.disabled", { path: MCP_PATH });
    return;
  }

  const requiredToken = String(process.env.LOCO_MCP_AUTH_TOKEN || "").trim();

  app.post(MCP_PATH, async (req, res) => {
    if (!hasValidMcpKey(req, requiredToken)) {
      sendJsonRpcError(res, 401, -32001, "Unauthorized MCP request");
      return;
    }

    let userToken = getBearerToken(req);
    if (!userToken) {
      sendJsonRpcError(
        res,
        401,
        -32002,
        "Missing user bearer token in Authorization header.",
      );
      return;
    }
    const impersonateUserId = String(
      req.headers["x-impersonate-user-id"] || "",
    ).trim();

    // Auto-refresh expired tokens: resolve the user from the token, then mint a fresh one
    try {
      const { resolveSupabaseUserFromToken } = await import("./token-resolver");
      const supabaseUser = await resolveSupabaseUserFromToken(userToken);
      if (!supabaseUser?.email) {
        // Token might be expired — try to mint a fresh one using the Supabase admin API
        // Decode the expired JWT to get the email
        const payload = JSON.parse(Buffer.from(userToken.split(".")[1] || "", "base64").toString("utf8"));
        const email = payload?.email;
        if (email) {
          const { mintSupabaseAccessTokenForEmail } = await import("../routers");
          const freshToken = await mintSupabaseAccessTokenForEmail(email);
          if (freshToken) userToken = freshToken;
        }
      }
    } catch {
      // Continue with original token if refresh fails
    }

    const server = createTrainerAssistantMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      void transport.close().catch((error) => {
        logError("mcp.http.transport_close_failed", error);
      });
      void server.close().catch((error) => {
        logError("mcp.http.server_close_failed", error);
      });
    });

    try {
      await runWithTrainerAssistantMcpAuthContext(
        { authToken: userToken, impersonateUserId },
        async () => {
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
        },
      );
    } catch (error) {
      logError("mcp.http.request_failed", error);
      if (!res.headersSent) {
        sendJsonRpcError(res, 500, -32603, "Internal MCP server error");
      }
    }
  });

  app.get(MCP_PATH, (_req, res) => {
    sendJsonRpcError(res, 405, -32000, "Method not allowed. Use POST /mcp.");
  });

  app.delete(MCP_PATH, (_req, res) => {
    sendJsonRpcError(res, 405, -32000, "Method not allowed. Use POST /mcp.");
  });

  logEvent("mcp.http.enabled", {
    path: MCP_PATH,
    protected: Boolean(requiredToken),
  });
}
