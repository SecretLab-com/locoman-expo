import { useState, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  Download,
  Calendar,
} from '@tamagui/lucide-icons';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/Select';
import { SkeletonStatCard, Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

// Time range options
const timeRangeOptions = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

// Metric card component
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  prefix?: string;
}

function MetricCard({ title, value, change, icon, prefix = '' }: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card flex={1} minWidth={150}>
      <CardContent>
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack gap="$1" flex={1}>
            <Text fontSize="$2" color="$mutedForeground" numberOfLines={1}>
              {title}
            </Text>
            <Text fontSize="$6" fontWeight="700" color="$color">
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
            </Text>
            {change !== undefined && (
              <XStack alignItems="center" gap="$1">
                {isPositive ? (
                  <TrendingUp size={12} color="$success" />
                ) : isNegative ? (
                  <TrendingDown size={12} color="$error" />
                ) : null}
                <Text 
                  fontSize="$1" 
                  color={isPositive ? '$success' : isNegative ? '$error' : '$mutedForeground'}
                >
                  {isPositive ? '+' : ''}{change}%
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

// Simple bar chart component (placeholder for Victory Native)
function SimpleBarChart({ data, height = 200 }: { data: { label: string; value: number }[]; height?: number }) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <YStack height={height} gap="$2">
      <XStack flex={1} alignItems="flex-end" gap="$2">
        {data.map((item, index) => (
          <YStack key={index} flex={1} alignItems="center" gap="$1">
            <YStack
              backgroundColor="$primary"
              borderRadius="$2"
              width="100%"
              height={`${(item.value / maxValue) * 100}%`}
              minHeight={4}
            />
            <Text fontSize="$1" color="$mutedForeground" numberOfLines={1}>
              {item.label}
            </Text>
          </YStack>
        ))}
      </XStack>
    </YStack>
  );
}

// Top performers list
interface TopPerformer {
  id: string;
  name: string;
  value: number;
  change?: number;
}

function TopPerformersList({ 
  title, 
  performers, 
  valuePrefix = '',
  valueSuffix = '',
}: { 
  title: string;
  performers: TopPerformer[];
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent padding="$0">
        {performers.map((performer, index) => (
          <XStack
            key={performer.id}
            padding="$3"
            alignItems="center"
            gap="$3"
            borderBottomWidth={index < performers.length - 1 ? 1 : 0}
            borderBottomColor="$borderColor"
          >
            <YStack 
              width={24} 
              height={24} 
              borderRadius={12}
              backgroundColor={index < 3 ? '$primary' : '$muted'}
              alignItems="center"
              justifyContent="center"
            >
              <Text 
                fontSize="$1" 
                fontWeight="600" 
                color={index < 3 ? 'white' : '$mutedForeground'}
              >
                {index + 1}
              </Text>
            </YStack>
            <Text flex={1} fontSize="$3" color="$color">
              {performer.name}
            </Text>
            <YStack alignItems="flex-end">
              <Text fontSize="$3" fontWeight="600" color="$color">
                {valuePrefix}{performer.value.toLocaleString()}{valueSuffix}
              </Text>
              {performer.change !== undefined && (
                <Text 
                  fontSize="$1" 
                  color={performer.change >= 0 ? '$success' : '$error'}
                >
                  {performer.change >= 0 ? '+' : ''}{performer.change}%
                </Text>
              )}
            </YStack>
          </XStack>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ManagerAnalytics() {
  const toast = useToast();
  const [timeRange, setTimeRange] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  // Memoize date range to prevent infinite re-renders
  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    switch (timeRange) {
      case '7d':
        start.setDate(end.getDate() - 7);
        break;
      case '30d':
        start.setDate(end.getDate() - 30);
        break;
      case '90d':
        start.setDate(end.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(end.getFullYear() - 1);
        break;
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }, [timeRange]);

  // Fetch analytics data
  const { 
    data: analytics, 
    isLoading,
    refetch,
  } = trpc.manager.getAnalytics.useQuery(dateRange);

  // Fetch recent reports
  const { data: reports } = trpc.manager.getRecentReports.useQuery({ limit: 5 });

  // Generate report mutation
  const generateReport = trpc.manager.generateReport.useMutation({
    onSuccess: (data) => {
      toast.success('Report generated', 'Your report is ready for download.');
      // In a real app, this would trigger a download
    },
    onError: (error) => {
      toast.error('Failed to generate report', error.message);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleDownloadReport = () => {
    generateReport.mutate(dateRange);
  };

  // Chart data
  const revenueChartData = analytics?.revenueByDay?.map(d => ({
    label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
    value: d.revenue,
  })) || [];

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
            <YStack>
              <Text fontSize="$7" fontWeight="700" color="$color">Analytics</Text>
              <Text fontSize="$3" color="$mutedForeground">
                Track your business performance
              </Text>
            </YStack>
            <Button 
              size="sm" 
              variant="outline"
              leftIcon={<Download size={16} />}
              onPress={handleDownloadReport}
              loading={generateReport.isPending}
            >
              Export
            </Button>
          </XStack>

          {/* Time Range Selector */}
          <SelectField
            value={timeRange}
            onValueChange={setTimeRange}
            options={timeRangeOptions}
          />

          {/* Key Metrics */}
          {isLoading ? (
            <XStack gap="$3" flexWrap="wrap">
              <SkeletonStatCard />
              <SkeletonStatCard />
            </XStack>
          ) : (
            <>
              <XStack gap="$3">
                <MetricCard
                  title="Total Revenue"
                  value={analytics?.totalRevenue || 0}
                  change={analytics?.revenueChange}
                  icon={<DollarSign size={20} color="$primary" />}
                  prefix="$"
                />
                <MetricCard
                  title="Total Orders"
                  value={analytics?.totalOrders || 0}
                  change={analytics?.ordersChange}
                  icon={<ShoppingCart size={20} color="$primary" />}
                />
              </XStack>
              <XStack gap="$3">
                <MetricCard
                  title="New Clients"
                  value={analytics?.newClients || 0}
                  change={analytics?.clientsChange}
                  icon={<Users size={20} color="$primary" />}
                />
                <MetricCard
                  title="Active Bundles"
                  value={analytics?.activeBundles || 0}
                  change={analytics?.bundlesChange}
                  icon={<Package size={20} color="$primary" />}
                />
              </XStack>
            </>
          )}

          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton height={200} />
              ) : revenueChartData.length > 0 ? (
                <SimpleBarChart data={revenueChartData} />
              ) : (
                <YStack height={200} alignItems="center" justifyContent="center">
                  <Text color="$mutedForeground">No data available</Text>
                </YStack>
              )}
            </CardContent>
          </Card>

          {/* Top Trainers */}
          <TopPerformersList
            title="Top Trainers"
            performers={analytics?.topTrainers || []}
            valuePrefix="$"
          />

          {/* Top Bundles */}
          <TopPerformersList
            title="Best Selling Bundles"
            performers={analytics?.topBundles || []}
            valueSuffix=" sold"
          />

          {/* Recent Reports */}
          {reports && reports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Reports</CardTitle>
              </CardHeader>
              <CardContent padding="$0">
                {reports.map((report, index) => (
                  <XStack
                    key={report.id}
                    padding="$3"
                    alignItems="center"
                    gap="$3"
                    borderBottomWidth={index < reports.length - 1 ? 1 : 0}
                    borderBottomColor="$borderColor"
                  >
                    <YStack 
                      backgroundColor="$muted" 
                      padding="$2" 
                      borderRadius="$2"
                    >
                      <Calendar size={16} color="$mutedForeground" />
                    </YStack>
                    <YStack flex={1}>
                      <Text fontSize="$3" color="$color">{report.name}</Text>
                      <Text fontSize="$1" color="$mutedForeground">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </Text>
                    </YStack>
                    <Button variant="ghost" size="sm">
                      <Download size={16} />
                    </Button>
                  </XStack>
                ))}
              </CardContent>
            </Card>
          )}
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
