import { styled, XStack, YStack, Text, GetProps } from 'tamagui';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from '@tamagui/lucide-icons';
import { ReactNode } from 'react';
import { Button } from './Button';

// Alert container
export const Alert = styled(XStack, {
  name: 'Alert',
  padding: '$3',
  borderRadius: '$3',
  gap: '$3',
  alignItems: 'flex-start',
  borderWidth: 1,

  variants: {
    variant: {
      default: {
        backgroundColor: '$muted',
        borderColor: '$borderColor',
      },
      success: {
        backgroundColor: '$successLight',
        borderColor: '$success',
      },
      warning: {
        backgroundColor: '$warningLight',
        borderColor: '$warning',
      },
      error: {
        backgroundColor: '$errorLight',
        borderColor: '$error',
      },
      info: {
        backgroundColor: '$infoLight',
        borderColor: '$info',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
  },
});

// Alert Title
export const AlertTitle = styled(Text, {
  name: 'AlertTitle',
  fontSize: '$3',
  fontWeight: '600',
  color: '$color',
});

// Alert Description
export const AlertDescription = styled(Text, {
  name: 'AlertDescription',
  fontSize: '$2',
  color: '$mutedForeground',
  marginTop: '$1',
});

// Icon mapping
const iconMap = {
  default: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
  info: Info,
};

const iconColorMap = {
  default: '$color',
  success: '$success',
  warning: '$warning',
  error: '$error',
  info: '$info',
};

// Complete Alert component
interface AlertBoxProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  title?: string;
  description?: string;
  children?: ReactNode;
  icon?: ReactNode;
  showIcon?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: ReactNode;
}

export function AlertBox({
  variant = 'default',
  title,
  description,
  children,
  icon,
  showIcon = true,
  dismissible = false,
  onDismiss,
  action,
}: AlertBoxProps) {
  const Icon = iconMap[variant];
  const iconColor = iconColorMap[variant];

  return (
    <Alert variant={variant}>
      {showIcon && (
        icon || <Icon size={20} color={iconColor} />
      )}
      <YStack flex={1} gap="$1">
        {title && <AlertTitle>{title}</AlertTitle>}
        {description && <AlertDescription>{description}</AlertDescription>}
        {children}
        {action && <XStack marginTop="$2">{action}</XStack>}
      </YStack>
      {dismissible && onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onPress={onDismiss}
          padding="$1"
        >
          <X size={16} color="$mutedForeground" />
        </Button>
      )}
    </Alert>
  );
}

// Inline alert for form fields
interface InlineAlertProps {
  variant?: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

export function InlineAlert({ variant = 'error', message }: InlineAlertProps) {
  const Icon = iconMap[variant];
  const iconColor = iconColorMap[variant];

  return (
    <XStack gap="$1" alignItems="center">
      <Icon size={14} color={iconColor} />
      <Text fontSize="$1" color={iconColor}>
        {message}
      </Text>
    </XStack>
  );
}

// Banner alert (full width, no border radius)
export const AlertBanner = styled(XStack, {
  name: 'AlertBanner',
  padding: '$3',
  gap: '$3',
  alignItems: 'center',
  justifyContent: 'center',

  variants: {
    variant: {
      default: {
        backgroundColor: '$muted',
      },
      success: {
        backgroundColor: '$success',
      },
      warning: {
        backgroundColor: '$warning',
      },
      error: {
        backgroundColor: '$error',
      },
      info: {
        backgroundColor: '$info',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'info',
  },
});

export const AlertBannerText = styled(Text, {
  name: 'AlertBannerText',
  fontSize: '$2',
  fontWeight: '500',
  color: 'white',
  textAlign: 'center',
});

export type AlertProps = GetProps<typeof Alert>;

export default Alert;
