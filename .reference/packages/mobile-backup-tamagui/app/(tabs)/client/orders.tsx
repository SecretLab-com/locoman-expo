import React, { useState } from 'react';
import { FlatList, RefreshControl, Pressable } from 'react-native';
import { YStack, XStack, Text, Image } from 'tamagui';
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle,
  ChevronRight,
  Calendar,
  DollarSign,
  Truck,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';

type OrderStatus = 'all' | 'pending' | 'active' | 'completed' | 'cancelled';

interface OrderItem {
  id: number;
  bundleId: number;
  bundleName: string;
  bundleImage?: string;
  price: number;
  quantity: number;
}

interface Order {
  id: number;
  status: string;
  totalAmount: number;
  items: OrderItem[];
  trainer?: {
    id: number;
    name: string;
    photoUrl?: string;
  };
  createdAt: string;
  deliveryStatus?: string;
}

export default function ClientOrders() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderStatus>('all');
  
  const { 
    data: orders, 
    isLoading, 
    refetch,
    fetchNextPage,
    hasNextPage,
  } = trpc.client.getOrders.useInfiniteQuery(
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
  
  const allOrders = orders?.pages.flatMap(page => page.items) || [];
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  const renderOrderCard = ({ item: order }: { item: Order }) => (
    <Pressable onPress={() => router.push(`/client/orders/${order.id}`)}>
      <Card marginBottom="$3">
        <CardContent>
          <XStack justifyContent="space-between" alignItems="flex-start" marginBottom="$3">
            <YStack gap="$1">
              <Text fontSize="$4" fontWeight="600">Order #{order.id}</Text>
              <XStack alignItems="center" gap="$1">
                <Calendar size={12} color="$gray10" />
                <Text fontSize="$2" color="$gray10">
                  {new Date(order.createdAt).toLocaleDateString()}
                </Text>
              </XStack>
            </YStack>
            {getStatusBadge(order.status)}
          </XStack>
          
          {/* Order Items Preview */}
          <YStack gap="$2" marginBottom="$3">
            {order.items.slice(0, 2).map((item) => (
              <XStack key={item.id} alignItems="center" gap="$3">
                {item.bundleImage ? (
                  <Image
                    source={{ uri: item.bundleImage }}
                    width={50}
                    height={50}
                    borderRadius="$2"
                  />
                ) : (
                  <YStack 
                    width={50} 
                    height={50} 
                    backgroundColor="$gray4" 
                    borderRadius="$2"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Package size={24} color="$gray8" />
                  </YStack>
                )}
                <YStack flex={1}>
                  <Text fontSize="$3" fontWeight="500" numberOfLines={1}>
                    {item.bundleName}
                  </Text>
                  <Text fontSize="$2" color="$gray10">
                    Qty: {item.quantity} × ${item.price.toFixed(2)}
                  </Text>
                </YStack>
              </XStack>
            ))}
            {order.items.length > 2 && (
              <Text fontSize="$2" color="$gray10">
                +{order.items.length - 2} more items
              </Text>
            )}
          </YStack>
          
          {/* Trainer Info */}
          {order.trainer && (
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <Avatar
                src={order.trainer.photoUrl}
                fallback={order.trainer.name?.charAt(0) || 'T'}
                size="xs"
              />
              <Text fontSize="$2" color="$gray10">
                Trainer: {order.trainer.name}
              </Text>
            </XStack>
          )}
          
          {/* Delivery Status */}
          {order.deliveryStatus && (
            <XStack alignItems="center" gap="$2" marginBottom="$3">
              <Truck size={14} color="$blue10" />
              <Text fontSize="$2" color="$blue10">
                {order.deliveryStatus === 'in_transit' ? 'In Transit' : order.deliveryStatus}
              </Text>
            </XStack>
          )}
          
          {/* Total */}
          <XStack justifyContent="space-between" alignItems="center" paddingTop="$3" borderTopWidth={1} borderTopColor="$gray4">
            <Text fontSize="$3" color="$gray10">Total</Text>
            <Text fontSize="$5" fontWeight="700" color="$green10">
              ${order.totalAmount.toFixed(2)}
            </Text>
          </XStack>
          
          {/* View Details */}
          <XStack justifyContent="flex-end" marginTop="$3">
            <Button
              size="sm"
              variant="outline"
              iconAfter={<ChevronRight size={16} />}
              onPress={() => router.push(`/client/orders/${order.id}`)}
            >
              View Details
            </Button>
          </XStack>
        </CardContent>
      </Card>
    </Pressable>
  );
  
  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack padding="$4" paddingBottom="$2" gap="$3">
        <Text fontSize="$7" fontWeight="700">My Orders</Text>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OrderStatus)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
      </YStack>
      
      {/* Orders List */}
      {isLoading ? (
        <YStack padding="$4" gap="$3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={220} borderRadius="$4" />
          ))}
        </YStack>
      ) : allOrders.length === 0 ? (
        <EmptyState
          icon={<Package size={48} color="$gray8" />}
          title="No orders yet"
          description="Your orders will appear here after you make a purchase"
          action={
            <Button onPress={() => router.push('/shop')}>
              Browse Bundles
            </Button>
          }
        />
      ) : (
        <FlatList
          data={allOrders}
          renderItem={renderOrderCard}
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
