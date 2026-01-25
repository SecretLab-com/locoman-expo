import { useState } from "react";
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

// Mock cart data - in production this would be managed by state/context
const INITIAL_CART = [
  {
    id: 1,
    bundleId: 1,
    title: "Full Body Transformation",
    price: 149.99,
    trainerName: "Sarah Johnson",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400",
    quantity: 1,
  },
  {
    id: 2,
    bundleId: 3,
    title: "Yoga for Beginners",
    price: 59.99,
    trainerName: "Emma Wilson",
    image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400",
    quantity: 1,
  },
];

type CartItem = (typeof INITIAL_CART)[0];

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
        <Image
          source={{ uri: item.image }}
          className="w-20 h-20 rounded-lg"
          contentFit="cover"
        />
        <View className="flex-1 ml-4">
          <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="text-sm text-muted mt-1">{item.trainerName}</Text>
          <Text className="text-lg font-bold text-primary mt-2">
            ${item.price.toFixed(2)}
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
  const [cartItems, setCartItems] = useState<CartItem[]>(INITIAL_CART);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + tax;

  const handleRemoveItem = (itemId: number) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setCartItems((items) => items.filter((item) => item.id !== itemId));
          },
        },
      ]
    );
  };

  const handleUpdateQuantity = (itemId: number, quantity: number) => {
    setCartItems((items) =>
      items.map((item) => (item.id === itemId ? { ...item, quantity } : item))
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
    // TODO: Implement checkout flow
    Alert.alert("Checkout", "Checkout functionality coming soon!");
  };

  if (cartItems.length === 0) {
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
        <Text className="text-sm text-muted">{cartItems.length} items</Text>
      </View>

      {/* Cart Items */}
      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <CartItemCard
            item={item}
            onRemove={() => handleRemoveItem(item.id)}
            onUpdateQuantity={(quantity) => handleUpdateQuantity(item.id, quantity)}
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
