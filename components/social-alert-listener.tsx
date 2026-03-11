import { useAuthContext } from "@/contexts/auth-context";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect, useRef } from "react";
import { Alert } from "react-native";

export function SocialAlertListener() {
  const { isAuthenticated, isTrainer, user } = useAuthContext();
  const { connect, disconnect, subscribe } = useWebSocket();
  const lastAlertKeyRef = useRef("");

  useEffect(() => {
    if (!isAuthenticated || !isTrainer) return;
    connect();
    const unsubscribe = subscribe((message: any) => {
      if (message?.type !== "social_alert") return;
      if (message?.celebratory !== true && message?.showInApp !== true) return;
      const title = String(message?.title || "Nice work!");
      const body = String(message?.body || "");
      const key = `${String(message?.eventType || "")}:${title}:${body}`;
      if (lastAlertKeyRef.current === key) return;
      lastAlertKeyRef.current = key;
      Alert.alert(title, body);
    });
    return () => {
      unsubscribe();
      disconnect();
    };
  }, [isAuthenticated, isTrainer, connect, disconnect, subscribe, user?.id]);

  return null;
}
