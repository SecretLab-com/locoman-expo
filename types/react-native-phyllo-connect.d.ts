declare module "react-native-phyllo-connect" {
  type NativeConnectEvent =
    | "accountConnected"
    | "accountDisconnected"
    | "tokenExpired"
    | "exit"
    | "connectionFailure";

  type NativeConnectConfig = {
    clientDisplayName: string;
    token: string;
    userId: string;
    environment: "sandbox" | "production";
    workPlatformId?: string;
  };

  type NativeConnectInstance = {
    on: (event: NativeConnectEvent, callback: (...args: any[]) => void) => void;
    open: () => void;
    version: () => Record<string, string>;
  };

  type NativePhylloConnectModule = {
    initialize: (config: NativeConnectConfig) => NativeConnectInstance;
  };

  const PhylloConnect: NativePhylloConnectModule;
  export default PhylloConnect;
}
