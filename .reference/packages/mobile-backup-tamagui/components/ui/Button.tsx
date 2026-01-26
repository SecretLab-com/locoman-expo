import { styled, GetProps, Button as TamaguiButton, Spinner } from 'tamagui';
import { forwardRef } from 'react';

// Styled button variants
const StyledButton = styled(TamaguiButton, {
  name: 'Button',
  borderRadius: '$4',
  paddingHorizontal: '$4',
  paddingVertical: '$3',
  fontWeight: '600',
  fontSize: '$3',
  pressStyle: {
    opacity: 0.9,
    scale: 0.98,
  },
  animation: 'fast',

  variants: {
    variant: {
      default: {
        backgroundColor: '$primary',
        color: 'white',
        hoverStyle: {
          backgroundColor: '$primaryHover',
        },
      },
      secondary: {
        backgroundColor: '$muted',
        color: '$color',
        hoverStyle: {
          backgroundColor: '$backgroundHover',
        },
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '$borderColor',
        color: '$color',
        hoverStyle: {
          backgroundColor: '$backgroundHover',
        },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '$color',
        hoverStyle: {
          backgroundColor: '$backgroundHover',
        },
      },
      destructive: {
        backgroundColor: '$error',
        color: 'white',
        hoverStyle: {
          backgroundColor: '$errorDark',
        },
      },
      success: {
        backgroundColor: '$success',
        color: 'white',
        hoverStyle: {
          backgroundColor: '$successDark',
        },
      },
      link: {
        backgroundColor: 'transparent',
        color: '$primary',
        paddingHorizontal: 0,
        paddingVertical: 0,
        hoverStyle: {
          textDecorationLine: 'underline',
        },
      },
    },
    size: {
      sm: {
        height: 36,
        paddingHorizontal: '$3',
        fontSize: '$2',
      },
      md: {
        height: 44,
        paddingHorizontal: '$4',
        fontSize: '$3',
      },
      lg: {
        height: 52,
        paddingHorizontal: '$5',
        fontSize: '$4',
      },
      icon: {
        width: 44,
        height: 44,
        padding: 0,
      },
    },
    fullWidth: {
      true: {
        width: '100%',
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
        pointerEvents: 'none',
      },
    },
  } as const,

  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

type ButtonProps = GetProps<typeof StyledButton> & {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export const Button = forwardRef<typeof StyledButton, ButtonProps>(
  ({ children, loading, leftIcon, rightIcon, disabled, ...props }, ref) => {
    return (
      <StyledButton
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Spinner size="small" color="$color" />
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </StyledButton>
    );
  }
);

Button.displayName = 'Button';

export default Button;
