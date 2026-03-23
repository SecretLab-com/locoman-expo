import { PlanFlowCancelModal } from "@/components/plan-flow-cancel-modal";
import {
  PLAN_FLOW_HEADER_SIDE_SLOT_WIDTH,
  PlanFlowCloseButton,
} from "@/components/plan-flow-close-button";
import { useCartAnimation } from "@/contexts/cart-animation-context";
import { useCart } from "@/contexts/cart-context";
import { useColors } from "@/hooks/use-colors";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type PlanShoppingShellProps = {
  children: ReactNode;
  displayName: string;
  clientPhotoUrl: string | null;
  getInitials: (name: string) => string;
  onDone: () => void;
  hideHeader?: boolean;
  /** Override after "Discard & leave" (default: clearCart + back or clients) */
  onExitDiscard?: () => void;
};

/**
 * Header (Shopping for… + X), footer (counts + Done), and cancel modal for trainer plan shopping.
 * Used from `/plan-shop` and from `/(tabs)/products` when building a client plan.
 */
export function PlanShoppingShell({
  children,
  displayName,
  clientPhotoUrl,
  getInitials,
  onDone,
  hideHeader = false,
  onExitDiscard: onExitDiscardProp,
}: PlanShoppingShellProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, itemCount, subtotal, clearCart } = useCart();
  const {
    planFooterPulse,
    registerPlanFooterTarget,
    setPlanFooterFallbackRect,
  } = useCartAnimation();
  const [showPlanCancelModal, setShowPlanCancelModal] = useState(false);
  const summaryTargetRef = useRef<View | null>(null);

  const bundleCount = items.filter((i) => i.type === "bundle").length;
  const productCount = items.filter((i) => i.type === "product" || i.type === "custom_product").length;

  const footerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + planFooterPulse.value * 0.045 }],
    opacity: 1 - planFooterPulse.value * 0.04,
  }));

  const updateSummaryTargetRect = useCallback(() => {
    requestAnimationFrame(() => {
      summaryTargetRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setPlanFooterFallbackRect({ x, y, width, height });
        }
      });
    });
  }, [setPlanFooterFallbackRect]);

  useEffect(() => {
    registerPlanFooterTarget(summaryTargetRef.current);
    updateSummaryTargetRect();
    return () => {
      registerPlanFooterTarget(null);
    };
  }, [registerPlanFooterTarget, updateSummaryTargetRect]);

  useEffect(() => {
    updateSummaryTargetRect();
  }, [itemCount, subtotal, insets.bottom, updateSummaryTargetRect]);

  const defaultLeave = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(trainer)/clients" as any);
    }
  };

  const exitPlanDiscard = () => {
    setShowPlanCancelModal(false);
    if (onExitDiscardProp) {
      onExitDiscardProp();
      return;
    }
    clearCart();
    defaultLeave();
  };

  return (
    <View className="flex-1 bg-background">
      {!hideHeader ? (
        <View
          className="flex-row items-center px-4 pb-2 bg-background border-b border-border"
          style={{ paddingTop: Math.max(insets.top, 12) }}
        >
          <View style={{ width: PLAN_FLOW_HEADER_SIDE_SLOT_WIDTH }} />

          <View className="flex-1 flex-row items-center justify-center mx-3">
            {clientPhotoUrl ? (
              <Image
                source={{ uri: clientPhotoUrl }}
                style={{ width: 26, height: 26, borderRadius: 13, marginRight: 8 }}
                contentFit="cover"
              />
            ) : (
              <View
                className="items-center justify-center"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  marginRight: 8,
                  backgroundColor: `${colors.primary}22`,
                }}
              >
                <Text className="text-xs font-bold" style={{ color: colors.primary }}>
                  {getInitials(displayName)}
                </Text>
              </View>
            )}
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              Shopping for {displayName}
            </Text>
          </View>

          <PlanFlowCloseButton
            onPress={() => setShowPlanCancelModal(true)}
            accessibilityLabel="Cancel plan shopping"
            testID="plan-shop-close"
          />
        </View>
      ) : null}

      <View className="flex-1 min-h-0">{children}</View>

      <View
        className="bg-background border-t border-border px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Animated.View className="flex-row items-center" style={footerAnimatedStyle}>
          <View
            ref={summaryTargetRef}
            collapsable={false}
            className="flex-1"
            onLayout={updateSummaryTargetRect}
          >
            <Text className="text-xs text-muted">
              {bundleCount > 0 ? `${bundleCount} bundle${bundleCount !== 1 ? "s" : ""}` : ""}
              {bundleCount > 0 && productCount > 0 ? " + " : ""}
              {productCount > 0 ? `${productCount} product${productCount !== 1 ? "s" : ""}` : ""}
              {bundleCount === 0 && productCount === 0 ? "No items yet" : ""}
            </Text>
            {subtotal > 0 && (
              <Text className="text-sm font-bold text-foreground">
                Total: ${subtotal.toFixed(2)}
              </Text>
            )}
          </View>
          <TouchableOpacity
            className={`px-6 py-3 rounded-xl ${itemCount > 0 ? "bg-primary" : "bg-surface border border-border"}`}
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Done shopping, review plan"
            testID="plan-shop-done"
          >
            <Text
              className={`font-semibold ${itemCount > 0 ? "text-background" : "text-foreground"}`}
            >
              {itemCount > 0 ? `Done (${itemCount})` : "Done"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <PlanFlowCancelModal
        visible={showPlanCancelModal}
        onDismiss={() => setShowPlanCancelModal(false)}
        clientName={displayName}
        itemCount={itemCount}
        onDiscardPlan={exitPlanDiscard}
      />
    </View>
  );
}
