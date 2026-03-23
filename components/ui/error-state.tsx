import { View } from 'react-native';

import { useColors } from '@/hooks/use-colors';

import { ActionButton } from '@/components/action-button';

import { AppText } from './app-text';
import { IconSymbol } from './icon-symbol';

type ErrorStateProps = {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
};

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  retryLabel = 'Retry',
  onRetry,
  fullScreen = false,
}: ErrorStateProps) {
  const colors = useColors();

  return (
    <View className={fullScreen ? 'flex-1 items-center justify-center px-8' : 'items-center justify-center py-12 px-8'}>
      <IconSymbol name='exclamationmark.triangle.fill' size={44} color={colors.error} />
      <AppText variant='body' weight='semibold' className='text-center' style={{ marginTop: 16 }}>
        {title}
      </AppText>
      <AppText variant='bodySm' tone='secondary' className='text-center' style={{ marginTop: 6 }}>
        {description}
      </AppText>
      {onRetry ? (
        <ActionButton className='mt-5' onPress={onRetry}>
          {retryLabel}
        </ActionButton>
      ) : null}
    </View>
  );
}
