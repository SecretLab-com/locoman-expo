import { useState, useEffect } from 'react';
import { YStack, XStack, Text, ScrollView, TextArea } from 'tamagui';
import { KeyboardAvoidingView, Platform, Alert, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft,
  Package,
  DollarSign,
  Plus,
  X,
  Check,
  Search,
} from '@tamagui/lucide-icons';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { trpc } from '@/lib/trpc';

interface Product {
  id: number;
  name: string;
  quantity: number;
}

export default function EditBundle() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const utils = trpc.useUtils();
  
  const bundleId = parseInt(id || '0', 10);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  // Fetch bundle details
  const { 
    data: bundle, 
    isLoading,
  } = trpc.bundles.get.useQuery(
    { id: bundleId },
    { enabled: bundleId > 0 }
  );

  // Fetch available products
  const { data: availableProducts } = trpc.products.list.useQuery();

  // Update bundle mutation
  const updateBundle = trpc.bundles.update.useMutation({
    onSuccess: () => {
      toast.success('Bundle updated!');
      utils.bundles.get.invalidate({ id: bundleId });
      utils.bundles.list.invalidate();
      router.back();
    },
    onError: (error) => {
      toast.error('Failed to update bundle', error.message);
      setIsSubmitting(false);
    },
  });

  // Initialize form with bundle data
  useEffect(() => {
    if (bundle) {
      setTitle(bundle.title);
      setDescription(bundle.description || '');
      setPrice(bundle.price);
      setProducts(bundle.products || []);
    }
  }, [bundle]);

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Please enter a bundle title');
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      toast.error('Please enter a valid price');
      return;
    }
    
    setIsSubmitting(true);
    updateBundle.mutate({
      id: bundleId,
      title: title.trim(),
      description: description.trim() || undefined,
      price: price.trim(),
      products: products.map(p => ({ id: p.id, name: p.name, quantity: p.quantity })),
    });
  };

  const addProduct = (product: { id: number; title: string }) => {
    const existing = products.find(p => p.id === product.id);
    if (existing) {
      setProducts(products.map(p => 
        p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p
      ));
    } else {
      setProducts([...products, { id: product.id, name: product.title, quantity: 1 }]);
    }
    setShowProductPicker(false);
    setProductSearch('');
  };

  const removeProduct = (productId: number) => {
    setProducts(products.filter(p => p.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) {
      removeProduct(productId);
      return;
    }
    setProducts(products.map(p => 
      p.id === productId ? { ...p, quantity } : p
    ));
  };

  const filteredProducts = availableProducts?.filter(p => 
    p.title.toLowerCase().includes(productSearch.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background" padding="$4" gap="$4">
          <Skeleton width="100%" height={50} />
          <Skeleton width="100%" height={100} />
          <Skeleton width="100%" height={50} />
        </YStack>
      </SafeAreaView>
    );
  }

  if (!bundle) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background" padding="$4" alignItems="center" justifyContent="center">
          <Package size={48} color="$mutedForeground" />
          <Text fontSize="$5" fontWeight="600" color="$color" marginTop="$4">
            Bundle Not Found
          </Text>
          <Button marginTop="$4" onPress={() => router.back()}>
            Go Back
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  const canEdit = bundle.status === 'draft' || bundle.status === 'rejected';

  if (!canEdit) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background" padding="$4" alignItems="center" justifyContent="center">
          <Package size={48} color="$mutedForeground" />
          <Text fontSize="$5" fontWeight="600" color="$color" marginTop="$4">
            Cannot Edit Bundle
          </Text>
          <Text fontSize="$3" color="$mutedForeground" marginTop="$2" textAlign="center">
            This bundle is currently {bundle.status.replace('_', ' ')} and cannot be edited.
          </Text>
          <Button marginTop="$4" onPress={() => router.back()}>
            Go Back
          </Button>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <YStack flex={1} backgroundColor="$background">
          {/* Header */}
          <XStack 
            padding="$4" 
            alignItems="center" 
            gap="$3"
            borderBottomWidth={1}
            borderBottomColor="$border"
          >
            <Button 
              variant="ghost" 
              size="icon" 
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} />
            </Button>
            <YStack flex={1}>
              <Text fontSize="$6" fontWeight="700" color="$color">
                Edit Bundle
              </Text>
              <Text fontSize="$2" color="$mutedForeground">
                {bundle.title}
              </Text>
            </YStack>
          </XStack>

          <ScrollView flex={1} contentContainerStyle={{ padding: 16 }}>
            <YStack gap="$4">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent gap="$4">
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="500" color="$color">Title *</Text>
                    <Input
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Bundle title"
                      maxLength={100}
                    />
                  </YStack>

                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="500" color="$color">Description</Text>
                    <TextArea
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe your bundle..."
                      numberOfLines={3}
                      maxLength={500}
                      backgroundColor="$background"
                      borderColor="$border"
                      borderWidth={1}
                      borderRadius="$3"
                      padding="$3"
                      fontSize="$3"
                    />
                  </YStack>

                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="500" color="$color">Price *</Text>
                    <XStack alignItems="center" gap="$2">
                      <YStack 
                        backgroundColor="$muted" 
                        padding="$3" 
                        borderRadius="$3"
                        borderTopRightRadius={0}
                        borderBottomRightRadius={0}
                      >
                        <DollarSign size={20} color="$mutedForeground" />
                      </YStack>
                      <Input
                        flex={1}
                        value={price}
                        onChangeText={setPrice}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                      />
                    </XStack>
                  </YStack>
                </CardContent>
              </Card>

              {/* Products */}
              <Card>
                <CardHeader>
                  <XStack justifyContent="space-between" alignItems="center">
                    <CardTitle>Products ({products.length})</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm"
                      leftIcon={<Plus size={16} />}
                      onPress={() => setShowProductPicker(true)}
                    >
                      Add
                    </Button>
                  </XStack>
                </CardHeader>
                <CardContent>
                  {products.length > 0 ? (
                    <YStack gap="$3">
                      {products.map((product) => (
                        <XStack 
                          key={product.id} 
                          alignItems="center" 
                          gap="$3"
                          padding="$3"
                          backgroundColor="$muted"
                          borderRadius="$3"
                        >
                          <YStack 
                            width={40} 
                            height={40} 
                            backgroundColor="$background"
                            borderRadius="$2"
                            alignItems="center"
                            justifyContent="center"
                          >
                            <Package size={20} color="$mutedForeground" />
                          </YStack>
                          <YStack flex={1}>
                            <Text fontSize="$3" fontWeight="500" color="$color" numberOfLines={1}>
                              {product.name}
                            </Text>
                          </YStack>
                          <XStack alignItems="center" gap="$2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onPress={() => updateQuantity(product.id, product.quantity - 1)}
                            >
                              -
                            </Button>
                            <Text fontSize="$3" fontWeight="600" minWidth={24} textAlign="center">
                              {product.quantity}
                            </Text>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onPress={() => updateQuantity(product.id, product.quantity + 1)}
                            >
                              +
                            </Button>
                          </XStack>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onPress={() => removeProduct(product.id)}
                          >
                            <X size={16} color="$red10" />
                          </Button>
                        </XStack>
                      ))}
                    </YStack>
                  ) : (
                    <YStack alignItems="center" padding="$4">
                      <Package size={32} color="$mutedForeground" />
                      <Text fontSize="$3" color="$mutedForeground" marginTop="$2">
                        No products added yet
                      </Text>
                      <Text fontSize="$2" color="$mutedForeground">
                        Add products to create your bundle
                      </Text>
                    </YStack>
                  )}
                </CardContent>
              </Card>
            </YStack>
          </ScrollView>

          {/* Footer Actions */}
          <YStack 
            padding="$4" 
            borderTopWidth={1} 
            borderTopColor="$border"
            backgroundColor="$background"
          >
            <XStack gap="$3">
              <Button 
                variant="outline" 
                flex={1}
                onPress={() => router.back()}
              >
                Cancel
              </Button>
              <Button 
                flex={1}
                onPress={handleSave}
                disabled={isSubmitting || !title.trim() || !price.trim()}
                loading={isSubmitting}
              >
                Save Changes
              </Button>
            </XStack>
          </YStack>
        </YStack>

        {/* Product Picker Dialog */}
        <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
            </DialogHeader>
            <YStack gap="$3" maxHeight={400}>
              <SearchInput
                value={productSearch}
                onChangeText={setProductSearch}
                placeholder="Search products..."
              />
              <ScrollView style={{ maxHeight: 300 }}>
                <YStack gap="$2">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <XStack
                        key={product.id}
                        padding="$3"
                        backgroundColor="$muted"
                        borderRadius="$2"
                        alignItems="center"
                        gap="$3"
                        pressStyle={{ opacity: 0.7 }}
                        onPress={() => addProduct(product)}
                      >
                        <Package size={20} color="$mutedForeground" />
                        <YStack flex={1}>
                          <Text fontSize="$3" fontWeight="500" color="$color" numberOfLines={1}>
                            {product.title}
                          </Text>
                          {product.price && (
                            <Text fontSize="$2" color="$mutedForeground">
                              ${product.price}
                            </Text>
                          )}
                        </YStack>
                        <Plus size={20} color="$primary" />
                      </XStack>
                    ))
                  ) : (
                    <YStack alignItems="center" padding="$4">
                      <Text fontSize="$3" color="$mutedForeground">
                        {productSearch ? 'No products found' : 'No products available'}
                      </Text>
                    </YStack>
                  )}
                </YStack>
              </ScrollView>
            </YStack>
            <DialogFooter>
              <Button variant="outline" onPress={() => setShowProductPicker(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
