import * as Auth from "@/lib/_core/auth";
import { getApiBaseUrl } from "@/lib/api-config";
import { offlineCache } from "@/lib/offline-cache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

type WSMessage =
  | { type: "connected"; userId: string }
  | { type: "new_message"; conversationId: string; message: any }
  | { type: "typing_start"; conversationId: string; userId: string; userName: string }
  | { type: "typing_stop"; conversationId: string; userId: string }
  | { type: "message_read"; messageId: string; conversationId: string }
  | { type: "reaction_added"; messageId: string; reaction: string; userId: string }
  | { type: "reaction_removed"; messageId: string; reaction: string; userId: string }
  | { type: "badge_counts_updated" }
  | {
      type: "social_alert";
      severity: "info" | "warning" | "critical";
      title: string;
      body: string;
      trainerId?: string;
      eventType?: string;
      celebratory?: boolean;
      showInApp?: boolean;
    };

type MessageHandler = (message: WSMessage) => void;

type WSConnection = {
  ws: WebSocket | null;
  isConnecting: boolean;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  idleCloseTimeout: ReturnType<typeof setTimeout> | null;
  handlers: Set<MessageHandler>;
  refCount: number;
  lastConnectAt: number;
  authBlockedUntil: number;
  failedToken: string | null;
  networkOnline: boolean;
  networkMonitorUnsubscribe: (() => void) | null;
  connectInvoker: (() => void) | null;
};

const sharedConnection: WSConnection = {
  ws: null,
  isConnecting: false,
  reconnectTimeout: null,
  idleCloseTimeout: null,
  handlers: new Set(),
  refCount: 0,
  lastConnectAt: 0,
  authBlockedUntil: 0,
  failedToken: null,
  networkOnline: true,
  networkMonitorUnsubscribe: null,
  connectInvoker: null,
};

function clearReconnectTimeout() {
  if (sharedConnection.reconnectTimeout) {
    clearTimeout(sharedConnection.reconnectTimeout);
    sharedConnection.reconnectTimeout = null;
  }
}

function isNetworkDownClose(event: CloseEvent) {
  const reason = String(event.reason || "").toLowerCase();
  return (
    !sharedConnection.networkOnline ||
    reason.includes("network is down") ||
    reason.includes("offline")
  );
}

function ensureNetworkMonitoring() {
  if (sharedConnection.networkMonitorUnsubscribe) return;
  sharedConnection.networkMonitorUnsubscribe = offlineCache.subscribeToNetworkChanges(
    (connected) => {
      sharedConnection.networkOnline = connected;
      if (!connected) {
        clearReconnectTimeout();
        return;
      }
      if (
        sharedConnection.refCount > 0 &&
        !sharedConnection.ws &&
        !sharedConnection.isConnecting &&
        sharedConnection.connectInvoker
      ) {
        sharedConnection.connectInvoker();
      }
    },
  );
}

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
      ensureNetworkMonitoring();
      const isOnline = await offlineCache.isOnline();
      sharedConnection.networkOnline = isOnline;
      if (!isOnline) {
        sharedConnection.isConnecting = false;
        setConnectionError(null);
        return;
      }
      // Skip when not authenticated — always require a Supabase token
      const token = await Auth.getSessionToken();
      if (!token) {
        console.log("[WebSocket] No Supabase session token, skipping connection");
        sharedConnection.isConnecting = false;
        return;
      }

      // Backoff when server reports auth/token failures for the same token.
      // This prevents multiple screens/hooks from hammering /ws.
      const now = Date.now();
      if (
        sharedConnection.authBlockedUntil > now &&
        sharedConnection.failedToken === token
      ) {
        return;
      }
      if (sharedConnection.failedToken !== token) {
        sharedConnection.authBlockedUntil = 0;
        sharedConnection.failedToken = null;
      }

      const connectNow = Date.now();
      if (sharedConnection.lastConnectAt && connectNow - sharedConnection.lastConnectAt < 2000) {
        // Multiple components may call connect() simultaneously.
        // Shared connection deduplicates this, so no-op silently.
      }
      sharedConnection.lastConnectAt = connectNow;

      if (sharedConnection.ws) {
        const state = sharedConnection.ws.readyState;
        if (
          state === WebSocket.OPEN ||
          state === WebSocket.CONNECTING ||
          state === WebSocket.CLOSING
        ) {
          return;
        }
      }
      if (sharedConnection.isConnecting) {
        return;
      }
      sharedConnection.isConnecting = true;
      const tokenUsed = token;

      // Get API base URL
      const apiUrl = getApiBaseUrl() || process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
      const wsBase = apiUrl.replace(/^http/, "ws");

      const impersonated = await AsyncStorage.getItem("locomotivate_impersonation");
      const impersonateUserId = impersonated ? JSON.parse(impersonated)?.id : null;

      let wsUrl = `${wsBase}/ws?token=${encodeURIComponent(token)}`;

      if (impersonateUserId) {
        wsUrl += (wsUrl.includes("?") ? "&" : "?") + `impersonateUserId=${impersonateUserId}`;
      }

      console.log("[WebSocket] Connecting to:", wsUrl.split("?")[0]);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setIsConnected(true);
        setConnectionError(null);
        sharedConnection.isConnecting = false;
        clearReconnectTimeout();
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          sharedConnection.handlers.forEach((handler) => handler(message));
        } catch (e) {
          console.warn("[WebSocket] Failed to parse message:", e);
        }
      };

      ws.onerror = (error) => {
        if (!sharedConnection.networkOnline) {
          setConnectionError(null);
          return;
        }
        // Browser/native WebSocket "error" events are often opaque and expected during reconnects.
        const eventType =
          error && typeof error === "object" && "type" in error
            ? String((error as { type?: unknown }).type ?? "error")
            : "error";
        console.warn("[WebSocket] Event:", eventType);
        setConnectionError("Reconnecting…");
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        sharedConnection.ws = null;
        sharedConnection.isConnecting = false;
        if (isNetworkDownClose(event)) {
          clearReconnectTimeout();
          setConnectionError(null);
          return;
        }
        console.log("[WebSocket] Disconnected:", event.code, event.reason);

        // Skip reconnect on auth failure or intentional close
        if (event.code === 4001) {
          setConnectionError("Authentication required");
          sharedConnection.failedToken = tokenUsed;
          sharedConnection.authBlockedUntil = Date.now() + 30000;
          clearReconnectTimeout();
          return;
        }
        if (event.code !== 1000) {
          clearReconnectTimeout();
          sharedConnection.reconnectTimeout = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      sharedConnection.ws = ws;
    } catch (e) {
      console.warn("[WebSocket] Connection failed:", e);
      setConnectionError("Failed to connect");
      sharedConnection.isConnecting = false;
    }
  }, []);

  useEffect(() => {
    ensureNetworkMonitoring();
    sharedConnection.connectInvoker = () => {
      void connect();
    };
    return () => {
      if (sharedConnection.refCount === 0) {
        sharedConnection.connectInvoker = null;
      }
    };
  }, [connect]);

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
          clearReconnectTimeout();
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
