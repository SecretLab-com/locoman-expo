import React, { createContext, useContext } from 'react';
import { XStack, YStack, Text, Circle, styled, GetProps } from 'tamagui';
import { Pressable } from 'react-native';

interface RadioGroupContextType {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextType | undefined>(undefined);

interface RadioGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
}

export function RadioGroup({ 
  value, 
  onValueChange, 
  disabled, 
  children,
  orientation = 'vertical',
}: RadioGroupProps) {
  const Container = orientation === 'horizontal' ? XStack : YStack;
  
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, disabled }}>
      <Container gap="$3">
        {children}
      </Container>
    </RadioGroupContext.Provider>
  );
}

const RadioCircle = styled(Circle, {
  name: 'RadioCircle',
  width: 20,
  height: 20,
  borderWidth: 2,
  borderColor: '$gray8',
  backgroundColor: '$background',
  
  variants: {
    checked: {
      true: {
        borderColor: '$blue10',
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
      },
    },
  } as const,
});

const RadioDot = styled(Circle, {
  name: 'RadioDot',
  width: 10,
  height: 10,
  backgroundColor: '$blue10',
});

interface RadioGroupItemProps {
  value: string;
  label?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export function RadioGroupItem({ value, label, disabled: itemDisabled, children }: RadioGroupItemProps) {
  const context = useContext(RadioGroupContext);
  
  if (!context) {
    throw new Error('RadioGroupItem must be used within a RadioGroup');
  }
  
  const { value: selectedValue, onValueChange, disabled: groupDisabled } = context;
  const isChecked = selectedValue === value;
  const isDisabled = itemDisabled || groupDisabled;
  
  const handlePress = () => {
    if (!isDisabled) {
      onValueChange(value);
    }
  };
  
  return (
    <Pressable onPress={handlePress} disabled={isDisabled}>
      <XStack alignItems="center" gap="$2" opacity={isDisabled ? 0.5 : 1}>
        <RadioCircle checked={isChecked} disabled={isDisabled}>
          {isChecked && <RadioDot />}
        </RadioCircle>
        {label && (
          <Text fontSize="$4" color="$color">
            {label}
          </Text>
        )}
        {children}
      </XStack>
    </Pressable>
  );
}

export default RadioGroup;
