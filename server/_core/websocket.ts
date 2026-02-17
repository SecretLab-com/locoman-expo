import type { IncomingMessage } from "http";
import { Server } from "http";
import { logError, logEvent } from "./logger";
import { resolveSupabaseUserFromToken } from "./token-resolver";

import { WebSocket, WebSocketServer } from "ws";

// Store connected clients by user ID (UUID string)
const clients = new Map<string, Set<WebSocket>>();

// Store typing status by conversation
const typingStatus = new Map<string, Map<string, NodeJS.Timeout>>();

// Server-side anti-spam protection for websocket upgrades/auth.
const RATE_LIMIT_WINDOW_MS = 15_000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;
const RATE_LIMIT_BLOCK_MS = 30_000;
const INVALID_TOKEN_CACHE_TTL_MS = 60_000;

type AttemptBucket = {
  count: number;
  windowStart: number;
  blockedUntil: number;
};

const connectionAttemptsByIp = new Map<string, AttemptBucket>();
const invalidTokenCache = new Map<string, number>();

export type WSMessage =
  | { type: "new_message"; conversationId: string; message: any }
  | { type: "typing_start"; conversationId: string; userId: string; userName: string }
  | { type: "typing_stop"; conversationId: string; userId: string }
  | { type: "message_read"; messageId: string; conversationId: string }
  | { type: "reaction_added"; messageId: string; reaction: string; userId: string }
  | { type: "reaction_removed"; messageId: string; reaction: string; userId: string }
  | { type: "badge_counts_updated" };

/**
 * Verify a Supabase access token and resolve to the app user ID.
 * Returns the public.users.id (UUID) or null if invalid.
 */
async function verifyTokenToUserId(token: string): Promise<string | null> {
  try {
    const supabaseUser = await resolveSupabaseUserFromToken(token);
    if (!supabaseUser) return null;
    const { resolveOrCreateAppUser } = await import("./auth-utils");
    const appUser = await resolveOrCreateAppUser(supabaseUser);
    return appUser?.id ?? null;
  } catch {
    return null;
  }
}

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = connectionAttemptsByIp.get(ip);
  if (!bucket) {
    connectionAttemptsByIp.set(ip, { count: 1, windowStart: now, blockedUntil: 0 });
    return false;
  }
  if (bucket.blockedUntil > now) {
    return true;
  }
  if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    bucket.count = 1;
    bucket.windowStart = now;
    bucket.blockedUntil = 0;
    return false;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_ATTEMPTS) {
    bucket.blockedUntil = now + RATE_LIMIT_BLOCK_MS;
    return true;
  }
  return false;
}

function isTokenRecentlyInvalid(token: string): boolean {
  const now = Date.now();
  const until = invalidTokenCache.get(token);
  if (!until) return false;
  if (until <= now) {
    invalidTokenCache.delete(token);
    return false;
  }
  return true;
}

function markInvalidToken(token: string) {
  invalidTokenCache.set(token, Date.now() + INVALID_TOKEN_CACHE_TTL_MS);
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const impersonateUserId = url.searchParams.get("impersonateUserId");
    const clientIp = getClientIp(req);

    try {
      if (isRateLimited(clientIp)) {
        ws.close(1013, "Rate limited");
        return;
      }

      if (!token) {
        ws.close(4001, "Authentication required");
        return;
      }

      if (isTokenRecentlyInvalid(token)) {
        ws.close(4001, "Invalid token");
        return;
      }

      let userId = await verifyTokenToUserId(token);

      if (!userId) {
        markInvalidToken(token);
        ws.close(4001, "Invalid token");
        return;
      }

      // Support impersonation for coordinators
      if (impersonateUserId) {
        const { getUserById } = await import("../db");
        const realUser = await getUserById(userId);
        if (realUser?.role === "coordinator") {
          const impersonated = await getUserById(impersonateUserId);
          if (impersonated) {
            userId = impersonated.id;
          }
        }
      }

      // Add client to the map
      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId)!.add(ws);

      logEvent("websocket.connected", { userId });

      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          void handleClientMessage(userId, message, ws).catch((error) => {
            logError("websocket.message_failed", error, { userId });
          });
        } catch (e) {
          logError("websocket.parse_failed", e, { userId });
        }
      });

      ws.on("close", () => {
        const userClients = clients.get(userId);
        if (userClients) {
          userClients.delete(ws);
          if (userClients.size === 0) {
            clients.delete(userId);
          }
        }
        logEvent("websocket.disconnected", { userId });
      });

      ws.send(JSON.stringify({ type: "connected", userId }));
    } catch (e: any) {
      logError("websocket.auth_failed", e);
      ws.close(4001, "Authentication failed");
    }
  });

  return wss;
}

