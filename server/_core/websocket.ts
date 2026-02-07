import type { IncomingMessage } from "http";
import { Server } from "http";
import { logError, logEvent } from "./logger";
import { getServerSupabase } from "../../lib/supabase";

import { WebSocket, WebSocketServer } from "ws";

// Store connected clients by user ID (UUID string)
const clients = new Map<string, Set<WebSocket>>();

// Store typing status by conversation
const typingStatus = new Map<string, Map<string, NodeJS.Timeout>>();

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
    const sb = getServerSupabase();
    const { data: { user: supabaseUser }, error } = await sb.auth.getUser(token);
    if (error || !supabaseUser) return null;

    // Look up app user by auth_id
    const { getUserByAuthId, getUserByEmail } = await import("../db");
    const appUser = await getUserByAuthId(supabaseUser.id);
    if (appUser) return appUser.id;

    // Fallback: email match
    if (supabaseUser.email) {
      const byEmail = await getUserByEmail(supabaseUser.email);
      if (byEmail) return byEmail.id;
    }

    return null;
  } catch {
    return null;
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const impersonateUserId = url.searchParams.get("impersonateUserId");

    try {
      if (!token) {
        ws.close(4001, "Authentication required");
        return;
      }

      let userId = await verifyTokenToUserId(token);

      if (!userId) {
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
          handleClientMessage(userId, message, ws);
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

function handleClientMessage(userId: string, message: any, ws: WebSocket) {
  switch (message.type) {
    case "typing_start":
      handleTypingStart(userId, message.conversationId, message.userName);
      break;
    case "typing_stop":
      handleTypingStop(userId, message.conversationId);
      break;
    case "subscribe":
      break;
  }
}

function handleTypingStart(userId: string, conversationId: string, userName: string) {
  const convTyping = typingStatus.get(conversationId) || new Map();
  const existingTimeout = convTyping.get(userId);
  if (existingTimeout) clearTimeout(existingTimeout);

  const timeout = setTimeout(() => handleTypingStop(userId, conversationId), 3000);
  convTyping.set(userId, timeout);
  typingStatus.set(conversationId, convTyping);

  broadcastToConversation(conversationId, userId, {
    type: "typing_start", conversationId, userId, userName,
  });
}

function handleTypingStop(userId: string, conversationId: string) {
  const convTyping = typingStatus.get(conversationId);
  if (convTyping) {
    const timeout = convTyping.get(userId);
    if (timeout) clearTimeout(timeout);
    convTyping.delete(userId);
  }
  broadcastToConversation(conversationId, userId, {
    type: "typing_stop", conversationId, userId,
  });
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

function broadcastToConversation(conversationId: string, senderId: string, message: any) {
  const data = JSON.stringify(message);
  clients.forEach((userClients, userId) => {
    if (userId !== senderId) {
      userClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(data);
      });
    }
  });
}

export function notifyNewMessage(conversationId: string, message: any, participantIds: string[]) {
  const wsMessage: WSMessage = { type: "new_message", conversationId, message };
  participantIds.forEach((userId) => sendToUser(userId, wsMessage));
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
