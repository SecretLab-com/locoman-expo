import React, { useState } from 'react';
import { ScrollView, RefreshControl, Pressable, FlatList } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { 
  Truck, 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle,
  MapPin,
  User,
  Calendar,
  Filter,
  Search,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

type DeliveryStatus = 'all' | 'pending' | 'in_transit' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  in_transit: { label: 'In Transit', variant: 'default' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

interface Delivery {
  id: number;
  orderId: number;
  status: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  address?: string;
  client?: {
    id: number;
    name: string;
    photoUrl?: string;
  };
  order?: {
    id: number;
    totalAmount: number;
    items: any[];
  };
  createdAt: string;
}

export default function ManagerDeliveries() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<DeliveryStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'ship' | 'deliver' | 'cancel'>('ship');
  
  const { 
    data: deliveries, 
    isLoading, 
    refetch,
    fetchNextPage,
    hasNextPage,
  } = trpc.delivery.list.useInfiniteQuery(
    { 
      limit: 20,
      status: activeTab === 'all' ? undefined : activeTab,
      search: searchQuery || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  
  const updateStatusMutation = trpc.delivery.updateStatus.useMutation({
    onSuccess: () => {
      toast({ title: 'Success', description: 'Delivery status updated' });
      refetch();
      setActionDialogOpen(false);
      setSelectedDelivery(null);
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
  
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  const allDeliveries = deliveries?.pages.flatMap(page => page.items) || [];
  
  const handleAction = (delivery: Delivery, action: 'ship' | 'deliver' | 'cancel') => {
    setSelectedDelivery(delivery);
    setActionType(action);
    setActionDialogOpen(true);
  };
  
  const confirmAction = () => {
    if (!selectedDelivery) return;
    
    const statusMap = {
      ship: 'in_transit',
      deliver: 'delivered',
      cancel: 'cancelled',
    };
    
    updateStatusMutation.mutate({
      id: selectedDelivery.id,
      status: statusMap[actionType],
    });
  };
  
  const renderDeliveryCard = ({ item: delivery }: { item: Delivery }) => {
    const statusConfig = STATUS_CONFIG[delivery.status] || { label: delivery.status, variant: 'secondary' as const };
    
    return (
      <Pressable onPress={() => router.push(`/manager/deliveries/${delivery.id}`)}>
        <Card marginBottom="$3">
          <CardContent>
            <XStack justifyContent="space-between" alignItems="flex-start" marginBottom="$3">
              <YStack gap="$1">
                <Text fontSize="$4" fontWeight="600">Order #{delivery.orderId}</Text>
                {delivery.trackingNumber && (
                  <Text fontSize="$2" color="$gray10">
                    Tracking: {delivery.trackingNumber}
                  </Text>
                )}
              </YStack>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </XStack>
            
            {/* Client Info */}
            {delivery.client && (
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Avatar
                  src={delivery.client.photoUrl}
                  fallback={delivery.client.name?.charAt(0) || 'C'}
                  size="sm"
                />
                <YStack>
                  <Text fontSize="$3" fontWeight="500">{delivery.client.name}</Text>
                  <XStack alignItems="center" gap="$1">
                    <MapPin size={12} color="$gray10" />
                    <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                      {delivery.address || 'No address provided'}
                    </Text>
                  </XStack>
                </YStack>
              </XStack>
            )}
            
            {/* Dates */}
            <XStack gap="$4" marginBottom="$3">
              {delivery.estimatedDelivery && (
                <XStack alignItems="center" gap="$1">
                  <Calendar size={14} color="$gray10" />
                  <Text fontSize="$2" color="$gray10">
                    Est: {new Date(delivery.estimatedDelivery).toLocaleDateString()}
                  </Text>
                </XStack>
              )}
              {delivery.actualDelivery && (
                <XStack alignItems="center" gap="$1">
                  <CheckCircle size={14} color="$green10" />
                  <Text fontSize="$2" color="$green10">
                    Delivered: {new Date(delivery.actualDelivery).toLocaleDateString()}
                  </Text>
                </XStack>
              )}
            </XStack>
            
            {/* Actions */}
            {delivery.status === 'pending' && (
              <XStack gap="$2">
                <Button
                  size="sm"
                  flex={1}
                  icon={<Truck size={16} />}
                  onPress={() => handleAction(delivery, 'ship')}
                >
                  Mark Shipped
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  icon={<XCircle size={16} />}
                  onPress={() => handleAction(delivery, 'cancel')}
                >
                  Cancel
                </Button>
              </XStack>
            )}
            {delivery.status === 'in_transit' && (
              <Button
                size="sm"
                icon={<CheckCircle size={16} />}
                onPress={() => handleAction(delivery, 'deliver')}
              >
                Mark Delivered
              </Button>
            )}
          </CardContent>
        </Card>
      </Pressable>
    );
  };
  
  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack padding="$4" paddingBottom="$2" gap="$3">
        <Text fontSize="$7" fontWeight="700">Deliveries</Text>
        
        {/* Search */}
        <SearchInput
          placeholder="Search by order # or tracking..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeliveryStatus)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="in_transit">In Transit</TabsTrigger>
            <TabsTrigger value="delivered">Delivered</TabsTrigger>
          </TabsList>
        </Tabs>
      </YStack>
      
      {/* Deliveries List */}
      {isLoading ? (
        <YStack padding="$4" gap="$3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={180} borderRadius="$4" />
          ))}
        </YStack>
      ) : allDeliveries.length === 0 ? (
        <EmptyState
          icon={<Truck size={48} color="$gray8" />}
          title="No deliveries found"
          description={searchQuery ? 'Try a different search term' : 'No deliveries match the selected filter'}
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
      
      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'ship' && 'Mark as Shipped'}
              {actionType === 'deliver' && 'Mark as Delivered'}
              {actionType === 'cancel' && 'Cancel Delivery'}
            </DialogTitle>
          </DialogHeader>
          <Text color="$gray11">
            {actionType === 'ship' && `Mark order #${selectedDelivery?.orderId} as shipped?`}
            {actionType === 'deliver' && `Confirm delivery of order #${selectedDelivery?.orderId}?`}
            {actionType === 'cancel' && `Are you sure you want to cancel this delivery? This action cannot be undone.`}
          </Text>
          <DialogFooter>
            <Button variant="outline" onPress={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'cancel' ? 'destructive' : 'default'}
              onPress={confirmAction}
              loading={updateStatusMutation.isPending}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </YStack>
  );
}
