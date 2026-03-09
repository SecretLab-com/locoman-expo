export type PhylloConnectStatus = "connected" | "cancelled" | "failed";

export type OpenPhylloConnectInput = {
  scriptUrl: string;
  environment: "sandbox" | "staging" | "production";
  userId: string;
  token: string;
  clientDisplayName: string;
};

export type OpenPhylloConnectResult = {
  status: PhylloConnectStatus;
  reason?: string;
  accountId?: string;
  workPlatformId?: string;
};

declare global {
  interface Window {
    PhylloConnect?: {
      initialize: (config: Record<string, any>) => {
        on: (event: string, callback: (...args: any[]) => void) => void;
        open: () => void;
      };
    };
    __phylloConnectScriptPromise?: Promise<void>;
  }
}

async function ensureScriptLoaded(scriptUrl: string): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Phyllo web connect is only available in browser context.");
  }
  if (window.PhylloConnect) return;
  if (window.__phylloConnectScriptPromise) {
    await window.__phylloConnectScriptPromise;
    return;
  }
  window.__phylloConnectScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-phyllo-sdk='1']`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Phyllo SDK.")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.defer = true;
    script.dataset.phylloSdk = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Phyllo SDK."));
    document.head.appendChild(script);
  });
  await window.__phylloConnectScriptPromise;
}

export async function openPhylloConnectWeb(
  input: OpenPhylloConnectInput,
): Promise<OpenPhylloConnectResult> {
  await ensureScriptLoaded(input.scriptUrl);
  if (!window.PhylloConnect?.initialize) {
    throw new Error("Phyllo SDK failed to initialize.");
  }

  const phylloConnect = window.PhylloConnect.initialize({
    environment: input.environment,
    userId: input.userId,
    token: input.token,
    clientDisplayName: input.clientDisplayName,
  });

  return await new Promise<OpenPhylloConnectResult>((resolve) => {
    let settled = false;
    let connectedAccountId = "";
    let connectedWorkPlatformId = "";
    let sawConnectedAccount = false;

    const finish = (result: OpenPhylloConnectResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    phylloConnect.on(
      "accountConnected",
      (
        accountId: string,
        workPlatformId: string,
        _userId: string,
        _platformName: string,
      ) => {
      sawConnectedAccount = true;
      connectedAccountId = String(accountId || "");
      connectedWorkPlatformId = String(workPlatformId || "");
      },
    );

    phylloConnect.on(
      "accountDisconnected",
      (
        _accountId: string,
        _workPlatformId: string,
        _userId: string,
        _platformName: string,
      ) => {
        // Required by Phyllo SDK callback validation.
      },
    );

    phylloConnect.on(
      "connectionFailure",
      (
        reason: string,
        _accountId: string,
        _workPlatformId: string,
        _userId: string,
      ) => {
        finish({ status: "failed", reason: String(reason || "connection_failed") });
      },
    );

    phylloConnect.on("tokenExpired", (_userId: string) => {
      finish({ status: "failed", reason: "token_expired" });
    });

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
      finish({ status: "failed", reason: String(error?.message || "open_failed") });
    }
  });
}

