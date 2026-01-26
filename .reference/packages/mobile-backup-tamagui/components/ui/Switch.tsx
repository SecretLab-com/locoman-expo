import { styled, Switch as TamaguiSwitch, XStack, Text, YStack, GetProps } from 'tamagui';

// Styled Switch
export const Switch = styled(TamaguiSwitch, {
  name: 'Switch',
  backgroundColor: '$muted',
  borderRadius: 9999,
  
  variants: {
    size: {
      sm: {
        width: 36,
        height: 20,
      },
      md: {
        width: 44,
        height: 24,
      },
      lg: {
        width: 52,
        height: 28,
      },
    },
  } as const,

  defaultVariants: {
    size: 'md',
  },
});

// Switch Thumb
export const SwitchThumb = styled(TamaguiSwitch.Thumb, {
  name: 'SwitchThumb',
  backgroundColor: 'white',
  borderRadius: 9999,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  elevation: 2,
  animation: 'fast',
});

// Label
const Label = styled(Text, {
  name: 'SwitchLabel',
  fontSize: '$3',
  fontWeight: '500',
  color: '$color',
});

// Description
const Description = styled(Text, {
  name: 'SwitchDescription',
  fontSize: '$2',
  color: '$mutedForeground',
});

// Complete Switch with label
interface SwitchFieldProps {
  label?: string;
  description?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  labelPosition?: 'left' | 'right';
}

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  size = 'md',
  disabled,
  labelPosition = 'left',
}: SwitchFieldProps) {
  const switchElement = (
    <Switch
      size={size}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      opacity={disabled ? 0.5 : 1}
    >
      <SwitchThumb
        animation="fast"
        width={size === 'sm' ? 16 : size === 'md' ? 20 : 24}
        height={size === 'sm' ? 16 : size === 'md' ? 20 : 24}
      />
    </Switch>
  );

  if (!label && !description) {
    return switchElement;
  }

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      opacity={disabled ? 0.5 : 1}
    >
      {labelPosition === 'left' && (
        <YStack flex={1} gap="$1">
          {label && <Label>{label}</Label>}
          {description && <Description>{description}</Description>}
        </YStack>
      )}
      {switchElement}
      {labelPosition === 'right' && (
        <YStack flex={1} gap="$1">
          {label && <Label>{label}</Label>}
          {description && <Description>{description}</Description>}
        </YStack>
      )}
    </XStack>
  );
}

export type SwitchProps = GetProps<typeof Switch>;

export default Switch;
