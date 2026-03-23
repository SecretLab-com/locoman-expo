import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { AccessibilityInfo, type View } from "react-native";
import {
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { CartFlyOverlay } from "@/components/cart-fly-overlay";

export type CartAnimationRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CartAddAnimationOptions = {
  flyFromRef?: RefObject<View | null>;
  imageUri?: string | null;
  onAnimationComplete?: () => void;
};

export type CartFlyOverlayItem = {
  id: string;
  startRect: CartAnimationRect;
  targetRect: CartAnimationRect;
  imageUri?: string | null;
  onComplete?: () => void;
};

type CartAnimationApi = {
  animateToPlanFooter: (options?: CartAddAnimationOptions) => void;
  pulsePlanFooter: () => void;
};

type CartAnimationContextValue = {
  registerPlanFooterTarget: (node: View | null) => void;
  setPlanFooterFallbackRect: (rect: CartAnimationRect | null) => void;
  planFooterPulse: SharedValue<number>;
  reducedMotionEnabled: boolean;
};

const CartAnimationContext = createContext<CartAnimationContextValue | undefined>(
  undefined,
);

let cartAnimationApi: CartAnimationApi | null = null;

function isValidRect(rect: CartAnimationRect | null | undefined): rect is CartAnimationRect {
  return Boolean(
    rect &&
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      Number.isFinite(rect.width) &&
      Number.isFinite(rect.height) &&
      rect.width > 0 &&
      rect.height > 0,
  );
}

function measureNode(node: View | null): Promise<CartAnimationRect | null> {
  if (!node || typeof (node as any).measureInWindow !== "function") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    (node as any).measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        const rect = { x, y, width, height };
        resolve(isValidRect(rect) ? rect : null);
      },
    );
  });
}

function nextFlightId() {
  return `cart-flight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getCartAnimationApi() {
  return cartAnimationApi;
}

export function CartAnimationProvider({ children }: { children: ReactNode }) {
  const planFooterTargetRef = useRef<View | null>(null);
  const planFooterFallbackRectRef = useRef<CartAnimationRect | null>(null);
  const flightsRef = useRef<CartFlyOverlayItem[]>([]);
  const planFooterPulse = useSharedValue(0);
  const [flights, setFlights] = useState<CartFlyOverlayItem[]>([]);
  const [reducedMotionEnabled, setReducedMotionEnabled] = useState(false);

  useEffect(() => {
    flightsRef.current = flights;
  }, [flights]);

  const pulsePlanFooter = useCallback(() => {
    planFooterPulse.value = 0;
    planFooterPulse.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 220 }),
    );
  }, [planFooterPulse]);

  const animateToPlanFooter = useCallback(
    async (options?: CartAddAnimationOptions) => {
      const onComplete = options?.onAnimationComplete;
      const sourceNode = options?.flyFromRef?.current ?? null;

      if (reducedMotionEnabled) {
        pulsePlanFooter();
        onComplete?.();
        return;
      }

      const [startRect, measuredTargetRect] = await Promise.all([
        measureNode(sourceNode),
        measureNode(planFooterTargetRef.current),
      ]);

      const targetRect = measuredTargetRect ?? planFooterFallbackRectRef.current;
      if (!isValidRect(startRect) || !isValidRect(targetRect)) {
        pulsePlanFooter();
        onComplete?.();
        return;
      }

      setFlights((prev) => [
        ...prev,
        {
          id: nextFlightId(),
          startRect,
          targetRect,
          imageUri: options?.imageUri ?? null,
          onComplete,
        },
      ]);
    },
    [pulsePlanFooter, reducedMotionEnabled],
  );

  const handleFlightComplete = useCallback(
    (flightId: string) => {
      const completed = flightsRef.current.find((entry) => entry.id === flightId);
      setFlights((prev) => prev.filter((entry) => entry.id !== flightId));
      pulsePlanFooter();
      completed?.onComplete?.();
    },
    [pulsePlanFooter],
  );

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReducedMotionEnabled(Boolean(enabled));
        }
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener?.(
      "reduceMotionChanged",
      (enabled) => {
        setReducedMotionEnabled(Boolean(enabled));
      },
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    cartAnimationApi = {
      animateToPlanFooter,
      pulsePlanFooter,
    };
    return () => {
      if (cartAnimationApi?.animateToPlanFooter === animateToPlanFooter) {
        cartAnimationApi = null;
      }
    };
  }, [animateToPlanFooter, pulsePlanFooter]);

  const contextValue = useMemo<CartAnimationContextValue>(
    () => ({
      registerPlanFooterTarget: (node) => {
        planFooterTargetRef.current = node;
      },
      setPlanFooterFallbackRect: (rect) => {
        planFooterFallbackRectRef.current = rect;
      },
      planFooterPulse,
      reducedMotionEnabled,
    }),
    [planFooterPulse, reducedMotionEnabled],
  );

  return (
    <CartAnimationContext.Provider value={contextValue}>
      {children}
      <CartFlyOverlay flights={flights} onFlightComplete={handleFlightComplete} />
    </CartAnimationContext.Provider>
  );
}

export function useCartAnimation() {
  const context = useContext(CartAnimationContext);
  if (!context) {
    throw new Error("useCartAnimation must be used within a CartAnimationProvider");
  }
  return context;
}
