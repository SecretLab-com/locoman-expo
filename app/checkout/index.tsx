import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuthContext } from "@/contexts/auth-context";
import { useCart, type CartItem } from "@/contexts/cart-context";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { navigateToHome } from "@/lib/navigation";
import {
  buildSavedCartProposalSnapshot,
  cadenceToSessionsPerWeek,
  type ProposalCadenceCode,
  type SavedCartProposalSnapshot,
} from "@/shared/saved-cart-proposal";

const FULFILLMENT_OPTIONS = [
  { value: "home_ship" as const, label: "Home Shipping", icon: "shippingbox.fill", description: "Delivered to your address" },
  { value: "trainer_delivery" as const, label: "Trainer Delivery", icon: "person.fill", description: "Pick up from your trainer" },
  { value: "vending" as const, label: "Vending Machine", icon: "cube.fill", description: "Pick up at vending location" },
  { value: "cafeteria" as const, label: "Cafeteria", icon: "fork.knife", description: "Pick up at cafeteria" },
];

type ProposalCheckoutMeta = {
  title: string;
  notes: string | null;
  baseBundleDraftId: string | null;
  startDate: string | null;
  cadenceCode: ProposalCadenceCode;
  sessionsPerWeek: number;
  timePreference: string | null;
};

function mapSnapshotItemToCartItem(
  item: SavedCartProposalSnapshot["items"][number],
  index: number,
): CartItem {
  return {
    id: `${item.itemType}-${item.bundleDraftId || item.productId || item.customProductId || item.title}-${index}`,
    type: item.itemType,
    bundleId: item.bundleDraftId || undefined,
    productId: item.productId || undefined,
    customProductId: item.customProductId || undefined,
    title: item.title,
    description: item.description || undefined,
    trainer: "Trainer",
    price: item.unitPrice,
    quantity: item.quantity,
    imageUrl: item.imageUrl || undefined,
    cadence: item.itemType === "bundle" ? "weekly" : "one_time",
    fulfillment:
      (item.fulfillmentMethod as CartItem["fulfillment"]) || "trainer_delivery",
    metadata: item.metadata || null,
  };
}

