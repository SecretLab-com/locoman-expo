import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/lib/api-config";
import { COOKIE_NAME } from "@/shared/const";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

type WSMessage = 
  | { type: "connected"; userId: number }
  | { type: "new_message"; conversationId: string; message: any }
  | { type: "typing_start"; conversationId: string; userId: number; userName: string }
  | { type: "typing_stop"; conversationId: string; userId: number }
  | { type: "message_read"; messageId: number; conversationId: string }
  | { type: "reaction_added"; messageId: number; reaction: string; userId: number }
  | { type: "reaction_removed"; messageId: number; reaction: string; userId: number }
  | { type: "badge_counts_updated" };

type MessageHandler = (message: WSMessage) => void;

type WSConnection = {
  ws: WebSocket | null;
  isConnecting: boolean;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  idleCloseTimeout: ReturnType<typeof setTimeout> | null;
  handlers: Set<MessageHandler>;
  refCount: number;
  lastConnectAt: number;
};

const sharedConnection: WSConnection = {
  ws: null,
  isConnecting: false,
  reconnectTimeout: null,
  idleCloseTimeout: null,
  handlers: new Set(),
  refCount: 0,
  lastConnectAt: 0,
};

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const localHandlerRef = useRef<MessageHandler | null>(null);
  const hasRegisteredRef = useRef(false);

  const connect = useCallback(async () => {
    if (!hasRegisteredRef.current) {
      sharedConnection.refCount += 1;
      hasRegisteredRef.current = true;
    }
    if (sharedConnection.idleCloseTimeout) {
      clearTimeout(sharedConnection.idleCloseTimeout);
      sharedConnection.idleCloseTimeout = null;
    }
    try {
      const now = Date.now();
      if (sharedConnection.lastConnectAt && now - sharedConnection.lastConnectAt < 2000) {
        console.error("[WebSocket] Rapid reconnect attempt", {
          deltaMs: now - sharedConnection.lastConnectAt,
          stack: new Error().stack,
        });
      }
      sharedConnection.lastConnectAt = now;

      if (sharedConnection.ws) {
        const state = sharedConnection.ws.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          return;
        }
      }
      if (sharedConnection.isConnecting) {
        return;
      }
      sharedConnection.isConnecting = true;

      // Skip when not authenticated
      let token: string | null = null;
      if (Platform.OS === "web") {
        const hasCookie =
          typeof document !== "undefined" &&
          typeof document.cookie === "string" &&
          document.cookie.includes(COOKIE_NAME);
        if (!hasCookie) {
          console.log("[WebSocket] No auth cookie, skipping connection");
          sharedConnection.isConnecting = false;
          return;
        }
      } else {
        token = await Auth.getSessionToken();
        if (!token) {
          console.log("[WebSocket] No auth token, skipping connection");
          sharedConnection.isConnecting = false;
          return;
        }
      }

      // Get API base URL
      const apiUrl = getApiBaseUrl() || process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
      const wsBase = apiUrl.replace(/^http/, "ws");
      const wsUrl = token
        ? `${wsBase}/ws?token=${encodeURIComponent(token)}`
        : `${wsBase}/ws`;

      console.log("[WebSocket] Connecting to:", wsUrl.split("?")[0]);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setIsConnected(true);
        setConnectionError(null);
        sharedConnection.isConnecting = false;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          sharedConnection.handlers.forEach((handler) => handler(message));
        } catch (e) {
          console.error("[WebSocket] Failed to parse message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        setConnectionError("Connection error");
        sharedConnection.isConnecting = false;
      };

      ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected:", event.code, event.reason);
        setIsConnected(false);
        sharedConnection.ws = null;
        sharedConnection.isConnecting = false;

        // Skip reconnect on auth failure or intentional close
        if (event.code === 4001) {
          setConnectionError("Authentication required");
          return;
        }
        if (event.code !== 1000) {
          sharedConnection.reconnectTimeout = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      sharedConnection.ws = ws;
    } catch (e) {
      console.error("[WebSocket] Connection failed:", e);
      setConnectionError("Failed to connect");
      sharedConnection.isConnecting = false;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (hasRegisteredRef.current) {
      sharedConnection.refCount = Math.max(0, sharedConnection.refCount - 1);
      hasRegisteredRef.current = false;
    }
    if (sharedConnection.refCount > 0) {
      return;
    }
    if (!sharedConnection.idleCloseTimeout) {
      sharedConnection.idleCloseTimeout = setTimeout(() => {
        if (sharedConnection.refCount > 0) {
          return;
        }
        if (sharedConnection.reconnectTimeout) {
          clearTimeout(sharedConnection.reconnectTimeout);
          sharedConnection.reconnectTimeout = null;
        }
        if (sharedConnection.ws) {
          sharedConnection.ws.close(1000, "User disconnected");
          sharedConnection.ws = null;
        }
        setIsConnected(false);
        sharedConnection.idleCloseTimeout = null;
      }, 2000);
    }
  }, []);

  const send = useCallback((message: object) => {
    if (sharedConnection.ws && sharedConnection.ws.readyState === WebSocket.OPEN) {
      sharedConnection.ws.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((handler: MessageHandler) => {
    sharedConnection.handlers.add(handler);
    localHandlerRef.current = handler;
    return () => {
      sharedConnection.handlers.delete(handler);
      if (localHandlerRef.current === handler) {
        localHandlerRef.current = null;
      }
    };
  }, []);

  // Typing indicator helpers
  const sendTypingStart = useCallback((conversationId: string, userName: string) => {
    send({ type: "typing_start", conversationId, userName });
  }, [send]);

  const sendTypingStop = useCallback((conversationId: string) => {
    send({ type: "typing_stop", conversationId });
  }, [send]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    send,
    subscribe,
    sendTypingStart,
    sendTypingStop,
  };
}

// Global WebSocket instance for app-wide use
let globalWS: ReturnType<typeof useWebSocket> | null = null;

export function getGlobalWebSocket() {
  return globalWS;
}

export function setGlobalWebSocket(ws: ReturnType<typeof useWebSocket>) {
  globalWS = ws;
}
