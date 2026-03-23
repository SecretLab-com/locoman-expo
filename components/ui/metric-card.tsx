import type { ReactNode } from 'react';
import { View } from 'react-native';

import { withAlpha } from '@/design-system/color-utils';
import { useColors } from '@/hooks/use-colors';

import { AppText } from './app-text';
import { IconSymbol } from './icon-symbol';
import { SurfaceCard } from './surface-card';

type MetricCardProps = {
  icon?: React.ComponentProps<typeof IconSymbol>['name'];
  title: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  trailing?: ReactNode;
};

export function MetricCard({
  icon,
  title,
  value,
  subtitle,
  accentColor,
  trailing,
}: MetricCardProps) {
  const colors = useColors();
  const accent = accentColor || colors.primary;

  return (
    <SurfaceCard>
      <View className='flex-row items-start justify-between'>
        <View className='flex-1 min-w-0'>
          <View className='flex-row items-center'>
            {icon ? (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: withAlpha(accent, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <IconSymbol name={icon} size={18} color={accent} />
              </View>
            ) : null}
            <AppText variant='bodySm' tone='secondary'>
              {title}
            </AppText>
          </View>
          <AppText variant='h2' weight='bold' style={{ marginTop: 12 }}>
            {value}
          </AppText>
          {subtitle ? (
            <AppText variant='bodySm' tone='secondary' style={{ marginTop: 6 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {trailing}
      </View>
    </SurfaceCard>
  );
}
