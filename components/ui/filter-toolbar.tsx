import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Chip } from './chip';

type FilterOption = {
  id: string;
  label: string;
};

type FilterToolbarProps = {
  options: FilterOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function FilterToolbar({
  options,
  selectedId,
  onSelect,
  leading,
  trailing,
}: FilterToolbarProps) {
  return (
    <View className='mb-4'>
      {(leading || trailing) ? (
        <View className='flex-row items-center justify-between mb-2 gap-3'>
          <View className='flex-1'>{leading}</View>
          {trailing}
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className='flex-row items-center gap-2 pr-2'>
          {options.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              selected={selectedId === option.id}
              tone='primary'
              onPress={() => onSelect(option.id)}
              accessibilityLabel={`Filter by ${option.label}`}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
