import React, { createContext, useContext, useState } from 'react';
import { YStack, XStack, Text, styled } from 'tamagui';
import { ChevronDown } from '@tamagui/lucide-icons';
import { Pressable } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  useSharedValue,
  interpolate,
} from 'react-native-reanimated';

interface AccordionContextType {
  value: string[];
  onValueChange: (value: string[]) => void;
  type: 'single' | 'multiple';
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

interface AccordionProps {
  type?: 'single' | 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  children: React.ReactNode;
}

export function Accordion({ 
  type = 'single', 
  value: controlledValue, 
  defaultValue = [],
  onValueChange,
  children 
}: AccordionProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = controlledValue ?? internalValue;
  
  const handleValueChange = (newValue: string[]) => {
    if (!controlledValue) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };
  
  return (
    <AccordionContext.Provider value={{ value, onValueChange: handleValueChange, type }}>
      <YStack gap="$2">
        {children}
      </YStack>
    </AccordionContext.Provider>
  );
}

interface AccordionItemContextType {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextType | undefined>(undefined);

const StyledItem = styled(YStack, {
  name: 'AccordionItem',
  borderWidth: 1,
  borderColor: '$borderColor',
  borderRadius: '$3',
  overflow: 'hidden',
});

interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
}

export function AccordionItem({ value, children }: AccordionItemProps) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionItem must be used within an Accordion');
  
  const isOpen = context.value.includes(value);
  
  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <StyledItem>
        {children}
      </StyledItem>
    </AccordionItemContext.Provider>
  );
}

const StyledTrigger = styled(XStack, {
  name: 'AccordionTrigger',
  padding: '$4',
  backgroundColor: '$background',
  justifyContent: 'space-between',
  alignItems: 'center',
  
  hoverStyle: {
    backgroundColor: '$gray2',
  },
});

interface AccordionTriggerProps {
  children: React.ReactNode;
}

export function AccordionTrigger({ children }: AccordionTriggerProps) {
  const accordionContext = useContext(AccordionContext);
  const itemContext = useContext(AccordionItemContext);
  
  if (!accordionContext || !itemContext) {
    throw new Error('AccordionTrigger must be used within an AccordionItem');
  }
  
  const { value: openValues, onValueChange, type } = accordionContext;
  const { value, isOpen } = itemContext;
  
  const rotation = useSharedValue(isOpen ? 1 : 0);
  
  React.useEffect(() => {
    rotation.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
  }, [isOpen]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
  }));
  
  const handlePress = () => {
    if (type === 'single') {
      onValueChange(isOpen ? [] : [value]);
    } else {
      onValueChange(
        isOpen 
          ? openValues.filter(v => v !== value)
          : [...openValues, value]
      );
    }
  };
  
  return (
    <Pressable onPress={handlePress}>
      <StyledTrigger>
        <Text fontSize="$4" fontWeight="500" color="$color" flex={1}>
          {children}
        </Text>
        <Animated.View style={animatedStyle}>
          <ChevronDown size={20} color="$gray10" />
        </Animated.View>
      </StyledTrigger>
    </Pressable>
  );
}

const StyledContent = styled(YStack, {
  name: 'AccordionContent',
  padding: '$4',
  paddingTop: 0,
  backgroundColor: '$background',
});

interface AccordionContentProps {
  children: React.ReactNode;
}

export function AccordionContent({ children }: AccordionContentProps) {
  const itemContext = useContext(AccordionItemContext);
  if (!itemContext) throw new Error('AccordionContent must be used within an AccordionItem');
  
  const { isOpen } = itemContext;
  const height = useSharedValue(isOpen ? 1 : 0);
  
  React.useEffect(() => {
    height.value = withTiming(isOpen ? 1 : 0, { duration: 200 });
  }, [isOpen]);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: height.value,
    maxHeight: interpolate(height.value, [0, 1], [0, 1000]),
    overflow: 'hidden' as const,
  }));
  
  if (!isOpen) return null;
  
  return (
    <Animated.View style={animatedStyle}>
      <StyledContent>
        {children}
      </StyledContent>
    </Animated.View>
  );
}

export default Accordion;
