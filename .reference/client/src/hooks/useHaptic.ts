/**
 * Haptic feedback utility hook
 * Provides haptic feedback for mobile devices using the Vibration API
 * Falls back gracefully on unsupported devices
 */

type HapticType = 
  | 'light'      // Light tap - tab switches, minor interactions
  | 'medium'     // Medium tap - button clicks, selections
  | 'heavy'      // Heavy tap - important actions, confirmations
  | 'success'    // Success pattern - order complete, form success
  | 'warning'    // Warning pattern - validation errors
  | 'error'      // Error pattern - failures, critical errors
  | 'selection'; // Selection change - toggles, radio buttons

// Vibration patterns in milliseconds
// [vibrate, pause, vibrate, pause, ...]
const hapticPatterns: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [30, 50, 30],
  warning: [50, 30, 50],
  error: [100, 50, 100, 50, 100],
  selection: 15,
};

// Check if haptic feedback is supported
const isHapticSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'vibrate' in navigator;
};

// Check if iOS with haptic support (iPhone 7+)
const isIOSWithHaptic = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && 'vibrate' in navigator;
};

/**
 * Trigger haptic feedback
 * @param type - The type of haptic feedback to trigger
 */
export const triggerHaptic = (type: HapticType = 'medium'): void => {
  if (!isHapticSupported()) return;
  
  try {
    const pattern = hapticPatterns[type];
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail if vibration is not allowed
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Hook for haptic feedback
 * Returns functions to trigger different types of haptic feedback
 */
export function useHaptic() {
  const supported = isHapticSupported();
  const isIOS = isIOSWithHaptic();

  return {
    /** Whether haptic feedback is supported on this device */
    supported,
    /** Whether this is an iOS device with haptic support */
    isIOS,
    
    /** Light tap - for minor interactions like tab switches */
    light: () => triggerHaptic('light'),
    
    /** Medium tap - for button clicks and selections */
    medium: () => triggerHaptic('medium'),
    
    /** Heavy tap - for important actions and confirmations */
    heavy: () => triggerHaptic('heavy'),
    
    /** Success pattern - for completed actions */
    success: () => triggerHaptic('success'),
    
    /** Warning pattern - for validation errors */
    warning: () => triggerHaptic('warning'),
    
    /** Error pattern - for failures */
    error: () => triggerHaptic('error'),
    
    /** Selection change - for toggles and radio buttons */
    selection: () => triggerHaptic('selection'),
    
    /** Generic trigger with custom type */
    trigger: triggerHaptic,
  };
}

export default useHaptic;
