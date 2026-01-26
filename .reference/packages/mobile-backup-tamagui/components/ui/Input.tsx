import { styled, Input as TamaguiInput, TextArea as TamaguiTextArea, GetProps, YStack, Text, XStack } from 'tamagui';
import { forwardRef } from 'react';

// Styled Input
export const StyledInput = styled(TamaguiInput, {
  name: 'Input',
  backgroundColor: '$background',
  borderWidth: 1,
  borderColor: '$borderColor',
  borderRadius: '$3',
  paddingHorizontal: '$3',
  paddingVertical: '$2',
  fontSize: '$3',
  color: '$color',
  placeholderTextColor: '$placeholderColor',
  
  focusStyle: {
    borderColor: '$primary',
    outlineColor: '$primary',
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineOffset: 2,
  },

  variants: {
    size: {
      sm: {
        height: 36,
        fontSize: '$2',
        paddingHorizontal: '$2',
      },
      md: {
        height: 44,
        fontSize: '$3',
      },
      lg: {
        height: 52,
        fontSize: '$4',
        paddingHorizontal: '$4',
      },
    },
    error: {
      true: {
        borderColor: '$error',
        focusStyle: {
          borderColor: '$error',
          outlineColor: '$error',
        },
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
        backgroundColor: '$muted',
        pointerEvents: 'none',
      },
    },
  } as const,

  defaultVariants: {
    size: 'md',
  },
});

// Styled TextArea
export const StyledTextArea = styled(TamaguiTextArea, {
  name: 'TextArea',
  backgroundColor: '$background',
  borderWidth: 1,
  borderColor: '$borderColor',
  borderRadius: '$3',
  padding: '$3',
  fontSize: '$3',
  color: '$color',
  placeholderTextColor: '$placeholderColor',
  minHeight: 100,
  
  focusStyle: {
    borderColor: '$primary',
    outlineColor: '$primary',
    outlineWidth: 2,
    outlineStyle: 'solid',
    outlineOffset: 2,
  },

  variants: {
    error: {
      true: {
        borderColor: '$error',
        focusStyle: {
          borderColor: '$error',
          outlineColor: '$error',
        },
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
        backgroundColor: '$muted',
        pointerEvents: 'none',
      },
    },
  } as const,
});

// Label component
export const Label = styled(Text, {
  name: 'Label',
  fontSize: '$2',
  fontWeight: '500',
  color: '$color',
  marginBottom: '$1',
});

// Helper/Error text
export const HelperText = styled(Text, {
  name: 'HelperText',
  fontSize: '$1',
  marginTop: '$1',
  
  variants: {
    error: {
      true: {
        color: '$error',
      },
      false: {
        color: '$mutedForeground',
      },
    },
  } as const,
});

// Input with label and error handling
type InputProps = GetProps<typeof StyledInput> & {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export const Input = forwardRef<typeof StyledInput, InputProps>(
  ({ label, helperText, errorMessage, leftIcon, rightIcon, error, ...props }, ref) => {
    const hasError = !!errorMessage || error;

    return (
      <YStack gap="$1">
        {label && <Label>{label}</Label>}
        <XStack alignItems="center" position="relative">
          {leftIcon && (
            <YStack position="absolute" left="$3" zIndex={1}>
              {leftIcon}
            </YStack>
          )}
          <StyledInput
            ref={ref}
            error={hasError}
            paddingLeft={leftIcon ? '$10' : undefined}
            paddingRight={rightIcon ? '$10' : undefined}
            flex={1}
            {...props}
          />
          {rightIcon && (
            <YStack position="absolute" right="$3" zIndex={1}>
              {rightIcon}
            </YStack>
          )}
        </XStack>
        {(errorMessage || helperText) && (
          <HelperText error={hasError}>
            {errorMessage || helperText}
          </HelperText>
        )}
      </YStack>
    );
  }
);

Input.displayName = 'Input';

// TextArea with label and error handling
type TextAreaProps = GetProps<typeof StyledTextArea> & {
  label?: string;
  helperText?: string;
  errorMessage?: string;
};

export const TextArea = forwardRef<typeof StyledTextArea, TextAreaProps>(
  ({ label, helperText, errorMessage, error, ...props }, ref) => {
    const hasError = !!errorMessage || error;

    return (
      <YStack gap="$1">
        {label && <Label>{label}</Label>}
        <StyledTextArea ref={ref} error={hasError} {...props} />
        {(errorMessage || helperText) && (
          <HelperText error={hasError}>
            {errorMessage || helperText}
          </HelperText>
        )}
      </YStack>
    );
  }
);

TextArea.displayName = 'TextArea';

export default Input;
