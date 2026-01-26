import React, { useState } from 'react';
import { FlatList, RefreshControl, Pressable } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { 
  Truck, 
  Package, 
  Clock, 
  CheckCircle, 
  Calendar,
  User,
  MessageCircle,
  Star,
  Play,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';

type DeliveryStatus = 'all' | 'active' | 'completed';

interface Delivery {
  id: number;
  orderId: number;
  bundleName: string;
  bundleImage?: string;
  status: string;
  trainer: {
    id: number;
    name: string;
    photoUrl?: string;
    rating?: number;
  };
  totalSessions: number;
  completedSessions: number;
  nextSession?: {
    date: string;
    time: string;
  };
  startedAt?: string;
  completedAt?: string;
}

export default function ClientDeliveries() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DeliveryStatus>('all');
  
  const { 
    data: deliveries, 
    isLoading, 
    refetch,
    fetchNextPage,
    hasNextPage,
  } = trpc.client.getDeliveries.useInfiniteQuery(
    { 
      limit: 20,
      status: activeTab === 'all' ? undefined : activeTab,
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
        return <Badge variant="warning">Pending Start</Badge>;
      case 'active':
        return <Badge variant="default">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  const renderDeliveryCard = ({ item: delivery }: { item: Delivery }) => {
    const progress = delivery.totalSessions > 0 
      ? (delivery.completedSessions / delivery.totalSessions) * 100 
      : 0;
    
    return (
      <Pressable onPress={() => router.push(`/client/deliveries/${delivery.id}`)}>
        <Card marginBottom="$3">
          <CardContent>
            <XStack justifyContent="space-between" alignItems="flex-start" marginBottom="$3">
              <YStack gap="$1" flex={1}>
                <Text fontSize="$4" fontWeight="600" numberOfLines={1}>
                  {delivery.bundleName}
                </Text>
                <Text fontSize="$2" color="$gray10">Order #{delivery.orderId}</Text>
              </YStack>
              {getStatusBadge(delivery.status)}
            </XStack>
            
            {/* Trainer Info */}
            <Pressable onPress={() => router.push(`/trainers/${delivery.trainer.id}`)}>
              <XStack alignItems="center" gap="$3" marginBottom="$3" padding="$2" backgroundColor="$gray2" borderRadius="$3">
                <Avatar
                  src={delivery.trainer.photoUrl}
                  fallback={delivery.trainer.name?.charAt(0) || 'T'}
                  size="md"
                />
                <YStack flex={1}>
                  <Text fontSize="$3" fontWeight="500">{delivery.trainer.name}</Text>
                  {delivery.trainer.rating !== undefined && (
                    <XStack alignItems="center" gap="$1">
                      <Star size={12} color="$yellow10" fill="$yellow10" />
                      <Text fontSize="$2" color="$gray10">{delivery.trainer.rating.toFixed(1)}</Text>
                    </XStack>
                  )}
                </YStack>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<MessageCircle size={14} />}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push(`/client/chat/${delivery.trainer.id}`);
                  }}
                >
                  Chat
                </Button>
              </XStack>
            </Pressable>
            
            {/* Progress */}
            <YStack marginBottom="$3">
              <XStack justifyContent="space-between" marginBottom="$1">
                <Text fontSize="$2" color="$gray10">Progress</Text>
                <Text fontSize="$2" fontWeight="500">
                  {delivery.completedSessions}/{delivery.totalSessions} sessions
                </Text>
              </XStack>
              <Progress value={progress} />
            </YStack>
            
            {/* Next Session */}
            {delivery.nextSession && delivery.status === 'active' && (
              <XStack 
                alignItems="center" 
                gap="$2" 
                padding="$3" 
                backgroundColor="$blue2" 
                borderRadius="$3"
                marginBottom="$3"
              >
                <Calendar size={18} color="$blue10" />
                <YStack flex={1}>
                  <Text fontSize="$2" color="$blue10">Next Session</Text>
                  <Text fontSize="$3" fontWeight="500">
                    {new Date(delivery.nextSession.date).toLocaleDateString()} at {delivery.nextSession.time}
                  </Text>
                </YStack>
              </XStack>
            )}
            
            {/* Actions */}
            <XStack gap="$2">
              {delivery.status === 'active' && (
                <Button
                  size="sm"
                  flex={1}
                  icon={<Play size={16} />}
                  onPress={() => router.push(`/client/deliveries/${delivery.id}/session`)}
                >
                  Join Session
                </Button>
              )}
              {delivery.status === 'completed' && !delivery.hasReview && (
                <Button
                  size="sm"
                  flex={1}
                  variant="outline"
                  icon={<Star size={16} />}
                  onPress={() => router.push(`/client/deliveries/${delivery.id}/review`)}
                >
                  Leave Review
                </Button>
              )}
            </XStack>
          </CardContent>
        </Card>
      </Pressable>
    );
  };
  
  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack padding="$4" paddingBottom="$2" gap="$3">
        <Text fontSize="$7" fontWeight="700">My Training</Text>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeliveryStatus)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </YStack>
      
      {/* Deliveries List */}
      {isLoading ? (
        <YStack padding="$4" gap="$3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={250} borderRadius="$4" />
          ))}
        </YStack>
      ) : allDeliveries.length === 0 ? (
        <EmptyState
          icon={<Truck size={48} color="$gray8" />}
          title="No training sessions yet"
          description="Purchase a bundle to start your training journey"
          action={
            <Button onPress={() => router.push('/shop')}>
              Browse Bundles
            </Button>
          }
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
