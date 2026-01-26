import React from 'react';
import { RefreshControl, ScrollView, FlatList, FlatListProps } from 'react-native';
import { YStack } from 'tamagui';

interface PullToRefreshProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

export function PullToRefresh({ refreshing, onRefresh, children }: PullToRefreshProps) {
  return (
    <ScrollView
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366f1"
          colors={['#6366f1']}
        />
      }
      contentContainerStyle={{ flexGrow: 1 }}
    >
      {children}
    </ScrollView>
  );
}

interface RefreshableListProps<T> extends Omit<FlatListProps<T>, 'refreshControl'> {
  refreshing: boolean;
  onRefresh: () => void;
}

export function RefreshableList<T>({ 
  refreshing, 
  onRefresh, 
  ...props 
}: RefreshableListProps<T>) {
  return (
    <FlatList
      {...props}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366f1"
          colors={['#6366f1']}
        />
      }
    />
  );
}

export default PullToRefresh;
