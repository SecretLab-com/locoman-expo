import { useEffect, useRef, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { COOKIE_NAME } from "@/shared/const";

type WSMessage = 
  | { type: "connected"; userId: number }
  | { type: "new_message"; conversationId: string; message: any }
  | { type: "typing_start"; conversationId: string; userId: number; userName: string }
  | { type: "typing_stop"; conversationId: string; userId: number }
  | { type: "message_read"; messageId: number; conversationId: string }
  | { type: "reaction_added"; messageId: number; reaction: string; userId: number }
  | { type: "reaction_removed"; messageId: number; reaction: string; userId: number };

type MessageHandler = (message: WSMessage) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const handlersRef = useRef<Set<MessageHandler>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async () => {
    // Skip on web for now (would need different auth approach)
    if (Platform.OS === "web") {
      console.log("[WebSocket] Skipping on web platform");
      return;
    }

    try {
      // Get auth token
      const token = await SecureStore.getItemAsync(COOKIE_NAME);
      if (!token) {
        console.log("[WebSocket] No auth token, skipping connection");
        return;
      }

      // Get API base URL
      const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";
      const wsUrl = apiUrl.replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(token)}`;

      console.log("[WebSocket] Connecting to:", wsUrl.split("?")[0]);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[WebSocket] Connected");
        setIsConnected(true);
        setConnectionError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage;
          handlersRef.current.forEach((handler) => handler(message));
        } catch (e) {
          console.error("[WebSocket] Failed to parse message:", e);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        setConnectionError("Connection error");
      };

      ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected:", event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnect after 5 seconds if not intentional close
        if (event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("[WebSocket] Connection failed:", e);
      setConnectionError("Failed to connect");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const send = useCallback((message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const subscribe = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
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
