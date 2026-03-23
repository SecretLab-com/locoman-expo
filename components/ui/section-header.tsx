import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from './app-text';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({
  title,
  subtitle,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <View className={className || 'mb-3'}>
      <View className='flex-row items-start justify-between gap-3'>
        <View className='flex-1 min-w-0'>
          <AppText variant='title' weight='bold'>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant='bodySm' tone='secondary' style={{ marginTop: 4 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {action ? <View>{action}</View> : null}
      </View>
    </View>
  );
}
