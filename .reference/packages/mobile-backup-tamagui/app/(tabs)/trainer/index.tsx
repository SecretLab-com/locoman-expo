import { useState, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Users, 
  Package, 
  DollarSign, 
  TrendingUp,
  Calendar,
  Plus,
  ChevronRight,
  Clock,
  Star,
} from '@tamagui/lucide-icons';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/Avatar';
import { SkeletonStatCard, SkeletonListItem } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  onPress?: () => void;
}

function StatCard({ title, value, change, changeType = 'neutral', icon, onPress }: StatCardProps) {
  return (
    <Card 
      flex={1} 
      minWidth={150}
      pressable={!!onPress}
      onPress={onPress}
    >
      <CardContent>
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack gap="$1">
            <Text fontSize="$2" color="$mutedForeground">{title}</Text>
            <Text fontSize="$6" fontWeight="700" color="$color">{value}</Text>
            {change && (
              <XStack alignItems="center" gap="$1">
                <TrendingUp 
                  size={12} 
                  color={changeType === 'positive' ? '$success' : changeType === 'negative' ? '$error' : '$mutedForeground'} 
                />
                <Text 
                  fontSize="$1" 
                  color={changeType === 'positive' ? '$success' : changeType === 'negative' ? '$error' : '$mutedForeground'}
                >
                  {change}
                </Text>
              </XStack>
            )}
          </YStack>
          <YStack 
            backgroundColor="$primaryLight" 
            padding="$2" 
            borderRadius="$3"
          >
            {icon}
          </YStack>
        </XStack>
      </CardContent>
    </Card>
  );
}

// Bundle item for recent bundles
interface BundleItemProps {
  bundle: {
    id: number;
    title: string;
    status: string;
    price: string;
  };
  onPress: () => void;
}

function BundleItem({ bundle, onPress }: BundleItemProps) {
  return (
    <Card pressable onPress={onPress}>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <YStack 
            width={40} 
            height={40} 
            backgroundColor="$muted"
            borderRadius="$2"
            alignItems="center"
            justifyContent="center"
          >
            <Package size={20} color="$mutedForeground" />
          </YStack>
          <YStack flex={1} gap="$1">
            <Text fontSize="$3" fontWeight="500" color="$color" numberOfLines={1}>
              {bundle.title}
            </Text>
            <Text fontSize="$2" color="$primary" fontWeight="600">
              ${bundle.price}
            </Text>
          </YStack>
          <Badge variant={getStatusBadgeVariant(bundle.status)} size="sm">
            {bundle.status.replace('_', ' ')}
          </Badge>
        </XStack>
      </CardContent>
    </Card>
  );
}

