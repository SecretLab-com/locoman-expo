import { useShareIntentContext } from "expo-share-intent";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * Listens for incoming share intents and navigates to the share-intent screen.
 * Must be mounted inside ShareIntentProvider and a navigation context.
 */
export function ShareIntentRouter() {
  const { hasShareIntent, shareIntent } = useShareIntentContext();
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!hasShareIntent || navigatedRef.current) return;

    const hasContent =
      Boolean(shareIntent.text) ||
      Boolean(shareIntent.webUrl) ||
      (shareIntent.files && shareIntent.files.length > 0);

    if (!hasContent) return;

    navigatedRef.current = true;

    if (Platform.OS === "web") {
      router.push("/share-intent" as any);
    } else {
      setTimeout(() => {
        router.push("/share-intent" as any);
      }, 300);
    }
  }, [hasShareIntent, shareIntent]);

  useEffect(() => {
    if (!hasShareIntent) {
      navigatedRef.current = false;
    }
  }, [hasShareIntent]);

  return null;
}
