import React from 'react';
import { Tooltip as TamaguiTooltip, styled, Text } from 'tamagui';

const StyledContent = styled(TamaguiTooltip.Content, {
  name: 'TooltipContent',
  backgroundColor: '$gray12',
  borderRadius: '$2',
  paddingHorizontal: '$3',
  paddingVertical: '$2',
  maxWidth: 300,
  
  enterStyle: {
    opacity: 0,
    scale: 0.95,
  },
  exitStyle: {
    opacity: 0,
    scale: 0.95,
  },
  animation: 'quick',
});

const StyledArrow = styled(TamaguiTooltip.Arrow, {
  name: 'TooltipArrow',
});

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}

export function Tooltip({ content, children, side = 'top', delayDuration = 300 }: TooltipProps) {
  return (
    <TamaguiTooltip placement={side} delay={delayDuration}>
      <TamaguiTooltip.Trigger asChild>
        {children}
      </TamaguiTooltip.Trigger>
      <TamaguiTooltip.Portal>
        <StyledContent>
          <StyledArrow />
          <Text fontSize="$2" color="$gray1">
            {content}
          </Text>
        </StyledContent>
      </TamaguiTooltip.Portal>
    </TamaguiTooltip>
  );
}

export default Tooltip;
