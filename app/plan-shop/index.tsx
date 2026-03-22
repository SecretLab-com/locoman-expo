import { PlanFlowCancelModal } from "@/components/plan-flow-cancel-modal";
import {
  PLAN_FLOW_HEADER_SIDE_SLOT_WIDTH,
  PlanFlowCloseButton,
} from "@/components/plan-flow-close-button";
import { PlanShoppingShell } from "@/components/plan-shopping-shell";
import { useCart } from "@/contexts/cart-context";
import { useColors } from "@/hooks/use-colors";
import { normalizeAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";
import { Image } from "expo-image";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProductsScreen from "../(tabs)/products";

export default function PlanShopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ skipIntro?: string | string[] }>();
  const { itemCount, proposalContext, clearCart } = useCart();
  const skipIntroParam = Array.isArray(params.skipIntro) ? params.skipIntro[0] : params.skipIntro;
  const shouldSkipIntro = skipIntroParam === "1";
  const [showIntro, setShowIntro] = useState(!shouldSkipIntro);
  const [showPlanCancelModal, setShowPlanCancelModal] = useState(false);

  useEffect(() => {
    setShowIntro(!shouldSkipIntro);
  }, [shouldSkipIntro]);

  const clientName = proposalContext?.clientName || "";
  const clientId = proposalContext?.clientRecordId || "";
  const clientQuery = trpc.clients.detail.useQuery({ id: clientId }, { enabled: !!clientId });
  const clientPhotoUrl = useMemo(
    () => normalizeAssetUrl((clientQuery.data as any)?.photoUrl || (clientQuery.data as any)?.avatar),
    [clientQuery.data],
  );

  useEffect(() => {
    if (!clientId) {
      router.replace("/(trainer)/clients" as any);
    }
  }, [clientId]);

  const displayName = clientName || "Client";

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "C";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(trainer)/clients" as any);
    }
  };

  const openPlanCancelModal = () => setShowPlanCancelModal(true);

  const exitPlanDiscard = () => {
    setShowPlanCancelModal(false);
    setShowIntro(false);
    clearCart();
    goBack();
  };

  const handleDone = () => {
    router.push("/(trainer)/cart" as any);
  };

  if (!clientId) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-6">
        <Text className="text-sm text-muted text-center">
          Redirecting to your clients list to choose who this plan is for.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
          animation: "slide_from_bottom",
        }}
      />

      <PlanShoppingShell
        displayName={displayName}
        clientPhotoUrl={clientPhotoUrl}
        getInitials={getInitials}
        onDone={handleDone}
        onExitDiscard={() => {
          setShowIntro(false);
          clearCart();
          goBack();
        }}
      >
        <ProductsScreen planShopEmbedded />
      </PlanShoppingShell>

      {/* Step 1 Intro — X exits immediately (no confirm); shopping/review still use PlanFlowCancelModal. */}
      <Modal
        visible={showIntro}
        transparent
        animationType="fade"
        onRequestClose={exitPlanDiscard}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: colors.overlay,
          }}
        >
          <View
            className="bg-background rounded-3xl mx-6 overflow-hidden"
            style={{ maxWidth: 360, width: "90%" }}
          >
            <View className="flex-row items-center px-4 pt-3 pb-1">
              <View style={{ width: PLAN_FLOW_HEADER_SIDE_SLOT_WIDTH }} />
              <View className="flex-1" />
              <PlanFlowCloseButton
                onPress={exitPlanDiscard}
                accessibilityLabel="Cancel plan from intro"
                testID="plan-shop-intro-close"
              />
            </View>
            <View className="items-center pt-1 pb-4 px-6">
              <View
                className="w-20 h-20 rounded-full items-center justify-center mb-4 overflow-hidden"
                style={{ backgroundColor: `${colors.primary}15` }}
              >
                {clientPhotoUrl ? (
                  <Image
                    source={{ uri: clientPhotoUrl }}
                    style={{ width: 80, height: 80 }}
                    contentFit="cover"
                  />
                ) : (
                  <Text className="text-3xl font-bold text-primary">{getInitials(displayName)}</Text>
                )}
              </View>

              <View className="bg-primary/10 px-3 py-1 rounded-full mb-3">
                <Text className="text-xs font-semibold text-primary">Step 1</Text>
              </View>

              <Text className="text-xl font-bold text-foreground text-center mb-2">
                Shop for {displayName}
              </Text>
              <Text className="text-sm text-muted text-center leading-5">
                Browse bundles and products to build a personalized plan. You can set the schedule and send it in the next step.
              </Text>
            </View>

            <View className="px-6 pb-6 pt-2">
              <TouchableOpacity
                className="bg-primary rounded-xl py-4 items-center"
                onPress={() => setShowIntro(false)}
                accessibilityRole="button"
                accessibilityLabel="Start shopping"
                testID="plan-shop-intro-start"
              >
                <Text className="text-background font-semibold text-base">Start Shopping</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PlanFlowCancelModal
        visible={showPlanCancelModal}
        onDismiss={() => setShowPlanCancelModal(false)}
        clientName={displayName}
        itemCount={itemCount}
        onDiscardPlan={exitPlanDiscard}
      />
    </>
  );
}
