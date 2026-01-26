import React, { useState } from 'react';
import { FlatList, RefreshControl, Pressable } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { 
  Truck, 
  Package, 
  Clock, 
  CheckCircle, 
  MapPin,
  User,
  Calendar,
  MessageCircle,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';

type DeliveryStatus = 'all' | 'pending' | 'in_progress' | 'completed';

interface Delivery {
  id: number;
  orderId: number;
  status: string;
  bundleName: string;
  client: {
    id: number;
    name: string;
    photoUrl?: string;
  };
  scheduledDate?: string;
  completedDate?: string;
  notes?: string;
  sessionCount?: number;
  completedSessions?: number;
}

export default function TrainerDeliveries() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DeliveryStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { 
    data: deliveries, 
    isLoading, 
    refetch,
    fetchNextPage,
    hasNextPage,
  } = trpc.trainer.getDeliveries.useInfiniteQuery(
    { 
      limit: 20,
      status: activeTab === 'all' ? undefined : activeTab,
      search: searchQuery || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  const allDeliveries = deliveries?.pages.flatMap(page => page.items) || [];
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="default">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  const renderDeliveryCard = ({ item: delivery }: { item: Delivery }) => (
    <Pressable onPress={() => router.push(`/trainer/deliveries/${delivery.id}`)}>
      <Card marginBottom="$3">
        <CardContent>
          <XStack justifyContent="space-between" alignItems="flex-start" marginBottom="$3">
            <YStack gap="$1" flex={1}>
              <Text fontSize="$4" fontWeight="600">{delivery.bundleName}</Text>
              <Text fontSize="$2" color="$gray10">Order #{delivery.orderId}</Text>
            </YStack>
            {getStatusBadge(delivery.status)}
          </XStack>
          
          {/* Client Info */}
          <Pressable onPress={() => router.push(`/trainer/clients/${delivery.client.id}`)}>
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <Avatar
                src={delivery.client.photoUrl}
                fallback={delivery.client.name?.charAt(0) || 'C'}
                size="sm"
              />
              <YStack>
                <Text fontSize="$3" fontWeight="500">{delivery.client.name}</Text>
                <Text fontSize="$2" color="$gray10">Client</Text>
              </YStack>
            </XStack>
          </Pressable>
          
          {/* Progress */}
          {delivery.sessionCount && (
            <YStack marginBottom="$3">
              <XStack justifyContent="space-between" marginBottom="$1">
                <Text fontSize="$2" color="$gray10">Progress</Text>
                <Text fontSize="$2" color="$gray10">
                  {delivery.completedSessions || 0}/{delivery.sessionCount} sessions
                </Text>
              </XStack>
              <YStack backgroundColor="$gray4" height={8} borderRadius="$4" overflow="hidden">
                <YStack 
                  backgroundColor="$green10" 
                  height="100%" 
                  width={`${((delivery.completedSessions || 0) / delivery.sessionCount) * 100}%`}
                  borderRadius="$4"
                />
              </YStack>
            </YStack>
          )}
          
          {/* Dates */}
          <XStack gap="$4" marginBottom="$3">
            {delivery.scheduledDate && (
              <XStack alignItems="center" gap="$1">
                <Calendar size={14} color="$gray10" />
                <Text fontSize="$2" color="$gray10">
                  Next: {new Date(delivery.scheduledDate).toLocaleDateString()}
                </Text>
              </XStack>
            )}
          </XStack>
          
          {/* Actions */}
          <XStack gap="$2">
            <Button
              size="sm"
              flex={1}
              variant="outline"
              icon={<MessageCircle size={16} />}
              onPress={() => router.push(`/trainer/chat/${delivery.client.id}`)}
            >
              Message
            </Button>
            {delivery.status === 'in_progress' && (
              <Button
                size="sm"
                flex={1}
                icon={<CheckCircle size={16} />}
                onPress={() => router.push(`/trainer/deliveries/${delivery.id}/session`)}
              >
                Log Session
              </Button>
            )}
          </XStack>
        </CardContent>
      </Card>
    </Pressable>
  );
  
  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack padding="$4" paddingBottom="$2" gap="$3">
        <Text fontSize="$7" fontWeight="700">Deliveries</Text>
        
        {/* Search */}
        <SearchInput
          placeholder="Search deliveries..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeliveryStatus)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </YStack>
      
      {/* Deliveries List */}
      {isLoading ? (
        <YStack padding="$4" gap="$3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={200} borderRadius="$4" />
          ))}
        </YStack>
      ) : allDeliveries.length === 0 ? (
        <EmptyState
          icon={<Truck size={48} color="$gray8" />}
          title="No deliveries found"
          description={searchQuery ? 'Try a different search term' : 'Your bundle deliveries will appear here'}
        />
      ) : (
        <FlatList
          data={allDeliveries}
          renderItem={renderDeliveryCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.5}
        />
      )}
    </YStack>
  );
}
