import { Select as TamaguiSelect, Adapt, Sheet, YStack, Text, styled, View } from 'tamagui';
import { Check, ChevronDown, ChevronUp } from '@tamagui/lucide-icons';

// Select Root
export const Select = TamaguiSelect;

// Re-export the sub-components directly without styled() wrapper
// Some of these may not exist in all Tamagui versions
export const SelectTrigger = TamaguiSelect.Trigger;
export const SelectValue = TamaguiSelect.Value;
export const SelectIcon = TamaguiSelect.Icon;
export const SelectContent = TamaguiSelect.Content;
export const SelectViewport = TamaguiSelect.Viewport;
export const SelectItem = TamaguiSelect.Item;
export const SelectItemText = TamaguiSelect.ItemText;
export const SelectItemIndicator = TamaguiSelect.ItemIndicator;
export const SelectGroup = TamaguiSelect.Group;
export const SelectLabel = TamaguiSelect.Label;

// Use View for separator since TamaguiSelect.Separator might not exist
export const SelectSeparator = styled(View, {
  name: 'SelectSeparator',
  height: 1,
  backgroundColor: '$borderColor',
  marginVertical: '$1',
});

// Label component
const Label = styled(Text, {
  name: 'Label',
  fontSize: '$2',
  fontWeight: '500',
  color: '$color',
  marginBottom: '$1',
});

// Helper/Error text
const HelperText = styled(Text, {
  name: 'HelperText',
  fontSize: '$1',
  marginTop: '$1',
  
  variants: {
    error: {
      true: {
        color: '$red10',
      },
      false: {
        color: '$gray10',
      },
    },
  } as const,
});

// Complete Select component with label and error handling
interface SelectFieldProps {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorMessage?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function SelectField({
  label,
  placeholder = 'Select...',
  helperText,
  errorMessage,
  value,
  onValueChange,
  options,
  size = 'md',
  disabled,
}: SelectFieldProps) {
  const hasError = !!errorMessage;

  return (
    <YStack gap="$1">
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onValueChange} disablePreventBodyScroll>
        <SelectTrigger
          borderWidth={1}
          borderColor={hasError ? '$red10' : '$borderColor'}
          borderRadius="$3"
          paddingHorizontal="$3"
          height={size === 'sm' ? 36 : size === 'lg' ? 52 : 44}
          backgroundColor="$background"
          opacity={disabled ? 0.5 : 1}
        >
          <SelectValue placeholder={placeholder} />
          <SelectIcon>
            <ChevronDown size={16} />
          </SelectIcon>
        </SelectTrigger>

        <Adapt when="sm" platform="touch">
          <Sheet
            native
            modal
            dismissOnSnapToBottom
            animationConfig={{
              type: 'spring',
              damping: 20,
              mass: 1.2,
              stiffness: 250,
            }}
          >
            <Sheet.Frame>
              <Sheet.ScrollView>
                <Adapt.Contents />
              </Sheet.ScrollView>
            </Sheet.Frame>
            <Sheet.Overlay
              animation="fast"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            />
          </Sheet>
        </Adapt>

        <SelectContent zIndex={200000}>
          <SelectViewport>
            <TamaguiSelect.ScrollUpButton>
              <ChevronUp size={16} />
            </TamaguiSelect.ScrollUpButton>
            
            {options.map((option) => (
              <SelectItem
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                <SelectItemText>{option.label}</SelectItemText>
                <SelectItemIndicator>
                  <Check size={16} color="$purple10" />
                </SelectItemIndicator>
              </SelectItem>
            ))}
            
            <TamaguiSelect.ScrollDownButton>
              <ChevronDown size={16} />
            </TamaguiSelect.ScrollDownButton>
          </SelectViewport>
        </SelectContent>
      </Select>
      {(errorMessage || helperText) && (
        <HelperText error={hasError}>
          {errorMessage || helperText}
        </HelperText>
      )}
    </YStack>
  );
}

export default Select;
