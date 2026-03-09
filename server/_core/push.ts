import * as db from "../db";
import { logError, logEvent, logWarn } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_MAX_BATCH_SIZE = 100;

type PushData = Record<string, string | number | boolean | null | undefined>;

export type PushMessageInput = {
  title: string;
  body: string;
  data?: PushData;
  sound?: "default" | null;
};

type ExpoPushTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
};

function chunk<T>(items: T[], size: number): T[][];
function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

type UserTokenEntry = {
  userId: string;
  token: string;
};

function getAccessTokenHeaders(): Record<string, string> {
  const accessToken = process.env.EXPO_ACCESS_TOKEN || process.env.EXPO_PUSH_ACCESS_TOKEN || "";
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}

async function sendExpoBatch(entries: UserTokenEntry[], payload: PushMessageInput) {
  if (entries.length === 0) return;

  const body = entries.map((entry) => ({
    to: entry.token,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    sound: payload.sound ?? "default",
    priority: "high",
    channelId: "default",
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...getAccessTokenHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      logWarn("push.expo.non_ok_response", {
        status: response.status,
        statusText: response.statusText,
        body: text.slice(0, 400),
      });
      return;
    }

    const json = (await response.json()) as { data?: ExpoPushTicket[] };
    const tickets = Array.isArray(json.data) ? json.data : [];

    for (let idx = 0; idx < tickets.length; idx += 1) {
      const ticket = tickets[idx];
      const entry = entries[idx];
      if (!entry) continue;
      if (ticket.status === "ok") continue;

      const errorCode = typeof ticket.details?.error === "string" ? ticket.details.error : null;
      logWarn("push.expo.ticket_error", {
        userId: entry.userId,
        errorCode,
        message: ticket.message || null,
      });

      if (errorCode === "DeviceNotRegistered") {
        await db.removeUserPushToken(entry.userId, entry.token);
      }
    }
  } catch (error) {
    logError("push.expo.request_failed", error, {
      recipientCount: entries.length,
      title: payload.title,
    });
  }
}

export async function sendPushToUsers(userIds: string[], payload: PushMessageInput) {
  const recipients = Array.from(new Set(userIds.filter(Boolean)));
  if (recipients.length === 0) return;

  const tokenMap = await db.getExpoPushTokensForUserIds(recipients);
  const entries: UserTokenEntry[] = [];

  for (const userId of recipients) {
    const tokens = tokenMap.get(userId) || [];
    for (const token of tokens) {
      entries.push({ userId, token });
    }
  }

  if (entries.length === 0) {
    logEvent("push.skip_no_tokens", { userCount: recipients.length });
    return;
  }

  const batches = chunk(entries, EXPO_MAX_BATCH_SIZE);
  for (const batch of batches) {
    await sendExpoBatch(batch, payload);
  }

  logEvent("push.sent", {
    userCount: recipients.length,
    deviceTokenCount: entries.length,
    title: payload.title,
  });
}
