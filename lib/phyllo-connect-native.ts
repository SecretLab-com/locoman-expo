import { Platform } from "react-native";
import type { OpenPhylloConnectResult } from "@/lib/phyllo-connect";

type NativePhylloConnect = {
  initialize: (config: {
    clientDisplayName: string;
    token: string;
    userId: string;
    environment: "sandbox" | "staging" | "production";
    workPlatformId?: string;
  }) => {
    on: (event: string, callback: (...args: any[]) => void) => void;
    open: () => void;
  };
};

function getNativePhylloSdk(): NativePhylloConnect | null {
  if (Platform.OS === "web") return null;
  try {
    const moduleRef = require("react-native-phyllo-connect");
    return (moduleRef?.default || moduleRef) as NativePhylloConnect;
  } catch {
    return null;
  }
}

export function hasNativePhylloConnectSdk(): boolean {
  const sdk = getNativePhylloSdk();
  return Boolean(sdk?.initialize);
}

export async function openPhylloConnectNative(input: {
  environment: "sandbox" | "staging" | "production";
  userId: string;
  token: string;
  clientDisplayName: string;
}): Promise<OpenPhylloConnectResult> {
  const sdk = getNativePhylloSdk();
  if (!sdk?.initialize) {
    throw new Error("Native Phyllo SDK is unavailable in this build.");
  }

  const phylloConnect = sdk.initialize({
    environment: input.environment,
    userId: input.userId,
    token: input.token,
    clientDisplayName: input.clientDisplayName,
  });

  return await new Promise<OpenPhylloConnectResult>((resolve) => {
    let settled = false;
    let sawConnectedAccount = false;
    let connectedAccountId = "";
    let connectedWorkPlatformId = "";

    const finish = (result: OpenPhylloConnectResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    phylloConnect.on(
      "accountConnected",
      (accountId: string, workPlatformId: string, _userId: string) => {
        sawConnectedAccount = true;
        connectedAccountId = String(accountId || "");
        connectedWorkPlatformId = String(workPlatformId || "");
      },
    );
    phylloConnect.on(
      "accountDisconnected",
      (_accountId: string, _workPlatformId: string, _userId: string) => {
        // Required callback signature.
      },
    );
    phylloConnect.on("tokenExpired", (_userId: string) => {
      finish({ status: "failed", reason: "token_expired" });
    });
    phylloConnect.on(
      "connectionFailure",
      (reason: string, _workPlatformId: string, _userId: string) => {
        finish({
          status: "failed",
          reason: String(reason || "connection_failed"),
        });
      },
    );
    phylloConnect.on("exit", (reason: string, _userId: string) => {
      if (sawConnectedAccount) {
        finish({
          status: "connected",
          reason: String(reason || "exit"),
          accountId: connectedAccountId || undefined,
          workPlatformId: connectedWorkPlatformId || undefined,
        });
        return;
      }
      finish({ status: "cancelled", reason: String(reason || "exit") });
    });

    try {
      phylloConnect.open();
    } catch (error: any) {
      finish({
        status: "failed",
        reason: String(error?.message || "open_failed"),
      });
    }
  });
}
