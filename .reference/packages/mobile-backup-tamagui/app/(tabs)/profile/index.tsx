import { useState } from 'react';
import { YStack, XStack, Text, ScrollView } from 'tamagui';
import { RefreshControl, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  User,
  Settings,
  Bell,
  CreditCard,
  Package,
  Heart,
  HelpCircle,
  LogOut,
  ChevronRight,
  Shield,
  Moon,
  Globe,
  MessageSquare,
  Star,
} from '@tamagui/lucide-icons';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserAvatar } from '@/components/ui/Avatar';
import { Separator } from '@/components/ui/Separator';
import { ResponsiveDialog } from '@/components/ui/Dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';

// Menu item component
interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
  destructive?: boolean;
}

function MenuItem({ icon, title, description, onPress, rightElement, destructive }: MenuItemProps) {
  return (
    <XStack
      padding="$3"
      alignItems="center"
      gap="$3"
      pressStyle={{ opacity: 0.7 }}
      onPress={onPress}
    >
      <YStack 
        backgroundColor={destructive ? '$errorLight' : '$muted'} 
        padding="$2" 
        borderRadius="$2"
      >
        {icon}
      </YStack>
      <YStack flex={1}>
        <Text 
          fontSize="$3" 
          fontWeight="500" 
          color={destructive ? '$error' : '$color'}
        >
          {title}
        </Text>
        {description && (
          <Text fontSize="$2" color="$mutedForeground">{description}</Text>
        )}
      </YStack>
      {rightElement || <ChevronRight size={20} color="$mutedForeground" />}
    </XStack>
  );
}

