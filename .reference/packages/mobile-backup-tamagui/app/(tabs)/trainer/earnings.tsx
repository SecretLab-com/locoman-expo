import React, { useState } from 'react';
import { ScrollView, RefreshControl, FlatList, Pressable } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  CreditCard,
  Clock,
  CheckCircle,
  ChevronRight,
  Download,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';

type TimePeriod = 'week' | 'month' | 'year' | 'all';

interface Transaction {
  id: number;
  type: 'sale' | 'payout' | 'refund' | 'bonus';
  amount: number;
  status: string;
  description: string;
  bundleName?: string;
  clientName?: string;
  createdAt: string;
}

export default function TrainerEarnings() {
  const router = useRouter();
  const { user } = useAuth();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');
  
  const { data: earnings, isLoading: earningsLoading, refetch: refetchEarnings } = trpc.trainer.getEarnings.useQuery({
    period: timePeriod,
  });
  
  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = trpc.trainer.getTransactions.useQuery({
    period: timePeriod,
    limit: 20,
  });
  
  const { data: payoutInfo, isLoading: payoutLoading } = trpc.trainer.getPayoutInfo.useQuery();
  
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchEarnings(), refetchTransactions()]);
    setRefreshing(false);
  };
  
  const isLoading = earningsLoading || transactionsLoading;
  
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <TrendingUp size={16} color="$green10" />;
      case 'payout':
        return <CreditCard size={16} color="$blue10" />;
      case 'refund':
        return <TrendingDown size={16} color="$red10" />;
      case 'bonus':
        return <DollarSign size={16} color="$purple10" />;
      default:
        return <DollarSign size={16} color="$gray10" />;
    }
  };
  
  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'sale':
      case 'bonus':
        return '$green10';
      case 'payout':
        return '$blue10';
      case 'refund':
        return '$red10';
      default:
        return '$gray10';
    }
  };
  
  const formatAmount = (amount: number, type: string) => {
    const prefix = type === 'refund' || type === 'payout' ? '-' : '+';
    return `${prefix}$${Math.abs(amount).toFixed(2)}`;
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
          <Text fontSize="$7" fontWeight="700">Earnings</Text>
          <Text fontSize="$4" color="$gray10">Track your income and payouts</Text>
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
        
        {/* Earnings Summary */}
        {earningsLoading ? (
          <XStack gap="$3">
            <Skeleton flex={1} height={100} borderRadius="$4" />
            <Skeleton flex={1} height={100} borderRadius="$4" />
          </XStack>
        ) : (
          <>
            <XStack gap="$3">
              <Card flex={1}>
                <CardContent>
                  <YStack gap="$1">
                    <Text fontSize="$2" color="$gray10">Total Earnings</Text>
                    <Text fontSize="$7" fontWeight="700" color="$green10">
                      ${(earnings?.totalEarnings || 0).toLocaleString()}
                    </Text>
                    {earnings?.earningsChange !== undefined && (
                      <XStack alignItems="center" gap="$1">
                        {earnings.earningsChange >= 0 ? (
                          <TrendingUp size={12} color="$green10" />
                        ) : (
                          <TrendingDown size={12} color="$red10" />
                        )}
                        <Text 
                          fontSize="$2" 
                          color={earnings.earningsChange >= 0 ? '$green10' : '$red10'}
                        >
                          {earnings.earningsChange >= 0 ? '+' : ''}{earnings.earningsChange}%
                        </Text>
                      </XStack>
                    )}
                  </YStack>
                </CardContent>
              </Card>
              
              <Card flex={1}>
                <CardContent>
                  <YStack gap="$1">
                    <Text fontSize="$2" color="$gray10">Total Sales</Text>
                    <Text fontSize="$7" fontWeight="700" color="$color">
                      {earnings?.totalSales || 0}
                    </Text>
                    <Text fontSize="$2" color="$gray10">
                      {earnings?.newSales || 0} new
                    </Text>
                  </YStack>
                </CardContent>
              </Card>
            </XStack>
            
            <XStack gap="$3">
              <Card flex={1}>
                <CardContent>
                  <YStack gap="$1">
                    <Text fontSize="$2" color="$gray10">Pending</Text>
                    <Text fontSize="$5" fontWeight="600" color="$yellow10">
                      ${(earnings?.pendingAmount || 0).toFixed(2)}
                    </Text>
                  </YStack>
                </CardContent>
              </Card>
              
              <Card flex={1}>
                <CardContent>
                  <YStack gap="$1">
                    <Text fontSize="$2" color="$gray10">Available</Text>
                    <Text fontSize="$5" fontWeight="600" color="$blue10">
                      ${(earnings?.availableAmount || 0).toFixed(2)}
                    </Text>
                  </YStack>
                </CardContent>
              </Card>
            </XStack>
          </>
        )}
        
        {/* Payout Info */}
        <Card>
          <CardHeader>
            <XStack justifyContent="space-between" alignItems="center">
              <CardTitle>Payout Settings</CardTitle>
              <Button 
                size="sm" 
                variant="outline"
                onPress={() => router.push('/trainer/payout-settings')}
              >
                Edit
              </Button>
            </XStack>
          </CardHeader>
          <CardContent>
            {payoutLoading ? (
              <Skeleton height={60} borderRadius="$3" />
            ) : payoutInfo?.payoutMethod ? (
              <XStack alignItems="center" gap="$3">
                <YStack 
                  backgroundColor="$gray3" 
                  padding="$3" 
                  borderRadius="$3"
                >
                  <CreditCard size={24} color="$blue10" />
                </YStack>
                <YStack flex={1}>
                  <Text fontWeight="500">{payoutInfo.payoutMethod}</Text>
                  <Text fontSize="$2" color="$gray10">
                    {payoutInfo.payoutDetails || 'Ending in ****'}
                  </Text>
                </YStack>
                <Badge variant={payoutInfo.verified ? 'success' : 'warning'}>
                  {payoutInfo.verified ? 'Verified' : 'Pending'}
                </Badge>
              </XStack>
            ) : (
              <YStack alignItems="center" padding="$4" gap="$2">
                <CreditCard size={32} color="$gray8" />
                <Text color="$gray10">No payout method set up</Text>
                <Button 
                  size="sm"
                  onPress={() => router.push('/trainer/payout-settings')}
                >
                  Add Payout Method
                </Button>
              </YStack>
            )}
          </CardContent>
        </Card>
        
        {/* Transaction History */}
        <Card>
          <CardHeader>
            <XStack justifyContent="space-between" alignItems="center">
              <CardTitle>Transaction History</CardTitle>
              <Button 
                size="sm" 
                variant="ghost"
                icon={<Download size={16} />}
              >
                Export
              </Button>
            </XStack>
          </CardHeader>
          <CardContent padding="$0">
            {transactionsLoading ? (
              <YStack padding="$3" gap="$3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={60} borderRadius="$3" />
                ))}
              </YStack>
            ) : !transactions?.items?.length ? (
              <EmptyState
                icon={<DollarSign size={32} color="$gray8" />}
                title="No transactions yet"
                description="Your transaction history will appear here"
              />
            ) : (
              <YStack>
                {transactions.items.map((transaction: Transaction, index: number) => (
                  <XStack
                    key={transaction.id}
                    padding="$3"
                    alignItems="center"
                    gap="$3"
                    borderBottomWidth={index < transactions.items.length - 1 ? 1 : 0}
                    borderBottomColor="$gray4"
                  >
                    <YStack 
                      backgroundColor="$gray3" 
                      padding="$2" 
                      borderRadius="$2"
                    >
                      {getTransactionIcon(transaction.type)}
                    </YStack>
                    <YStack flex={1}>
                      <Text fontWeight="500">{transaction.description}</Text>
                      <Text fontSize="$2" color="$gray10">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </Text>
                    </YStack>
                    <YStack alignItems="flex-end">
                      <Text 
                        fontWeight="600" 
                        color={getTransactionColor(transaction.type)}
                      >
                        {formatAmount(transaction.amount, transaction.type)}
                      </Text>
                      <Badge 
                        size="sm"
                        variant={transaction.status === 'completed' ? 'success' : 'secondary'}
                      >
                        {transaction.status}
                      </Badge>
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            )}
          </CardContent>
        </Card>
      </YStack>
    </ScrollView>
  );
}