async function handleClientMessage(userId: string, message: any, ws: WebSocket) {
  switch (message.type) {
    case "typing_start":
      await handleTypingStart(userId, message.conversationId, message.userName);
      break;
    case "typing_stop":
      await handleTypingStop(userId, message.conversationId);
      break;
    case "subscribe":
      break;
  }
}

async function handleTypingStart(userId: string, conversationId: string, userName: string) {
  const participantIds = await getConversationParticipants(conversationId);
  if (!participantIds.includes(userId)) return;

  const convTyping = typingStatus.get(conversationId) || new Map();
  const existingTimeout = convTyping.get(userId);
  if (existingTimeout) clearTimeout(existingTimeout);

  const timeout = setTimeout(() => {
    void handleTypingStop(userId, conversationId);
  }, 3000);
  convTyping.set(userId, timeout);
  typingStatus.set(conversationId, convTyping);

  await broadcastToConversation(conversationId, userId, {
    type: "typing_start", conversationId, userId, userName,
  }, participantIds);
}

async function handleTypingStop(userId: string, conversationId: string) {
  const participantIds = await getConversationParticipants(conversationId);
  if (!participantIds.includes(userId)) return;

  const convTyping = typingStatus.get(conversationId);
  if (convTyping) {
    const timeout = convTyping.get(userId);
    if (timeout) clearTimeout(timeout);
    convTyping.delete(userId);
  }
  await broadcastToConversation(conversationId, userId, {
    type: "typing_stop", conversationId, userId,
  }, participantIds);
}

export function sendToUser(userId: string, message: WSMessage) {
  const userClients = clients.get(userId);
  if (userClients) {
    const data = JSON.stringify(message);
    userClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });
  }
}

async function getConversationParticipants(conversationId: string): Promise<string[]> {
  const { getConversationParticipantIds } = await import("../db");
  return getConversationParticipantIds(conversationId);
}

async function broadcastToConversation(
  conversationId: string,
  senderId: string,
  message: any,
  participantIds?: string[],
) {
  const allowedUsers = participantIds ?? (await getConversationParticipants(conversationId));
  const data = JSON.stringify(message);
  for (const userId of allowedUsers) {
    if (userId === senderId) continue;
    const userClients = clients.get(userId);
    if (!userClients) continue;
    userClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });
  }
}

export function notifyNewMessage(conversationId: string, message: any, participantIds: string[], excludeSenderId?: string) {
  const wsMessage: WSMessage = { type: "new_message", conversationId, message };
  participantIds.forEach((userId) => {
    if (excludeSenderId && userId === excludeSenderId) return;
    sendToUser(userId, wsMessage);
  });
}

/**
 * Check whether a user has at least one active WebSocket connection.
 */
export function isUserOnline(userId: string): boolean {
  const userClients = clients.get(userId);
  if (!userClients || userClients.size === 0) return false;
  for (const client of userClients) {
    if (client.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

export function notifyMessageRead(conversationId: string, messageId: string, readByUserId: string, notifyUserId: string) {
  sendToUser(notifyUserId, { type: "message_read", messageId, conversationId });
}

export function notifyBadgeCounts(userIds: string[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  unique.forEach((userId) => sendToUser(userId, { type: "badge_counts_updated" }));
}

export function notifyReaction(messageId: string, reaction: string, userId: string, notifyUserIds: string[], added: boolean) {
  const wsMessage: WSMessage = added
    ? { type: "reaction_added", messageId, reaction, userId }
    : { type: "reaction_removed", messageId, reaction, userId };
  notifyUserIds.forEach((id) => sendToUser(id, wsMessage));
}
