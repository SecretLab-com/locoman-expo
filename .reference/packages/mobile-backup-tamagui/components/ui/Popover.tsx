import React from 'react';
import { Popover as TamaguiPopover, styled, YStack, Text } from 'tamagui';

const StyledContent = styled(TamaguiPopover.Content, {
  name: 'PopoverContent',
  backgroundColor: '$background',
  borderRadius: '$4',
  padding: '$4',
  borderWidth: 1,
  borderColor: '$borderColor',
  shadowColor: '$shadowColor',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.15,
  shadowRadius: 8,
  elevation: 4,
  
  enterStyle: {
    opacity: 0,
    y: -10,
  },
  exitStyle: {
    opacity: 0,
    y: -10,
  },
  animation: 'quick',
});

const StyledArrow = styled(TamaguiPopover.Arrow, {
  name: 'PopoverArrow',
  borderWidth: 1,
  borderColor: '$borderColor',
});

export interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Popover({ open, onOpenChange, children }: PopoverProps) {
  return (
    <TamaguiPopover open={open} onOpenChange={onOpenChange} placement="bottom">
      {children}
    </TamaguiPopover>
  );
}

export function PopoverTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  return (
    <TamaguiPopover.Trigger asChild={asChild}>
      {children}
    </TamaguiPopover.Trigger>
  );
}

export function PopoverContent({ children }: { children: React.ReactNode }) {
  return (
    <TamaguiPopover.Portal>
      <StyledContent>
        <StyledArrow />
        {children}
      </StyledContent>
    </TamaguiPopover.Portal>
  );
}

// Popover Header
export function PopoverHeader({ title, description }: { title?: string; description?: string }) {
  return (
    <YStack gap="$1" marginBottom="$3">
      {title && (
        <Text fontSize="$5" fontWeight="600" color="$color">
          {title}
        </Text>
      )}
      {description && (
        <Text fontSize="$3" color="$gray11">
          {description}
        </Text>
      )}
    </YStack>
  );
}

export default Popover;
