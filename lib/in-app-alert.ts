import { Alert, type AlertButton, type AlertOptions, Platform } from "react-native";

export type InAppAlertRequest = {
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

type AlertHandler = (request: InAppAlertRequest) => void;

let webAlertHandler: AlertHandler | null = null;

export function registerInAppAlertHandler(handler: AlertHandler) {
  webAlertHandler = handler;
  return () => {
    if (webAlertHandler === handler) {
      webAlertHandler = null;
    }
  };
}

export function installWebAlertOverride() {
  if (Platform.OS !== "web") {
    return () => {};
  }
  const originalAlert = Alert.alert.bind(Alert);
  Alert.alert = (title, message, buttons, options) => {
    if (webAlertHandler) {
      webAlertHandler({ title, message, buttons, options });
      return;
    }
    originalAlert(title, message, buttons, options);
  };
  return () => {
    Alert.alert = originalAlert;
  };
}

