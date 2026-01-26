import { useState } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Users, 
  Package, 
  Check, 
  X,
  ChevronRight,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { UserAvatar } from '@/components/ui/Avatar';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import { EmptyStateBox } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

// Trainer application item
interface TrainerApplication {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
}

function TrainerApplicationItem({ 
  application, 
  onApprove, 
  onReject,
  isProcessing,
}: { 
  application: TrainerApplication;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <UserAvatar src={application.avatar || undefined} name={application.name} size="lg" />
          <YStack flex={1} gap="$1">
            <Text fontSize="$4" fontWeight="600" color="$color">{application.name}</Text>
            <Text fontSize="$2" color="$mutedForeground">{application.email}</Text>
            <Badge variant="warning" size="sm" marginTop="$1">
              Pending Approval
            </Badge>
          </YStack>
        </XStack>
        <XStack marginTop="$3" gap="$2">
          <Button 
            flex={1} 
            variant="outline" 
            size="sm"
            onPress={onReject}
            disabled={isProcessing}
            leftIcon={<X size={16} />}
          >
            Reject
          </Button>
          <Button 
            flex={1} 
            variant="success" 
            size="sm"
            onPress={onApprove}
            disabled={isProcessing}
            loading={isProcessing}
            leftIcon={<Check size={16} />}
          >
            Approve
          </Button>
        </XStack>
      </CardContent>
    </Card>
  );
}

// Bundle submission item
interface BundleSubmission {
  id: number;
  title: string;
  price: string;
  status: string;
  trainer?: {
    name: string;
    avatar?: string | null;
  };
  products?: Array<{ id: number; name: string; quantity: number }>;
}

function BundleSubmissionItem({ 
  bundle, 
  onApprove,
  onReject,
  isProcessing,
}: { 
  bundle: BundleSubmission;
  onApprove: () => void;
  onReject: () => void;
  isProcessing: boolean;
}) {
  const productCount = bundle.products?.length || 0;
  
  return (
    <Card>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <YStack 
            backgroundColor="$primaryLight" 
            padding="$3" 
            borderRadius="$3"
          >
            <Package size={24} color="$primary" />
          </YStack>
          <YStack flex={1} gap="$1">
            <Text fontSize="$4" fontWeight="600" color="$color">{bundle.title}</Text>
            {bundle.trainer && (
              <XStack alignItems="center" gap="$2">
                <UserAvatar src={bundle.trainer.avatar || undefined} name={bundle.trainer.name} size="xs" />
                <Text fontSize="$2" color="$mutedForeground">{bundle.trainer.name}</Text>
              </XStack>
            )}
            <XStack gap="$2" marginTop="$1">
              <Badge variant="secondary" size="sm">
                ${bundle.price}
              </Badge>
              <Badge variant="secondary" size="sm">
                {productCount} products
              </Badge>
            </XStack>
          </YStack>
        </XStack>
        <XStack marginTop="$3" gap="$2">
          <Button 
            flex={1} 
            variant="outline" 
            size="sm"
            onPress={onReject}
            disabled={isProcessing}
            leftIcon={<X size={16} />}
          >
            Reject
          </Button>
          <Button 
            flex={1} 
            variant="success" 
            size="sm"
            onPress={onApprove}
            disabled={isProcessing}
            loading={isProcessing}
            leftIcon={<Check size={16} />}
          >
            Approve
          </Button>
        </XStack>
      </CardContent>
    </Card>
  );
}

