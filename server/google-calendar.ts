const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
const GOOGLE_CALENDAR_EVENT_URL = "https://www.googleapis.com/calendar/v3/calendars";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
].join(" ");

export type GoogleCalendarTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string | null;
  tokenType: string | null;
};

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
};

function assertGoogleCalendarConfigured() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google Calendar OAuth is not configured.");
  }
}

export function buildGoogleCalendarAuthUrl(redirectUri: string): string {
  assertGoogleCalendarConfigured();
  const url = new URL(GOOGLE_OAUTH_BASE);
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

async function exchangeTokenRequest(payload: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload).toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = typeof data?.error_description === "string" ? data.error_description : "Token exchange failed";
    throw new Error(details);
  }
  return data as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

export async function exchangeGoogleCalendarCode(input: {
  code: string;
  redirectUri: string;
}): Promise<GoogleCalendarTokenSet> {
  assertGoogleCalendarConfigured();
  const token = await exchangeTokenRequest({
    code: input.code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  if (!token.access_token) throw new Error("Missing access token from Google.");
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || null,
    expiresAt,
    scope: token.scope || null,
    tokenType: token.token_type || null,
  };
}

export async function refreshGoogleCalendarAccessToken(refreshToken: string): Promise<GoogleCalendarTokenSet> {
  assertGoogleCalendarConfigured();
  const token = await exchangeTokenRequest({
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  if (!token.access_token) throw new Error("Missing refreshed access token.");
  const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
  return {
    accessToken: token.access_token,
    refreshToken,
    expiresAt,
    scope: token.scope || null,
    tokenType: token.token_type || null,
  };
}

export async function listGoogleCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  const response = await fetch(GOOGLE_CALENDAR_LIST_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error?.message === "string" ? data.error.message : "Failed to list calendars";
    throw new Error(message);
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((item: any) => ({
    id: String(item.id || ""),
    summary: String(item.summary || "Untitled"),
    primary: Boolean(item.primary),
    accessRole: String(item.accessRole || ""),
  }));
}

export async function createGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  startTimeIso: string;
  endTimeIso: string;
  attendeeEmails?: string[];
}): Promise<{ id: string; htmlLink: string | null }> {
  const attendees = (input.attendeeEmails || [])
    .map((email) => String(email || "").trim())
    .filter((email) => email.length > 0)
    .map((email) => ({ email }));

  const response = await fetch(
    `${GOOGLE_CALENDAR_EVENT_URL}/${encodeURIComponent(input.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description || undefined,
        location: input.location || undefined,
        start: { dateTime: input.startTimeIso },
        end: { dateTime: input.endTimeIso },
        attendees: attendees.length > 0 ? attendees : undefined,
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error?.message === "string" ? data.error.message : "Failed to create calendar event";
    throw new Error(message);
  }
  return {
    id: String(data.id || ""),
    htmlLink: typeof data.htmlLink === "string" ? data.htmlLink : null,
  };
}

export async function deleteGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_EVENT_URL}/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${input.accessToken}` },
    },
  );
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => ({}));
    const message = typeof data?.error?.message === "string" ? data.error.message : "Failed to delete calendar event";
    throw new Error(message);
  }
}

export async function updateGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  summary?: string;
  description?: string;
  location?: string;
  startTimeIso?: string;
  endTimeIso?: string;
  status?: "confirmed" | "tentative" | "cancelled";
}): Promise<{ id: string }> {
  const body: Record<string, unknown> = {};
  if (input.summary !== undefined) body.summary = input.summary;
  if (input.description !== undefined) body.description = input.description;
  if (input.location !== undefined) body.location = input.location;
  if (input.startTimeIso) body.start = { dateTime: input.startTimeIso };
  if (input.endTimeIso) body.end = { dateTime: input.endTimeIso };
  if (input.status) body.status = input.status;

  const response = await fetch(
    `${GOOGLE_CALENDAR_EVENT_URL}/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error?.message === "string" ? data.error.message : "Failed to update calendar event";
    throw new Error(message);
  }
  return { id: String(data.id || input.eventId) };
}

export async function getGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<{
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  status: string;
} | null> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_EVENT_URL}/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json",
      },
    },
  );
  if (response.status === 404 || response.status === 410) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  return {
    id: String(data.id || ""),
    summary: String(data.summary || ""),
    description: data.description || null,
    location: data.location || null,
    start: data.start?.dateTime || null,
    end: data.end?.dateTime || null,
    status: String(data.status || "confirmed"),
  };
}

export type GoogleCalendarEventSummary = {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  status: string;
  updated: string | null;
};

export async function listGoogleCalendarEvents(input: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}): Promise<GoogleCalendarEventSummary[]> {
  const url = new URL(
    `${GOOGLE_CALENDAR_EVENT_URL}/${encodeURIComponent(input.calendarId)}/events`,
  );
  url.searchParams.set("timeMin", input.timeMin);
  url.searchParams.set("timeMax", input.timeMax);
  url.searchParams.set("maxResults", String(input.maxResults || 250));
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/json",
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return [];

  return (Array.isArray(data?.items) ? data.items : []).map((item: any) => ({
    id: String(item.id || ""),
    summary: String(item.summary || ""),
    description: item.description || null,
    location: item.location || null,
    start: item.start?.dateTime || item.start?.date || null,
    end: item.end?.dateTime || item.end?.date || null,
    status: String(item.status || "confirmed"),
    updated: item.updated || null,
  }));
}
