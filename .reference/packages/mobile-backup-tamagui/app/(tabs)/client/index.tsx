import { useState } from 'react';
import { YStack, XStack, Text, ScrollView, Image } from 'tamagui';
import { RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Package, 
  ShoppingCart,
  Heart,
  ChevronRight,
  Star,
  Clock,
  TrendingUp,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/Avatar';
import { SkeletonStatCard, SkeletonListItem, Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

// Featured bundle card
interface Bundle {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  trainerName: string;
  trainerAvatar?: string;
  rating: number;
  reviewCount: number;
}

function BundleCard({ bundle, onPress }: { bundle: Bundle; onPress: () => void }) {
  const discount = bundle.originalPrice 
    ? Math.round((1 - bundle.price / bundle.originalPrice) * 100) 
    : 0;

  return (
    <Card 
      width={cardWidth} 
      pressable 
      onPress={onPress}
      overflow="hidden"
    >
      {/* Image */}
      <YStack 
        height={120} 
        backgroundColor="$muted"
        position="relative"
      >
        {bundle.imageUrl ? (
          <Image
            source={{ uri: bundle.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : (
          <YStack flex={1} alignItems="center" justifyContent="center">
            <Package size={32} color="$mutedForeground" />
          </YStack>
        )}
        {discount > 0 && (
          <Badge 
            variant="error" 
            position="absolute" 
            top={8} 
            right={8}
          >
            -{discount}%
          </Badge>
        )}
      </YStack>

      <CardContent gap="$2">
        <Text fontSize="$3" fontWeight="600" color="$color" numberOfLines={2}>
          {bundle.name}
        </Text>
        
        <XStack alignItems="center" gap="$1">
          <UserAvatar src={bundle.trainerAvatar} name={bundle.trainerName} size="xs" />
          <Text fontSize="$1" color="$mutedForeground" numberOfLines={1}>
            {bundle.trainerName}
          </Text>
        </XStack>

        <XStack alignItems="center" gap="$1">
          <Star size={12} color="$warning" fill="$warning" />
          <Text fontSize="$1" color="$color">{bundle.rating.toFixed(1)}</Text>
          <Text fontSize="$1" color="$mutedForeground">({bundle.reviewCount})</Text>
        </XStack>

        <XStack alignItems="baseline" gap="$1">
          <Text fontSize="$4" fontWeight="700" color="$primary">
            ${bundle.price}
          </Text>
          {bundle.originalPrice && (
            <Text fontSize="$2" color="$mutedForeground" textDecorationLine="line-through">
              ${bundle.originalPrice}
            </Text>
          )}
        </XStack>
      </CardContent>
    </Card>
  );
}

// Active subscription card
interface Subscription {
  id: string;
  bundleName: string;
  trainerName: string;
  trainerAvatar?: string;
  nextDelivery?: string;
  status: string;
  progress?: number;
}

function SubscriptionCard({ subscription, onPress }: { subscription: Subscription; onPress: () => void }) {
  return (
    <Card pressable onPress={onPress}>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <UserAvatar src={subscription.trainerAvatar} name={subscription.trainerName} size="lg" />
          <YStack flex={1} gap="$1">
            <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={1}>
              {subscription.bundleName}
            </Text>
            <Text fontSize="$2" color="$mutedForeground">
              with {subscription.trainerName}
            </Text>
            {subscription.nextDelivery && (
              <XStack alignItems="center" gap="$1" marginTop="$1">
                <Clock size={12} color="$mutedForeground" />
                <Text fontSize="$1" color="$mutedForeground">
                  Next delivery: {subscription.nextDelivery}
                </Text>
              </XStack>
            )}
          </YStack>
          <ChevronRight size={20} color="$mutedForeground" />
        </XStack>
        {subscription.progress !== undefined && (
          <YStack marginTop="$3">
            <XStack justifyContent="space-between" marginBottom="$1">
              <Text fontSize="$1" color="$mutedForeground">Progress</Text>
              <Text fontSize="$1" color="$primary">{subscription.progress}%</Text>
            </XStack>
            <YStack 
              height={4} 
              backgroundColor="$muted" 
              borderRadius="$1"
              overflow="hidden"
            >
              <YStack 
                height="100%" 
                width={`${subscription.progress}%`}
                backgroundColor="$primary"
              />
            </YStack>
          </YStack>
        )}
      </CardContent>
    </Card>
  );
}

// Category pill
function CategoryPill({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Button
      variant={selected ? 'default' : 'outline'}
      size="sm"
      onPress={onPress}
      borderRadius="$6"
    >
      {label}
    </Button>
  );
}

export default function ClientHome() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Fetch featured bundles
  const { 
    data: featuredBundles, 
    isLoading: bundlesLoading,
    refetch: refetchBundles,
  } = trpc.shop.getFeaturedBundles.useQuery({ limit: 6 });

  // Fetch active subscriptions (only if authenticated)
  const { 
    data: subscriptions, 
    isLoading: subscriptionsLoading,
    refetch: refetchSubscriptions,
  } = trpc.client.getActiveSubscriptions.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Fetch categories
  const { data: categories } = trpc.shop.getCategories.useQuery();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchBundles(),
      isAuthenticated ? refetchSubscriptions() : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const handleBundlePress = (bundleId: string) => {
    router.push(`/shop/bundles/${bundleId}`);
  };

  const handleSubscriptionPress = (subscriptionId: string) => {
    router.push(`/client/subscriptions/${subscriptionId}`);
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        flex={1}
        backgroundColor="$background"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <YStack padding="$4" gap="$5">
          {/* Header */}
          <YStack gap="$1">
            {isAuthenticated ? (
              <>
                <Text fontSize="$2" color="$mutedForeground">Welcome back,</Text>
                <Text fontSize="$7" fontWeight="700" color="$color">
                  {user?.name || 'Friend'}
                </Text>
              </>
            ) : (
              <>
                <Text fontSize="$7" fontWeight="700" color="$color">
                  LocoMotivate
                </Text>
                <Text fontSize="$3" color="$mutedForeground">
                  Discover trainer-curated wellness bundles
                </Text>
              </>
            )}
          </YStack>

          {/* Active Subscriptions (if authenticated) */}
          {isAuthenticated && (
            <YStack gap="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$4" fontWeight="600" color="$color">Your Bundles</Text>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onPress={() => router.push('/client/subscriptions')}
                >
                  View All
                </Button>
              </XStack>
              {subscriptionsLoading ? (
                <SkeletonListItem />
              ) : subscriptions?.length ? (
                subscriptions.slice(0, 2).map((sub) => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    onPress={() => handleSubscriptionPress(sub.id)}
                  />
                ))
              ) : (
                <Card>
                  <CardContent>
                    <YStack alignItems="center" gap="$2" padding="$2">
                      <Package size={32} color="$mutedForeground" />
                      <Text color="$mutedForeground" textAlign="center">
                        You haven't subscribed to any bundles yet
                      </Text>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onPress={() => router.push('/shop')}
                      >
                        Browse Bundles
                      </Button>
                    </YStack>
                  </CardContent>
                </Card>
              )}
            </YStack>
          )}

          {/* Categories */}
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="600" color="$color">Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$2">
                <CategoryPill 
                  label="All" 
                  selected={selectedCategory === 'all'}
                  onPress={() => setSelectedCategory('all')}
                />
                {categories?.map((cat) => (
                  <CategoryPill
                    key={cat.id}
                    label={cat.name}
                    selected={selectedCategory === cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                  />
                ))}
              </XStack>
            </ScrollView>
          </YStack>

          {/* Featured Bundles */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$4" fontWeight="600" color="$color">Featured Bundles</Text>
              <Button 
                variant="ghost" 
                size="sm" 
                onPress={() => router.push('/shop')}
              >
                See All
              </Button>
            </XStack>
            {bundlesLoading ? (
              <XStack gap="$3" flexWrap="wrap">
                <Skeleton width={cardWidth} height={220} />
                <Skeleton width={cardWidth} height={220} />
              </XStack>
            ) : (
              <XStack gap="$3" flexWrap="wrap">
                {featuredBundles?.map((bundle) => (
                  <BundleCard
                    key={bundle.id}
                    bundle={bundle}
                    onPress={() => handleBundlePress(bundle.id)}
                  />
                ))}
              </XStack>
            )}
          </YStack>

          {/* Quick Actions */}
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="600" color="$color">Quick Actions</Text>
            <XStack gap="$2" flexWrap="wrap">
              <Button 
                variant="outline" 
                size="sm"
                leftIcon={<ShoppingCart size={16} />}
                onPress={() => router.push('/cart')}
              >
                Cart
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                leftIcon={<Heart size={16} />}
                onPress={() => router.push('/wishlist')}
              >
                Wishlist
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                leftIcon={<TrendingUp size={16} />}
                onPress={() => router.push('/client/progress')}
              >
                My Progress
              </Button>
            </XStack>
          </YStack>

          {/* Login prompt for unauthenticated users */}
          {!isAuthenticated && (
            <Card variant="elevated">
              <CardContent>
                <YStack alignItems="center" gap="$3" padding="$2">
                  <Text fontSize="$4" fontWeight="600" color="$color" textAlign="center">
                    Get Personalized Recommendations
                  </Text>
                  <Text fontSize="$2" color="$mutedForeground" textAlign="center">
                    Sign in to save your favorites and get bundles tailored to your goals
                  </Text>
                  <Button onPress={() => router.push('/login')}>
                    Sign In
                  </Button>
                </YStack>
              </CardContent>
            </Card>
          )}
        </YStack>
      </ScrollView>
    </SafeAreaView>
  );
}
