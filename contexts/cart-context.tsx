import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export interface CartItem {
  id: string; // unique cart item id
  type: "bundle" | "product";
  bundleId?: string;
  productId?: string;
  title: string;
  trainer?: string;
  trainerId?: string;
  price: number;
  cadence?: "one_time" | "weekly" | "monthly";
  fulfillment: "home_ship" | "trainer_delivery" | "vending" | "cafeteria";
  quantity: number;
  imageUrl?: string;
  shopifyVariantId?: number;
  shopifyProductId?: string;
}

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateFulfillment: (id: string, fulfillment: CartItem["fulfillment"]) => void;
  clearCart: () => void;
  isInCart: (bundleId: string) => boolean;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "locomotivate_cart";

function getCartItemKey(item: Pick<CartItem, "type" | "bundleId" | "productId" | "shopifyVariantId" | "shopifyProductId" | "title" | "trainerId">) {
  if (item.type === "bundle" && item.bundleId) {
    return `bundle:${item.bundleId}`;
  }
  if (item.type === "product" && item.productId) {
    return `product:${item.productId}`;
  }
  if (item.shopifyVariantId != null) {
    return `variant:${item.shopifyVariantId}`;
  }
  if (item.shopifyProductId) {
    return `shopify:${item.shopifyProductId}`;
  }
  return `${item.type}:${item.title}:${item.trainerId || "global"}`;
}

function triggerHaptic(type: "success" | "warning" | "heavy") {
  if (Platform.OS === "web") return;
  
  switch (type) {
    case "success":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case "warning":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case "heavy":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load cart from AsyncStorage on mount
  useEffect(() => {
    async function loadCart() {
      try {
        const saved = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        }
      } catch (error) {
        console.error("[Cart] Failed to load cart:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadCart();
  }, []);

  // Persist cart to AsyncStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch((error) => {
        console.error("[Cart] Failed to save cart:", error);
      });
    }
  }, [items, isLoading]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    triggerHaptic("success");
    setItems((prev) => {
      const nextItemKey = getCartItemKey(item);
      const existing = prev.find((i) => getCartItemKey(i) === nextItemKey);
      if (existing) {
        return prev.map((i) =>
          getCartItemKey(i) === nextItemKey
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      const newItem: CartItem = {
        ...item,
        id: `${nextItemKey}-${Date.now()}`,
      };
      return [...prev, newItem];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    triggerHaptic("warning");
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  }, [removeItem]);

  const updateFulfillment = useCallback(
    (id: string, fulfillment: CartItem["fulfillment"]) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, fulfillment } : item))
      );
    },
    []
  );

  const clearCart = useCallback(() => {
    triggerHaptic("heavy");
    setItems([]);
  }, []);

  const isInCart = useCallback(
    (bundleId: string) =>
      items.some((item) => getCartItemKey(item) === `bundle:${bundleId}`),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        updateFulfillment,
        clearCart,
        isInCart,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
