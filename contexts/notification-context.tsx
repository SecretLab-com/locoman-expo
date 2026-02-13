import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  registerForPushNotificationsAsync,
} from "@/lib/notifications";
import { useAuthContext } from "@/contexts/auth-context";
import { handleNotificationDeepLink } from "@/hooks/use-deep-link";
import { trpc } from "@/lib/trpc";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

type NotificationContextType = {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuthContext();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const registerPushTokenMutation = trpc.notifications.registerPushToken.useMutation();
  const lastRegisteredTokenRef = useRef<string | null>(null);
  const lastRegisteredUserIdRef = useRef<string | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
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

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!isAuthenticated || !user?.id || !expoPushToken) return;

    if (
      lastRegisteredTokenRef.current === expoPushToken &&
      lastRegisteredUserIdRef.current === user.id
    ) {
      return;
    }

    registerPushTokenMutation
      .mutateAsync({
        token: expoPushToken,
        platform: Platform.OS === "ios" ? "ios" : "android",
      })
      .then(() => {
        lastRegisteredTokenRef.current = expoPushToken;
        lastRegisteredUserIdRef.current = user.id;
      })
      .catch((error) => {
        console.log("[Push Notifications] Failed to register token on server", error);
      });
  }, [expoPushToken, isAuthenticated, registerPushTokenMutation, user?.id]);

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;

    if (!data) return;

    // First, try to handle via deep link if a deepLink URL is provided
    if (data.deepLink && typeof data.deepLink === "string") {
      const handled = handleNotificationDeepLink(data.deepLink);
      if (handled) return;
    }

    // Fall back to legacy notification type handling
    switch (data.type) {
      case "delivery":
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
      case "bundle":
        if (data.bundleId) {
          router.push(`/bundle/${data.bundleId}` as any);
        }
        break;
      case "trainer":
        if (data.trainerId) {
          router.push(`/trainer/${data.trainerId}` as any);
        }
        break;
      case "client":
        if (data.clientId) {
          router.push(`/client-detail/${data.clientId}` as any);
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
