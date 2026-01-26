import { styled, Text, GetProps } from 'tamagui';

export const Badge = styled(Text, {
  name: 'Badge',
  paddingHorizontal: '$2',
  paddingVertical: '$1',
  borderRadius: '$2',
  fontSize: '$1',
  fontWeight: '500',
  textAlign: 'center',
  alignSelf: 'flex-start',

  variants: {
    variant: {
      default: {
        backgroundColor: '$primary',
        color: 'white',
      },
      secondary: {
        backgroundColor: '$muted',
        color: '$color',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '$borderColor',
        color: '$color',
      },
      success: {
        backgroundColor: '$successLight',
        color: '$success',
      },
      warning: {
        backgroundColor: '$warningLight',
        color: '$warning',
      },
      error: {
        backgroundColor: '$errorLight',
        color: '$error',
      },
      info: {
        backgroundColor: '$infoLight',
        color: '$info',
      },
      // Status badges
      pending: {
        backgroundColor: '$warningLight',
        color: '$warning',
      },
      approved: {
        backgroundColor: '$successLight',
        color: '$success',
      },
      rejected: {
        backgroundColor: '$errorLight',
        color: '$error',
      },
      active: {
        backgroundColor: '$successLight',
        color: '$success',
      },
      inactive: {
        backgroundColor: '$muted',
        color: '$mutedForeground',
      },
    },
    size: {
      sm: {
        paddingHorizontal: '$1',
        paddingVertical: 2,
        fontSize: 10,
      },
      md: {
        paddingHorizontal: '$2',
        paddingVertical: '$1',
        fontSize: '$1',
      },
      lg: {
        paddingHorizontal: '$3',
        paddingVertical: '$1',
        fontSize: '$2',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export type BadgeProps = GetProps<typeof Badge>;

// Helper function to get badge variant from status
export function getStatusBadgeVariant(status: string): BadgeProps['variant'] {
  const statusMap: Record<string, BadgeProps['variant']> = {
    pending: 'pending',
    pending_review: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    active: 'active',
    inactive: 'inactive',
    draft: 'secondary',
    published: 'success',
    archived: 'secondary',
  };
  return statusMap[status.toLowerCase()] || 'default';
}

export default Badge;
