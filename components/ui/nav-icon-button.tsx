import type { ReactNode } from 'react';
import { Pressable, type PressableProps, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

import { AppText } from './app-text';
import { IconSymbol } from './icon-symbol';

type NavIconButtonProps = PressableProps & {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label?: string;
  size?: number;
  backgroundColor?: string;
  borderColor?: string;
  iconColor?: string;
  accessibilityLabel: string;
  trailing?: ReactNode;
};

export function NavIconButton({
  icon,
  label,
  size = 40,
  backgroundColor,
  borderColor,
  iconColor,
  trailing,
  style,
  ...props
}: NavIconButtonProps) {
  const colors = useColors();
  const resolvedBackground = backgroundColor || colors.surface;
  const resolvedBorder = borderColor || colors.border;
  const resolvedIcon = iconColor || colors.foreground;

  return (
    <Pressable
      accessibilityRole={props.accessibilityRole || 'button'}
      style={(state) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: resolvedBackground,
          borderWidth: 1,
          borderColor: resolvedBorder,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: state.pressed ? 0.7 : 1,
          flexDirection: 'row',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}
    >
      <IconSymbol name={icon} size={size >= 44 ? 20 : 18} color={resolvedIcon} />
      {label ? (
        <AppText variant='label' weight='semibold' style={{ marginLeft: 8, color: resolvedIcon }}>
          {label}
        </AppText>
      ) : null}
      {trailing ? <View style={{ marginLeft: 6 }}>{trailing}</View> : null}
    </Pressable>
  );
}
