import type { IncomingMessage } from "http";
import { Server } from "http";
import { logError, logEvent } from "./logger";
import { sdk } from "./sdk";

import { WebSocket, WebSocketServer } from "ws";

// Store connected clients by user ID
const clients = new Map<number, Set<WebSocket>>();

// Store typing status by conversation
const typingStatus = new Map<string, Map<number, NodeJS.Timeout>>();

export type WSMessage =
  | { type: "new_message"; conversationId: string; message: any }
  | { type: "typing_start"; conversationId: string; userId: number; userName: string }
  | { type: "typing_stop"; conversationId: string; userId: number }
  | { type: "message_read"; messageId: number; conversationId: string }
  | { type: "reaction_added"; messageId: number; reaction: string; userId: number }
  | { type: "reaction_removed"; messageId: number; reaction: string; userId: number }
  | { type: "badge_counts_updated" };

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    // Extract token from query string
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    const impersonateUserId = url.searchParams.get("impersonateUserId");
    const cookieHeader = req.headers.cookie || "";

    if (impersonateUserId) {
      req.headers["x-impersonate-user-id"] = impersonateUserId;
    }

    try {
      let userId: number | null = null;

      if (token) {
        const session = await sdk.verifySession(token);
        if (session) {
          const { getUserByOpenId } = await import("../db");
          const user = await getUserByOpenId(session.openId);
          userId = user?.id ?? null;
        }
      }

      if (!userId) {
        // If no token and no cookie, skip noisy auth errors
        if (!token && !cookieHeader) {
          ws.close(4001, "Authentication required");
          return;
        }
        const user = await sdk.authenticateRequest(req as any);
        userId = user?.id ?? null;
      }

      if (!userId) {
        ws.close(4001, "Authentication required");
        return;
      }

      // Add client to the map
      if (!clients.has(userId)) {
        clients.set(userId, new Set());
      }
      clients.get(userId)!.add(ws);

      logEvent("websocket.connected", { userId });

      // Handle incoming messages
      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          handleClientMessage(userId, message, ws);
        } catch (e) {
          logError("websocket.parse_failed", e, { userId });
        }
      });

      // Handle disconnection
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

      // Send connection confirmation
      ws.send(JSON.stringify({ type: "connected", userId }));

    } catch (e: any) {
      const statusCode = e?.statusCode;
      const message = e?.message || "";
      const isMissingCookie = statusCode === 403 && message.toLowerCase().includes("session cookie");
      if (!isMissingCookie) {
        logError("websocket.auth_failed", e);
      }
      ws.close(4001, "Invalid token");
    }
  });

  return wss;
}

function handleClientMessage(userId: number, message: any, ws: WebSocket) {
  switch (message.type) {
    case "typing_start":
      handleTypingStart(userId, message.conversationId, message.userName);
      break;
    case "typing_stop":
      handleTypingStop(userId, message.conversationId);
      break;
    case "subscribe":
      // Client wants to subscribe to a conversation
      // For now, we broadcast to all participants
      break;
  }
}

function handleTypingStart(userId: number, conversationId: string, userName: string) {
  // Clear any existing timeout
  const convTyping = typingStatus.get(conversationId) || new Map();
  const existingTimeout = convTyping.get(userId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Set new timeout to auto-clear typing after 3 seconds
  const timeout = setTimeout(() => {
    handleTypingStop(userId, conversationId);
  }, 3000);

  convTyping.set(userId, timeout);
  typingStatus.set(conversationId, convTyping);

  // Broadcast typing status to other participants
  broadcastToConversation(conversationId, userId, {
    type: "typing_start",
    conversationId,
    userId,
    userName,
  });
}

function handleTypingStop(userId: number, conversationId: string) {
  const convTyping = typingStatus.get(conversationId);
  if (convTyping) {
    const timeout = convTyping.get(userId);
    if (timeout) {
      clearTimeout(timeout);
    }
    convTyping.delete(userId);
  }

  broadcastToConversation(conversationId, userId, {
    type: "typing_stop",
    conversationId,
    userId,
  });
}

// Broadcast message to all clients of a specific user
export function sendToUser(userId: number, message: WSMessage) {
  const userClients = clients.get(userId);
  if (userClients) {
    const data = JSON.stringify(message);
    userClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

// Broadcast to all participants in a conversation except the sender
function broadcastToConversation(conversationId: string, senderId: number, message: any) {
  // In a real implementation, we'd look up conversation participants from DB
  // For now, broadcast to all connected clients except sender
  const data = JSON.stringify(message);
  clients.forEach((userClients, userId) => {
    if (userId !== senderId) {
      userClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      });
    }
  });
}

// Notify specific users about a new message
export function notifyNewMessage(
  conversationId: string,
  message: any,
  participantIds: number[]
) {
  const wsMessage: WSMessage = {
    type: "new_message",
    conversationId,
    message,
  };

  participantIds.forEach((userId) => {
    sendToUser(userId, wsMessage);
  });
}

// Notify about message read
export function notifyMessageRead(
  conversationId: string,
  messageId: number,
  readByUserId: number,
  notifyUserId: number
) {
  sendToUser(notifyUserId, {
    type: "message_read",
    messageId,
    conversationId,
  });
}

export function notifyBadgeCounts(userIds: number[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  unique.forEach((userId) => {
    sendToUser(userId, { type: "badge_counts_updated" });
  });
}

// Notify about reaction
export function notifyReaction(
  messageId: number,
  reaction: string,
  userId: number,
  notifyUserIds: number[],
  added: boolean
) {
  const wsMessage: WSMessage = added
    ? { type: "reaction_added", messageId, reaction, userId }
    : { type: "reaction_removed", messageId, reaction, userId };

  notifyUserIds.forEach((id) => {
    sendToUser(id, wsMessage);
  });
}
