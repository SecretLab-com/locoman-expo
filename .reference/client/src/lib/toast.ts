/**
 * Haptic-enabled toast utility
 * Wraps sonner toast functions with haptic feedback
 */

import { toast as sonnerToast, ExternalToast } from 'sonner';
import { triggerHaptic } from '@/hooks/useHaptic';

type ToastData = ExternalToast & {
  /** Disable haptic feedback for this toast */
  noHaptic?: boolean;
};

/**
 * Toast with haptic feedback
 * Automatically triggers appropriate haptic feedback based on toast type
 */
export const toast = {
  /** Default toast with light haptic */
  default: (message: string | React.ReactNode, data?: ToastData) => {
    if (!data?.noHaptic) triggerHaptic('light');
    return sonnerToast(message, data);
  },

  /** Success toast with success haptic pattern */
  success: (message: string | React.ReactNode, data?: ToastData) => {
    if (!data?.noHaptic) triggerHaptic('success');
    return sonnerToast.success(message, data);
  },

  /** Error toast with error haptic pattern */
  error: (message: string | React.ReactNode, data?: ToastData) => {
    if (!data?.noHaptic) triggerHaptic('error');
    return sonnerToast.error(message, data);
  },

  /** Warning toast with warning haptic pattern */
  warning: (message: string | React.ReactNode, data?: ToastData) => {
    if (!data?.noHaptic) triggerHaptic('warning');
    return sonnerToast.warning(message, data);
  },

  /** Info toast with light haptic */
  info: (message: string | React.ReactNode, data?: ToastData) => {
    if (!data?.noHaptic) triggerHaptic('light');
    return sonnerToast.info(message, data);
  },

  /** Loading toast - no haptic (will be followed by success/error) */
  loading: (message: string | React.ReactNode, data?: ToastData) => {
    return sonnerToast.loading(message, data);
  },

  /** Promise toast with haptic on resolve/reject */
  promise: <T,>(
    promise: Promise<T> | (() => Promise<T>),
    data: {
      loading: string | React.ReactNode;
      success: string | React.ReactNode | ((data: T) => string | React.ReactNode);
      error: string | React.ReactNode | ((error: unknown) => string | React.ReactNode);
    } & ToastData
  ) => {
    const wrappedPromise = typeof promise === 'function' ? promise() : promise;
    
    wrappedPromise
      .then(() => {
        if (!data?.noHaptic) triggerHaptic('success');
      })
      .catch(() => {
        if (!data?.noHaptic) triggerHaptic('error');
      });

    return sonnerToast.promise(wrappedPromise, data);
  },

  /** Dismiss a toast */
  dismiss: sonnerToast.dismiss,

  /** Custom toast - no automatic haptic */
  custom: sonnerToast.custom,

  /** Message toast (alias for default) */
  message: (message: string | React.ReactNode, data?: ToastData) => {
    if (!data?.noHaptic) triggerHaptic('light');
    return sonnerToast.message(message, data);
  },
};

export default toast;
