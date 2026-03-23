import { router, Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ListRow } from '@/components/ui/list-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type MoreMenuItem = {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  title: string;
  subtitle: string;
  href: string;
  badge?: number;
};

type MoreMenuScreenProps = {
  title?: string;
  subtitle: string;
  items: MoreMenuItem[];
  testIdPrefix: string;
};

export function MoreMenuScreen({
  title = 'More',
  subtitle,
  items,
  testIdPrefix,
}: MoreMenuScreenProps) {
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <ScreenContainer>
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScreenHeader title={title} subtitle={subtitle} />
          <View className='px-4 pb-8'>
            {items.map((item) => (
              <SurfaceCard key={item.title} className='mb-3 p-0'>
                <ListRow
                  icon={item.icon}
                  title={item.title}
                  subtitle={item.subtitle}
                  badge={item.badge}
                  onPress={() => router.push(item.href as any)}
                  accessibilityLabel={item.title}
                  testID={`${testIdPrefix}-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  highlight={item.title === 'Create Plan' || item.title === 'Shop for Client'}
                  showChevron
                />
              </SurfaceCard>
            ))}
          </View>
        </ScrollView>
      </ScreenContainer>
    </>
  );
}
