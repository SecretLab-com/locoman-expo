import { YStack, XStack, Text, ScrollView, Spinner } from 'tamagui';
import { useRouter } from 'expo-router';
import { RefreshControl } from 'react-native';
import { useState } from 'react';
import { 
  Users, 
  Package, 
  DollarSign, 
  TrendingUp,
  ClipboardCheck,
  AlertCircle,
  ChevronRight,
} from '@tamagui/lucide-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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

// Quick action card
interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  onPress: () => void;
}

function QuickAction({ title, description, icon, badge, onPress }: QuickActionProps) {
  return (
    <Card pressable onPress={onPress}>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <YStack 
            backgroundColor="$muted" 
            padding="$3" 
            borderRadius="$3"
          >
            {icon}
          </YStack>
          <YStack flex={1} gap="$1">
            <XStack alignItems="center" gap="$2">
              <Text fontSize="$4" fontWeight="600" color="$color">{title}</Text>
              {badge && <Badge variant="warning">{badge}</Badge>}
            </XStack>
            <Text fontSize="$2" color="$mutedForeground">{description}</Text>
          </YStack>
          <ChevronRight size={20} color="$mutedForeground" />
        </XStack>
      </CardContent>
    </Card>
  );
}

export default function ManagerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.manager.getDashboardStats.useQuery();
  
  // Fetch pending approvals count
  const { data: pendingApprovals, refetch: refetchApprovals } = trpc.manager.getPendingApprovalsCount.useQuery();

  // Fetch recent activity
  const { data: recentActivity, isLoading: activityLoading, refetch: refetchActivity } = trpc.manager.getRecentActivity.useQuery({ limit: 5 });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchApprovals(), refetchActivity()]);
    setRefreshing(false);
  };

  const isLoading = statsLoading;

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
          <YStack gap="$1">
            <Text fontSize="$2" color="$mutedForeground">Welcome back,</Text>
            <Text fontSize="$7" fontWeight="700" color="$color">
              {user?.name || 'Manager'}
            </Text>
          </YStack>

          {/* Stats Grid */}
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="600" color="$color">Overview</Text>
            {isLoading ? (
              <XStack gap="$3" flexWrap="wrap">
                <SkeletonStatCard />
                <SkeletonStatCard />
              </XStack>
            ) : (
              <>
                <XStack gap="$3">
                  <StatCard
                    title="Total Trainers"
                    value={stats?.totalTrainers || 0}
                    change="+12% this month"
                    changeType="positive"
                    icon={<Users size={20} color="$primary" />}
                    onPress={() => router.push('/manager/users')}
                  />
                  <StatCard
                    title="Active Bundles"
                    value={stats?.activeBundles || 0}
                    change="+8% this month"
                    changeType="positive"
                    icon={<Package size={20} color="$primary" />}
                    onPress={() => router.push('/manager/bundles')}
                  />
                </XStack>
                <XStack gap="$3">
                  <StatCard
                    title="Total Revenue"
                    value={`$${(stats?.totalRevenue || 0).toLocaleString()}`}
                    change="+23% this month"
                    changeType="positive"
                    icon={<DollarSign size={20} color="$primary" />}
                    onPress={() => router.push('/manager/analytics')}
                  />
                  <StatCard
                    title="Active Clients"
                    value={stats?.activeClients || 0}
                    change="+15% this month"
                    changeType="positive"
                    icon={<Users size={20} color="$primary" />}
                    onPress={() => router.push('/manager/users')}
                  />
                </XStack>
              </>
            )}
          </YStack>

          {/* Quick Actions */}
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="600" color="$color">Quick Actions</Text>
            <QuickAction
              title="Pending Approvals"
              description="Review trainer applications and bundle submissions"
              icon={<ClipboardCheck size={24} color="$warning" />}
              badge={pendingApprovals?.total ? `${pendingApprovals.total}` : undefined}
              onPress={() => router.push('/manager/approvals')}
            />
            <QuickAction
              title="Manage Users"
              description="View and manage all users across roles"
              icon={<Users size={24} color="$primary" />}
              onPress={() => router.push('/manager/users')}
            />
            <QuickAction
              title="View Analytics"
              description="Track performance metrics and revenue"
              icon={<TrendingUp size={24} color="$success" />}
              onPress={() => router.push('/manager/analytics')}
            />
          </YStack>

          {/* Recent Activity */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$4" fontWeight="600" color="$color">Recent Activity</Text>
              <Button variant="ghost" size="sm" onPress={() => router.push('/manager/activity')}>
                View All
              </Button>
            </XStack>
            <Card>
              <CardContent padding="$0">
                {activityLoading ? (
                  <>
                    <SkeletonListItem />
                    <SkeletonListItem />
                    <SkeletonListItem />
                  </>
                ) : recentActivity?.length ? (
                  recentActivity.map((activity, index) => (
                    <XStack
                      key={activity.id}
                      padding="$3"
                      gap="$3"
                      alignItems="center"
                      borderBottomWidth={index < recentActivity.length - 1 ? 1 : 0}
                      borderBottomColor="$borderColor"
                    >
                      <YStack 
                        backgroundColor="$muted" 
                        padding="$2" 
                        borderRadius="$2"
                      >
                        {activity.type === 'trainer_joined' && <Users size={16} color="$primary" />}
                        {activity.type === 'bundle_created' && <Package size={16} color="$success" />}
                        {activity.type === 'order_placed' && <DollarSign size={16} color="$warning" />}
                        {!['trainer_joined', 'bundle_created', 'order_placed'].includes(activity.type) && (
                          <AlertCircle size={16} color="$mutedForeground" />
                        )}
                      </YStack>
                      <YStack flex={1} gap="$0.5">
                        <Text fontSize="$3" color="$color">{activity.title}</Text>
                        <Text fontSize="$1" color="$mutedForeground">{activity.description}</Text>
                      </YStack>
                      <Text fontSize="$1" color="$mutedForeground">{activity.timeAgo}</Text>
                    </XStack>
                  ))
                ) : (
                  <YStack padding="$4" alignItems="center">
                    <Text color="$mutedForeground">No recent activity</Text>
                  </YStack>
                )}
              </CardContent>
            </Card>
          </YStack>
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
