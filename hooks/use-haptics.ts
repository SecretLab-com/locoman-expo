import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Haptic feedback utility hook
 * Provides consistent haptic feedback across the app
 * Automatically handles web platform (no haptics)
 */
export function useHaptics() {
  const isNative = Platform.OS !== "web";

  /**
   * Light impact - for button taps, list item selection
   */
  const lightImpact = async () => {
    if (isNative) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  /**
   * Medium impact - for toggle switches, confirmations
   */
  const mediumImpact = async () => {
    if (isNative) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  /**
   * Heavy impact - for significant actions, deletions
   */
  const heavyImpact = async () => {
    if (isNative) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  };

  /**
   * Selection changed - for picker/selection changes
   */
  const selectionChanged = async () => {
    if (isNative) {
      await Haptics.selectionAsync();
    }
  };

  /**
   * Success notification - for successful operations
   */
  const success = async () => {
    if (isNative) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  /**
   * Warning notification - for warnings
   */
  const warning = async () => {
    if (isNative) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  /**
   * Error notification - for errors
   */
  const error = async () => {
    if (isNative) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return {
    lightImpact,
    mediumImpact,
    heavyImpact,
    selectionChanged,
    success,
    warning,
    error,
    isNative,
  };
}

/**
 * Standalone haptic functions for use outside of React components
 */
export const haptics = {
  light: async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },
  medium: async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },
  heavy: async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  },
  selection: async () => {
    if (Platform.OS !== "web") {
      await Haptics.selectionAsync();
    }
  },
  success: async () => {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
  warning: async () => {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  },
  error: async () => {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },
};
