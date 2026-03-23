import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

import { ActionButton } from '@/components/action-button';

import { AppText } from './app-text';
import { IconSymbol } from './icon-symbol';
import { SurfaceCard } from './surface-card';

type EmptyStateProps = {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  inline?: boolean;
  extra?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onActionPress,
  inline = false,
  extra,
}: EmptyStateProps) {
  const colors = useColors();
  const content = (
    <View className='items-center'>
      <IconSymbol name={icon} size={34} color={colors.muted} />
      <AppText variant='body' weight='semibold' className='text-center' style={{ marginTop: 12 }}>
        {title}
      </AppText>
      {description ? (
        <AppText variant='bodySm' tone='secondary' className='text-center' style={{ marginTop: 6 }}>
          {description}
        </AppText>
      ) : null}
      {actionLabel && onActionPress ? (
        <ActionButton className='mt-4' onPress={onActionPress}>
          {actionLabel}
        </ActionButton>
      ) : null}
      {extra ? <View style={{ marginTop: 12, width: '100%' }}>{extra}</View> : null}
    </View>
  );

  if (inline) {
    return <View className='px-4 py-8'>{content}</View>;
  }

  return <SurfaceCard className='p-6'>{content}</SurfaceCard>;
}
