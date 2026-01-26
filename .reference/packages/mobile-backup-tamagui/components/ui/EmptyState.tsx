import { styled, YStack, Text, GetProps } from 'tamagui';
import { ReactNode } from 'react';
import { Button } from './Button';

// Empty state container
export const EmptyState = styled(YStack, {
  name: 'EmptyState',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '$6',
  gap: '$4',

  variants: {
    size: {
      sm: {
        padding: '$4',
        gap: '$3',
      },
      md: {
        padding: '$6',
        gap: '$4',
      },
      lg: {
        padding: '$8',
        gap: '$5',
      },
    },
  } as const,

  defaultVariants: {
    size: 'md',
  },
});

// Icon container
export const EmptyStateIcon = styled(YStack, {
  name: 'EmptyStateIcon',
  width: 80,
  height: 80,
  borderRadius: 40,
  backgroundColor: '$muted',
  alignItems: 'center',
  justifyContent: 'center',

  variants: {
    size: {
      sm: {
        width: 60,
        height: 60,
        borderRadius: 30,
      },
      md: {
        width: 80,
        height: 80,
        borderRadius: 40,
      },
      lg: {
        width: 100,
        height: 100,
        borderRadius: 50,
      },
    },
  } as const,
});

// Title
export const EmptyStateTitle = styled(Text, {
  name: 'EmptyStateTitle',
  fontSize: '$5',
  fontWeight: '600',
  color: '$color',
  textAlign: 'center',

  variants: {
    size: {
      sm: {
        fontSize: '$4',
      },
      md: {
        fontSize: '$5',
      },
      lg: {
        fontSize: '$6',
      },
    },
  } as const,
});

// Description
export const EmptyStateDescription = styled(Text, {
  name: 'EmptyStateDescription',
  fontSize: '$3',
  color: '$mutedForeground',
  textAlign: 'center',
  maxWidth: 300,

  variants: {
    size: {
      sm: {
        fontSize: '$2',
        maxWidth: 250,
      },
      md: {
        fontSize: '$3',
        maxWidth: 300,
      },
      lg: {
        fontSize: '$4',
        maxWidth: 400,
      },
    },
  } as const,
});

// Complete empty state component
interface EmptyStateBoxProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
    variant?: 'default' | 'secondary' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyStateBox({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
}: EmptyStateBoxProps) {
  return (
    <EmptyState size={size}>
      {icon && <EmptyStateIcon size={size}>{icon}</EmptyStateIcon>}
      <YStack gap="$2" alignItems="center">
        <EmptyStateTitle size={size}>{title}</EmptyStateTitle>
        {description && (
          <EmptyStateDescription size={size}>{description}</EmptyStateDescription>
        )}
      </YStack>
      {(action || secondaryAction) && (
        <YStack gap="$2" alignItems="center">
          {action && (
            <Button
              variant={action.variant || 'default'}
              onPress={action.onPress}
              size={size === 'sm' ? 'sm' : 'md'}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="link"
              onPress={secondaryAction.onPress}
              size={size === 'sm' ? 'sm' : 'md'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </YStack>
      )}
    </EmptyState>
  );
}

// Search empty state
interface SearchEmptyStateProps {
  query: string;
  onClear?: () => void;
}

export function SearchEmptyState({ query, onClear }: SearchEmptyStateProps) {
  return (
    <EmptyStateBox
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try adjusting your search.`}
      action={
        onClear
          ? {
              label: 'Clear search',
              onPress: onClear,
              variant: 'outline',
            }
          : undefined
      }
    />
  );
}

// Error empty state
interface ErrorEmptyStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorEmptyState({
  title = 'Something went wrong',
  message = 'An error occurred while loading. Please try again.',
  onRetry,
}: ErrorEmptyStateProps) {
  return (
    <EmptyStateBox
      title={title}
      description={message}
      action={
        onRetry
          ? {
              label: 'Try again',
              onPress: onRetry,
            }
          : undefined
      }
    />
  );
}

export type EmptyStateProps = GetProps<typeof EmptyState>;

export default EmptyState;