function CartItemCard({
  item,
  onUpdateQuantity,
  onUpdateFulfillment,
  onRemove,
}: {
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onUpdateFulfillment: (fulfillment: CartItem["fulfillment"]) => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const [showFulfillment, setShowFulfillment] = useState(false);
  const supportsFulfillment = item.type !== "service";
  const availableFulfillmentOptions =
    item.type === "bundle" || item.type === "service"
      ? FULFILLMENT_OPTIONS.filter((option) => option.value === "trainer_delivery")
      : FULFILLMENT_OPTIONS;

  const currentFulfillment =
    availableFulfillmentOptions.find((f) => f.value === item.fulfillment) ||
    FULFILLMENT_OPTIONS.find((f) => f.value === item.fulfillment);

  return (
    <View className="bg-surface border border-border rounded-xl mb-4 overflow-hidden">
      <View className="flex-row p-4">
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            className="w-20 h-20 rounded-lg"
            contentFit="cover"
          />
        ) : (
          <View className="w-20 h-20 rounded-lg bg-primary/20 items-center justify-center">
            <IconSymbol name="bag.fill" size={28} color={colors.primary} />
          </View>
        )}

        <View className="flex-1 ml-4">
          <Text className="text-foreground font-semibold" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-muted text-sm mt-1">
            {item.trainer || (item.type === "service" ? "Service" : "Trainer")}
          </Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-primary font-bold text-lg">
              £{item.price.toFixed(2)}
              {item.cadence && item.cadence !== "one_time" ? (
                <Text className="text-muted text-sm font-normal">/{item.cadence}</Text>
              ) : null}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onRemove}
          className="p-2 -mr-2 -mt-2"
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.title} from checkout`}
          testID={`checkout-remove-${item.id}`}
        >
          <IconSymbol name="xmark.circle.fill" size={22} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between px-4 py-3 border-t border-border">
        <Text className="text-muted text-sm">Quantity</Text>
        <View className="flex-row items-center bg-background rounded-lg">
          <TouchableOpacity
            className="p-2"
            onPress={() => onUpdateQuantity(item.quantity - 1)}
            accessibilityRole="button"
            accessibilityLabel={`Decrease quantity for ${item.title}`}
            testID={`checkout-decrease-${item.id}`}
          >
            <IconSymbol name="minus" size={16} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-foreground font-medium w-8 text-center">
            {item.quantity}
          </Text>
          <TouchableOpacity
            className="p-2"
            onPress={() => onUpdateQuantity(item.quantity + 1)}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity for ${item.title}`}
            testID={`checkout-increase-${item.id}`}
          >
            <IconSymbol name="plus" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {supportsFulfillment ? (
        <>
          <TouchableOpacity
            className="flex-row items-center justify-between px-4 py-3 border-t border-border"
            onPress={() => setShowFulfillment(!showFulfillment)}
            accessibilityRole="button"
            accessibilityLabel={`Choose fulfillment method for ${item.title}`}
            testID={`checkout-fulfillment-toggle-${item.id}`}
          >
            <View className="flex-row items-center">
              <IconSymbol
                name={(currentFulfillment?.icon as any) || "shippingbox.fill"}
                size={18}
                color={colors.primary}
              />
              <View className="ml-3">
                <Text className="text-foreground text-sm font-medium">
                  {currentFulfillment?.label}
                </Text>
                <Text className="text-muted text-xs">
                  {currentFulfillment?.description}
                </Text>
              </View>
            </View>
            <IconSymbol
              name={showFulfillment ? "chevron.up" : "chevron.down"}
              size={16}
              color={colors.muted}
            />
          </TouchableOpacity>

          {showFulfillment ? (
            <View className="px-4 pb-4 gap-2">
              {availableFulfillmentOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  className={`flex-row items-center p-3 rounded-lg border ${
                    item.fulfillment === option.value
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  }`}
                  onPress={() => {
                    onUpdateFulfillment(option.value);
                    setShowFulfillment(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${option.label} for ${item.title}`}
                  testID={`checkout-fulfillment-${item.id}-${option.value}`}
                >
                  <IconSymbol
                    name={option.icon as any}
                    size={18}
                    color={
                      item.fulfillment === option.value ? colors.primary : colors.muted
                    }
                  />
                  <View className="ml-3 flex-1">
                    <Text
                      className={`text-sm font-medium ${
                        item.fulfillment === option.value
                          ? "text-primary"
                          : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </Text>
                    <Text className="text-muted text-xs">{option.description}</Text>
                  </View>
                  {item.fulfillment === option.value ? (
                    <IconSymbol
                      name="checkmark.circle.fill"
                      size={20}
                      color={colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

export default function CheckoutScreen() {
  const colors = useColors();
  const { invitationToken } = useLocalSearchParams<{ invitationToken?: string }>();
  const { isTrainer, isManager, isCoordinator, isClient } = useAuthContext();
  const {
    items,
    subtotal,
    updateQuantity,
    updateFulfillment,
    removeItem,
    clearCart,
  } = useCart();
  const [processing, setProcessing] = useState(false);
  const [proposalItems, setProposalItems] = useState<CartItem[]>([]);
  const [proposalMeta, setProposalMeta] = useState<ProposalCheckoutMeta | null>(null);
  const utils = trpc.useUtils();
  const browseCatalogRoute = isClient ? "/(client)/products" : "/(tabs)/products";
  const proposalInvitationQuery = trpc.catalog.invitation.useQuery(
    { token: invitationToken || "" },
    { enabled: Boolean(invitationToken) },
  );
  const proposalOrderMutation = trpc.orders.createFromProposal.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.orders.myOrders.invalidate(),
        utils.orders.list.invalidate(),
        utils.deliveries.myDeliveries.invalidate(),
      ]);
    },
  });
  const createOrder = trpc.orders.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.orders.myOrders.invalidate(),
        utils.orders.list.invalidate(),
        utils.deliveries.myDeliveries.invalidate(),
      ]);
    },
  });

  const proposalInvitation = proposalInvitationQuery.data as any;
  const isProposalFlow =
    Boolean(invitationToken) &&
    proposalInvitation?.invitationType === "saved_cart_proposal";

  useEffect(() => {
    if (!isProposalFlow || !proposalInvitation?.proposalSnapshot) return;
    const snapshot = proposalInvitation.proposalSnapshot as SavedCartProposalSnapshot;
    setProposalItems(snapshot.items.map((item, index) => mapSnapshotItemToCartItem(item, index)));
    setProposalMeta({
      title: proposalInvitation.bundleTitle || snapshot.title || "Saved Cart",
      notes: proposalInvitation.personalMessage || snapshot.notes || null,
      baseBundleDraftId: snapshot.baseBundleDraftId || null,
      startDate: snapshot.startDate || new Date().toISOString(),
      cadenceCode: snapshot.cadenceCode,
      sessionsPerWeek: snapshot.sessionsPerWeek,
      timePreference: snapshot.timePreference || null,
    });
  }, [isProposalFlow, proposalInvitation]);

  const activeItems = isProposalFlow ? proposalItems : items;
  const activeSubtotal = isProposalFlow
    ? proposalItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    : subtotal;
  const shippingFee = activeItems.some((item) => item.fulfillment === "home_ship")
    ? 5.99
    : 0;
  const tax = activeSubtotal * 0.08;
  const total = activeSubtotal + shippingFee + tax;

  const proposalPreview = useMemo(() => {
    if (!isProposalFlow || !proposalMeta) return null;
    return buildSavedCartProposalSnapshot({
      title: proposalMeta.title,
      notes: proposalMeta.notes,
      baseBundleDraftId: proposalMeta.baseBundleDraftId,
      startDate: proposalMeta.startDate,
      cadenceCode: proposalMeta.cadenceCode,
      sessionsPerWeek: proposalMeta.sessionsPerWeek,
      timePreference: proposalMeta.timePreference,
      items: proposalItems.map((item) => ({
        itemType: item.type,
        title: item.title,
        description: item.description || null,
        bundleDraftId: item.bundleId || null,
        productId: item.productId || null,
        customProductId: item.customProductId || null,
        imageUrl: item.imageUrl || null,
        quantity: item.quantity,
        unitPrice: item.price,
        fulfillmentMethod: item.type === "service" ? null : item.fulfillment,
        metadata: item.metadata || null,
      })),
    });
  }, [isProposalFlow, proposalItems, proposalMeta]);

  const updateProposalItemQuantity = (id: string, quantity: number) => {
    setProposalItems((prev) =>
      prev.flatMap((item) => {
        if (item.id !== id) return [item];
        if (quantity < 1) return [];
        if (item.type === "bundle") {
          return [{ ...item, quantity: 1 }];
        }
        return [{ ...item, quantity }];
      }),
    );
  };

  const updateProposalItemFulfillment = (
    id: string,
    fulfillment: CartItem["fulfillment"],
  ) => {
    setProposalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, fulfillment } : item)),
    );
  };

  const removeProposalItem = (id: string) => {
    setProposalItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.type === "bundle") {
        setProposalMeta((current) =>
          current ? { ...current, baseBundleDraftId: null } : current,
        );
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const openPaymentLink = async (payment: any) => {
    if (!payment?.required) return;
    const paymentLink = payment.paymentLink;
    if (paymentLink) {
      if (Platform.OS === "web") {
        if (window.confirm("Order submitted. Open payment page now?")) {
          await Linking.openURL(paymentLink);
        }
      } else {
        Alert.alert(
          "Complete Payment",
          "Your order was submitted. Complete payment now to confirm it.",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Pay Now",
              onPress: () => {
                void Linking.openURL(paymentLink);
              },
            },
          ],
        );
      }
    } else if (!payment?.configured) {
      Alert.alert(
        "Payment Pending",
        "Order submitted, but the payment provider is not configured. Payment remains pending.",
      );
    } else {
      Alert.alert(
        "Payment Pending",
        "Order submitted. Payment link generation failed; you can retry from order confirmation.",
      );
    }
  };

  const handlePlaceOrder = async () => {
    if (activeItems.length === 0) {
      Alert.alert("Empty Cart", "Please add items to your cart before checking out.");
      return;
    }

    Alert.alert(
      "Confirm Order",
      `Submit order for £${total.toFixed(2)}? Payment status will be pending until confirmed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Place Order",
          onPress: async () => {
            try {
              setProcessing(true);
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }

              let result: any;
              if (isProposalFlow && proposalMeta && invitationToken) {
                result = await proposalOrderMutation.mutateAsync({
                  invitationToken,
                  title: proposalMeta.title,
                  notes: proposalMeta.notes || undefined,
                  baseBundleDraftId: proposalMeta.baseBundleDraftId,
                  startDate: proposalMeta.startDate || undefined,
                  cadenceCode: proposalMeta.cadenceCode,
                  sessionsPerWeek: proposalMeta.sessionsPerWeek,
                  timePreference: proposalMeta.timePreference || undefined,
                  items: proposalItems.map((item) => ({
                    itemType: item.type,
                    title: item.title,
                    description: item.description || undefined,
                    bundleDraftId: item.bundleId || undefined,
                    productId: item.productId || undefined,
                    customProductId: item.customProductId || undefined,
                    imageUrl: item.imageUrl || undefined,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    fulfillmentMethod:
                      item.type === "service"
                        ? undefined
                        : (item.fulfillment as
                            | "home_ship"
                            | "trainer_delivery"
                            | "vending"
                            | "cafeteria"),
                    metadata: item.metadata || undefined,
                  })),
                  shippingAmount: shippingFee,
                  taxAmount: tax,
                });
              } else {
                result = await createOrder.mutateAsync({
                  items: items.map((item) => ({
                    title: item.title,
                    quantity: item.quantity,
                    bundleId: item.bundleId,
                    productId: item.productId,
                    customProductId: item.customProductId,
                    trainerId: item.trainerId,
                    unitPrice: item.price,
                    fulfillment: item.fulfillment,
                  })),
                  subtotalAmount: subtotal,
                  shippingAmount: shippingFee,
                  taxAmount: tax,
                  totalAmount: total,
                });
              }

              await openPaymentLink(result.payment);

              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              if (!isProposalFlow) {
                clearCart();
              }
              router.replace({
                pathname: "/checkout/confirmation",
                params: { orderId: result.orderId },
              } as any);
            } catch (error) {
              console.error("Failed to place order:", error);
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              Alert.alert("Error", "Failed to place order. Please try again.");
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  if (isTrainer && !isClient) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <IconSymbol name="cart.fill" size={64} color={colors.muted} />
        <Text className="text-xl font-semibold text-foreground mt-4">
          Checkout is client-only
        </Text>
        <Text className="text-muted text-center mt-2">
          Coordinators, managers, and trainers can review bundles but cannot purchase them.
        </Text>
        <TouchableOpacity
          className="bg-primary px-6 py-3 rounded-full mt-6"
          onPress={() =>
            navigateToHome({ isCoordinator, isManager, isTrainer, isClient })
          }
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          testID="checkout-back-home"
        >
          <Text className="text-background font-semibold">Back to Home</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  if (invitationToken && proposalInvitationQuery.isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading proposal checkout...</Text>
      </ScreenContainer>
    );
  }

  if (invitationToken && !proposalInvitation) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <IconSymbol name="exclamationmark.triangle.fill" size={48} color={colors.error} />
        <Text className="text-xl font-semibold text-foreground mt-4">
          Invalid Proposal Invite
        </Text>
        <Text className="text-muted text-center mt-2">
          This invite link is invalid or no longer available.
        </Text>
      </ScreenContainer>
    );
  }

  if (activeItems.length === 0) {
    return (
      <ScreenContainer>
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="flex-1 text-lg font-semibold text-foreground ml-2">
            Checkout
          </Text>
        </View>

        <View className="flex-1 items-center justify-center p-8">
          <IconSymbol name="cart.fill" size={64} color={colors.muted} />
          <Text className="text-xl font-semibold text-foreground mt-4">
            Your cart is empty
          </Text>
          <Text className="text-muted text-center mt-2">
            Browse products and categories to start your order
          </Text>
          <TouchableOpacity
            className="bg-primary px-8 py-3 rounded-full mt-6"
            onPress={() => router.replace(browseCatalogRoute as any)}
            accessibilityRole="button"
            accessibilityLabel="Browse products"
            testID="checkout-browse-products"
          >
            <Text className="text-background font-semibold">Browse Products</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-semibold text-foreground ml-2">
          {isProposalFlow ? "Review Proposal" : "Checkout"}
        </Text>
        <Text className="text-muted">{activeItems.length} items</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-4">
          <Text className="text-lg font-semibold text-foreground mb-4">
            {isProposalFlow ? "Proposed Items" : "Order Items"}
          </Text>
          {activeItems.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onUpdateQuantity={(qty) =>
                isProposalFlow
                  ? updateProposalItemQuantity(item.id, qty)
                  : updateQuantity(item.id, qty)
              }
              onUpdateFulfillment={(fulfillment) =>
                isProposalFlow
                  ? updateProposalItemFulfillment(item.id, fulfillment)
                  : updateFulfillment(item.id, fulfillment)
              }
              onRemove={() =>
                isProposalFlow ? removeProposalItem(item.id) : removeItem(item.id)
              }
            />
          ))}
        </View>

        {isProposalFlow && proposalPreview ? (
          <View className="mx-4 bg-surface border border-border rounded-xl p-4 mb-4">
            <Text className="text-lg font-semibold text-foreground mb-2">
              Auto-Projected Plan
            </Text>
            <Text className="text-sm text-muted mb-3">
              {proposalMeta?.cadenceCode || "weekly"} · {proposalPreview.projectedSchedule.length} sessions · {proposalPreview.projectedDeliveries.length} deliveries
            </Text>
            {proposalPreview.projectedSchedule.slice(0, 4).map((entry) => (
              <Text key={entry.index} className="text-xs text-foreground mb-1">
                {entry.label}: {new Date(entry.startsAt).toLocaleString()}
              </Text>
            ))}
            {proposalPreview.projectedDeliveries.slice(0, 4).map((entry, index) => (
              <Text key={`${entry.title}-${index}`} className="text-xs text-muted mb-1">
                Delivery: {entry.title} · {entry.projectedDate ? new Date(entry.projectedDate).toLocaleDateString() : "TBD"}
              </Text>
            ))}
          </View>
        ) : null}

        <View className="mx-4 bg-surface border border-border rounded-xl p-4 mb-4">
          <Text className="text-lg font-semibold text-foreground mb-4">
            Order Summary
          </Text>

          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Subtotal</Text>
            <Text className="text-foreground">£{activeSubtotal.toFixed(2)}</Text>
          </View>

          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Shipping</Text>
            <Text className="text-foreground">
              {shippingFee > 0 ? `£${shippingFee.toFixed(2)}` : "Free"}
            </Text>
          </View>

          <View className="flex-row justify-between mb-4">
            <Text className="text-muted">Tax (8%)</Text>
            <Text className="text-foreground">£{tax.toFixed(2)}</Text>
          </View>

          <View className="flex-row justify-between pt-4 border-t border-border">
            <Text className="text-foreground font-semibold text-lg">Total</Text>
            <Text className="text-primary font-bold text-lg">£{total.toFixed(2)}</Text>
          </View>
        </View>

        <View className="h-32" />
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-8">
        <TouchableOpacity
          className={`py-4 rounded-xl flex-row items-center justify-center ${
            processing ? "bg-primary/50" : "bg-primary"
          }`}
          onPress={handlePlaceOrder}
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel={`Place order for £${total.toFixed(2)}`}
          testID="checkout-place-order"
        >
          {processing ? (
            <>
              <ActivityIndicator size="small" color={colors.background} />
              <Text className="text-background font-semibold ml-2">Processing...</Text>
            </>
          ) : (
            <>
              <IconSymbol
                name="checkmark.circle.fill"
                size={20}
                color={colors.background}
              />
              <Text className="text-background font-semibold text-lg ml-2">
                Pay · £{total.toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
