import React, { useState } from 'react';
import { ScrollView, RefreshControl, FlatList, Pressable } from 'react-native';
import { YStack, XStack, Text } from 'tamagui';
import { 
  Star, 
  Gift, 
  Trophy,
  Target,
  TrendingUp,
  Clock,
  CheckCircle,
  ChevronRight,
  Zap,
} from '@tamagui/lucide-icons';
import { useRouter } from 'expo-router';
import { trpc } from '@/lib/trpc';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Progress } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';

interface Reward {
  id: number;
  name: string;
  description: string;
  pointsCost: number;
  imageUrl?: string;
  category: string;
  available: boolean;
}

interface PointHistory {
  id: number;
  type: 'earned' | 'redeemed';
  amount: number;
  description: string;
  createdAt: string;
}

interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  completed: boolean;
  completedAt?: string;
}

export default function TrainerPoints() {
  const router = useRouter();
  const { user } = useAuth();
  
  const { data: pointsData, isLoading: pointsLoading, refetch: refetchPoints } = trpc.trainer.getPoints.useQuery();
  const { data: rewards, isLoading: rewardsLoading, refetch: refetchRewards } = trpc.trainer.getAvailableRewards.useQuery();
  const { data: history, isLoading: historyLoading, refetch: refetchHistory } = trpc.trainer.getPointsHistory.useQuery({ limit: 10 });
  const { data: achievements, isLoading: achievementsLoading, refetch: refetchAchievements } = trpc.trainer.getAchievements.useQuery();
  
  const [refreshing, setRefreshing] = useState(false);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchPoints(), refetchRewards(), refetchHistory(), refetchAchievements()]);
    setRefreshing(false);
  };
  
  const isLoading = pointsLoading || rewardsLoading;
  
  const getAchievementIcon = (icon: string) => {
    switch (icon) {
      case 'trophy':
        return <Trophy size={24} color="$yellow10" />;
      case 'star':
        return <Star size={24} color="$yellow10" />;
      case 'target':
        return <Target size={24} color="$blue10" />;
      case 'zap':
        return <Zap size={24} color="$purple10" />;
      default:
        return <Gift size={24} color="$green10" />;
    }
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
          <Text fontSize="$7" fontWeight="700">Points & Rewards</Text>
          <Text fontSize="$4" color="$gray10">Earn points and redeem rewards</Text>
        </YStack>
        
        {/* Points Summary */}
        {pointsLoading ? (
          <Skeleton height={120} borderRadius="$4" />
        ) : (
          <Card backgroundColor="$purple10">
            <CardContent>
              <XStack justifyContent="space-between" alignItems="center">
                <YStack>
                  <Text fontSize="$2" color="$purple4">Available Points</Text>
                  <Text fontSize="$9" fontWeight="700" color="white">
                    {(pointsData?.availablePoints || 0).toLocaleString()}
                  </Text>
                  <Text fontSize="$3" color="$purple4">
                    Lifetime: {(pointsData?.lifetimePoints || 0).toLocaleString()} pts
                  </Text>
                </YStack>
                <YStack 
                  backgroundColor="$purple8" 
                  padding="$4" 
                  borderRadius="$4"
                >
                  <Star size={40} color="white" fill="white" />
                </YStack>
              </XStack>
            </CardContent>
          </Card>
        )}
        
        {/* How to Earn */}
        <Card>
          <CardHeader>
            <CardTitle>How to Earn Points</CardTitle>
          </CardHeader>
          <CardContent>
            <YStack gap="$3">
              <XStack alignItems="center" gap="$3">
                <YStack backgroundColor="$green3" padding="$2" borderRadius="$2">
                  <CheckCircle size={20} color="$green10" />
                </YStack>
                <YStack flex={1}>
                  <Text fontWeight="500">Complete a delivery</Text>
                  <Text fontSize="$2" color="$gray10">+100 points</Text>
                </YStack>
              </XStack>
              <XStack alignItems="center" gap="$3">
                <YStack backgroundColor="$blue3" padding="$2" borderRadius="$2">
                  <Star size={20} color="$blue10" />
                </YStack>
                <YStack flex={1}>
                  <Text fontWeight="500">Get a 5-star review</Text>
                  <Text fontSize="$2" color="$gray10">+50 points</Text>
                </YStack>
              </XStack>
              <XStack alignItems="center" gap="$3">
                <YStack backgroundColor="$purple3" padding="$2" borderRadius="$2">
                  <Gift size={20} color="$purple10" />
                </YStack>
                <YStack flex={1}>
                  <Text fontWeight="500">Refer a new trainer</Text>
                  <Text fontSize="$2" color="$gray10">+500 points</Text>
                </YStack>
              </XStack>
            </YStack>
          </CardContent>
        </Card>
        
        {/* Achievements */}
        <Card>
          <CardHeader>
            <XStack justifyContent="space-between" alignItems="center">
              <CardTitle>Achievements</CardTitle>
              <Pressable onPress={() => router.push('/trainer/achievements')}>
                <XStack alignItems="center" gap="$1">
                  <Text fontSize="$3" color="$blue10">View All</Text>
                  <ChevronRight size={16} color="$blue10" />
                </XStack>
              </Pressable>
            </XStack>
          </CardHeader>
          <CardContent>
            {achievementsLoading ? (
              <YStack gap="$3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={60} borderRadius="$3" />
                ))}
              </YStack>
            ) : !achievements?.length ? (
              <YStack alignItems="center" padding="$4">
                <Trophy size={32} color="$gray8" />
                <Text color="$gray10" marginTop="$2">No achievements yet</Text>
              </YStack>
            ) : (
              <YStack gap="$3">
                {achievements.slice(0, 3).map((achievement: Achievement) => (
                  <XStack 
                    key={achievement.id} 
                    alignItems="center" 
                    gap="$3"
                    padding="$3"
                    backgroundColor={achievement.completed ? '$green2' : '$gray2'}
                    borderRadius="$3"
                  >
                    <YStack 
                      backgroundColor={achievement.completed ? '$green3' : '$gray3'} 
                      padding="$2" 
                      borderRadius="$2"
                    >
                      {getAchievementIcon(achievement.icon)}
                    </YStack>
                    <YStack flex={1}>
                      <XStack alignItems="center" gap="$2">
                        <Text fontWeight="500">{achievement.name}</Text>
                        {achievement.completed && (
                          <CheckCircle size={14} color="$green10" />
                        )}
                      </XStack>
                      <Text fontSize="$2" color="$gray10">{achievement.description}</Text>
                      {!achievement.completed && (
                        <YStack marginTop="$2">
                          <Progress value={(achievement.progress / achievement.target) * 100} />
                          <Text fontSize="$1" color="$gray10" marginTop="$1">
                            {achievement.progress}/{achievement.target}
                          </Text>
                        </YStack>
                      )}
                    </YStack>
                  </XStack>
                ))}
              </YStack>
            )}
          </CardContent>
        </Card>
        
        {/* Available Rewards */}
        <Card>
          <CardHeader>
            <XStack justifyContent="space-between" alignItems="center">
              <CardTitle>Available Rewards</CardTitle>
              <Pressable onPress={() => router.push('/trainer/rewards')}>
                <XStack alignItems="center" gap="$1">
                  <Text fontSize="$3" color="$blue10">View All</Text>
                  <ChevronRight size={16} color="$blue10" />
                </XStack>
              </Pressable>
            </XStack>
          </CardHeader>
          <CardContent>
            {rewardsLoading ? (
              <YStack gap="$3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} height={80} borderRadius="$3" />
                ))}
              </YStack>
            ) : !rewards?.length ? (
              <YStack alignItems="center" padding="$4">
                <Gift size={32} color="$gray8" />
                <Text color="$gray10" marginTop="$2">No rewards available</Text>
              </YStack>
            ) : (
              <YStack gap="$3">
                {rewards.slice(0, 3).map((reward: Reward) => (
                  <Pressable 
                    key={reward.id} 
                    onPress={() => router.push(`/trainer/rewards/${reward.id}`)}
                  >
                    <XStack 
                      alignItems="center" 
                      gap="$3"
                      padding="$3"
                      backgroundColor="$gray2"
                      borderRadius="$3"
                    >
                      <YStack 
                        backgroundColor="$purple3" 
                        padding="$3" 
                        borderRadius="$3"
                      >
                        <Gift size={24} color="$purple10" />
                      </YStack>
                      <YStack flex={1}>
                        <Text fontWeight="500">{reward.name}</Text>
                        <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                          {reward.description}
                        </Text>
                      </YStack>
                      <YStack alignItems="flex-end">
                        <Text fontWeight="600" color="$purple10">
                          {reward.pointsCost.toLocaleString()}
                        </Text>
                        <Text fontSize="$1" color="$gray10">points</Text>
                      </YStack>
                    </XStack>
                  </Pressable>
                ))}
              </YStack>
            )}
          </CardContent>
        </Card>
        
        {/* Points History */}
        <Card>
          <CardHeader>
            <XStack justifyContent="space-between" alignItems="center">
              <CardTitle>Recent Activity</CardTitle>
              <Pressable onPress={() => router.push('/trainer/points-history')}>
                <XStack alignItems="center" gap="$1">
                  <Text fontSize="$3" color="$blue10">View All</Text>
                  <ChevronRight size={16} color="$blue10" />
                </XStack>
              </Pressable>
            </XStack>
          </CardHeader>
          <CardContent padding="$0">
            {historyLoading ? (
              <YStack padding="$3" gap="$3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={50} borderRadius="$3" />
                ))}
              </YStack>
            ) : !history?.items?.length ? (
              <YStack alignItems="center" padding="$4">
                <Clock size={32} color="$gray8" />
                <Text color="$gray10" marginTop="$2">No activity yet</Text>
              </YStack>
            ) : (
              <YStack>
                {history.items.map((item: PointHistory, index: number) => (
                  <XStack
                    key={item.id}
                    padding="$3"
                    alignItems="center"
                    gap="$3"
                    borderBottomWidth={index < history.items.length - 1 ? 1 : 0}
                    borderBottomColor="$gray4"
                  >
                    <YStack 
                      backgroundColor={item.type === 'earned' ? '$green3' : '$purple3'} 
                      padding="$2" 
                      borderRadius="$2"
                    >
                      {item.type === 'earned' ? (
                        <TrendingUp size={16} color="$green10" />
                      ) : (
                        <Gift size={16} color="$purple10" />
                      )}
                    </YStack>
                    <YStack flex={1}>
                      <Text fontWeight="500">{item.description}</Text>
                      <Text fontSize="$2" color="$gray10">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </Text>
                    </YStack>
                    <Text 
                      fontWeight="600" 
                      color={item.type === 'earned' ? '$green10' : '$purple10'}
                    >
                      {item.type === 'earned' ? '+' : '-'}{item.amount}
                    </Text>
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
