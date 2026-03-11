import React from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';

import { getFabRecipe } from '@/design-system/recipes';
import { useDesignSystem } from '@/hooks/use-design-system';

import { IconSymbol } from './icon-symbol';

type FabProps = TouchableOpacityProps & {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  size?: number;
};

export function FAB({
  icon,
  size = 18,
  style,
  children,
  ...props
}: FabProps) {
  const ds = useDesignSystem();
  return (
    <TouchableOpacity
      accessibilityRole={props.accessibilityRole || 'button'}
      style={[
        {
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        getFabRecipe(ds),
        style,
      ]}
      {...props}
    >
      {children ?? <IconSymbol name={icon} size={size} color={ds.colors.icon.brand} />}
    </TouchableOpacity>
  );
}
