import { ActivityIndicator, View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

import { AppText } from './app-text';
import { IconSymbol } from './icon-symbol';

type LoadingStateProps = {
  title?: string;
  description?: string;
  icon?: React.ComponentProps<typeof IconSymbol>['name'];
  fullScreen?: boolean;
};

export function LoadingState({
  title = 'Loading…',
  description,
  icon,
  fullScreen = false,
}: LoadingStateProps) {
  const colors = useColors();

  return (
    <View className={fullScreen ? 'flex-1 items-center justify-center px-6' : 'items-center justify-center py-12 px-6'}>
      {icon ? (
        <View className='mb-4'>
          <IconSymbol name={icon} size={28} color={colors.muted} />
        </View>
      ) : (
        <ActivityIndicator size='large' color={colors.primary} style={{ marginBottom: 16 }} />
      )}
      <AppText variant='body' weight='semibold' className='text-center'>
        {title}
      </AppText>
      {description ? (
        <AppText variant='bodySm' tone='secondary' className='text-center' style={{ marginTop: 6 }}>
          {description}
        </AppText>
      ) : null}
    </View>
  );
}
