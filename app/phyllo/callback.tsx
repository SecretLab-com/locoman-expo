import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

type ConnectStatus = "connected" | "cancelled" | "failed";

function toStatus(value: unknown): ConnectStatus {
  const raw = String(value || "").toLowerCase();
  if (raw === "cancelled") return "cancelled";
  if (raw === "failed") return "failed";
  return "connected";
}

export default function PhylloCallbackScreen() {
  const params = useLocalSearchParams<{
    status?: string;
    reason?: string;
    returnTo?: string;
  }>();
  const utils = trpc.useUtils();
  const completeConnect = trpc.socialProgram.completeConnect.useMutation();
  const hasRunRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const run = async () => {
      const status = toStatus(params.status);
      const reason = params.reason ? String(params.reason) : undefined;
      try {
        await completeConnect.mutateAsync({ status, reason });
        await Promise.all([
          utils.socialProgram.myStatus.invalidate(),
          utils.socialProgram.myProgramDashboard.invalidate(),
        ]);
        const target = params.returnTo
          ? decodeURIComponent(String(params.returnTo))
          : "/(trainer)/social-progress";
        const separator = target.includes("?") ? "&" : "?";
        const reasonParam = reason
          ? `&reason=${encodeURIComponent(String(reason))}`
          : "";
        router.replace(`${target}${separator}phyllo=${status}${reasonParam}` as any);
      } catch (error: any) {
        setErrorMessage(String(error?.message || "Unable to finalize social connection."));
      }
    };
    void run();
  }, [completeConnect, params.reason, params.returnTo, params.status, utils.socialProgram.myProgramDashboard, utils.socialProgram.myStatus]);

  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-6">
        {errorMessage ? (
          <>
            <Text className="text-lg font-semibold text-error">Social connection failed</Text>
            <Text className="text-sm text-muted mt-2 text-center">{errorMessage}</Text>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" />
            <Text className="text-sm text-muted mt-3">Finalizing your connected platforms...</Text>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