export default function TrainerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch bundles to calculate stats
  const { 
    data: bundles, 
    isLoading: bundlesLoading, 
    refetch: refetchBundles 
  } = trpc.bundles.list.useQuery();

  // Calculate stats from bundles
  const stats = useMemo(() => {
    if (!bundles) return null;
    
    const activeBundles = bundles.filter(b => 
      b.status === 'approved' || b.status === 'published'
    ).length;
    
    const draftBundles = bundles.filter(b => b.status === 'draft').length;
    const pendingBundles = bundles.filter(b => b.status === 'pending_review').length;
    
    return {
      totalBundles: bundles.length,
      activeBundles,
      draftBundles,
      pendingBundles,
    };
  }, [bundles]);

  // Get recent bundles (last 3)
  const recentBundles = useMemo(() => {
    if (!bundles) return [];
    return [...bundles]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3);
  }, [bundles]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchBundles();
    setRefreshing(false);
  };

  const isLoading = bundlesLoading;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        flex={1}
        backgroundColor="$background"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <YStack padding="$4" gap="$4">
          {/* Header */}
          <XStack justifyContent="space-between" alignItems="flex-start">
            <YStack gap="$1">
              <Text fontSize="$2" color="$mutedForeground">Welcome back,</Text>
              <Text fontSize="$7" fontWeight="700" color="$color">
                {user?.name || 'Trainer'}
              </Text>
            </YStack>
            <Button 
              size="sm" 
              leftIcon={<Plus size={16} />}
              onPress={() => router.push('/trainer/bundles/new')}
            >
              New Bundle
            </Button>
          </XStack>

          {/* Stats Grid */}
          <YStack gap="$3">
            {isLoading ? (
              <XStack gap="$3" flexWrap="wrap">
                <SkeletonStatCard />
                <SkeletonStatCard />
              </XStack>
            ) : (
              <>
                <XStack gap="$3">
                  <StatCard
                    title="Total Bundles"
                    value={stats?.totalBundles || 0}
                    icon={<Package size={20} color="$primary" />}
                    onPress={() => router.push('/trainer/bundles')}
                  />
                  <StatCard
                    title="Active"
                    value={stats?.activeBundles || 0}
                    change="Published & Approved"
                    changeType="positive"
                    icon={<Star size={20} color="$primary" />}
                    onPress={() => router.push('/trainer/bundles')}
                  />
                </XStack>
                <XStack gap="$3">
                  <StatCard
                    title="Drafts"
                    value={stats?.draftBundles || 0}
                    icon={<Clock size={20} color="$primary" />}
                    onPress={() => router.push('/trainer/bundles')}
                  />
                  <StatCard
                    title="Pending Review"
                    value={stats?.pendingBundles || 0}
                    icon={<TrendingUp size={20} color="$primary" />}
                    onPress={() => router.push('/trainer/bundles')}
                  />
                </XStack>
              </>
            )}
          </YStack>

          {/* Recent Bundles */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$4" fontWeight="600" color="$color">Recent Bundles</Text>
              <Button variant="ghost" size="sm" onPress={() => router.push('/trainer/bundles')}>
                View All
              </Button>
            </XStack>
            {bundlesLoading ? (
              <>
                <SkeletonListItem />
                <SkeletonListItem />
              </>
            ) : recentBundles.length > 0 ? (
              <YStack gap="$2">
                {recentBundles.map((bundle) => (
                  <BundleItem 
                    key={bundle.id} 
                    bundle={bundle} 
                    onPress={() => router.push(`/trainer/bundles/${bundle.id}`)}
                  />
                ))}
              </YStack>
            ) : (
              <Card>
                <CardContent>
                  <YStack alignItems="center" gap="$2" padding="$4">
                    <Package size={32} color="$mutedForeground" />
                    <Text color="$mutedForeground">No bundles yet</Text>
                    <Text fontSize="$2" color="$mutedForeground" textAlign="center">
                      Create your first bundle to start selling to clients
                    </Text>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      marginTop="$2"
                      leftIcon={<Plus size={16} />}
                      onPress={() => router.push('/trainer/bundles/new')}
                    >
                      Create Bundle
                    </Button>
                  </YStack>
                </CardContent>
              </Card>
            )}
          </YStack>

          {/* Quick Actions */}
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="600" color="$color">Quick Actions</Text>
            <XStack gap="$2" flexWrap="wrap">
              <Button 
                variant="outline" 
                size="sm"
                leftIcon={<Plus size={16} />}
                onPress={() => router.push('/trainer/bundles/new')}
              >
                Create Bundle
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                leftIcon={<Package size={16} />}
                onPress={() => router.push('/trainer/bundles')}
              >
                Manage Bundles
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                leftIcon={<Users size={16} />}
                onPress={() => router.push('/trainer/clients')}
              >
                View Clients
              </Button>
            </XStack>
          </YStack>

          {/* Tips Card */}
          <Card backgroundColor="$primaryLight">
            <CardContent>
              <YStack gap="$2">
                <Text fontSize="$4" fontWeight="600" color="$primary">
                  💡 Trainer Tips
                </Text>
                <Text fontSize="$3" color="$color">
                  Create bundles with multiple products to offer more value to your clients. 
                  Bundles with 3+ products tend to sell better!
                </Text>
              </YStack>
            </CardContent>
          </Card>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
