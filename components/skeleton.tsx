import React, { useEffect, useRef } from "react";
import { View, Animated, ViewStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";

import type { DimensionValue } from "react-native";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * A shimmer skeleton loading component.
 * Shows a pulsing animation to indicate content is loading.
 */
export function Skeleton({
  width = "100%",
  height = 20,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const colors = useColors();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.muted,
          opacity,
        },
        style,
      ]}
    />
  );
}

/**
 * Skeleton for a bundle card
 */
export function BundleCardSkeleton() {
  return (
    <View className="bg-surface rounded-2xl overflow-hidden mb-4 border border-border">
      <Skeleton height={160} borderRadius={0} />
      <View className="p-4">
        <Skeleton width="70%" height={20} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={14} style={{ marginBottom: 4 }} />
        <Skeleton width="60%" height={14} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Skeleton width={24} height={24} borderRadius={12} style={{ marginRight: 8 }} />
            <Skeleton width={80} height={14} />
          </View>
          <Skeleton width={60} height={20} />
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton for a product card
 */
export function ProductCardSkeleton() {
  return (
    <View className="w-[48%] mb-4 bg-surface rounded-xl overflow-hidden border border-border">
      <View className="aspect-square">
        <Skeleton width="100%" height="100%" borderRadius={0} />
      </View>
      <View className="p-3">
        <Skeleton width={60} height={16} style={{ marginBottom: 8 }} borderRadius={8} />
        <Skeleton width="80%" height={18} style={{ marginBottom: 4 }} />
        <Skeleton width="60%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="100%" height={36} borderRadius={8} />
      </View>
    </View>
  );
}

/**
 * Skeleton for a trainer card
 */
export function TrainerCardSkeleton() {
  return (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View style={{ flexDirection: "row" }}>
        <Skeleton width={64} height={64} borderRadius={32} />
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Skeleton width="60%" height={20} style={{ marginBottom: 4 }} />
          <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
          <Skeleton width="100%" height={14} style={{ marginBottom: 4 }} />
          <Skeleton width="80%" height={14} style={{ marginBottom: 8 }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Skeleton width={60} height={20} borderRadius={4} />
            <Skeleton width={60} height={20} borderRadius={4} />
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Skeleton for an order item
 */
export function OrderItemSkeleton() {
  return (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
        <Skeleton width={100} height={18} />
        <Skeleton width={80} height={24} borderRadius={12} />
      </View>
      <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
      <Skeleton width="50%" height={14} style={{ marginBottom: 8 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Skeleton width={80} height={14} />
        <Skeleton width={60} height={18} />
      </View>
    </View>
  );
}

/**
 * Skeleton for a delivery item
 */
export function DeliveryItemSkeleton() {
  return (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Skeleton width={48} height={48} borderRadius={8} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Skeleton width="80%" height={16} style={{ marginBottom: 4 }} />
          <Skeleton width="60%" height={14} />
        </View>
        <Skeleton width={70} height={24} borderRadius={12} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Skeleton width="48%" height={36} borderRadius={8} />
        <Skeleton width="48%" height={36} borderRadius={8} />
      </View>
    </View>
  );
}

/**
 * Skeleton for dashboard stats
 */
export function DashboardStatsSkeleton() {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          className="bg-surface rounded-xl p-4 border border-border"
          style={{ width: "48%" }}
        >
          <Skeleton width={32} height={32} borderRadius={8} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={24} style={{ marginBottom: 4 }} />
          <Skeleton width="60%" height={14} />
        </View>
      ))}
    </View>
  );
}

/**
 * Skeleton for a message item
 */
export function MessageItemSkeleton() {
  return (
    <View className="flex-row items-center p-4 border-b border-border">
      <Skeleton width={48} height={48} borderRadius={24} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="60%" height={16} style={{ marginBottom: 4 }} />
        <Skeleton width="80%" height={14} />
      </View>
      <Skeleton width={40} height={12} />
    </View>
  );
}

/**
 * Skeleton for a session card
 */
export function SessionCardSkeleton() {
  return (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Skeleton width="50%" height={18} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
      <Skeleton width="70%" height={14} style={{ marginBottom: 4 }} />
      <Skeleton width="40%" height={14} />
    </View>
  );
}

/**
 * Skeleton list wrapper - shows multiple skeleton items
 */
export function SkeletonList({
  count = 3,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <React.Fragment key={index}>{children}</React.Fragment>
      ))}
    </>
  );
}
