import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import {
  getCartAnimationApi,
  type CartAddAnimationOptions,
} from "@/contexts/cart-animation-context";
import type { ProposalCadenceCode } from "@/shared/saved-cart-proposal";

export interface CartItem {
  id: string; // unique cart item id
  type: "bundle" | "product" | "custom_product" | "service";
  bundleId?: string;
  productId?: string;
  customProductId?: string;
  title: string;
  description?: string;
  trainer?: string;
  trainerId?: string;
  price: number;
  cadence?: "one_time" | "weekly" | "monthly";
  fulfillment: "home_ship" | "trainer_delivery" | "vending" | "cafeteria";
  quantity: number;
  imageUrl?: string;
  shopifyVariantId?: number;
  shopifyProductId?: string;
  metadata?: Record<string, unknown> | null;
}

export interface CartProposalContext {
  proposalId?: string | null;
  clientRecordId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  startDate?: string | null;
  cadenceCode?: ProposalCadenceCode;
  sessionsPerWeek?: number;
  timePreference?: string | null;
  /** Program length in weeks; with sessions/week defines total scheduled sessions. */
  programWeeks?: number | null;
  /** Optional GBP per session for auto-added plan top-up line. */
  sessionCost?: number | null;
  /** Session length in minutes (schedule labels). */
  sessionDurationMinutes?: number | null;
  notes?: string | null;
  assistantPrompt?: string | null;
}

interface CartContextType {
  items: CartItem[];
  proposalContext: CartProposalContext | null;
  itemCount: number;
  subtotal: number;
  addItem: (
    item: Omit<CartItem, "id">,
    options?: CartAddAnimationOptions,
  ) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateFulfillment: (id: string, fulfillment: CartItem["fulfillment"]) => void;
  replaceItems: (items: Omit<CartItem, "id">[], proposalContext?: CartProposalContext | null) => void;
  setProposalContext: (value: CartProposalContext | null) => void;
  clearCart: () => void;
  isInCart: (bundleId: string) => boolean;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "locomotivate_cart";
const CART_PROPOSAL_CONTEXT_STORAGE_KEY = "locomotivate_cart_proposal_context";

function getCartItemKey(item: Pick<CartItem, "type" | "bundleId" | "productId" | "customProductId" | "shopifyVariantId" | "shopifyProductId" | "title" | "trainerId">) {
  if (item.type === "bundle" && item.bundleId) {
    return `bundle:${item.bundleId}`;
  }
  if (item.type === "product" && item.productId) {
    return `product:${item.productId}`;
  }
  if (item.type === "custom_product" && item.customProductId) {
    return `custom:${item.customProductId}`;
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
  const [proposalContext, setProposalContextState] = useState<CartProposalContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load cart from AsyncStorage on mount
  useEffect(() => {
    async function loadCart() {
      try {
        const [saved, savedProposalContext] = await Promise.all([
          AsyncStorage.getItem(CART_STORAGE_KEY),
          AsyncStorage.getItem(CART_PROPOSAL_CONTEXT_STORAGE_KEY),
        ]);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        }
        if (savedProposalContext) {
          const parsedProposalContext = JSON.parse(savedProposalContext);
          if (parsedProposalContext && typeof parsedProposalContext === "object") {
            setProposalContextState(parsedProposalContext);
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
      Promise.all([
        AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)),
        proposalContext
          ? AsyncStorage.setItem(
              CART_PROPOSAL_CONTEXT_STORAGE_KEY,
              JSON.stringify(proposalContext),
            )
          : AsyncStorage.removeItem(CART_PROPOSAL_CONTEXT_STORAGE_KEY),
      ]).catch((error) => {
        console.error("[Cart] Failed to save cart:", error);
      });
    }
  }, [items, proposalContext, isLoading]);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addItem = useCallback(
    (item: Omit<CartItem, "id">, options?: CartAddAnimationOptions) => {
      triggerHaptic("success");
      setItems((prev) => {
        const nextItemKey = getCartItemKey(item);
        const existing = prev.find((i) => getCartItemKey(i) === nextItemKey);
        if (existing) {
          return prev.map((i) =>
            getCartItemKey(i) === nextItemKey
              ? { ...i, quantity: i.quantity + item.quantity }
              : i,
          );
        }
        const newItem: CartItem = {
          ...item,
          id: `${nextItemKey}-${Date.now()}`,
        };
        return [...prev, newItem];
      });

      const animationApi = getCartAnimationApi();
      if (!animationApi) return;
      if (options?.flyFromRef) {
        animationApi.animateToPlanFooter(options);
        return;
      }
      animationApi.pulsePlanFooter();
      options?.onAnimationComplete?.();
    },
    [],
  );

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

  const replaceItems = useCallback(
    (nextItems: Omit<CartItem, "id">[], nextProposalContext: CartProposalContext | null = null) => {
      setItems(
        nextItems.map((item) => ({
          ...item,
          id: `${getCartItemKey(item)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        })),
      );
      setProposalContextState(nextProposalContext);
    },
    [],
  );

  const setProposalContext = useCallback((value: CartProposalContext | null) => {
    setProposalContextState(value);
  }, []);

  const clearCart = useCallback(() => {
    triggerHaptic("heavy");
    setItems([]);
    setProposalContextState(null);
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
          proposalContext,
        itemCount,
        subtotal,
        addItem,
        removeItem,
        updateQuantity,
        updateFulfillment,
          replaceItems,
          setProposalContext,
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
