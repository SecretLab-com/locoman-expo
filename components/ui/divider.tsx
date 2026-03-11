import { View, type ViewProps } from 'react-native';

import { getDividerStyle } from '@/design-system/recipes';
import { useDesignSystem } from '@/hooks/use-design-system';

type DividerProps = ViewProps & {
  vertical?: boolean;
};

export function Divider({ vertical = false, style, ...props }: DividerProps) {
  const ds = useDesignSystem();
  const baseStyle = getDividerStyle(ds);
  return (
    <View
      style={[
        vertical
          ? {
              width: 1,
              alignSelf: 'stretch',
              backgroundColor: baseStyle.backgroundColor,
            }
          : baseStyle,
        style,
      ]}
      {...props}
    />
  );
}
