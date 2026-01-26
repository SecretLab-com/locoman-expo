import React from 'react';
import { Label as TamaguiLabel, styled, GetProps } from 'tamagui';

const StyledLabel = styled(TamaguiLabel, {
  name: 'Label',
  fontSize: '$3',
  fontWeight: '500',
  color: '$color',
  
  variants: {
    size: {
      sm: {
        fontSize: '$2',
      },
      md: {
        fontSize: '$3',
      },
      lg: {
        fontSize: '$4',
      },
    },
    required: {
      true: {
        // Will add asterisk via children
      },
    },
    error: {
      true: {
        color: '$red10',
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
      },
    },
  } as const,
  
  defaultVariants: {
    size: 'md',
  },
});

export type LabelProps = GetProps<typeof StyledLabel> & {
  required?: boolean;
  error?: boolean;
};

export function Label({ required, children, ...props }: LabelProps) {
  return (
    <StyledLabel {...props}>
      {children}
      {required && <TamaguiLabel color="$red10"> *</TamaguiLabel>}
    </StyledLabel>
  );
}

export default Label;
