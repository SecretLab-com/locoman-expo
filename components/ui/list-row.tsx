import type { ReactNode } from 'react';
import { TouchableOpacity, type TouchableOpacityProps, View } from 'react-native';

import { withAlpha } from '@/design-system/color-utils';
import { useColors } from '@/hooks/use-colors';

import { AppText } from './app-text';
import { IconSymbol } from './icon-symbol';

type ListRowProps = TouchableOpacityProps & {
  icon?: React.ComponentProps<typeof IconSymbol>['name'];
  title: string;
  subtitle?: string;
  badge?: number | string | null;
  trailing?: ReactNode;
  highlight?: boolean;
  danger?: boolean;
  showChevron?: boolean;
};

export function ListRow({
  icon,
  title,
  subtitle,
  badge,
  trailing,
  highlight = false,
  danger = false,
  showChevron = true,
  style,
  ...props
}: ListRowProps) {
  const colors = useColors();
  const accentColor = danger ? colors.error : highlight ? colors.primary : colors.foreground;

  return (
    <TouchableOpacity
      accessibilityRole={props.accessibilityRole || 'button'}
      activeOpacity={0.75}
      style={[
        {
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
        },
        style,
      ]}
      {...props}
    >
      <View className='flex-row items-center'>
        {icon ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: withAlpha(accentColor, 0.12),
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <IconSymbol name={icon} size={18} color={accentColor} />
          </View>
        ) : null}
        <View className='flex-1 min-w-0'>
          <AppText variant='body' weight='semibold' style={{ color: accentColor }}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant='bodySm' tone='secondary' style={{ marginTop: 2 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {badge != null && badge !== 0 && badge !== '0' ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.error,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
              marginRight: showChevron || trailing ? 8 : 0,
            }}
          >
            <AppText variant='caption' tone='inverse' weight='bold'>
              {typeof badge === 'number' && badge > 99 ? '99+' : String(badge)}
            </AppText>
          </View>
        ) : null}
        {trailing}
        {showChevron ? (
          <View style={{ marginLeft: trailing ? 8 : 0 }}>
            <IconSymbol name='chevron.right' size={16} color={colors.muted} />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
