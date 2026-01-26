import { useState } from 'react';
import { YStack, XStack, Text, ScrollView, Separator } from 'tamagui';
import { RefreshControl, Alert, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft,
  Package,
  Edit,
  Send,
  Trash,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  ShoppingBag,
} from '@tamagui/lucide-icons';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'approved':
    case 'published':
      return <CheckCircle size={20} color="$green10" />;
    case 'rejected':
      return <XCircle size={20} color="$red10" />;
    case 'pending_review':
      return <Clock size={20} color="$yellow10" />;
    default:
      return <AlertCircle size={20} color="$gray10" />;
  }
}

export default function BundleDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [refreshing, setRefreshing] = useState(false);

  const bundleId = parseInt(id || '0', 10);

  // Fetch bundle details
  const { 
    data: bundle, 
    isLoading,
    refetch,
  } = trpc.bundles.get.useQuery(
    { id: bundleId },
    { enabled: bundleId > 0 }
  );

  // Delete mutation
  const deleteBundle = trpc.bundles.delete.useMutation({
    onSuccess: () => {
      toast.success('Bundle deleted');
      utils.bundles.list.invalidate();
      router.back();
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

  const handleDelete = () => {
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

  const handleSubmitForReview = () => {
    if (!bundle?.products?.length) {
      toast.error('Please add at least one product before submitting');
      return;
    }
    
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

  const canEdit = bundle?.status === 'draft' || bundle?.status === 'rejected';
  const canSubmit = bundle?.status === 'draft' && (bundle?.products?.length || 0) > 0;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background" padding="$4" gap="$4">
          <Skeleton width="100%" height={200} borderRadius="$4" />
          <Skeleton width="60%" height={24} />
          <Skeleton width="40%" height={20} />
          <Skeleton width="100%" height={100} />
        </YStack>
      </SafeAreaView>
    );
  }

  if (!bundle) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background" padding="$4" alignItems="center" justifyContent="center">
          <Package size={48} color="$mutedForeground" />
          <Text fontSize="$5" fontWeight="600" color="$color" marginTop="$4">
            Bundle Not Found
          </Text>
          <Button marginTop="$4" onPress={() => router.back()}>
            Go Back
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <XStack 
          padding="$4" 
          alignItems="center" 
          gap="$3"
          borderBottomWidth={1}
          borderBottomColor="$border"
        >
          <Button 
            variant="ghost" 
            size="icon" 
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} />
          </Button>
          <YStack flex={1}>
            <Text fontSize="$5" fontWeight="700" color="$color" numberOfLines={1}>
              {bundle.title}
            </Text>
            <XStack alignItems="center" gap="$2">
              <StatusIcon status={bundle.status} />
              <Badge variant={getStatusBadgeVariant(bundle.status)} size="sm">
                {bundle.status.replace('_', ' ')}
              </Badge>
            </XStack>
          </YStack>
          {canEdit && (
            <Button 
              variant="outline" 
              size="sm"
              leftIcon={<Edit size={16} />}
              onPress={() => router.push(`/trainer/bundles/${bundleId}/edit`)}
            >
              Edit
            </Button>
          )}
        </XStack>

        <ScrollView 
          flex={1} 
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          <YStack gap="$4">
            {/* Cover Image */}
            {bundle.imageUrl && (
              <Card overflow="hidden">
                <Image
                  source={{ uri: bundle.imageUrl }}
                  style={{ width: '100%', height: 200 }}
                  resizeMode="cover"
                />
              </Card>
            )}

            {/* Bundle Info */}
            <Card>
              <CardHeader>
                <CardTitle>Bundle Information</CardTitle>
              </CardHeader>
              <CardContent gap="$3">
                <YStack gap="$1">
                  <Text fontSize="$2" color="$mutedForeground">Price</Text>
                  <XStack alignItems="center" gap="$1">
                    <DollarSign size={20} color="$primary" />
                    <Text fontSize="$6" fontWeight="700" color="$primary">
                      {bundle.price}
                    </Text>
                  </XStack>
                </YStack>

                {bundle.description && (
                  <YStack gap="$1">
                    <Text fontSize="$2" color="$mutedForeground">Description</Text>
                    <Text fontSize="$3" color="$color">
                      {bundle.description}
                    </Text>
                  </YStack>
                )}

                <Separator />

                <XStack justifyContent="space-between">
                  <YStack>
                    <Text fontSize="$2" color="$mutedForeground">Created</Text>
                    <Text fontSize="$3" color="$color">
                      {new Date(bundle.createdAt).toLocaleDateString()}
                    </Text>
                  </YStack>
                  <YStack alignItems="flex-end">
                    <Text fontSize="$2" color="$mutedForeground">Updated</Text>
                    <Text fontSize="$3" color="$color">
                      {new Date(bundle.updatedAt).toLocaleDateString()}
                    </Text>
                  </YStack>
                </XStack>
              </CardContent>
            </Card>

            {/* Products */}
            <Card>
              <CardHeader>
                <XStack justifyContent="space-between" alignItems="center">
                  <CardTitle>
                    <XStack alignItems="center" gap="$2">
                      <ShoppingBag size={20} />
                      <Text>Products ({bundle.products?.length || 0})</Text>
                    </XStack>
                  </CardTitle>
                  {canEdit && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onPress={() => router.push(`/trainer/bundles/${bundleId}/edit`)}
                    >
                      Manage
                    </Button>
                  )}
                </XStack>
              </CardHeader>
              <CardContent>
                {bundle.products && bundle.products.length > 0 ? (
                  <YStack gap="$3">
                    {bundle.products.map((product, index) => (
                      <XStack 
                        key={product.id || index} 
                        alignItems="center" 
                        gap="$3"
                        padding="$2"
                        backgroundColor="$muted"
                        borderRadius="$2"
                      >
                        <YStack 
                          width={40} 
                          height={40} 
                          backgroundColor="$background"
                          borderRadius="$2"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Package size={20} color="$mutedForeground" />
                        </YStack>
                        <YStack flex={1}>
                          <Text fontSize="$3" fontWeight="500" color="$color">
                            {product.name}
                          </Text>
                          <Text fontSize="$2" color="$mutedForeground">
                            Qty: {product.quantity}
                          </Text>
                        </YStack>
                      </XStack>
                    ))}
                  </YStack>
                ) : (
                  <YStack alignItems="center" padding="$4">
                    <Package size={32} color="$mutedForeground" />
                    <Text fontSize="$3" color="$mutedForeground" marginTop="$2">
                      No products added yet
                    </Text>
                    {canEdit && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        marginTop="$3"
                        onPress={() => router.push(`/trainer/bundles/${bundleId}/edit`)}
                      >
                        Add Products
                      </Button>
                    )}
                  </YStack>
                )}
              </CardContent>
            </Card>

            {/* Status-specific messages */}
            {bundle.status === 'rejected' && (
              <Card borderColor="$red6" borderWidth={1}>
                <CardContent>
                  <XStack gap="$3" alignItems="flex-start">
                    <XCircle size={24} color="$red10" />
                    <YStack flex={1}>
                      <Text fontSize="$4" fontWeight="600" color="$red10">
                        Bundle Rejected
                      </Text>
                      <Text fontSize="$3" color="$color" marginTop="$1">
                        Please review the feedback and make necessary changes before resubmitting.
                      </Text>
                    </YStack>
                  </XStack>
                </CardContent>
              </Card>
            )}

            {bundle.status === 'pending_review' && (
              <Card borderColor="$yellow6" borderWidth={1}>
                <CardContent>
                  <XStack gap="$3" alignItems="flex-start">
                    <Clock size={24} color="$yellow10" />
                    <YStack flex={1}>
                      <Text fontSize="$4" fontWeight="600" color="$yellow10">
                        Under Review
                      </Text>
                      <Text fontSize="$3" color="$color" marginTop="$1">
                        Your bundle is being reviewed by a manager. You'll be notified once it's approved.
                      </Text>
                    </YStack>
                  </XStack>
                </CardContent>
              </Card>
            )}

            {bundle.status === 'approved' && (
              <Card borderColor="$green6" borderWidth={1}>
                <CardContent>
                  <XStack gap="$3" alignItems="flex-start">
                    <CheckCircle size={24} color="$green10" />
                    <YStack flex={1}>
                      <Text fontSize="$4" fontWeight="600" color="$green10">
                        Approved
                      </Text>
                      <Text fontSize="$3" color="$color" marginTop="$1">
                        Your bundle has been approved and is ready to be published.
                      </Text>
                    </YStack>
                  </XStack>
                </CardContent>
              </Card>
            )}
          </YStack>
        </ScrollView>

        {/* Footer Actions */}
        <YStack 
          padding="$4" 
          borderTopWidth={1} 
          borderTopColor="$border"
          backgroundColor="$background"
        >
          <XStack gap="$3">
            {canEdit && (
              <Button 
                variant="destructive" 
                size="icon"
                onPress={handleDelete}
              >
                <Trash size={20} />
              </Button>
            )}
            {canSubmit && (
              <Button 
                flex={1}
                leftIcon={<Send size={16} />}
                onPress={handleSubmitForReview}
              >
                Submit for Review
              </Button>
            )}
            {bundle.status === 'approved' && (
              <Button 
                flex={1}
                onPress={() => toast.info('Publish feature coming soon')}
              >
                Publish to Store
              </Button>
            )}
          </XStack>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
