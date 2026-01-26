import React, { useState } from 'react';
import { ScrollView, RefreshControl, Pressable, Dimensions } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Package,
  ChevronRight,
  PieChart,
  BarChart3,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useAuth } from '@/contexts/AuthContext';

type TimePeriod = 'week' | 'month' | 'year' | 'all';

interface SpendingCategory {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

interface SpendingHistory {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  orderId?: number;
}

export default function ClientSpending() {
  const router = useRouter();
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  
  const { data: spendingData, isLoading, refetch } = trpc.client.getSpendingAnalytics.useQuery({
    period: timePeriod,
  });
  
  const { data: recentTransactions } = trpc.client.getRecentTransactions.useQuery({ limit: 5 });
  
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };
  
  const categoryColors: Record<string, string> = {
    'Personal Training': '$blue10',
    'Group Classes': '$green10',
    'Nutrition': '$orange10',
    'Equipment': '$purple10',
    'Other': '$gray10',
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };
  
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <YStack padding="$4" gap="$4">
        {/* Header */}
        <YStack gap="$1">
          <Text fontSize="$7" fontWeight="700">Spending</Text>
          <Text fontSize="$4" color="$gray10">Track your fitness investments</Text>
        </YStack>
        
        {/* Time Period Tabs */}
        <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="year">Year</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Total Spending Card */}
        {isLoading ? (
          <Skeleton height={150} borderRadius="$4" />
        ) : (
          <Card backgroundColor="$green10">
            <CardContent>
              <YStack gap="$2">
                <Text fontSize="$3" color="$green4">Total Spent</Text>
                <Text fontSize="$9" fontWeight="700" color="white">
                  {formatCurrency(spendingData?.totalSpent || 0)}
                </Text>
                
                {spendingData?.percentageChange !== undefined && (
                  <XStack alignItems="center" gap="$2">
                    {spendingData.percentageChange >= 0 ? (
                      <TrendingUp size={16} color="$green4" />
                    ) : (
                      <TrendingDown size={16} color="$green4" />
                    )}
                    <Text fontSize="$3" color="$green4">
                      {spendingData.percentageChange >= 0 ? '+' : ''}
                      {spendingData.percentageChange.toFixed(1)}% vs previous period
                    </Text>
                  </XStack>
                )}
              </YStack>
            </CardContent>
          </Card>
        )}
        
        {/* Stats Row */}
        {isLoading ? (
          <XStack gap="$3">
            <Skeleton flex={1} height={100} borderRadius="$4" />
            <Skeleton flex={1} height={100} borderRadius="$4" />
          </XStack>
        ) : (
          <XStack gap="$3">
            <Card flex={1}>
              <CardContent>
                <YStack alignItems="center" gap="$1">
                  <Package size={24} color="$blue10" />
                  <Text fontSize="$6" fontWeight="700">{spendingData?.totalOrders || 0}</Text>
                  <Text fontSize="$2" color="$gray10">Orders</Text>
                </YStack>
              </CardContent>
            </Card>
            <Card flex={1}>
              <CardContent>
                <YStack alignItems="center" gap="$1">
                  <DollarSign size={24} color="$green10" />
                  <Text fontSize="$6" fontWeight="700">
                    {formatCurrency(spendingData?.averageOrder || 0)}
                  </Text>
                  <Text fontSize="$2" color="$gray10">Avg Order</Text>
                </YStack>
              </CardContent>
            </Card>
          </XStack>
        )}
        
        {/* Budget Progress (if set) */}
        {spendingData?.budget && (
          <Card>
            <CardHeader>
              <XStack justifyContent="space-between" alignItems="center">
                <CardTitle>Monthly Budget</CardTitle>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onPress={() => router.push('/client/settings/budget')}
                >
                  Edit
                </Button>
              </XStack>
            </CardHeader>
            <CardContent>
              <YStack gap="$3">
                <XStack justifyContent="space-between">
                  <Text fontSize="$3" color="$gray10">
                    {formatCurrency(spendingData.totalSpent)} of {formatCurrency(spendingData.budget)}
                  </Text>
                  <Text fontSize="$3" fontWeight="500">
                    {((spendingData.totalSpent / spendingData.budget) * 100).toFixed(0)}%
                  </Text>
                </XStack>
                <Progress 
                  value={(spendingData.totalSpent / spendingData.budget) * 100} 
                  indicatorColor={
                    spendingData.totalSpent > spendingData.budget ? '$red10' : '$green10'
                  }
                />
                <Text fontSize="$2" color="$gray10">
                  {formatCurrency(Math.max(0, spendingData.budget - spendingData.totalSpent))} remaining
                </Text>
              </YStack>
            </CardContent>
          </Card>
        )}
        
        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <XStack justifyContent="space-between" alignItems="center">
              <CardTitle>By Category</CardTitle>
              <PieChart size={20} color="$gray10" />
            </XStack>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <YStack gap="$3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={40} borderRadius="$3" />
                ))}
              </YStack>
            ) : !spendingData?.categories?.length ? (
              <YStack alignItems="center" padding="$4">
                <PieChart size={32} color="$gray8" />
                <Text color="$gray10" marginTop="$2">No spending data</Text>
              </YStack>
            ) : (
              <YStack gap="$3">
                {spendingData.categories.map((category: SpendingCategory) => (
                  <YStack key={category.name} gap="$2">
                    <XStack justifyContent="space-between" alignItems="center">
                      <XStack alignItems="center" gap="$2">
                        <YStack 
                          width={12} 
                          height={12} 
                          borderRadius="$1"
                          backgroundColor={categoryColors[category.name] || '$gray10'}
                        />
                        <Text fontSize="$3">{category.name}</Text>
                      </XStack>
                      <Text fontSize="$3" fontWeight="500">
                        {formatCurrency(category.amount)}
                      </Text>
                    </XStack>
                    <Progress 
                      value={category.percentage} 
                      indicatorColor={categoryColors[category.name] || '$gray10'}
                    />
                  </YStack>
                ))}
              </YStack>
            )}
          </CardContent>
        </Card>
        
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <XStack justifyContent="space-between" alignItems="center">
              <CardTitle>Recent Transactions</CardTitle>
              <Pressable onPress={() => router.push('/client/transactions')}>
                <XStack alignItems="center" gap="$1">
                  <Text fontSize="$3" color="$blue10">View All</Text>
                  <ChevronRight size={16} color="$blue10" />
                </XStack>
              </Pressable>
            </XStack>
          </CardHeader>
          <CardContent padding="$0">
            {!recentTransactions?.length ? (
              <YStack alignItems="center" padding="$4">
                <DollarSign size={32} color="$gray8" />
                <Text color="$gray10" marginTop="$2">No transactions yet</Text>
              </YStack>
            ) : (
              <YStack>
                {recentTransactions.map((transaction: SpendingHistory, index: number) => (
                  <Pressable 
                    key={transaction.id}
                    onPress={() => transaction.orderId && router.push(`/client/orders/${transaction.orderId}`)}
                  >
                    <XStack
                      padding="$3"
                      alignItems="center"
                      gap="$3"
                      borderBottomWidth={index < recentTransactions.length - 1 ? 1 : 0}
                      borderBottomColor="$gray4"
                    >
                      <YStack 
                        backgroundColor="$gray3" 
                        padding="$2" 
                        borderRadius="$2"
                      >
                        <DollarSign size={16} color="$gray10" />
                      </YStack>
                      <YStack flex={1}>
                        <Text fontWeight="500" numberOfLines={1}>{transaction.description}</Text>
                        <XStack alignItems="center" gap="$2">
                          <Text fontSize="$2" color="$gray10">
                            {new Date(transaction.date).toLocaleDateString()}
                          </Text>
                          <Badge size="sm" variant="secondary">{transaction.category}</Badge>
                        </XStack>
                      </YStack>
                      <Text fontWeight="600" color="$red10">
                        -{formatCurrency(transaction.amount)}
                      </Text>
                    </XStack>
                  </Pressable>
                ))}
              </YStack>
            )}
          </CardContent>
        </Card>
        
        {/* Tips Card */}
        <Card backgroundColor="$blue2">
          <CardContent>
            <YStack gap="$2">
              <Text fontSize="$4" fontWeight="600" color="$blue10">💡 Savings Tip</Text>
              <Text fontSize="$3" color="$blue11">
                Consider purchasing bundle packages for better value. 
                Multi-session bundles often save you 15-20% compared to individual sessions.
              </Text>
            </YStack>
          </CardContent>
        </Card>
      </YStack>
    </ScrollView>
  );
}
