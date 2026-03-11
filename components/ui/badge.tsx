import { View, type ViewProps } from 'react-native';

import { getBadgeRecipe, type BadgeTone } from '@/design-system/recipes';
import { useDesignSystem } from '@/hooks/use-design-system';

import { AppText } from './app-text';

type BadgeProps = ViewProps & {
  tone?: BadgeTone;
  label: string;
};

export function Badge({ tone = 'default', label, style, ...props }: BadgeProps) {
  const ds = useDesignSystem();
  const recipe = getBadgeRecipe(ds, tone);
  return (
    <View style={[recipe.container, style]} {...props}>
      <AppText variant='caption' style={recipe.text}>
        {label}
      </AppText>
    </View>
  );
}
