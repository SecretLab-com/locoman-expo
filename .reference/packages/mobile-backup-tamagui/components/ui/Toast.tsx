import { styled, YStack, XStack, Text, AnimatePresence } from 'tamagui';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from '@tamagui/lucide-icons';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Button } from './Button';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

// Toast container
const ToastContainer = styled(YStack, {
  name: 'ToastContainer',
  position: 'absolute',
  bottom: '$4',
  left: '$4',
  right: '$4',
  gap: '$2',
  zIndex: 999999,
  pointerEvents: 'box-none',
});

// Individual toast
const ToastItem = styled(XStack, {
  name: 'ToastItem',
  backgroundColor: '$cardBackground',
  borderRadius: '$3',
  padding: '$3',
  gap: '$3',
  alignItems: 'flex-start',
  borderWidth: 1,
  borderColor: '$borderColor',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 12,
  elevation: 5,
  animation: 'fast',
  enterStyle: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  exitStyle: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },

  variants: {
    type: {
      success: {
        borderLeftWidth: 4,
        borderLeftColor: '$success',
      },
      error: {
        borderLeftWidth: 4,
        borderLeftColor: '$error',
      },
      warning: {
        borderLeftWidth: 4,
        borderLeftColor: '$warning',
      },
      info: {
        borderLeftWidth: 4,
        borderLeftColor: '$info',
      },
      default: {},
    },
  } as const,
});

const ToastIcon = ({ type }: { type: ToastType }) => {
  const iconProps = { size: 20 };
  
  switch (type) {
    case 'success':
      return <CheckCircle {...iconProps} color="$success" />;
    case 'error':
      return <AlertCircle {...iconProps} color="$error" />;
    case 'warning':
      return <AlertTriangle {...iconProps} color="$warning" />;
    case 'info':
      return <Info {...iconProps} color="$info" />;
    default:
      return null;
  }
};

const ToastTitle = styled(Text, {
  name: 'ToastTitle',
  fontSize: '$3',
  fontWeight: '600',
  color: '$color',
});

const ToastDescription = styled(Text, {
  name: 'ToastDescription',
  fontSize: '$2',
  color: '$mutedForeground',
  marginTop: '$1',
});

// Toast Context
interface ToastContextValue {
  toasts: Toast[];
  toast: (options: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Toast Provider
interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback(
    (options: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        id,
        duration: 4000,
        ...options,
      };

      setToasts((prev) => [...prev, newToast]);

      // Auto dismiss
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, newToast.duration);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, description?: string) => {
      toast({ type: 'success', title, description });
    },
    [toast]
  );

  const error = useCallback(
    (title: string, description?: string) => {
      toast({ type: 'error', title, description, duration: 6000 });
    },
    [toast]
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      toast({ type: 'warning', title, description });
    },
    [toast]
  );

  const info = useCallback(
    (title: string, description?: string) => {
      toast({ type: 'info', title, description });
    },
    [toast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, toast, success, error, warning, info, dismiss, dismissAll }}
    >
      {children}
      <ToastContainer>
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} type={t.type}>
              <ToastIcon type={t.type} />
              <YStack flex={1}>
                <ToastTitle>{t.title}</ToastTitle>
                {t.description && (
                  <ToastDescription>{t.description}</ToastDescription>
                )}
              </YStack>
              <Button
                variant="ghost"
                size="icon"
                onPress={() => dismiss(t.id)}
                padding="$1"
              >
                <X size={16} color="$mutedForeground" />
              </Button>
            </ToastItem>
          ))}
        </AnimatePresence>
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
