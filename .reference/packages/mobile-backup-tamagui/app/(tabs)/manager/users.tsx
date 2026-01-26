import { useState, useMemo } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Users, 
  Filter,
  MoreVertical,
  Shield,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/Avatar';
import { SearchInput } from '@/components/ui/SearchInput';
import { SelectField } from '@/components/ui/Select';
import { ResponsiveDialog } from '@/components/ui/Dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, MenuItem } from '@/components/ui/DropdownMenu';
import { SkeletonListItem } from '@/components/ui/Skeleton';
import { EmptyStateBox, SearchEmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { trpc } from '@/lib/trpc';

// Role options
const roleOptions = [
  { value: 'all', label: 'All Roles' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'manager', label: 'Manager' },
  { value: 'trainer', label: 'Trainer' },
  { value: 'client', label: 'Client' },
  { value: 'shopper', label: 'Shopper' },
];

const roleColors: Record<string, string> = {
  coordinator: 'info',
  manager: 'info',
  trainer: 'success',
  client: 'warning',
  shopper: 'secondary',
  pending_trainer: 'warning',
};

// User item component
interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
}

function UserItem({ 
  user, 
  onPress,
  onChangeRole,
}: { 
  user: User;
  onPress: () => void;
  onChangeRole: () => void;
}) {
  return (
    <Card pressable onPress={onPress}>
      <CardContent>
        <XStack alignItems="center" gap="$3">
          <UserAvatar src={user.avatar || undefined} name={user.name} size="lg" />
          <YStack flex={1} gap="$1">
            <Text fontSize="$4" fontWeight="600" color="$color">{user.name}</Text>
            <Text fontSize="$2" color="$mutedForeground">{user.email}</Text>
            <XStack gap="$2" marginTop="$1">
              <Badge variant={roleColors[user.role] as any || 'secondary'} size="sm">
                {user.role.replace('_', ' ')}
              </Badge>
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
                icon={<Shield size={16} />}
                label="Change Role"
                onPress={onChangeRole}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </XStack>
      </CardContent>
    </Card>
  );
}

// Change role dialog
function ChangeRoleDialog({
  open,
  onOpenChange,
  user,
  onChangeRole,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onChangeRole: (userId: number, newRole: string) => void;
  isLoading: boolean;
}) {
  const [newRole, setNewRole] = useState(user?.role || 'shopper');

  const handleChange = () => {
    if (user) {
      onChangeRole(user.id, newRole);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change User Role"
      description={user ? `Change role for ${user.name}` : ''}
      footer={
        <>
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onPress={handleChange} loading={isLoading}>
            Update Role
          </Button>
        </>
      }
    >
      <YStack gap="$4">
        {user && (
          <XStack alignItems="center" gap="$3">
            <UserAvatar src={user.avatar || undefined} name={user.name} size="lg" />
            <YStack>
              <Text fontSize="$4" fontWeight="600">{user.name}</Text>
              <Text fontSize="$2" color="$mutedForeground">{user.email}</Text>
            </YStack>
          </XStack>
        )}
        <SelectField
          label="New Role"
          value={newRole}
          onValueChange={setNewRole}
          options={roleOptions.filter(r => r.value !== 'all')}
        />
        {(newRole === 'manager' || newRole === 'coordinator') && (
          <Card variant="outline">
            <CardContent>
              <XStack alignItems="center" gap="$2">
                <Shield size={16} color="$warning" />
                <Text fontSize="$2" color="$warning">
                  This role has admin access to the platform.
                </Text>
              </XStack>
            </CardContent>
          </Card>
        )}
      </YStack>
    </ResponsiveDialog>
  );
}

export default function ManagerUsers() {
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Fetch all users using the correct API
  const { 
    data: allUsers, 
    isLoading,
    refetch,
  } = trpc.users.list.useQuery();

  // Filter users client-side
  const users = useMemo(() => {
    if (!allUsers) return [];
    let filtered = [...allUsers];
    
    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [allUsers, roleFilter, searchQuery]);

  // Change role mutation
  const changeRole = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success('Role updated', 'The user role has been changed.');
      setChangeRoleDialogOpen(false);
      setSelectedUser(null);
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error('Failed to change role', error.message);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleUserPress = (user: User) => {
    // TODO: Navigate to user detail page
    toast.info('User Details', `Viewing ${user.name}`);
  };

  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setChangeRoleDialogOpen(true);
  };

  const handleRoleChange = (userId: number, newRole: string) => {
    changeRole.mutate({ userId, role: newRole });
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <YStack flex={1} backgroundColor="$background">
        {/* Header */}
        <YStack padding="$4" paddingBottom="$2" gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack>
              <Text fontSize="$7" fontWeight="700" color="$color">Users</Text>
              <Text fontSize="$3" color="$mutedForeground">
                {users?.length || 0} users
              </Text>
            </YStack>
          </XStack>

          {/* Search and Filter */}
          <XStack gap="$2">
            <YStack flex={1}>
              <SearchInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search users..."
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
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={roleOptions}
            />
          )}
        </YStack>

        {/* User List */}
        <FlatList
          data={users || []}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <UserItem
              user={item}
              onPress={() => handleUserPress(item)}
              onChangeRole={() => handleChangeRole(item)}
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
                title="No users found"
                description="No users match the current filters."
              />
            )
          }
        />

        {/* Change Role Dialog */}
        <ChangeRoleDialog
          open={changeRoleDialogOpen}
          onOpenChange={setChangeRoleDialogOpen}
          user={selectedUser}
          onChangeRole={handleRoleChange}
          isLoading={changeRole.isPending}
        />
      </YStack>
    </SafeAreaView>
  );
}
