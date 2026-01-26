import { styled, Checkbox as TamaguiCheckbox, XStack, Text, YStack, GetProps } from 'tamagui';
import { Check } from '@tamagui/lucide-icons';

// Styled Checkbox
export const Checkbox = styled(TamaguiCheckbox, {
  name: 'Checkbox',
  backgroundColor: '$background',
  borderWidth: 2,
  borderColor: '$borderColor',
  borderRadius: '$2',
  alignItems: 'center',
  justifyContent: 'center',
  
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
        width: 16,
        height: 16,
      },
      md: {
        width: 20,
        height: 20,
      },
      lg: {
        width: 24,
        height: 24,
      },
    },
    checked: {
      true: {
        backgroundColor: '$primary',
        borderColor: '$primary',
      },
    },
    error: {
      true: {
        borderColor: '$error',
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
    size: 'md',
  },
});

// Checkbox Indicator
export const CheckboxIndicator = styled(TamaguiCheckbox.Indicator, {
  name: 'CheckboxIndicator',
});

// Label
const Label = styled(Text, {
  name: 'CheckboxLabel',
  fontSize: '$3',
  color: '$color',
});

// Description
const Description = styled(Text, {
  name: 'CheckboxDescription',
  fontSize: '$2',
  color: '$mutedForeground',
});

// Helper text
const HelperText = styled(Text, {
  name: 'CheckboxHelperText',
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

// Complete Checkbox with label
interface CheckboxFieldProps {
  label?: string;
  description?: string;
  helperText?: string;
  errorMessage?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function CheckboxField({
  label,
  description,
  helperText,
  errorMessage,
  checked,
  onCheckedChange,
  size = 'md',
  disabled,
}: CheckboxFieldProps) {
  const hasError = !!errorMessage;
  const iconSize = size === 'sm' ? 12 : size === 'md' ? 14 : 18;

  return (
    <YStack>
      <XStack
        alignItems="flex-start"
        gap="$2"
        opacity={disabled ? 0.5 : 1}
        cursor={disabled ? 'not-allowed' : 'pointer'}
        onPress={() => !disabled && onCheckedChange?.(!checked)}
      >
        <Checkbox
          size={size}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          error={hasError}
        >
          <CheckboxIndicator>
            <Check size={iconSize} color="white" />
          </CheckboxIndicator>
        </Checkbox>
        {(label || description) && (
          <YStack flex={1} gap="$0.5">
            {label && <Label>{label}</Label>}
            {description && <Description>{description}</Description>}
          </YStack>
        )}
      </XStack>
      {(errorMessage || helperText) && (
        <HelperText error={hasError} marginLeft="$6">
          {errorMessage || helperText}
        </HelperText>
      )}
    </YStack>
  );
}

export type CheckboxProps = GetProps<typeof Checkbox>;

export default Checkbox;
