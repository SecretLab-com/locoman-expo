import { useState } from 'react';
import { YStack, XStack, Text, ScrollView, Image } from 'tamagui';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ShoppingCart, 
  Trash2,
  Plus,
  Minus,
  Package,
  ChevronLeft,
  Tag,
  CreditCard,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Separator } from '@/components/ui/Separator';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import { EmptyStateBox } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc';

// Cart item component
interface CartItem {
  id: string;
  bundleId: string;
  bundleName: string;
  bundleImage?: string;
  price: number;
  quantity: number;
  trainerName: string;
}

function CartItemCard({ 
  item, 
  onUpdateQuantity,
  onRemove,
  isUpdating,
}: { 
  item: CartItem;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  isUpdating: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <XStack gap="$3">
          <YStack 
            width={80}
            height={80}
            backgroundColor="$muted"
            borderRadius="$3"
            overflow="hidden"
            alignItems="center"
            justifyContent="center"
          >
            {item.bundleImage ? (
              <Image
                source={{ uri: item.bundleImage }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Package size={32} color="$mutedForeground" />
            )}
          </YStack>

          <YStack flex={1} gap="$1">
            <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={2}>
              {item.bundleName}
            </Text>
            <Text fontSize="$2" color="$mutedForeground">
              by {item.trainerName}
            </Text>
            <Text fontSize="$4" fontWeight="700" color="$primary">
              ${item.price}
            </Text>
          </YStack>

          <YStack alignItems="flex-end" justifyContent="space-between">
            <Button 
              variant="ghost" 
              size="icon"
              onPress={onRemove}
              disabled={isUpdating}
            >
              <Trash2 size={18} color="$error" />
            </Button>

            <XStack alignItems="center" gap="$2">
              <Button
                variant="outline"
                size="icon"
                onPress={() => onUpdateQuantity(Math.max(1, item.quantity - 1))}
                disabled={item.quantity <= 1 || isUpdating}
              >
                <Minus size={16} />
              </Button>
              <Text fontSize="$3" fontWeight="600" minWidth={24} textAlign="center">
                {item.quantity}
              </Text>
              <Button
                variant="outline"
                size="icon"
                onPress={() => onUpdateQuantity(item.quantity + 1)}
                disabled={isUpdating}
              >
                <Plus size={16} />
              </Button>
            </XStack>
          </YStack>
        </XStack>
      </CardContent>
    </Card>
  );
}

// Order summary component
function OrderSummary({ 
  subtotal, 
  discount, 
  shipping, 
  total,
}: { 
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}) {
  return (
    <Card>
      <CardContent gap="$3">
        <Text fontSize="$4" fontWeight="600" color="$color">Order Summary</Text>
        
        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <Text fontSize="$3" color="$mutedForeground">Subtotal</Text>
            <Text fontSize="$3" color="$color">${subtotal.toFixed(2)}</Text>
          </XStack>
          
          {discount > 0 && (
            <XStack justifyContent="space-between">
              <Text fontSize="$3" color="$success">Discount</Text>
              <Text fontSize="$3" color="$success">-${discount.toFixed(2)}</Text>
            </XStack>
          )}
          
          <XStack justifyContent="space-between">
            <Text fontSize="$3" color="$mutedForeground">Shipping</Text>
            <Text fontSize="$3" color="$color">
              {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
            </Text>
          </XStack>
        </YStack>

        <Separator />

        <XStack justifyContent="space-between">
          <Text fontSize="$4" fontWeight="600" color="$color">Total</Text>
          <Text fontSize="$5" fontWeight="700" color="$primary">${total.toFixed(2)}</Text>
        </XStack>
      </CardContent>
    </Card>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);

  // Fetch cart items
  const { 
    data: cart, 
    isLoading,
    refetch,
  } = trpc.shop.getCart.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Update quantity mutation
  const updateQuantity = trpc.shop.updateCartItemQuantity.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to update', error.message);
    },
  });

  // Remove item mutation
  const removeItem = trpc.shop.removeFromCart.useMutation({
    onSuccess: () => {
      toast.success('Item removed');
      refetch();
    },
    onError: (error) => {
      toast.error('Failed to remove', error.message);
    },
  });

  // Apply promo code mutation
  const applyPromo = trpc.shop.applyPromoCode.useMutation({
    onSuccess: (data) => {
      setAppliedPromo(promoCode);
      toast.success('Promo applied', `You saved $${data.discount.toFixed(2)}!`);
      refetch();
    },
    onError: (error) => {
      toast.error('Invalid promo code', error.message);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    updateQuantity.mutate({ itemId, quantity });
  };

  const handleRemoveItem = (itemId: string) => {
    removeItem.mutate({ itemId });
  };

  const handleApplyPromo = () => {
    if (promoCode.trim()) {
      applyPromo.mutate({ code: promoCode.trim() });
    }
  };

  const handleCheckout = () => {
    router.push('/checkout');
  };

  // Calculate totals
  const subtotal = cart?.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
  const discount = cart?.discount || 0;
  const shipping = subtotal >= 50 ? 0 : 5.99;
  const total = subtotal - discount + shipping;

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background">
          {/* Header */}
          <XStack padding="$4" alignItems="center" gap="$3">
            <Button variant="ghost" size="icon" onPress={() => router.back()}>
              <ChevronLeft size={24} />
            </Button>
            <Text fontSize="$5" fontWeight="600" color="$color">Cart</Text>
          </XStack>

          <YStack flex={1} padding="$4" justifyContent="center">
            <EmptyStateBox
              icon={<ShoppingCart size={48} color="$mutedForeground" />}
              title="Sign in to view your cart"
              description="Your cart items will be saved when you sign in."
              action={{
                label: 'Sign In',
                onPress: () => router.push('/login'),
              }}
            />
          </YStack>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <XStack padding="$4" alignItems="center" gap="$3">
          <Button variant="ghost" size="icon" onPress={() => router.back()}>
            <ChevronLeft size={24} />
          </Button>
          <Text fontSize="$5" fontWeight="600" color="$color" flex={1}>
            Cart
          </Text>
          {cart?.items?.length ? (
            <Badge variant="secondary">{cart.items.length} items</Badge>
          ) : null}
        </XStack>

        {isLoading ? (
          <YStack padding="$4" gap="$3">
            <SkeletonListItem />
            <SkeletonListItem />
          </YStack>
        ) : cart?.items?.length ? (
          <>
            <ScrollView
              flex={1}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
            >
              {/* Cart Items */}
              {cart.items.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  onUpdateQuantity={(qty) => handleUpdateQuantity(item.id, qty)}
                  onRemove={() => handleRemoveItem(item.id)}
                  isUpdating={updateQuantity.isPending || removeItem.isPending}
                />
              ))}

              {/* Promo Code */}
              <Card>
                <CardContent>
                  <XStack gap="$2" alignItems="flex-end">
                    <YStack flex={1}>
                      <Input
                        label="Promo Code"
                        placeholder="Enter code"
                        value={promoCode}
                        onChangeText={setPromoCode}
                        leftIcon={<Tag size={18} color="$mutedForeground" />}
                        disabled={!!appliedPromo}
                      />
                    </YStack>
                    <Button
                      variant="outline"
                      onPress={handleApplyPromo}
                      loading={applyPromo.isPending}
                      disabled={!promoCode.trim() || !!appliedPromo}
                    >
                      Apply
                    </Button>
                  </XStack>
                  {appliedPromo && (
                    <XStack alignItems="center" gap="$2" marginTop="$2">
                      <Badge variant="success">{appliedPromo}</Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onPress={() => {
                          setAppliedPromo(null);
                          setPromoCode('');
                          refetch();
                        }}
                      >
                        Remove
                      </Button>
                    </XStack>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary */}
              <OrderSummary
                subtotal={subtotal}
                discount={discount}
                shipping={shipping}
                total={total}
              />

              {/* Free Shipping Notice */}
              {shipping > 0 && (
                <Card variant="outline">
                  <CardContent>
                    <Text fontSize="$2" color="$mutedForeground" textAlign="center">
                      Add ${(50 - subtotal).toFixed(2)} more for free shipping!
                    </Text>
                  </CardContent>
                </Card>
              )}
            </ScrollView>

            {/* Checkout Button */}
            <YStack 
              padding="$4" 
              borderTopWidth={1} 
              borderTopColor="$borderColor"
              backgroundColor="$background"
            >
              <Button 
                size="lg" 
                fullWidth
                leftIcon={<CreditCard size={20} />}
                onPress={handleCheckout}
              >
                Checkout (${total.toFixed(2)})
              </Button>
            </YStack>
          </>
        ) : (
          <YStack flex={1} padding="$4" justifyContent="center">
            <EmptyStateBox
              icon={<ShoppingCart size={48} color="$mutedForeground" />}
              title="Your cart is empty"
              description="Browse our bundles and add items to your cart."
              action={{
                label: 'Browse Bundles',
                onPress: () => router.push('/shop'),
              }}
            />
          </YStack>
        )}
      </YStack>
    </SafeAreaView>
  );
}
