import React, { useState } from 'react';
import { XStack, YStack, Text, Image, styled } from 'tamagui';
import { 
  Menu, 
  User, 
  Settings, 
  LogOut, 
  ShoppingCart,
  Bell,
  ChevronDown,
} from '@tamagui/lucide-icons';
import { Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './ui/DropdownMenu';

const HeaderContainer = styled(XStack, {
  name: 'HeaderContainer',
  height: 60,
  paddingHorizontal: '$4',
  backgroundColor: '$background',
  borderBottomWidth: 1,
  borderBottomColor: '$borderColor',
  alignItems: 'center',
  justifyContent: 'space-between',
});

interface TopHeaderProps {
  title?: string;
  showMenu?: boolean;
  showCart?: boolean;
  cartCount?: number;
  onMenuPress?: () => void;
}

export function TopHeader({ 
  title, 
  showMenu = false, 
  showCart = true,
  cartCount = 0,
  onMenuPress,
}: TopHeaderProps) {
  const router = useRouter();
  const { user, isAuthenticated, logout, login } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  
  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };
  
  const handleLogin = () => {
    login();
  };
  
  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'coordinator':
      case 'manager':
        return 'Manager';
      case 'trainer':
        return 'Trainer';
      case 'client':
        return 'Client';
      default:
        return 'Shopper';
    }
  };
  
  return (
    <HeaderContainer>
      {/* Left side */}
      <XStack alignItems="center" gap="$3">
        {showMenu && (
          <Pressable onPress={onMenuPress}>
            <Menu size={24} color="$color" />
          </Pressable>
        )}
        
        <Pressable onPress={() => router.push('/')}>
          <XStack alignItems="center" gap="$2">
            <Text fontSize="$5" fontWeight="700" color="$blue10">
              🏃 LocoMotivate
            </Text>
          </XStack>
        </Pressable>
      </XStack>
      
      {/* Right side */}
      <XStack alignItems="center" gap="$3">
        {/* Cart */}
        {showCart && (
          <Pressable onPress={() => router.push('/cart')}>
            <YStack position="relative">
              <ShoppingCart size={24} color="$color" />
              {cartCount > 0 && (
                <Badge
                  variant="destructive"
                  size="sm"
                  position="absolute"
                  top={-8}
                  right={-8}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </Badge>
              )}
            </YStack>
          </Pressable>
        )}
        
        {/* User menu */}
        {isAuthenticated ? (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger>
              <Pressable onPress={() => setMenuOpen(!menuOpen)}>
                <XStack alignItems="center" gap="$2">
                  <Avatar
                    src={user?.photoUrl || user?.avatar}
                    fallback={user?.name?.charAt(0) || 'U'}
                    size="sm"
                  />
                  <YStack display={Platform.OS === 'web' ? 'flex' : 'none'}>
                    <Text fontSize="$3" fontWeight="500" color="$color">
                      {user?.name}
                    </Text>
                    <Text fontSize="$2" color="$gray10">
                      {getRoleLabel(user?.role)}
                    </Text>
                  </YStack>
                  <ChevronDown size={16} color="$gray10" />
                </XStack>
              </Pressable>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent>
              <DropdownMenuItem onPress={() => {
                setMenuOpen(false);
                router.push('/profile');
              }}>
                <User size={16} />
                <Text>Profile</Text>
              </DropdownMenuItem>
              
              <DropdownMenuItem onPress={() => {
                setMenuOpen(false);
                router.push('/settings');
              }}>
                <Settings size={16} />
                <Text>Settings</Text>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem onPress={() => {
                setMenuOpen(false);
                handleLogout();
              }}>
                <LogOut size={16} />
                <Text>Sign Out</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Pressable onPress={handleLogin}>
            <XStack
              backgroundColor="$blue10"
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderRadius="$3"
              alignItems="center"
              gap="$2"
            >
              <User size={16} color="white" />
              <Text color="white" fontSize="$3" fontWeight="500">
                Sign In
              </Text>
            </XStack>
          </Pressable>
        )}
      </XStack>
    </HeaderContainer>
  );
}

export default TopHeader;
