import { ScreenContainer } from "@/components/screen-container";
import { openPhylloConnectWeb } from "@/lib/phyllo-connect";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";

function normalizeStatus(input: string): "connected" | "cancelled" | "failed" {
  const value = String(input || "").toLowerCase();
  if (value === "cancelled") return "cancelled";
  if (value === "failed") return "failed";
  return "connected";
}

export default function PhylloConnectBridgeScreen() {
  const params = useLocalSearchParams<{
    token?: string;
    userId?: string;
    environment?: string;
    clientDisplayName?: string;
    scriptUrl?: string;
    returnTo?: string;
  }>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const run = async () => {
      if (Platform.OS !== "web" || typeof window === "undefined") {
        setErrorMessage("Phyllo web bridge is only available on web.");
        return;
      }
      try {
        const token = String(params.token || "");
        const userId = String(params.userId || "");
        const scriptUrl = String(
          params.scriptUrl || "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js",
        );
        const environment =
          String(params.environment || "").toLowerCase() === "production"
            ? "production"
            : "sandbox";
        const clientDisplayName = String(params.clientDisplayName || "LocoMotivate");
        const returnTo = decodeURIComponent(String(params.returnTo || ""));
        if (!token || !userId || !returnTo) {
          throw new Error("Missing required Phyllo connect parameters.");
        }

        const result = await openPhylloConnectWeb({
          scriptUrl,
          environment,
          userId,
          token,
          clientDisplayName,
        });
        const status = normalizeStatus(result.status);
        const callbackUrl = new URL(returnTo);
        callbackUrl.searchParams.set("status", status);
        if (result.reason) callbackUrl.searchParams.set("reason", result.reason);
        if (result.accountId) callbackUrl.searchParams.set("accountId", result.accountId);
        if (result.workPlatformId) {
          callbackUrl.searchParams.set("workPlatformId", result.workPlatformId);
        }
        window.location.replace(callbackUrl.toString());
      } catch (error: any) {
        setErrorMessage(String(error?.message || "Could not start Phyllo connect flow."));
      }
    };
    void run();
  }, [params.clientDisplayName, params.environment, params.returnTo, params.scriptUrl, params.token, params.userId]);

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-6">
        {errorMessage ? (
          <>
            <Text className="text-lg font-semibold text-error">Phyllo connect error</Text>
            <Text className="text-sm text-muted mt-2 text-center">{errorMessage}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" />
            <Text className="text-sm text-muted mt-3 text-center">
              Opening Phyllo platform selection...
            </Text>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

