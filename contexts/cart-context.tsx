import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export interface CartItem {
  id: string; // unique cart item id
  type: "bundle" | "product";
  bundleId?: number;
  productId?: number;
  title: string;
  trainer?: string;
  trainerId?: number;
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
  isInCart: (bundleId: number) => boolean;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "locomotivate_cart";

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
      // Check if bundle is already in cart
      const existing = prev.find((i) => i.bundleId === item.bundleId);
      if (existing) {
        // Update quantity instead of adding duplicate
        return prev.map((i) =>
          i.bundleId === item.bundleId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      // Add new item with unique id
      const newItem: CartItem = {
        ...item,
        id: `${item.bundleId}-${Date.now()}`,
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
    (bundleId: number) => items.some((item) => item.bundleId === bundleId),
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
