import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";

const IOS_APP_STORE_URL =
  (process.env.EXPO_PUBLIC_IOS_APP_STORE_URL || "").trim() ||
  "https://apps.apple.com/us/search?term=Locomotivate";
const ANDROID_PLAY_STORE_URL =
  (process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL || "").trim() ||
  "https://play.google.com/store/search?q=Locomotivate&c=apps";
const WEB_FALLBACK_URL = (process.env.EXPO_PUBLIC_APP_URL || "https://locomotivate.app").trim();
const APP_DEEPLINK_URL = "locomotivate://";

type PlatformKind = "ios" | "android" | "other";

function getWebPlatformKind(userAgent: string): PlatformKind {
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/android/i.test(userAgent)) return "android";
  return "other";
}

export function MobileAppBanner() {
  const [visible, setVisible] = useState(true);
  const [isMobileWeb, setIsMobileWeb] = useState(false);
  const [platformKind, setPlatformKind] = useState<PlatformKind>("other");

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const win = typeof window !== "undefined" ? window : undefined;
    const nav = win?.navigator;
    const ua = nav?.userAgent || "";
    const looksMobileUa = /android|iphone|ipad|ipod|mobile|opera mini|iemobile/i.test(ua);
    const coarsePointer = Boolean(win?.matchMedia?.("(pointer: coarse)")?.matches);
    const narrowViewport = typeof win?.innerWidth === "number" ? win.innerWidth <= 1024 : false;

    setIsMobileWeb(looksMobileUa || (coarsePointer && narrowViewport));
    setPlatformKind(getWebPlatformKind(ua));
  }, []);

  const storeUrl = useMemo(() => {
    if (platformKind === "ios") return IOS_APP_STORE_URL;
    if (platformKind === "android") return ANDROID_PLAY_STORE_URL;
    return WEB_FALLBACK_URL;
  }, [platformKind]);

  const openAppOrStore = useCallback(() => {
    if (Platform.OS !== "web") return;
    const win = typeof window !== "undefined" ? window : undefined;
    const doc = typeof document !== "undefined" ? document : undefined;
    if (!win) return;

    const fallbackTimer = win.setTimeout(() => {
      win.location.href = storeUrl;
    }, 1200);

    const handleVisibilityChange = () => {
      if (doc?.hidden) {
        win.clearTimeout(fallbackTimer);
      }
    };
    doc?.addEventListener("visibilitychange", handleVisibilityChange, { once: true });
    win.location.href = APP_DEEPLINK_URL;
  }, [storeUrl]);

  if (Platform.OS !== "web" || !isMobileWeb || !visible) return null;

  return (
    <View className="px-4 pt-3">
      <View
        className="rounded-xl border px-3 py-3"
        style={{ backgroundColor: "rgba(15,23,42,0.95)", borderColor: "rgba(96,165,250,0.45)" }}
      >
        <View className="flex-row items-start">
          <View
            className="mr-3 h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(191,219,254,0.14)" }}
          >
            <IconSymbol name="iphone" size={20} color="#DBEAFE" />
          </View>
          <TouchableOpacity
            className="flex-1 pr-3"
            onPress={openAppOrStore}
            accessibilityRole="button"
            accessibilityLabel="Get the Mobile App"
            testID="mobile-app-banner-open"
          >
            <Text className="text-sm font-semibold text-white">Get the Mobile App</Text>
            <Text className="text-xs mt-1" style={{ color: "#BFDBFE" }}>
              Open in app for the best experience. If the app is missing, we will take you to the app store.
            </Text>
          </TouchableOpacity>

          <View className="items-end">
            <TouchableOpacity
              className="rounded-md px-3 py-1.5 mb-2"
              style={{ backgroundColor: "#2563EB" }}
              onPress={openAppOrStore}
              accessibilityRole="button"
              accessibilityLabel="Open mobile app"
              testID="mobile-app-banner-open-button"
            >
              <Text className="text-xs font-semibold text-white">Open</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="p-1"
              onPress={() => setVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss get mobile app banner"
              testID="mobile-app-banner-close"
            >
              <IconSymbol name="xmark" size={14} color="#BFDBFE" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
