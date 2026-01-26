import { useState, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView, Image } from 'tamagui';
import { RefreshControl, FlatList, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Package, 
  SlidersHorizontal,
  Heart,
  Grid,
  List,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyStateBox, SearchEmptyState } from '@/components/ui/EmptyState';
import { trpc } from '@/lib/trpc';

const { width } = Dimensions.get('window');
const gridCardWidth = (width - 48) / 2;

// Sort options
const sortOptions = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

// Bundle interface matching API response
interface Bundle {
  id: number;
  title: string;
  description?: string | null;
  price: string;
  imageUrl?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  products?: Array<{ id: number; name: string; quantity: number }>;
}

// Grid view bundle card
function BundleGridCard({ bundle, onPress, onFavorite }: { 
  bundle: Bundle; 
  onPress: () => void;
  onFavorite: () => void;
}) {
  const productCount = bundle.products?.length || 0;

  return (
    <Card 
      width={gridCardWidth} 
      pressable 
      onPress={onPress}
      overflow="hidden"
    >
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
        <Button
          variant="ghost"
          size="icon"
          position="absolute"
          top={4}
          right={4}
          backgroundColor="rgba(255,255,255,0.8)"
          borderRadius="$6"
          onPress={(e) => {
            e.stopPropagation?.();
            onFavorite();
          }}
        >
          <Heart size={16} color="$mutedForeground" />
        </Button>
      </YStack>

      <CardContent gap="$2" padding="$2">
        <Text fontSize="$3" fontWeight="600" color="$color" numberOfLines={2}>
          {bundle.title}
        </Text>
        
        <Text fontSize="$1" color="$mutedForeground">
          {productCount} products
        </Text>

        <XStack alignItems="baseline" gap="$1">
          <Text fontSize="$4" fontWeight="700" color="$primary">
            ${bundle.price}
          </Text>
        </XStack>
      </CardContent>
    </Card>
  );
}

// List view bundle card
function BundleListCard({ bundle, onPress, onFavorite }: { 
  bundle: Bundle; 
  onPress: () => void;
  onFavorite: () => void;
}) {
  const productCount = bundle.products?.length || 0;

  return (
    <Card pressable onPress={onPress}>
      <CardContent>
        <XStack gap="$3">
          <YStack 
            width={80}
            height={80}
            backgroundColor="$muted"
            borderRadius="$3"
            overflow="hidden"
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
                <Package size={24} color="$mutedForeground" />
              </YStack>
            )}
          </YStack>

          <YStack flex={1} gap="$1">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={1} flex={1}>
                {bundle.title}
              </Text>
              <Button
                variant="ghost"
                size="icon"
                onPress={(e) => {
                  e.stopPropagation?.();
                  onFavorite();
                }}
              >
                <Heart size={18} color="$mutedForeground" />
              </Button>
            </XStack>

            <Text fontSize="$2" color="$mutedForeground">
              {productCount} products
            </Text>

            <XStack alignItems="baseline" gap="$2">
              <Text fontSize="$5" fontWeight="700" color="$primary">
                ${bundle.price}
              </Text>
            </XStack>
          </YStack>
        </XStack>
      </CardContent>
    </Card>
  );
}

// Category filter pill
function CategoryPill({ label, selected, onPress }: { 
  label: string; 
  selected?: boolean; 
  onPress: () => void;
}) {
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

export default function ShopBrowse() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('popular');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch published bundles using the correct API
  const { 
    data: allBundles, 
    isLoading,
    refetch,
  } = trpc.bundles.listPublished.useQuery();

  // Filter and sort bundles client-side
  const bundles = useMemo(() => {
    if (!allBundles) return [];
    let filtered = [...allBundles];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(b => 
        b.title.toLowerCase().includes(query) ||
        b.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'price_low':
        filtered.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        break;
      case 'price_high':
        filtered.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        break;
      default:
        // Keep original order for 'popular' and 'rating'
        break;
    }
    
    return filtered;
  }, [allBundles, searchQuery, sortBy]);

  // Categories are not yet implemented in the backend
  const categories: { id: string; name: string }[] = [];

  // Favorites not yet implemented
  const handleFavorite = (bundleId: string) => {
    // TODO: Implement favorites
    console.log('Favorite:', bundleId);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleBundlePress = (bundleId: number) => {
    router.push(`/shop/bundles/${bundleId}`);
  };

  const renderGridItem = ({ item }: { item: Bundle }) => (
    <BundleGridCard
      bundle={item}
      onPress={() => handleBundlePress(item.id)}
      onFavorite={() => handleFavorite(item.id.toString())}
    />
  );

  const renderListItem = ({ item }: { item: Bundle }) => (
    <BundleListCard
      bundle={item}
      onPress={() => handleBundlePress(item.id)}
      onFavorite={() => handleFavorite(item.id.toString())}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <YStack padding="$4" paddingBottom="$2" gap="$3">
          <Text fontSize="$7" fontWeight="700" color="$color">Shop</Text>

          {/* Search */}
          <XStack gap="$2">
            <YStack flex={1}>
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search bundles..."
              />
            </YStack>
            <Button 
              variant={showFilters ? 'secondary' : 'outline'} 
              size="icon"
              onPress={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={20} />
            </Button>
          </XStack>

          {/* Categories */}
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

          {/* Filters */}
          {showFilters && (
            <XStack gap="$2" alignItems="center">
              <YStack flex={1}>
                <SelectField
                  value={sortBy}
                  onValueChange={setSortBy}
                  options={sortOptions}
                />
              </YStack>
              <XStack gap="$1">
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="icon"
                  onPress={() => setViewMode('grid')}
                >
                  <Grid size={18} />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="icon"
                  onPress={() => setViewMode('list')}
                >
                  <List size={18} />
                </Button>
              </XStack>
            </XStack>
          )}

          {/* Results count */}
          <Text fontSize="$2" color="$mutedForeground">
            {bundles?.length || 0} bundles found
          </Text>
        </YStack>

        {/* Bundle List */}
        {viewMode === 'grid' ? (
          <FlatList
            data={bundles || []}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            renderItem={renderGridItem}
            ListEmptyComponent={
              isLoading ? (
                <XStack gap="$3" paddingHorizontal="$4" flexWrap="wrap">
                  <Skeleton width={gridCardWidth} height={220} />
                  <Skeleton width={gridCardWidth} height={220} />
                  <Skeleton width={gridCardWidth} height={220} />
                  <Skeleton width={gridCardWidth} height={220} />
                </XStack>
              ) : searchQuery ? (
                <SearchEmptyState 
                  query={searchQuery} 
                  onClear={() => setSearchQuery('')} 
                />
              ) : (
                <EmptyStateBox
                  icon={<Package size={32} color="$mutedForeground" />}
                  title="No bundles found"
                  description="Check back later for new bundles from our trainers."
                />
              )
            }
          />
        ) : (
          <FlatList
            data={bundles || []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            renderItem={renderListItem}
            ListEmptyComponent={
              isLoading ? (
                <YStack gap="$3">
                  <Skeleton height={100} />
                  <Skeleton height={100} />
                  <Skeleton height={100} />
                </YStack>
              ) : searchQuery ? (
                <SearchEmptyState 
                  query={searchQuery} 
                  onClear={() => setSearchQuery('')} 
                />
              ) : (
                <EmptyStateBox
                  icon={<Package size={32} color="$mutedForeground" />}
                  title="No bundles found"
                  description="Check back later for new bundles from our trainers."
                />
              )
            }
          />
        )}
      </YStack>
    </SafeAreaView>
  );
}
