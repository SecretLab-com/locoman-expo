import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Configure notification handler for foreground notifications (only on native)
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  // Push notifications not supported on web
  if (Platform.OS === "web") {
    console.log("Push notifications are not supported on web");
    return undefined;
  }

  let token: string | undefined;

  // Must use physical device for push notifications
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return undefined;
  }

  // Set up Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
    });

    await Notifications.setNotificationChannelAsync("deliveries", {
      name: "Deliveries",
      description: "Notifications about your deliveries",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });

    await Notifications.setNotificationChannelAsync("sessions", {
      name: "Sessions",
      description: "Reminders for upcoming training sessions",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });

    await Notifications.setNotificationChannelAsync("orders", {
      name: "Orders",
      description: "Updates about your orders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Check and request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Failed to get push notification permissions");
    return undefined;
  }

  // Get Expo push token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    
    // Skip push token registration if no projectId is configured
    // This happens in development with Expo Go when EAS is not set up
    if (!projectId) {
      console.log("[Push Notifications] No EAS projectId configured - skipping push token registration");
      console.log("[Push Notifications] To enable push notifications, configure EAS Build for your project");
      return undefined;
    }
    
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = pushToken.data;
    console.log("Expo push token:", token);
  } catch (error) {
    // Log gracefully without showing error toast to user
    console.log("[Push Notifications] Could not get push token:", error instanceof Error ? error.message : error);
    console.log("[Push Notifications] Push notifications will not be available in this session");
    return undefined;
  }

  return token;
}

/**
 * Schedule a local notification for a delivery update
 */
export async function scheduleDeliveryNotification(
  deliveryId: number,
  title: string,
  body: string,
  delaySeconds: number = 0
): Promise<string> {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return "";
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type: "delivery", deliveryId },
      sound: true,
    },
    trigger: delaySeconds > 0 ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds } : null,
  });

  return identifier;
}

/**
 * Schedule a session reminder notification
 */
export async function scheduleSessionReminder(
  sessionId: number,
  clientName: string,
  sessionDate: Date,
  minutesBefore: number = 30
): Promise<string> {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return "";
  }

  const reminderDate = new Date(sessionDate);
  reminderDate.setMinutes(reminderDate.getMinutes() - minutesBefore);

  // Only schedule if the reminder time is in the future
  if (reminderDate <= new Date()) {
    console.log("Session reminder time has already passed");
    return "";
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Upcoming Session",
      body: `Your session with ${clientName} starts in ${minutesBefore} minutes`,
      data: { type: "session", sessionId },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
  });

  return identifier;
}

/**
 * Schedule an order status notification
 */
export async function scheduleOrderNotification(
  orderId: number,
  status: string,
  message: string
): Promise<string> {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return "";
  }

  const titles: Record<string, string> = {
    confirmed: "Order Confirmed",
    processing: "Order Processing",
    shipped: "Order Shipped",
    delivered: "Order Delivered",
    cancelled: "Order Cancelled",
  };

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: titles[status] || "Order Update",
      body: message,
      data: { type: "order", orderId, status },
      sound: true,
    },
    trigger: null, // Immediate
  });

  return identifier;
}

/**
 * Schedule a bundle approval notification
 */
export async function scheduleBundleApprovalNotification(
  bundleId: number,
  bundleTitle: string,
  status: "approved" | "rejected",
  reason?: string
): Promise<string> {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return "";
  }

  const isApproved = status === "approved";
  const title = isApproved ? "Bundle Approved!" : "Bundle Needs Revision";
  const body = isApproved
    ? `Your bundle "${bundleTitle}" has been approved and is now live!`
    : `Your bundle "${bundleTitle}" needs changes: ${reason || "Please review feedback"}`;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type: "bundle_approval", bundleId, status },
      sound: true,
    },
    trigger: null, // Immediate
  });

  return identifier;
}

/**
 * Schedule a new order notification for trainers
 */
export async function scheduleNewOrderNotification(
  orderId: number,
  clientName: string,
  bundleTitle: string,
  amount: string
): Promise<string> {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return "";
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "New Order Received!",
      body: `${clientName} purchased "${bundleTitle}" for $${amount}`,
      data: { type: "new_order", orderId },
      sound: true,
    },
    trigger: null, // Immediate
  });

  return identifier;
}

/**
 * Schedule a delivery update notification
 */
export async function scheduleDeliveryUpdateNotification(
  deliveryId: number,
  status: "shipped" | "out_for_delivery" | "delivered",
  bundleTitle: string,
  trackingInfo?: string
): Promise<string> {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return "";
  }

  const titles: Record<string, string> = {
    shipped: "Order Shipped!",
    out_for_delivery: "Out for Delivery",
    delivered: "Order Delivered!",
  };

  const bodies: Record<string, string> = {
    shipped: `Your "${bundleTitle}" order has shipped${trackingInfo ? `. Tracking: ${trackingInfo}` : ""}`,
    out_for_delivery: `Your "${bundleTitle}" order is out for delivery today`,
    delivered: `Your "${bundleTitle}" order has been delivered!`,
  };

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: titles[status],
      body: bodies[status],
      data: { type: "delivery_update", deliveryId, status },
      sound: true,
    },
    trigger: null, // Immediate
  });

  return identifier;
}

/**
 * Schedule a new message notification
 */
export async function scheduleMessageNotification(
  conversationId: string,
  senderName: string,
  messagePreview: string
): Promise<string> {
  if (Platform.OS === "web") {
    console.log("Notifications not supported on web");
    return "";
  }

  // Truncate message preview if too long
  const preview = messagePreview.length > 50 
    ? messagePreview.substring(0, 47) + "..." 
    : messagePreview;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: senderName,
      body: preview,
      data: { type: "message", conversationId },
      sound: true,
    },
    trigger: null, // Immediate
  });

  return identifier;
}

/**
 * Cancel a scheduled notification
 */
export async function cancelNotification(identifier: string): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  if (Platform.OS === "web") return [];
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Set the badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Get the badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (Platform.OS === "web") return 0;
  return await Notifications.getBadgeCountAsync();
}

/**
 * Add a notification received listener
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  if (Platform.OS === "web") {
    // Return a dummy subscription for web
    return { remove: () => {} } as Notifications.Subscription;
  }
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a notification response listener (when user taps notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  if (Platform.OS === "web") {
    // Return a dummy subscription for web
    return { remove: () => {} } as Notifications.Subscription;
  }
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Get the last notification response (for handling app launch from notification)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  if (Platform.OS === "web") return null;
  return await Notifications.getLastNotificationResponseAsync();
}
