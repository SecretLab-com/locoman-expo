import { useState, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Users, 
  UserPlus,
  Filter,
  ChevronRight,
  MoreVertical,
  MessageSquare,
  Calendar,
  Package,
  Phone,
  Mail,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/Select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, MenuItem } from '@/components/ui/DropdownMenu';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import { EmptyStateBox, SearchEmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

// Status filter options
const statusOptions = [
  { value: 'all', label: 'All Clients' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
];

// Client item component
interface Client {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: string;
  activeBundles: number;
  lastActivity: string;
  phone?: string;
  joinedAt: string;
}

function ClientItem({ 
  client, 
  onPress,
  onMessage,
  onSchedule,
  onViewBundles,
}: { 
  client: Client;
  onPress: () => void;
  onMessage: () => void;
  onSchedule: () => void;
  onViewBundles: () => void;
}) {
  return (
    <Card pressable onPress={onPress}>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <UserAvatar src={client.avatar} name={client.name} size="lg" />
          <YStack flex={1} gap="$1">
            <Text fontSize="$4" fontWeight="600" color="$color" numberOfLines={1}>
              {client.name}
            </Text>
            <Text fontSize="$2" color="$mutedForeground" numberOfLines={1}>
              {client.email}
            </Text>
            <XStack gap="$2" marginTop="$1" alignItems="center">
              <Badge variant={getStatusBadgeVariant(client.status)} size="sm">
                {client.status}
              </Badge>
              {client.activeBundles > 0 && (
                <Text fontSize="$1" color="$mutedForeground">
                  {client.activeBundles} active bundle{client.activeBundles > 1 ? 's' : ''}
                </Text>
              )}
            </XStack>
          </YStack>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical size={20} color="$mutedForeground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <MenuItem
                icon={<MessageSquare size={16} />}
                label="Send Message"
                onPress={onMessage}
              />
              <MenuItem
                icon={<Calendar size={16} />}
                label="Schedule Session"
                onPress={onSchedule}
              />
              <MenuItem
                icon={<Package size={16} />}
                label="View Bundles"
                onPress={onViewBundles}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </XStack>
      </CardContent>
    </Card>
  );
}

export default function TrainerClients() {
  const router = useRouter();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch clients
  const { 
    data: clients, 
    isLoading,
    refetch,
  } = trpc.trainer.getClients.useQuery({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: searchQuery || undefined,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleClientPress = (clientId: string) => {
    router.push(`/trainer/clients/${clientId}`);
  };

  const handleMessage = (clientId: string) => {
    router.push(`/trainer/messages/${clientId}`);
  };

  const handleSchedule = (clientId: string) => {
    router.push(`/trainer/schedule/new?clientId=${clientId}`);
  };

  const handleViewBundles = (clientId: string) => {
    router.push(`/trainer/clients/${clientId}/bundles`);
  };

  // Stats
  const stats = useMemo(() => {
    if (!clients) return { active: 0, inactive: 0, total: 0 };
    return {
      active: clients.filter(c => c.status === 'active').length,
      inactive: clients.filter(c => c.status === 'inactive').length,
      total: clients.length,
    };
  }, [clients]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <YStack padding="$4" paddingBottom="$2" gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontSize="$7" fontWeight="700" color="$color">Clients</Text>
              <Text fontSize="$3" color="$mutedForeground">
                {stats.active} active • {stats.total} total
              </Text>
            </YStack>
            <Button 
              size="sm" 
              leftIcon={<UserPlus size={16} />}
              onPress={() => router.push('/trainer/clients/invite')}
            >
              Invite
            </Button>
          </XStack>

          {/* Search and Filter */}
          <XStack gap="$2">
            <YStack flex={1}>
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search clients..."
              />
            </YStack>
            <Button 
              variant={showFilters ? 'secondary' : 'outline'} 
              size="icon"
              onPress={() => setShowFilters(!showFilters)}
            >
              <Filter size={20} />
            </Button>
          </XStack>

          {/* Filter Options */}
          {showFilters && (
            <SelectField
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={statusOptions}
            />
          )}
        </YStack>

        {/* Client List */}
        <FlatList
          data={clients || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <ClientItem
              client={item}
              onPress={() => handleClientPress(item.id)}
              onMessage={() => handleMessage(item.id)}
              onSchedule={() => handleSchedule(item.id)}
              onViewBundles={() => handleViewBundles(item.id)}
            />
          )}
          ListEmptyComponent={
            isLoading ? (
              <YStack gap="$3">
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </YStack>
            ) : searchQuery ? (
              <SearchEmptyState 
                query={searchQuery} 
                onClear={() => setSearchQuery('')} 
              />
            ) : (
              <EmptyStateBox
                icon={<Users size={32} color="$mutedForeground" />}
                title="No clients yet"
                description="Invite clients to start building your wellness community."
                action={{
                  label: 'Invite Client',
                  onPress: () => router.push('/trainer/clients/invite'),
                }}
              />
            )
          }
        />
      </YStack>
    </SafeAreaView>
  );
}
