import { Platform } from "react-native";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function toInvitePath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

export function getInviteBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_APP_URL || "").trim();
  if (configured) {
    return trimTrailingSlash(configured);
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
  return `locomotivate://${toInvitePath(token).replace(/^\//, "")}`;
}

