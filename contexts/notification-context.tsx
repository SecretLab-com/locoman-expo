import { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
} from "@/lib/notifications";

type NotificationContextType = {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        setHasPermission(true);
      }
    });

    // Handle notification received while app is foregrounded
    notificationListener.current = addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Handle notification response (user tapped notification)
    responseListener.current = addNotificationResponseListener((response) => {
      handleNotificationResponse(response);
    });

    // Check if app was opened from a notification
    getLastNotificationResponse().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;

    if (!data) return;

    // Navigate based on notification type
    switch (data.type) {
      case "delivery":
        if (data.deliveryId) {
          router.push("/(client)/deliveries" as any);
        }
        break;
      case "delivery_update":
        if (data.deliveryId) {
          router.push("/(client)/deliveries" as any);
        }
        break;
      case "session":
        if (data.sessionId) {
          router.push("/(trainer)/calendar" as any);
        }
        break;
      case "order":
        if (data.orderId) {
          router.push("/(trainer)/orders" as any);
        }
        break;
      case "new_order":
        if (data.orderId) {
          router.push("/(trainer)/orders" as any);
        }
        break;
      case "bundle_approval":
        if (data.bundleId) {
          router.push(`/bundle-editor/${data.bundleId}` as any);
        }
        break;
      case "message":
        if (data.conversationId) {
          router.push({
            pathname: "/conversation/[id]" as any,
            params: { 
              id: String(data.conversationId),
              name: String(data.senderName || "Message"),
              participantId: String(data.senderId || ""),
            },
          });
        }
        break;
      default:
        // Default to home
        router.push("/(tabs)" as any);
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      setExpoPushToken(token);
      setHasPermission(true);
      return true;
    }
    return false;
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        hasPermission,
        requestPermission,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
