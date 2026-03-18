import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PromptOptions = {
  title: string;
  message?: string;
  defaultValue?: string;
  cancelText?: string;
  confirmText?: string;
};

function formatWebDialog(title: string, message?: string) {
  return message ? `${title}\n\n${message}` : title;
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(formatWebDialog(title, message));
    return;
  }

  Alert.alert(title, message);
}

export function confirm({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(formatWebDialog(title, message)));
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    Alert.alert(
      title,
      message,
      [
        {
          text: cancelText,
          style: 'cancel',
          onPress: () => finish(false),
        },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => finish(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => finish(false),
      },
    );
  });
}

export function prompt({
  title,
  message,
  defaultValue = '',
  cancelText = 'Cancel',
  confirmText = 'OK',
}: PromptOptions): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.prompt(formatWebDialog(title, message), defaultValue));
  }

  if (typeof Alert.prompt !== 'function') {
    notify(title, message);
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    Alert.prompt(
      title,
      message,
      [
        {
          text: cancelText,
          style: 'cancel',
          onPress: () => finish(null),
        },
        {
          text: confirmText,
          onPress: (value?: string) => finish(value ?? ''),
        },
      ],
      'plain-text',
      defaultValue,
    );
  });
}
