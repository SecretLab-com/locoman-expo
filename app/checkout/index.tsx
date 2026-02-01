import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCart, CartItem } from "@/contexts/cart-context";
import * as Haptics from "expo-haptics";

const FULFILLMENT_OPTIONS = [
  { value: "home_ship" as const, label: "Home Shipping", icon: "shippingbox.fill", description: "Delivered to your address" },
  { value: "trainer_delivery" as const, label: "Trainer Delivery", icon: "person.fill", description: "Pick up from your trainer" },
  { value: "vending" as const, label: "Vending Machine", icon: "cube.fill", description: "Pick up at vending location" },
  { value: "cafeteria" as const, label: "Cafeteria", icon: "fork.knife", description: "Pick up at cafeteria" },
];

function CartItemCard({ item, onUpdateQuantity, onUpdateFulfillment, onRemove }: {
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onUpdateFulfillment: (fulfillment: CartItem["fulfillment"]) => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const [showFulfillment, setShowFulfillment] = useState(false);

  const currentFulfillment = FULFILLMENT_OPTIONS.find((f) => f.value === item.fulfillment);

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
          <Text className="text-foreground font-semibold" numberOfLines={2}>{item.title}</Text>
          <Text className="text-muted text-sm mt-1">by {item.trainer}</Text>
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-primary font-bold text-lg">
              ${item.price.toFixed(2)}
              {item.cadence !== "one_time" && (
                <Text className="text-muted text-sm font-normal">/{item.cadence}</Text>
              )}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={onRemove} className="p-2 -mr-2 -mt-2">
          <IconSymbol name="xmark.circle.fill" size={22} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Quantity Controls */}
      <View className="flex-row items-center justify-between px-4 py-3 border-t border-border">
        <Text className="text-muted text-sm">Quantity</Text>
        <View className="flex-row items-center bg-background rounded-lg">
          <TouchableOpacity
            className="p-2"
            onPress={() => onUpdateQuantity(item.quantity - 1)}
          >
            <IconSymbol name="minus" size={16} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="text-foreground font-medium w-8 text-center">{item.quantity}</Text>
          <TouchableOpacity
            className="p-2"
            onPress={() => onUpdateQuantity(item.quantity + 1)}
          >
            <IconSymbol name="plus" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Fulfillment Selection */}
      <TouchableOpacity
        className="flex-row items-center justify-between px-4 py-3 border-t border-border"
        onPress={() => setShowFulfillment(!showFulfillment)}
      >
        <View className="flex-row items-center">
          <IconSymbol name={currentFulfillment?.icon as any || "shippingbox.fill"} size={18} color={colors.primary} />
          <View className="ml-3">
            <Text className="text-foreground text-sm font-medium">{currentFulfillment?.label}</Text>
            <Text className="text-muted text-xs">{currentFulfillment?.description}</Text>
          </View>
        </View>
        <IconSymbol
          name={showFulfillment ? "chevron.up" : "chevron.down"}
          size={16}
          color={colors.muted}
        />
      </TouchableOpacity>

      {showFulfillment && (
        <View className="px-4 pb-4 gap-2">
          {FULFILLMENT_OPTIONS.map((option) => (
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
            >
              <IconSymbol
                name={option.icon as any}
                size={18}
                color={item.fulfillment === option.value ? colors.primary : colors.muted}
              />
              <View className="ml-3 flex-1">
                <Text
                  className={`text-sm font-medium ${
                    item.fulfillment === option.value ? "text-primary" : "text-foreground"
                  }`}
                >
                  {option.label}
                </Text>
                <Text className="text-muted text-xs">{option.description}</Text>
              </View>
              {item.fulfillment === option.value && (
                <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function CheckoutScreen() {
  const colors = useColors();
  const { items, subtotal, updateQuantity, updateFulfillment, removeItem, clearCart } = useCart();
  const [processing, setProcessing] = useState(false);

  const shippingFee = items.some((i) => i.fulfillment === "home_ship") ? 5.99 : 0;
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + shippingFee + tax;

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      Alert.alert("Empty Cart", "Please add items to your cart before checking out.");
      return;
    }

    Alert.alert(
      "Confirm Order",
      `Place order for $${total.toFixed(2)}?`,
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

              // TODO: Replace with actual API call
              // await trpc.orders.create.mutate({
              //   items: items.map(item => ({
              //     bundleId: item.bundleId,
              //     quantity: item.quantity,
              //     fulfillment: item.fulfillment,
              //   })),
              // });

              await new Promise((resolve) => setTimeout(resolve, 2000));

              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              clearCart();
              router.replace("/checkout/confirmation" as any);
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
      ]
    );
  };

  if (items.length === 0) {
    return (
      <ScreenContainer>
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="flex-1 text-lg font-semibold text-foreground ml-2">Checkout</Text>
        </View>

        <View className="flex-1 items-center justify-center p-8">
          <IconSymbol name="cart.fill" size={64} color={colors.muted} />
          <Text className="text-xl font-semibold text-foreground mt-4">Your cart is empty</Text>
          <Text className="text-muted text-center mt-2">
            Browse our catalog to find great fitness bundles
          </Text>
          <TouchableOpacity
            className="bg-primary px-8 py-3 rounded-full mt-6"
            onPress={() => router.replace("/(tabs)" as any)}
          >
            <Text className="text-background font-semibold">Browse Catalog</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="flex-1 text-lg font-semibold text-foreground ml-2">Checkout</Text>
        <Text className="text-muted">{items.length} items</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <View className="p-4">
          <Text className="text-lg font-semibold text-foreground mb-4">Order Items</Text>
          {items.map((item) => (
            <CartItemCard
              key={item.id}
              item={item}
              onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
              onUpdateFulfillment={(fulfillment) => updateFulfillment(item.id, fulfillment)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </View>

        {/* Order Summary */}
        <View className="mx-4 bg-surface border border-border rounded-xl p-4 mb-4">
          <Text className="text-lg font-semibold text-foreground mb-4">Order Summary</Text>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Subtotal</Text>
            <Text className="text-foreground">${subtotal.toFixed(2)}</Text>
          </View>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Shipping</Text>
            <Text className="text-foreground">
              {shippingFee > 0 ? `$${shippingFee.toFixed(2)}` : "Free"}
            </Text>
          </View>
          
          <View className="flex-row justify-between mb-4">
            <Text className="text-muted">Tax (8%)</Text>
            <Text className="text-foreground">${tax.toFixed(2)}</Text>
          </View>
          
          <View className="flex-row justify-between pt-4 border-t border-border">
            <Text className="text-foreground font-semibold text-lg">Total</Text>
            <Text className="text-primary font-bold text-lg">${total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Bottom Spacer */}
        <View className="h-32" />
      </ScrollView>

      {/* Place Order Button */}
      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border p-4 pb-8">
        <TouchableOpacity
          className={`py-4 rounded-xl flex-row items-center justify-center ${
            processing ? "bg-primary/50" : "bg-primary"
          }`}
          onPress={handlePlaceOrder}
          disabled={processing}
        >
          {processing ? (
            <>
              <ActivityIndicator size="small" color={colors.background} />
              <Text className="text-background font-semibold ml-2">Processing...</Text>
            </>
          ) : (
            <>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.background} />
              <Text className="text-background font-semibold text-lg ml-2">
                Place Order · ${total.toFixed(2)}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
