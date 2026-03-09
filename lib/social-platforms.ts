export type SocialPlatformIcon = {
  key: string;
  label: string;
  icon: string;
  color: string;
};

const PLATFORM_ICON_MAP: Record<string, Omit<SocialPlatformIcon, "key">> = {
  youtube: { label: "YouTube", icon: "youtube", color: "#FF0000" },
  instagram: { label: "Instagram", icon: "instagram", color: "#E1306C" },
  tiktok: { label: "TikTok", icon: "music-note", color: "#111827" },
  facebook: { label: "Facebook", icon: "facebook", color: "#1877F2" },
  x: { label: "X", icon: "alpha-x", color: "#111827" },
  twitter: { label: "Twitter", icon: "twitter", color: "#1D9BF0" },
  linkedin: { label: "LinkedIn", icon: "linkedin", color: "#0A66C2" },
  twitch: { label: "Twitch", icon: "twitch", color: "#9146FF" },
  snapchat: { label: "Snapchat", icon: "snapchat", color: "#FACC15" },
  pinterest: { label: "Pinterest", icon: "pinterest", color: "#E60023" },
};

export function inferSocialPlatformFromText(value: unknown): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (
    raw.includes("youtube.com") ||
    raw.includes("youtu.be") ||
    raw.includes("youtube")
  ) {
    return "youtube";
  }
  if (raw.includes("instagram.com") || raw.includes("instagram"))
    return "instagram";
  if (raw.includes("tiktok.com") || raw.includes("tiktok")) return "tiktok";
  if (raw.includes("facebook.com") || raw.includes("facebook"))
    return "facebook";
  if (raw.includes("x.com/") || raw.includes("twitter.com") || raw === "x") {
    return raw === "x" ? "x" : "twitter";
  }
  if (raw.includes("linkedin.com") || raw.includes("linkedin"))
    return "linkedin";
  if (raw.includes("twitch.tv") || raw.includes("twitch")) return "twitch";
  if (raw.includes("snapchat.com") || raw.includes("snapchat"))
    return "snapchat";
  if (raw.includes("pinterest.") || raw.includes("pinterest"))
    return "pinterest";
  return "";
}

export function normalizeSocialPlatform(value: unknown): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  if (raw === "unknown" || raw === "n/a" || raw === "na") return "";
  const inferred = inferSocialPlatformFromText(raw);
  if (inferred) return inferred;
  if (raw.includes("youtube")) return "youtube";
  if (raw.includes("yt ")) return "youtube";
  if (raw.includes("yt_")) return "youtube";
  if (raw.includes("google") && raw.includes("video")) return "youtube";
  if (raw.includes("google") && raw.includes("channel")) return "youtube";
  if (raw.includes("instagram")) return "instagram";
  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("facebook")) return "facebook";
  if (raw === "x" || raw.includes("twitter"))
    return raw === "x" ? "x" : "twitter";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("twitch")) return "twitch";
  if (raw.includes("snapchat")) return "snapchat";
  if (raw.includes("pinterest")) return "pinterest";
  return raw.replace(/\s+/g, "_");
}

export function getSocialPlatformIcon(value: unknown): SocialPlatformIcon {
  const key = normalizeSocialPlatform(value);
  const mapped = PLATFORM_ICON_MAP[key];
  if (mapped) return { key, ...mapped };
  return {
    key: key || "unknown",
    label: key ? key.replace(/_/g, " ") : "Platform",
    icon: "web",
    color: "#64748B",
  };
}