// Menu section component
function MenuSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <YStack gap="$1">
      {title && (
        <Text 
          fontSize="$2" 
          fontWeight="600" 
          color="$mutedForeground" 
          paddingHorizontal="$3"
          marginBottom="$1"
        >
          {title}
        </Text>
      )}
      <Card>
        <CardContent padding="$0">
          {children}
        </CardContent>
      </Card>
    </YStack>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isAuthenticated, isAdmin, isTrainer } = useAuth();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Refresh user data if needed
    setRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out', 'You have been logged out successfully.');
    } catch (error) {
      toast.error('Logout failed', 'Please try again.');
    }
  };

  const handleSupport = () => {
    Linking.openURL('mailto:support@locomotivate.com');
  };

  // Role badge
  const getRoleBadge = () => {
    if (!user) return null;
    const roleColors: Record<string, string> = {
      coordinator: 'info',
      manager: 'info',
      trainer: 'success',
      client: 'warning',
      shopper: 'secondary',
    };
    return (
      <Badge variant={roleColors[user.role] as any || 'secondary'}>
        {user.role}
      </Badge>
    );
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <YStack flex={1} backgroundColor="$background" padding="$4" justifyContent="center">
          <Card variant="elevated">
            <CardContent>
              <YStack alignItems="center" gap="$4" padding="$4">
                <YStack 
                  backgroundColor="$muted" 
                  padding="$4" 
                  borderRadius="$6"
                >
                  <User size={48} color="$mutedForeground" />
                </YStack>
                <YStack alignItems="center" gap="$2">
                  <Text fontSize="$5" fontWeight="600" color="$color">
                    Sign in to your account
                  </Text>
                  <Text fontSize="$3" color="$mutedForeground" textAlign="center">
                    Access your orders, subscriptions, and personalized recommendations
                  </Text>
                </YStack>
                <Button size="lg" fullWidth onPress={() => router.push('/login')}>
                  Sign In
                </Button>
              </YStack>
            </CardContent>
          </Card>
        </YStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView
        flex={1}
        backgroundColor="$background"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <YStack padding="$4" gap="$4">
          {/* Profile Header */}
          <Card>
            <CardContent>
              <XStack alignItems="center" gap="$4">
                <UserAvatar 
                  src={user?.avatar} 
                  name={user?.name || 'User'} 
                  size="xl" 
                />
                <YStack flex={1} gap="$1">
                  <XStack alignItems="center" gap="$2">
                    <Text fontSize="$5" fontWeight="700" color="$color">
                      {user?.name}
                    </Text>
                    {getRoleBadge()}
                  </XStack>
                  <Text fontSize="$3" color="$mutedForeground">
                    {user?.email}
                  </Text>
                </YStack>
              </XStack>
              <Button 
                variant="outline" 
                size="sm" 
                marginTop="$3"
                onPress={() => router.push('/profile/edit')}
              >
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats for Trainers */}
          {isTrainer && (
            <XStack gap="$3">
              <Card flex={1}>
                <CardContent alignItems="center">
                  <Text fontSize="$6" fontWeight="700" color="$primary">24</Text>
                  <Text fontSize="$2" color="$mutedForeground">Clients</Text>
                </CardContent>
              </Card>
              <Card flex={1}>
                <CardContent alignItems="center">
                  <Text fontSize="$6" fontWeight="700" color="$primary">12</Text>
                  <Text fontSize="$2" color="$mutedForeground">Bundles</Text>
                </CardContent>
              </Card>
              <Card flex={1}>
                <CardContent alignItems="center">
                  <Text fontSize="$6" fontWeight="700" color="$primary">4.9</Text>
                  <Text fontSize="$2" color="$mutedForeground">Rating</Text>
                </CardContent>
              </Card>
            </XStack>
          )}

          {/* Account Section */}
          <MenuSection title="ACCOUNT">
            <MenuItem
              icon={<Package size={18} color="$mutedForeground" />}
              title="My Orders"
              description="View order history and tracking"
              onPress={() => router.push('/profile/orders')}
            />
            <Separator />
            <MenuItem
              icon={<Heart size={18} color="$mutedForeground" />}
              title="Wishlist"
              description="Saved bundles and products"
              onPress={() => router.push('/wishlist')}
            />
            <Separator />
            <MenuItem
              icon={<CreditCard size={18} color="$mutedForeground" />}
              title="Payment Methods"
              description="Manage your payment options"
              onPress={() => router.push('/profile/payments')}
            />
          </MenuSection>

          {/* Preferences Section */}
          <MenuSection title="PREFERENCES">
            <MenuItem
              icon={<Bell size={18} color="$mutedForeground" />}
              title="Notifications"
              description="Manage notification settings"
              onPress={() => router.push('/profile/notifications')}
            />
            <Separator />
            <MenuItem
              icon={<Moon size={18} color="$mutedForeground" />}
              title="Appearance"
              description="Theme and display settings"
              onPress={() => router.push('/profile/appearance')}
            />
            <Separator />
            <MenuItem
              icon={<Globe size={18} color="$mutedForeground" />}
              title="Language"
              description="English"
              onPress={() => router.push('/profile/language')}
            />
          </MenuSection>

          {/* Support Section */}
          <MenuSection title="SUPPORT">
            <MenuItem
              icon={<HelpCircle size={18} color="$mutedForeground" />}
              title="Help Center"
              description="FAQs and guides"
              onPress={() => router.push('/help')}
            />
            <Separator />
            <MenuItem
              icon={<MessageSquare size={18} color="$mutedForeground" />}
              title="Contact Support"
              description="Get help from our team"
              onPress={handleSupport}
            />
            <Separator />
            <MenuItem
              icon={<Star size={18} color="$mutedForeground" />}
              title="Rate the App"
              description="Share your feedback"
              onPress={() => {}}
            />
          </MenuSection>

          {/* Legal Section */}
          <MenuSection title="LEGAL">
            <MenuItem
              icon={<Shield size={18} color="$mutedForeground" />}
              title="Privacy Policy"
              onPress={() => router.push('/privacy')}
            />
            <Separator />
            <MenuItem
              icon={<Shield size={18} color="$mutedForeground" />}
              title="Terms of Service"
              onPress={() => router.push('/terms')}
            />
          </MenuSection>

          {/* Logout */}
          <MenuSection>
            <MenuItem
              icon={<LogOut size={18} color="$error" />}
              title="Log Out"
              onPress={() => setLogoutDialogOpen(true)}
              destructive
              rightElement={null}
            />
          </MenuSection>

          {/* App Version */}
          <YStack alignItems="center" gap="$1" paddingVertical="$4">
            <Text fontSize="$2" color="$mutedForeground">LocoMotivate v1.0.0</Text>
            <Text fontSize="$1" color="$mutedForeground">© 2024 LocoMotivate</Text>
          </YStack>
        </YStack>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <ResponsiveDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        title="Log Out"
        description="Are you sure you want to log out of your account?"
        footer={
          <>
            <Button variant="outline" onPress={() => setLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onPress={handleLogout}>
              Log Out
            </Button>
          </>
        }
      />
    </SafeAreaView>
  );
}
