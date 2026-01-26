import { useState } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl, Image, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Package, 
  Heart,
  Share2,
  ShoppingCart,
  ChevronLeft,
} from '@tamagui/lucide-icons';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

const { width } = Dimensions.get('window');

// Product item in bundle
interface Product {
  id: number;
  name: string;
  quantity: number;
}

function ProductItem({ product }: { product: Product }) {
  return (
    <XStack gap="$3" padding="$3" alignItems="center">
      <YStack 
        width={50}
        height={50}
        backgroundColor="$muted"
        borderRadius="$2"
        alignItems="center"
        justifyContent="center"
      >
        <Package size={24} color="$mutedForeground" />
      </YStack>
      <YStack flex={1} gap="$0.5">
        <Text fontSize="$3" fontWeight="500" color="$color">{product.name}</Text>
      </YStack>
      <YStack alignItems="flex-end">
        <Text fontSize="$2" color="$mutedForeground">Qty: {product.quantity}</Text>
      </YStack>
    </XStack>
  );
}

export default function BundleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const bundleId = parseInt(id || '0', 10);

  // Fetch bundle details using the correct API
  const { 
    data: bundle, 
    isLoading,
    refetch,
  } = trpc.bundles.getPublished.useQuery(
    { id: bundleId }, 
    { enabled: bundleId > 0 }
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    // TODO: Implement cart functionality
    toast.success('Added to cart', `${bundle?.title} has been added to your cart.`);
  };

  const handleToggleFavorite = () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    setIsFavorite(!isFavorite);
    toast.success(
      !isFavorite ? 'Added to wishlist' : 'Removed from wishlist'
    );
  };

  const handleShare = () => {
    toast.info('Share', 'Share functionality coming soon');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background" padding="$4" gap="$4">
          <Skeleton height={250} borderRadius="$4" />
          <Skeleton height={24} width="60%" />
          <Skeleton height={16} width="40%" />
          <Skeleton height={100} />
        </YStack>
      </SafeAreaView>
    );
  }

  if (!bundle) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background" padding="$4" alignItems="center" justifyContent="center">
          <Package size={48} color="$mutedForeground" />
          <Text fontSize="$4" color="$mutedForeground" marginTop="$2">Bundle not found</Text>
          <Button variant="outline" marginTop="$4" onPress={() => router.back()}>
            Go Back
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  const productCount = bundle.products?.length || 0;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <XStack 
          padding="$4" 
          alignItems="center" 
          justifyContent="space-between"
          position="absolute"
          top={0}
          left={0}
          right={0}
          zIndex={10}
        >
          <Button 
            variant="secondary" 
            size="icon" 
            borderRadius="$6"
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} />
          </Button>
          <XStack gap="$2">
            <Button 
              variant="secondary" 
              size="icon" 
              borderRadius="$6"
              onPress={handleToggleFavorite}
            >
              <Heart 
                size={20} 
                color={isFavorite ? '$error' : '$color'} 
                fill={isFavorite ? '$error' : 'transparent'}
              />
            </Button>
            <Button 
              variant="secondary" 
              size="icon" 
              borderRadius="$6"
              onPress={handleShare}
            >
              <Share2 size={20} />
            </Button>
          </XStack>
        </XStack>

        <ScrollView
          flex={1}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Image */}
          <YStack 
            height={300} 
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
                <Package size={64} color="$mutedForeground" />
              </YStack>
            )}
          </YStack>

          <YStack padding="$4" gap="$4">
            {/* Title and Price */}
            <YStack gap="$2">
              <Text fontSize="$6" fontWeight="700" color="$color">
                {bundle.title}
              </Text>
              <XStack alignItems="baseline" gap="$2">
                <Text fontSize="$7" fontWeight="700" color="$primary">
                  ${bundle.price}
                </Text>
              </XStack>
            </YStack>

            {/* Product Count */}
            <XStack alignItems="center" gap="$3">
              <Text fontSize="$3" color="$mutedForeground">
                {productCount} products included
              </Text>
            </XStack>

            <Separator />

            {/* Description */}
            {bundle.description && (
              <YStack gap="$2">
                <Text fontSize="$4" fontWeight="600" color="$color">
                  About this Bundle
                </Text>
                <Text fontSize="$3" color="$mutedForeground" lineHeight={22}>
                  {bundle.description}
                </Text>
              </YStack>
            )}

            {/* Products */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <XStack alignItems="center" gap="$2">
                    <Package size={20} />
                    <Text>What's Included ({productCount})</Text>
                  </XStack>
                </CardTitle>
              </CardHeader>
              <CardContent padding="$0">
                {bundle.products && bundle.products.length > 0 ? (
                  bundle.products.map((product, index) => (
                    <YStack key={product.id || index}>
                      <ProductItem product={product} />
                      {index < bundle.products!.length - 1 && (
                        <Separator marginHorizontal="$3" />
                      )}
                    </YStack>
                  ))
                ) : (
                  <YStack padding="$4" alignItems="center">
                    <Text color="$mutedForeground">No products listed</Text>
                  </YStack>
                )}
              </CardContent>
            </Card>

            {/* Spacer for bottom button */}
            <YStack height={100} />
          </YStack>
        </ScrollView>

        {/* Bottom Action Bar */}
        <YStack 
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          padding="$4"
          paddingBottom="$6"
          backgroundColor="$background"
          borderTopWidth={1}
          borderTopColor="$border"
        >
          <XStack gap="$3">
            <Button 
              flex={1}
              size="lg"
              leftIcon={<ShoppingCart size={20} />}
              onPress={handleAddToCart}
            >
              Add to Cart - ${bundle.price}
            </Button>
          </XStack>
        </YStack>
      </YStack>
    </SafeAreaView>
  );
}
