import { TouchableOpacity, type TouchableOpacityProps, View } from 'react-native';

import { withAlpha } from '@/design-system/color-utils';
import { useColors } from '@/hooks/use-colors';

import { AppText } from './app-text';
import { IconSymbol } from './icon-symbol';

type ChipTone = 'default' | 'primary' | 'success' | 'warning' | 'error';

type ChipProps = TouchableOpacityProps & {
  label: string;
  selected?: boolean;
  tone?: ChipTone;
  leftIcon?: React.ComponentProps<typeof IconSymbol>['name'];
  rightIcon?: React.ComponentProps<typeof IconSymbol>['name'];
};

function getToneColor(tone: ChipTone, colors: ReturnType<typeof useColors>) {
  switch (tone) {
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'error':
      return colors.error;
    case 'primary':
      return colors.primary;
    case 'default':
    default:
      return colors.foreground;
  }
}

export function Chip({
  label,
  selected = false,
  tone = 'default',
  leftIcon,
  rightIcon,
  style,
  ...props
}: ChipProps) {
  const colors = useColors();
  const toneColor = getToneColor(tone, colors);
  const resolvedText = selected ? colors.background : toneColor;

  return (
    <TouchableOpacity
      accessibilityRole={props.accessibilityRole || 'button'}
      activeOpacity={0.8}
      style={[
        {
          minHeight: 36,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected ? toneColor : colors.border,
          backgroundColor: selected ? toneColor : withAlpha(toneColor, tone === 'default' ? 0.05 : 0.12),
          paddingHorizontal: 12,
          paddingVertical: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      {...props}
    >
      {leftIcon ? (
        <View style={{ marginRight: 6 }}>
          <IconSymbol name={leftIcon} size={14} color={resolvedText} />
        </View>
      ) : null}
      <AppText variant='label' weight='semibold' style={{ color: resolvedText }}>
        {label}
      </AppText>
      {rightIcon ? (
        <View style={{ marginLeft: 6 }}>
          <IconSymbol name={rightIcon} size={14} color={resolvedText} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
