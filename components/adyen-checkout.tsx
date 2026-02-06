/**
 * Adyen Checkout Component
 *
 * Wraps the Adyen Drop-in for card payments and Apple Pay.
 * Requires a development build (not Expo Go) for native modules.
 *
 * Usage:
 * ```tsx
 * <AdyenCheckout
 *   sessionId="CS123..."
 *   sessionData="Ab12..."
 *   clientKey="test_CNSRG..."
 *   environment="test"
 *   onPaymentComplete={(result) => console.log(result)}
 *   onError={(error) => console.error(error)}
 * />
 * ```
 */
import { useColors } from "@/hooks/use-colors";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";

type PaymentResult = {
  resultCode: string;
  merchantReference?: string;
};

type AdyenCheckoutProps = {
  sessionId: string;
  sessionData: string;
  clientKey: string;
  environment: string;
  onPaymentComplete: (result: PaymentResult) => void;
  onError: (error: Error) => void;
};

export function AdyenCheckout({
  sessionId,
  sessionData,
  clientKey,
  environment,
  onPaymentComplete,
  onError,
}: AdyenCheckoutProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(true);
  const [nativeAvailable, setNativeAvailable] = useState(false);

  useEffect(() => {
    // Check if native Adyen module is available (requires dev build)
    try {
      // Dynamic import to avoid crash in Expo Go
      const AdyenModule = require("@adyen/react-native");
      if (AdyenModule?.AdyenCheckout) {
        setNativeAvailable(true);
      }
    } catch {
      setNativeAvailable(false);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-3">Loading payment form...</Text>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return (
      <AdyenWebCheckout
        sessionId={sessionId}
        sessionData={sessionData}
        clientKey={clientKey}
        environment={environment}
        onPaymentComplete={onPaymentComplete}
        onError={onError}
      />
    );
  }

  if (!nativeAvailable) {
    return (
      <View className="items-center justify-center py-8 px-4">
        <Text className="text-foreground font-semibold text-center mb-2">
          Native payment module not available
        </Text>
        <Text className="text-muted text-center text-sm">
          Card payments require a development build. Use a payment link instead,
          or build the app with EAS to enable native Adyen checkout.
        </Text>
      </View>
    );
  }

  // Native Adyen Drop-in would go here
  // This requires @adyen/react-native native modules
  return (
    <View className="items-center justify-center py-8">
      <Text className="text-foreground font-semibold">Adyen Drop-in</Text>
      <Text className="text-muted text-sm mt-1">Session: {sessionId.slice(0, 20)}...</Text>
    </View>
  );
}

/**
 * Web-only Adyen checkout using the Adyen Web SDK.
 * Loads the Drop-in via script tag.
 */
function AdyenWebCheckout({
  sessionId,
  sessionData,
  clientKey,
  environment,
  onPaymentComplete,
  onError,
}: AdyenCheckoutProps) {
  const colors = useColors();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Load Adyen Web SDK
    const script = document.createElement("script");
    script.src = "https://checkoutshopper-test.adyen.com/checkoutshopper/sdk/5.59.0/adyen.js";
    script.integrity = "";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://checkoutshopper-test.adyen.com/checkoutshopper/sdk/5.59.0/adyen.css";
      document.head.appendChild(link);

      try {
        const checkout = new (window as any).AdyenCheckout({
          environment,
          clientKey,
          session: { id: sessionId, sessionData },
          onPaymentCompleted: (result: any) => {
            onPaymentComplete({
              resultCode: result.resultCode,
            });
          },
          onError: (error: any) => {
            onError(new Error(error.message || "Payment failed"));
          },
        });

        checkout.create("dropin").mount("#adyen-dropin-container");
        setReady(true);
      } catch (err) {
        onError(err instanceof Error ? err : new Error("Failed to initialize Adyen"));
      }
    };
    script.onerror = () => {
      onError(new Error("Failed to load Adyen SDK"));
    };
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [sessionId, sessionData, clientKey, environment, onPaymentComplete, onError]);

  return (
    <View>
      {!ready && (
        <View className="items-center justify-center py-8">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="text-muted mt-3">Loading payment form...</Text>
        </View>
      )}
      <View nativeID="adyen-dropin-container" />
    </View>
  );
}
