import React, { useState } from 'react';
import { FlatList, RefreshControl, Pressable } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { 
  Users, 
  Star, 
  Package, 
  DollarSign,
  Mail,
  Phone,
  Calendar,
  MoreVertical,
  Eye,
  Ban,
  CheckCircle,
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

type TrainerStatus = 'all' | 'active' | 'pending' | 'suspended';

interface Trainer {
  id: number;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  status: string;
  rating?: number;
  totalBundles: number;
  totalClients: number;
  totalEarnings: number;
  joinedAt: string;
  bio?: string;
}

export default function ManagerTrainers() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TrainerStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'suspend' | 'activate'>('approve');
  
  const { 
    data: trainers, 
    isLoading, 
    refetch,
    fetchNextPage,
    hasNextPage,
  } = trpc.manager.getTrainers.useInfiniteQuery(
    { 
      limit: 20,
      status: activeTab === 'all' ? undefined : activeTab,
      search: searchQuery || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );
  
  const updateStatusMutation = trpc.manager.updateTrainerStatus.useMutation({
    onSuccess: () => {
      toast({ title: 'Success', description: 'Trainer status updated' });
      refetch();
      setActionDialogOpen(false);
      setSelectedTrainer(null);
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
  
  const allTrainers = trainers?.pages.flatMap(page => page.items) || [];
  
  const handleAction = (trainer: Trainer, action: 'approve' | 'suspend' | 'activate') => {
    setSelectedTrainer(trainer);
    setActionType(action);
    setActionDialogOpen(true);
  };
  
  const confirmAction = () => {
    if (!selectedTrainer) return;
    
    const statusMap = {
      approve: 'active',
      suspend: 'suspended',
      activate: 'active',
    };
    
    updateStatusMutation.mutate({
      trainerId: selectedTrainer.id,
      status: statusMap[actionType],
    });
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };
  
  const renderTrainerCard = ({ item: trainer }: { item: Trainer }) => (
    <Pressable onPress={() => router.push(`/manager/trainers/${trainer.id}`)}>
      <Card marginBottom="$3">
        <CardContent>
          <XStack justifyContent="space-between" alignItems="flex-start">
            <XStack gap="$3" flex={1}>
              <Avatar
                src={trainer.photoUrl}
                fallback={trainer.name?.charAt(0) || 'T'}
                size="lg"
              />
              <YStack flex={1} gap="$1">
                <XStack alignItems="center" gap="$2">
                  <Text fontSize="$4" fontWeight="600">{trainer.name}</Text>
                  {getStatusBadge(trainer.status)}
                </XStack>
                
                <XStack alignItems="center" gap="$1">
                  <Mail size={12} color="$gray10" />
                  <Text fontSize="$2" color="$gray10">{trainer.email}</Text>
                </XStack>
                
                {trainer.phone && (
                  <XStack alignItems="center" gap="$1">
                    <Phone size={12} color="$gray10" />
                    <Text fontSize="$2" color="$gray10">{trainer.phone}</Text>
                  </XStack>
                )}
                
                {trainer.rating !== undefined && (
                  <XStack alignItems="center" gap="$1">
                    <Star size={12} color="$yellow10" fill="$yellow10" />
                    <Text fontSize="$2" color="$gray10">{trainer.rating.toFixed(1)}</Text>
                  </XStack>
                )}
              </YStack>
            </XStack>
            
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Pressable>
                  <MoreVertical size={20} color="$gray10" />
                </Pressable>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onPress={() => router.push(`/manager/trainers/${trainer.id}`)}>
                  <Eye size={16} />
                  <Text>View Profile</Text>
                </DropdownMenuItem>
                {trainer.status === 'pending' && (
                  <DropdownMenuItem onPress={() => handleAction(trainer, 'approve')}>
                    <CheckCircle size={16} />
                    <Text>Approve</Text>
                  </DropdownMenuItem>
                )}
                {trainer.status === 'active' && (
                  <DropdownMenuItem onPress={() => handleAction(trainer, 'suspend')}>
                    <Ban size={16} />
                    <Text>Suspend</Text>
                  </DropdownMenuItem>
                )}
                {trainer.status === 'suspended' && (
                  <DropdownMenuItem onPress={() => handleAction(trainer, 'activate')}>
                    <CheckCircle size={16} />
                    <Text>Reactivate</Text>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </XStack>
          
          {/* Stats */}
          <XStack marginTop="$3" gap="$4">
            <YStack alignItems="center">
              <Text fontSize="$5" fontWeight="700" color="$color">{trainer.totalBundles}</Text>
              <Text fontSize="$1" color="$gray10">Bundles</Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize="$5" fontWeight="700" color="$color">{trainer.totalClients}</Text>
              <Text fontSize="$1" color="$gray10">Clients</Text>
            </YStack>
            <YStack alignItems="center">
              <Text fontSize="$5" fontWeight="700" color="$green10">
                ${trainer.totalEarnings.toLocaleString()}
              </Text>
              <Text fontSize="$1" color="$gray10">Earnings</Text>
            </YStack>
          </XStack>
          
          {/* Join Date */}
          <XStack marginTop="$3" alignItems="center" gap="$1">
            <Calendar size={12} color="$gray10" />
            <Text fontSize="$2" color="$gray10">
              Joined {new Date(trainer.joinedAt).toLocaleDateString()}
            </Text>
          </XStack>
        </CardContent>
      </Card>
    </Pressable>
  );
  
  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <YStack padding="$4" paddingBottom="$2" gap="$3">
        <Text fontSize="$7" fontWeight="700">Trainers</Text>
        
        {/* Search */}
        <SearchInput
          placeholder="Search trainers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TrainerStatus)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
          </TabsList>
        </Tabs>
      </YStack>
      
      {/* Trainers List */}
      {isLoading ? (
        <YStack padding="$4" gap="$3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={200} borderRadius="$4" />
          ))}
        </YStack>
      ) : allTrainers.length === 0 ? (
        <EmptyState
          icon={<Users size={48} color="$gray8" />}
          title="No trainers found"
          description={searchQuery ? 'Try a different search term' : 'No trainers match the selected filter'}
        />
      ) : (
        <FlatList
          data={allTrainers}
          renderItem={renderTrainerCard}
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
              {actionType === 'approve' && 'Approve Trainer'}
              {actionType === 'suspend' && 'Suspend Trainer'}
              {actionType === 'activate' && 'Reactivate Trainer'}
            </DialogTitle>
          </DialogHeader>
          <Text color="$gray11">
            {actionType === 'approve' && `Approve ${selectedTrainer?.name} as a trainer?`}
            {actionType === 'suspend' && `Are you sure you want to suspend ${selectedTrainer?.name}? They will not be able to access trainer features.`}
            {actionType === 'activate' && `Reactivate ${selectedTrainer?.name}'s trainer account?`}
          </Text>
          <DialogFooter>
            <Button variant="outline" onPress={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'suspend' ? 'destructive' : 'default'}
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
