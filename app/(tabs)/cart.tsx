import {
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCart, CartItem } from "@/contexts/cart-context";

function CartItemCard({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}) {
  const colors = useColors();

  return (
    <View className="bg-surface rounded-xl p-4 mb-3 border border-border">
      <View className="flex-row">
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
          <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-sm text-muted mt-1">{item.trainer}</Text>
          <Text className="text-lg font-bold text-primary mt-2">
            ${item.price.toFixed(2)}
            {item.cadence !== "one_time" && (
              <Text className="text-muted text-sm font-normal">/{item.cadence}</Text>
            )}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-border">
        <View className="flex-row items-center">
          <TouchableOpacity
            className="w-8 h-8 rounded-full bg-background border border-border items-center justify-center"
            onPress={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
          >
            <IconSymbol name="minus" size={16} color={colors.foreground} />
          </TouchableOpacity>
          <Text className="mx-4 text-foreground font-semibold">{item.quantity}</Text>
          <TouchableOpacity
            className="w-8 h-8 rounded-full bg-background border border-border items-center justify-center"
            onPress={() => onUpdateQuantity(item.quantity + 1)}
          >
            <IconSymbol name="plus" size={16} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className="flex-row items-center"
          onPress={onRemove}
        >
          <IconSymbol name="trash.fill" size={18} color={colors.error} />
          <Text className="text-error ml-1">Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();
  const { items, subtotal, updateQuantity, removeItem, isLoading } = useCart();

  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeItem(itemId),
        },
      ]
    );
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please login to proceed with checkout",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Login", onPress: () => router.push("/login") },
        ]
      );
      return;
    }
    router.push("/checkout" as any);
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted">Loading cart...</Text>
      </ScreenContainer>
    );
  }

  if (items.length === 0) {
    return (
      <ScreenContainer className="items-center justify-center px-6">
        <IconSymbol name="cart.fill" size={64} color={colors.muted} />
        <Text className="text-xl font-semibold text-foreground mt-4">
          Your cart is empty
        </Text>
        <Text className="text-muted text-center mt-2">
          Browse our catalog to find amazing fitness programs
        </Text>
        <TouchableOpacity
          className="bg-primary px-6 py-3 rounded-full mt-6"
          onPress={() => router.push("/(tabs)")}
        >
          <Text className="text-background font-semibold">Browse Catalog</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View className="px-4 pt-2 pb-4">
        <Text className="text-2xl font-bold text-foreground">Your Cart</Text>
        <Text className="text-sm text-muted">{items.length} items</Text>
      </View>

      {/* Cart Items */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CartItemCard
            item={item}
            onRemove={() => handleRemoveItem(item.id)}
            onUpdateQuantity={(quantity) => updateQuantity(item.id, quantity)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Checkout Summary */}
      <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 pt-4 pb-8">
        <View className="flex-row justify-between mb-2">
          <Text className="text-muted">Subtotal</Text>
          <Text className="text-foreground">${subtotal.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between mb-2">
          <Text className="text-muted">Tax (8%)</Text>
          <Text className="text-foreground">${tax.toFixed(2)}</Text>
        </View>
        <View className="flex-row justify-between mb-4 pt-2 border-t border-border">
          <Text className="text-lg font-bold text-foreground">Total</Text>
          <Text className="text-lg font-bold text-primary">${total.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          className="bg-primary rounded-xl py-4 items-center"
          onPress={handleCheckout}
          activeOpacity={0.8}
        >
          <Text className="text-background font-semibold text-lg">
            Proceed to Checkout
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
