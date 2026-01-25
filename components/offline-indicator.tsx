import React from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { useOffline } from "@/contexts/offline-context";
import { useEffect, useRef } from "react";

/**
 * Offline indicator banner that shows when the device is offline
 * Automatically appears/disappears based on network status
 */
export function OfflineIndicator() {
  const { isOnline, isLoading } = useOffline();
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    if (isLoading) return;

    Animated.timing(slideAnim, {
      toValue: isOnline ? -50 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, isLoading, slideAnim]);

  if (isLoading) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.dot} />
        <Text style={styles.text}>You're offline. Showing cached data.</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Inline offline badge for use within screens
 */
export function OfflineBadge() {
  const { isOnline, isCacheStale } = useOffline();

  if (isOnline && !isCacheStale) return null;

  return (
    <View style={styles.badge}>
      <View style={[styles.badgeDot, !isOnline && styles.badgeDotOffline]} />
      <Text style={styles.badgeText}>
        {!isOnline ? "Offline" : "Stale data"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#EF4444",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FCA5A5",
    marginRight: 8,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F59E0B",
    marginRight: 6,
  },
  badgeDotOffline: {
    backgroundColor: "#EF4444",
  },
  badgeText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "500",
  },
});
