import { styled, YStack, XStack, Text, GetProps } from 'tamagui';

// Card container
export const Card = styled(YStack, {
  name: 'Card',
  backgroundColor: '$cardBackground',
  borderRadius: '$4',
  borderWidth: 1,
  borderColor: '$cardBorder',
  overflow: 'hidden',
  
  variants: {
    variant: {
      default: {},
      elevated: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
      },
      outline: {
        backgroundColor: 'transparent',
      },
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
    },
    size: {
      sm: {
        padding: '$3',
      },
      md: {
        padding: '$4',
      },
      lg: {
        padding: '$5',
      },
    },
    pressable: {
      true: {
        cursor: 'pointer',
        pressStyle: {
          opacity: 0.9,
          scale: 0.99,
        },
        hoverStyle: {
          borderColor: '$primary',
        },
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

// Card Header
export const CardHeader = styled(YStack, {
  name: 'CardHeader',
  gap: '$2',
  paddingBottom: '$3',
});

// Card Title
export const CardTitle = styled(Text, {
  name: 'CardTitle',
  fontSize: '$5',
  fontWeight: '600',
  color: '$color',
});

// Card Description
export const CardDescription = styled(Text, {
  name: 'CardDescription',
  fontSize: '$3',
  color: '$mutedForeground',
});

// Card Content
export const CardContent = styled(YStack, {
  name: 'CardContent',
  gap: '$3',
});

// Card Footer
export const CardFooter = styled(XStack, {
  name: 'CardFooter',
  paddingTop: '$3',
  gap: '$3',
  alignItems: 'center',
  justifyContent: 'flex-end',
});

// Export types
export type CardProps = GetProps<typeof Card>;
export type CardHeaderProps = GetProps<typeof CardHeader>;
export type CardTitleProps = GetProps<typeof CardTitle>;
export type CardDescriptionProps = GetProps<typeof CardDescription>;
export type CardContentProps = GetProps<typeof CardContent>;
export type CardFooterProps = GetProps<typeof CardFooter>;
