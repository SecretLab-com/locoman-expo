import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from './app-text';
import { NavIconButton } from './nav-icon-button';

type ModalHeaderProps = {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  rightSlot?: ReactNode;
};

export function ModalHeader({
  title,
  subtitle,
  onClose,
  rightSlot,
}: ModalHeaderProps) {
  return (
    <View className='flex-row items-start justify-between mb-4'>
      <View className='flex-1 pr-4'>
        <AppText variant='h2' weight='bold'>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant='bodySm' tone='secondary' style={{ marginTop: 4 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {rightSlot ? (
        rightSlot
      ) : onClose ? (
        <NavIconButton
          icon='xmark'
          size={40}
          onPress={onClose}
          accessibilityLabel='Close'
        />
      ) : null}
    </View>
  );
}
