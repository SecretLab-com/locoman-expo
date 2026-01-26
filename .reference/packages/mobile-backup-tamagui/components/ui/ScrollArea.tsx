import { styled, ScrollView, GetProps } from 'tamagui';
import { forwardRef, ReactNode } from 'react';
import { RefreshControl } from 'react-native';

// Styled ScrollView
export const ScrollArea = styled(ScrollView, {
  name: 'ScrollArea',
  flex: 1,

  variants: {
    horizontal: {
      true: {
        flexDirection: 'row',
      },
    },
  } as const,
});

// ScrollArea with refresh control
interface RefreshableScrollAreaProps extends GetProps<typeof ScrollArea> {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshColor?: string;
}

export const RefreshableScrollArea = forwardRef<
  typeof ScrollArea,
  RefreshableScrollAreaProps
>(({ children, refreshing = false, onRefresh, refreshColor, ...props }, ref) => {
  return (
    <ScrollArea
      ref={ref}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={refreshColor}
          />
        ) : undefined
      }
      {...props}
    >
      {children}
    </ScrollArea>
  );
});

RefreshableScrollArea.displayName = 'RefreshableScrollArea';

export type ScrollAreaProps = GetProps<typeof ScrollArea>;

export default ScrollArea;