export default function ManagerApprovals() {
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState('trainers');
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  // Fetch pending trainer applications (users with role 'pending_trainer')
  const { 
    data: pendingTrainers, 
    isLoading: trainersLoading,
    refetch: refetchTrainers,
  } = trpc.users.listPendingTrainers.useQuery();

  // Fetch pending bundle submissions
  const { 
    data: pendingBundles, 
    isLoading: bundlesLoading,
    refetch: refetchBundles,
  } = trpc.bundles.listPending.useQuery();

  // Approve trainer mutation
  const approveTrainer = trpc.users.approveTrainer.useMutation({
    onSuccess: () => {
      toast.success('Trainer approved', 'The trainer has been approved and notified.');
      utils.users.listPendingTrainers.invalidate();
      setProcessingId(null);
    },
    onError: (error) => {
      toast.error('Failed to approve', error.message);
      setProcessingId(null);
    },
  });

  // Reject trainer mutation
  const rejectTrainer = trpc.users.rejectTrainer.useMutation({
    onSuccess: () => {
      toast.success('Application rejected', 'The trainer application has been rejected.');
      utils.users.listPendingTrainers.invalidate();
      setProcessingId(null);
    },
    onError: (error) => {
      toast.error('Failed to reject', error.message);
      setProcessingId(null);
    },
  });

  // Approve bundle mutation
  const approveBundle = trpc.bundles.approve.useMutation({
    onSuccess: () => {
      toast.success('Bundle approved', 'The bundle has been approved and published.');
      utils.bundles.listPending.invalidate();
      setProcessingId(null);
    },
    onError: (error) => {
      toast.error('Failed to approve', error.message);
      setProcessingId(null);
    },
  });

  // Reject bundle mutation
  const rejectBundle = trpc.bundles.reject.useMutation({
    onSuccess: () => {
      toast.success('Bundle rejected', 'The bundle has been rejected.');
      utils.bundles.listPending.invalidate();
      setProcessingId(null);
    },
    onError: (error) => {
      toast.error('Failed to reject', error.message);
      setProcessingId(null);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchTrainers(), refetchBundles()]);
    setRefreshing(false);
  };

  const handleApproveTrainer = (id: number) => {
    setProcessingId(id);
    approveTrainer.mutate({ userId: id });
  };

  const handleRejectTrainer = (id: number) => {
    setProcessingId(id);
    rejectTrainer.mutate({ userId: id });
  };

  const handleApproveBundle = (id: number) => {
    setProcessingId(id);
    approveBundle.mutate({ id });
  };

  const handleRejectBundle = (id: number) => {
    setProcessingId(id);
    rejectBundle.mutate({ id });
  };

  const trainerCount = pendingTrainers?.length || 0;
  const bundleCount = pendingBundles?.length || 0;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <YStack padding="$4" paddingBottom="$2">
          <Text fontSize="$7" fontWeight="700" color="$color">Approvals</Text>
          <Text fontSize="$3" color="$mutedForeground" marginTop="$1">
            Review pending applications and submissions
          </Text>
        </YStack>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} flex={1}>
          <YStack paddingHorizontal="$4">
            <TabsList variant="pills" fullWidth>
              <TabsTrigger value="trainers" variant="pills" fullWidth active={activeTab === 'trainers'}>
                <XStack alignItems="center" gap="$2">
                  <Users size={16} />
                  <Text>Trainers</Text>
                  {trainerCount > 0 && (
                    <Badge variant="warning" size="sm">{trainerCount}</Badge>
                  )}
                </XStack>
              </TabsTrigger>
              <TabsTrigger value="bundles" variant="pills" fullWidth active={activeTab === 'bundles'}>
                <XStack alignItems="center" gap="$2">
                  <Package size={16} />
                  <Text>Bundles</Text>
                  {bundleCount > 0 && (
                    <Badge variant="warning" size="sm">{bundleCount}</Badge>
                  )}
                </XStack>
              </TabsTrigger>
            </TabsList>
          </YStack>

          <ScrollView
            flex={1}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            {/* Trainers Tab */}
            <TabsContent value="trainers">
              <YStack padding="$4" gap="$3">
                {trainersLoading ? (
                  <>
                    <SkeletonListItem />
                    <SkeletonListItem />
                    <SkeletonListItem />
                  </>
                ) : pendingTrainers?.length ? (
                  pendingTrainers.map((trainer) => (
                    <TrainerApplicationItem
                      key={trainer.id}
                      application={trainer}
                      onApprove={() => handleApproveTrainer(trainer.id)}
                      onReject={() => handleRejectTrainer(trainer.id)}
                      isProcessing={processingId === trainer.id}
                    />
                  ))
                ) : (
                  <EmptyStateBox
                    icon={<Users size={32} color="$mutedForeground" />}
                    title="No pending applications"
                    description="All trainer applications have been reviewed."
                  />
                )}
              </YStack>
            </TabsContent>

            {/* Bundles Tab */}
            <TabsContent value="bundles">
              <YStack padding="$4" gap="$3">
                {bundlesLoading ? (
                  <>
                    <SkeletonListItem />
                    <SkeletonListItem />
                    <SkeletonListItem />
                  </>
                ) : pendingBundles?.length ? (
                  pendingBundles.map((bundle) => (
                    <BundleSubmissionItem
                      key={bundle.id}
                      bundle={bundle}
                      onApprove={() => handleApproveBundle(bundle.id)}
                      onReject={() => handleRejectBundle(bundle.id)}
                      isProcessing={processingId === bundle.id}
                    />
                  ))
                ) : (
                  <EmptyStateBox
                    icon={<Package size={32} color="$mutedForeground" />}
                    title="No pending bundles"
                    description="All bundle submissions have been reviewed."
                  />
                )}
              </YStack>
            </TabsContent>
          </ScrollView>
        </Tabs>
      </YStack>
    </SafeAreaView>
  );
}
