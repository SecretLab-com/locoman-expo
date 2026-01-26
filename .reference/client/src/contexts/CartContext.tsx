import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { triggerHaptic } from "@/hooks/useHaptic";

export interface CartItem {
  id: string; // unique cart item id
  bundleId: number;
  title: string;
  trainer: string;
  trainerId?: number;
  price: number;
  cadence: "one_time" | "weekly" | "monthly";
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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "locomotivate_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    // Load cart from localStorage on initial render
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addItem = useCallback((item: Omit<CartItem, "id">) => {
    triggerHaptic('success');
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
    triggerHaptic('warning');
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
    triggerHaptic('heavy');
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
