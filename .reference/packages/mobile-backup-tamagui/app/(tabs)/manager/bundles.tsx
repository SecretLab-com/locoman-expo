import React, { useState } from 'react';
import { FlatList, RefreshControl, Pressable } from 'react-native';
import { YStack, XStack, Text, Image } from 'tamagui';
import { 
  Package, 
  Star, 
  DollarSign,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  MoreVertical,
  User,
  ShoppingCart,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/DropdownMenu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';

type BundleStatus = 'all' | 'published' | 'pending' | 'draft' | 'rejected';

interface Bundle {
  id: number;
  name: string;
  description?: string;
  price: number;
  status: string;
  imageUrl?: string;
  trainer?: {
    id: number;
    name: string;
    photoUrl?: string;
  };
  rating?: number;
  totalSales: number;
  totalRevenue: number;
  createdAt: string;
  category?: string;
}

export default function ManagerBundles() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<BundleStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'unpublish'>('approve');
  
  const { 
    data: bundles, 
    isLoading, 
    refetch,
    fetchNextPage,
    hasNextPage,
  } = trpc.bundles.list.useInfiniteQuery(
    { 
      limit: 20,
      status: activeTab === 'all' ? undefined : activeTab,
      search: searchQuery || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  
  const updateStatusMutation = trpc.bundles.updateStatus.useMutation({
    onSuccess: () => {
      toast({ title: 'Success', description: 'Bundle status updated' });
      refetch();
      setActionDialogOpen(false);
      setSelectedBundle(null);
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
  
  const allBundles = bundles?.pages.flatMap(page => page.items) || [];
  
  const handleAction = (bundle: Bundle, action: 'approve' | 'reject' | 'unpublish') => {
    setSelectedBundle(bundle);
    setActionType(action);
    setActionDialogOpen(true);
  };
  
  const confirmAction = () => {
    if (!selectedBundle) return;
    
    const statusMap = {
      approve: 'published',
      reject: 'rejected',
      unpublish: 'draft',
    };
    
    updateStatusMutation.mutate({
      bundleId: selectedBundle.id,
      status: statusMap[actionType],
    });
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge variant="success">Published</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  const renderBundleCard = ({ item: bundle }: { item: Bundle }) => (
    <Pressable onPress={() => router.push(`/manager/bundles/${bundle.id}`)}>
      <Card marginBottom="$3">
        <CardContent padding="$0">
          {/* Bundle Image */}
          {bundle.imageUrl && (
            <Image
              source={{ uri: bundle.imageUrl }}
              width="100%"
              height={150}
              borderTopLeftRadius="$4"
              borderTopRightRadius="$4"
            />
          )}
          
          <YStack padding="$3" gap="$2">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack flex={1} gap="$1">
                <Text fontSize="$4" fontWeight="600" numberOfLines={1}>{bundle.name}</Text>
                {bundle.category && (
                  <Badge variant="outline" size="sm">{bundle.category}</Badge>
                )}
              </YStack>
              
              <XStack alignItems="center" gap="$2">
                {getStatusBadge(bundle.status)}
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Pressable>
                      <MoreVertical size={20} color="$gray10" />
                    </Pressable>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onPress={() => router.push(`/manager/bundles/${bundle.id}`)}>
                      <Eye size={16} />
                      <Text>View Details</Text>
                    </DropdownMenuItem>
                    {bundle.status === 'pending' && (
                      <>
                        <DropdownMenuItem onPress={() => handleAction(bundle, 'approve')}>
                          <CheckCircle size={16} />
                          <Text>Approve</Text>
                        </DropdownMenuItem>
                        <DropdownMenuItem onPress={() => handleAction(bundle, 'reject')}>
                          <XCircle size={16} />
                          <Text>Reject</Text>
                        </DropdownMenuItem>
                      </>
                    )}
                    {bundle.status === 'published' && (
                      <DropdownMenuItem onPress={() => handleAction(bundle, 'unpublish')}>
                        <XCircle size={16} />
                        <Text>Unpublish</Text>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </XStack>
            </XStack>
            
            {/* Trainer Info */}
            {bundle.trainer && (
              <Pressable onPress={() => router.push(`/manager/trainers/${bundle.trainer!.id}`)}>
                <XStack alignItems="center" gap="$2">
                  <Avatar
                    src={bundle.trainer.photoUrl}
                    fallback={bundle.trainer.name?.charAt(0) || 'T'}
                    size="xs"
                  />
                  <Text fontSize="$2" color="$gray10">{bundle.trainer.name}</Text>
                </XStack>
              </Pressable>
            )}
            
            {/* Price and Rating */}
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$5" fontWeight="700" color="$green10">
                ${bundle.price.toFixed(2)}
              </Text>
              {bundle.rating !== undefined && (
                <XStack alignItems="center" gap="$1">
                  <Star size={14} color="$yellow10" fill="$yellow10" />
                  <Text fontSize="$3" color="$gray10">{bundle.rating.toFixed(1)}</Text>
                </XStack>
              )}
            </XStack>
            
            {/* Stats */}
            <XStack gap="$4" marginTop="$2">
              <XStack alignItems="center" gap="$1">
                <ShoppingCart size={14} color="$gray10" />
                <Text fontSize="$2" color="$gray10">{bundle.totalSales} sales</Text>
              </XStack>
              <XStack alignItems="center" gap="$1">
                <DollarSign size={14} color="$gray10" />
                <Text fontSize="$2" color="$gray10">${bundle.totalRevenue.toLocaleString()}</Text>
              </XStack>
            </XStack>
          </YStack>
        </CardContent>
      </Card>
    </Pressable>
  );
  
  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack padding="$4" paddingBottom="$2" gap="$3">
        <Text fontSize="$7" fontWeight="700">Bundles</Text>
        
        {/* Search */}
        <SearchInput
          placeholder="Search bundles..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BundleStatus)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
          </TabsList>
        </Tabs>
      </YStack>
      
      {/* Bundles List */}
      {isLoading ? (
        <YStack padding="$4" gap="$3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={250} borderRadius="$4" />
          ))}
        </YStack>
      ) : allBundles.length === 0 ? (
        <EmptyState
          icon={<Package size={48} color="$gray8" />}
          title="No bundles found"
          description={searchQuery ? 'Try a different search term' : 'No bundles match the selected filter'}
        />
      ) : (
        <FlatList
          data={allBundles}
          renderItem={renderBundleCard}
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
              {actionType === 'approve' && 'Approve Bundle'}
              {actionType === 'reject' && 'Reject Bundle'}
              {actionType === 'unpublish' && 'Unpublish Bundle'}
            </DialogTitle>
          </DialogHeader>
          <Text color="$gray11">
            {actionType === 'approve' && `Approve "${selectedBundle?.name}" for publishing?`}
            {actionType === 'reject' && `Reject "${selectedBundle?.name}"? The trainer will be notified.`}
            {actionType === 'unpublish' && `Unpublish "${selectedBundle?.name}"? It will no longer be visible to clients.`}
          </Text>
          <DialogFooter>
            <Button variant="outline" onPress={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'reject' || actionType === 'unpublish' ? 'destructive' : 'default'}
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
