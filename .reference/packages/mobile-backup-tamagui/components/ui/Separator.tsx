import { styled, Separator as TamaguiSeparator, GetProps } from 'tamagui';

export const Separator = styled(TamaguiSeparator, {
  name: 'Separator',
  backgroundColor: '$borderColor',

  variants: {
    orientation: {
      horizontal: {
        height: 1,
        width: '100%',
      },
      vertical: {
        width: 1,
        height: '100%',
      },
    },
    size: {
      sm: {},
      md: {},
      lg: {},
    },
  } as const,

  defaultVariants: {
    orientation: 'horizontal',
  },
});

export type SeparatorProps = GetProps<typeof Separator>;

export default Separator;
