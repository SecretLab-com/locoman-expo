import { useState, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Package, 
  Plus,
  Filter,
  MoreVertical,
  Edit,
  Copy,
  Trash,
  Eye,
  Send,
  CheckCircle,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/Select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, MenuItem } from '@/components/ui/DropdownMenu';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import { EmptyStateBox, SearchEmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

// Status filter options
const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'published', label: 'Published' },
];

// Bundle item component
interface BundleDraft {
  id: number;
  title: string;
  description?: string | null;
  price: string;
  status: string;
  imageUrl?: string | null;
  products?: Array<{ id: number; name: string; quantity: number }>;
  createdAt: Date;
  updatedAt: Date;
}

function BundleItem({ 
  bundle, 
  onPress,
  onEdit,
  onDuplicate,
  onDelete,
  onSubmitForReview,
}: { 
  bundle: BundleDraft;
  onPress: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSubmitForReview: () => void;
}) {
  const productCount = bundle.products?.length || 0;
  const canSubmit = bundle.status === 'draft' && productCount > 0;
  
  return (
    <Card pressable onPress={onPress}>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <YStack 
            width={60}
            height={60}
            backgroundColor="$muted"
            borderRadius="$3"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            {bundle.imageUrl ? (
              <YStack 
                width="100%" 
                height="100%" 
                backgroundColor="$muted"
              />
            ) : (
              <Package size={24} color="$mutedForeground" />
            )}
          </YStack>
          <YStack flex={1} gap="$1">
            <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={1}>
              {bundle.title}
            </Text>
            <XStack gap="$2" alignItems="center">
              <Text fontSize="$3" fontWeight="600" color="$primary">
                ${bundle.price}
              </Text>
              <Text fontSize="$2" color="$mutedForeground">
                • {productCount} products
              </Text>
            </XStack>
            <XStack gap="$2" marginTop="$1">
              <Badge variant={getStatusBadgeVariant(bundle.status)} size="sm">
                {bundle.status.replace('_', ' ')}
              </Badge>
            </XStack>
          </YStack>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical size={20} color="$mutedForeground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <MenuItem
                icon={<Eye size={16} />}
                label="View Details"
                onPress={onPress}
              />
              <MenuItem
                icon={<Edit size={16} />}
                label="Edit Bundle"
                onPress={onEdit}
              />
              {canSubmit && (
                <MenuItem
                  icon={<Send size={16} />}
                  label="Submit for Review"
                  onPress={onSubmitForReview}
                />
              )}
              <MenuItem
                icon={<Copy size={16} />}
                label="Duplicate"
                onPress={onDuplicate}
              />
              <MenuItem
                icon={<Trash size={16} />}
                label="Delete"
                onPress={onDelete}
                destructive
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </XStack>
      </CardContent>
    </Card>
  );
}

export default function TrainerBundles() {
  const router = useRouter();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch bundles using the correct API endpoint
  const { 
    data: bundles, 
    isLoading,
    refetch,
  } = trpc.bundles.list.useQuery();

  // Filter bundles based on search and status
  const filteredBundles = useMemo(() => {
    if (!bundles) return [];
    return bundles.filter((bundle) => {
      const matchesSearch = !searchQuery || 
        bundle.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bundle.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || bundle.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [bundles, searchQuery, statusFilter]);

  // Delete bundle mutation
  const deleteBundle = trpc.bundles.delete.useMutation({
    onSuccess: () => {
      toast.success('Bundle deleted');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to delete bundle', error.message);
    },
  });

  // Submit for review mutation
  const submitForReview = trpc.bundles.submitForReview.useMutation({
    onSuccess: () => {
      toast.success('Bundle submitted for review');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to submit bundle', error.message);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleBundlePress = (bundleId: number) => {
    router.push(`/trainer/bundles/${bundleId}`);
  };

  const handleEditBundle = (bundleId: number) => {
    router.push(`/trainer/bundles/${bundleId}/edit`);
  };

  const handleDuplicateBundle = (bundleId: number) => {
    // For now, show a toast - we'd need to implement duplicate on backend
    toast.info('Duplicate feature coming soon');
  };

  const handleDeleteBundle = (bundleId: number) => {
    Alert.alert(
      'Delete Bundle',
      'Are you sure you want to delete this bundle? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteBundle.mutate({ id: bundleId }),
        },
      ]
    );
  };

  const handleSubmitForReview = (bundleId: number) => {
    Alert.alert(
      'Submit for Review',
      'Submit this bundle for manager approval? You won\'t be able to edit it while it\'s under review.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Submit', 
          onPress: () => submitForReview.mutate({ id: bundleId }),
        },
      ]
    );
  };

  // Status counts for filter badges
  const statusCounts = useMemo(() => {
    if (!bundles) return {};
    return bundles.reduce((acc, bundle) => {
      acc[bundle.status] = (acc[bundle.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [bundles]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <YStack padding="$4" paddingBottom="$2" gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontSize="$7" fontWeight="700" color="$color">Bundles</Text>
              <Text fontSize="$3" color="$mutedForeground">
                {filteredBundles.length} of {bundles?.length || 0} bundles
              </Text>
            </YStack>
            <Button 
              size="sm" 
              leftIcon={<Plus size={16} />}
              onPress={() => router.push('/trainer/bundles/new')}
            >
              Create
            </Button>
          </XStack>

          {/* Search and Filter */}
          <XStack gap="$2">
            <YStack flex={1}>
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search bundles..."
              />
            </YStack>
            <Button 
              variant={showFilters ? 'secondary' : 'outline'} 
              size="icon"
              onPress={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} />
            </Button>
          </XStack>

          {/* Filter Options */}
          {showFilters && (
            <YStack gap="$2">
              <SelectField
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={statusOptions.map(opt => ({
                  ...opt,
                  label: `${opt.label}${statusCounts[opt.value] ? ` (${statusCounts[opt.value]})` : ''}`,
                }))}
              />
            </YStack>
          )}
        </YStack>

        {/* Bundle List */}
        <FlatList
          data={filteredBundles}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <BundleItem
              bundle={item}
              onPress={() => handleBundlePress(item.id)}
              onEdit={() => handleEditBundle(item.id)}
              onDuplicate={() => handleDuplicateBundle(item.id)}
              onDelete={() => handleDeleteBundle(item.id)}
              onSubmitForReview={() => handleSubmitForReview(item.id)}
            />
          )}
          ListEmptyComponent={
            isLoading ? (
              <YStack gap="$3">
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </YStack>
            ) : searchQuery || statusFilter !== 'all' ? (
              <SearchEmptyState 
                query={searchQuery || statusFilter} 
                onClear={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }} 
              />
            ) : (
              <EmptyStateBox
                icon={<Package size={32} color="$mutedForeground" />}
                title="No bundles yet"
                description="Create your first bundle to start selling to clients."
                action={{
                  label: 'Create Bundle',
                  onPress: () => router.push('/trainer/bundles/new'),
                }}
              />
            )
          }
        />
      </YStack>
    </SafeAreaView>
  );
}
