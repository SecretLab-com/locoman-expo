import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ActionButton } from '@/components/action-button';
import { AppText } from '@/components/ui/app-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SurfaceCard } from '@/components/ui/surface-card';
import { useColors } from '@/hooks/use-colors';

type SignedOutGateProps = {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  title: string;
  description: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  extra?: ReactNode;
};

export function SignedOutGate({
  icon,
  title,
  description,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
  extra,
}: SignedOutGateProps) {
  const colors = useColors();

  return (
    <ScreenContainer className='items-center justify-center px-6'>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: `${colors.primary}14`,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <IconSymbol name={icon} size={40} color={colors.primary} />
      </View>
      <AppText variant='h2' weight='bold' className='text-center'>
        {title}
      </AppText>
      <AppText
        variant='body'
        tone='secondary'
        className='text-center'
        style={{ marginTop: 8, marginBottom: 24 }}
      >
        {description}
      </AppText>
      <ActionButton onPress={onPrimaryPress}>{primaryLabel}</ActionButton>
      {secondaryLabel && onSecondaryPress ? (
        <ActionButton
          variant='ghost'
          onPress={onSecondaryPress}
          className='mt-3'
        >
          {secondaryLabel}
        </ActionButton>
      ) : null}
      {extra ? <SurfaceCard className='mt-4 w-full max-w-md'>{extra}</SurfaceCard> : null}
    </ScreenContainer>
  );
}
