import { useState } from 'react';
import { YStack, XStack, Text, ScrollView, TextArea } from 'tamagui';
import { KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  ArrowLeft,
  Package,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Plus,
  X,
} from '@tamagui/lucide-icons';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

export default function NewBundle() {
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create bundle mutation
  const createBundle = trpc.bundles.create.useMutation({
    onSuccess: (data) => {
      toast.success('Bundle created!');
      utils.bundles.list.invalidate();
      // Navigate to edit page to add products
      router.replace(`/trainer/bundles/${data.id}/edit`);
    },
    onError: (error) => {
      toast.error('Failed to create bundle', error.message);
      setIsSubmitting(false);
    },
  });

  const handleCreate = () => {
    if (!title.trim()) {
      toast.error('Please enter a bundle title');
      return;
    }
    if (!price.trim() || isNaN(parseFloat(price))) {
      toast.error('Please enter a valid price');
      return;
    }
    
    setIsSubmitting(true);
    createBundle.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      price: price.trim(),
    });
  };

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
                Create Bundle
              </Text>
              <Text fontSize="$2" color="$mutedForeground">
                Step 1: Basic Information
              </Text>
            </YStack>
          </XStack>

          <ScrollView flex={1} contentContainerStyle={{ padding: 16 }}>
            <YStack gap="$4">
              {/* Bundle Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <XStack alignItems="center" gap="$2">
                      <Package size={20} color="$primary" />
                      <Text>Bundle Details</Text>
                    </XStack>
                  </CardTitle>
                </CardHeader>
                <CardContent gap="$4">
                  {/* Title */}
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="500" color="$color">
                      Title *
                    </Text>
                    <Input
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g., Complete Fitness Package"
                      maxLength={100}
                    />
                    <Text fontSize="$2" color="$mutedForeground">
                      {title.length}/100 characters
                    </Text>
                  </YStack>

                  {/* Description */}
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="500" color="$color">
                      Description
                    </Text>
                    <TextArea
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe what's included in this bundle..."
                      numberOfLines={4}
                      maxLength={500}
                      backgroundColor="$background"
                      borderColor="$border"
                      borderWidth={1}
                      borderRadius="$3"
                      padding="$3"
                      fontSize="$3"
                    />
                    <Text fontSize="$2" color="$mutedForeground">
                      {description.length}/500 characters
                    </Text>
                  </YStack>

                  {/* Price */}
                  <YStack gap="$2">
                    <Text fontSize="$3" fontWeight="500" color="$color">
                      Price *
                    </Text>
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
                    <Text fontSize="$2" color="$mutedForeground">
                      Set the total price for this bundle
                    </Text>
                  </YStack>
                </CardContent>
              </Card>

              {/* Next Steps Info */}
              <Card>
                <CardContent>
                  <YStack gap="$3">
                    <Text fontSize="$4" fontWeight="600" color="$color">
                      What's Next?
                    </Text>
                    <YStack gap="$2">
                      <XStack gap="$2" alignItems="flex-start">
                        <YStack 
                          width={24} 
                          height={24} 
                          borderRadius={12}
                          backgroundColor="$primary"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text fontSize="$2" fontWeight="600" color="white">1</Text>
                        </YStack>
                        <YStack flex={1}>
                          <Text fontSize="$3" fontWeight="500" color="$color">
                            Add Products
                          </Text>
                          <Text fontSize="$2" color="$mutedForeground">
                            Select products from your catalog to include
                          </Text>
                        </YStack>
                      </XStack>
                      <XStack gap="$2" alignItems="flex-start">
                        <YStack 
                          width={24} 
                          height={24} 
                          borderRadius={12}
                          backgroundColor="$muted"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text fontSize="$2" fontWeight="600" color="$mutedForeground">2</Text>
                        </YStack>
                        <YStack flex={1}>
                          <Text fontSize="$3" fontWeight="500" color="$mutedForeground">
                            Add Cover Image
                          </Text>
                          <Text fontSize="$2" color="$mutedForeground">
                            Upload or generate a cover image
                          </Text>
                        </YStack>
                      </XStack>
                      <XStack gap="$2" alignItems="flex-start">
                        <YStack 
                          width={24} 
                          height={24} 
                          borderRadius={12}
                          backgroundColor="$muted"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text fontSize="$2" fontWeight="600" color="$mutedForeground">3</Text>
                        </YStack>
                        <YStack flex={1}>
                          <Text fontSize="$3" fontWeight="500" color="$mutedForeground">
                            Submit for Review
                          </Text>
                          <Text fontSize="$2" color="$mutedForeground">
                            Get manager approval before publishing
                          </Text>
                        </YStack>
                      </XStack>
                    </YStack>
                  </YStack>
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
                onPress={handleCreate}
                disabled={isSubmitting || !title.trim() || !price.trim()}
                loading={isSubmitting}
              >
                Create Bundle
              </Button>
            </XStack>
          </YStack>
        </YStack>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
