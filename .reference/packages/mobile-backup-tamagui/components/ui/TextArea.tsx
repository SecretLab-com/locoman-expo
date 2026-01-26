import React from 'react';
import { TextArea as TamaguiTextArea, styled, GetProps } from 'tamagui';

const StyledTextArea = styled(TamaguiTextArea, {
  name: 'TextArea',
  borderWidth: 1,
  borderColor: '$borderColor',
  borderRadius: '$3',
  backgroundColor: '$background',
  paddingHorizontal: '$3',
  paddingVertical: '$3',
  fontSize: '$4',
  color: '$color',
  minHeight: 100,
  
  focusStyle: {
    borderColor: '$blue10',
    outlineColor: '$blue10',
    outlineWidth: 2,
    outlineStyle: 'solid',
  },
  
  placeholderTextColor: '$gray10',
  
  variants: {
    size: {
      sm: {
        fontSize: '$3',
        paddingHorizontal: '$2',
        paddingVertical: '$2',
        minHeight: 80,
      },
      md: {
        fontSize: '$4',
        paddingHorizontal: '$3',
        paddingVertical: '$3',
        minHeight: 100,
      },
      lg: {
        fontSize: '$5',
        paddingHorizontal: '$4',
        paddingVertical: '$4',
        minHeight: 150,
      },
    },
    error: {
      true: {
        borderColor: '$red10',
        focusStyle: {
          borderColor: '$red10',
          outlineColor: '$red10',
        },
      },
    },
    disabled: {
      true: {
        opacity: 0.5,
        backgroundColor: '$gray3',
        cursor: 'not-allowed',
      },
    },
  } as const,
  
  defaultVariants: {
    size: 'md',
  },
});

export type TextAreaProps = GetProps<typeof StyledTextArea> & {
  error?: boolean;
};

export function TextArea({ error, ...props }: TextAreaProps) {
  return <StyledTextArea error={error} {...props} />;
}

export default TextArea;
