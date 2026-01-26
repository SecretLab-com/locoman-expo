import React from 'react';
import { XStack, YStack, Text, styled } from 'tamagui';
import { 
  Home, 
  ShoppingBag, 
  User, 
  LayoutDashboard,
  Package,
  Users,
  Settings,
  Calendar,
  DollarSign,
  ClipboardList,
  Truck,
  Award,
} from '@tamagui/lucide-icons';
import { Pressable, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from './ui/Badge';

const TabBarContainer = styled(XStack, {
  name: 'TabBarContainer',
  height: Platform.OS === 'ios' ? 85 : 65,
  paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  backgroundColor: '$background',
  borderTopWidth: 1,
  borderTopColor: '$borderColor',
  justifyContent: 'space-around',
  alignItems: 'center',
});

interface TabItem {
  key: string;
  label: string;
  icon: React.ComponentType<any>;
  href: string;
  badge?: number;
}

const SHOPPER_TABS: TabItem[] = [
  { key: 'home', label: 'Home', icon: Home, href: '/' },
  { key: 'shop', label: 'Shop', icon: ShoppingBag, href: '/shop' },
  { key: 'profile', label: 'Profile', icon: User, href: '/profile' },
];

const CLIENT_TABS: TabItem[] = [
  { key: 'home', label: 'Home', icon: Home, href: '/client' },
  { key: 'orders', label: 'Orders', icon: ClipboardList, href: '/client/orders' },
  { key: 'deliveries', label: 'Deliveries', icon: Truck, href: '/client/deliveries' },
  { key: 'profile', label: 'Profile', icon: User, href: '/profile' },
];

const TRAINER_TABS: TabItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/trainer' },
  { key: 'bundles', label: 'Bundles', icon: Package, href: '/trainer/bundles' },
  { key: 'clients', label: 'Clients', icon: Users, href: '/trainer/clients' },
  { key: 'earnings', label: 'Earnings', icon: DollarSign, href: '/trainer/earnings' },
  { key: 'profile', label: 'Profile', icon: User, href: '/profile' },
];

const MANAGER_TABS: TabItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/manager' },
  { key: 'approvals', label: 'Approvals', icon: ClipboardList, href: '/manager/approvals' },
  { key: 'deliveries', label: 'Deliveries', icon: Truck, href: '/manager/deliveries' },
  { key: 'users', label: 'Users', icon: Users, href: '/manager/users' },
  { key: 'settings', label: 'Settings', icon: Settings, href: '/manager/settings' },
];

interface BottomTabNavProps {
  badges?: Record<string, number>;
}

export function BottomTabNav({ badges = {} }: BottomTabNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  
  // Determine which tabs to show based on user role
  const getTabs = (): TabItem[] => {
    if (!isAuthenticated || !user) {
      return SHOPPER_TABS;
    }
    
    switch (user.role) {
      case 'coordinator':
      case 'manager':
        return MANAGER_TABS;
      case 'trainer':
        return TRAINER_TABS;
      case 'client':
        return CLIENT_TABS;
      default:
        return SHOPPER_TABS;
    }
  };
  
  const tabs = getTabs();
  
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname?.startsWith(href);
  };
  
  return (
    <TabBarContainer>
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        const Icon = tab.icon;
        const badgeCount = badges[tab.key] || tab.badge;
        
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.href as any)}
            style={{ flex: 1, alignItems: 'center' }}
          >
            <YStack alignItems="center" gap="$1" position="relative">
              <Icon 
                size={24} 
                color={active ? '$blue10' : '$gray10'} 
              />
              {badgeCount !== undefined && badgeCount > 0 && (
                <Badge
                  variant={active ? 'default' : 'secondary'}
                  size="sm"
                  position="absolute"
                  top={-8}
                  right={-12}
                >
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Badge>
              )}
              <Text
                fontSize="$1"
                color={active ? '$blue10' : '$gray10'}
                fontWeight={active ? '600' : '400'}
              >
                {tab.label}
              </Text>
            </YStack>
          </Pressable>
        );
      })}
    </TabBarContainer>
  );
}

export default BottomTabNav;
