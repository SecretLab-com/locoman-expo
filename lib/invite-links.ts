import { Platform } from "react-native";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function toInvitePath(token: string): string {
  return `/register?inviteToken=${encodeURIComponent(token)}`;
}

export function getInviteBaseUrl(): string {
  const preferred =
    (process.env.EXPO_PUBLIC_APP_URL || "").trim() ||
    (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
  if (preferred) {
    return trimTrailingSlash(preferred);
  }

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return trimTrailingSlash(window.location.origin);
  }

  return "";
}

export function getInviteLink(token: string): string {
  const base = getInviteBaseUrl();
  if (base) {
    return `${base}${toInvitePath(token)}`;
  }
  return `locomotivate://register?inviteToken=${encodeURIComponent(token)}`;
}

