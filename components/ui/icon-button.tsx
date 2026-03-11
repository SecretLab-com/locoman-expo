import React from 'react';
import { TouchableOpacity, type TouchableOpacityProps } from 'react-native';

import { getButtonRecipe, type ButtonVariant } from '@/design-system/recipes';
import { useDesignSystem } from '@/hooks/use-design-system';

import { AppText } from './app-text';
import { IconSymbol } from './icon-symbol';

type IconButtonProps = TouchableOpacityProps & {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
};

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  style,
  ...props
}: IconButtonProps) {
  const ds = useDesignSystem();
  const recipe = getButtonRecipe(ds, { variant, size, disabled: props.disabled });
  return (
    <TouchableOpacity
      accessibilityRole={props.accessibilityRole || 'button'}
      style={[recipe.container, style]}
      {...props}
    >
      <IconSymbol name={icon} size={size === 'sm' ? 16 : size === 'lg' ? 20 : 18} color={recipe.iconColor} />
      {label ? (
        <AppText variant={recipe.labelVariant} tone={recipe.labelTone} weight='semibold' style={{ marginLeft: 8 }}>
          {label}
        </AppText>
      ) : null}
    </TouchableOpacity>
  );
}
